/**
 * Proactive Job Matching Engine for Wells AI
 *
 * AI-powered engine that proactively finds opportunities for workers and matches
 * workers to tasks. Scans founder, buyer, and seller needs to surface opportunities.
 *
 * All functions return conversational messages for AI-first UX.
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import {
  WorkerProfile,
  Task,
  ProactiveOpportunity,
  OpportunityType,
  OpportunitySource,
  OpportunityStatus,
  TaskApplication,
} from './types';

const anthropic = new Anthropic();

// =====================================================
// TYPES
// =====================================================

export interface MatchScore {
  score: number; // 0-100
  breakdown: {
    skillMatch: number;      // How well skills align (0-30)
    experienceMatch: number; // Experience level fit (0-20)
    availabilityMatch: number; // Schedule/availability fit (0-15)
    rateMatch: number;       // Budget alignment (0-15)
    historyScore: number;    // Track record (0-10)
    preferenceMatch: number; // Worker preferences alignment (0-10)
  };
  highlights: string[];    // Key match reasons
  concerns: string[];      // Potential issues
  recommendation: string;  // AI-generated recommendation
}

export interface MatchResult {
  matchId: string;
  worker?: WorkerProfile;
  task?: Task;
  score: MatchScore;
  message: string;           // Conversational summary
  explanation?: string;      // AI-generated explanation of why match
  suggestedAction: string;   // What the user should do next
  createdAt: Date;
  status: 'pending' | 'viewed' | 'accepted' | 'dismissed';
}

export interface FounderNeed {
  type: 'hiring' | 'rfq_management' | 'deal_support' | 'admin_help' | 'research' | 'fundraising_support';
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  estimatedBudget?: number;
  suggestedSkills: string[];
  source: 'profile' | 'chat_history' | 'activity' | 'rfq' | 'deal';
  sourceId?: string;
}

export interface BuyerNeed {
  type: 'vendor_research' | 'quote_comparison' | 'contract_review' | 'supplier_management' | 'data_entry' | 'inventory';
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  estimatedBudget?: number;
  suggestedSkills: string[];
  source: 'rfq' | 'procurement' | 'erp' | 'activity';
  sourceId?: string;
}

export interface SellerNeed {
  type: 'lead_research' | 'outreach' | 'follow_up' | 'content_creation' | 'proposal_writing' | 'fulfillment' | 'customer_success';
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  estimatedBudget?: number;
  suggestedSkills: string[];
  source: 'campaign' | 'pipeline' | 'rfq' | 'activity';
  sourceId?: string;
}

// =====================================================
// CORE MATCHING FUNCTIONS
// =====================================================

/**
 * 1. Scan for opportunities matching a worker's skills
 * Returns scored matches with reasoning
 */
export async function scanForOpportunities(
  workerId: string,
  options: {
    limit?: number;
    minScore?: number;
    includePosted?: boolean;
    includeProactive?: boolean;
  } = {}
): Promise<{
  matches: MatchResult[];
  proactiveOpportunities: ProactiveOpportunity[];
  message: string;
}> {
  const limit = options.limit || 10;
  const minScore = options.minScore || 50;

  // Get worker profile
  const workerResult = await sql`
    SELECT * FROM worker_profiles WHERE id = ${workerId}
  `;

  if (workerResult.rows.length === 0) {
    return {
      matches: [],
      proactiveOpportunities: [],
      message: "I couldn't find your worker profile. Would you like to create or update one?",
    };
  }

  const worker = mapRowToWorker(workerResult.rows[0]);
  const matches: MatchResult[] = [];
  const proactiveOpportunities: ProactiveOpportunity[] = [];

  // 1. Find matching posted tasks
  if (options.includePosted !== false) {
    const tasksResult = await sql`
      SELECT * FROM tasks
      WHERE status = 'open'
      ORDER BY urgency DESC, created_at DESC
      LIMIT 50
    `;

    for (const row of tasksResult.rows) {
      const task = mapRowToTask(row);
      const score = await scoreMatch(worker, task);

      if (score.score >= minScore) {
        const explanation = await generateMatchExplanation(worker, task, score);
        matches.push({
          matchId: `task_${task.id}_${worker.id}`,
          worker,
          task,
          score,
          message: generateTaskMatchMessage(worker, task, score),
          explanation,
          suggestedAction: 'Apply to this task',
          createdAt: new Date(),
          status: 'pending',
        });
      }
    }
  }

  // 2. Detect proactive opportunities from founder/buyer/seller needs
  if (options.includeProactive !== false) {
    // Find founders who might need help
    const founderOpps = await scanFounderOpportunitiesForWorker(worker);
    proactiveOpportunities.push(...founderOpps);

    // Find buyers who might need help
    const buyerOpps = await scanBuyerOpportunitiesForWorker(worker);
    proactiveOpportunities.push(...buyerOpps);

    // Find sellers who might need help
    const sellerOpps = await scanSellerOpportunitiesForWorker(worker);
    proactiveOpportunities.push(...sellerOpps);
  }

  // Sort matches by score
  matches.sort((a, b) => b.score.score - a.score.score);
  const topMatches = matches.slice(0, limit);

  // Generate summary message
  const message = generateOpportunitySummaryMessage(topMatches, proactiveOpportunities, worker);

  return { matches: topMatches, proactiveOpportunities, message };
}

/**
 * 2. Match workers to a specific task
 * Returns ranked workers with match scores
 */
