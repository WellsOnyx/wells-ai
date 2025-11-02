/**
 * GTM Sourcing Qualification - Maps 20-year methodology into conversational flow
 *
 * Based on PROPRIETARY_METHOD.md Step 0: Deep Qualification
 *
 * This module translates the qualification questions into natural conversation,
 * extracting the information Wells needs to execute the 80-90% targeting.
 */

export interface RoleQualification {
  // Role Type
  roleType: 'engineering' | 'sales' | 'executive' | 'other'
  roleTitle: string
  seniority?: string

  // Technical/Role Specifics (varies by role type)
  technicalSpecs?: EngineeringSpecs | SalesSpecs | ExecutiveSpecs

  // Compensation & Benefits
  compensation: {
    baseRangeMin?: number
    baseRangeMax?: number
    totalComp?: string
    equity?: string
    negotiationCeiling?: number
    negotiationFloor?: number
  }

  // Company & Product Targeting
  targeting: {
    targetCompanies?: string[]
    avoidCompanies?: string[]
    reasonsToAvoid?: string[]
  }

  // Location
  location: {
    type: 'remote' | 'hybrid' | 'on-site'
    city?: string
    remoteScope?: 'us-only' | 'global' | 'timezone-specific'
  }

  // Timeline
  timeline: {
    startDate?: string
    urgency: 'immediate' | 'normal' | 'flexible'
    interviewRounds?: number
  }

  // The Critical Question - "How will this person be judged?"
  judgmentCriteria: string[] // 3 things that determine success/failure

  // Completeness tracking
  completeness: {
    hasRoleSpecs: boolean
    hasCompensation: boolean
    hasTargeting: boolean
    hasLocation: boolean
    hasJudgmentCriteria: boolean
    percentComplete: number
  }
}

interface EngineeringSpecs {
  specialization: 'frontend' | 'backend' | 'fullstack' | 'devops' | 'mobile' | 'embedded' | 'other'
  stack?: string[] // ['JavaScript', 'React', 'Node'] or ['.NET', 'C#'] etc.
  architecture?: string[] // ['microservices', 'serverless', 'cloud-native']
  yearsExperience?: number
  specificTechnologies?: string[]
}

interface SalesSpecs {
  industry: string // selling similar products = relationships + familiarity
  dealSize: 'smb' | 'mid-market' | 'enterprise'
  salesCycle: 'transactional' | 'enterprise'
  quotaAttainment?: string // "consistently 80%+"
  inboundVsOutbound: 'inbound' | 'outbound' | 'both'
  methodology?: string[] // ['MEDDIC', 'Challenger', 'Sandler']
  tenureRequired?: number // Can they stick past 2 years?
}

interface ExecutiveSpecs {
  companyStage: 'startup' | 'scale-up' | 'enterprise'
  teamSizeManaged?: number
  pnlResponsibility?: number // $XM budget
  boardExperience?: boolean
  functionalExpertise?: string[]
  industryExperience?: string
}

/**
 * Qualification questions by role type
 *
 * These map directly to PROPRIETARY_METHOD.md Step 0
 */
export const QUALIFICATION_QUESTIONS = {
  engineering: [
    "What specialization? (frontend, backend, full stack, DevOps, mobile, embedded)",
    "What's the tech stack? (JavaScript/React, .NET/C#, Java, Python, Go, etc.)",
    "What architecture knowledge is needed? (microservices, serverless, cloud-native)",
    "What's the seniority level? (junior, mid, senior, staff, principal)",
    "How many years of experience?",
    "Any specific technologies required?",
    "Location? (on-site city, remote US-only, remote global, hybrid)",
    "Base salary range? (floor to ceiling)",
    "Total compensation including equity/bonuses?",
    "What companies should we target?",
    "Any companies to avoid? (partnerships, non-competes, etc.)",
    "How will this person be judged? What 3 things will determine their success or failure?"
  ],

  sales: [
    "What industry/vertical? (selling similar products is critical)",
    "Can they stick past 2 years? (tenure track record matters)",
    "What deal sizes? (SMB, mid-market, enterprise)",
    "What's their quota attainment history? (consistently 80%+?)",
    "Inbound or outbound experience?",
    "Sales cycle length? (transactional vs enterprise)",
    "Any specific sales methodology? (MEDDIC, Challenger, Sandler)",
    "Location? (on-site, remote, hybrid)",
    "Base salary range?",
    "Total compensation including commission?",
    "What companies should we target?",
    "Any companies to avoid?",
    "How will this person be judged? What 3 things will determine their success or failure?"
  ],

  executive: [
    "What company stage experience? (startup, scale-up, enterprise)",
    "Team size they need to have managed?",
    "P&L responsibility? ($XM budget)",
    "Board experience required?",
    "What successful outcomes? (exits, transformations)",
    "Functional expertise needed?",
    "Industry experience required?",
    "Location?",
    "Base salary range?",
    "Total compensation including equity?",
    "Negotiation ceiling and floor?",
    "What companies should we target?",
    "Any companies to avoid?",
    "How will this person be judged? What 3 things will determine their success or failure?"
  ]
}

