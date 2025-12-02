/**
 * Wells AI Trust & Reputation System
 *
 * "A good name is more desirable than great riches;
 *  to be esteemed is better than silver or gold." - Proverbs 22:1
 *
 * Trust is earned through:
 * - Completed deals
 * - On-time delivery
 * - Clean dispute history
 * - Platform tenure
 * - Verification level
 * - Payment reliability
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TrustScore {
  overall: number // 0-100
  factors: TrustFactors
  tier: TrustTier
  badges: TrustBadge[]
  lastUpdated: Date
}

export interface TrustFactors {
  completionRate: number      // 0-100: % of deals completed successfully
  onTimeRate: number          // 0-100: % of deals delivered on time
  disputeRate: number         // 0-100: inverted (100 = no disputes)
  tenureScore: number         // 0-100: based on months on platform
  verificationScore: number   // 0-100: based on verification level
  paymentScore: number        // 0-100: payment reliability
  volumeScore: number         // 0-100: total deal volume
  responseScore: number       // 0-100: response time and rate
}

export type TrustTier =
  | 'new'           // Just joined, < 3 deals
  | 'verified'      // Completed KYC/KYB
  | 'established'   // 3+ successful deals
  | 'trusted'       // 10+ deals, 90%+ completion
  | 'elite'         // 50+ deals, 95%+ completion, < 1% disputes
  | 'legendary'     // 100+ deals, 99%+ completion, 0 disputes

export type TrustBadge =
  | 'fast_responder'      // < 1hr average response
  | 'perfect_delivery'    // 100% on-time
  | 'high_volume'         // > $1M in deals
  | 'zero_disputes'       // No disputes ever
  | 'early_adopter'       // Joined in first 6 months
  | 'verified_business'   // Full business verification
  | 'payment_perfect'     // Never missed a payment

// ============================================================================
// TRUST CALCULATION WEIGHTS
// ============================================================================

const WEIGHTS = {
  completionRate: 0.25,     // Most important - did you finish?
  onTimeRate: 0.15,         // Second - were you on time?
  disputeRate: 0.20,        // Very important - any problems?
  paymentScore: 0.15,       // Did you pay reliably?
  tenureScore: 0.10,        // How long on platform?
  verificationScore: 0.05,  // Are you verified?
  volumeScore: 0.05,        // How much business?
  responseScore: 0.05,      // How responsive?
}

// ============================================================================
// RAW METRICS INPUT
// ============================================================================

export interface TrustMetrics {
  totalDeals: number
  completedDeals: number
  cancelledDeals: number
  disputedDeals: number
  disputesLost: number
  onTimeDeliveries: number
  lateDeliveries: number
  totalVolume: number        // In cents
  accountCreatedAt: Date
  verificationLevel: 'none' | 'email' | 'phone' | 'kyc' | 'kyb'
  averageResponseMinutes: number
  missedPayments: number
  totalPayments: number
}

// ============================================================================
// CORE CALCULATION
// ============================================================================

/**
 * Calculate trust score from raw metrics
 */
export function calculateTrustScore(metrics: TrustMetrics): TrustScore {
  const factors = calculateFactors(metrics)
  const overall = calculateOverallScore(factors)
  const tier = determineTier(metrics, overall)
  const badges = determineBadges(metrics, factors)

  return {
    overall: Math.round(overall),
    factors,
    tier,
    badges,
    lastUpdated: new Date(),
  }
}

/**
 * Calculate individual trust factors
 */