export async function matchWorkersToTask(
  taskId: string,
  options: {
    limit?: number;
    minScore?: number;
  } = {}
): Promise<{
  matches: MatchResult[];
  message: string;
}> {
  const limit = options.limit || 5;
  const minScore = options.minScore || 50;

  // Get task details
  const taskResult = await sql`
    SELECT * FROM tasks WHERE id = ${taskId}
  `;

  if (taskResult.rows.length === 0) {
    return {
      matches: [],
      message: "I couldn't find that task. Want me to help you create a new one?",
    };
  }

  const task = mapRowToTask(taskResult.rows[0]);

  // Get available workers with relevant skills
  const workersResult = await sql`
    SELECT * FROM worker_profiles
    WHERE status = 'active'
      AND availability IN ('available', 'looking', 'freelance', 'part_time')
    ORDER BY average_rating DESC NULLS LAST, completed_tasks DESC
    LIMIT 100
  `;

  if (workersResult.rows.length === 0) {
    return {
      matches: [],
      message: "I don't see any available workers in the network right now. Would you like me to expand the search or notify you when workers become available?",
    };
  }

  const workers = workersResult.rows.map(mapRowToWorker);
  const matches: MatchResult[] = [];

  // Calculate match scores for each worker
  for (const worker of workers) {
    const score = await scoreMatch(worker, task);
    if (score.score >= minScore) {
      const explanation = await generateMatchExplanation(worker, task, score);
      matches.push({
        matchId: `task_${task.id}_worker_${worker.id}`,
        worker,
        task,
        score,
        message: generateWorkerMatchMessage(worker, task, score),
        explanation,
        suggestedAction: 'Invite this worker to apply',
        createdAt: new Date(),
        status: 'pending',
      });
    }
  }

  // Sort by score and take top matches
  matches.sort((a, b) => b.score.score - a.score.score);
  const topMatches = matches.slice(0, limit);

  // Generate summary message
  const summaryMessage = await generateMatchSummaryForTask(task, topMatches);

  return { matches: topMatches, message: summaryMessage };
}

/**
 * 3. Generate proactive matches as a background job
 * Creates match records for workers to review
 */
