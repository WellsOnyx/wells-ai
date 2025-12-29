/**
 * Candidate AI Agent - Wells Represents Job Seekers
 *
 * This agent acts on behalf of candidates to:
 * - Match to relevant job postings based on preferences
 * - Apply on behalf of candidates (with approval or auto-mode)
 * - Track application status
 * - Negotiate offers based on candidate constraints
 *
 * Everything is conversational. Job seekers talk to Wells, Wells handles everything.
 */

import { query } from '@/lib/db';
import {
  getJobPostings,
  submitApplication,
  getCandidateApplications,
  createCandidate,
  type MergeJobPosting,
  type CandidateApplication,
} from '@/lib/hris/merge-hris-client';

// ============================================================================
// TYPES
// ============================================================================

export interface CandidateConstraints {
  minSalary: number;
  targetSalary: number;
  maxSalary?: number;
  locations: string[];
  remotePreference: 'remote_only' | 'hybrid' | 'onsite' | 'flexible';
  requiredBenefits?: string[];
  preferredBenefits?: string[];
  industries?: string[];
  companySizes?: ('startup' | 'small' | 'medium' | 'large' | 'enterprise')[];
  excludeCompanies?: string[];
  mustHaveEquity?: boolean;
  minEquityPercent?: number;
  visaSponsorship?: boolean;
  relocationAssistance?: boolean;
  startDateFlexibility?: 'immediate' | '2_weeks' | '1_month' | '2_months' | 'flexible';
}

export interface CandidateProfile {
  id: string;
  userId: string;
  workerProfileId: string;

  // Personal
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;

  // Resume
  resumeUrl?: string;
  resumeText?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;

  // Skills & Experience
  skills: string[];
  yearsExperience: number;
  currentTitle?: string;
  currentCompany?: string;
  desiredTitles: string[];

  // Preferences
  constraints: CandidateConstraints;

  // Agent settings
  autoApplyEnabled: boolean;
  autoApplyThreshold: number; // Match score 0-100
  notifyOnNewMatches: boolean;
  weeklyDigest: boolean;

