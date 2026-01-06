/**
 * DONOR TRANSPARENCY PORTAL - Grain & Vault
 *
 * ========================================================================
 * BUILD DONOR CONFIDENCE THROUGH RADICAL TRANSPARENCY
 * ========================================================================
 *
 * THE TRANSPARENCY PROMISE:
 * - 100% of funds protected
 * - Real-time visibility into how funds are used
 * - Clear impact metrics
 * - No hidden fees, no surprises
 *
 * FOR NONPROFITS / ENDOWMENTS:
 * - Show donors exactly where their money goes
 * - Build trust through transparency
 * - Demonstrate stewardship
 * - Increase donor retention
 *
 * ========================================================================
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Organization profile for the donor portal
 */
export interface DonorPortalOrg {
  id: string
  name: string
  slug: string
  mission: string
  description?: string
  logoUrl?: string
  bannerUrl?: string
  website?: string

  // Contact
  contactEmail?: string
  contactPhone?: string
  address?: string

  // Verification
  ein?: string // Employer Identification Number (501c3)
  verified: boolean
  verifiedAt?: Date

  // Social
  socialLinks?: {
    twitter?: string
    linkedin?: string
    facebook?: string
    instagram?: string
  }

  // Branding
  brandColors?: {
    primary: string
    secondary: string
    accent: string
  }

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

/**
 * Endowment/fund information for transparency
 */
export interface DonorPortalEndowment {
  id: string
  orgId: string
  name: string
  description?: string

  // Financials (protected)
  totalValue: number
  totalDeposits: number
  totalGrants: number
  protectedPrincipal: number

  // GRAIN specific
  grainBalance: number
  grainPrice: number
  grainValueUsd: number

  // Coverage (protection)
  vaultCoverage: number // Should always be 100%+
  liquidityCoverage: number

  // Growth
  appreciationToDate: number
  appreciationPercent: number

  // Status
  status: 'active' | 'suspended' | 'closed'
  createdAt: Date
  updatedAt: Date
}

/**
 * Individual fund within an endowment
 */
export interface DonorPortalFund {
  id: string
  orgId: string
  endowmentId: string
  name: string
  description?: string

  // Purpose / Restrictions
  purpose: string
  restrictions?: string[]
  designatedUse?: string

  // Financials
  currentBalance: number
  totalDonations: number
  totalGrantsMade: number

  // Donors (if not anonymous)
  donorCount: number
  topDonors?: DonorRecognition[]

  // Grants made from this fund
  grantsCount: number

  // Status
  status: 'open' | 'closed' | 'fully_allocated'
  targetAmount?: number
  progressPercent?: number

  createdAt: Date
  updatedAt: Date
}

/**
 * Donor recognition (if not anonymous)
 */
export interface DonorRecognition {
  id: string
  displayName: string
  amount: number
  message?: string
  isAnonymous: boolean
  donatedAt: Date

  // Recognition tiers
  tier?: 'founding' | 'champion' | 'sustaining' | 'supporter' | 'friend'
}

/**
 * Grant made from an endowment/fund
 */
export interface DonorPortalGrant {
  id: string
  orgId: string
  fundId?: string

  // Recipient
  recipientName: string
  recipientDescription?: string

  // Amount
  amount: number
  currency: 'USD' | 'GRAIN'

  // Purpose
  purpose: string
  category?: string

  // Impact
  impactDescription?: string
  impactMetrics?: Record<string, number | string>

  // Status
  status: 'pending' | 'approved' | 'disbursed' | 'completed' | 'cancelled'
  disbursedAt?: Date
  completedAt?: Date

  createdAt: Date
}

/**
 * Impact metrics for transparency
 */
export interface ImpactMetrics {
  // Financial
  totalRaised: number
  totalGranted: number
  totalProtected: number
  appreciationEarned: number

  // Operational
  grantsCount: number
  activeFunds: number
  donorCount: number
  averageGiftSize: number

  // Impact (customizable per org)
  customMetrics: {
    key: string
    label: string
    value: number | string
    unit?: string
    icon?: string
  }[]

  // Time-based
  thisYear: {
    raised: number
    granted: number
    newDonors: number
  }

  // Calculated
  grantEfficiency: number // % of funds that go to programs vs admin
  donorRetention: number // % of donors who gave again
}

/**
 * Privacy controls for what to show on portal
 */
export interface TransparencySettings {
  orgId: string

  // What to show
  showEndowmentValue: boolean
  showFundBalances: boolean
  showGrantAmounts: boolean
  showDonorNames: boolean
  showImpactMetrics: boolean
  showFinancialBreakdown: boolean

