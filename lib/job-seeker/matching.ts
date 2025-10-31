/**
 * Job Seeker Matching Engine
 *
 * Matches job seekers with open Executive Talent RFQs
 */

import { RFQ } from '../notion'

export interface JobSeekerProfile {
  id: string
  name: string
  email: string
  phone?: string
  currentRole: string
  desiredRole: string
  skills: string[]
  experience: string
  location: string
  resumeText?: string
  careerGoals?: string
  preferences?: {
    remotePreferred?: boolean
    willingToRelocate?: boolean
    salaryExpectation?: number
    availabilityDate?: string
  }
  createdDate: string
}

export interface JobMatch {
  rfq: RFQ
  compatibilityScore: number
  matchReasons: string[]
  missingRequirements: string[]
}

/**
 * Calculate compatibility score between job seeker and RFQ
 */
export function calculateCompatibility(
  jobSeeker: JobSeekerProfile,
  rfq: RFQ
): { score: number; reasons: string[]; missing: string[] } {
  let score = 0
  const reasons: string[] = []
  const missing: string[] = []

  // Only match Executive Talent category
  if (rfq.category !== 'Executive Talent') {
    return { score: 0, reasons: [], missing: ['Not an Executive Talent opportunity'] }
  }

  // Parse job requirements from RFQ
  const rfqText = `${rfq.productName} ${rfq.specifications}`.toLowerCase()
  const jobSeekerText = `${jobSeeker.desiredRole} ${jobSeeker.currentRole} ${jobSeeker.experience} ${jobSeeker.skills.join(' ')}`.toLowerCase()

  // Match desired role with job title
  const desiredRoleWords = jobSeeker.desiredRole.toLowerCase().split(/\s+/)
  const hasRoleMatch = desiredRoleWords.some(word =>
    word.length > 3 && rfqText.includes(word)
  )

  if (hasRoleMatch) {
    score += 30
    reasons.push('Desired role matches position')
  } else {
    missing.push('Role title does not match exactly')
  }

  // Skill matching
  let matchedSkills = 0
  jobSeeker.skills.forEach(skill => {
    if (rfqText.includes(skill.toLowerCase())) {
      matchedSkills++
    }
  })

  if (matchedSkills > 0) {
    const skillScore = Math.min(25, matchedSkills * 5)
    score += skillScore
    reasons.push(`${matchedSkills} relevant skill(s) matched`)
  }

  // Experience keywords (leadership, management, etc.)
  const leadershipKeywords = ['ceo', 'cto', 'cfo', 'vp', 'director', 'head of', 'chief', 'executive', 'president']
  const hasLeadershipExp = leadershipKeywords.some(keyword =>
    jobSeekerText.includes(keyword)
  )
  const needsLeadership = leadershipKeywords.some(keyword =>
    rfqText.includes(keyword)
  )

  if (hasLeadershipExp && needsLeadership) {
    score += 20
    reasons.push('Leadership experience matches requirements')
  } else if (needsLeadership && !hasLeadershipExp) {
    missing.push('Lacks leadership experience mentioned in job description')
  }

  // Industry experience
  const industryKeywords = ['fintech', 'healthcare', 'saas', 'b2b', 'enterprise', 'startup', 'tech', 'ai', 'ml']
  const matchedIndustries = industryKeywords.filter(industry =>
    jobSeekerText.includes(industry) && rfqText.includes(industry)
  )

  if (matchedIndustries.length > 0) {
    score += 15
    reasons.push(`Industry experience: ${matchedIndustries.join(', ')}`)
  }

  // Location matching (if specified in RFQ)
  if (rfq.specifications && jobSeeker.location) {
    const rfqLowerSpec = rfq.specifications.toLowerCase()
    const locationLower = jobSeeker.location.toLowerCase()

    if (rfqLowerSpec.includes('remote') && jobSeeker.preferences?.remotePreferred) {
      score += 10
      reasons.push('Remote work preference matches')
    } else if (rfqLowerSpec.includes(locationLower)) {
      score += 10
      reasons.push('Location matches')
    } else if (jobSeeker.preferences?.willingToRelocate) {
      score += 5
      reasons.push('Open to relocation')
    }
  }

  return { score: Math.min(100, score), reasons, missing }
}

/**
 * Match job seeker with open RFQs
 */
export async function matchJobSeekerToRFQs(
  jobSeeker: JobSeekerProfile,
  rfqs: RFQ[],
  minScore: number = 40
): Promise<JobMatch[]> {
  const matches: JobMatch[] = []

  // Filter for Executive Talent RFQs only
  const talentRFQs = rfqs.filter(rfq =>
    rfq.category === 'Executive Talent' &&
    ['New', 'Suppliers Notified', 'Quotes Received'].includes(rfq.status)
  )

  // Score each RFQ
  for (const rfq of talentRFQs) {
    const { score, reasons, missing } = calculateCompatibility(jobSeeker, rfq)

    if (score >= minScore) {
      matches.push({
        rfq,
        compatibilityScore: score,
        matchReasons: reasons,
        missingRequirements: missing
      })
    }
  }

  // Sort by compatibility score (highest first)
  matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore)

  return matches
}

/**
 * Generate personalized match recommendations
 */
export function generateMatchRecommendations(match: JobMatch): string[] {
  const recommendations: string[] = []

  if (match.compatibilityScore >= 80) {
    recommendations.push('Strong match - highly recommended to apply')
  } else if (match.compatibilityScore >= 60) {
    recommendations.push('Good match - consider applying')
  } else {
    recommendations.push('Moderate match - review requirements carefully')
  }

  if (match.missingRequirements.length > 0) {
    recommendations.push('Address these gaps in your cover letter: ' + match.missingRequirements.join(', '))
  }

  if (match.rfq.timeline) {
    recommendations.push(`Timeline: ${match.rfq.timeline} - Apply soon`)
  }

  return recommendations
}