function calculateFactors(metrics: TrustMetrics): TrustFactors {
  const { totalDeals, completedDeals, disputedDeals, onTimeDeliveries, lateDeliveries } = metrics

  // Completion rate: completed / (completed + cancelled)
  const completionRate = totalDeals > 0
    ? (completedDeals / totalDeals) * 100
    : 50 // Default for new users

  // On-time rate
  const totalDeliveries = onTimeDeliveries + lateDeliveries
  const onTimeRate = totalDeliveries > 0
    ? (onTimeDeliveries / totalDeliveries) * 100
    : 50

  // Dispute rate (inverted - higher is better)
  const disputeRate = totalDeals > 0
    ? Math.max(0, 100 - (disputedDeals / totalDeals) * 100)
    : 100

  // Tenure score (caps at 24 months = 100)
  const monthsOnPlatform = Math.floor(
    (Date.now() - metrics.accountCreatedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)
  )
  const tenureScore = Math.min(monthsOnPlatform * 4.17, 100) // 24 months = 100

  // Verification score
  const verificationScores: Record<string, number> = {
    none: 0,
    email: 20,
    phone: 40,
    kyc: 70,
    kyb: 100,
  }
  const verificationScore = verificationScores[metrics.verificationLevel] || 0

  // Payment score
  const paymentScore = metrics.totalPayments > 0
    ? Math.max(0, 100 - (metrics.missedPayments / metrics.totalPayments) * 100)
    : 50

  // Volume score (logarithmic, caps at $10M)
  const volumeInDollars = metrics.totalVolume / 100
  const volumeScore = volumeInDollars > 0
    ? Math.min(Math.log10(volumeInDollars) / 7 * 100, 100)
    : 0

  // Response score (< 15 min = 100, > 24hr = 0)
  const responseScore = Math.max(0, Math.min(100, 100 - (metrics.averageResponseMinutes / 14.4)))

  return {
    completionRate: Math.round(completionRate),
    onTimeRate: Math.round(onTimeRate),
    disputeRate: Math.round(disputeRate),
    tenureScore: Math.round(tenureScore),
    verificationScore: Math.round(verificationScore),
    paymentScore: Math.round(paymentScore),
    volumeScore: Math.round(volumeScore),
    responseScore: Math.round(responseScore),
  }
}

/**
 * Calculate weighted overall score
 */
function calculateOverallScore(factors: TrustFactors): number {
  return (
    factors.completionRate * WEIGHTS.completionRate +
    factors.onTimeRate * WEIGHTS.onTimeRate +
    factors.disputeRate * WEIGHTS.disputeRate +
    factors.tenureScore * WEIGHTS.tenureScore +
    factors.verificationScore * WEIGHTS.verificationScore +
    factors.paymentScore * WEIGHTS.paymentScore +
    factors.volumeScore * WEIGHTS.volumeScore +
    factors.responseScore * WEIGHTS.responseScore
  )
}

/**
 * Determine trust tier based on metrics and score
 */
function determineTier(metrics: TrustMetrics, overall: number): TrustTier {
  const { totalDeals, completedDeals, disputedDeals, verificationLevel } = metrics

  if (totalDeals < 3) {
    return verificationLevel === 'kyb' || verificationLevel === 'kyc'
      ? 'verified'
      : 'new'
  }

  const completionRate = completedDeals / totalDeals
  const disputeRate = disputedDeals / totalDeals

  // Legendary: 100+ deals, 99%+ completion, 0 disputes
  if (totalDeals >= 100 && completionRate >= 0.99 && disputedDeals === 0) {
    return 'legendary'
  }

  // Elite: 50+ deals, 95%+ completion, < 1% disputes
  if (totalDeals >= 50 && completionRate >= 0.95 && disputeRate < 0.01) {
    return 'elite'
  }

  // Trusted: 10+ deals, 90%+ completion
  if (totalDeals >= 10 && completionRate >= 0.90) {
    return 'trusted'
  }

  // Established: 3+ successful deals
  if (completedDeals >= 3) {
    return 'established'
  }

  return 'verified'
}

/**
 * Determine earned badges
 */
function determineBadges(metrics: TrustMetrics, factors: TrustFactors): TrustBadge[] {
  const badges: TrustBadge[] = []

  // Fast responder: < 60 min average
  if (metrics.averageResponseMinutes < 60) {
    badges.push('fast_responder')
  }

  // Perfect delivery: 100% on-time with 5+ deliveries
  if (factors.onTimeRate === 100 && metrics.onTimeDeliveries >= 5) {
    badges.push('perfect_delivery')
  }

  // High volume: > $1M in deals
  if (metrics.totalVolume >= 100000000) {
    badges.push('high_volume')
  }

  // Zero disputes: no disputes ever with 5+ deals
  if (metrics.disputedDeals === 0 && metrics.totalDeals >= 5) {
    badges.push('zero_disputes')
  }

  // Verified business: KYB complete
  if (metrics.verificationLevel === 'kyb') {
    badges.push('verified_business')
  }

  // Payment perfect: no missed payments with 5+ payments
  if (metrics.missedPayments === 0 && metrics.totalPayments >= 5) {
    badges.push('payment_perfect')
  }

  // Early adopter: check if joined before cutoff date
  const earlyAdopterCutoff = new Date('2025-06-01')
  if (metrics.accountCreatedAt < earlyAdopterCutoff) {
    badges.push('early_adopter')
  }

  return badges
}