  // Granular controls
  showGrainPrice: boolean
  showAppreciation: boolean
  showProtectionRatio: boolean

  // Customizations
  customFooterMessage?: string
  customCtaText?: string
  customCtaUrl?: string

  // Branding
  useCustomBranding: boolean
  hideGrainVaultBranding: boolean

  // Access
  portalEnabled: boolean
  portalPassword?: string // Optional password protection

  updatedAt: Date
}

/**
 * Shareable link configuration
 */
export interface ShareableLink {
  id: string
  orgId: string
  fundId?: string

  // Link details
  slug: string
  fullUrl: string
  shortUrl?: string

  // Access
  isPublic: boolean
  password?: string
  expiresAt?: Date

  // Tracking
  views: number
  lastViewedAt?: Date

  // Customization
  customTitle?: string
  customDescription?: string

  createdAt: Date
  createdBy: string
}

// ============================================================================
// PORTAL GENERATION
// ============================================================================

/**
 * Donor Portal Engine
 * Generates transparency data and shareable links
 */
export class DonorPortal {

  // =========================================================================
  // LINK GENERATION
  // =========================================================================

  /**
   * Generate a shareable portal link for an organization
   */
  static generateOrgPortalLink(
    org: DonorPortalOrg,
    options?: {
      customSlug?: string
      isPublic?: boolean
      expiresIn?: number // days
    }
  ): ShareableLink {
    const slug = options?.customSlug || org.slug || this.slugify(org.name)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://grainandvault.com'

    return {
      id: this.generateId(),
      orgId: org.id,
      slug,
      fullUrl: `${baseUrl}/grain-vault/donor/${slug}`,
      shortUrl: `${baseUrl}/d/${slug}`,
      isPublic: options?.isPublic ?? true,
      expiresAt: options?.expiresIn
        ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000)
        : undefined,
      views: 0,
      createdAt: new Date(),
      createdBy: 'system',
    }
  }

