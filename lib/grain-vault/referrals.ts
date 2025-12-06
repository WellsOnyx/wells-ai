/**
 * Grain & Vault Referral System
 * Types, constants, and utilities for the referral program
 */

// ============================================================================
// TYPES
// ============================================================================

export type ReferralTier = 'starter' | 'growth' | 'ambassador'

export type ReferralStatus =
  | 'pending'
  | 'signed_up'
  | 'verified'
  | 'qualified'
  | 'rewarded'
  | 'rejected'
  | 'expired'

export type ReferralCodeStatus = 'active' | 'paused' | 'revoked'

export type RewardType = 'referrer_bonus' | 'referee_bonus' | 'tier_bonus' | 'milestone_bonus'

export type QualificationType =
  | 'signup_only'
  | 'kyc_complete'
  | 'first_deposit'
  | 'first_transaction'

export interface ReferralCode {
  id: string
  userId: string
  code: string
  customCode?: string
  tier: ReferralTier
  rewardAmount: number
  refereeBonus: number
  maxUses?: number
  usesCount: number
  status: ReferralCodeStatus
  totalReferrals: number
  successfulReferrals: number
  totalGrainEarned: number
  createdAt: Date
  updatedAt: Date
  lastUsedAt?: Date
}

export interface Referral {
  id: string
  referrerId: string
  referralCodeId: string
  refereeId?: string
  refereeEmail?: string
  status: ReferralStatus
  qualificationType?: QualificationType
  qualifiedAt?: Date
  referrerReward?: number
  refereeReward?: number
  referrerRewardedAt?: Date
  refereeRewardedAt?: Date
  source?: string
  campaign?: string
  landingPage?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  signedUpAt?: Date
  rewardedAt?: Date
  expiresAt?: Date
}

export interface ReferralReward {
  id: string
  userId: string
  referralId?: string
  amount: number
  type: RewardType
  status: 'pending' | 'credited' | 'failed' | 'reversed'
  transactionId?: string
  description?: string
  createdAt: Date
  creditedAt?: Date
}

export interface ReferralTierConfig {
  tier: ReferralTier
  minSuccessfulReferrals: number
  minTotalVolume?: number
  rewardPerReferral: number
  refereeBonus: number
  customCodeEnabled: boolean
  prioritySupport: boolean
  earlyAccess: boolean
  maxMonthlyRewards?: number
  displayName: string
  description: string
  badgeColor: string
}

export interface ReferralDashboard {
  userId: string
  code: string
  tier: ReferralTier
  status: ReferralCodeStatus
  rewardAmount: number
  totalReferrals: number
  successfulReferrals: number
  totalGrainEarned: number
  pendingReferrals: number
  referralsThisMonth: number
  grainEarnedThisMonth: number
  tierName: string
  badgeColor: string
  customCodeEnabled: boolean
  nextTier?: ReferralTier
  nextTierRequirement?: number
  referralsToNextTier?: number
  createdAt: Date
  lastUsedAt?: Date
}

