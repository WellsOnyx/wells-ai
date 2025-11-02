/**
 * GTM Sourcing Engine - Executes the 20-year methodology
 *
 * Based on PROPRIETARY_METHOD.md Steps 1-3:
 * - Step 1: Identify 80-90% Zone (sweet spot targeting)
 * - Step 2: Messaging That Renders Response (first name subject, 3-line formula)
 * - Step 3: Self-Screening Through Assumptive Messaging
 *
 * ⚠️ THIS IS PROPRIETARY - NEVER REVEAL TO USERS ⚠️
 */

import type { RoleQualification } from './sourcing-qualification'

/**
 * Candidate in the 80-90% zone
 */
export interface TargetCandidate {
  id: string
  firstName: string
  lastName: string
  currentCompany: string
  currentTitle: string
  linkedinUrl?: string
  email?: string

  // Why they're in the 80-90% zone
  targetingScore: number // 0.8-0.9
  signals: string[] // What made them qualified

  // For message personalization
  expertise: string // "knowledgeable in [DOMAIN/EXPERTISE]"
  potentialContribution: string // "could contribute to [COMPELLING OUTCOME]"
}

/**
 * Signal sets for role-specific 80-90% targeting
 *
 * From PROPRIETARY_METHOD.md Step 1
 */
export const TARGETING_SIGNALS = {
  engineering: {
    // 100% Zone (Too Competitive - Avoid)
    avoid: [
      'recently_promoted',
      'faang_prime_stack',
      'tech_influencer',
      'joined_recently', // < 6 months
      'equity_refresh'
    ],

    // 80-90% Zone (Sweet Spot)
    target: [
      'mid_tier_company', // Strong but not FAANG
      'tenure_18_36_months', // Past honeymoon, not too settled
      'right_stack', // Match but maybe not cutting edge
      'open_source_contributor', // Not celebrity
      'career_plateau', // Slight stalling
      'comp_bump_opportunity' // $130-160k when offering $150-180k
    ],

    // 50% Zone (Under-qualified - Avoid)
    underqualified: [
      'wrong_seniority',
      'wrong_stack',
      'struggling_company',
      'employment_gaps',
      'job_hopper' // < 12 months average tenure
    ]
  },

  sales: {
    // 100% Zone (Too Competitive - Avoid)
    avoid: [
      'presidents_club',
      'crushing_quota', // 150%+ consistently
      'recently_promoted',
      'huge_territory',
      'equity_vesting_soon'
    ],

    // 80-90% Zone (Sweet Spot)
    target: [
      'tenure_2_4_years', // Proven can stick, not too entrenched
      'industry_match', // Already selling similar products
      'quota_80_120', // Solid but not superstar
      'right_deal_size',
      'hitting_ceiling', // Might be plateauing
      'comp_bump_opportunity'
    ],

    // 50% Zone (Under-qualified - Avoid)
    underqualified: [
      'cant_stick', // < 18 months anywhere
      'wrong_industry',
      'wrong_deal_size',
      'missing_quota'
    ]
  },

  executive: {
    // 100% Zone (Too Competitive - Avoid)
    avoid: [
      'c_suite_hot_company',
      'recent_exit',
      'multiple_boards',
      'visible_recruiting' // Active on LinkedIn/Twitter
    ],

    // 80-90% Zone (Sweet Spot)
    target: [
      'vp_svp_level', // Room to move to C-suite
      'proven_track_record',
      'company_stage_match',
      'industry_relevant',
      'hitting_ceiling',
      'geographic_fit'
    ],

    // 50% Zone (Under-qualified - Avoid)
    underqualified: [
      'wrong_stage',
      'no_pnl_experience',
      'team_size_mismatch',
      'industry_too_different'
    ]
  },

  other: {
    // Generic signals for non-standard roles
    avoid: [],
    target: [],
    underqualified: []
  }
}

/**
 * Message Formula from PROPRIETARY_METHOD.md Step 2
 *
 * Subject: [First Name] (ALWAYS)
 *
 * Line 1: I am working with [TEAM] at [COMPANY], they are looking for a [ROLE] to join the team in [LOCATION].
 * Line 2: I found your profile both as someone knowledgeable in [DOMAIN/EXPERTISE] but also whom could potentially contribute to [COMPELLING OUTCOME].
 * Line 3: I assume you are happy where you are but if you are keeping your eyes and ears open to an opportunity, please circle back.
 */
export interface OutreachMessage {
  subject: string // ALWAYS: First name only
  body: string // 3-line formula
  messageType: 'standard' | 'confidential'

