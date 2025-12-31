/**
 * Partner Referral System Types
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type PartnerType = 'affiliate' | 'reseller' | 'agency' | 'strategic'

export type PartnerTier = 'starter' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'elite'

export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'terminated'

export type CommissionType = 'percentage' | 'flat' | 'hybrid'

export type PaymentMethod = 'bank' | 'paypal' | 'crypto' | 'check'

// ============================================================================
// PARTNER
// ============================================================================

export interface Partner {
  id: string
  userId: string

  // Info
  name: string
  companyName?: string
  email: string
  phone?: string
  website?: string

  // Type & Tier
  partnerType: PartnerType
  tier: PartnerTier

  // Referral
  referralCode: string
  customLink?: string

  // Commission
  commissionRate: number
  commissionType: CommissionType
  flatCommission?: number
  recurringCommission: boolean
  recurringMonths: number

  // Payment
  paymentMethod: PaymentMethod
  paymentEmail?: string
  bankAccountId?: string
  cryptoWallet?: string
  minimumPayout: number

  // Stats
  totalReferrals: number
  activeReferrals: number
  totalRevenueGenerated: number
  totalCommissionsEarned: number
  totalCommissionsPaid: number
  pendingCommission: number

  // Status
  status: PartnerStatus
  approvedAt?: Date
  approvedBy?: string

  // Metadata
  notes?: string
  tags?: string[]
  metadata?: Record<string, unknown>

  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// TIER CONFIG
// ============================================================================

export interface TierConfig {
  id: PartnerTier
  name: string
  minReferrals: number
  minRevenue: number
  baseCommissionRate: number
  bonusCommissionRate: number
  dedicatedSupport: boolean
  customLandingPages: boolean
  apiAccess: boolean
  whiteLabel: boolean
  coMarketing: boolean
  earlyAccess: boolean
  color: string
  badgeUrl?: string
}

// ============================================================================
// REFERRAL
// ============================================================================

export type ReferralStatus = 'clicked' | 'signed_up' | 'qualified' | 'active' | 'churned' | 'refunded'

export interface Referral {
  id: string
  partnerId: string

  // Referred User
  referredUserId: string
  referredEmail?: string
  referredName?: string

  // Attribution
  referralCode: string
  landingPage?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  ipAddress?: string
  userAgent?: string

  // Conversion
  clickedAt?: Date
  signedUpAt?: Date
  firstPurchaseAt?: Date
  qualifiedAt?: Date

  // Status & Revenue
  status: ReferralStatus
  totalRevenue: number
  totalTransactions: number

  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// COMMISSION
// ============================================================================

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'cancelled' | 'refunded'

export type TransactionType = 'signup' | 'purchase' | 'subscription' | 'renewal'

export interface Commission {
  id: string
  partnerId: string
  referralId: string

  // Transaction
  transactionId?: string
  transactionType: TransactionType
  transactionAmount: number
  transactionDate: Date

  // Commission
  commissionRate: number
  commissionType: CommissionType | 'bonus'
  commissionAmount: number

  // Recurring
  isRecurring: boolean
  recurringMonth?: number

  // Status
  status: CommissionStatus
  approvedAt?: Date
  approvedBy?: string

  // Payout
  payoutId?: string
  paidAt?: Date

  notes?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

// ============================================================================
// PAYOUT
// ============================================================================

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Payout {
  id: string
  partnerId: string

  amount: number
  currency: string
  paymentMethod: PaymentMethod

  periodStart: Date
  periodEnd: Date
  commissionCount: number

  status: PayoutStatus
  processedAt?: Date
  completedAt?: Date
  failedAt?: Date
  failureReason?: string

  paymentReference?: string
  paymentDetails?: Record<string, unknown>

  notes?: string
  createdAt: Date
}

// ============================================================================
// REFERRAL CLICK
// ============================================================================

export interface ReferralClick {
  id: string
  partnerId: string
  referralCode: string

  ipAddress?: string
  userAgent?: string
  referer?: string
  landingPage?: string

  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string

  converted: boolean
  referralId?: string

  clickedAt: Date
}

// ============================================================================
// PARTNER LINK
// ============================================================================

export interface PartnerLink {
  id: string
  partnerId: string

  name: string
  slug: string
  destinationUrl: string

  utmSource?: string
  utmMedium?: string
  utmCampaign?: string

  clickCount: number
  conversionCount: number
  isActive: boolean

  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// PARTNER APPLICATION
// ============================================================================

export type ApplicationStatus = 'pending' | 'reviewing' | 'approved' | 'rejected'

export interface PartnerApplication {
  id: string
  userId?: string

  name: string
  email: string
  phone?: string
  companyName?: string
  website?: string

  partnerType: PartnerType
  audienceSize?: string
  audienceDescription?: string
  promotionMethods?: string[]
  monthlyTraffic?: number
  existingPartnerships?: string

  status: ApplicationStatus
  reviewedAt?: Date
  reviewedBy?: string
  rejectionReason?: string

  partnerId?: string

  notes?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

// ============================================================================
// API TYPES
// ============================================================================

export interface PartnerDashboard {
  partner: Partner
  tierConfig: TierConfig
  nextTier?: TierConfig
  recentReferrals: Referral[]
  recentCommissions: Commission[]
  pendingPayout: number
  stats: {
    clicksThisMonth: number
    signupsThisMonth: number
    revenueThisMonth: number
    commissionsThisMonth: number
    conversionRate: number
  }
}

export interface CreatePartnerInput {
  userId: string
  name: string
  email: string
  companyName?: string
  phone?: string
  website?: string
  partnerType?: PartnerType
  paymentMethod?: PaymentMethod
  paymentEmail?: string
}

export interface TrackClickInput {
  referralCode: string
  ipAddress?: string
  userAgent?: string
  referer?: string
  landingPage?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
}

export interface TrackConversionInput {
  referralCode: string
  userId: string
  email?: string
  name?: string
}

export interface RecordTransactionInput {
  userId: string
  transactionId: string
  transactionType: TransactionType
  amount: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  companyName?: string
  tier: PartnerTier
  tierName: string
  totalReferrals: number
  totalRevenueGenerated: number
  totalCommissionsEarned: number
  revenueRank: number
  referralRank: number
}