// ============================================================================
// TRUST-BASED FEATURES
// ============================================================================

/**
 * Get maximum deal size allowed based on trust tier
 */
export function getMaxDealSize(tier: TrustTier): number {
  const limits: Record<TrustTier, number> = {
    new: 500000,          // $5,000
    verified: 2500000,    // $25,000
    established: 10000000, // $100,000
    trusted: 50000000,    // $500,000
    elite: 100000000,     // $1,000,000
    legendary: -1,        // Unlimited
  }
  return limits[tier]
}

/**
 * Get escrow release delay based on trust
 * Higher trust = faster release
 */
export function getEscrowReleaseDelay(buyerTier: TrustTier, sellerTier: TrustTier): number {
  // Return delay in hours
  const tierValue = (tier: TrustTier): number => {
    const values: Record<TrustTier, number> = {
      new: 0,
      verified: 1,
      established: 2,
      trusted: 3,
      elite: 4,
      legendary: 5,
    }
    return values[tier]
  }

  const combined = tierValue(buyerTier) + tierValue(sellerTier)

  if (combined >= 9) return 0   // Instant (elite + trusted or better)
  if (combined >= 6) return 24  // 24 hours
  if (combined >= 4) return 48  // 48 hours
  if (combined >= 2) return 72  // 72 hours
  return 168                     // 7 days for new users
}

/**
 * Check if instant payment is allowed
 */
export function canInstantPay(buyerTier: TrustTier, sellerTier: TrustTier): boolean {
  const trustedTiers: TrustTier[] = ['trusted', 'elite', 'legendary']
  return trustedTiers.includes(buyerTier) && trustedTiers.includes(sellerTier)
}

// ============================================================================
// TRUST DISPLAY HELPERS
// ============================================================================

/**
 * Get human-readable tier name
 */
export function getTierDisplayName(tier: TrustTier): string {
  const names: Record<TrustTier, string> = {
    new: 'New Member',
    verified: 'Verified',
    established: 'Established',
    trusted: 'Trusted Partner',
    elite: 'Elite Partner',
    legendary: 'Legendary Partner',
  }
  return names[tier]
}

/**
 * Get tier color for UI
 */
export function getTierColor(tier: TrustTier): string {
  const colors: Record<TrustTier, string> = {
    new: 'gray',
    verified: 'blue',
    established: 'green',
    trusted: 'purple',
    elite: 'amber',
    legendary: 'gradient',
  }
  return colors[tier]
}

/**
 * Get badge display info
 */
export function getBadgeInfo(badge: TrustBadge): { name: string; icon: string; description: string } {
  const info: Record<TrustBadge, { name: string; icon: string; description: string }> = {
    fast_responder: {
      name: 'Fast Responder',
      icon: 'zap',
      description: 'Responds to deals in under 1 hour on average',
    },
    perfect_delivery: {
      name: 'Perfect Delivery',
      icon: 'check-circle',
      description: '100% on-time delivery rate',
    },
    high_volume: {
      name: 'High Volume',
      icon: 'trending-up',
      description: 'Over $1M in completed transactions',
    },
    zero_disputes: {
      name: 'Zero Disputes',
      icon: 'shield',
      description: 'Never had a dispute',
    },
    early_adopter: {
      name: 'Early Adopter',
      icon: 'star',
      description: 'Joined Wells AI early',
    },
    verified_business: {
      name: 'Verified Business',
      icon: 'building',
      description: 'Full business verification complete',
    },
    payment_perfect: {
      name: 'Payment Perfect',
      icon: 'credit-card',
      description: 'Never missed a payment',
    },
  }
  return info[badge]
}

// ============================================================================
// EXPORTS
// ============================================================================

export const TrustSystem = {
  calculateTrustScore,
  getMaxDealSize,
  getEscrowReleaseDelay,
  canInstantPay,
  getTierDisplayName,
  getTierColor,
  getBadgeInfo,
}

export default TrustSystem