  // Stats
  totalApplications: number;
  activeApplications: number;
  offersReceived: number;
  placementsCompleted: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface JobMatch {
  job: MergeJobPosting;
  matchScore: number;
  matchReasons: string[];
  concerns: string[];
  salaryMatch: 'below_target' | 'at_target' | 'above_target' | 'unknown';
  locationMatch: boolean;
  skillMatch: number; // 0-100
  recommendation: 'strong_apply' | 'apply' | 'maybe' | 'skip';
}

export interface ApplyResult {
  success: boolean;
  message: string;
  applicationId?: string;
  jobTitle?: string;
  employerName?: string;
}

export interface BulkApplyResult {
  success: boolean;
  message: string;
  applied: number;
  skipped: number;
  errors: number;
  applications: ApplyResult[];
}

// ============================================================================
// CANDIDATE PROFILE MANAGEMENT
// ============================================================================

/**
 * Create or update candidate profile
 */
export async function saveCandidateProfile(
  userId: string,
  profile: Partial<CandidateProfile>
): Promise<{
  success: boolean;
  message: string;
  profile?: CandidateProfile;
}> {
  try {
    const profileId = `cprofile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await query(
      `INSERT INTO candidate_profiles (
        id, user_id, worker_profile_id,
        first_name, last_name, email, phone,
        resume_url, resume_text, linkedin_url, portfolio_url,
        skills, years_experience, current_title, current_company, desired_titles,
        constraints, auto_apply_enabled, auto_apply_threshold,
        notify_on_new_matches, weekly_digest
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (user_id) DO UPDATE SET
        worker_profile_id = COALESCE(EXCLUDED.worker_profile_id, candidate_profiles.worker_profile_id),
        first_name = COALESCE(EXCLUDED.first_name, candidate_profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, candidate_profiles.last_name),
        email = COALESCE(EXCLUDED.email, candidate_profiles.email),
        phone = COALESCE(EXCLUDED.phone, candidate_profiles.phone),
        resume_url = COALESCE(EXCLUDED.resume_url, candidate_profiles.resume_url),
        resume_text = COALESCE(EXCLUDED.resume_text, candidate_profiles.resume_text),
        linkedin_url = COALESCE(EXCLUDED.linkedin_url, candidate_profiles.linkedin_url),
        portfolio_url = COALESCE(EXCLUDED.portfolio_url, candidate_profiles.portfolio_url),
        skills = COALESCE(EXCLUDED.skills, candidate_profiles.skills),
        years_experience = COALESCE(EXCLUDED.years_experience, candidate_profiles.years_experience),
        current_title = COALESCE(EXCLUDED.current_title, candidate_profiles.current_title),
        current_company = COALESCE(EXCLUDED.current_company, candidate_profiles.current_company),
        desired_titles = COALESCE(EXCLUDED.desired_titles, candidate_profiles.desired_titles),
        constraints = COALESCE(EXCLUDED.constraints, candidate_profiles.constraints),
        auto_apply_enabled = COALESCE(EXCLUDED.auto_apply_enabled, candidate_profiles.auto_apply_enabled),
        auto_apply_threshold = COALESCE(EXCLUDED.auto_apply_threshold, candidate_profiles.auto_apply_threshold),
        notify_on_new_matches = COALESCE(EXCLUDED.notify_on_new_matches, candidate_profiles.notify_on_new_matches),
        weekly_digest = COALESCE(EXCLUDED.weekly_digest, candidate_profiles.weekly_digest),
        updated_at = NOW()
      RETURNING *`,
      [
        profileId,
        userId,
        profile.workerProfileId,
        profile.firstName,
        profile.lastName,
        profile.email,
        profile.phone,
        profile.resumeUrl,
        profile.resumeText,
        profile.linkedinUrl,
        profile.portfolioUrl,
        profile.skills || [],
        profile.yearsExperience,
        profile.currentTitle,
        profile.currentCompany,
        profile.desiredTitles || [],
        profile.constraints ? JSON.stringify(profile.constraints) : null,
        profile.autoApplyEnabled ?? true,
        profile.autoApplyThreshold ?? 80,
        profile.notifyOnNewMatches ?? true,
        profile.weeklyDigest ?? true,
      ]
    );

    const savedProfile = mapRowToCandidateProfile(result.rows[0]);

    return {
      success: true,
      message: `Got it! I've saved your profile. ${profile.constraints ? `Looking for roles paying $${profile.constraints.minSalary?.toLocaleString()}+${profile.constraints.locations?.length ? ` in ${profile.constraints.locations.join(', ')}` : ''}.` : 'Tell me your salary expectations and location preferences so I can find the best matches.'}`,
      profile: savedProfile,
    };
  } catch (error) {
    console.error('Error saving candidate profile:', error);
    return {
      success: false,
      message: "I had trouble saving your profile. Let me try again.",
    };
  }
}

/**
 * Get candidate profile by user ID
 */
export async function getCandidateProfile(userId: string): Promise<{
  success: boolean;
  message: string;
  profile?: CandidateProfile;
}> {
  try {
    const result = await query(
      `SELECT * FROM candidate_profiles WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        message: "I don't have your job seeker profile yet. Tell me what kind of role you're looking for - title, salary expectations, and where you want to work.",
      };
    }

    const profile = mapRowToCandidateProfile(result.rows[0]);

    // Get application stats
    const statsResult = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status NOT IN ('rejected', 'withdrawn', 'hired')) as active,
        COUNT(*) FILTER (WHERE status IN ('offer', 'offer_accepted')) as offers
       FROM hris_applications a
       JOIN hris_candidates c ON a.candidate_id = c.id
       WHERE c.user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0] || {};
    profile.totalApplications = parseInt(stats.total) || 0;
    profile.activeApplications = parseInt(stats.active) || 0;
    profile.offersReceived = parseInt(stats.offers) || 0;

    return {
      success: true,
      message: `Found your profile! You're looking for ${profile.desiredTitles?.join(' or ') || 'roles'} at $${profile.constraints?.minSalary?.toLocaleString() || 'negotiable'}+. You have ${profile.activeApplications} active applications.`,
      profile,
    };
  } catch (error) {
    console.error('Error fetching candidate profile:', error);
    return {
      success: false,
      message: "I had trouble loading your profile.",
    };
  }
}

/**
 * Update candidate constraints
 */
export async function updateConstraints(
  userId: string,
  constraints: Partial<CandidateConstraints>
): Promise<{
  success: boolean;
  message: string;
  constraints?: CandidateConstraints;
}> {
  try {
    // Get existing constraints
    const existing = await query(
      `SELECT constraints FROM candidate_profiles WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      return {
        success: false,
        message: "I need to set up your profile first. Tell me about yourself - what's your current role and what are you looking for?",
      };
    }

    const existingConstraints = existing.rows[0].constraints || {};
    const mergedConstraints = { ...existingConstraints, ...constraints };

    await query(
      `UPDATE candidate_profiles SET constraints = $1, updated_at = NOW() WHERE user_id = $2`,
      [JSON.stringify(mergedConstraints), userId]
    );

    // Build conversational response
    const updates: string[] = [];
    if (constraints.minSalary) updates.push(`minimum salary to $${constraints.minSalary.toLocaleString()}`);
    if (constraints.targetSalary) updates.push(`target salary to $${constraints.targetSalary.toLocaleString()}`);
    if (constraints.locations) updates.push(`locations to ${constraints.locations.join(', ')}`);
    if (constraints.remotePreference) updates.push(`work style to ${constraints.remotePreference.replace('_', ' ')}`);
    if (constraints.excludeCompanies) updates.push(`excluded ${constraints.excludeCompanies.length} companies`);

    return {
      success: true,
      message: `Updated your preferences: ${updates.join(', ')}. I'll adjust my search accordingly.`,
      constraints: mergedConstraints as CandidateConstraints,
    };
  } catch (error) {
    console.error('Error updating constraints:', error);
    return {
      success: false,
      message: "I couldn't update your preferences.",
    };
  }
}

// ============================================================================
// JOB MATCHING
// ============================================================================

/**
 * Find matching jobs for a candidate
 */
export async function findMatchingJobs(
  userId: string,
  options?: {
    limit?: number;
    includeApplied?: boolean;
    minMatchScore?: number;
  }
): Promise<{
  success: boolean;
  message: string;
  matches: JobMatch[];
  totalMatches: number;
}> {
  try {
    // Get candidate profile
    const profileResult = await getCandidateProfile(userId);
    if (!profileResult.success || !profileResult.profile) {
      return {
        success: false,
        message: profileResult.message,
        matches: [],
        totalMatches: 0,
      };
    }

    const profile = profileResult.profile;
    const constraints = profile.constraints;

    // Get already applied job IDs
    const appliedResult = await query(
      `SELECT j.id FROM hris_job_postings j
       JOIN hris_applications a ON a.job_posting_id = j.id
       JOIN hris_candidates c ON a.candidate_id = c.id
       WHERE c.user_id = $1`,
      [userId]
    );
    const appliedJobIds = new Set(appliedResult.rows.map(r => r.id));

    // Search for jobs
    const jobsResult = await getJobPostings({
      status: 'open',
      search: profile.desiredTitles?.join(' OR '),
      skills: profile.skills,
      salaryMin: constraints?.minSalary,
      locationType: constraints?.remotePreference === 'remote_only' ? 'remote' : undefined,
      limit: 100,
    });

    if (!jobsResult.success) {
      return {
        success: false,
        message: jobsResult.message,
        matches: [],
        totalMatches: 0,
      };
    }

    // Score and filter jobs
    const matches: JobMatch[] = [];
    const minScore = options?.minMatchScore ?? 50;

    for (const job of jobsResult.jobs) {
      // Skip already applied unless requested
      if (!options?.includeApplied && appliedJobIds.has(job.id)) {
        continue;
      }

      // Skip excluded companies
      if (constraints?.excludeCompanies?.some(
        c => job.employerName.toLowerCase().includes(c.toLowerCase())
      )) {
        continue;
      }

      const match = scoreJobMatch(job, profile);

      if (match.matchScore >= minScore) {
        matches.push(match);
      }
    }

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Limit results
    const limitedMatches = matches.slice(0, options?.limit || 20);

    // Generate message
    let message = '';
    if (matches.length === 0) {
      message = "I couldn't find any jobs matching your criteria right now. I'll keep checking and notify you when new roles appear.";
    } else {
      const strongMatches = matches.filter(m => m.recommendation === 'strong_apply').length;
      message = `Found ${matches.length} matching roles! ${strongMatches} are strong matches. `;

      if (limitedMatches.length > 0) {
        const top = limitedMatches[0];
        message += `Top match: ${top.job.title} at ${top.job.employerName} (${top.matchScore}% match)`;
        if (top.job.salary) {
          message += ` - $${top.job.salary.min?.toLocaleString()}-$${top.job.salary.max?.toLocaleString()}`;
        }
        message += `. Should I apply?`;
      }
    }

    return {
      success: true,
      message,
      matches: limitedMatches,
      totalMatches: matches.length,
    };
  } catch (error) {
    console.error('Error finding matching jobs:', error);
    return {
      success: false,
      message: "I had trouble searching for jobs. Let me try again.",
      matches: [],
      totalMatches: 0,
    };
  }
}

/**
 * Score how well a job matches a candidate
 */
function scoreJobMatch(job: MergeJobPosting, profile: CandidateProfile): JobMatch {
  const constraints = profile.constraints || {};
  let score = 0;
  const reasons: string[] = [];
  const concerns: string[] = [];

  // Title match (25 points)
  const jobTitleLower = job.title.toLowerCase();
  const titleMatch = profile.desiredTitles?.some(t =>
    jobTitleLower.includes(t.toLowerCase()) || t.toLowerCase().includes(jobTitleLower.split(' ')[0])
  );
  if (titleMatch) {
    score += 25;
    reasons.push('Title matches your target roles');
  } else {
    score += 10; // Partial credit for being in results
  }

  // Skill match (30 points)
  const jobSkills = (job.skills || []).map(s => s.toLowerCase());
  const candidateSkills = profile.skills.map(s => s.toLowerCase());
  const matchingSkills = candidateSkills.filter(s => jobSkills.some(js => js.includes(s) || s.includes(js)));
  const skillMatchPercent = jobSkills.length > 0
    ? (matchingSkills.length / jobSkills.length) * 100
    : (matchingSkills.length > 0 ? 70 : 50);
  score += (skillMatchPercent / 100) * 30;
  if (matchingSkills.length > 0) {
    reasons.push(`${matchingSkills.length} skill${matchingSkills.length > 1 ? 's' : ''} match`);
  }
  const missingSkills = jobSkills.filter(s => !candidateSkills.some(cs => cs.includes(s)));
  if (missingSkills.length > 2) {
    concerns.push(`Missing skills: ${missingSkills.slice(0, 3).join(', ')}`);
  }

  // Salary match (25 points)
  let salaryMatch: JobMatch['salaryMatch'] = 'unknown';
  if (job.salary?.max && constraints.minSalary) {
    if (job.salary.max < constraints.minSalary) {
      salaryMatch = 'below_target';
      score += 5;
      concerns.push(`Max salary ($${job.salary.max.toLocaleString()}) below your minimum`);
    } else if (job.salary.min && job.salary.min >= constraints.targetSalary) {
      salaryMatch = 'above_target';
      score += 25;
      reasons.push('Salary above your target!');
    } else {
      salaryMatch = 'at_target';
      score += 20;
      reasons.push('Salary in your range');
    }
  } else {
    score += 15; // Unknown, give benefit of doubt
  }

  // Location match (15 points)
  let locationMatch = false;
  if (constraints.remotePreference === 'remote_only') {
    if (job.locationType === 'remote') {
      locationMatch = true;
      score += 15;
      reasons.push('Remote position');
    } else if (job.locationType === 'hybrid') {
      score += 8;
      concerns.push('Hybrid (you prefer remote)');
    } else {
      concerns.push('On-site only');
    }
  } else if (constraints.locations?.length > 0) {
    const jobLocation = (job.location || '').toLowerCase();
    const offices = job.offices.map(o => o.toLowerCase());
    locationMatch = constraints.locations.some(l => {
      const loc = l.toLowerCase();
      return jobLocation.includes(loc) || offices.some(o => o.includes(loc));
    });
    if (locationMatch) {
      score += 15;
      reasons.push('Location matches');
    } else if (job.locationType === 'remote') {
      score += 12;
      reasons.push('Remote option available');
    }
  } else {
    score += 10; // No location preference
    locationMatch = true;
  }

  // Company/industry factors (5 points)
  score += 5; // Base points

  // Determine recommendation
  let recommendation: JobMatch['recommendation'];
  if (score >= 80 && salaryMatch !== 'below_target') {
    recommendation = 'strong_apply';
  } else if (score >= 60) {
    recommendation = 'apply';
  } else if (score >= 40) {
    recommendation = 'maybe';
  } else {
    recommendation = 'skip';
  }

  return {
    job,
    matchScore: Math.round(score),
    matchReasons: reasons,
    concerns,
    salaryMatch,
    locationMatch,
    skillMatch: Math.round(skillMatchPercent),
    recommendation,
  };
}

// ============================================================================
// APPLICATION MANAGEMENT
// ============================================================================

/**
 * Apply to a single job
 */
export async function applyToJob(
  userId: string,
  jobId: string,
  options?: {
    coverLetter?: string;
    customMessage?: string;
  }
): Promise<ApplyResult> {
  try {
    // Get candidate profile
    const profileResult = await getCandidateProfile(userId);
    if (!profileResult.success || !profileResult.profile) {
      return {
        success: false,
        message: "I need your profile first. Tell me your name, email, and upload your resume.",
      };
    }

    const profile = profileResult.profile;

    // Get job details
    const jobResult = await query(
      `SELECT * FROM hris_job_postings WHERE id = $1`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return {
        success: false,
        message: "That job posting is no longer available.",
      };
    }

    const job = jobResult.rows[0];

    // Check if already applied
    const existingApp = await query(
      `SELECT a.id FROM hris_applications a
       JOIN hris_candidates c ON a.candidate_id = c.id
       WHERE c.user_id = $1 AND a.job_posting_id = $2`,
      [userId, jobId]
    );

    if (existingApp.rows.length > 0) {
      return {
        success: false,
        message: `You've already applied to ${job.title} at ${job.employer_name}.`,
        jobTitle: job.title,
        employerName: job.employer_name,
      };
    }

    // Ensure candidate exists in HRIS
    let candidateResult = await query(
      `SELECT id FROM hris_candidates WHERE user_id = $1 AND connection_id = $2`,
      [userId, job.connection_id]
    );

    if (candidateResult.rows.length === 0) {
      // Create candidate
      const createResult = await createCandidate(job.connection_id, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        resumeUrl: profile.resumeUrl,
        resumeText: profile.resumeText,
        workerProfileId: profile.workerProfileId,
        userId,
      });

      if (!createResult.success) {
        return {
          success: false,
          message: createResult.message,
        };
      }

      candidateResult = await query(
        `SELECT id FROM hris_candidates WHERE user_id = $1 AND connection_id = $2`,
        [userId, job.connection_id]
      );
    }

    const candidateId = candidateResult.rows[0].id;

    // Generate cover letter if not provided
    const coverLetter = options?.coverLetter ||
      generateCoverLetter(profile, job);

    // Submit application
    const appResult = await submitApplication(candidateId, jobId, coverLetter);

    if (appResult.success) {
      // Update stats
      await query(
        `UPDATE candidate_profiles SET total_applications = total_applications + 1 WHERE user_id = $1`,
        [userId]
      );
    }

    return {
      success: appResult.success,
      message: appResult.message,
      applicationId: appResult.applicationId,
      jobTitle: job.title,
      employerName: job.employer_name,
    };
  } catch (error) {
    console.error('Error applying to job:', error);
    return {
      success: false,
      message: "I had trouble submitting that application. Let me try again.",
    };
  }
}

