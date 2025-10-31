/**
 * GTM Stack Subscription Tiers
 *
 * Freemium model based on transaction volume (Stripe playbook):
 * - Start at $79/mo
 * - Hit volume thresholds → Get discounts
 * - Hit $250K GMV → Stack becomes FREE
 *
 * Why? If someone does $1M in deals, we make $100K in fees.
 * The $948/year GTM stack cost is <1% of revenue.
 * Just give it to them for free.
 *
 * This creates a growth flywheel:
 * 1. User starts with $79/mo stack
 * 2. Wells AI helps close deals
 * 3. Hit volume threshold → Stack becomes free
 * 4. More profit margin → Grow faster
 * 5. Close more deals → Wells AI makes more money
 */

export type SubscriptionTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface TierConfig {
  tier: SubscriptionTier
  name: string
  minGMV: number // Minimum Gross Merchandise Value (annual)
  maxGMV?: number // Maximum GMV (undefined = no limit)
  monthlyCost: number // What user pays for GTM stack
  features: string[]
  color: string // For UI
}

export const SUBSCRIPTION_TIERS: TierConfig[] = [
  {
    tier: 'bronze',
    name: 'Bronze',
    minGMV: 0,
    maxGMV: 50000, // $50K/year
    monthlyCost: 79,
    features: [
      'Notion CRM',
      'Instantly Email Automation',
      'Apollo Prospecting (500 credits/mo)',
      'Cal.com Calendar',
      'Standard support',
    ],
    color: '#CD7F32',
  },
  {
    tier: 'silver',
    name: 'Silver',
    minGMV: 50000, // $50K/year
    maxGMV: 250000, // $250K/year
    monthlyCost: 39,
    features: [
      'Everything in Bronze',
      '50% discount on GTM stack',
      'Apollo Prospecting (1,000 credits/mo)',
      'Priority support',
    ],
    color: '#C0C0C0',
  },
  {
    tier: 'gold',
    name: 'Gold',
    minGMV: 250000, // $250K/year
    maxGMV: 1000000, // $1M/year
    monthlyCost: 0, // FREE!
    features: [
      'Everything in Silver',
      'GTM stack completely FREE',
      'Apollo Prospecting (unlimited)',
      'Priority support',
      'Quarterly business reviews',
    ],
    color: '#FFD700',
  },
  {
    tier: 'platinum',
    name: 'Platinum',
    minGMV: 1000000, // $1M+/year
    monthlyCost: 0, // FREE + extras
    features: [
      'Everything in Gold',
      'Dedicated success manager',
      'Custom playbook development',
      'White-glove onboarding',
      'API access for custom integrations',
      'Monthly strategy sessions',
    ],
    color: '#E5E4E2',
  },
]

/**
 * Calculate user's tier based on GMV (trailing 12 months)
 */
export function calculateTier(trailing12MonthGMV: number): TierConfig {
  // Find the highest tier they qualify for
  for (let i = SUBSCRIPTION_TIERS.length - 1; i >= 0; i--) {
    const tier = SUBSCRIPTION_TIERS[i]
    if (
      trailing12MonthGMV >= tier.minGMV &&
      (!tier.maxGMV || trailing12MonthGMV < tier.maxGMV)
    ) {
      return tier
    }
  }

  // Default to Bronze
  return SUBSCRIPTION_TIERS[0]
}

/**
 * Calculate how much revenue Wells AI makes from this user
 */
export function calculateWellsAIRevenue(
  trailing12MonthGMV: number,
  averageFeePercent: number = 0.10 // 10% default
): {
  gmv: number
  revenue: number
  stackCost: number
  netRevenue: number
  margin: number
} {
  const tier = calculateTier(trailing12MonthGMV)
  const revenue = trailing12MonthGMV * averageFeePercent
  const stackCost = tier.monthlyCost * 12
  const netRevenue = revenue - stackCost
  const margin = (netRevenue / revenue) * 100

  return {
    gmv: trailing12MonthGMV,
    revenue,
    stackCost,
    netRevenue,
    margin,
  }
}

/**
 * Calculate tier upgrade incentive
 *
 * Shows user how close they are to next tier
 */
