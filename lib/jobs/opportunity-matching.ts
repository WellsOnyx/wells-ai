/**
 * Opportunity Matching Engine - AI-Powered Job Discovery
 *
 * Advanced matching system that proactively finds opportunities:
 * - Score candidates against opportunities holistically
 * - Consider skills, experience, culture fit, and preferences
 * - Factor in candidate constraints (location, salary, remote)
 * - Proactively discover opportunities before candidates search
 * - Learn from feedback to improve matching
 *
 * "Commit your way to the Lord; trust in him and he will do this" - Psalm 37:5
 */

import Anthropic from '@anthropic-ai/sdk';
import { sqlQuery as sql } from '@/lib/db';
import { JobSeekerProfile, SkillProfile } from './job-seeker-agent';
import { JobOpening } from './employer-agent';
import { Skill, SkillsProfile, getSkillsEngine } from './skills-engine';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface MatchScore {
  overall: number; // 0-100
  components: {
    skills: number;
    experience: number;
    culture: number;
    compensation: number;
    logistics: number;
    growth: number;
  };
  confidence: 'high' | 'medium' | 'low';
}

export interface OpportunityMatch {
  id: string;
  job: JobOpening;
  score: MatchScore;
  matchReasons: string[];
  concerns: string[];
  highlights: string[];
  competitiveness: 'low' | 'moderate' | 'high' | 'very_high';
  estimatedOdds: string; // e.g., "High chance"
  suggestedApproach: string;
  applicationTips: string[];
  salaryInsight: {
    postedRange: string;
    yourTarget: number;
    marketRate: number;
    negotiationRoom: 'low' | 'medium' | 'high';
  };
  cultureFit: {
    score: number;
    strengths: string[];
    potentialChallenges: string[];
  };
  nextSteps: string[];
  discoveredAt: Date;
  expiresAt?: Date;
}

export interface MatchPreferences {
  // Work style
  workStyle: ('remote' | 'hybrid' | 'onsite')[];
  willingToRelocate: boolean;
  preferredLocations: string[];

  // Compensation
  minimumSalary: number;
  targetSalary: number;
  needsEquity: boolean;
  needsBonus: boolean;

  // Company
  preferredCompanySize: ('startup' | 'small' | 'medium' | 'large' | 'enterprise')[];
  preferredIndustries: string[];
  avoidIndustries: string[];

  // Role
  targetRoles: string[];
  targetLevels: string[];
  openToManagement: boolean;
  openToIC: boolean;

  // Culture
  cultureKeywords: string[];
  dealBreakers: string[];
  mustHaves: string[];

  // Timing
  urgency: 'actively_looking' | 'open' | 'passive';
  availableDate?: Date;
  noticePeriod?: number;

  // AI Settings
  minimumMatchScore: number;
  autoApplyThreshold: number;
  proactiveMatching: boolean;
}

export interface ProactiveOpportunity {
  id: string;
  type: 'job_posting' | 'company_growth' | 'network_referral' | 'skill_match' | 'salary_opportunity';
  source: string;
  title: string;
  company: string;
  description: string;
  matchScore: number;
  reason: string;
  suggestedAction: string;
  urgency: 'low' | 'medium' | 'high';
  discoveredAt: Date;
  expiresAt?: Date;
}

export interface MatchFeedback {
  matchId: string;
  action: 'applied' | 'saved' | 'dismissed' | 'not_interested';
  reason?: string;
  outcome?: 'interview' | 'offer' | 'rejected' | 'no_response';
  feedback?: string;
}

// ============================================================================
// OPPORTUNITY MATCHER CLASS
// ============================================================================

export class OpportunityMatcher {
  private anthropic: Anthropic;
  private skillsEngine = getSkillsEngine();

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  // ==========================================================================
  // CORE MATCHING
  // ==========================================================================