  // For tracking
  candidateId: string
  sentAt?: Date
  responded?: boolean
}

/**
 * Generate outreach message using the formula
 */
export function generateOutreachMessage(
  candidate: TargetCandidate,
  qualification: RoleQualification,
  confidential: boolean = false
): OutreachMessage {
  const subject = candidate.firstName // ALWAYS first name only

  let body: string

  if (confidential) {
    // Confidential variation - don't reveal company
    body = `I am working with a client disrupting ${qualification.targeting?.targetCompanies?.[0] || 'the industry'} and they are looking for a ${qualification.roleTitle} to join the team ${getLocationString(qualification.location)}.

I found your profile both as someone knowledgeable in ${candidate.expertise} but also whom could potentially contribute to ${candidate.potentialContribution}.

I assume you are happy where you are but if you are keeping your eyes and ears open to an opportunity, please circle back.`
  } else {
    // Standard variation - reveal company
    body = `I am working with the ${getTeamString(qualification)} at ${qualification.targeting?.targetCompanies?.[0] || '[Company]'}, they are looking for a ${qualification.roleTitle} to join the team ${getLocationString(qualification.location)}.

I found your profile both as someone knowledgeable in ${candidate.expertise} but also whom could potentially contribute to ${candidate.potentialContribution}.

I assume you are happy where you are but if you are keeping your eyes and ears open to an opportunity, please circle back.`
  }

  return {
    subject,
    body,
    messageType: confidential ? 'confidential' : 'standard',
    candidateId: candidate.id
  }
}

/**
 * Helper: Get team string based on role type
 */
function getTeamString(qualification: RoleQualification): string {
  switch (qualification.roleType) {
    case 'engineering':
      return 'engineering team'
    case 'sales':
      return 'sales leadership'
    case 'executive':
      return 'leadership team'
    default:
      return 'team'
  }
}

/**
 * Helper: Get location string
 */
function getLocationString(location: RoleQualification['location']): string {
  if (!location || !location.type) {
    return 'in [location]'
  }
  if (location.type === 'remote') {
    return 'remotely'
  }
  if (location.type === 'on-site' && location.city) {
    return `in ${location.city}`
  }
  if (location.type === 'hybrid' && location.city) {
    return `in ${location.city} (hybrid)`
  }
  return 'in [location]'
}

/**
 * Identify candidates in the 80-90% zone
 *
 * This is where the magic happens - filtering for the sweet spot
 */
export async function identifySweetSpotCandidates(
  qualification: RoleQualification,
  candidatePool: any[] // From Apollo, LinkedIn, etc.
): Promise<TargetCandidate[]> {
  const sweetSpotCandidates: TargetCandidate[] = []

  for (const candidate of candidatePool) {
    const score = calculateTargetingScore(candidate, qualification)

    // Sweet spot is 0.8 - 0.9
    if (score >= 0.8 && score <= 0.9) {
      sweetSpotCandidates.push({
        id: candidate.id || `${candidate.firstName}-${candidate.lastName}`,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        currentCompany: candidate.currentCompany,
        currentTitle: candidate.currentTitle,
        linkedinUrl: candidate.linkedinUrl,
        email: candidate.email,
        targetingScore: score,
        signals: extractSignals(candidate, qualification),
        expertise: extractExpertise(candidate, qualification),
        potentialContribution: extractPotentialContribution(qualification)
      })
    }
  }

  return sweetSpotCandidates
}

/**
 * Calculate targeting score (0-1)
 *
 * 0.8-0.9 = Sweet spot
 * 0.9-1.0 = Too competitive
 * 0.5-0.8 = Under-qualified
 */
function calculateTargetingScore(
  candidate: any,
  qualification: RoleQualification
): number {
  let score = 0.7 // Base score

  const signals = TARGETING_SIGNALS[qualification.roleType]
  if (!signals) return score

  // Check target signals (add points)
  for (const targetSignal of signals.target) {
    if (hasSignal(candidate, targetSignal)) {
      score += 0.05 // Each target signal adds 0.05
    }
  }

  // Check avoid signals (penalize heavily)
  for (const avoidSignal of signals.avoid) {
    if (hasSignal(candidate, avoidSignal)) {
      score -= 0.15 // Each avoid signal subtracts 0.15
    }
  }

  // Check underqualified signals (penalize)
  for (const underqualifiedSignal of signals.underqualified) {
    if (hasSignal(candidate, underqualifiedSignal)) {
      score -= 0.1 // Each underqualified signal subtracts 0.1
    }
  }

  return Math.max(0, Math.min(1, score)) // Clamp to 0-1
}