export function getTierUpgradeIncentive(
  currentGMV: number
): {
  currentTier: TierConfig
  nextTier: TierConfig | null
  gmvNeeded: number
  savings: number
  message: string
} | null {
  const currentTier = calculateTier(currentGMV)
  const currentIndex = SUBSCRIPTION_TIERS.findIndex((t) => t.tier === currentTier.tier)

  // Already at highest tier
  if (currentIndex === SUBSCRIPTION_TIERS.length - 1) {
    return null
  }

  const nextTier = SUBSCRIPTION_TIERS[currentIndex + 1]
  const gmvNeeded = nextTier.minGMV - currentGMV
  const savings = (currentTier.monthlyCost - nextTier.monthlyCost) * 12

  let message = ''
  if (nextTier.monthlyCost === 0) {
    message = `Close $${gmvNeeded.toLocaleString()} more to get your GTM stack for FREE! That's $${savings.toLocaleString()}/year in savings.`
  } else {
    message = `Close $${gmvNeeded.toLocaleString()} more to save $${savings.toLocaleString()}/year on your GTM stack.`
  }

  return {
    currentTier,
    nextTier,
    gmvNeeded,
    savings,
    message,
  }
}

/**
 * Example: Show tier breakdown for different GMV levels
 */
export function exampleTierBreakdown() {
  const gmvLevels = [25000, 100000, 500000, 2000000]

  console.log('GTM Stack Subscription Tiers:\n')

  for (const gmv of gmvLevels) {
    const tier = calculateTier(gmv)
    const economics = calculateWellsAIRevenue(gmv, 0.10)
    const incentive = getTierUpgradeIncentive(gmv)

    console.log(`GMV: $${gmv.toLocaleString()}/year`)
    console.log(`  Tier: ${tier.name}`)
    console.log(`  Monthly cost: $${tier.monthlyCost}`)
    console.log(`  Wells AI revenue: $${economics.revenue.toLocaleString()}`)
    console.log(`  Stack cost: $${economics.stackCost.toLocaleString()}`)
    console.log(`  Net revenue: $${economics.netRevenue.toLocaleString()}`)
    console.log(`  Margin: ${economics.margin.toFixed(1)}%`)

    if (incentive) {
      console.log(`  Incentive: ${incentive.message}`)
    }

    console.log()
  }
}

/**
 * Provision GTM stack based on tier
 *
 * Higher tiers get more features/credits
 */
export function getStackProvisioningForTier(tier: SubscriptionTier): {
  notion: { enabled: boolean }
  instantly: { enabled: boolean; emailsPerMonth: number }
  apollo: { enabled: boolean; creditsPerMonth: number | 'unlimited' }
  calendar: { enabled: boolean }
  support: 'standard' | 'priority' | 'white-glove'
  extras: string[]
} {
  switch (tier) {
    case 'bronze':
      return {
        notion: { enabled: true },
        instantly: { enabled: true, emailsPerMonth: 1000 },
        apollo: { enabled: true, creditsPerMonth: 500 },
        calendar: { enabled: true },
        support: 'standard',
        extras: [],
      }

    case 'silver':
      return {
        notion: { enabled: true },
        instantly: { enabled: true, emailsPerMonth: 2500 },
        apollo: { enabled: true, creditsPerMonth: 1000 },
        calendar: { enabled: true },
        support: 'priority',
        extras: ['Quarterly business review'],
      }

    case 'gold':
      return {
        notion: { enabled: true },
        instantly: { enabled: true, emailsPerMonth: 10000 },
        apollo: { enabled: true, creditsPerMonth: 'unlimited' },
        calendar: { enabled: true },
        support: 'priority',
        extras: ['Quarterly business review', 'Custom reporting'],
      }

    case 'platinum':
      return {
        notion: { enabled: true },
        instantly: { enabled: true, emailsPerMonth: 25000 },
        apollo: { enabled: true, creditsPerMonth: 'unlimited' },
        calendar: { enabled: true },
        support: 'white-glove',
        extras: [
          'Dedicated success manager',
          'Monthly strategy sessions',
          'Custom playbook development',
          'API access',
          'White-glove onboarding',
        ],
      }
  }
}

export default {
  SUBSCRIPTION_TIERS,
  calculateTier,
  calculateWellsAIRevenue,
  getTierUpgradeIncentive,
  getStackProvisioningForTier,
}