  /**
   * Match a candidate to a specific job
   */
  async matchCandidateToJob(
    candidate: JobSeekerProfile,
    job: JobOpening,
    preferences: MatchPreferences
  ): Promise<OpportunityMatch> {
    const score = await this.calculateMatchScore(candidate, job, preferences);
    const analysis = await this.analyzeMatch(candidate, job, score);

    return {
      id: `match_${candidate.id}_${job.id}_${Date.now()}`,
      job,
      score,
      matchReasons: analysis.matchReasons,
      concerns: analysis.concerns,
      highlights: analysis.highlights,
      competitiveness: this.estimateCompetitiveness(job, score.overall),
      estimatedOdds: this.estimateOdds(score, job),
      suggestedApproach: analysis.suggestedApproach,
      applicationTips: analysis.applicationTips,
      salaryInsight: {
        postedRange: `$${job.salaryRange.min.toLocaleString()} - $${job.salaryRange.max.toLocaleString()}`,
        yourTarget: candidate.compensation.targetBase,
        marketRate: Math.round((job.salaryRange.min + job.salaryRange.max) / 2),
        negotiationRoom: this.assessNegotiationRoom(candidate, job),
      },
      cultureFit: analysis.cultureFit,
      nextSteps: analysis.nextSteps,
      discoveredAt: new Date(),
      expiresAt: job.startDate || undefined,
    };
  }