export async function generateProactiveMatches(): Promise<{
  matchesCreated: number;
  message: string;
}> {
  let matchesCreated = 0;

  // Get active workers with proactive opportunities enabled
  const workersResult = await sql`
    SELECT * FROM worker_profiles
    WHERE status = 'active'
      AND proactive_opportunities = true
      AND availability IN ('available', 'looking', 'freelance', 'part_time')
    LIMIT 100
  `;

  for (const workerRow of workersResult.rows) {
    const worker = mapRowToWorker(workerRow);

    // Get open tasks
    const tasksResult = await sql`
      SELECT * FROM tasks
      WHERE status = 'open'
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    for (const taskRow of tasksResult.rows) {
      const task = mapRowToTask(taskRow);

      // Check if match already exists
      const existingMatch = await sql`
        SELECT id FROM worker_proactive_matches
        WHERE worker_id = ${worker.id} AND task_id = ${task.id}
      `;

      if (existingMatch.rows.length > 0) continue;

      const score = await scoreMatch(worker, task);

      // Only create matches for good fits
      if (score.score >= 65) {
        const explanation = await generateMatchExplanation(worker, task, score);

        await sql`
          INSERT INTO worker_proactive_matches (
            worker_id, task_id, match_score, score_breakdown,
            highlights, concerns, explanation, suggested_action, status
          ) VALUES (
            ${worker.id}, ${task.id}, ${score.score},
            ${JSON.stringify(score.breakdown)},
            ${score.highlights}, ${score.concerns},
            ${explanation}, 'Apply to this task', 'pending'
          )
        `;

        matchesCreated++;
      }
    }
  }

  return {
    matchesCreated,
    message: `Created ${matchesCreated} new proactive matches for workers.`,
  };
}

/**
 * 4. Get pending matches for a worker
 */
export async function getMatchesForWorker(
  workerId: string,
  options: {
    status?: 'pending' | 'viewed' | 'accepted' | 'dismissed';
    limit?: number;
  } = {}
): Promise<{
  matches: MatchResult[];
  message: string;
}> {
  const limit = options.limit || 10;
  const status = options.status || 'pending';

  const result = await sql`
    SELECT m.*, t.*,
      m.id as match_id, m.status as match_status,
      m.match_score, m.score_breakdown, m.highlights, m.concerns,
      m.explanation, m.suggested_action, m.created_at as match_created
    FROM worker_proactive_matches m
    JOIN tasks t ON m.task_id = t.id
    WHERE m.worker_id = ${workerId}
      AND m.status = ${status}
    ORDER BY m.match_score DESC
    LIMIT ${limit}
  `;

  const matches: MatchResult[] = result.rows.map(row => ({
    matchId: row.match_id,
    task: mapRowToTask(row),
    score: {
      score: row.match_score,
      breakdown: row.score_breakdown || {},
      highlights: row.highlights || [],
      concerns: row.concerns || [],
      recommendation: row.explanation || '',
    },
    message: `${row.title} - ${row.match_score}% match`,
    explanation: row.explanation,
    suggestedAction: row.suggested_action || 'Review this opportunity',
    createdAt: new Date(row.match_created),
    status: row.match_status,
  }));

  const message = matches.length > 0
    ? `You have ${matches.length} ${status} match${matches.length > 1 ? 'es' : ''}. Top: "${matches[0].task?.title}" (${matches[0].score.score}% fit)`
    : `No ${status} matches right now. I'm actively looking for opportunities that fit your skills.`;

  return { matches, message };
}

/**
 * 5. Get suggested workers for a task
 */
export async function getMatchesForTask(
  taskId: string,
  options: {
    limit?: number;
    minScore?: number;
  } = {}
): Promise<{
  workers: Array<{ worker: WorkerProfile; score: MatchScore; explanation: string }>;
  message: string;
}> {
  const limit = options.limit || 5;
  const minScore = options.minScore || 50;

  // First check for pre-computed matches
  const precomputedResult = await sql`
    SELECT m.*, w.*,
      m.match_score, m.score_breakdown, m.highlights, m.concerns, m.explanation
    FROM worker_proactive_matches m
    JOIN worker_profiles w ON m.worker_id = w.id
    WHERE m.task_id = ${taskId}
      AND m.match_score >= ${minScore}
    ORDER BY m.match_score DESC
    LIMIT ${limit}
  `;

  if (precomputedResult.rows.length > 0) {
    const workers = precomputedResult.rows.map(row => ({
      worker: mapRowToWorker(row),
      score: {
        score: row.match_score,
        breakdown: row.score_breakdown || {},
        highlights: row.highlights || [],
        concerns: row.concerns || [],
        recommendation: row.explanation || '',
      },
      explanation: row.explanation || '',
    }));

    return {
      workers,
      message: `Found ${workers.length} pre-matched workers. Top: ${workers[0].worker.displayName} (${workers[0].score.score}% fit)`,
    };
  }

  // Otherwise compute matches on-the-fly
  const result = await matchWorkersToTask(taskId, { limit, minScore });

  const workers = result.matches.map(m => ({
    worker: m.worker!,
    score: m.score,
    explanation: m.explanation || '',
  }));

  return { workers, message: result.message };
}

/**
 * 6. Calculate match score between a worker and task (0-100)
 * Considers: skills match, availability, rate compatibility, past performance, location
 */
export async function scoreMatch(
  worker: WorkerProfile,
  task: Task
): Promise<MatchScore> {
  const breakdown = {
    skillMatch: 0,
    experienceMatch: 0,
    availabilityMatch: 0,
    rateMatch: 0,
    historyScore: 0,
    preferenceMatch: 0,
  };

  const highlights: string[] = [];
  const concerns: string[] = [];

  // 1. Skill Match (0-30 points)
  const taskSkills = (task.skills || task.requiredSkills || []).map(s => s.toLowerCase());
  const workerSkills = (worker.skills || []).map(s => s.toLowerCase());

  if (taskSkills.length > 0) {
    const matchedSkills = taskSkills.filter(ts =>
      workerSkills.some(ws => ws.includes(ts) || ts.includes(ws))
    );
    const matchRatio = matchedSkills.length / taskSkills.length;
    breakdown.skillMatch = Math.round(matchRatio * 25);

    // Bonus for preferred skills
    const preferredSkills = (task.preferredSkills || []).map(s => s.toLowerCase());
    const preferredMatched = preferredSkills.filter(ps =>
      workerSkills.some(ws => ws.includes(ps) || ps.includes(ws))
    );
    if (preferredMatched.length > 0) {
      breakdown.skillMatch += Math.min(5, preferredMatched.length * 2);
      highlights.push(`Has ${preferredMatched.length} preferred skill${preferredMatched.length > 1 ? 's' : ''}`);
    }

    if (matchRatio >= 0.8) {
      highlights.push(`Strong skill match (${matchedSkills.length}/${taskSkills.length} required)`);
    } else if (matchRatio < 0.5 && taskSkills.length > 0) {
      const missing = taskSkills.filter(s => !matchedSkills.some(m => m.includes(s) || s.includes(m)));
      concerns.push(`Missing: ${missing.slice(0, 2).join(', ')}`);
    }
  } else {
    breakdown.skillMatch = 15; // No skills specified, give partial credit
  }

  // 2. Experience Match (0-20 points)
  const experienceLevelMap: Record<string, number> = { any: 0, entry: 1, intermediate: 3, senior: 5, expert: 7 };
  const requiredExp = experienceLevelMap[task.experienceLevel || 'any'] || 0;
  const workerExp = worker.experienceYears || 0;

  if (workerExp >= requiredExp) {
    breakdown.experienceMatch = 20;
    if (workerExp >= requiredExp + 3) {
      highlights.push(`${workerExp} years experience (exceeds requirements)`);
    }
  } else if (requiredExp > 0) {
    breakdown.experienceMatch = Math.round((workerExp / requiredExp) * 15);
    concerns.push(`Less experience than preferred (${workerExp} vs ${requiredExp}+ years)`);
  } else {
    breakdown.experienceMatch = 15;
  }

  // 3. Availability Match (0-15 points)
  const availabilityStatus = worker.availability || 'freelance';
  if (['available', 'looking', 'freelance'].includes(availabilityStatus)) {
    breakdown.availabilityMatch = 15;
    highlights.push('Currently available');
  } else if (['part_time', 'contract'].includes(availabilityStatus)) {
    breakdown.availabilityMatch = 10;
  } else if (availabilityStatus === 'busy') {
    breakdown.availabilityMatch = 3;
    concerns.push('Currently busy');
  } else {
    breakdown.availabilityMatch = 0;
    concerns.push('Currently unavailable');
  }

  // Check hours compatibility
  const taskHours = task.estimatedHours;
  const workerHours = worker.hoursPerWeek;
  if (taskHours && workerHours && taskHours > workerHours * 2) {
    breakdown.availabilityMatch -= 5;
    concerns.push('Limited weekly hours for task size');
  }

  // Remote preference check
  const taskLocation = task.locationType || 'remote';
  if (taskLocation !== 'remote' && worker.remoteOnly) {
    breakdown.availabilityMatch -= 10;
    concerns.push('Task requires on-site but worker is remote-only');
  }

  // 4. Rate Match (0-15 points)
  const workerRate = worker.preferredRate || worker.hourlyRateMin || 0;
  const taskBudgetMax = task.budgetMax || task.hourlyRate || 0;

  if (taskBudgetMax > 0 && workerRate > 0) {
    if (workerRate <= taskBudgetMax) {
      const rateRatio = workerRate / taskBudgetMax;
      if (rateRatio <= 0.7) {
        breakdown.rateMatch = 15;
        highlights.push('Rate is well within budget');
      } else if (rateRatio <= 0.9) {
        breakdown.rateMatch = 12;
      } else {
        breakdown.rateMatch = 8;
      }
    } else {
      const overageRatio = workerRate / taskBudgetMax;
      breakdown.rateMatch = Math.max(0, 10 - Math.round((overageRatio - 1) * 15));
      concerns.push(`Rate ($${workerRate}/hr) exceeds budget ($${taskBudgetMax}/hr)`);
    }
  } else {
    breakdown.rateMatch = 8; // Unknown rate info, give partial credit
  }

  // 5. History Score (0-10 points)
  const rating = worker.averageRating || 0;
  const completedTasks = worker.completedTasks || 0;

  if (rating >= 4.5 && completedTasks >= 10) {
    breakdown.historyScore = 10;
    highlights.push(`Excellent track record (${rating.toFixed(1)} stars, ${completedTasks} tasks)`);
  } else if (rating >= 4.0 && completedTasks >= 5) {
    breakdown.historyScore = 7;
  } else if (completedTasks >= 1) {
    breakdown.historyScore = 5;
  } else {
    breakdown.historyScore = 2;
    concerns.push('New to the platform');
  }

  // Success rate bonus
  const successRate = worker.successRate || 0;
  if (successRate >= 90) {
    breakdown.historyScore = Math.min(10, breakdown.historyScore + 2);
    highlights.push(`${successRate}% success rate`);
  }

  // 6. Preference Match (0-10 points)
  breakdown.preferenceMatch = 5; // Base score

  // Check if task category is in worker's preferences
  const workerCategories = (worker.categories || []).map(c => c.toLowerCase());
  const taskCategory = (task.category || '').toLowerCase();
  if (workerCategories.includes(taskCategory)) {
    breakdown.preferenceMatch += 3;
    highlights.push('Matches preferred category');
  }

  // Check preferred task types
  const workerTaskTypes = worker.preferredTaskTypes || [];
  const taskType = task.taskType || 'project';
  if (workerTaskTypes.includes(taskType)) {
    breakdown.preferenceMatch += 2;
  }

  // Calculate total score
  const totalScore = Math.min(100, Object.values(breakdown).reduce((sum, val) => sum + val, 0));

  // Generate recommendation
  const recommendation = generateScoreRecommendation(totalScore, highlights, concerns);

  return {
    score: totalScore,
    breakdown,
    highlights,
    concerns,
    recommendation,
  };
}

/**
 * 7. Generate AI explanation of why a match is good
 */
export async function generateMatchExplanation(
  worker: WorkerProfile,
  task: Task,
  score: MatchScore
): Promise<string> {
  // For high scores, generate a quick explanation without AI
  if (score.score >= 80) {
    const topHighlight = score.highlights[0] || 'Strong overall alignment';
    return `Excellent match. ${topHighlight}. ${score.recommendation}`;
  }

  // For moderate scores, provide balanced explanation
  if (score.score >= 60) {
    const highlight = score.highlights[0] || 'Good skill alignment';
    const concern = score.concerns[0] ? `Consider: ${score.concerns[0]}.` : '';
    return `Good match. ${highlight}. ${concern}`;
  }

  // For lower scores, use AI to generate thoughtful explanation
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Generate a brief, honest explanation (2-3 sentences) for why a worker might or might not be a good fit for a task.

Worker: ${worker.displayName}, skills: ${worker.skills?.slice(0, 5).join(', ')}, ${worker.experienceYears || 0} years experience
Task: ${task.title}, requires: ${task.skills?.slice(0, 5).join(', ')}, budget: $${task.budgetMin || 0}-$${task.budgetMax || 0}
Match score: ${score.score}/100
Highlights: ${score.highlights.join(', ') || 'None specific'}
Concerns: ${score.concerns.join(', ') || 'None specific'}

Be conversational and helpful.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }
  } catch (error) {
    console.error('Error generating match explanation:', error);
  }

  // Fallback
  return score.score >= 50
    ? `Moderate match. ${score.recommendation}`
    : `This may not be the best fit. ${score.concerns[0] || 'Consider other opportunities.'}`;
}