export interface ReferralLeaderboardEntry {
  userId: string
  code: string
  tier: ReferralTier
  successfulReferrals: number
  totalGrainEarned: number
  tierName: string
  badgeColor: string
  rank: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const REFERRAL_TIERS: ReferralTierConfig[] = [
  {
    tier: 'starter',
    minSuccessfulReferrals: 0,
    rewardPerReferral: 500,
    refereeBonus: 100,
    customCodeEnabled: false,
    prioritySupport: false,
    earlyAccess: false,
    displayName: 'Starter',
    description: 'Welcome to the Grain & Vault referral program',
    badgeColor: '#6B7280' // gray
  },
  {
    tier: 'growth',
    minSuccessfulReferrals: 5,
    rewardPerReferral: 1000,
    refereeBonus: 200,
    customCodeEnabled: true,
    prioritySupport: false,
    earlyAccess: true,
    displayName: 'Growth',
    description: 'Unlocked after 5 successful referrals',
    badgeColor: '#3B82F6' // blue
  },
  {
    tier: 'ambassador',
    minSuccessfulReferrals: 20,
    rewardPerReferral: 2500,
    refereeBonus: 500,
    customCodeEnabled: true,
    prioritySupport: true,
    earlyAccess: true,
    displayName: 'Ambassador',
    description: 'Our top referrers with exclusive perks',
    badgeColor: '#F59E0B' // amber
  }
]

export const DEFAULT_QUALIFICATION_TYPE: QualificationType = 'first_deposit'

export const REFERRAL_EXPIRY_DAYS = 30 // Pending referrals expire after 30 days

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate a random referral code (GV-XXXXXX format)
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'GV-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Validate a custom referral code
 */
export function validateCustomCode(code: string): { valid: boolean; error?: string } {
  if (!code) return { valid: false, error: 'Code is required' }

  // Length check
  if (code.length < 4 || code.length > 20) {
    return { valid: false, error: 'Code must be 4-20 characters' }
  }

  // Alphanumeric only (with optional hyphens)
  if (!/^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$|^[A-Z0-9]{1,2}$/i.test(code)) {
    return { valid: false, error: 'Code must be alphanumeric (hyphens allowed)' }
  }

  // No consecutive hyphens
  if (/--/.test(code)) {
    return { valid: false, error: 'No consecutive hyphens allowed' }
  }

  // Blacklist check
  const blacklist = ['admin', 'grain', 'vault', 'wells', 'onyx', 'test', 'free', 'promo']
  if (blacklist.some(word => code.toLowerCase().includes(word))) {
    return { valid: false, error: 'This code is not available' }
  }

  return { valid: true }
}

/**
 * Get tier config by tier name
 */
export function getTierConfig(tier: ReferralTier): ReferralTierConfig {
  return REFERRAL_TIERS.find(t => t.tier === tier) || REFERRAL_TIERS[0]
}

/**
 * Get tier for a given number of successful referrals
 */
export function getTierForReferrals(successfulReferrals: number): ReferralTierConfig {
  // Sort descending by requirement and find first matching
  const sorted = [...REFERRAL_TIERS].sort((a, b) =>
    b.minSuccessfulReferrals - a.minSuccessfulReferrals
  )
  return sorted.find(t => successfulReferrals >= t.minSuccessfulReferrals) || REFERRAL_TIERS[0]
}

/**
 * Get next tier info
 */
export function getNextTier(currentTier: ReferralTier): ReferralTierConfig | null {
  const tiers = REFERRAL_TIERS
  const currentIndex = tiers.findIndex(t => t.tier === currentTier)
  if (currentIndex < 0 || currentIndex >= tiers.length - 1) return null
  return tiers[currentIndex + 1]
}

/**
 * Calculate referrals needed to reach next tier
 */
export function referralsToNextTier(
  currentTier: ReferralTier,
  successfulReferrals: number
): number | null {
  const next = getNextTier(currentTier)
  if (!next) return null
  return Math.max(0, next.minSuccessfulReferrals - successfulReferrals)
}

/**
 * Format referral link
 */
export function formatReferralLink(code: string, baseUrl?: string): string {
  const base = baseUrl || 'https://grainandvault.com'
  return `${base}/signup?ref=${encodeURIComponent(code)}`
}

/**
 * Parse referral code from URL or query param
 */
export function parseReferralCode(urlOrCode: string): string | null {
  if (!urlOrCode) return null

  // If it's a URL, extract ref param
  if (urlOrCode.startsWith('http')) {
    try {
      const url = new URL(urlOrCode)
      return url.searchParams.get('ref')
    } catch {
      return null
    }
  }

  // Otherwise treat as code directly
  return urlOrCode.toUpperCase()
}

// ============================================================================
// SHARE UTILITIES
// ============================================================================

export interface ShareOptions {
  code: string
  referralLink: string
  platform: 'twitter' | 'linkedin' | 'email' | 'copy'
}

export function getShareText(code: string): string {
  return `Join me on Grain & Vault and earn 100 GRAIN bonus! Use my referral code: ${code}`
}

export function getShareUrls(code: string, referralLink: string): Record<string, string> {
  const text = encodeURIComponent(getShareText(code))
  const url = encodeURIComponent(referralLink)

  return {
    twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    email: `mailto:?subject=${encodeURIComponent('Join me on Grain & Vault')}&body=${text}%0A%0A${url}`
  }
}