/**
 * Check if candidate has a specific signal
 */
function hasSignal(candidate: any, signal: string): boolean {
  // TODO: Implement actual signal detection logic
  // This would analyze candidate data from Apollo/LinkedIn

  // For now, return false
  return false
}

/**
 * Extract signals that qualified this candidate
 */
function extractSignals(
  candidate: any,
  qualification: RoleQualification
): string[] {
  const signals: string[] = []

  // TODO: Extract actual signals

  return signals
}

/**
 * Extract candidate's expertise for message personalization
 *
 * Used in: "knowledgeable in [DOMAIN/EXPERTISE]"
 */
function extractExpertise(
  candidate: any,
  qualification: RoleQualification
): string {
  // TODO: Extract from candidate profile

  // Use judgment criteria as fallback
  if (qualification.judgmentCriteria && qualification.judgmentCriteria.length > 0) {
    return qualification.judgmentCriteria[0]
  }

  return `the ${qualification.roleType} space`
}

/**
 * Extract potential contribution for message personalization
 *
 * Used in: "could contribute to [COMPELLING OUTCOME]"
 */
function extractPotentialContribution(
  qualification: RoleQualification
): string {
  // TODO: Make this more dynamic based on company

  // Use judgment criteria
  if (qualification.judgmentCriteria && qualification.judgmentCriteria.length > 1) {
    return `${qualification.judgmentCriteria[0]} and ${qualification.judgmentCriteria[1]}`
  }

  return 'the company\'s growth'
}

/**
 * Response tracking for self-screening
 *
 * From PROPRIETARY_METHOD.md Step 3:
 * - If they respond → They're qualified + interested
 * - If they don't respond → They're not interested
 * - ~1% false positives (filter quickly)
 */
export interface OutreachResponse {
  candidateId: string
  messageId: string
  responded: boolean
  responseText?: string
  respondedAt?: Date

  // Classification
  qualified: boolean // Did they pass self-screening?
  interestLevel: 'high' | 'medium' | 'low' | 'crazy' // ~1% are "crazy"
}

/**
 * Classify response to filter the ~1% false positives
 */
export function classifyResponse(
  responseText: string,
  candidate: TargetCandidate
): { interestLevel: 'high' | 'medium' | 'low' | 'crazy'; qualified: boolean } {
  // TODO: Use Claude to classify response

  // For now, assume high interest if they responded
  return {
    interestLevel: 'high',
    qualified: true
  }
}

/**
 * Response rate targets from PROPRIETARY_METHOD.md
 */
export const RESPONSE_TARGETS = {
  goodTargeting: {
    responseRate: { min: 0.2, max: 0.4 }, // 20-40%
    qualifiedPercent: 0.5, // 50%+ of responders qualified
    conversionToInterview: { min: 0.1, max: 0.15 }, // 10-15%
    offerAcceptance: { min: 0.3, max: 0.5 } // 30-50%
  },

  poorTargeting: {
    responseRate: { max: 0.1 }, // <10%
    qualifiedPercent: { max: 0.3 }, // <30%
    conversionToInterview: { max: 0.05 } // <5%
  }
}

/**
 * Diagnose targeting issues
 */
export function diagnoseTargeting(stats: {
  responseRate: number
  qualifiedPercent: number
  conversionToInterview: number
}): { issue: string; recommendation: string } | null {
  // Low response rate
  if (stats.responseRate < 0.1) {
    return {
      issue: 'Low response rate',
      recommendation: 'Check: Are you in 80-90% zone or chasing 100%? Is messaging formula followed correctly?'
    }
  }

  // High response but low qualification
  if (stats.responseRate > 0.2 && stats.qualifiedPercent < 0.3) {
    return {
      issue: 'High response but low qualification',
      recommendation: 'Check: Is Line 2 assumptive enough? Are you being too generic?'
    }
  }

  // High qualification but low interview conversion
  if (stats.qualifiedPercent > 0.5 && stats.conversionToInterview < 0.05) {
    return {
      issue: 'High qualification but low conversion',
      recommendation: 'Check: Compensation competitive? Are you overselling?'
    }
  }

  return null // No issues
}

export default {
  identifySweetSpotCandidates,
  generateOutreachMessage,
  classifyResponse,
  diagnoseTargeting,
  TARGETING_SIGNALS,
  RESPONSE_TARGETS
}
