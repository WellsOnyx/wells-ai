/**
 * Proactive Opportunities Service
 * AI-powered opportunity discovery for workers
 */

import { sqlQuery as sql } from '@/lib/db';
import {
  ProactiveOpportunity,
  OpportunityType,
  OpportunitySource,
  OpportunityStatus,
  WorkerProfile,
  Task,
} from './types';
import { getWorkerProfile } from './worker-service';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// =====================================================
// OPPORTUNITY MANAGEMENT
// =====================================================

export async function getProactiveOpportunities(
  workerId: string,
  options?: {
    status?: OpportunityStatus[];
    type?: OpportunityType[];
    limit?: number;
  }
): Promise<{ opportunities: ProactiveOpportunity[]; topMatch?: ProactiveOpportunity; message: string }> {
  const limit = options?.limit || 20;

  let result;
  if (options?.status && options.status.length > 0) {
    result = await sql`
      SELECT * FROM worker_proactive_opportunities
      WHERE worker_id = ${workerId} AND status = ANY(${options.status})
      ORDER BY match_score DESC NULLS LAST, created_at DESC
      LIMIT ${limit}
    `;
  } else {
    result = await sql`
      SELECT * FROM worker_proactive_opportunities
      WHERE worker_id = ${workerId} AND status IN ('new', 'pending', 'viewed')
      ORDER BY match_score DESC NULLS LAST, created_at DESC
      LIMIT ${limit}
    `;
  }

  const opportunities = result.rows.map(mapRowToOpportunity);
  const topMatch = opportunities.find(o => o.matchScore && o.matchScore >= 80);

  let message = '';
  if (opportunities.length === 0) {
    message = "No new opportunities right now. I'll keep looking for matches.";
  } else {
    const newCount = opportunities.filter(o => o.status === 'new').length;
    const totalPotential = opportunities.reduce((sum, o) => sum + (o.potentialEarnings || 0), 0);

    message = `Found ${opportunities.length} opportunities. `;
    if (newCount > 0) {
      message += `${newCount} new. `;
    }
    if (topMatch) {
      message += `Top match: "${topMatch.title}" (${topMatch.matchScore}% fit). `;
    }
    if (totalPotential > 0) {
      message += `Potential earnings: $${totalPotential.toFixed(0)}.`;
    }
  }

  return { opportunities, topMatch, message };
}

export async function getOpportunity(opportunityId: string): Promise<ProactiveOpportunity | null> {
  const result = await sql`
    SELECT * FROM worker_proactive_opportunities WHERE id = ${opportunityId}
  `;

  if (result.rows.length === 0) return null;
  return mapRowToOpportunity(result.rows[0]);
}

export async function viewOpportunity(opportunityId: string): Promise<{ opportunity: ProactiveOpportunity; message: string }> {
  const result = await sql`
    UPDATE worker_proactive_opportunities
    SET status = 'viewed', viewed_at = NOW()
    WHERE id = ${opportunityId} AND status = 'new'
    RETURNING *
  `;

  if (result.rows.length === 0) {
    const existing = await getOpportunity(opportunityId);
    if (!existing) {
      throw new Error('Opportunity not found');
    }
    return { opportunity: existing, message: 'Already viewed.' };
  }

  const opportunity = mapRowToOpportunity(result.rows[0]);
  return {
    opportunity,
    message: `"${opportunity.title}" - ${opportunity.description}`,
  };
}

export async function actOnOpportunity(
  opportunityId: string,
  outcome?: string
): Promise<{ success: boolean; message: string }> {
  const result = await sql`
    UPDATE worker_proactive_opportunities
    SET status = 'acted', acted_at = NOW(), outcome = ${outcome || 'User took action'}
    WHERE id = ${opportunityId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    return { success: false, message: 'Opportunity not found or already acted on.' };
  }

  return { success: true, message: 'Got it. Good luck with this opportunity.' };
}

export async function dismissOpportunity(
  opportunityId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const result = await sql`
    UPDATE worker_proactive_opportunities
    SET status = 'dismissed', dismissed_at = NOW(), outcome = ${reason || 'Dismissed by user'}
    WHERE id = ${opportunityId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    return { success: false, message: 'Opportunity not found.' };
  }

  return { success: true, message: "Dismissed. I'll adjust my recommendations." };
}

// =====================================================
// OPPORTUNITY DISCOVERY (AI-powered)
// =====================================================

