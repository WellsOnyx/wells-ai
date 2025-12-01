/**
 * Wells AI - Legendary Onboarding System
 *
 * This is where Wells becomes YOUR companion.
 * Like Ghost from Destiny - the moment you meet, you know this is forever.
 */

export type OnboardingPhase =
  | 'introduction'      // Messages 1-3: First contact
  | 'first_win'         // Messages 4-7: Show value immediately
  | 'integration'       // Messages 8-15: Connect systems
  | 'relationship'      // Ongoing: Become indispensable
  | 'complete'          // Graduated to full companion

export type UserJourney = 'buyer' | 'seller' | 'job_seeker' | 'founder' | 'unknown'

export interface OnboardingState {
  sessionId: string
  phase: OnboardingPhase
  journey?: UserJourney
  messageCount: number

  // The Introduction (Phase 1)
  name?: string
  preferredName?: string
  email?: string
  phone?: string

  // Journey-specific context
  role?: string                    // What they do
  company?: string                 // Where they work
  painPoint?: string              // Their biggest frustration
  goal?: string                   // What they want to achieve

  // The First Win (Phase 2)
  firstRfqCreated?: boolean
  firstSuppliersMatched?: boolean
  firstNegotiationStarted?: boolean
  firstDealAmount?: number

  // Integration (Phase 3)
  bankConnected?: boolean
  erpConnected?: boolean
  kycCompleted?: boolean
  approvalThreshold?: number

  // Relationship metrics
  trustScore: number              // 0-100
  conversationDepth: number       // 0-10
  emotionalConnection: number     // 0-100

  // Milestones achieved
  milestones: string[]

  // Timestamps
  startedAt: Date
  lastActivityAt: Date
  completedAt?: Date
}

export interface OnboardingMilestone {
  id: string
  title: string
  description: string
  celebration: string
  unlocks?: string[]
  trustScoreBonus: number
}

/**
 * Create initial onboarding state
 */
export function createOnboardingState(sessionId: string): OnboardingState {
  return {
    sessionId,
    phase: 'introduction',
    messageCount: 0,
    trustScore: 0,
    conversationDepth: 0,
    emotionalConnection: 0,
    milestones: [],
    startedAt: new Date(),
    lastActivityAt: new Date()
  }
}

/**
 * Update onboarding state based on conversation
 */
export function updateOnboardingState(
  state: OnboardingState,
  updates: Partial<OnboardingState>
): OnboardingState {
  const newState = { ...state, ...updates, lastActivityAt: new Date() }

  // Auto-advance phases based on completion
  if (state.phase === 'introduction' && shouldAdvanceToFirstWin(newState)) {
    newState.phase = 'first_win'
    newState.milestones.push('introduction_complete')
  }

  if (state.phase === 'first_win' && shouldAdvanceToIntegration(newState)) {
    newState.phase = 'integration'
    newState.milestones.push('first_win_complete')
  }

  if (state.phase === 'integration' && shouldAdvanceToRelationship(newState)) {
    newState.phase = 'relationship'
    newState.milestones.push('integration_complete')
  }

  if (state.phase === 'relationship' && shouldComplete(newState)) {
    newState.phase = 'complete'
    newState.completedAt = new Date()
    newState.milestones.push('onboarding_complete')
  }

  return newState
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(state: OnboardingState): boolean {
  return state.phase === 'complete'
}

/**
 * Get current onboarding progress (0-100)
 */
export function getOnboardingProgress(state: OnboardingState): number {
  const phaseWeights = {
    introduction: 25,
    first_win: 50,
    integration: 75,
    relationship: 90,
    complete: 100
  }

  let baseProgress = phaseWeights[state.phase]

  // Add bonus for milestones
  const milestoneBonus = Math.min(state.milestones.length * 2, 10)

  return Math.min(baseProgress + milestoneBonus, 100)
}

/**
 * Phase advancement logic
 */
function shouldAdvanceToFirstWin(state: OnboardingState): boolean {
  return !!(
    state.name &&
    state.journey &&
    state.painPoint &&
    state.messageCount >= 3
  )
}

function shouldAdvanceToIntegration(state: OnboardingState): boolean {
  return !!(
    state.firstRfqCreated ||
    state.firstSuppliersMatched ||
    state.messageCount >= 7
  )
}

function shouldAdvanceToRelationship(state: OnboardingState): boolean {
  return !!(
    (state.bankConnected || state.erpConnected) &&
    state.messageCount >= 10
  )
}

function shouldComplete(state: OnboardingState): boolean {
  return !!(
    state.trustScore >= 60 &&
    state.conversationDepth >= 5 &&
    state.messageCount >= 15
  )
}

/**
 * Detect user journey from conversation
 */
export function detectJourney(message: string, conversationHistory: string[]): UserJourney {
  const combined = [message, ...conversationHistory].join(' ').toLowerCase()

  // Buyer signals
  const buyerKeywords = ['need', 'looking for', 'source', 'find suppliers', 'procurement', 'purchase', 'buy']
  const buyerScore = buyerKeywords.filter(k => combined.includes(k)).length

  // Seller signals
  const sellerKeywords = ['sell', 'offer', 'provide', 'our products', 'our services', 'customers', 'clients']
  const sellerScore = sellerKeywords.filter(k => combined.includes(k)).length

  // Job seeker signals
  const jobSeekerKeywords = ['looking for work', 'job', 'career', 'hire me', 'resume', 'experience in']
  const jobSeekerScore = jobSeekerKeywords.filter(k => combined.includes(k)).length

  // Founder signals
  const founderKeywords = ['my company', 'we\'re building', 'startup', 'founder', 'raising', 'launched']
  const founderScore = founderKeywords.filter(k => combined.includes(k)).length

  // Determine journey
  const scores = {
    buyer: buyerScore,
    seller: sellerScore,
    job_seeker: jobSeekerScore,
    founder: founderScore
  }

  const maxScore = Math.max(...Object.values(scores))

  if (maxScore === 0) return 'unknown'

  const journey = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0]
  return (journey as UserJourney) || 'unknown'
}