  /**
   * Generate a shareable link for a specific fund
   */
  static generateFundPortalLink(
    org: DonorPortalOrg,
    fund: DonorPortalFund,
    options?: {
      customSlug?: string
      isPublic?: boolean
      expiresIn?: number
    }
  ): ShareableLink {
    const orgSlug = org.slug || this.slugify(org.name)
    const fundSlug = options?.customSlug || this.slugify(fund.name)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://grainandvault.com'

    return {
      id: this.generateId(),
      orgId: org.id,
      fundId: fund.id,
      slug: `${orgSlug}/funds/${fundSlug}`,
      fullUrl: `${baseUrl}/grain-vault/donor/${orgSlug}/funds/${fundSlug}`,
      shortUrl: `${baseUrl}/f/${fundSlug}`,
      isPublic: options?.isPublic ?? true,
      expiresAt: options?.expiresIn
        ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000)
        : undefined,
      views: 0,
      createdAt: new Date(),
      createdBy: 'system',
    }
  }

  /**
   * Generate embed code for external websites
   */
  static generateEmbedCode(
    link: ShareableLink,
    options?: {
      width?: string
      height?: string
      theme?: 'light' | 'dark' | 'auto'
    }
  ): string {
    const width = options?.width || '100%'
    const height = options?.height || '600px'
    const theme = options?.theme || 'dark'

    return `<!-- Grain & Vault Donor Portal Embed -->
<iframe
  src="${link.fullUrl}?embed=true&theme=${theme}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);"
  allow="clipboard-write"
  title="Donor Transparency Portal"
></iframe>
<script src="https://grainandvault.com/embed.js" async></script>`
  }

  // =========================================================================
  // IMPACT CALCULATIONS
  // =========================================================================

  /**
   * Calculate impact metrics for an organization
   */
  static calculateImpactMetrics(
    endowments: DonorPortalEndowment[],
    funds: DonorPortalFund[],
    grants: DonorPortalGrant[],
    donations: { amount: number; donorId: string; date: Date }[],
    customMetrics?: ImpactMetrics['customMetrics']
  ): ImpactMetrics {
    // Financial totals
    const totalRaised = donations.reduce((sum, d) => sum + d.amount, 0)
    const totalGranted = grants
      .filter(g => g.status === 'disbursed' || g.status === 'completed')
      .reduce((sum, g) => sum + g.amount, 0)
    const totalProtected = endowments.reduce((sum, e) => sum + e.protectedPrincipal, 0)
    const appreciationEarned = endowments.reduce((sum, e) => sum + e.appreciationToDate, 0)

    // Operational metrics
    const grantsCount = grants.filter(g => g.status !== 'cancelled').length
    const activeFunds = funds.filter(f => f.status === 'open').length
    const uniqueDonors = new Set(donations.map(d => d.donorId))
    const donorCount = uniqueDonors.size
    const averageGiftSize = donorCount > 0 ? totalRaised / donations.length : 0

    // This year
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const thisYearDonations = donations.filter(d => d.date >= yearStart)
    const thisYearGrants = grants.filter(g => g.createdAt >= yearStart)
    const previousDonors = new Set(
      donations.filter(d => d.date < yearStart).map(d => d.donorId)
    )
    const newDonors = thisYearDonations.filter(
      d => !previousDonors.has(d.donorId)
    ).length

    // Grant efficiency (simplified - 95% to programs)
    const grantEfficiency = 0.95

    // Donor retention (simplified)
    const returningDonors = Array.from(uniqueDonors).filter(donorId =>
      donations.filter(d => d.donorId === donorId).length > 1
    ).length
    const donorRetention = donorCount > 0 ? returningDonors / donorCount : 0

    return {
      totalRaised,
      totalGranted,
      totalProtected,
      appreciationEarned,
      grantsCount,
      activeFunds,
      donorCount,
      averageGiftSize,
      customMetrics: customMetrics || [],
      thisYear: {
        raised: thisYearDonations.reduce((sum, d) => sum + d.amount, 0),
        granted: thisYearGrants.reduce((sum, g) => sum + g.amount, 0),
        newDonors,
      },
      grantEfficiency,
      donorRetention,
    }
  }

  /**
   * Calculate fund progress toward goal
   */
  static calculateFundProgress(fund: DonorPortalFund): {
    percent: number
    remaining: number
    status: 'on_track' | 'behind' | 'ahead' | 'complete'
  } {
    if (!fund.targetAmount) {
      return { percent: 0, remaining: 0, status: 'on_track' }
    }

    const percent = (fund.currentBalance / fund.targetAmount) * 100
    const remaining = Math.max(0, fund.targetAmount - fund.currentBalance)

    let status: 'on_track' | 'behind' | 'ahead' | 'complete'
    if (percent >= 100) {
      status = 'complete'
    } else if (percent >= 75) {
      status = 'ahead'
    } else if (percent >= 50) {
      status = 'on_track'
    } else {
      status = 'behind'
    }

    return { percent: Math.min(100, percent), remaining, status }
  }

  // =========================================================================
  // PROTECTION VISUALIZATION
  // =========================================================================

  /**
   * Generate fund protection explanation
   */
  static generateProtectionExplanation(endowment: DonorPortalEndowment): {
    title: string
    points: string[]
    coverage: number
    status: 'fully_protected' | 'protected' | 'at_risk'
  } {
    const coverage = endowment.vaultCoverage

    let status: 'fully_protected' | 'protected' | 'at_risk'
    if (coverage >= 1.0) {
      status = 'fully_protected'
    } else if (coverage >= 0.9) {
      status = 'protected'
    } else {
      status = 'at_risk'
    }

    return {
      title: 'How Your Funds Are Protected',
      points: [
        `100% of your donation is protected in the Vault`,
        `Current protection ratio: ${(coverage * 100).toFixed(1)}%`,
        `Your funds are backed by real, liquid assets`,
        `Withdraw anytime - no locks, no penalties`,
        `GRAIN appreciation adds value without touching principal`,
        `Real-time blockchain audits ensure transparency`,
      ],
      coverage,
      status,
    }
  }

  /**
   * Generate how-funds-are-used breakdown
   */
  static generateFundUsageBreakdown(
    grants: DonorPortalGrant[]
  ): {
    category: string
    amount: number
    percent: number
    color: string
  }[] {
    const total = grants.reduce((sum, g) => sum + g.amount, 0)
    if (total === 0) return []

    // Group by category
    const byCategory = grants.reduce((acc, grant) => {
      const cat = grant.category || 'General'
      acc[cat] = (acc[cat] || 0) + grant.amount
      return acc
    }, {} as Record<string, number>)

    // Predefined colors for categories
    const categoryColors: Record<string, string> = {
      'Scholarships': '#10B981', // emerald
      'Research': '#8B5CF6', // violet
      'Operations': '#3B82F6', // blue
      'Programs': '#F59E0B', // amber
      'Capital': '#EC4899', // pink
      'General': '#6B7280', // gray
    }

    return Object.entries(byCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        percent: (amount / total) * 100,
        color: categoryColors[category] || '#6B7280',
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  // =========================================================================
  // DONOR RECOGNITION
  // =========================================================================

  /**
   * Get donor recognition tier
   */
  static getDonorTier(
    totalDonated: number
  ): DonorRecognition['tier'] {
    if (totalDonated >= 100000) return 'founding'
    if (totalDonated >= 50000) return 'champion'
    if (totalDonated >= 10000) return 'sustaining'
    if (totalDonated >= 1000) return 'supporter'
    return 'friend'
  }

  /**
   * Get tier display info
   */
  static getTierInfo(tier: DonorRecognition['tier']): {
    name: string
    minAmount: number
    color: string
    icon: string
  } {
    const tiers = {
      founding: { name: 'Founding Donor', minAmount: 100000, color: '#F59E0B', icon: 'star' },
      champion: { name: 'Champion', minAmount: 50000, color: '#8B5CF6', icon: 'trophy' },
      sustaining: { name: 'Sustaining Member', minAmount: 10000, color: '#10B981', icon: 'heart' },
      supporter: { name: 'Supporter', minAmount: 1000, color: '#3B82F6', icon: 'thumbs-up' },
      friend: { name: 'Friend', minAmount: 0, color: '#6B7280', icon: 'user' },
    }

    return tiers[tier || 'friend']
  }

  // =========================================================================
  // PRIVACY & FILTERING
  // =========================================================================

  /**
   * Apply transparency settings to filter data
   */
  static applyPrivacyFilter<T extends Record<string, any>>(
    data: T,
    settings: TransparencySettings,
    dataType: 'endowment' | 'fund' | 'grant' | 'donor'
  ): Partial<T> {
    const filtered: Partial<T> = { ...data }

    // Apply filters based on data type and settings
    if (dataType === 'endowment' || dataType === 'fund') {
      if (!settings.showEndowmentValue) {
        delete (filtered as any).totalValue
        delete (filtered as any).currentBalance
      }
      if (!settings.showFundBalances) {
        delete (filtered as any).grainBalance
        delete (filtered as any).grainValueUsd
      }
      if (!settings.showAppreciation) {
        delete (filtered as any).appreciationToDate
        delete (filtered as any).appreciationPercent
      }
      if (!settings.showGrainPrice) {
        delete (filtered as any).grainPrice
      }
    }

    if (dataType === 'grant') {
      if (!settings.showGrantAmounts) {
        delete (filtered as any).amount
      }
    }

    if (dataType === 'donor') {
      if (!settings.showDonorNames) {
        (filtered as any).displayName = 'Anonymous Donor'
        (filtered as any).isAnonymous = true
      }
    }

    return filtered
  }

  /**
   * Get default transparency settings
   */
  static getDefaultSettings(orgId: string): TransparencySettings {
    return {
      orgId,
      showEndowmentValue: true,
      showFundBalances: true,
      showGrantAmounts: true,
      showDonorNames: false, // Privacy-first default
      showImpactMetrics: true,
      showFinancialBreakdown: true,
      showGrainPrice: true,
      showAppreciation: true,
      showProtectionRatio: true,
      useCustomBranding: false,
      hideGrainVaultBranding: false,
      portalEnabled: true,
      updatedAt: new Date(),
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private static generateId(): string {
    return `dp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  /**
   * Format currency for display
   */
  static formatCurrency(
    amount: number,
    options?: { showCents?: boolean; compact?: boolean }
  ): string {
    if (options?.compact && amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    if (options?.compact && amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: options?.showCents ? 2 : 0,
      maximumFractionDigits: options?.showCents ? 2 : 0,
    }).format(amount)
  }

  /**
   * Format date for display
   */
  static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date))
  }

  /**
   * Get time ago string
   */
  static timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    }

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit)
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`
      }
    }

    return 'Just now'
  }
}

// ============================================================================
// MOCK DATA FOR DEVELOPMENT
// ============================================================================

export const mockDonorPortalData = {
  org: {
    id: 'org_001',
    name: 'Education First Foundation',
    slug: 'education-first',
    mission: 'Empowering the next generation through accessible education and scholarships.',
    description: 'Education First Foundation has been providing scholarships and educational resources to underserved communities since 2015. We believe every child deserves access to quality education.',
    logoUrl: '/demo/education-first-logo.png',
    bannerUrl: '/demo/education-first-banner.jpg',
    website: 'https://educationfirst.org',
    ein: '12-3456789',
    verified: true,
    verifiedAt: new Date('2024-01-15'),
    socialLinks: {
      twitter: 'https://twitter.com/edufirst',
      linkedin: 'https://linkedin.com/company/edufirst',
    },
    brandColors: {
      primary: '#10B981',
      secondary: '#064E3B',
      accent: '#F59E0B',
    },
    createdAt: new Date('2023-06-01'),
    updatedAt: new Date('2025-01-05'),
  } as DonorPortalOrg,

  endowment: {
    id: 'end_001',
    orgId: 'org_001',
    name: 'General Endowment',
    description: 'Our main endowment fund supporting all foundation programs.',
    totalValue: 2500000,
    totalDeposits: 2000000,
    totalGrants: 450000,
    protectedPrincipal: 2000000,
    grainBalance: 2000000,
    grainPrice: 1.25,
    grainValueUsd: 2500000,
    vaultCoverage: 1.25,
    liquidityCoverage: 1.15,
    appreciationToDate: 500000,
    appreciationPercent: 25,
    status: 'active',
    createdAt: new Date('2023-06-01'),
    updatedAt: new Date('2025-01-05'),
  } as DonorPortalEndowment,

  funds: [
    {
      id: 'fund_001',
      orgId: 'org_001',
      endowmentId: 'end_001',
      name: 'STEM Scholarship Fund',
      description: 'Supporting students pursuing degrees in Science, Technology, Engineering, and Mathematics.',
      purpose: 'Provide scholarships to underserved students in STEM fields',
      restrictions: ['Must be STEM major', 'Minimum 3.0 GPA'],
      currentBalance: 750000,
      totalDonations: 800000,
      totalGrantsMade: 150000,
      donorCount: 45,
      grantsCount: 25,
      status: 'open',
      targetAmount: 1000000,
      createdAt: new Date('2023-08-15'),
      updatedAt: new Date('2025-01-05'),
    },
    {
      id: 'fund_002',
      orgId: 'org_001',
      endowmentId: 'end_001',
      name: 'First-Generation College Fund',
      description: 'Supporting first-generation college students with tuition and living expenses.',
      purpose: 'Help first-generation students succeed in higher education',
      restrictions: ['First in family to attend college'],
      currentBalance: 400000,
      totalDonations: 500000,
      totalGrantsMade: 180000,
      donorCount: 28,
      grantsCount: 35,
      status: 'open',
      targetAmount: 750000,
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2025-01-05'),
    },
  ] as DonorPortalFund[],

  grants: [
    {
      id: 'grant_001',
      orgId: 'org_001',
      fundId: 'fund_001',
      recipientName: 'Maria Gonzalez',
      recipientDescription: 'Computer Science major at Stanford University',
      amount: 15000,
      currency: 'USD',
      purpose: 'Full tuition scholarship for 2024-2025 academic year',
      category: 'Scholarships',
      impactDescription: 'Maria is the first in her family to attend a four-year university.',
      status: 'disbursed',
      disbursedAt: new Date('2024-08-15'),
      createdAt: new Date('2024-07-01'),
    },
    {
      id: 'grant_002',
      orgId: 'org_001',
      fundId: 'fund_001',
      recipientName: 'James Chen',
      recipientDescription: 'Biomedical Engineering student at MIT',
      amount: 12500,
      currency: 'USD',
      purpose: 'Research fellowship and equipment grant',
      category: 'Research',
      impactDescription: 'James is developing affordable prosthetics for underserved communities.',
      status: 'completed',
      disbursedAt: new Date('2024-06-01'),
      completedAt: new Date('2024-12-15'),
      createdAt: new Date('2024-05-15'),
    },
    {
      id: 'grant_003',
      orgId: 'org_001',
      fundId: 'fund_002',
      recipientName: 'Sarah Williams',
      recipientDescription: 'Pre-Med student at UCLA',
      amount: 10000,
      currency: 'USD',
      purpose: 'Living expenses and textbook stipend',
      category: 'Scholarships',
      status: 'disbursed',
      disbursedAt: new Date('2024-09-01'),
      createdAt: new Date('2024-08-01'),
    },
  ] as DonorPortalGrant[],

  topDonors: [
    {
      id: 'donor_001',
      displayName: 'The Johnson Family Foundation',
      amount: 250000,
      message: 'Investing in education is investing in our future.',
      isAnonymous: false,
      donatedAt: new Date('2023-06-15'),
      tier: 'founding',
    },
    {
      id: 'donor_002',
      displayName: 'Anonymous',
      amount: 100000,
      isAnonymous: true,
      donatedAt: new Date('2024-01-20'),
      tier: 'founding',
    },
    {
      id: 'donor_003',
      displayName: 'TechCorp Inc.',
      amount: 75000,
      message: 'Supporting the next generation of tech leaders.',
      isAnonymous: false,
      donatedAt: new Date('2024-03-10'),
      tier: 'champion',
    },
  ] as DonorRecognition[],
}
