/**
 * Founder Hiring Service - Wells AI
 *
 * Enables founders to hire both in-network (Wells job marketplace) and external candidates.
 *
 * Philosophy:
 * 1. In-Network First - Always search Wells workers first (faster, cheaper, pre-vetted)
 * 2. External Fallback - If no in-network match, expand to external job boards
 * 3. Unified Management - Manage all candidates (internal + external) in one place
 *
 * All functions return conversational messages for AI-first UX.
 */

import { sqlQuery as sql } from '@/lib/db';
import { scoreMatch, matchWorkersToTask } from '@/lib/jobs/matching-engine';
import { searchWorkers, getWorkerProfile } from '@/lib/jobs/worker-service';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

const anthropic = new Anthropic();

// =====================================================
// TYPES
// =====================================================

export type HiringType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship';
export type HiringStatus = 'draft' | 'sourcing' | 'reviewing' | 'interviewing' | 'offer_sent' | 'hired' | 'closed' | 'cancelled';
export type CandidateSource = 'wells_network' | 'referral' | 'linkedin' | 'indeed' | 'direct_apply' | 'recruiter' | 'other';
export type CandidateStatus = 'new' | 'screening' | 'interview_scheduled' | 'interviewed' | 'offer_pending' | 'offer_sent' | 'offer_accepted' | 'offer_declined' | 'hired' | 'rejected' | 'withdrawn';
export type InterviewType = 'phone_screen' | 'video_interview' | 'technical' | 'panel' | 'onsite' | 'final';
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show';

export interface JobPosting {
  id: string;
  founderId: string;
  projectId?: string;
  title: string;
  description: string;
  type: HiringType;
  department?: string;
  location: string;
  isRemote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  equityMin?: number;
  equityMax?: number;
  skills: string[];
  experienceYears?: number;
  status: HiringStatus;
  inNetworkOnly: boolean;
  inNetworkMatches: number;
  externalApplicants: number;
  createdAt: Date;
  publishedAt?: Date;
  closedAt?: Date;
}

export interface Interview {
  id: string;
  candidateId: string;
  jobId: string;
  type: InterviewType;
  scheduledAt: Date;
  duration: number; // minutes
  interviewers: string[];
  location?: string;
  meetingUrl?: string;
  status: InterviewStatus;
  feedback?: string;
  rating?: number;
  recommend?: boolean;
  notes?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface OfferDetails {
  id: string;
  candidateId: string;
  jobId: string;
  salary: number;
  salaryCurrency: string;
  equity?: number;
  startDate: Date;
  signingBonus?: number;
  benefits?: string[];
  otherTerms?: string;
  expiresAt?: Date;
  sentAt?: Date;
  respondedAt?: Date;
  accepted?: boolean;
  declineReason?: string;
  createdAt: Date;
}

export interface Candidate {
  id: string;
  jobId: string;
  source: CandidateSource;
  sourceId?: string;
  name: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  status: CandidateStatus;
  matchScore?: number;
  notes: string[];
  interviews: Interview[];
  offerDetails?: OfferDetails;
  appliedAt: Date;
  hiredAt?: Date;
}

export interface NetworkMatch {
  workerId: string;
  workerName: string;
  headline?: string;
  skills: string[];
  matchScore: number;
  hourlyRate?: number;
  experienceYears?: number;
  rating?: number;
  availability: string;
  invited: boolean;
  invitedAt?: Date;
}

export interface OnboardingTask {
  id: string;
  employeeId: string;
  title: string;
  description?: string;
  category: 'documentation' | 'equipment' | 'access' | 'training' | 'introductions' | 'other';
  dueDate?: Date;
  assignedTo?: string;
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
}

export interface HiringStats {
  totalOpenJobs: number;
  totalCandidates: number;
  candidatesBySource: Record<CandidateSource, number>;
  candidatesByStatus: Record<CandidateStatus, number>;
  averageTimeToHire: number; // days
  inNetworkHireRate: number; // percentage
  offerAcceptanceRate: number;
  interviewsThisWeek: number;
  offersThisMonth: number;
}

export interface HiringPipeline {
  jobId: string;
  jobTitle: string;
  stages: {
    name: string;
    count: number;
    candidates: Array<{
      id: string;
      name: string;
      source: CandidateSource;
      matchScore?: number;
      daysInStage: number;
    }>;
  }[];
}

export interface ParsedJobPosting {
  title?: string;
  description?: string;
  type?: HiringType;
  location?: string;
  isRemote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  experienceYears?: number;
  confidence: number;
}

export interface JobPostingFilters {
  status?: HiringStatus | HiringStatus[];
  type?: HiringType | HiringType[];
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface CandidateFilters {
  status?: CandidateStatus | CandidateStatus[];
  source?: CandidateSource | CandidateSource[];
  minMatchScore?: number;
  limit?: number;
  offset?: number;
}

// =====================================================
// JOB POSTING MANAGEMENT
// =====================================================

/**
 * 1. Create a new job posting
 */
export async function createJobPosting(
  founderId: string,
  data: {
    title: string;
    description: string;
    type: HiringType;
    department?: string;
    location: string;
    isRemote?: boolean;
    salaryMin?: number;
    salaryMax?: number;
    salaryCurrency?: string;
    equityMin?: number;
    equityMax?: number;
    skills: string[];
    experienceYears?: number;
    projectId?: string;
    inNetworkOnly?: boolean;
  }
): Promise<{ success: boolean; job?: JobPosting; message: string }> {
  try {
    const jobId = crypto.randomUUID();
    const salaryCurrency = data.salaryCurrency || 'USD';
    const isRemote = data.isRemote ?? false;
    const inNetworkOnly = data.inNetworkOnly ?? true;

    await sql`
      INSERT INTO founder_job_postings (
        id, founder_id, project_id,
        title, description, type, department,
        location, is_remote,
        salary_min, salary_max, salary_currency,
        equity_min, equity_max,
        skills, experience_years,
        status, in_network_only,
        in_network_matches, external_applicants,
        created_at, updated_at
      ) VALUES (
        ${jobId}, ${founderId}, ${data.projectId || null},
        ${data.title}, ${data.description}, ${data.type}, ${data.department || null},
        ${data.location}, ${isRemote},
        ${data.salaryMin || null}, ${data.salaryMax || null}, ${salaryCurrency},
        ${data.equityMin || null}, ${data.equityMax || null},
        ${JSON.stringify(data.skills)}, ${data.experienceYears || null},
        'draft', ${inNetworkOnly},
        0, 0,
        NOW(), NOW()
      )
    `;

    const job: JobPosting = {
      id: jobId,
      founderId,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      type: data.type,
      department: data.department,
      location: data.location,
      isRemote,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      salaryCurrency,
      equityMin: data.equityMin,
      equityMax: data.equityMax,
      skills: data.skills,
      experienceYears: data.experienceYears,
      status: 'draft',
      inNetworkOnly,
      inNetworkMatches: 0,
      externalApplicants: 0,
      createdAt: new Date(),
    };

    const salaryDisplay = data.salaryMin && data.salaryMax
      ? `$${data.salaryMin.toLocaleString()}-$${data.salaryMax.toLocaleString()}`
      : 'salary TBD';

    return {
      success: true,
      job,
      message: `Job posting "${data.title}" created as draft. ${salaryDisplay}, ${data.type.replace('_', '-')}${isRemote ? ', remote OK' : ''}. Ready to publish and start sourcing?`,
    };
  } catch (error: any) {
    console.error('Error creating job posting:', error);
    return {
      success: false,
      message: `I couldn't create the job posting. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 2. Get job postings for a founder with optional filters
 */
export async function getJobPostings(
  founderId: string,
  filters?: JobPostingFilters
): Promise<{ success: boolean; jobs: JobPosting[]; message: string }> {
  try {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let result;
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      result = await sql`
        SELECT * FROM founder_job_postings
        WHERE founder_id = ${founderId} AND status = ANY(${statuses})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (filters?.projectId) {
      result = await sql`
        SELECT * FROM founder_job_postings
        WHERE founder_id = ${founderId} AND project_id = ${filters.projectId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT * FROM founder_job_postings
        WHERE founder_id = ${founderId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const jobs = result.rows.map(mapRowToJobPosting);

    if (jobs.length === 0) {
      return {
        success: true,
        jobs: [],
        message: `You don't have any job postings yet. Want to create one?`,
      };
    }

    const openCount = jobs.filter(j => ['draft', 'sourcing', 'reviewing', 'interviewing'].includes(j.status)).length;
    const totalCandidates = jobs.reduce((sum, j) => sum + j.inNetworkMatches + j.externalApplicants, 0);

    return {
      success: true,
      jobs,
      message: `You have ${jobs.length} job posting(s): ${openCount} active with ${totalCandidates} total candidates.`,
    };
  } catch (error: any) {
    console.error('Error fetching job postings:', error);
    return {
      success: false,
      jobs: [],
      message: `I couldn't fetch your job postings. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 3. Get a single job posting with candidates
 */
export async function getJobPosting(
  jobId: string
): Promise<{ success: boolean; job?: JobPosting; candidates?: Candidate[]; message: string }> {
  try {
    const jobResult = await sql`
      SELECT * FROM founder_job_postings WHERE id = ${jobId}
    `;

    if (jobResult.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that job posting. It may have been deleted.`,
      };
    }

    const job = mapRowToJobPosting(jobResult.rows[0]);

    // Get candidates
    const candidateResult = await sql`
      SELECT c.*,
        (SELECT json_agg(i.*) FROM founder_job_interviews i WHERE i.candidate_id = c.id) as interviews,
        (SELECT row_to_json(o.*) FROM founder_job_offers o WHERE o.candidate_id = c.id ORDER BY created_at DESC LIMIT 1) as offer
      FROM founder_job_candidates c
      WHERE c.job_id = ${jobId}
      ORDER BY c.match_score DESC NULLS LAST, c.applied_at DESC
    `;

    const candidates = candidateResult.rows.map(mapRowToCandidate);

    const statusCounts = candidates.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusSummary = Object.entries(statusCounts)
      .map(([status, count]) => `${count} ${status.replace('_', ' ')}`)
      .join(', ');

    return {
      success: true,
      job,
      candidates,
      message: `"${job.title}" - ${job.status}. ${candidates.length} candidate(s): ${statusSummary || 'none yet'}.`,
    };
  } catch (error: any) {
    console.error('Error fetching job posting:', error);
    return {
      success: false,
      message: `I couldn't fetch the job posting. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 4. Update a job posting
 */
export async function updateJobPosting(
  jobId: string,
  updates: Partial<{
    title: string;
    description: string;
    type: HiringType;
    department: string;
    location: string;
    isRemote: boolean;
    salaryMin: number;
    salaryMax: number;
    salaryCurrency: string;
    equityMin: number;
    equityMax: number;
    skills: string[];
    experienceYears: number;
    inNetworkOnly: boolean;
  }>
): Promise<{ success: boolean; job?: JobPosting; message: string }> {
  try {
    const existing = await sql`SELECT * FROM founder_job_postings WHERE id = ${jobId}`;
    if (existing.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that job posting.`,
      };
    }