/**
 * Convert natural conversation into structured qualification data
 *
 * Wells asks these questions naturally in conversation, Claude extracts the structured data
 */
export async function extractQualificationFromConversation(
  conversationHistory: Array<{ role: string; content: string }>,
  roleType: 'engineering' | 'sales' | 'executive' | 'other'
): Promise<Partial<RoleQualification>> {
  // TODO: Use Claude to analyze conversation and extract structured data
  // For now, return empty qualification

  return {
    roleType,
    roleTitle: '',
    compensation: {},
    targeting: {},
    location: { type: 'remote' },
    timeline: { urgency: 'normal' },
    judgmentCriteria: [],
    completeness: {
      hasRoleSpecs: false,
      hasCompensation: false,
      hasTargeting: false,
      hasLocation: false,
      hasJudgmentCriteria: false,
      percentComplete: 0
    }
  }
}

/**
 * Get next question to ask based on current qualification state
 *
 * Wells asks these conversationally, one at a time, in natural flow
 */
export function getNextQualificationQuestion(
  qualification: Partial<RoleQualification>
): string | null {
  const roleType = qualification.roleType || 'other'

  // Check what's missing
  if (!qualification.technicalSpecs && roleType !== 'other') {
    return QUALIFICATION_QUESTIONS[roleType][0]
  }

  if (!qualification.compensation?.baseRangeMin) {
    return "What's the base salary range for this role?"
  }

  if (!qualification.location?.type) {
    return "Is this role remote, hybrid, or on-site?"
  }

  if (!qualification.targeting?.targetCompanies) {
    return "What companies should we target for candidates?"
  }

  if (!qualification.judgmentCriteria || qualification.judgmentCriteria.length === 0) {
    return "This is critical: How will this person be judged? What 3 things will determine their success or failure?"
  }

  // Qualification complete
  return null
}

/**
 * Calculate qualification completeness
 */
export function calculateCompleteness(
  qualification: Partial<RoleQualification>
): number {
  let completed = 0
  let total = 5

  if (qualification.technicalSpecs) completed++
  if (qualification.compensation?.baseRangeMin) completed++
  if (qualification.location?.type) completed++
  if (qualification.targeting?.targetCompanies) completed++
  if (qualification.judgmentCriteria && qualification.judgmentCriteria.length > 0) completed++

  return Math.round((completed / total) * 100)
}

/**
 * Check if qualification is complete enough to start sourcing
 */
export function isQualificationComplete(
  qualification: Partial<RoleQualification>
): boolean {
  return calculateCompleteness(qualification) >= 80
}

/**
 * Generate qualification summary for Wells to review with user
 */
export function generateQualificationSummary(
  qualification: Partial<RoleQualification>
): string {
  const parts: string[] = []

  parts.push(`**Role**: ${qualification.roleTitle || 'Not specified'}`)

  if (qualification.location) {
    parts.push(`**Location**: ${qualification.location.type}${qualification.location.city ? ` in ${qualification.location.city}` : ''}`)
  }

  if (qualification.compensation?.baseRangeMin) {
    parts.push(`**Salary**: $${qualification.compensation.baseRangeMin.toLocaleString()} - $${qualification.compensation.baseRangeMax?.toLocaleString() || 'Open'}`)
  }

  if (qualification.judgmentCriteria && qualification.judgmentCriteria.length > 0) {
    parts.push(`**Success Criteria**: ${qualification.judgmentCriteria.join(', ')}`)
  }

  return parts.join('\n')
}

/**
 * Map judgment criteria to search keywords
 *
 * From PROPRIETARY_METHOD.md:
 * "Use those 3 things as search keywords. Titles drift, but job outcomes don't."
 */
export function mapJudgmentToKeywords(
  judgmentCriteria: string[]
): string[] {
  // TODO: Use Claude to extract keywords from judgment criteria
  // For now, return criteria as-is
  return judgmentCriteria
}

export default {
  extractQualificationFromConversation,
  getNextQualificationQuestion,
  calculateCompleteness,
  isQualificationComplete,
  generateQualificationSummary,
  mapJudgmentToKeywords
}