/**
 * 8. Accept a match - creates application
 */
export async function acceptMatch(
  matchId: string,
  coverLetter?: string,
  proposedRate?: number
): Promise<{
  application?: TaskApplication;
  message: string;
}> {
  // Get match details
  const matchResult = await sql`
    SELECT * FROM worker_proactive_matches WHERE id = ${matchId}
  `;

  if (matchResult.rows.length === 0) {
    return { message: "I couldn't find that match. It may have expired." };
  }

  const match = matchResult.rows[0];

  // Get task to check it's still open
  const taskResult = await sql`
    SELECT * FROM tasks WHERE id = ${match.task_id}
  `;

  if (taskResult.rows.length === 0 || taskResult.rows[0].status !== 'open') {
    await sql`
      UPDATE worker_proactive_matches SET status = 'expired' WHERE id = ${matchId}
    `;
    return { message: "This task is no longer available. Let me find you similar opportunities." };
  }

  const task = mapRowToTask(taskResult.rows[0]);

  // Check for existing application
  const existingApp = await sql`
    SELECT * FROM task_applications
    WHERE task_id = ${match.task_id} AND worker_id = ${match.worker_id}
  `;

  if (existingApp.rows.length > 0) {
    return { message: "You've already applied to this task." };
  }

  // Create application
  const appResult = await sql`
    INSERT INTO task_applications (
      task_id, worker_id, cover_letter, proposed_rate,
      match_score, match_reasons, ai_generated, status
    ) VALUES (
      ${match.task_id}, ${match.worker_id},
      ${coverLetter || match.explanation || 'Matched via Wells AI'},
      ${proposedRate || null},
      ${match.match_score}, ${match.highlights},
      true, 'pending'
    )
    RETURNING *
  `;

  // Update match status
  await sql`
    UPDATE worker_proactive_matches
    SET status = 'accepted', updated_at = NOW()
    WHERE id = ${matchId}
  `;

  // Increment application count
  await sql`
    UPDATE tasks SET application_count = application_count + 1 WHERE id = ${match.task_id}
  `;

  return {
    application: mapRowToApplication(appResult.rows[0]),
    message: `Applied to "${task.title}". The poster will be notified. Good luck!`,
  };
}

/**
 * 9. Dismiss a match with reason
 */
export async function dismissMatch(
  matchId: string,
  reason?: string
): Promise<{
  success: boolean;
  message: string;
}> {
  const result = await sql`
    UPDATE worker_proactive_matches
    SET status = 'dismissed', dismissed_reason = ${reason || 'User dismissed'}, updated_at = NOW()
    WHERE id = ${matchId}
    RETURNING task_id
  `;

  if (result.rows.length === 0) {
    return { success: false, message: "I couldn't find that match." };
  }

  return {
    success: true,
    message: "Got it. I'll use this feedback to find better matches for you.",
  };
}

/**
 * 10. Detect founder needs from profile and activity
 */