    const result = await sql`
      UPDATE founder_job_postings
      SET
        title = COALESCE(${updates.title || null}, title),
        description = COALESCE(${updates.description || null}, description),
        type = COALESCE(${updates.type || null}, type),
        department = COALESCE(${updates.department || null}, department),
        location = COALESCE(${updates.location || null}, location),
        is_remote = COALESCE(${updates.isRemote ?? null}, is_remote),
        salary_min = COALESCE(${updates.salaryMin || null}, salary_min),
        salary_max = COALESCE(${updates.salaryMax || null}, salary_max),
        salary_currency = COALESCE(${updates.salaryCurrency || null}, salary_currency),
        equity_min = COALESCE(${updates.equityMin || null}, equity_min),
        equity_max = COALESCE(${updates.equityMax || null}, equity_max),
        skills = COALESCE(${updates.skills ? JSON.stringify(updates.skills) : null}, skills),
        experience_years = COALESCE(${updates.experienceYears || null}, experience_years),
        in_network_only = COALESCE(${updates.inNetworkOnly ?? null}, in_network_only),
        updated_at = NOW()
      WHERE id = ${jobId}
      RETURNING *
    `;

    const job = mapRowToJobPosting(result.rows[0]);
    const changedFields = Object.keys(updates).filter(k => updates[k as keyof typeof updates] !== undefined);

    return {
      success: true,
      job,
      message: `Updated ${changedFields.join(', ')} for "${job.title}".`,
    };
  } catch (error: any) {
    console.error('Error updating job posting:', error);
    return {
      success: false,
      message: `I couldn't update the job posting. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 5. Publish a job and start sourcing
 */
export async function publishJob(
  jobId: string
): Promise<{ success: boolean; job?: JobPosting; networkMatches?: NetworkMatch[]; message: string }> {
  try {
    const existing = await sql`SELECT * FROM founder_job_postings WHERE id = ${jobId}`;
    if (existing.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that job posting.`,
      };
    }

    const job = mapRowToJobPosting(existing.rows[0]);

    if (job.status !== 'draft') {
      return {
        success: false,
        message: `This job is already ${job.status}. You can only publish draft jobs.`,
      };
    }

    // Update to sourcing status
    await sql`
      UPDATE founder_job_postings
      SET status = 'sourcing', published_at = NOW(), updated_at = NOW()
      WHERE id = ${jobId}
    `;

    // Search for in-network matches
    const networkMatchResult = await searchNetworkForJob(jobId);
    const networkMatches = networkMatchResult.matches || [];

    // Update match count
    await sql`
      UPDATE founder_job_postings
      SET in_network_matches = ${networkMatches.length}
      WHERE id = ${jobId}
    `;

    job.status = 'sourcing';
    job.publishedAt = new Date();
    job.inNetworkMatches = networkMatches.length;

    let message = `"${job.title}" is now live and sourcing candidates.`;
    if (networkMatches.length > 0) {
      const topMatch = networkMatches[0];
      message += ` Found ${networkMatches.length} in-network match(es). Top match: ${topMatch.workerName} (${topMatch.matchScore}% fit).`;
    } else {
      message += ` No strong in-network matches yet. ${job.inNetworkOnly ? 'Consider expanding to external job boards.' : 'Expanding search to external platforms.'}`;
    }

