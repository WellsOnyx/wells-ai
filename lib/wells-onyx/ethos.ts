/**
 * Wells Onyx Ethos
 *
 * "We don't chase unicorns. We build tabernacles."
 *
 * Wells Onyx is built to endure — not for mythical exits, but for
 * long-term trust, resilience, and scale.
 */

// =============================================================================
// THE THREE-LEGGED CHAIR
// =============================================================================
// Each practice group must stand like a three-legged chair:

export interface PracticeGroupLegs {
  // Leg 1: Revenue viability (anchors, transactions, proof)
  revenue: {
    anchorClients: string[]
    monthlyRecurring: number
    transactionVolume: number
    proofPoints: string[]
  }

  // Leg 2: Managing Partner (business/leadership owner)
  managingPartner: {
    id: string
    name: string
    equity: number
    responsibilities: string[]
  }

  // Leg 3: Technical Lead (functional/operational anchor)
  technicalLead: {
    id: string
    name: string
    equity: number
    domain: string
  }
}

// =============================================================================
// THE 12 PRACTICE GROUPS
// =============================================================================
// By year one, Wells Onyx will have 12 practice groups, each its own
// three-legged chair, forming together a chair with 12 legs — balanced,
// resilient, and strong enough to carry the whole ecosystem.

export const PRACTICE_GROUPS = [
  'executive-search',
  'fractional-leadership',
  'treasury-services',
  'procurement-sourcing',
  'hr-employment',
  'compliance-risk',
  'technology-integration',
  'strategic-advisory',
  'capital-markets',
  'operations-excellence',
  'growth-gtm',
  'legal-governance',
] as const

export type PracticeGroup = typeof PRACTICE_GROUPS[number]

// =============================================================================
// THE TABERNACLE
// =============================================================================
// The tabernacle metaphor frames our system:

export const TABERNACLE = {
  // Pillars = Managing Partners
  // The load-bearing structures that hold everything up
  pillars: 'Managing Partners',

  // Scaffolding = SLT and governance
  // The framework that connects and supports the pillars
  scaffolding: 'Senior Leadership Team & Governance',

  // Sanctuary = Wells Onyx culture and trust
  // The sacred space we're protecting and building
  sanctuary: 'Wells Onyx Culture & Trust',
} as const

// =============================================================================
// CORE PRINCIPLES
// =============================================================================

export const ETHOS = {
  // We don't chase unicorns. We build tabernacles.
  mission: 'Build to endure, not to exit',

  // Long-term trust over short-term gains
  values: [
    'Trust is earned through consistency',
    'Resilience over rapid growth',
    'Scale through strength, not speed',
    'Every practice group stands on its own',
    'Together we are stronger than apart',
  ],

  // The three requirements for every practice group
  threeLegs: [
    'Revenue viability (anchors, transactions, proof)',
    'Managing Partner (business/leadership owner)',
    'Technical Lead (functional/operational anchor)',
  ],

  // Year one goal
  yearOneGoal: {
    practiceGroups: 12,
    structure: 'Chair with 12 legs',
    outcome: 'Balanced, resilient, strong enough to carry the whole ecosystem',
  },
} as const

// =============================================================================
// PRACTICE GROUP VALIDATION
// =============================================================================

export function validatePracticeGroup(group: PracticeGroupLegs): {
  isViable: boolean
  missingLegs: string[]
  strength: 'unstable' | 'wobbly' | 'stable'
} {
  const missingLegs: string[] = []

  // Check revenue leg
  const hasRevenue =
    group.revenue.anchorClients.length > 0 ||
    group.revenue.monthlyRecurring > 0 ||
    group.revenue.transactionVolume > 0

  if (!hasRevenue) {
    missingLegs.push('Revenue viability')
  }

  // Check managing partner leg
  if (!group.managingPartner.id || !group.managingPartner.name) {
    missingLegs.push('Managing Partner')
  }

  // Check technical lead leg
  if (!group.technicalLead.id || !group.technicalLead.name) {
    missingLegs.push('Technical Lead')
  }

  // Determine stability
  const legCount = 3 - missingLegs.length
  const strength =
    legCount === 3 ? 'stable' :
    legCount === 2 ? 'wobbly' :
    'unstable'

  return {
    isViable: missingLegs.length === 0,
    missingLegs,
    strength,
  }
}

// =============================================================================
// TABERNACLE HEALTH
// =============================================================================

export function assessTabernacleHealth(practiceGroups: PracticeGroupLegs[]): {
  totalLegs: number
  stableGroups: number
  wobblyGroups: number
  unstableGroups: number
  overallStrength: 'strong' | 'developing' | 'at-risk'
  readyForScale: boolean
} {
  let stableGroups = 0
  let wobblyGroups = 0
  let unstableGroups = 0

  for (const group of practiceGroups) {
    const { strength } = validatePracticeGroup(group)
    if (strength === 'stable') stableGroups++
    else if (strength === 'wobbly') wobblyGroups++
    else unstableGroups++
  }

  const totalLegs = (stableGroups * 3) + (wobblyGroups * 2) + unstableGroups

  // Overall strength assessment
  const overallStrength =
    stableGroups >= 10 ? 'strong' :
    stableGroups >= 6 ? 'developing' :
    'at-risk'

  // Ready for scale when we have 12 stable practice groups
  const readyForScale = stableGroups >= 12

  return {
    totalLegs,
    stableGroups,
    wobblyGroups,
    unstableGroups,
    overallStrength,
    readyForScale,
  }
}

export default ETHOS