  /**
   * Calculate comprehensive match score
   */
  private async calculateMatchScore(
    candidate: JobSeekerProfile,
    job: JobOpening,
    preferences: MatchPreferences
  ): Promise<MatchScore> {
    const components = {
      skills: 0,
      experience: 0,
      culture: 0,
      compensation: 0,
      logistics: 0,
      growth: 0,
    };

    // 1. Skills Match (0-100)
    const candidateSkillNames = candidate.skills.map(s => s.name.toLowerCase());
    const requiredSkills = job.requiredSkills.map(s => s.toLowerCase());
    const preferredSkills = job.preferredSkills.map(s => s.toLowerCase());

    const requiredMatches = requiredSkills.filter(rs =>
      candidateSkillNames.some(cs => cs.includes(rs) || rs.includes(cs))
    );
    const preferredMatches = preferredSkills.filter(ps =>
      candidateSkillNames.some(cs => cs.includes(ps) || ps.includes(cs))
    );

    const requiredRatio = requiredSkills.length > 0 ? requiredMatches.length / requiredSkills.length : 0.5;
    const preferredRatio = preferredSkills.length > 0 ? preferredMatches.length / preferredSkills.length : 0.5;

    components.skills = Math.round(requiredRatio * 70 + preferredRatio * 30);

    // 2. Experience Match (0-100)
    const expDiff = candidate.yearsExperience - job.requiredExperience;
    if (expDiff >= 0 && expDiff <= 3) {
      components.experience = 100;
    } else if (expDiff > 3) {
      components.experience = Math.max(60, 100 - (expDiff - 3) * 10); // Overqualified penalty
    } else {
      components.experience = Math.max(0, 100 + expDiff * 20); // Under-experienced penalty
    }

    // Level match
    const levelOrder = ['entry', 'mid', 'senior', 'staff', 'principal', 'director', 'vp', 'c_level'];
    const jobLevelIdx = levelOrder.indexOf(job.level);
    const candidateLevelMap: Record<string, number> = {
      junior: 0, mid: 1, senior: 2, staff: 3, principal: 4, executive: 5,
    };
    const candidateLevelIdx = candidateLevelMap[candidate.availability] || 2;

    const levelDiff = Math.abs(jobLevelIdx - candidateLevelIdx);
    if (levelDiff <= 1) {
      components.experience = Math.min(100, components.experience + 10);
    } else if (levelDiff >= 3) {
      components.experience = Math.max(0, components.experience - 20);
    }

    // 3. Culture Match (0-100)
    const candidateCulture = candidate.culturePreferences.map(c => c.toLowerCase());
    const companyMightHave = [
      job.workStyle === 'remote' ? 'remote-friendly' : '',
      job.urgency === 'urgent' ? 'fast-paced' : '',
      ...job.whatWeOffer.map(w => w.toLowerCase()),
    ].filter(Boolean);

    const cultureOverlap = candidateCulture.filter(cc =>
      companyMightHave.some(cm => cm.includes(cc) || cc.includes(cm))
    );
    components.culture = Math.min(100, 50 + cultureOverlap.length * 15);

    // 4. Compensation Match (0-100)
    const targetSalary = candidate.compensation.targetBase;
    const { min: minSalary, max: maxSalary } = job.salaryRange;
    const midSalary = (minSalary + maxSalary) / 2;

    if (targetSalary <= maxSalary) {
      if (targetSalary <= midSalary) {
        components.compensation = 100; // Easy fit
      } else {
        components.compensation = 85; // At the higher end but possible
      }
    } else {
      const overage = (targetSalary - maxSalary) / maxSalary;
      if (overage <= 0.1) {
        components.compensation = 70; // Slightly above, negotiable
      } else if (overage <= 0.2) {
        components.compensation = 50; // Needs negotiation
      } else {
        components.compensation = Math.max(0, 40 - overage * 100); // Unlikely
      }
    }

    // Check equity/bonus requirements
    if (candidate.compensation.mustHaveEquity && !job.equityRange) {
      components.compensation = Math.max(0, components.compensation - 20);
    }

    // 5. Logistics Match (0-100)
    components.logistics = 100; // Start with perfect score

    // Work style
    if (!preferences.workStyle.includes(job.workStyle)) {
      components.logistics -= 40;
    }

    // Location
    if (job.workStyle !== 'remote') {
      const locationMatch = preferences.preferredLocations.some(pl =>
        job.location.toLowerCase().includes(pl.toLowerCase())
      );
      if (!locationMatch && !preferences.willingToRelocate) {
        components.logistics -= 50;
      } else if (!locationMatch && preferences.willingToRelocate) {
        components.logistics -= 15;
      }
    }

    // Timing
    if (job.startDate && preferences.availableDate && job.startDate < preferences.availableDate) {
      components.logistics -= 20;
    }

    components.logistics = Math.max(0, components.logistics);

    // 6. Growth Match (0-100)
    const targetRolesLower = preferences.targetRoles.map(r => r.toLowerCase());
    const jobTitleLower = job.title.toLowerCase();

    const roleMatch = targetRolesLower.some(tr =>
      jobTitleLower.includes(tr) || tr.includes(jobTitleLower.split(' ')[0])
    );

    if (roleMatch) {
      components.growth = 90;
    } else {
      // Check if it's an adjacent role
      components.growth = 60; // Moderate growth potential
    }

    // Calculate overall with weights
    const weights = {
      skills: 0.25,
      experience: 0.20,
      culture: 0.15,
      compensation: 0.20,
      logistics: 0.10,
      growth: 0.10,
    };

    const overall = Math.round(
      components.skills * weights.skills +
      components.experience * weights.experience +
      components.culture * weights.culture +
      components.compensation * weights.compensation +
      components.logistics * weights.logistics +
      components.growth * weights.growth
    );

    // Determine confidence
    let confidence: MatchScore['confidence'];
    const componentValues = Object.values(components);
    const variance = this.calculateVariance(componentValues);
    const avgComponent = componentValues.reduce((a, b) => a + b, 0) / componentValues.length;

    if (variance < 200 && avgComponent > 60) {
      confidence = 'high';
    } else if (variance < 400 || avgComponent > 50) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return { overall, components, confidence };
  }