export async function detectFounderNeeds(founderId: string): Promise<FounderNeed[]> {
  const needs: FounderNeed[] = [];

  // Check founder profile for explicit hiring needs
  const profileResult = await sql`
    SELECT * FROM user_profiles WHERE user_id = ${founderId} AND journey = 'founder'
  `;

  if (profileResult.rows.length > 0) {
    const profile = profileResult.rows[0];
    const founderData = profile.founder_profile || {};

    // Check hiring needs
    if (founderData.hiringNeeds?.length > 0) {
      needs.push({
        type: 'hiring',
        title: 'Help with your hiring pipeline',
        description: `You mentioned you're looking for: ${founderData.hiringNeeds.slice(0, 3).join(', ')}. Need help with sourcing, screening, or scheduling?`,
        urgency: 'medium',
        estimatedBudget: 500,
        suggestedSkills: ['recruiting', 'hr', 'sourcing', 'talent acquisition'],
        source: 'profile',
      });
    }

    // Check stage-based needs
    const stage = founderData.stage || profile.business_stage;
    if (stage === 'pre-seed' || stage === 'seed') {
      needs.push({
        type: 'fundraising_support',
        title: 'Fundraising support',
        description: 'Early-stage founders often need help with investor outreach, deck design, or due diligence prep.',
        urgency: 'low',
        estimatedBudget: 1000,
        suggestedSkills: ['investor relations', 'pitch deck', 'financial modeling', 'research'],
        source: 'profile',
      });
    }
  }

  // Check for RFQs that need management
  const rfqResult = await sql`
    SELECT r.id, r.category, r.description, r.status,
           (SELECT COUNT(*) FROM rfq_quotes q WHERE q.rfq_id = r.id) as quote_count
    FROM rfqs r
    WHERE r.user_id = ${founderId}
      AND r.status IN ('open', 'quoting', 'quoted')
      AND r.created_at > NOW() - INTERVAL '14 days'
    ORDER BY r.created_at DESC
    LIMIT 5
  `;

  for (const rfq of rfqResult.rows) {
    const quoteCount = parseInt(rfq.quote_count);
    if (quoteCount >= 3) {
      needs.push({
        type: 'rfq_management',
        title: `${quoteCount} quotes need review for: ${rfq.category}`,
        description: `Your RFQ for "${rfq.category}" has ${quoteCount} quotes. Need help comparing them and managing vendor follow-ups?`,
        urgency: quoteCount >= 5 ? 'high' : 'medium',
        estimatedBudget: quoteCount * 50,
        suggestedSkills: ['procurement', 'vendor management', 'negotiation', 'data analysis'],
        source: 'rfq',
        sourceId: rfq.id,
      });
    }
  }

  // Check for active deals that need support
  const dealsResult = await sql`
    SELECT id, title, status, amount FROM deals
    WHERE user_id = ${founderId}
      AND status IN ('negotiating', 'contract_pending', 'payment_pending')
    ORDER BY amount DESC
    LIMIT 3
  `;

  for (const deal of dealsResult.rows) {
    const amount = parseFloat(deal.amount || 0);
    if (amount > 10000) {
      needs.push({
        type: 'deal_support',
        title: `Large deal needs attention: ${deal.title}`,
        description: `Your $${amount.toLocaleString()} deal "${deal.title}" is in ${deal.status}. Need help with contract review or payment coordination?`,
        urgency: 'high',
        estimatedBudget: amount * 0.02,
        suggestedSkills: ['contract review', 'legal', 'project management', 'admin'],
        source: 'deal',
        sourceId: deal.id,
      });
    }
  }

  // Check chat history for implied needs (simplified - in production, use vector search)
  const chatResult = await sql`
    SELECT content FROM chat_messages
    WHERE user_id = ${founderId}
      AND role = 'user'
      AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 20
  `;

  const chatContent = chatResult.rows.map(r => r.content).join(' ').toLowerCase();

  if (chatContent.includes('overwhelmed') || chatContent.includes('too much') || chatContent.includes('need help with')) {
    needs.push({
      type: 'admin_help',
      title: 'General admin support',
      description: 'It sounds like you could use an extra pair of hands. Want me to find someone to help with day-to-day tasks?',
      urgency: 'medium',
      estimatedBudget: 300,
      suggestedSkills: ['virtual assistant', 'admin', 'organization', 'scheduling'],
      source: 'chat_history',
    });
  }

  if (chatContent.includes('research') || chatContent.includes('find out') || chatContent.includes('looking for data')) {
    needs.push({
      type: 'research',
      title: 'Research assistance',
      description: 'Need help digging into market data, competitors, or trends?',
      urgency: 'low',
      estimatedBudget: 250,
      suggestedSkills: ['research', 'data analysis', 'market research', 'competitive analysis'],
      source: 'chat_history',
    });
  }

  return needs;
}

/**
 * 11. Detect buyer needs from procurement activity
 */
export async function detectBuyerNeeds(buyerId: string): Promise<BuyerNeed[]> {
  const needs: BuyerNeed[] = [];

  // Check for RFQs with many quotes to compare
  const rfqResult = await sql`
    SELECT r.id, r.category, r.description,
           (SELECT COUNT(*) FROM rfq_quotes q WHERE q.rfq_id = r.id) as quote_count
    FROM rfqs r
    WHERE r.user_id = ${buyerId}
      AND r.status IN ('quoting', 'quoted')
    ORDER BY quote_count DESC
    LIMIT 5
  `;

  for (const rfq of rfqResult.rows) {
    const quoteCount = parseInt(rfq.quote_count);
    if (quoteCount >= 5) {
      needs.push({
        type: 'quote_comparison',
        title: `${quoteCount} quotes need comparison`,
        description: `You've got ${quoteCount} quotes for "${rfq.category}". That's a lot to review. Want help creating a comparison spreadsheet?`,
        urgency: 'high',
        estimatedBudget: quoteCount * 30,
        suggestedSkills: ['data analysis', 'spreadsheets', 'procurement', 'vendor evaluation'],
        source: 'rfq',
        sourceId: rfq.id,
      });
    }
  }

  // Check for ERP procurement opportunities
  const erpResult = await sql`
    SELECT * FROM procurement_opportunities
    WHERE user_id = ${buyerId} AND status = 'new'
    ORDER BY estimated_savings DESC
    LIMIT 3
  `;

  for (const erpOpp of erpResult.rows) {
    const estimatedValue = parseFloat(erpOpp.estimated_value || 0);
    if (estimatedValue > 5000) {
      needs.push({
        type: 'vendor_research',
        title: `Help with ${(erpOpp.type || 'procurement').replace('_', ' ')}`,
        description: `Detected from your ERP: ${erpOpp.description}. Need help researching alternatives?`,
        urgency: 'medium',
        estimatedBudget: parseFloat(erpOpp.estimated_savings || 0) * 0.1,
        suggestedSkills: ['vendor research', 'procurement', 'data entry', 'sourcing'],
        source: 'erp',
        sourceId: erpOpp.id,
      });
    }
  }

  // Check for supplier management needs
  const supplierResult = await sql`
    SELECT COUNT(*) as supplier_count FROM supplier_relationships
    WHERE buyer_id = ${buyerId} AND status = 'active'
  `;

  const supplierCount = parseInt(supplierResult.rows[0]?.supplier_count || 0);
  if (supplierCount >= 10) {
    needs.push({
      type: 'supplier_management',
      title: 'Supplier management support',
      description: `You have ${supplierCount} active suppliers. Need help keeping track of contracts, renewals, or performance?`,
      urgency: 'low',
      estimatedBudget: 400,
      suggestedSkills: ['vendor management', 'contract management', 'admin', 'data entry'],
      source: 'activity',
    });
  }

  return needs;
}