export async function discoverOpportunities(workerId: string): Promise<{ count: number; message: string }> {
  const profile = await getWorkerProfile(workerId);
  if (!profile) {
    return { count: 0, message: 'Profile not found.' };
  }

  // Get open tasks that match worker's skills
  const matchingTasks = await findMatchingTasks(profile);

  let createdCount = 0;

  for (const task of matchingTasks) {
    // Check if opportunity already exists
    const existing = await sql`
      SELECT * FROM worker_proactive_opportunities
      WHERE worker_id = ${workerId} AND related_task_id = ${task.id}
      AND status NOT IN ('dismissed', 'expired')
    `;

    if (existing.rows.length > 0) continue;

    // Create opportunity
    const matchScore = calculateMatchScore(profile, task);
    const aiRationale = await generateMatchRationale(profile, task, matchScore);

    await createOpportunity({
      workerId,
      taskId: task.id,
      type: 'task_match',
      title: task.title,
      description: `${task.category} task from ${task.posterCompany || task.posterName || 'a company'}`,
      reason: aiRationale,
      source: 'ai_matching',
      matchScore,
      matchFactors: getMatchFactors(profile, task),
      potentialEarnings: task.fixedPrice || (task.budgetMax || task.budgetMin || 0),
      estimatedHours: task.estimatedHours,
      primaryAction: 'Apply Now',
      primaryActionUrl: `/jobs/tasks/${task.id}`,
      expiresAt: task.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    createdCount++;
  }

  // Check for skill demand opportunities
  const skillDemandOpps = await findSkillDemandOpportunities(profile);
  for (const opp of skillDemandOpps) {
    await createOpportunity({
      workerId,
      type: 'skill_demand',
      ...opp,
    });
    createdCount++;
  }

  return {
    count: createdCount,
    message: createdCount > 0
      ? `Found ${createdCount} new opportunities based on your profile.`
      : 'No new opportunities found. Your profile is actively being matched.',
  };
}

export async function createOpportunity(data: {
  workerId: string;
  taskId?: string;
  type: OpportunityType;
  title: string;
  description: string;
  reason: string;
  source: OpportunitySource;
  matchScore?: number;
  matchFactors?: string[];
  potentialEarnings?: number;
  estimatedHours?: number;
  primaryAction: string;
  primaryActionUrl?: string;
  secondaryAction?: string;
  expiresAt?: Date;
}): Promise<ProactiveOpportunity> {
  const result = await sql`
    INSERT INTO worker_proactive_opportunities (
      worker_id, task_id,
      type, title, description, reason, source,
      related_task_id,
      match_score, match_factors, potential_earnings, estimated_hours,
      suggested_action, primary_action, primary_action_url, secondary_action,
      status, expires_at
    ) VALUES (
      ${data.workerId},
      ${data.taskId || null},
      ${data.type},
      ${data.title},
      ${data.description},
      ${data.reason},
      ${data.source},
      ${data.taskId || null},
      ${data.matchScore || null},
      ${data.matchFactors || null},
      ${data.potentialEarnings || null},
      ${data.estimatedHours || null},
      ${data.primaryAction},
      ${data.primaryAction},
      ${data.primaryActionUrl || null},
      ${data.secondaryAction || null},
      'new',
      ${data.expiresAt || null}
    )
    RETURNING *
  `;

  return mapRowToOpportunity(result.rows[0]);
}

export async function convertToTask(
  opportunityId: string
): Promise<{ taskId?: string; message: string }> {
  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) {
    return { message: 'Opportunity not found.' };
  }

  if (opportunity.relatedTaskId) {
    await actOnOpportunity(opportunityId, 'Navigated to task');
    return {
      taskId: opportunity.relatedTaskId,
      message: `Opening task: "${opportunity.title}"`,
    };
  }

  // For non-task opportunities, mark as acted
  await actOnOpportunity(opportunityId, 'Converted');
  return { message: 'Opportunity noted.' };
}

// =====================================================
// MATCHING LOGIC
// =====================================================

async function findMatchingTasks(profile: WorkerProfile): Promise<Task[]> {
  const skills = profile.skills || [];
  const categories = profile.categories || [];

  // Get open tasks
  const result = await sql`
    SELECT * FROM tasks
    WHERE status = 'open'
    ORDER BY created_at DESC
    LIMIT 100
  `;

  const tasks: Task[] = result.rows.map(mapRowToTask);

  // Filter by skill match
  return tasks.filter(task => {
    const taskSkills = (task.skills || []).map(s => s.toLowerCase());
    const workerSkills = skills.map(s => s.toLowerCase());

    // At least one skill match
    const hasSkillMatch = taskSkills.some(s => workerSkills.includes(s));

    // Category match
    const hasCategoryMatch = categories.some(c =>
      task.category?.toLowerCase().includes(c.toLowerCase())
    );

    // Rate compatibility
    const rateCompatible = !profile.hourlyRateMin ||
      !task.budgetMax ||
      profile.hourlyRateMin <= task.budgetMax;

    return (hasSkillMatch || hasCategoryMatch) && rateCompatible;
  }).slice(0, 10); // Top 10 matches
}

function calculateMatchScore(profile: WorkerProfile, task: Task): number {
  let score = 50; // Base score

  const taskSkills = (task.skills || []).map(s => s.toLowerCase());
  const workerSkills = (profile.skills || []).map(s => s.toLowerCase());

  // Skill match (up to 30 points)
  if (taskSkills.length > 0) {
    const matchedSkills = taskSkills.filter(s => workerSkills.includes(s));
    score += (matchedSkills.length / taskSkills.length) * 30;
  }

  // Experience match (up to 10 points)
  if (task.experienceRequired && profile.experienceYears) {
    if (profile.experienceYears >= task.experienceRequired) {
      score += 10;
    }
  }

  // Rate compatibility (up to 10 points)
  if (profile.preferredRate && task.budgetMax) {
    if (profile.preferredRate <= task.budgetMax) {
      score += 10;
    }
  }

  // Category match (up to 10 points)
  const categories = (profile.categories || []).map(c => c.toLowerCase());
  if (categories.includes(task.category?.toLowerCase() || '')) {
    score += 10;
  }

  return Math.min(100, Math.round(score));
}

function getMatchFactors(profile: WorkerProfile, task: Task): string[] {
  const factors: string[] = [];

  const taskSkills = (task.skills || []).map(s => s.toLowerCase());
  const workerSkills = (profile.skills || []).map(s => s.toLowerCase());
  const matchedSkills = taskSkills.filter(s => workerSkills.includes(s));

  if (matchedSkills.length > 0) {
    factors.push(`Skills: ${matchedSkills.join(', ')}`);
  }

  if (profile.experienceYears && task.experienceRequired) {
    if (profile.experienceYears >= task.experienceRequired) {
      factors.push(`${profile.experienceYears}+ years experience`);
    }
  }

  if (task.locationType === 'remote' && profile.remoteOnly) {
    factors.push('Remote work');
  }

  return factors;
}

async function generateMatchRationale(
  profile: WorkerProfile,
  task: Task,
  matchScore: number
): Promise<string> {
  const matchedSkills = (task.skills || [])
    .filter(s => (profile.skills || []).map(ps => ps.toLowerCase()).includes(s.toLowerCase()));

  if (matchedSkills.length > 0) {
    return `Matches your ${matchedSkills.slice(0, 2).join(' and ')} skills. ${matchScore}% fit.`;
  }

  return `Based on your profile and preferences. ${matchScore}% fit.`;
}

async function findSkillDemandOpportunities(profile: WorkerProfile): Promise<Partial<ProactiveOpportunity>[]> {
  // Check for trending skills that worker might want to learn
  // For now, return empty - can be expanded with market data
  return [];
}

// =====================================================
// HELPERS
// =====================================================

function mapRowToOpportunity(row: any): ProactiveOpportunity {
  return {
    id: row.id,
    workerId: row.worker_id,
    taskId: row.task_id,
    type: row.type,
    title: row.title,
    description: row.description,
    reason: row.reason,
    source: row.source,
    relatedTaskId: row.related_task_id,
    relatedCompanyId: row.related_company_id,
    relatedWorkerId: row.related_worker_id,
    matchScore: row.match_score,
    matchFactors: row.match_factors,
    aiRationale: row.ai_rationale,
    potentialEarnings: row.potential_earnings ? parseFloat(row.potential_earnings) : undefined,
    estimatedHours: row.estimated_hours,
    suggestedAction: row.suggested_action,
    primaryAction: row.primary_action,
    primaryActionUrl: row.primary_action_url,
    secondaryAction: row.secondary_action,
    actionDeadline: row.action_deadline ? new Date(row.action_deadline) : undefined,
    status: row.status,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    outcome: row.outcome,
    createdAt: new Date(row.created_at),
    viewedAt: row.viewed_at ? new Date(row.viewed_at) : undefined,
    actedAt: row.acted_at ? new Date(row.acted_at) : undefined,
    dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
  };
}

function mapRowToTask(row: any): Task {
  return {
    id: row.id,
    posterId: row.poster_id || row.poster_user_id,
    posterType: row.poster_type || 'buyer',
    posterName: row.poster_name,
    posterCompany: row.poster_company,
    title: row.title,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : (row.skills || []),
    taskType: row.task_type || 'project',
    estimatedHours: row.estimated_hours,
    estimatedDuration: row.estimated_duration,
    complexity: row.complexity || 'moderate',
    experienceLevel: row.experience_level || 'any',
    budgetType: row.budget_type || 'negotiable',
    budgetMin: row.budget_min ? parseFloat(row.budget_min) : undefined,
    budgetMax: row.budget_max ? parseFloat(row.budget_max) : undefined,
    fixedPrice: row.fixed_price ? parseFloat(row.fixed_price) : undefined,
    hourlyRate: row.hourly_rate ? parseFloat(row.hourly_rate) : undefined,
    currency: row.currency || 'USD',
    requiredSkills: row.required_skills || [],
    preferredSkills: row.preferred_skills,
    experienceRequired: row.experience_required,
    certifications: row.certifications,
    locationType: row.location_type || 'remote',
    location: row.location,
    timezone: row.timezone,
    startDate: row.start_date ? new Date(row.start_date) : undefined,
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    urgency: row.urgency || 'normal',
    maxApplications: row.max_applications,
    autoScreen: row.auto_screen ?? true,
    autoScreenCriteria: row.auto_screen_criteria,
    requiresInterview: row.requires_interview ?? false,
    autoAssign: row.auto_assign ?? false,
    visibility: row.visibility || 'public',
    invitedWorkerIds: row.invited_worker_ids,
    status: row.status,
    applicationCount: row.application_count || 0,
    viewCount: row.view_count || 0,
    assignmentCount: row.assignment_count || 0,
    aiMatchScores: row.ai_match_scores,
    suggestedWorkers: row.suggested_workers,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
    closedReason: row.closed_reason,
  };
}