  /**
   * Analyze the match and generate insights
   */
  private async analyzeMatch(
    candidate: JobSeekerProfile,
    job: JobOpening,
    score: MatchScore
  ): Promise<{
    matchReasons: string[];
    concerns: string[];
    highlights: string[];
    suggestedApproach: string;
    applicationTips: string[];
    cultureFit: OpportunityMatch['cultureFit'];
    nextSteps: string[];
  }> {
    const matchReasons: string[] = [];
    const concerns: string[] = [];
    const highlights: string[] = [];
    const applicationTips: string[] = [];
    const nextSteps: string[] = [];

    // Analyze each component
    if (score.components.skills >= 80) {
      matchReasons.push(`Strong skill alignment (${score.components.skills}% match)`);
      highlights.push('Your skills closely match requirements');
    } else if (score.components.skills < 50) {
      concerns.push('Some key skills may need development');
      applicationTips.push('Highlight transferable skills and learning agility');
    }

    if (score.components.experience >= 80) {
      matchReasons.push(`Experience level is ideal (${candidate.yearsExperience} years)`);
    } else if (score.components.experience < 50) {
      if (candidate.yearsExperience > job.requiredExperience + 5) {
        concerns.push('You may be overqualified - emphasize interest in the specific role');
      } else {
        concerns.push('Less experience than preferred - highlight achievements');
        applicationTips.push('Focus on impact and outcomes, not just tenure');
      }
    }

    if (score.components.compensation >= 80) {
      highlights.push('Salary range aligns with your expectations');
    } else if (score.components.compensation < 60) {
      concerns.push('Compensation may require negotiation');
      applicationTips.push('Wait for the offer stage to discuss compensation');
    }

    if (score.components.logistics >= 80) {
      highlights.push(`${job.workStyle.charAt(0).toUpperCase() + job.workStyle.slice(1)} work arrangement fits your preferences`);
    } else if (score.components.logistics < 50) {
      concerns.push('Location or work style may not be ideal');
    }

    // Generate suggested approach based on score
    let suggestedApproach: string;
    if (score.overall >= 85) {
      suggestedApproach = 'This is an excellent match. Apply with confidence and emphasize your direct experience.';
      nextSteps.push('Apply immediately', 'Prepare a tailored cover letter', 'Research the team');
    } else if (score.overall >= 70) {
      suggestedApproach = 'Good match with some areas to address. Lead with your strengths and address gaps proactively.';
      nextSteps.push('Apply with a strong cover letter', 'Highlight relevant achievements', 'Be ready to discuss growth areas');
    } else if (score.overall >= 55) {
      suggestedApproach = 'Moderate match. Consider if this aligns with your goals and emphasize transferable skills.';
      nextSteps.push('Research company thoroughly', 'Consider networking first', 'Prepare to address concerns');
    } else {
      suggestedApproach = 'This role may not be the best fit. Consider if other aspects (company, growth) make it worthwhile.';
      nextSteps.push('Evaluate if worth pursuing', 'Look for better matches', 'Network for internal referral');
    }

    // Culture fit analysis
    const cultureFit = {
      score: score.components.culture,
      strengths: candidate.culturePreferences.slice(0, 3).map(cp =>
        `Your preference for "${cp}" likely aligns with this role`
      ),
      potentialChallenges: score.components.culture < 60
        ? ['Culture fit unclear - ask about this in interviews']
        : [],
    };

    // Add faith-based encouragement
    if (score.overall < 70 && concerns.length > 0) {
      applicationTips.push(
        "Remember: 'I can do all things through Christ who strengthens me.' - Philippians 4:13"
      );
    }

    return {
      matchReasons,
      concerns,
      highlights,
      suggestedApproach,
      applicationTips,
      cultureFit,
      nextSteps,
    };
  }

  // ==========================================================================
  // PROACTIVE DISCOVERY
  // ==========================================================================