/**
 * 12. Detect seller needs from GTM and pipeline activity
 */
export async function detectSellerNeeds(sellerId: string): Promise<SellerNeed[]> {
  const needs: SellerNeed[] = [];

  // Check for active campaigns that need manual outreach
  const campaignResult = await sql`
    SELECT c.id, c.name, c.status,
           (SELECT COUNT(*) FROM seller_leads l WHERE l.seller_id = c.seller_id AND l.status = 'qualified') as qualified_leads,
           (SELECT COUNT(*) FROM seller_outreach o WHERE o.campaign_id = c.id AND o.status = 'pending') as pending_outreach
    FROM seller_campaigns c
    WHERE c.seller_id IN (SELECT id FROM seller_profiles WHERE user_id = ${sellerId})
      AND c.status = 'active'
    LIMIT 3
  `;

  for (const campaign of campaignResult.rows) {
    const qualifiedLeads = parseInt(campaign.qualified_leads || 0);
    const pendingOutreach = parseInt(campaign.pending_outreach || 0);

    if (qualifiedLeads > 20 && pendingOutreach > 10) {
      needs.push({
        type: 'outreach',
        title: `${qualifiedLeads} leads need outreach`,
        description: `Your campaign "${campaign.name}" has ${qualifiedLeads} qualified leads and ${pendingOutreach} pending messages. Need help with personalized outreach?`,
        urgency: 'high',
        estimatedBudget: qualifiedLeads * 20,
        suggestedSkills: ['sales development', 'outreach', 'email', 'linkedin', 'cold calling'],
        source: 'campaign',
        sourceId: campaign.id,
      });
    }
  }

  // Check for leads needing qualification
  const leadsResult = await sql`
    SELECT COUNT(*) as new_leads
    FROM seller_leads l
    JOIN seller_profiles sp ON l.seller_id = sp.id
    WHERE sp.user_id = ${sellerId}
      AND l.status = 'new'
      AND l.created_at > NOW() - INTERVAL '7 days'
  `;

  const newLeads = parseInt(leadsResult.rows[0]?.new_leads || 0);
  if (newLeads > 30) {
    needs.push({
      type: 'lead_research',
      title: `${newLeads} new leads need qualification`,
      description: `You have ${newLeads} new leads from the past week. Want help researching and qualifying them?`,
      urgency: 'medium',
      estimatedBudget: newLeads * 5,
      suggestedSkills: ['lead research', 'qualification', 'data enrichment', 'sales'],
      source: 'pipeline',
    });
  }

  // Check for RFQ responses needed
  const rfqResponseResult = await sql`
    SELECT COUNT(*) as pending_rfqs
    FROM rfqs r
    JOIN rfq_invitations ri ON r.id = ri.rfq_id
    JOIN seller_profiles sp ON ri.seller_id = sp.id
    WHERE sp.user_id = ${sellerId}
      AND ri.status = 'pending'
      AND r.status = 'open'
  `;

  const pendingRfqs = parseInt(rfqResponseResult.rows[0]?.pending_rfqs || 0);
  if (pendingRfqs >= 3) {
    needs.push({
      type: 'proposal_writing',
      title: `${pendingRfqs} RFQ responses needed`,
      description: `You have ${pendingRfqs} pending RFQ invitations. Need help preparing quotes and proposals?`,
      urgency: 'high',
      estimatedBudget: pendingRfqs * 100,
      suggestedSkills: ['proposal writing', 'pricing', 'sales', 'technical writing'],
      source: 'rfq',
    });
  }

  // Check for content creation needs
  const profileResult = await sql`
    SELECT gtm_enabled FROM seller_profiles WHERE user_id = ${sellerId}
  `;

  if (profileResult.rows.length > 0 && profileResult.rows[0].gtm_enabled) {
    needs.push({
      type: 'content_creation',
      title: 'Need fresh outreach content?',
      description: 'Running campaigns works better with fresh email sequences, LinkedIn posts, and case studies.',
      urgency: 'low',
      estimatedBudget: 300,
      suggestedSkills: ['copywriting', 'content writing', 'email marketing', 'social media'],
      source: 'activity',
    });
  }

  return needs;
}

// =====================================================
// INTERNAL HELPER FUNCTIONS
// =====================================================

async function scanFounderOpportunitiesForWorker(worker: WorkerProfile): Promise<ProactiveOpportunity[]> {
  const opportunities: ProactiveOpportunity[] = [];
  const workerSkills = (worker.skills || []).map(s => s.toLowerCase());

  // Find founders with needs matching worker skills
  const foundersResult = await sql`
    SELECT user_id FROM user_profiles WHERE journey = 'founder' LIMIT 50
  `;

  for (const row of foundersResult.rows) {
    const founderNeeds = await detectFounderNeeds(row.user_id);

    for (const need of founderNeeds) {
      // Check if worker has relevant skills
      const needSkills = (need.suggestedSkills || []).map(s => s.toLowerCase());
      const hasMatch = needSkills.some(ns =>
        workerSkills.some(ws => ws.includes(ns) || ns.includes(ws))
      );

      if (hasMatch) {
        opportunities.push({
          id: `founder_${row.user_id}_${need.type}`,
          workerId: worker.id,
          type: 'network_opportunity',
          title: need.title,
          description: need.description,
          reason: `Matches your skills: ${workerSkills.filter(ws => needSkills.some(ns => ws.includes(ns) || ns.includes(ws))).join(', ')}`,
          source: 'ai_matching',
          matchScore: 70,
          matchFactors: need.suggestedSkills,
          potentialEarnings: need.estimatedBudget,
          suggestedAction: 'Reach out to this founder',
          primaryAction: 'Express Interest',
          status: 'new',
          createdAt: new Date(),
        });
      }
    }
  }

  return opportunities.slice(0, 5);
}