/**
 * Apply to multiple jobs at once
 */
export async function bulkApply(
  userId: string,
  options: {
    jobIds?: string[];
    excludeEmployers?: string[];
    minMatchScore?: number;
    maxApplications?: number;
    autoApplyMatches?: boolean;
  }
): Promise<BulkApplyResult> {
  const results: ApplyResult[] = [];
  let applied = 0;
  let skipped = 0;
  let errors = 0;

  try {
    let jobIds = options.jobIds || [];

    // If no job IDs, find matches
    if (options.autoApplyMatches) {
      const matches = await findMatchingJobs(userId, {
        limit: options.maxApplications || 10,
        minMatchScore: options.minMatchScore || 70,
      });

      if (matches.success) {
        jobIds = matches.matches
          .filter(m => m.recommendation === 'strong_apply' || m.recommendation === 'apply')
          .map(m => m.job.id);
      }
    }

    // Filter out excluded employers
    if (options.excludeEmployers && options.excludeEmployers.length > 0) {
      const jobDetails = await query(
        `SELECT id, employer_name FROM hris_job_postings WHERE id = ANY($1)`,
        [jobIds]
      );

      const excludeLower = options.excludeEmployers.map(e => e.toLowerCase());
      jobIds = jobDetails.rows
        .filter(j => !excludeLower.some(e => j.employer_name.toLowerCase().includes(e)))
        .map(j => j.id);
    }

    // Apply to each job
    const maxApps = options.maxApplications || 20;
    for (const jobId of jobIds.slice(0, maxApps)) {
      const result = await applyToJob(userId, jobId);
      results.push(result);

      if (result.success) {
        applied++;
      } else if (result.message.includes('already applied')) {
        skipped++;
      } else {
        errors++;
      }
    }

    // Generate summary message
    let message = '';
    if (applied > 0) {
      message = `Applied to ${applied} role${applied > 1 ? 's' : ''}!`;
      if (applied > 0 && results.length > 0) {
        const employers = [...new Set(results.filter(r => r.success).map(r => r.employerName))];
        if (employers.length <= 3) {
          message += ` (${employers.join(', ')})`;
        }
      }
    }

    if (skipped > 0) {
      message += ` Skipped ${skipped} (already applied).`;
    }

    if (errors > 0) {
      message += ` ${errors} had issues - I'll retry those later.`;
    }

    if (applied === 0 && skipped === 0 && errors === 0) {
      message = "No jobs to apply to right now. I'll keep looking!";
    }

    return {
      success: applied > 0 || errors === 0,
      message,
      applied,
      skipped,
      errors,
      applications: results,
    };
  } catch (error) {
    console.error('Error in bulk apply:', error);
    return {
      success: false,
      message: "I had trouble with the bulk applications.",
      applied,
      skipped,
      errors,
      applications: results,
    };
  }
}