/**
 * Calculate trust score increase from interaction
 */
export function calculateTrustScoreIncrease(
  interaction: {
    userSharedPersonalInfo?: boolean
    wellsDeliveredValue?: boolean
    userExpressedSatisfaction?: boolean
    userAskedFollowUp?: boolean
    wellsRememberedContext?: boolean
  }
): number {
  let increase = 0

  if (interaction.userSharedPersonalInfo) increase += 5
  if (interaction.wellsDeliveredValue) increase += 10
  if (interaction.userExpressedSatisfaction) increase += 8
  if (interaction.userAskedFollowUp) increase += 3
  if (interaction.wellsRememberedContext) increase += 2

  return increase
}

/**
 * Milestones catalog
 */
export const ONBOARDING_MILESTONES: Record<string, OnboardingMilestone> = {
  first_name_shared: {
    id: 'first_name_shared',
    title: 'First Introduction',
    description: 'You shared your name with Wells',
    celebration: 'Great to meet you! I\'m Wells, and I\'m here to help you succeed.',
    trustScoreBonus: 5
  },

  journey_identified: {
    id: 'journey_identified',
    title: 'Journey Discovered',
    description: 'Wells understands what you need',
    celebration: 'I get it now. Let me show you what I can do.',
    trustScoreBonus: 5
  },

  first_rfq: {
    id: 'first_rfq',
    title: 'First Request',
    description: 'You made your first sourcing request',
    celebration: 'On it! This is what I was built for.',
    unlocks: ['supplier_matching', 'ai_negotiation'],
    trustScoreBonus: 10
  },

  first_supplier_match: {
    id: 'first_supplier_match',
    title: 'First Match',
    description: 'Wells found you qualified suppliers',
    celebration: 'Found some great options. Want me to start negotiating?',
    unlocks: ['negotiation_engine'],
    trustScoreBonus: 10
  },

  first_deal: {
    id: 'first_deal',
    title: 'First Deal',
    description: 'You closed your first transaction',
    celebration: 'Deal done! This is just the beginning.',
    unlocks: ['escrow', 'contract_generation'],
    trustScoreBonus: 20
  },

  bank_connected: {
    id: 'bank_connected',
    title: 'Bank Connected',
    description: 'Your bank account is linked',
    celebration: 'Perfect. Now I can handle payments seamlessly.',
    unlocks: ['instant_payments', 'grain_vault'],
    trustScoreBonus: 15
  },

  erp_connected: {
    id: 'erp_connected',
    title: 'ERP Integrated',
    description: 'Your ERP system is connected',
    celebration: 'Everything\'s connected now. I can work invisibly.',
    unlocks: ['auto_procurement', 'inventory_sync'],
    trustScoreBonus: 15
  },

  first_week: {
    id: 'first_week',
    title: 'One Week Together',
    description: 'You\'ve been using Wells for a week',
    celebration: 'One week down. I feel like I\'m really getting to know you.',
    trustScoreBonus: 10
  },

  companion_status: {
    id: 'companion_status',
    title: 'Companion Status',
    description: 'Wells has become your trusted partner',
    celebration: 'I\'ve got your back. Always.',
    trustScoreBonus: 25
  }
}

/**
 * Get next milestone to achieve
 */
export function getNextMilestone(state: OnboardingState): OnboardingMilestone | null {
  const achievedIds = new Set(state.milestones)

  // Priority order
  const milestoneOrder = [
    'first_name_shared',
    'journey_identified',
    'first_rfq',
    'first_supplier_match',
    'first_deal',
    'bank_connected',
    'erp_connected',
    'first_week',
    'companion_status'
  ]

  for (const id of milestoneOrder) {
    if (!achievedIds.has(id)) {
      return ONBOARDING_MILESTONES[id]
    }
  }

  return null
}

/**
 * Award milestone
 */
export function awardMilestone(
  state: OnboardingState,
  milestoneId: string
): OnboardingState {
  if (state.milestones.includes(milestoneId)) {
    return state // Already achieved
  }

  const milestone = ONBOARDING_MILESTONES[milestoneId]
  if (!milestone) {
    return state // Invalid milestone
  }

  return {
    ...state,
    milestones: [...state.milestones, milestoneId],
    trustScore: Math.min(state.trustScore + milestone.trustScoreBonus, 100),
    lastActivityAt: new Date()
  }
}