async function scanBuyerOpportunitiesForWorker(worker: WorkerProfile): Promise<ProactiveOpportunity[]> {
  const opportunities: ProactiveOpportunity[] = [];
  const workerSkills = (worker.skills || []).map(s => s.toLowerCase());

  // Check if worker has procurement-related skills
  const procurementSkills = ['procurement', 'vendor', 'sourcing', 'data entry', 'research', 'analysis', 'spreadsheet'];
  const hasProcurementSkills = workerSkills.some(ws =>
    procurementSkills.some(ps => ws.includes(ps))
  );

  if (!hasProcurementSkills) return opportunities;

  // Find buyers with needs
  const buyersResult = await sql`
    SELECT user_id FROM user_profiles WHERE journey = 'buyer' LIMIT 30
  `;

  for (const row of buyersResult.rows) {
    const buyerNeeds = await detectBuyerNeeds(row.user_id);

    for (const need of buyerNeeds.slice(0, 2)) {
      opportunities.push({
        id: `buyer_${row.user_id}_${need.type}`,
        workerId: worker.id,
        type: 'network_opportunity',
        title: need.title,
        description: need.description,
        reason: 'Your procurement skills match this need',
        source: 'ai_matching',
        matchScore: 65,
        matchFactors: need.suggestedSkills,
        potentialEarnings: need.estimatedBudget,
        suggestedAction: 'Offer your services',
        primaryAction: 'Express Interest',
        status: 'new',
        createdAt: new Date(),
      });
    }
  }

  return opportunities.slice(0, 3);
}

async function scanSellerOpportunitiesForWorker(worker: WorkerProfile): Promise<ProactiveOpportunity[]> {
  const opportunities: ProactiveOpportunity[] = [];
  const workerSkills = (worker.skills || []).map(s => s.toLowerCase());

  // Check if worker has sales/GTM-related skills
  const gtmSkills = ['sales', 'outreach', 'lead', 'sdr', 'bdr', 'prospecting', 'email', 'linkedin', 'cold calling', 'copywriting'];
  const hasGtmSkills = workerSkills.some(ws =>
    gtmSkills.some(gs => ws.includes(gs))
  );

  if (!hasGtmSkills) return opportunities;

  // Find sellers with needs
  const sellersResult = await sql`
    SELECT user_id FROM seller_profiles WHERE gtm_enabled = true LIMIT 30
  `;

  for (const row of sellersResult.rows) {
    const sellerNeeds = await detectSellerNeeds(row.user_id);

    for (const need of sellerNeeds.slice(0, 2)) {
      opportunities.push({
        id: `seller_${row.user_id}_${need.type}`,
        workerId: worker.id,
        type: 'network_opportunity',
        title: need.title,
        description: need.description,
        reason: 'Your GTM/sales skills match this need',
        source: 'ai_matching',
        matchScore: 70,
        matchFactors: need.suggestedSkills,
        potentialEarnings: need.estimatedBudget,
        suggestedAction: 'Offer your services',
        primaryAction: 'Express Interest',
        status: 'new',
        createdAt: new Date(),
      });
    }
  }

  return opportunities.slice(0, 3);
}

function generateScoreRecommendation(score: number, highlights: string[], concerns: string[]): string {
  if (score >= 85) {
    return `Excellent match! ${highlights[0] || 'Strong alignment across all criteria.'}`;
  } else if (score >= 70) {
    const concern = concerns.length > 0 ? ` Note: ${concerns[0]}` : '';
    return `Great fit.${concern}`;
  } else if (score >= 55) {
    return `Good potential. ${concerns[0] || 'Some areas could be better aligned.'}`;
  } else {
    return `May not be the best fit. ${concerns.slice(0, 2).join('. ') || 'Consider other opportunities.'}`;
  }
}

function generateWorkerMatchMessage(worker: WorkerProfile, task: Task, score: MatchScore): string {
  const rating = worker.averageRating ? `${worker.averageRating.toFixed(1)} stars` : 'New';
  const rate = worker.preferredRate ? `$${worker.preferredRate}/hr` : 'Rate negotiable';

  let msg = `**${worker.displayName}** - ${score.score}% match. `;
  msg += `${worker.experienceYears || 0} years exp, ${rate}, ${rating}. `;

  if (score.highlights.length > 0) {
    msg += score.highlights[0] + '.';
  }

  return msg;
}

function generateTaskMatchMessage(worker: WorkerProfile, task: Task, score: MatchScore): string {
  const budget = task.budgetMax
    ? `$${task.budgetMin || 0}-$${task.budgetMax}`
    : (task.fixedPrice ? `$${task.fixedPrice} fixed` : 'Budget TBD');

  let msg = `**${task.title}** - ${score.score}% fit. `;
  msg += `${budget}, ${task.urgency || 'normal'} priority. `;

  if (score.highlights.length > 0) {
    msg += score.highlights[0];
  }

  return msg;
}

async function generateMatchSummaryForTask(task: Task, matches: MatchResult[]): Promise<string> {
  if (matches.length === 0) {
    return "I couldn't find workers matching this task's requirements. Want me to adjust the criteria or post it publicly?";
  }

  const topScore = matches[0].score.score;
  const avgScore = Math.round(matches.reduce((sum, m) => sum + m.score.score, 0) / matches.length);
  const topWorker = matches[0].worker!;

  return `Found ${matches.length} workers for "${task.title}". Top match: **${topWorker.displayName}** (${topScore}% fit). Average match score: ${avgScore}%. ${matches[0].score.recommendation}`;
}