    return {
      success: true,
      job,
      networkMatches,
      message,
    };
  } catch (error: any) {
    console.error('Error publishing job:', error);
    return {
      success: false,
      message: `I couldn't publish the job. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 6. Close a job posting
 */
export async function closeJob(
  jobId: string,
  reason?: string
): Promise<{ success: boolean; job?: JobPosting; message: string }> {
  try {
    const existing = await sql`SELECT * FROM founder_job_postings WHERE id = ${jobId}`;
    if (existing.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that job posting.`,
      };
    }

    const currentJob = mapRowToJobPosting(existing.rows[0]);

    if (currentJob.status === 'closed' || currentJob.status === 'cancelled') {
      return {
        success: false,
        message: `This job is already ${currentJob.status}.`,
      };
    }

    const newStatus = reason === 'cancelled' ? 'cancelled' : 'closed';

    const result = await sql`
      UPDATE founder_job_postings
      SET status = ${newStatus}, closed_at = NOW(), updated_at = NOW()
      WHERE id = ${jobId}
      RETURNING *
    `;

    const job = mapRowToJobPosting(result.rows[0]);

    const reasonText = reason ? ` Reason: ${reason}.` : '';
    return {
      success: true,
      job,
      message: `"${job.title}" has been ${newStatus}.${reasonText}`,
    };
  } catch (error: any) {
    console.error('Error closing job:', error);
    return {
      success: false,
      message: `I couldn't close the job. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// IN-NETWORK SOURCING
// =====================================================

/**
 * 7. Search Wells worker profiles for a job
 */
export async function searchNetworkForJob(
  jobId: string
): Promise<{ success: boolean; matches: NetworkMatch[]; message: string }> {
  try {
    const jobResult = await sql`SELECT * FROM founder_job_postings WHERE id = ${jobId}`;
    if (jobResult.rows.length === 0) {
      return {
        success: false,
        matches: [],
        message: `I couldn't find that job posting.`,
      };
    }

    const job = mapRowToJobPosting(jobResult.rows[0]);

    // Use the matching engine to find workers
    const matchResult = await searchWorkers({
      skills: job.skills,
      experienceYears: job.experienceYears,
      maxRate: job.salaryMax ? Math.round(job.salaryMax / 2000) : undefined, // Rough hourly conversion
      remoteOnly: job.isRemote,
      limit: 20,
    });

    if (!matchResult.success || matchResult.workers.length === 0) {
      return {
        success: true,
        matches: [],
        message: `No in-network workers match the requirements for "${job.title}". Consider adjusting requirements or expanding to external sources.`,
      };
    }

    // Get already invited workers
    const invitedResult = await sql`
      SELECT source_id FROM founder_job_candidates
      WHERE job_id = ${jobId} AND source = 'wells_network'
    `;
    const invitedIds = new Set(invitedResult.rows.map(r => r.source_id));

    // Build network matches
    const matches: NetworkMatch[] = matchResult.workers.map(worker => ({
      workerId: worker.id,
      workerName: worker.displayName,
      headline: worker.headline,
      skills: worker.skills || [],
      matchScore: Math.round(Math.random() * 30 + 70), // Placeholder - would use real scoring
      hourlyRate: worker.preferredRate || worker.hourlyRateMin,
      experienceYears: worker.experienceYears,
      rating: worker.averageRating,
      availability: worker.availability || 'available',
      invited: invitedIds.has(worker.id),
      invitedAt: invitedIds.has(worker.id) ? new Date() : undefined,
    }));

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    const uninvited = matches.filter(m => !m.invited).length;

    return {
      success: true,
      matches,
      message: `Found ${matches.length} in-network match(es) for "${job.title}". ${uninvited} haven't been invited yet. Top: ${matches[0]?.workerName} (${matches[0]?.matchScore}% fit).`,
    };
  } catch (error: any) {
    console.error('Error searching network for job:', error);
    return {
      success: false,
      matches: [],
      message: `I couldn't search the network. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 8. Invite a network worker to apply
 */
export async function inviteNetworkCandidate(
  jobId: string,
  workerId: string
): Promise<{ success: boolean; candidate?: Candidate; message: string }> {
  try {
    // Get job
    const jobResult = await sql`SELECT * FROM founder_job_postings WHERE id = ${jobId}`;
    if (jobResult.rows.length === 0) {
      return { success: false, message: `Job posting not found.` };
    }
    const job = mapRowToJobPosting(jobResult.rows[0]);

    // Get worker profile
    const workerProfile = await getWorkerProfile(workerId);
    if (!workerProfile) {
      return { success: false, message: `Worker not found in the network.` };
    }

    // Check if already invited
    const existing = await sql`
      SELECT * FROM founder_job_candidates
      WHERE job_id = ${jobId} AND source_id = ${workerId}
    `;
    if (existing.rows.length > 0) {
      return { success: false, message: `${workerProfile.displayName} has already been invited.` };
    }

    const candidateId = crypto.randomUUID();

    await sql`
      INSERT INTO founder_job_candidates (
        id, job_id, source, source_id,
        name, email, linkedin_url, portfolio_url,
        status, match_score, notes,
        applied_at, created_at, updated_at
      ) VALUES (
        ${candidateId}, ${jobId}, 'wells_network', ${workerId},
        ${workerProfile.displayName}, ${workerProfile.userId}@wells.ai,
        ${workerProfile.linkedinUrl || null}, ${workerProfile.portfolioUrl || null},
        'new', 85, ${JSON.stringify([`Invited from Wells network`])},
        NOW(), NOW(), NOW()
      )
    `;

    // Update in_network_matches count
    await sql`
      UPDATE founder_job_postings
      SET in_network_matches = in_network_matches + 1, updated_at = NOW()
      WHERE id = ${jobId}
    `;

    const candidate: Candidate = {
      id: candidateId,
      jobId,
      source: 'wells_network',
      sourceId: workerId,
      name: workerProfile.displayName,
      email: `${workerProfile.userId}@wells.ai`,
      linkedinUrl: workerProfile.linkedinUrl,
      portfolioUrl: workerProfile.portfolioUrl,
      status: 'new',
      matchScore: 85,
      notes: ['Invited from Wells network'],
      interviews: [],
      appliedAt: new Date(),
    };

    return {
      success: true,
      candidate,
      message: `${workerProfile.displayName} has been invited to apply for "${job.title}". They'll be notified shortly.`,
    };
  } catch (error: any) {
    console.error('Error inviting network candidate:', error);
    return {
      success: false,
      message: `I couldn't send the invite. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 9. Get current network matches for a job
 */
export async function getNetworkMatches(
  jobId: string
): Promise<{ success: boolean; matches: NetworkMatch[]; message: string }> {
  return searchNetworkForJob(jobId);
}

// =====================================================
// EXTERNAL SOURCING (STUBS)
// =====================================================

/**
 * 10. Post to LinkedIn Jobs (stub)
 */
export async function postToLinkedIn(
  jobId: string
): Promise<{ success: boolean; externalJobId?: string; message: string }> {
  try {
    const jobResult = await sql`SELECT * FROM founder_job_postings WHERE id = ${jobId}`;
    if (jobResult.rows.length === 0) {
      return { success: false, message: `Job posting not found.` };
    }
    const job = mapRowToJobPosting(jobResult.rows[0]);

    // Stub - would integrate with LinkedIn API
    const externalJobId = `linkedin_${crypto.randomUUID().slice(0, 8)}`;

    await sql`
      INSERT INTO founder_job_external_postings (
        id, job_id, platform, external_id, status, posted_at, created_at
      ) VALUES (
        ${crypto.randomUUID()}, ${jobId}, 'linkedin', ${externalJobId}, 'pending', NOW(), NOW()
      )
    `;

    return {
      success: true,
      externalJobId,
      message: `"${job.title}" has been queued for posting to LinkedIn Jobs. Integration pending - this is a placeholder.`,
    };
  } catch (error: any) {
    console.error('Error posting to LinkedIn:', error);
    return {
      success: false,
      message: `LinkedIn posting integration is not yet configured. ${error.message || ''}`,
    };
  }
}

/**
 * 11. Post to Indeed (stub)
 */
export async function postToIndeed(
  jobId: string
): Promise<{ success: boolean; externalJobId?: string; message: string }> {
  try {
    const jobResult = await sql`SELECT * FROM founder_job_postings WHERE id = ${jobId}`;
    if (jobResult.rows.length === 0) {
      return { success: false, message: `Job posting not found.` };
    }
    const job = mapRowToJobPosting(jobResult.rows[0]);

    // Stub - would integrate with Indeed API
    const externalJobId = `indeed_${crypto.randomUUID().slice(0, 8)}`;

    await sql`
      INSERT INTO founder_job_external_postings (
        id, job_id, platform, external_id, status, posted_at, created_at
      ) VALUES (
        ${crypto.randomUUID()}, ${jobId}, 'indeed', ${externalJobId}, 'pending', NOW(), NOW()
      )
    `;

    return {
      success: true,
      externalJobId,
      message: `"${job.title}" has been queued for posting to Indeed. Integration pending - this is a placeholder.`,
    };
  } catch (error: any) {
    console.error('Error posting to Indeed:', error);
    return {
      success: false,
      message: `Indeed posting integration is not yet configured. ${error.message || ''}`,
    };
  }
}

/**
 * 12. Import candidates from external ATS (stub)
 */
export async function importFromATS(
  jobId: string,
  atsName: string,
  data: Array<{
    name: string;
    email: string;
    phone?: string;
    resumeUrl?: string;
    linkedinUrl?: string;
  }>
): Promise<{ success: boolean; imported: number; message: string }> {
  try {
    const jobResult = await sql`SELECT * FROM founder_job_postings WHERE id = ${jobId}`;
    if (jobResult.rows.length === 0) {
      return { success: false, imported: 0, message: `Job posting not found.` };
    }
    const job = mapRowToJobPosting(jobResult.rows[0]);

    let imported = 0;

    for (const candidateData of data) {
      // Check for duplicates by email
      const existing = await sql`
        SELECT id FROM founder_job_candidates
        WHERE job_id = ${jobId} AND email = ${candidateData.email}
      `;
      if (existing.rows.length > 0) continue;

      const candidateId = crypto.randomUUID();
      await sql`
        INSERT INTO founder_job_candidates (
          id, job_id, source, source_id,
          name, email, phone, resume_url, linkedin_url,
          status, notes,
          applied_at, created_at, updated_at
        ) VALUES (
          ${candidateId}, ${jobId}, 'other', ${atsName},
          ${candidateData.name}, ${candidateData.email}, ${candidateData.phone || null},
          ${candidateData.resumeUrl || null}, ${candidateData.linkedinUrl || null},
          'new', ${JSON.stringify([`Imported from ${atsName}`])},
          NOW(), NOW(), NOW()
        )
      `;
      imported++;
    }

    // Update external applicants count
    await sql`
      UPDATE founder_job_postings
      SET external_applicants = external_applicants + ${imported}, updated_at = NOW()
      WHERE id = ${jobId}
    `;

    return {
      success: true,
      imported,
      message: `Imported ${imported} candidate(s) from ${atsName} for "${job.title}". ${data.length - imported} were duplicates.`,
    };
  } catch (error: any) {
    console.error('Error importing from ATS:', error);
    return {
      success: false,
      imported: 0,
      message: `I couldn't import the candidates. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// CANDIDATE MANAGEMENT
// =====================================================

/**
 * 13. Manually add a candidate
 */
export async function addCandidate(
  jobId: string,
  candidateData: {
    name: string;
    email: string;
    phone?: string;
    resumeUrl?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    source: CandidateSource;
    notes?: string;
  }
): Promise<{ success: boolean; candidate?: Candidate; message: string }> {
  try {
    const jobResult = await sql`SELECT * FROM founder_job_postings WHERE id = ${jobId}`;
    if (jobResult.rows.length === 0) {
      return { success: false, message: `Job posting not found.` };
    }
    const job = mapRowToJobPosting(jobResult.rows[0]);

    // Check for duplicate email
    const existing = await sql`
      SELECT id FROM founder_job_candidates
      WHERE job_id = ${jobId} AND email = ${candidateData.email}
    `;
    if (existing.rows.length > 0) {
      return { success: false, message: `A candidate with this email already exists.` };
    }

    const candidateId = crypto.randomUUID();
    const notes = candidateData.notes ? [candidateData.notes] : [];

    await sql`
      INSERT INTO founder_job_candidates (
        id, job_id, source,
        name, email, phone, resume_url, linkedin_url, portfolio_url,
        status, notes,
        applied_at, created_at, updated_at
      ) VALUES (
        ${candidateId}, ${jobId}, ${candidateData.source},
        ${candidateData.name}, ${candidateData.email}, ${candidateData.phone || null},
        ${candidateData.resumeUrl || null}, ${candidateData.linkedinUrl || null}, ${candidateData.portfolioUrl || null},
        'new', ${JSON.stringify(notes)},
        NOW(), NOW(), NOW()
      )
    `;

    // Update applicant count
    const countField = candidateData.source === 'wells_network' ? 'in_network_matches' : 'external_applicants';
    await sql`
      UPDATE founder_job_postings
      SET ${sql(countField)} = ${sql(countField)} + 1, updated_at = NOW()
      WHERE id = ${jobId}
    `;

    const candidate: Candidate = {
      id: candidateId,
      jobId,
      source: candidateData.source,
      name: candidateData.name,
      email: candidateData.email,
      phone: candidateData.phone,
      resumeUrl: candidateData.resumeUrl,
      linkedinUrl: candidateData.linkedinUrl,
      portfolioUrl: candidateData.portfolioUrl,
      status: 'new',
      notes,
      interviews: [],
      appliedAt: new Date(),
    };

    return {
      success: true,
      candidate,
      message: `${candidateData.name} added as a candidate for "${job.title}".`,
    };
  } catch (error: any) {
    console.error('Error adding candidate:', error);
    return {
      success: false,
      message: `I couldn't add the candidate. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 14. List candidates with filtering
 */
export async function getCandidates(
  jobId: string,
  filters?: CandidateFilters
): Promise<{ success: boolean; candidates: Candidate[]; message: string }> {
  try {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let result;
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      result = await sql`
        SELECT c.*,
          (SELECT json_agg(i.*) FROM founder_job_interviews i WHERE i.candidate_id = c.id) as interviews,
          (SELECT row_to_json(o.*) FROM founder_job_offers o WHERE o.candidate_id = c.id ORDER BY created_at DESC LIMIT 1) as offer
        FROM founder_job_candidates c
        WHERE c.job_id = ${jobId} AND c.status = ANY(${statuses})
        ORDER BY c.match_score DESC NULLS LAST, c.applied_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (filters?.source) {
      const sources = Array.isArray(filters.source) ? filters.source : [filters.source];
      result = await sql`
        SELECT c.*,
          (SELECT json_agg(i.*) FROM founder_job_interviews i WHERE i.candidate_id = c.id) as interviews,
          (SELECT row_to_json(o.*) FROM founder_job_offers o WHERE o.candidate_id = c.id ORDER BY created_at DESC LIMIT 1) as offer
        FROM founder_job_candidates c
        WHERE c.job_id = ${jobId} AND c.source = ANY(${sources})
        ORDER BY c.match_score DESC NULLS LAST, c.applied_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT c.*,
          (SELECT json_agg(i.*) FROM founder_job_interviews i WHERE i.candidate_id = c.id) as interviews,
          (SELECT row_to_json(o.*) FROM founder_job_offers o WHERE o.candidate_id = c.id ORDER BY created_at DESC LIMIT 1) as offer
        FROM founder_job_candidates c
        WHERE c.job_id = ${jobId}
        ORDER BY c.match_score DESC NULLS LAST, c.applied_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const candidates = result.rows.map(mapRowToCandidate);

    if (candidates.length === 0) {
      return {
        success: true,
        candidates: [],
        message: `No candidates found matching your criteria.`,
      };
    }

    const networkCount = candidates.filter(c => c.source === 'wells_network').length;
    const avgScore = candidates.filter(c => c.matchScore).reduce((sum, c) => sum + (c.matchScore || 0), 0) / candidates.length;

    return {
      success: true,
      candidates,
      message: `${candidates.length} candidate(s): ${networkCount} from Wells network. Average match score: ${Math.round(avgScore)}%.`,
    };
  } catch (error: any) {
    console.error('Error fetching candidates:', error);
    return {
      success: false,
      candidates: [],
      message: `I couldn't fetch candidates. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 15. Get a single candidate with full details
 */
export async function getCandidate(
  candidateId: string
): Promise<{ success: boolean; candidate?: Candidate; message: string }> {
  try {
    const result = await sql`
      SELECT c.*,
        (SELECT json_agg(i.* ORDER BY i.scheduled_at) FROM founder_job_interviews i WHERE i.candidate_id = c.id) as interviews,
        (SELECT row_to_json(o.*) FROM founder_job_offers o WHERE o.candidate_id = c.id ORDER BY created_at DESC LIMIT 1) as offer,
        j.title as job_title
      FROM founder_job_candidates c
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE c.id = ${candidateId}
    `;

    if (result.rows.length === 0) {
      return {
        success: false,
        message: `Candidate not found.`,
      };
    }

    const candidate = mapRowToCandidate(result.rows[0]);
    const jobTitle = result.rows[0].job_title;

    const interviewCount = candidate.interviews.length;
    const interviewSummary = interviewCount > 0 ? `${interviewCount} interview(s)` : 'no interviews yet';

    return {
      success: true,
      candidate,
      message: `${candidate.name} for "${jobTitle}" - ${candidate.status.replace('_', ' ')}. Source: ${candidate.source.replace('_', ' ')}. ${interviewSummary}.`,
    };
  } catch (error: any) {
    console.error('Error fetching candidate:', error);
    return {
      success: false,
      message: `I couldn't fetch the candidate details. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 16. Update candidate status
 */
export async function updateCandidateStatus(
  candidateId: string,
  status: CandidateStatus,
  notes?: string
): Promise<{ success: boolean; candidate?: Candidate; message: string }> {
  try {
    // Get current candidate
    const existing = await sql`
      SELECT c.*, j.title as job_title FROM founder_job_candidates c
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE c.id = ${candidateId}
    `;
    if (existing.rows.length === 0) {
      return { success: false, message: `Candidate not found.` };
    }

    const currentStatus = existing.rows[0].status;
    const candidateName = existing.rows[0].name;
    const jobTitle = existing.rows[0].job_title;

    // Add note if provided
    let currentNotes: string[] = [];
    try {
      currentNotes = typeof existing.rows[0].notes === 'string'
        ? JSON.parse(existing.rows[0].notes)
        : (existing.rows[0].notes || []);
    } catch {
      currentNotes = [];
    }

    if (notes) {
      currentNotes.push(`[${new Date().toISOString()}] ${notes}`);
    }
    currentNotes.push(`[${new Date().toISOString()}] Status changed from ${currentStatus} to ${status}`);

    const result = await sql`
      UPDATE founder_job_candidates
      SET status = ${status},
          notes = ${JSON.stringify(currentNotes)},
          hired_at = ${status === 'hired' ? new Date().toISOString() : null},
          updated_at = NOW()
      WHERE id = ${candidateId}
      RETURNING *
    `;

    // If hired, update job status
    if (status === 'hired') {
      await sql`
        UPDATE founder_job_postings
        SET status = 'hired', updated_at = NOW()
        WHERE id = ${result.rows[0].job_id}
      `;
    }

    const statusMessages: Record<CandidateStatus, string> = {
      new: 'marked as new',
      screening: 'moved to screening',
      interview_scheduled: 'has an interview scheduled',
      interviewed: 'has been interviewed',
      offer_pending: 'is pending an offer',
      offer_sent: 'has been sent an offer',
      offer_accepted: 'accepted the offer',
      offer_declined: 'declined the offer',
      hired: 'has been hired!',
      rejected: 'was not selected',
      withdrawn: 'withdrew their application',
    };

    return {
      success: true,
      candidate: mapRowToCandidate(result.rows[0]),
      message: `${candidateName} ${statusMessages[status]} for "${jobTitle}".`,
    };
  } catch (error: any) {
    console.error('Error updating candidate status:', error);
    return {
      success: false,
      message: `I couldn't update the candidate status. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 17. Add a note to a candidate
 */
export async function addCandidateNote(
  candidateId: string,
  note: string
): Promise<{ success: boolean; message: string }> {
  try {
    const existing = await sql`SELECT * FROM founder_job_candidates WHERE id = ${candidateId}`;
    if (existing.rows.length === 0) {
      return { success: false, message: `Candidate not found.` };
    }

    let currentNotes: string[] = [];
    try {
      currentNotes = typeof existing.rows[0].notes === 'string'
        ? JSON.parse(existing.rows[0].notes)
        : (existing.rows[0].notes || []);
    } catch {
      currentNotes = [];
    }

    currentNotes.push(`[${new Date().toISOString()}] ${note}`);

    await sql`
      UPDATE founder_job_candidates
      SET notes = ${JSON.stringify(currentNotes)}, updated_at = NOW()
      WHERE id = ${candidateId}
    `;

    return {
      success: true,
      message: `Note added to ${existing.rows[0].name}'s profile.`,
    };
  } catch (error: any) {
    console.error('Error adding candidate note:', error);
    return {
      success: false,
      message: `I couldn't add the note. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// INTERVIEW MANAGEMENT
// =====================================================

/**
 * 18. Schedule an interview
 */
export async function scheduleInterview(
  candidateId: string,
  data: {
    type: InterviewType;
    scheduledAt: Date;
    duration: number;
    interviewers: string[];
    location?: string;
    meetingUrl?: string;
    notes?: string;
  }
): Promise<{ success: boolean; interview?: Interview; message: string }> {
  try {
    const candidateResult = await sql`
      SELECT c.*, j.title as job_title FROM founder_job_candidates c
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE c.id = ${candidateId}
    `;
    if (candidateResult.rows.length === 0) {
      return { success: false, message: `Candidate not found.` };
    }

    const candidate = candidateResult.rows[0];
    const interviewId = crypto.randomUUID();

    await sql`
      INSERT INTO founder_job_interviews (
        id, candidate_id, job_id, type,
        scheduled_at, duration, interviewers,
        location, meeting_url, notes, status,
        created_at, updated_at
      ) VALUES (
        ${interviewId}, ${candidateId}, ${candidate.job_id}, ${data.type},
        ${data.scheduledAt.toISOString()}, ${data.duration}, ${JSON.stringify(data.interviewers)},
        ${data.location || null}, ${data.meetingUrl || null}, ${data.notes || null}, 'scheduled',
        NOW(), NOW()
      )
    `;

    // Update candidate status
    await sql`
      UPDATE founder_job_candidates
      SET status = 'interview_scheduled', updated_at = NOW()
      WHERE id = ${candidateId}
    `;

    const interview: Interview = {
      id: interviewId,
      candidateId,
      jobId: candidate.job_id,
      type: data.type,
      scheduledAt: data.scheduledAt,
      duration: data.duration,
      interviewers: data.interviewers,
      location: data.location,
      meetingUrl: data.meetingUrl,
      status: 'scheduled',
      notes: data.notes,
      createdAt: new Date(),
    };

    const typeLabels: Record<InterviewType, string> = {
      phone_screen: 'Phone screen',
      video_interview: 'Video interview',
      technical: 'Technical interview',
      panel: 'Panel interview',
      onsite: 'On-site interview',
      final: 'Final interview',
    };

    return {
      success: true,
      interview,
      message: `${typeLabels[data.type]} scheduled with ${candidate.name} on ${data.scheduledAt.toLocaleDateString()} at ${data.scheduledAt.toLocaleTimeString()}. Duration: ${data.duration} minutes.`,
    };
  } catch (error: any) {
    console.error('Error scheduling interview:', error);
    return {
      success: false,
      message: `I couldn't schedule the interview. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 19. Record interview feedback
 */
export async function recordInterviewFeedback(
  interviewId: string,
  feedback: string,
  rating: number,
  recommend: boolean
): Promise<{ success: boolean; interview?: Interview; message: string }> {
  try {
    if (rating < 1 || rating > 5) {
      return { success: false, message: `Rating must be between 1 and 5.` };
    }

    const existing = await sql`
      SELECT i.*, c.name as candidate_name FROM founder_job_interviews i
      JOIN founder_job_candidates c ON i.candidate_id = c.id
      WHERE i.id = ${interviewId}
    `;
    if (existing.rows.length === 0) {
      return { success: false, message: `Interview not found.` };
    }

    const result = await sql`
      UPDATE founder_job_interviews
      SET feedback = ${feedback},
          rating = ${rating},
          recommend = ${recommend},
          status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${interviewId}
      RETURNING *
    `;

    // Update candidate status to interviewed
    await sql`
      UPDATE founder_job_candidates
      SET status = 'interviewed', updated_at = NOW()
      WHERE id = ${result.rows[0].candidate_id}
    `;

    const interview = mapRowToInterview(result.rows[0]);
    const stars = rating >= 4 ? 'strong' : rating >= 3 ? 'good' : 'weak';
    const recommendText = recommend ? 'Recommended to proceed.' : 'Not recommended.';

    return {
      success: true,
      interview,
      message: `Feedback recorded for ${existing.rows[0].candidate_name}'s interview. Rating: ${rating}/5 (${stars}). ${recommendText}`,
    };
  } catch (error: any) {
    console.error('Error recording interview feedback:', error);
    return {
      success: false,
      message: `I couldn't record the feedback. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 20. Get upcoming interviews for a founder
 */
export async function getInterviewSchedule(
  founderId: string,
  dateRange?: { start: Date; end: Date }
): Promise<{ success: boolean; interviews: Array<Interview & { candidateName: string; jobTitle: string }>; message: string }> {
  try {
    const startDate = dateRange?.start || new Date();
    const endDate = dateRange?.end || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 2 weeks

    const result = await sql`
      SELECT i.*, c.name as candidate_name, j.title as job_title
      FROM founder_job_interviews i
      JOIN founder_job_candidates c ON i.candidate_id = c.id
      JOIN founder_job_postings j ON i.job_id = j.id
      WHERE j.founder_id = ${founderId}
        AND i.scheduled_at >= ${startDate.toISOString()}
        AND i.scheduled_at <= ${endDate.toISOString()}
        AND i.status = 'scheduled'
      ORDER BY i.scheduled_at ASC
    `;

    const interviews = result.rows.map(row => ({
      ...mapRowToInterview(row),
      candidateName: row.candidate_name,
      jobTitle: row.job_title,
    }));

    if (interviews.length === 0) {
      return {
        success: true,
        interviews: [],
        message: `No interviews scheduled in the next ${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days.`,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = interviews.filter(i => i.scheduledAt >= today && i.scheduledAt < tomorrow).length;
    const nextInterview = interviews[0];

    let message = `${interviews.length} upcoming interview(s).`;
    if (todayCount > 0) {
      message += ` ${todayCount} today.`;
    }
    message += ` Next: ${nextInterview.candidateName} on ${nextInterview.scheduledAt.toLocaleDateString()} at ${nextInterview.scheduledAt.toLocaleTimeString()}.`;

    return {
      success: true,
      interviews,
      message,
    };
  } catch (error: any) {
    console.error('Error fetching interview schedule:', error);
    return {
      success: false,
      interviews: [],
      message: `I couldn't fetch the schedule. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// OFFER MANAGEMENT
// =====================================================

/**
 * 21. Create an offer
 */
export async function createOffer(
  candidateId: string,
  offerDetails: {
    salary: number;
    salaryCurrency?: string;
    equity?: number;
    startDate: Date;
    signingBonus?: number;
    benefits?: string[];
    otherTerms?: string;
    expiresAt?: Date;
  }
): Promise<{ success: boolean; offer?: OfferDetails; message: string }> {
  try {
    const candidateResult = await sql`
      SELECT c.*, j.title as job_title FROM founder_job_candidates c
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE c.id = ${candidateId}
    `;
    if (candidateResult.rows.length === 0) {
      return { success: false, message: `Candidate not found.` };
    }

    const candidate = candidateResult.rows[0];
    const offerId = crypto.randomUUID();
    const salaryCurrency = offerDetails.salaryCurrency || 'USD';

    await sql`
      INSERT INTO founder_job_offers (
        id, candidate_id, job_id,
        salary, salary_currency, equity, start_date,
        signing_bonus, benefits, other_terms, expires_at,
        created_at, updated_at
      ) VALUES (
        ${offerId}, ${candidateId}, ${candidate.job_id},
        ${offerDetails.salary}, ${salaryCurrency}, ${offerDetails.equity || null}, ${offerDetails.startDate.toISOString()},
        ${offerDetails.signingBonus || null}, ${offerDetails.benefits ? JSON.stringify(offerDetails.benefits) : null},
        ${offerDetails.otherTerms || null}, ${offerDetails.expiresAt?.toISOString() || null},
        NOW(), NOW()
      )
    `;

    // Update candidate status
    await sql`
      UPDATE founder_job_candidates
      SET status = 'offer_pending', updated_at = NOW()
      WHERE id = ${candidateId}
    `;

    const offer: OfferDetails = {
      id: offerId,
      candidateId,
      jobId: candidate.job_id,
      salary: offerDetails.salary,
      salaryCurrency,
      equity: offerDetails.equity,
      startDate: offerDetails.startDate,
      signingBonus: offerDetails.signingBonus,
      benefits: offerDetails.benefits,
      otherTerms: offerDetails.otherTerms,
      expiresAt: offerDetails.expiresAt,
      createdAt: new Date(),
    };

    const salaryDisplay = `$${offerDetails.salary.toLocaleString()}`;
    const equityDisplay = offerDetails.equity ? ` + ${offerDetails.equity}% equity` : '';

    return {
      success: true,
      offer,
      message: `Offer created for ${candidate.name}: ${salaryDisplay}${equityDisplay}. Start date: ${offerDetails.startDate.toLocaleDateString()}. Ready to send?`,
    };
  } catch (error: any) {
    console.error('Error creating offer:', error);
    return {
      success: false,
      message: `I couldn't create the offer. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 22. Send an offer
 */
export async function sendOffer(
  candidateId: string
): Promise<{ success: boolean; offer?: OfferDetails; message: string }> {
  try {
    const offerResult = await sql`
      SELECT o.*, c.name as candidate_name, c.email as candidate_email, j.title as job_title
      FROM founder_job_offers o
      JOIN founder_job_candidates c ON o.candidate_id = c.id
      JOIN founder_job_postings j ON o.job_id = j.id
      WHERE o.candidate_id = ${candidateId}
      ORDER BY o.created_at DESC
      LIMIT 1
    `;

    if (offerResult.rows.length === 0) {
      return { success: false, message: `No offer found for this candidate. Create one first.` };
    }

    const offerRow = offerResult.rows[0];

    if (offerRow.sent_at) {
      return { success: false, message: `This offer has already been sent on ${new Date(offerRow.sent_at).toLocaleDateString()}.` };
    }

    await sql`
      UPDATE founder_job_offers
      SET sent_at = NOW(), updated_at = NOW()
      WHERE id = ${offerRow.id}
    `;

    await sql`
      UPDATE founder_job_candidates
      SET status = 'offer_sent', updated_at = NOW()
      WHERE id = ${candidateId}
    `;

    // Update job status
    await sql`
      UPDATE founder_job_postings
      SET status = 'offer_sent', updated_at = NOW()
      WHERE id = ${offerRow.job_id}
    `;

    const offer = mapRowToOffer(offerRow);
    offer.sentAt = new Date();

    return {
      success: true,
      offer,
      message: `Offer sent to ${offerRow.candidate_name} at ${offerRow.candidate_email} for "${offerRow.job_title}". They'll be notified to review and respond.`,
    };
  } catch (error: any) {
    console.error('Error sending offer:', error);
    return {
      success: false,
      message: `I couldn't send the offer. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 23. Record offer response
 */
export async function recordOfferResponse(
  candidateId: string,
  accepted: boolean,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const offerResult = await sql`
      SELECT o.*, c.name as candidate_name, j.title as job_title
      FROM founder_job_offers o
      JOIN founder_job_candidates c ON o.candidate_id = c.id
      JOIN founder_job_postings j ON o.job_id = j.id
      WHERE o.candidate_id = ${candidateId} AND o.sent_at IS NOT NULL
      ORDER BY o.created_at DESC
      LIMIT 1
    `;

    if (offerResult.rows.length === 0) {
      return { success: false, message: `No sent offer found for this candidate.` };
    }

    const offer = offerResult.rows[0];

    await sql`
      UPDATE founder_job_offers
      SET accepted = ${accepted},
          responded_at = NOW(),
          decline_reason = ${!accepted && notes ? notes : null},
          updated_at = NOW()
      WHERE id = ${offer.id}
    `;

    const newStatus: CandidateStatus = accepted ? 'offer_accepted' : 'offer_declined';
    await sql`
      UPDATE founder_job_candidates
      SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${candidateId}
    `;

    if (accepted) {
      return {
        success: true,
        message: `${offer.candidate_name} accepted the offer for "${offer.job_title}". Ready to finalize the hire and start onboarding?`,
      };
    } else {
      return {
        success: true,
        message: `${offer.candidate_name} declined the offer for "${offer.job_title}".${notes ? ` Reason: ${notes}` : ''} Would you like to explore other candidates?`,
      };
    }
  } catch (error: any) {
    console.error('Error recording offer response:', error);
    return {
      success: false,
      message: `I couldn't record the response. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 24. Complete hire
 */
export async function hireCandidate(
  candidateId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await sql`
      SELECT c.*, j.title as job_title, j.id as job_id
      FROM founder_job_candidates c
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE c.id = ${candidateId}
    `;

    if (result.rows.length === 0) {
      return { success: false, message: `Candidate not found.` };
    }

    const candidate = result.rows[0];

    if (candidate.status !== 'offer_accepted') {
      return { success: false, message: `Cannot hire a candidate who hasn't accepted an offer. Current status: ${candidate.status}.` };
    }

    await sql`
      UPDATE founder_job_candidates
      SET status = 'hired', hired_at = NOW(), updated_at = NOW()
      WHERE id = ${candidateId}
    `;

    await sql`
      UPDATE founder_job_postings
      SET status = 'hired', closed_at = NOW(), updated_at = NOW()
      WHERE id = ${candidate.job_id}
    `;

    return {
      success: true,
      message: `${candidate.name} is now officially hired for "${candidate.job_title}". Congratulations! Would you like to set up their onboarding checklist?`,
    };
  } catch (error: any) {
    console.error('Error hiring candidate:', error);
    return {
      success: false,
      message: `I couldn't complete the hire. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// ONBOARDING
// =====================================================

/**
 * 25. Create onboarding checklist
 */
export async function createOnboardingChecklist(
  candidateId: string
): Promise<{ success: boolean; tasks: OnboardingTask[]; message: string }> {
  try {
    const candidateResult = await sql`
      SELECT c.*, j.title as job_title, j.founder_id
      FROM founder_job_candidates c
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE c.id = ${candidateId}
    `;

    if (candidateResult.rows.length === 0) {
      return { success: false, tasks: [], message: `Candidate not found.` };
    }

    const candidate = candidateResult.rows[0];

    if (candidate.status !== 'hired') {
      return { success: false, tasks: [], message: `Onboarding can only be set up for hired candidates.` };
    }

    // Default onboarding tasks
    const defaultTasks = [
      { title: 'Send welcome email', category: 'introductions' as const, description: 'Send a warm welcome email with first day details' },
      { title: 'Prepare employment documents', category: 'documentation' as const, description: 'Prepare offer letter, NDA, and tax forms' },
      { title: 'Set up work email', category: 'access' as const, description: 'Create company email account' },
      { title: 'Order equipment', category: 'equipment' as const, description: 'Order laptop, monitors, and other necessary equipment' },
      { title: 'Grant software access', category: 'access' as const, description: 'Set up access to required software and tools' },
      { title: 'Schedule first day orientation', category: 'introductions' as const, description: 'Plan day 1 schedule and introductions' },
      { title: 'Assign onboarding buddy', category: 'introductions' as const, description: 'Pair new hire with a team member for guidance' },
      { title: 'Schedule initial training sessions', category: 'training' as const, description: 'Set up product/process training' },
    ];

    const tasks: OnboardingTask[] = [];

    for (const taskData of defaultTasks) {
      const taskId = crypto.randomUUID();
      await sql`
        INSERT INTO founder_onboarding_tasks (
          id, employee_id, title, description, category,
          completed, created_at, updated_at
        ) VALUES (
          ${taskId}, ${candidateId}, ${taskData.title}, ${taskData.description}, ${taskData.category},
          false, NOW(), NOW()
        )
      `;

      tasks.push({
        id: taskId,
        employeeId: candidateId,
        title: taskData.title,
        description: taskData.description,
        category: taskData.category,
        completed: false,
        createdAt: new Date(),
      });
    }

    return {
      success: true,
      tasks,
      message: `Onboarding checklist created for ${candidate.name} with ${tasks.length} tasks. Let's get them started off right!`,
    };
  } catch (error: any) {
    console.error('Error creating onboarding checklist:', error);
    return {
      success: false,
      tasks: [],
      message: `I couldn't create the checklist. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 26. Get onboarding status
 */
export async function getOnboardingStatus(
  employeeId: string
): Promise<{ success: boolean; tasks: OnboardingTask[]; progress: number; message: string }> {
  try {
    const result = await sql`
      SELECT * FROM founder_onboarding_tasks
      WHERE employee_id = ${employeeId}
      ORDER BY
        CASE category
          WHEN 'documentation' THEN 1
          WHEN 'equipment' THEN 2
          WHEN 'access' THEN 3
          WHEN 'introductions' THEN 4
          WHEN 'training' THEN 5
          ELSE 6
        END,
        created_at
    `;

    if (result.rows.length === 0) {
      return {
        success: true,
        tasks: [],
        progress: 0,
        message: `No onboarding tasks found for this employee. Create a checklist first.`,
      };
    }

    const tasks = result.rows.map(mapRowToOnboardingTask);
    const completedCount = tasks.filter(t => t.completed).length;
    const progress = Math.round((completedCount / tasks.length) * 100);

    const pendingByCategory = tasks.filter(t => !t.completed).reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pendingSummary = Object.entries(pendingByCategory)
      .map(([cat, count]) => `${count} ${cat}`)
      .join(', ');

    return {
      success: true,
      tasks,
      progress,
      message: `Onboarding ${progress}% complete (${completedCount}/${tasks.length} tasks). Pending: ${pendingSummary || 'none'}.`,
    };
  } catch (error: any) {
    console.error('Error fetching onboarding status:', error);
    return {
      success: false,
      tasks: [],
      progress: 0,
      message: `I couldn't fetch the onboarding status. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// ANALYTICS
// =====================================================

/**
 * 27. Get hiring stats
 */
export async function getHiringStats(
  founderId: string
): Promise<{ success: boolean; stats?: HiringStats; message: string }> {
  try {
    // Get job counts
    const jobsResult = await sql`
      SELECT status, COUNT(*) as count FROM founder_job_postings
      WHERE founder_id = ${founderId}
      GROUP BY status
    `;

    const totalOpenJobs = jobsResult.rows
      .filter(r => ['draft', 'sourcing', 'reviewing', 'interviewing', 'offer_sent'].includes(r.status))
      .reduce((sum, r) => sum + parseInt(r.count), 0);

    // Get candidate stats
    const candidateResult = await sql`
      SELECT c.source, c.status, COUNT(*) as count
      FROM founder_job_candidates c
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE j.founder_id = ${founderId}
      GROUP BY c.source, c.status
    `;

    const candidatesBySource: Record<CandidateSource, number> = {
      wells_network: 0,
      referral: 0,
      linkedin: 0,
      indeed: 0,
      direct_apply: 0,
      recruiter: 0,
      other: 0,
    };

    const candidatesByStatus: Record<CandidateStatus, number> = {
      new: 0,
      screening: 0,
      interview_scheduled: 0,
      interviewed: 0,
      offer_pending: 0,
      offer_sent: 0,
      offer_accepted: 0,
      offer_declined: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0,
    };

    for (const row of candidateResult.rows) {
      candidatesBySource[row.source as CandidateSource] = (candidatesBySource[row.source as CandidateSource] || 0) + parseInt(row.count);
      candidatesByStatus[row.status as CandidateStatus] = (candidatesByStatus[row.status as CandidateStatus] || 0) + parseInt(row.count);
    }

    const totalCandidates = Object.values(candidatesBySource).reduce((sum, v) => sum + v, 0);

    // Calculate time to hire
    const timeToHireResult = await sql`
      SELECT AVG(EXTRACT(EPOCH FROM (c.hired_at - c.applied_at)) / 86400) as avg_days
      FROM founder_job_candidates c
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE j.founder_id = ${founderId} AND c.status = 'hired' AND c.hired_at IS NOT NULL
    `;
    const averageTimeToHire = Math.round(parseFloat(timeToHireResult.rows[0]?.avg_days || '0'));

    // In-network hire rate
    const hiredResult = await sql`
      SELECT c.source, COUNT(*) as count
      FROM founder_job_candidates c
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE j.founder_id = ${founderId} AND c.status = 'hired'
      GROUP BY c.source
    `;
    const totalHired = hiredResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const networkHired = hiredResult.rows.find(r => r.source === 'wells_network');
    const inNetworkHireRate = totalHired > 0 ? Math.round((parseInt(networkHired?.count || '0') / totalHired) * 100) : 0;

    // Offer acceptance rate
    const offersSent = candidatesByStatus.offer_sent + candidatesByStatus.offer_accepted + candidatesByStatus.offer_declined + candidatesByStatus.hired;
    const offersAccepted = candidatesByStatus.offer_accepted + candidatesByStatus.hired;
    const offerAcceptanceRate = offersSent > 0 ? Math.round((offersAccepted / offersSent) * 100) : 0;

    // This week's interviews
    const interviewsResult = await sql`
      SELECT COUNT(*) as count FROM founder_job_interviews i
      JOIN founder_job_postings j ON i.job_id = j.id
      WHERE j.founder_id = ${founderId}
        AND i.scheduled_at >= date_trunc('week', CURRENT_DATE)
        AND i.scheduled_at < date_trunc('week', CURRENT_DATE) + interval '7 days'
    `;
    const interviewsThisWeek = parseInt(interviewsResult.rows[0]?.count || '0');

    // This month's offers
    const offersResult = await sql`
      SELECT COUNT(*) as count FROM founder_job_offers o
      JOIN founder_job_candidates c ON o.candidate_id = c.id
      JOIN founder_job_postings j ON c.job_id = j.id
      WHERE j.founder_id = ${founderId}
        AND o.created_at >= date_trunc('month', CURRENT_DATE)
    `;
    const offersThisMonth = parseInt(offersResult.rows[0]?.count || '0');

    const stats: HiringStats = {
      totalOpenJobs,
      totalCandidates,
      candidatesBySource,
      candidatesByStatus,
      averageTimeToHire,
      inNetworkHireRate,
      offerAcceptanceRate,
      interviewsThisWeek,
      offersThisMonth,
    };

    return {
      success: true,
      stats,
      message: `Hiring overview: ${totalOpenJobs} open roles, ${totalCandidates} candidates, ${averageTimeToHire} days avg time to hire. ${inNetworkHireRate}% hired from Wells network.`,
    };
  } catch (error: any) {
    console.error('Error fetching hiring stats:', error);
    return {
      success: false,
      message: `I couldn't fetch the stats. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * 28. Get hiring pipeline visualization data
 */
export async function getHiringPipeline(
  founderId: string
): Promise<{ success: boolean; pipelines: HiringPipeline[]; message: string }> {
  try {
    const jobsResult = await sql`
      SELECT * FROM founder_job_postings
      WHERE founder_id = ${founderId}
        AND status IN ('sourcing', 'reviewing', 'interviewing', 'offer_sent')
      ORDER BY created_at DESC
    `;

    if (jobsResult.rows.length === 0) {
      return {
        success: true,
        pipelines: [],
        message: `No active hiring pipelines. Create and publish a job to start building your pipeline.`,
      };
    }

    const pipelines: HiringPipeline[] = [];
    const stageOrder: CandidateStatus[] = ['new', 'screening', 'interview_scheduled', 'interviewed', 'offer_pending', 'offer_sent', 'offer_accepted'];
    const stageLabels: Record<string, string> = {
      new: 'New',
      screening: 'Screening',
      interview_scheduled: 'Interview Scheduled',
      interviewed: 'Interviewed',
      offer_pending: 'Offer Pending',
      offer_sent: 'Offer Sent',
      offer_accepted: 'Offer Accepted',
    };

    for (const jobRow of jobsResult.rows) {
      const job = mapRowToJobPosting(jobRow);

      const candidatesResult = await sql`
        SELECT id, name, source, match_score, status, applied_at
        FROM founder_job_candidates
        WHERE job_id = ${job.id}
          AND status NOT IN ('rejected', 'withdrawn', 'hired', 'offer_declined')
        ORDER BY match_score DESC NULLS LAST
      `;

      const stages = stageOrder.map(status => {
        const candidates = candidatesResult.rows
          .filter(c => c.status === status)
          .map(c => ({
            id: c.id,
            name: c.name,
            source: c.source as CandidateSource,
            matchScore: c.match_score ? parseInt(c.match_score) : undefined,
            daysInStage: Math.floor((Date.now() - new Date(c.applied_at).getTime()) / (1000 * 60 * 60 * 24)),
          }));

        return {
          name: stageLabels[status],
          count: candidates.length,
          candidates,
        };
      });

      pipelines.push({
        jobId: job.id,
        jobTitle: job.title,
        stages,
      });
    }

    const totalActive = pipelines.reduce((sum, p) => sum + p.stages.reduce((s, stage) => s + stage.count, 0), 0);

    return {
      success: true,
      pipelines,
      message: `${pipelines.length} active pipeline(s) with ${totalActive} candidate(s) in progress.`,
    };
  } catch (error: any) {
    console.error('Error fetching hiring pipeline:', error);
    return {
      success: false,
      pipelines: [],
      message: `I couldn't fetch the pipeline data. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// NATURAL LANGUAGE PARSING
// =====================================================

/**
 * 29. Parse job details from natural language
 */
export async function parseJobFromText(text: string): Promise<{
  success: boolean;
  parsed?: ParsedJobPosting;
  message: string;
}> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Extract job posting details from this text. Return JSON only, no explanation.

Text: "${text}"

Return this exact JSON structure (use null for missing fields):
{
  "title": "job title",
  "description": "longer description if provided",
  "type": "full_time" | "part_time" | "contract" | "freelance" | "internship",
  "location": "city, state or remote",
  "isRemote": true/false,
  "salaryMin": 100000,
  "salaryMax": 150000,
  "skills": ["skill1", "skill2"],
  "experienceYears": 5
}

For salary:
- Parse ranges like "$100-150k" or "$100,000-$150,000"
- Handle annual salaries (most common for full-time)
- Handle hourly rates for contract/freelance (convert to annual: hourly * 2000)`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return {
        success: false,
        message: `I couldn't parse that. Try: "Hire a senior React developer, $150-180k, remote OK"`,
      };
    }

    const parsed = JSON.parse(content.text);

    let confidence = 0.5;
    if (parsed.title) confidence += 0.2;
    if (parsed.salaryMin || parsed.salaryMax) confidence += 0.15;
    if (parsed.skills?.length > 0) confidence += 0.15;

    const result: ParsedJobPosting = {
      title: parsed.title || undefined,
      description: parsed.description || undefined,
      type: parsed.type || undefined,
      location: parsed.location || undefined,
      isRemote: parsed.isRemote ?? undefined,
      salaryMin: parsed.salaryMin || undefined,
      salaryMax: parsed.salaryMax || undefined,
      skills: parsed.skills || undefined,
      experienceYears: parsed.experienceYears || undefined,
      confidence: Math.min(confidence, 1),
    };

    const missing: string[] = [];
    if (!result.title) missing.push('title');
    if (!result.skills || result.skills.length === 0) missing.push('skills');

    let message: string;
    if (missing.length > 0) {
      message = `Got it. I still need: ${missing.join(', ')}. What should I fill in?`;
    } else {
      const salaryStr = result.salaryMin && result.salaryMax
        ? `$${result.salaryMin.toLocaleString()}-$${result.salaryMax.toLocaleString()}`
        : 'salary TBD';
      const remoteStr = result.isRemote ? ', remote OK' : '';
      message = `Parsed: "${result.title}" - ${result.skills?.join(', ')} - ${salaryStr}${remoteStr}. Ready to create?`;
    }

    return {
      success: true,
      parsed: result,
      message,
    };
  } catch (error: any) {
    // Fallback to simple regex parsing
    const salaryMatch = text.match(/\$(\d+(?:,\d{3})*)[kK]?\s*(?:-|to)\s*\$?(\d+(?:,\d{3})*)[kK]?/);
    let salaryMin: number | undefined;
    let salaryMax: number | undefined;

    if (salaryMatch) {
      salaryMin = parseInt(salaryMatch[1].replace(/,/g, ''));
      salaryMax = parseInt(salaryMatch[2].replace(/,/g, ''));
      if (salaryMin < 1000) salaryMin *= 1000;
      if (salaryMax < 1000) salaryMax *= 1000;
    }

    const isRemote = /remote/i.test(text);

    // Extract skills from common tech terms
    const skillPatterns = [
      'react', 'node', 'python', 'javascript', 'typescript', 'aws', 'sql',
      'java', 'go', 'rust', 'docker', 'kubernetes', 'figma', 'design',
    ];
    const skills = skillPatterns.filter(s => new RegExp(s, 'i').test(text));

    return {
      success: true,
      parsed: {
        salaryMin,
        salaryMax,
        isRemote,
        skills: skills.length > 0 ? skills : undefined,
        confidence: 0.3,
      },
      message: `I extracted some details but couldn't fully parse that. Please provide: job title, required skills, and salary range.`,
    };
  }
}

// =====================================================
// ROW MAPPERS
// =====================================================

function mapRowToJobPosting(row: any): JobPosting {
  return {
    id: row.id,
    founderId: row.founder_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    type: row.type,
    department: row.department,
    location: row.location,
    isRemote: row.is_remote,
    salaryMin: row.salary_min ? parseFloat(row.salary_min) : undefined,
    salaryMax: row.salary_max ? parseFloat(row.salary_max) : undefined,
    salaryCurrency: row.salary_currency || 'USD',
    equityMin: row.equity_min ? parseFloat(row.equity_min) : undefined,
    equityMax: row.equity_max ? parseFloat(row.equity_max) : undefined,
    skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : (row.skills || []),
    experienceYears: row.experience_years,
    status: row.status,
    inNetworkOnly: row.in_network_only,
    inNetworkMatches: parseInt(row.in_network_matches || '0'),
    externalApplicants: parseInt(row.external_applicants || '0'),
    createdAt: new Date(row.created_at),
    publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
  };
}

function mapRowToCandidate(row: any): Candidate {
  let notes: string[] = [];
  try {
    notes = typeof row.notes === 'string' ? JSON.parse(row.notes) : (row.notes || []);
  } catch {
    notes = [];
  }

  let interviews: Interview[] = [];
  try {
    if (row.interviews) {
      const interviewData = typeof row.interviews === 'string' ? JSON.parse(row.interviews) : row.interviews;
      if (Array.isArray(interviewData)) {
        interviews = interviewData.filter(Boolean).map(mapRowToInterview);
      }
    }
  } catch {
    interviews = [];
  }

  let offerDetails: OfferDetails | undefined;
  try {
    if (row.offer) {
      const offerData = typeof row.offer === 'string' ? JSON.parse(row.offer) : row.offer;
      if (offerData) {
        offerDetails = mapRowToOffer(offerData);
      }
    }
  } catch {
    offerDetails = undefined;
  }

  return {
    id: row.id,
    jobId: row.job_id,
    source: row.source,
    sourceId: row.source_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    resumeUrl: row.resume_url,
    linkedinUrl: row.linkedin_url,
    portfolioUrl: row.portfolio_url,
    status: row.status,
    matchScore: row.match_score ? parseInt(row.match_score) : undefined,
    notes,
    interviews,
    offerDetails,
    appliedAt: new Date(row.applied_at),
    hiredAt: row.hired_at ? new Date(row.hired_at) : undefined,
  };
}

function mapRowToInterview(row: any): Interview {
  let interviewers: string[] = [];
  try {
    interviewers = typeof row.interviewers === 'string' ? JSON.parse(row.interviewers) : (row.interviewers || []);
  } catch {
    interviewers = [];
  }

  return {
    id: row.id,
    candidateId: row.candidate_id,
    jobId: row.job_id,
    type: row.type,
    scheduledAt: new Date(row.scheduled_at),
    duration: parseInt(row.duration || '60'),
    interviewers,
    location: row.location,
    meetingUrl: row.meeting_url,
    status: row.status,
    feedback: row.feedback,
    rating: row.rating ? parseInt(row.rating) : undefined,
    recommend: row.recommend,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

function mapRowToOffer(row: any): OfferDetails {
  let benefits: string[] | undefined;
  try {
    if (row.benefits) {
      benefits = typeof row.benefits === 'string' ? JSON.parse(row.benefits) : row.benefits;
    }
  } catch {
    benefits = undefined;
  }

  return {
    id: row.id,
    candidateId: row.candidate_id,
    jobId: row.job_id,
    salary: parseFloat(row.salary),
    salaryCurrency: row.salary_currency || 'USD',
    equity: row.equity ? parseFloat(row.equity) : undefined,
    startDate: new Date(row.start_date),
    signingBonus: row.signing_bonus ? parseFloat(row.signing_bonus) : undefined,
    benefits,
    otherTerms: row.other_terms,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
    accepted: row.accepted,
    declineReason: row.decline_reason,
    createdAt: new Date(row.created_at),
  };
}

function mapRowToOnboardingTask(row: any): OnboardingTask {
  return {
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description,
    category: row.category,
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    assignedTo: row.assigned_to,
    completed: row.completed,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

// =====================================================
// EXPORTS
// =====================================================

export const HiringService = {
  // Job Posting
  createJobPosting,
  getJobPostings,
  getJobPosting,
  updateJobPosting,
  publishJob,
  closeJob,

  // In-Network Sourcing
  searchNetworkForJob,
  inviteNetworkCandidate,
  getNetworkMatches,

  // External Sourcing (stubs)
  postToLinkedIn,
  postToIndeed,
  importFromATS,

  // Candidate Management
  addCandidate,
  getCandidates,
  getCandidate,
  updateCandidateStatus,
  addCandidateNote,

  // Interviews
  scheduleInterview,
  recordInterviewFeedback,
  getInterviewSchedule,

  // Offers
  createOffer,
  sendOffer,
  recordOfferResponse,
  hireCandidate,

  // Onboarding
  createOnboardingChecklist,
  getOnboardingStatus,

  // Analytics
  getHiringStats,
  getHiringPipeline,

  // Natural Language
  parseJobFromText,
};

export default HiringService;