/**
 * Get application status summary
 */
export async function getApplicationStatus(userId: string): Promise<{
  success: boolean;
  message: string;
  summary: {
    total: number;
    active: number;
    interviewing: number;
    offers: number;
    rejected: number;
  };
  applications: Array<CandidateApplication & { job: MergeJobPosting }>;
}> {
  try {
    const result = await getCandidateApplications(userId);

    const summary = {
      total: result.applications.length,
      active: result.applications.filter(a =>
        !['rejected', 'withdrawn', 'hired'].includes(a.status)
      ).length,
      interviewing: result.applications.filter(a =>
        ['phone_screen', 'interview', 'final_interview'].includes(a.status)
      ).length,
      offers: result.applications.filter(a =>
        ['offer', 'offer_accepted'].includes(a.status)
      ).length,
      rejected: result.applications.filter(a => a.status === 'rejected').length,
    };

    let message = '';
    if (summary.offers > 0) {
      message = `You have ${summary.offers} offer${summary.offers > 1 ? 's' : ''} waiting! `;
    }
    if (summary.interviewing > 0) {
      message += `${summary.interviewing} interview${summary.interviewing > 1 ? 's' : ''} in progress. `;
    }
    if (summary.active > 0) {
      message += `${summary.active} application${summary.active > 1 ? 's' : ''} under review.`;
    }
    if (summary.total === 0) {
      message = "No applications yet. Tell me what role you're looking for and I'll start applying!";
    }

    return {
      success: true,
      message: message.trim(),
      summary,
      applications: result.applications,
    };
  } catch (error) {
    console.error('Error getting application status:', error);
    return {
      success: false,
      message: "I had trouble getting your application status.",
      summary: { total: 0, active: 0, interviewing: 0, offers: 0, rejected: 0 },
      applications: [],
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a personalized cover letter
 */
function generateCoverLetter(profile: CandidateProfile, job: Record<string, unknown>): string {
  const name = `${profile.firstName} ${profile.lastName}`;
  const title = job.title as string;
  const company = job.employer_name as string;
  const skills = profile.skills.slice(0, 5).join(', ');

  return `Dear Hiring Team,

I am excited to apply for the ${title} position at ${company}. With ${profile.yearsExperience || 'several'} years of experience${profile.currentTitle ? ` as a ${profile.currentTitle}` : ''}, I bring expertise in ${skills}.

${profile.currentCompany ? `Currently at ${profile.currentCompany}, I have developed strong skills that align well with this role.` : 'I am passionate about contributing my skills to a forward-thinking team.'}

I would welcome the opportunity to discuss how my background can contribute to ${company}'s success.

Best regards,
${name}`;
}

function mapRowToCandidateProfile(row: Record<string, unknown>): CandidateProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    workerProfileId: row.worker_profile_id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    phone: row.phone as string,
    resumeUrl: row.resume_url as string,
    resumeText: row.resume_text as string,
    linkedinUrl: row.linkedin_url as string,
    portfolioUrl: row.portfolio_url as string,
    skills: (row.skills as string[]) || [],
    yearsExperience: row.years_experience as number,
    currentTitle: row.current_title as string,
    currentCompany: row.current_company as string,
    desiredTitles: (row.desired_titles as string[]) || [],
    constraints: row.constraints as CandidateConstraints,
    autoApplyEnabled: row.auto_apply_enabled as boolean,
    autoApplyThreshold: row.auto_apply_threshold as number,
    notifyOnNewMatches: row.notify_on_new_matches as boolean,
    weeklyDigest: row.weekly_digest as boolean,
    totalApplications: row.total_applications as number || 0,
    activeApplications: row.active_applications as number || 0,
    offersReceived: row.offers_received as number || 0,
    placementsCompleted: row.placements_completed as number || 0,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ============================================================================
// PARSE NATURAL LANGUAGE
// ============================================================================

/**
 * Parse job preferences from natural language
 * Example: "I'm looking for a senior engineer role in Austin, $180K+"
 */
export function parseJobPreferences(text: string): {
  titles?: string[];
  locations?: string[];
  salary?: { min?: number; target?: number };
  remote?: boolean;
  excludeCompanies?: string[];
} {
  const result: ReturnType<typeof parseJobPreferences> = {};
  const lowerText = text.toLowerCase();

  // Parse titles
  const titlePatterns = [
    /(?:looking for|want|seeking|interested in)\s+(?:a\s+)?(.+?)\s+(?:role|position|job)/i,
    /(?:^|\s)((?:senior|lead|principal|staff|junior|entry)?\s*(?:software|front\s*-?\s*end|back\s*-?\s*end|full\s*-?\s*stack|mobile|data|machine learning|ml|ai|devops|cloud|platform|security|qa|test|product|project|program|ux|ui|design)\s*(?:engineer|developer|manager|analyst|scientist|architect|lead|director)?)/gi,
  ];

  for (const pattern of titlePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (!result.titles) result.titles = [];
      const title = match[1].trim();
      if (title.length > 3 && title.length < 50) {
        result.titles.push(title.charAt(0).toUpperCase() + title.slice(1));
      }
    }
  }

  // Parse locations
  const locationPatterns = [
    /(?:in|at|near|around)\s+([A-Z][a-z]+(?:\s*,?\s*[A-Z]{2})?)/g,
    /(?:based in|located in|living in)\s+(.+?)(?:\.|,|$)/i,
  ];

  for (const pattern of locationPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (!result.locations) result.locations = [];
      const loc = match[1].trim();
      if (loc.length > 2 && loc.length < 50 && !loc.match(/^\d/)) {
        result.locations.push(loc);
      }
    }
  }

  // Parse salary
  const salaryPatterns = [
    /\$(\d{2,3})k?\+/i,
    /(\d{3}),?(\d{3})\s*(?:or more|\+)/i,
    /(?:at least|minimum|min)\s*\$?(\d{2,3})k?/i,
    /\$?(\d{2,3})k?\s*-\s*\$?(\d{2,3})k?/i,
  ];

  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.salary = {};
      const num1 = parseInt(match[1]);
      const num2 = match[2] ? parseInt(match[2]) : undefined;

      if (num2) {
        // Range
        result.salary.min = num1 < 1000 ? num1 * 1000 : num1;
        result.salary.target = num2 < 1000 ? num2 * 1000 : num2;
      } else {
        // Single number
        result.salary.min = num1 < 1000 ? num1 * 1000 : num1;
        result.salary.target = Math.round(result.salary.min * 1.1);
      }
      break;
    }
  }

  // Parse remote preference
  if (lowerText.includes('remote only') || lowerText.includes('fully remote') || lowerText.includes('100% remote')) {
    result.remote = true;
  }

  // Parse excluded companies
  const excludePatterns = [
    /(?:not|except|but not|exclude|avoid|skip)\s+(?:at\s+)?(.+?)(?:\.|,|$)/gi,
  ];

  for (const pattern of excludePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (!result.excludeCompanies) result.excludeCompanies = [];
      const companies = match[1].split(/,|and/).map(c => c.trim()).filter(c => c.length > 1);
      result.excludeCompanies.push(...companies);
    }
  }

  return result;
}

export default {
  // Profile
  saveCandidateProfile,
  getCandidateProfile,
  updateConstraints,

  // Matching
  findMatchingJobs,

  // Applications
  applyToJob,
  bulkApply,
  getApplicationStatus,

  // Parsing
  parseJobPreferences,
};