  /**
   * Proactively find opportunities for a candidate
   */
  async discoverOpportunities(
    candidate: JobSeekerProfile,
    preferences: MatchPreferences,
    limit: number = 10
  ): Promise<ProactiveOpportunity[]> {
    const opportunities: ProactiveOpportunity[] = [];

    try {
      // 1. Find matching job postings
      const jobMatches = await this.findMatchingJobs(candidate, preferences, limit);

      for (const match of jobMatches) {
        opportunities.push({
          id: `proactive_job_${match.job.id}`,
          type: 'job_posting',
          source: 'Jobs Database',
          title: match.job.title,
          company: match.job.title, // Would need company name from employer profile
          description: match.job.description.slice(0, 200) + '...',
          matchScore: match.score.overall,
          reason: match.matchReasons[0] || 'Skills and experience align well',
          suggestedAction: 'Review and apply',
          urgency: match.job.urgency === 'urgent' ? 'high' : 'medium',
          discoveredAt: new Date(),
          expiresAt: match.job.startDate,
        });
      }

      // 2. Find skill-based opportunities
      const skillOpps = await this.findSkillBasedOpportunities(candidate);
      opportunities.push(...skillOpps);

      // 3. Find salary opportunities (where candidate could earn more)
      const salaryOpps = await this.findSalaryOpportunities(candidate, preferences);
      opportunities.push(...salaryOpps);

    } catch (error) {
      console.error('[OpportunityMatcher] Discovery error:', error);
    }

    // Sort by match score and urgency
    return opportunities
      .sort((a, b) => {
        const urgencyScore = { high: 3, medium: 2, low: 1 };
        const urgencyDiff = urgencyScore[b.urgency] - urgencyScore[a.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return b.matchScore - a.matchScore;
      })
      .slice(0, limit);
  }

  /**
   * Find jobs matching the candidate
   */
  private async findMatchingJobs(
    candidate: JobSeekerProfile,
    preferences: MatchPreferences,
    limit: number
  ): Promise<OpportunityMatch[]> {
    try {
      // Query for open jobs
      const result = await sql`
        SELECT * FROM job_openings
        WHERE status = 'open'
          AND (
            salary_range_max >= ${preferences.minimumSalary}
            OR salary_range_max IS NULL
          )
        ORDER BY created_at DESC
        LIMIT 50
      `;

      const matches: OpportunityMatch[] = [];

      for (const row of result.rows) {
        const job = this.mapRowToJobOpening(row);

        // Quick filter on work style
        if (!preferences.workStyle.includes(job.workStyle)) {
          continue;
        }

        const match = await this.matchCandidateToJob(candidate, job, preferences);

        if (match.score.overall >= preferences.minimumMatchScore) {
          matches.push(match);
        }
      }

      return matches
        .sort((a, b) => b.score.overall - a.score.overall)
        .slice(0, limit);

    } catch (error) {
      console.error('[OpportunityMatcher] Job search error:', error);
      return [];
    }
  }

  /**
   * Find opportunities based on high-value skills
   */
  private async findSkillBasedOpportunities(
    candidate: JobSeekerProfile
  ): Promise<ProactiveOpportunity[]> {
    const opportunities: ProactiveOpportunity[] = [];

    // Get high-value skills
    const highValueSkills = candidate.skills.filter(s =>
      s.level === 'expert' || s.level === 'advanced'
    );

    for (const skill of highValueSkills.slice(0, 3)) {
      const marketData = await this.skillsEngine.getSkillMarketData(skill.name);

      if (marketData.demandScore >= 80) {
        opportunities.push({
          id: `skill_opp_${skill.name}_${Date.now()}`,
          type: 'skill_match',
          source: 'Skills Analysis',
          title: `High demand for ${skill.name} experts`,
          company: marketData.topPayingIndustries[0] || 'Various',
          description: `Your ${skill.level} ${skill.name} skills are in ${marketData.supplyLevel === 'scarce' ? 'very ' : ''}high demand. Companies in ${marketData.topPayingIndustries.slice(0, 2).join(' and ')} are actively hiring.`,
          matchScore: marketData.demandScore,
          reason: `${skill.name} has ${marketData.growthRate}% annual demand growth`,
          suggestedAction: 'Search for roles emphasizing this skill',
          urgency: marketData.supplyLevel === 'scarce' ? 'high' : 'medium',
          discoveredAt: new Date(),
        });
      }
    }

    return opportunities;
  }

  /**
   * Find opportunities where candidate could earn significantly more
   */
  private async findSalaryOpportunities(
    candidate: JobSeekerProfile,
    preferences: MatchPreferences
  ): Promise<ProactiveOpportunity[]> {
    const opportunities: ProactiveOpportunity[] = [];

    // Estimate current market value
    const skillValue = await this.skillsEngine.estimateSkillMarketValue(
      candidate.skills.map(s => ({
        ...s,
        normalizedName: s.name.toLowerCase(),
        proficiencyScore: s.level === 'expert' ? 90 : s.level === 'advanced' ? 75 : 60,
        category: 'other' as const,
      }))
    );

    const estimatedMarketValue = 120000 + skillValue.totalValue; // Base + skills
    const currentTarget = candidate.compensation.targetBase;

    if (estimatedMarketValue > currentTarget * 1.15) {
      // Candidate might be undervaluing themselves
      opportunities.push({
        id: `salary_opp_${Date.now()}`,
        type: 'salary_opportunity',
        source: 'Market Analysis',
        title: 'You may be able to earn more',
        company: 'Market Insight',
        description: `Based on your skills (${candidate.skills.slice(0, 3).map(s => s.name).join(', ')}), your market value may be around $${estimatedMarketValue.toLocaleString()}, which is ${Math.round((estimatedMarketValue / currentTarget - 1) * 100)}% above your current target.`,
        matchScore: 85,
        reason: `Skills command premium: ${skillValue.synergies.map(s => s.reason).join(', ') || 'Strong skill combination'}`,
        suggestedAction: 'Consider raising your salary expectations',
        urgency: 'low',
        discoveredAt: new Date(),
      });
    }

    return opportunities;
  }

  // ==========================================================================
  // FEEDBACK & LEARNING
  // ==========================================================================

  /**
   * Record feedback on a match to improve future matching
   */
  async recordFeedback(feedback: MatchFeedback): Promise<void> {
    try {
      await sql`
        INSERT INTO match_feedback (
          match_id, action, reason, outcome, feedback, created_at
        ) VALUES (
          ${feedback.matchId}, ${feedback.action},
          ${feedback.reason || null}, ${feedback.outcome || null},
          ${feedback.feedback || null}, NOW()
        )
      `;

      // Use feedback to adjust matching (in production, this would update ML models)
      console.log(`[OpportunityMatcher] Feedback recorded: ${feedback.action} for ${feedback.matchId}`);

    } catch (error) {
      console.error('[OpportunityMatcher] Feedback error:', error);
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private estimateCompetitiveness(
    job: JobOpening,
    matchScore: number
  ): OpportunityMatch['competitiveness'] {
    const applications = job.applicationCount || 0;

    if (applications > 100) return 'very_high';
    if (applications > 50) return 'high';
    if (applications > 20) return 'moderate';
    return 'low';
  }

  private estimateOdds(score: MatchScore, job: JobOpening): string {
    const { overall, confidence } = score;
    const applications = job.applicationCount || 0;

    if (overall >= 85 && confidence === 'high' && applications < 20) {
      return 'Excellent chance';
    } else if (overall >= 75 && applications < 50) {
      return 'Good chance';
    } else if (overall >= 60) {
      return 'Moderate chance';
    } else {
      return 'Worth a try';
    }
  }

  private assessNegotiationRoom(
    candidate: JobSeekerProfile,
    job: JobOpening
  ): 'low' | 'medium' | 'high' {
    const target = candidate.compensation.targetBase;
    const max = job.salaryRange.max;

    if (target <= job.salaryRange.min) return 'high';
    if (target <= max) return 'medium';
    if (target <= max * 1.1) return 'low';
    return 'low';
  }

  private calculateVariance(numbers: number[]): number {
    const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private mapRowToJobOpening(row: Record<string, unknown>): JobOpening {
    return {
      id: row.id as string,
      employerId: row.employer_id as string,
      companyId: row.company_id as string,
      title: row.title as string,
      department: (row.department as string) || 'Engineering',
      level: (row.level as JobOpening['level']) || 'mid',
      reportingTo: (row.reporting_to as string) || 'Hiring Manager',
      teamSize: row.team_size as number,
      requiredSkills: (row.required_skills as string[]) || [],
      preferredSkills: (row.preferred_skills as string[]) || [],
      requiredExperience: (row.required_experience as number) || 3,
      preferredExperience: row.preferred_experience as number,
      education: row.education as string[],
      certifications: row.certifications as string[],
      description: (row.description as string) || '',
      responsibilities: (row.responsibilities as string[]) || [],
      whatWeOffer: (row.what_we_offer as string[]) || [],
      salaryRange: {
        min: (row.salary_range_min as number) || 100000,
        max: (row.salary_range_max as number) || 200000,
      },
      bonusTarget: row.bonus_target as number,
      equityRange: row.equity_range ? {
        min: (row.equity_range as Record<string, string>).min,
        max: (row.equity_range as Record<string, string>).max,
      } : undefined,
      signingBonusBudget: row.signing_bonus_budget as number,
      location: (row.location as string) || 'Remote',
      workStyle: (row.work_style as JobOpening['workStyle']) || 'remote',
      startDate: row.start_date ? new Date(row.start_date as string) : undefined,
      urgency: (row.urgency as JobOpening['urgency']) || 'standard',
      interviewProcess: (row.interview_process as string[]) || [],
      hiringManagerId: row.hiring_manager_id as string,
      status: (row.status as JobOpening['status']) || 'open',
      applicationCount: (row.application_count as number) || 0,
      interviewingCount: (row.interviewing_count as number) || 0,
      offersMade: (row.offers_made as number) || 0,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ============================================================================
// BATCH MATCHING FOR NOTIFICATIONS
// ============================================================================

/**
 * Run batch matching for proactive notifications
 */
export async function runProactiveMatching(): Promise<{
  candidatesProcessed: number;
  opportunitiesFound: number;
  notificationsSent: number;
}> {
  let candidatesProcessed = 0;
  let opportunitiesFound = 0;
  let notificationsSent = 0;

  try {
    // Get active candidates with proactive matching enabled
    const candidatesResult = await sql`
      SELECT * FROM job_seeker_profiles
      WHERE availability IN ('actively_looking', 'open_to_opportunities')
        AND auto_apply_enabled = true
      LIMIT 100
    `;

    const matcher = new OpportunityMatcher();

    for (const row of candidatesResult.rows) {
      candidatesProcessed++;

      const candidate = mapRowToJobSeekerProfile(row);
      const preferences = buildPreferencesFromProfile(candidate);

      const opportunities = await matcher.discoverOpportunities(candidate, preferences, 5);

      opportunitiesFound += opportunities.length;

      // Save opportunities and create notifications
      for (const opp of opportunities) {
        if (opp.matchScore >= (candidate.autoApplyThreshold || 80)) {
          await sql`
            INSERT INTO proactive_opportunities (
              user_id, opportunity_id, type, title, company,
              match_score, reason, status, created_at
            ) VALUES (
              ${candidate.userId}, ${opp.id}, ${opp.type}, ${opp.title},
              ${opp.company}, ${opp.matchScore}, ${opp.reason}, 'new', NOW()
            )
            ON CONFLICT (user_id, opportunity_id) DO NOTHING
          `;
          notificationsSent++;
        }
      }
    }
  } catch (error) {
    console.error('[runProactiveMatching] Error:', error);
  }

  return { candidatesProcessed, opportunitiesFound, notificationsSent };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapRowToJobSeekerProfile(row: Record<string, unknown>): JobSeekerProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    firstName: (row.first_name as string) || '',
    lastName: (row.last_name as string) || '',
    email: (row.email as string) || '',
    phone: row.phone as string,
    linkedinUrl: row.linkedin_url as string,
    portfolioUrl: row.portfolio_url as string,
    headline: (row.headline as string) || '',
    summary: (row.summary as string) || '',
    yearsExperience: (row.years_experience as number) || 0,
    currentTitle: row.current_title as string,
    currentCompany: row.current_company as string,
    skills: (row.skills as SkillProfile[]) || [],
    experiences: (row.experiences as JobSeekerProfile['experiences']) || [],
    education: (row.education as JobSeekerProfile['education']) || [],
    certifications: (row.certifications as JobSeekerProfile['certifications']) || [],
    achievements: (row.achievements as string[]) || [],
    targetRoles: (row.target_roles as string[]) || [],
    targetIndustries: (row.target_industries as string[]) || [],
    desiredCompanySize: (row.desired_company_size as JobSeekerProfile['desiredCompanySize']) || [],
    workStyle: (row.work_style as JobSeekerProfile['workStyle']) || 'flexible',
    willingToRelocate: (row.willing_to_relocate as boolean) || false,
    preferredLocations: (row.preferred_locations as string[]) || [],
    compensation: (row.compensation as JobSeekerProfile['compensation']) || {
      minimumBase: 0, targetBase: 0, idealBase: 0,
      mustHaveBonus: false, mustHaveEquity: false,
      signingBonusExpected: false, benefitsPriority: [], totalCompFocus: true,
    },
    culturePreferences: (row.culture_preferences as string[]) || [],
    dealBreakers: (row.deal_breakers as string[]) || [],
    mustHaves: (row.must_haves as string[]) || [],
    niceToHaves: (row.nice_to_haves as string[]) || [],
    agentPersonality: (row.agent_personality as JobSeekerProfile['agentPersonality']) || 'professional',
    negotiationStyle: (row.negotiation_style as JobSeekerProfile['negotiationStyle']) || 'moderate',
    autoApplyEnabled: (row.auto_apply_enabled as boolean) || false,
    autoApplyThreshold: (row.auto_apply_threshold as number) || 80,
    availability: (row.availability as JobSeekerProfile['availability']) || 'open_to_opportunities',
    noticePeriod: row.notice_period as number,
    availableFrom: row.available_from ? new Date(row.available_from as string) : undefined,
    faithEnabled: (row.faith_enabled as boolean) ?? true,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function buildPreferencesFromProfile(profile: JobSeekerProfile): MatchPreferences {
  return {
    workStyle: [profile.workStyle === 'flexible' ? 'remote' : profile.workStyle],
    willingToRelocate: profile.willingToRelocate,
    preferredLocations: profile.preferredLocations,
    minimumSalary: profile.compensation.minimumBase,
    targetSalary: profile.compensation.targetBase,
    needsEquity: profile.compensation.mustHaveEquity,
    needsBonus: profile.compensation.mustHaveBonus,
    preferredCompanySize: profile.desiredCompanySize,
    preferredIndustries: profile.targetIndustries,
    avoidIndustries: [],
    targetRoles: profile.targetRoles,
    targetLevels: [],
    openToManagement: true,
    openToIC: true,
    cultureKeywords: profile.culturePreferences,
    dealBreakers: profile.dealBreakers,
    mustHaves: profile.mustHaves,
    urgency: profile.availability,
    availableDate: profile.availableFrom,
    noticePeriod: profile.noticePeriod,
    minimumMatchScore: 60,
    autoApplyThreshold: profile.autoApplyThreshold,
    proactiveMatching: profile.autoApplyEnabled,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  OpportunityMatcher,
  runProactiveMatching,
  mapRowToJobSeekerProfile,
  buildPreferencesFromProfile,
};

export default OpportunityMatcher;