function generateOpportunitySummaryMessage(
  matches: MatchResult[],
  proactiveOpps: ProactiveOpportunity[],
  worker: WorkerProfile
): string {
  const totalOpps = matches.length + proactiveOpps.length;

  if (totalOpps === 0) {
    return "No matching opportunities right now. I'm actively scanning the network and will notify you when something good comes up.";
  }

  const parts: string[] = [];

  if (matches.length > 0) {
    const topMatch = matches[0];
    parts.push(`Found ${matches.length} task${matches.length > 1 ? 's' : ''} matching your skills. Top: "${topMatch.task?.title}" (${topMatch.score.score}% fit)`);
  }

  if (proactiveOpps.length > 0) {
    const totalPotential = proactiveOpps.reduce((sum, o) => sum + (o.potentialEarnings || 0), 0);
    parts.push(`Plus ${proactiveOpps.length} proactive opportunit${proactiveOpps.length > 1 ? 'ies' : 'y'} worth ~$${totalPotential.toLocaleString()}`);
  }

  return parts.join('. ') + '.';
}

// =====================================================
// ROW MAPPERS
// =====================================================

function mapRowToWorker(row: any): WorkerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    headline: row.headline,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    skills: row.skills || [],
    skillLevels: row.skill_levels,
    categories: row.categories || [],
    experienceYears: row.experience_years,
    hourlyRateMin: row.hourly_rate_min ? parseFloat(row.hourly_rate_min) : undefined,
    hourlyRateMax: row.hourly_rate_max ? parseFloat(row.hourly_rate_max) : undefined,
    preferredRate: row.preferred_rate ? parseFloat(row.preferred_rate) : undefined,
    preferredCurrency: row.preferred_currency || 'USD',
    portfolioUrl: row.portfolio_url,
    linkedinUrl: row.linkedin_url,
    githubUrl: row.github_url,
    websiteUrl: row.website_url,
    availability: row.availability || 'freelance',
    hoursPerWeek: row.hours_per_week,
    timezone: row.timezone,
    locations: row.locations,
    remoteOnly: row.remote_only ?? true,
    willingToRelocate: row.willing_to_relocate ?? false,
    preferredTaskTypes: row.preferred_task_types,
    preferredIndustries: row.preferred_industries,
    minTaskValue: row.min_task_value ? parseFloat(row.min_task_value) : undefined,
    maxTasksActive: row.max_tasks_active,
    emailVerified: row.email_verified ?? false,
    phoneVerified: row.phone_verified ?? false,
    identityVerified: row.identity_verified ?? false,
    backgroundChecked: row.background_checked ?? false,
    aiMatchingEnabled: row.ai_matching_enabled ?? true,
    aiAutoApplyEnabled: row.ai_auto_apply_enabled ?? false,
    aiAutoApplyThreshold: row.ai_auto_apply_threshold,
    proactiveOpportunities: row.proactive_opportunities ?? true,
    completedTasks: row.completed_tasks || 0,
    totalEarnings: row.total_earnings ? parseFloat(row.total_earnings) : 0,
    averageRating: row.average_rating ? parseFloat(row.average_rating) : undefined,
    reviewCount: row.review_count || 0,
    responseRate: row.response_rate ? parseFloat(row.response_rate) : undefined,
    completionRate: row.completion_rate ? parseFloat(row.completion_rate) : undefined,
    successRate: row.success_rate ? parseFloat(row.success_rate) : undefined,
    referredBy: row.referred_by,
    referralCode: row.referral_code,
    attributionEarnings: row.attribution_earnings ? parseFloat(row.attribution_earnings) : 0,
    status: row.status || 'active',
    suspendedAt: row.suspended_at ? new Date(row.suspended_at) : undefined,
    suspendedReason: row.suspended_reason,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToTask(row: any): Task {
  return {
    id: row.id,
    posterId: row.poster_id || row.poster_user_id,
    posterType: row.poster_type || 'buyer',
    posterName: row.poster_name,
    posterCompany: row.poster_company,
    posterAvatarUrl: row.poster_avatar_url,
    posterRating: row.poster_rating ? parseFloat(row.poster_rating) : undefined,
    title: row.title,
    description: row.description,
    category: row.category,
    categoryId: row.category_id,
    subcategory: row.subcategory,
    subcategoryId: row.subcategory_id,
    skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : (row.skills || []),
    tags: row.tags,
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
    status: row.status || 'open',
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

function mapRowToApplication(row: any): TaskApplication {
  return {
    id: row.id,
    taskId: row.task_id,
    workerId: row.worker_id,
    workerName: row.worker_name,
    workerHeadline: row.worker_headline,
    workerAvatarUrl: row.worker_avatar_url,
    workerRating: row.worker_rating,
    workerCompletedTasks: row.worker_completed_tasks,
    coverLetter: row.cover_letter,
    proposedRate: row.proposed_rate ? parseFloat(row.proposed_rate) : undefined,
    proposedTimeline: row.proposed_timeline,
    proposedApproach: row.proposed_approach,
    estimatedHours: row.estimated_hours,
    portfolioLinks: row.portfolio_links,
    attachments: row.attachments,
    matchScore: row.match_score,
    matchReasons: row.match_reasons,
    aiRecommendation: row.ai_recommendation,
    status: row.status || 'pending',
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by,
    interviewScheduledAt: row.interview_scheduled_at ? new Date(row.interview_scheduled_at) : undefined,
    interviewCompletedAt: row.interview_completed_at ? new Date(row.interview_completed_at) : undefined,
    interviewNotes: row.interview_notes,
    aiGenerated: row.ai_generated ?? false,
    aiPersonalization: row.ai_personalization,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// =====================================================
// EXPORTS
// =====================================================

export const MatchingEngine = {
  // Core matching functions
  scanForOpportunities,
  matchWorkersToTask,
  generateProactiveMatches,
  getMatchesForWorker,
  getMatchesForTask,
  scoreMatch,
  generateMatchExplanation,
  acceptMatch,
  dismissMatch,

  // Need detection
  detectFounderNeeds,
  detectBuyerNeeds,
  detectSellerNeeds,
};

export default MatchingEngine;
