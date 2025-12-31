/**
 * Partner Referral System Service
 *
 * Handles all partner operations: registration, tracking, commissions, payouts
 */

import { sql } from '@/lib/db'
import {
  Partner,
  PartnerTier,
  TierConfig,
  Referral,
  Commission,
  Payout,
  ReferralClick,
  PartnerLink,
  PartnerApplication,
  PartnerDashboard,
  CreatePartnerInput,
  TrackClickInput,
  TrackConversionInput,
  RecordTransactionInput,
  LeaderboardEntry,
  CommissionStatus,
  PayoutStatus,
} from './types'

// ============================================================================
// PARTNER MANAGEMENT
// ============================================================================

export async function createPartner(input: CreatePartnerInput): Promise<Partner> {
  const referralCode = generateReferralCode(input.name)

  const result = await sql`
    INSERT INTO partners (
      user_id, name, email, company_name, phone, website,
      partner_type, referral_code, payment_method, payment_email
    ) VALUES (
      ${input.userId},
      ${input.name},
      ${input.email},
      ${input.companyName || null},
      ${input.phone || null},
      ${input.website || null},
      ${input.partnerType || 'affiliate'},
      ${referralCode},
      ${input.paymentMethod || 'bank'},
      ${input.paymentEmail || input.email}
    )
    RETURNING *
  `

  return mapPartnerRow(result[0])
}

export async function getPartner(userId: string): Promise<Partner | null> {
  const result = await sql`
    SELECT * FROM partners WHERE user_id = ${userId}
  `

  if (result.length === 0) return null
  return mapPartnerRow(result[0])
}

export async function getPartnerById(partnerId: string): Promise<Partner | null> {
  const result = await sql`
    SELECT * FROM partners WHERE id = ${partnerId}
  `

  if (result.length === 0) return null
  return mapPartnerRow(result[0])
}

export async function getPartnerByCode(referralCode: string): Promise<Partner | null> {
  const result = await sql`
    SELECT * FROM partners WHERE referral_code = ${referralCode} AND status = 'active'
  `

  if (result.length === 0) return null
  return mapPartnerRow(result[0])
}

export async function updatePartner(
  partnerId: string,
  updates: Partial<Partner>
): Promise<Partner> {
  const result = await sql`
    UPDATE partners SET
      name = COALESCE(${updates.name}, name),
      company_name = COALESCE(${updates.companyName}, company_name),
      email = COALESCE(${updates.email}, email),
      phone = COALESCE(${updates.phone}, phone),
      website = COALESCE(${updates.website}, website),
      payment_method = COALESCE(${updates.paymentMethod}, payment_method),
      payment_email = COALESCE(${updates.paymentEmail}, payment_email),
      updated_at = NOW()
    WHERE id = ${partnerId}
    RETURNING *
  `

  return mapPartnerRow(result[0])
}

export async function activatePartner(partnerId: string, approvedBy: string): Promise<Partner> {
  const result = await sql`
    UPDATE partners SET
      status = 'active',
      approved_at = NOW(),
      approved_by = ${approvedBy},
      updated_at = NOW()
    WHERE id = ${partnerId}
    RETURNING *
  `

  return mapPartnerRow(result[0])
}

function generateReferralCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase()
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}${suffix}`
}

// ============================================================================
// TIER MANAGEMENT
// ============================================================================

export async function getTierConfig(tier: PartnerTier): Promise<TierConfig | null> {
  const result = await sql`
    SELECT * FROM partner_tiers WHERE id = ${tier}
  `

  if (result.length === 0) return null
  return mapTierRow(result[0])
}

export async function getAllTiers(): Promise<TierConfig[]> {
  const result = await sql`
    SELECT * FROM partner_tiers ORDER BY display_order ASC
  `

  return result.map(mapTierRow)
}

export async function checkTierUpgrade(partnerId: string): Promise<PartnerTier | null> {
  const partner = await getPartnerById(partnerId)
  if (!partner) return null

  const tiers = await getAllTiers()
  const currentTierIndex = tiers.findIndex(t => t.id === partner.tier)

  // Check if eligible for next tier
  for (let i = currentTierIndex + 1; i < tiers.length; i++) {
    const nextTier = tiers[i]
    if (
      partner.totalReferrals >= nextTier.minReferrals &&
      partner.totalRevenueGenerated >= nextTier.minRevenue
    ) {
      // Upgrade to this tier
      await sql`
        UPDATE partners SET
          tier = ${nextTier.id},
          commission_rate = ${nextTier.baseCommissionRate},
          updated_at = NOW()
        WHERE id = ${partnerId}
      `
      return nextTier.id
    }
  }

  return null
}

// ============================================================================
// CLICK TRACKING
// ============================================================================

export async function trackClick(input: TrackClickInput): Promise<ReferralClick | null> {
  const partner = await getPartnerByCode(input.referralCode)
  if (!partner) return null

  const result = await sql`
    INSERT INTO referral_clicks (
      partner_id, referral_code, ip_address, user_agent, referer,
      landing_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content
    ) VALUES (
      ${partner.id},
      ${input.referralCode},
      ${input.ipAddress || null},
      ${input.userAgent || null},
      ${input.referer || null},
      ${input.landingPage || null},
      ${input.utmSource || null},
      ${input.utmMedium || null},
      ${input.utmCampaign || null},
      ${input.utmTerm || null},
      ${input.utmContent || null}
    )
    RETURNING *
  `

  return mapClickRow(result[0])
}

export async function getClickStats(partnerId: string, days: number = 30): Promise<{
  totalClicks: number
  uniqueClicks: number
  conversions: number
  conversionRate: number
}> {
  const result = await sql`
    SELECT
      COUNT(*) as total_clicks,
      COUNT(DISTINCT ip_address) as unique_clicks,
      COUNT(*) FILTER (WHERE converted = true) as conversions
    FROM referral_clicks
    WHERE partner_id = ${partnerId}
    AND clicked_at >= NOW() - INTERVAL '1 day' * ${days}
  `

  const row = result[0]
  const totalClicks = Number(row.total_clicks)
  const conversions = Number(row.conversions)

  return {
    totalClicks,
    uniqueClicks: Number(row.unique_clicks),
    conversions,
    conversionRate: totalClicks > 0 ? conversions / totalClicks : 0,
  }
}

// ============================================================================
// REFERRAL TRACKING
// ============================================================================

export async function trackConversion(input: TrackConversionInput): Promise<Referral | null> {
  const partner = await getPartnerByCode(input.referralCode)
  if (!partner) return null

  // Check if user already referred
  const existing = await sql`
    SELECT * FROM referrals WHERE referred_user_id = ${input.userId}
  `
  if (existing.length > 0) return mapReferralRow(existing[0])

  // Create referral
  const result = await sql`
    INSERT INTO referrals (
      partner_id, referred_user_id, referred_email, referred_name,
      referral_code, status, signed_up_at
    ) VALUES (
      ${partner.id},
      ${input.userId},
      ${input.email || null},
      ${input.name || null},
      ${input.referralCode},
      'signed_up',
      NOW()
    )
    RETURNING *
  `

  // Update partner stats
  await sql`
    UPDATE partners SET
      total_referrals = total_referrals + 1,
      active_referrals = active_referrals + 1,
      updated_at = NOW()
    WHERE id = ${partner.id}
  `

  // Mark click as converted (most recent from same IP if available)
  await sql`
    UPDATE referral_clicks SET
      converted = true,
      referral_id = ${result[0].id}
    WHERE partner_id = ${partner.id}
    AND referral_code = ${input.referralCode}
    AND converted = false
    ORDER BY clicked_at DESC
    LIMIT 1
  `

  return mapReferralRow(result[0])
}

export async function getReferral(referralId: string): Promise<Referral | null> {
  const result = await sql`
    SELECT * FROM referrals WHERE id = ${referralId}
  `

  if (result.length === 0) return null
  return mapReferralRow(result[0])
}

export async function getReferralByUser(userId: string): Promise<Referral | null> {
  const result = await sql`
    SELECT * FROM referrals WHERE referred_user_id = ${userId}
  `

  if (result.length === 0) return null
  return mapReferralRow(result[0])
}

export async function getPartnerReferrals(
  partnerId: string,
  limit: number = 50
): Promise<Referral[]> {
  const result = await sql`
    SELECT * FROM referrals
    WHERE partner_id = ${partnerId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  return result.map(mapReferralRow)
}

export async function updateReferralStatus(
  referralId: string,
  status: Referral['status']
): Promise<Referral> {
  const updateFields: Record<string, string> = {
    qualified: 'qualified_at = NOW(),',
    active: 'first_purchase_at = NOW(),',
  }

  const result = await sql`
    UPDATE referrals SET
      status = ${status},
      ${sql.unsafe(updateFields[status] || '')}
      updated_at = NOW()
    WHERE id = ${referralId}
    RETURNING *
  `

  return mapReferralRow(result[0])
}

// ============================================================================
// COMMISSION CALCULATION
// ============================================================================

export async function recordTransaction(input: RecordTransactionInput): Promise<Commission | null> {
  // Find referral for this user
  const referral = await getReferralByUser(input.userId)
  if (!referral) return null

  const partner = await getPartnerById(referral.partnerId)
  if (!partner || partner.status !== 'active') return null

  // Check if still within recurring window
  const referralAge = Math.floor(
    (Date.now() - new Date(referral.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000)
  )

  if (!partner.recurringCommission && referralAge > 0) return null
  if (partner.recurringCommission && referralAge >= partner.recurringMonths) return null

  // Calculate commission
  let commissionAmount: number
  if (partner.commissionType === 'flat') {
    commissionAmount = partner.flatCommission || 0
  } else if (partner.commissionType === 'hybrid') {
    commissionAmount = (input.amount * partner.commissionRate) + (partner.flatCommission || 0)
  } else {
    commissionAmount = input.amount * partner.commissionRate
  }

  // Create commission record
  const result = await sql`
    INSERT INTO commissions (
      partner_id, referral_id, transaction_id, transaction_type,
      transaction_amount, transaction_date, commission_rate,
      commission_type, commission_amount, is_recurring, recurring_month
    ) VALUES (
      ${partner.id},
      ${referral.id},
      ${input.transactionId},
      ${input.transactionType},
      ${input.amount},
      NOW(),
      ${partner.commissionRate},
      ${partner.commissionType},
      ${commissionAmount},
      ${referralAge > 0},
      ${referralAge > 0 ? referralAge : null}
    )
    RETURNING *
  `

  // Update partner stats
  await sql`
    UPDATE partners SET
      total_revenue_generated = total_revenue_generated + ${input.amount},
      total_commissions_earned = total_commissions_earned + ${commissionAmount},
      pending_commission = pending_commission + ${commissionAmount},
      updated_at = NOW()
    WHERE id = ${partner.id}
  `

  // Update referral stats
  await sql`
    UPDATE referrals SET
      total_revenue = total_revenue + ${input.amount},
      total_transactions = total_transactions + 1,
      status = CASE WHEN status = 'signed_up' THEN 'qualified' ELSE status END,
      qualified_at = CASE WHEN status = 'signed_up' THEN NOW() ELSE qualified_at END,
      updated_at = NOW()
    WHERE id = ${referral.id}
  `

  // Check for tier upgrade
  await checkTierUpgrade(partner.id)

  return mapCommissionRow(result[0])
}

export async function getPartnerCommissions(
  partnerId: string,
  status?: CommissionStatus,
  limit: number = 50
): Promise<Commission[]> {
  const result = status
    ? await sql`
        SELECT * FROM commissions
        WHERE partner_id = ${partnerId} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT * FROM commissions
        WHERE partner_id = ${partnerId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `

  return result.map(mapCommissionRow)
}

export async function approveCommission(
  commissionId: string,
  approvedBy: string
): Promise<Commission> {
  const result = await sql`
    UPDATE commissions SET
      status = 'approved',
      approved_at = NOW(),
      approved_by = ${approvedBy}
    WHERE id = ${commissionId}
    RETURNING *
  `

  return mapCommissionRow(result[0])
}

export async function bulkApproveCommissions(
  partnerId: string,
  approvedBy: string
): Promise<number> {
  const result = await sql`
    UPDATE commissions SET
      status = 'approved',
      approved_at = NOW(),
      approved_by = ${approvedBy}
    WHERE partner_id = ${partnerId}
    AND status = 'pending'
  `

  return result.length
}

// ============================================================================
// PAYOUTS
// ============================================================================

export async function createPayout(partnerId: string): Promise<Payout | null> {
  const partner = await getPartnerById(partnerId)
  if (!partner) return null

  // Get approved commissions not yet paid
  const approvedCommissions = await sql`
    SELECT * FROM commissions
    WHERE partner_id = ${partnerId}
    AND status = 'approved'
    AND payout_id IS NULL
  `

  if (approvedCommissions.length === 0) return null

  const totalAmount = approvedCommissions.reduce(
    (sum, c) => sum + Number(c.commission_amount),
    0
  )

  if (totalAmount < partner.minimumPayout) return null

  // Find period range
  const dates = approvedCommissions.map(c => new Date(c.created_at))
  const periodStart = new Date(Math.min(...dates.map(d => d.getTime())))
  const periodEnd = new Date(Math.max(...dates.map(d => d.getTime())))

  // Create payout
  const result = await sql`
    INSERT INTO partner_payouts (
      partner_id, amount, payment_method, period_start, period_end, commission_count
    ) VALUES (
      ${partnerId},
      ${totalAmount},
      ${partner.paymentMethod},
      ${periodStart.toISOString().split('T')[0]},
      ${periodEnd.toISOString().split('T')[0]},
      ${approvedCommissions.length}
    )
    RETURNING *
  `

  const payoutId = result[0].id

  // Link commissions to payout
  await sql`
    UPDATE commissions SET
      payout_id = ${payoutId}
    WHERE partner_id = ${partnerId}
    AND status = 'approved'
    AND payout_id IS NULL
  `

  return mapPayoutRow(result[0])
}

export async function processPayout(payoutId: string): Promise<Payout> {
  const result = await sql`
    UPDATE partner_payouts SET
      status = 'processing',
      processed_at = NOW()
    WHERE id = ${payoutId}
    RETURNING *
  `

  return mapPayoutRow(result[0])
}

export async function completePayout(
  payoutId: string,
  paymentReference: string,
  paymentDetails?: Record<string, unknown>
): Promise<Payout> {
  const result = await sql`
    UPDATE partner_payouts SET
      status = 'completed',
      completed_at = NOW(),
      payment_reference = ${paymentReference},
      payment_details = ${JSON.stringify(paymentDetails || {})}
    WHERE id = ${payoutId}
    RETURNING *
  `

  const payout = result[0]

  // Mark commissions as paid
  await sql`
    UPDATE commissions SET
      status = 'paid',
      paid_at = NOW()
    WHERE payout_id = ${payoutId}
  `

  // Update partner stats
  await sql`
    UPDATE partners SET
      total_commissions_paid = total_commissions_paid + ${payout.amount},
      pending_commission = pending_commission - ${payout.amount},
      updated_at = NOW()
    WHERE id = ${payout.partner_id}
  `

  return mapPayoutRow(result[0])
}

export async function failPayout(payoutId: string, reason: string): Promise<Payout> {
  const result = await sql`
    UPDATE partner_payouts SET
      status = 'failed',
      failed_at = NOW(),
      failure_reason = ${reason}
    WHERE id = ${payoutId}
    RETURNING *
  `

  // Unlink commissions from payout so they can be retried
  await sql`
    UPDATE commissions SET
      payout_id = NULL
    WHERE payout_id = ${payoutId}
  `

  return mapPayoutRow(result[0])
}

export async function getPartnerPayouts(
  partnerId: string,
  status?: PayoutStatus,
  limit: number = 20
): Promise<Payout[]> {
  const result = status
    ? await sql`
        SELECT * FROM partner_payouts
        WHERE partner_id = ${partnerId} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT * FROM partner_payouts
        WHERE partner_id = ${partnerId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `

  return result.map(mapPayoutRow)
}

// ============================================================================
// PARTNER LINKS
// ============================================================================

export async function createPartnerLink(
  partnerId: string,
  name: string,
  slug: string,
  destinationUrl: string,
  utm?: { source?: string; medium?: string; campaign?: string }
): Promise<PartnerLink> {
  const result = await sql`
    INSERT INTO partner_links (
      partner_id, name, slug, destination_url,
      utm_source, utm_medium, utm_campaign
    ) VALUES (
      ${partnerId},
      ${name},
      ${slug},
      ${destinationUrl},
      ${utm?.source || null},
      ${utm?.medium || null},
      ${utm?.campaign || null}
    )
    RETURNING *
  `

  return mapLinkRow(result[0])
}

export async function getLinkBySlug(slug: string): Promise<PartnerLink | null> {
  const result = await sql`
    SELECT * FROM partner_links WHERE slug = ${slug} AND is_active = true
  `

  if (result.length === 0) return null

  // Increment click count
  await sql`
    UPDATE partner_links SET click_count = click_count + 1 WHERE slug = ${slug}
  `

  return mapLinkRow(result[0])
}

export async function getPartnerLinks(partnerId: string): Promise<PartnerLink[]> {
  const result = await sql`
    SELECT * FROM partner_links
    WHERE partner_id = ${partnerId}
    ORDER BY created_at DESC
  `

  return result.map(mapLinkRow)
}

// ============================================================================
// APPLICATIONS
// ============================================================================

export async function submitApplication(
  application: Omit<PartnerApplication, 'id' | 'status' | 'createdAt'>
): Promise<PartnerApplication> {
  const result = await sql`
    INSERT INTO partner_applications (
      user_id, name, email, phone, company_name, website,
      partner_type, audience_size, audience_description,
      promotion_methods, monthly_traffic, existing_partnerships
    ) VALUES (
      ${application.userId || null},
      ${application.name},
      ${application.email},
      ${application.phone || null},
      ${application.companyName || null},
      ${application.website || null},
      ${application.partnerType},
      ${application.audienceSize || null},
      ${application.audienceDescription || null},
      ${application.promotionMethods || null},
      ${application.monthlyTraffic || null},
      ${application.existingPartnerships || null}
    )
    RETURNING *
  `

  return mapApplicationRow(result[0])
}

export async function getApplication(applicationId: string): Promise<PartnerApplication | null> {
  const result = await sql`
    SELECT * FROM partner_applications WHERE id = ${applicationId}
  `

  if (result.length === 0) return null
  return mapApplicationRow(result[0])
}

export async function getPendingApplications(): Promise<PartnerApplication[]> {
  const result = await sql`
    SELECT * FROM partner_applications
    WHERE status IN ('pending', 'reviewing')
    ORDER BY created_at ASC
  `

  return result.map(mapApplicationRow)
}

export async function approveApplication(
  applicationId: string,
  reviewedBy: string
): Promise<{ application: PartnerApplication; partner: Partner }> {
  const application = await getApplication(applicationId)
  if (!application) throw new Error('Application not found')

  // Create partner
  const partner = await createPartner({
    userId: application.userId || `app_${applicationId}`,
    name: application.name,
    email: application.email,
    companyName: application.companyName,
    phone: application.phone,
    website: application.website,
    partnerType: application.partnerType,
  })

  // Activate partner
  await activatePartner(partner.id, reviewedBy)

  // Update application
  const result = await sql`
    UPDATE partner_applications SET
      status = 'approved',
      reviewed_at = NOW(),
      reviewed_by = ${reviewedBy},
      partner_id = ${partner.id}
    WHERE id = ${applicationId}
    RETURNING *
  `

  return {
    application: mapApplicationRow(result[0]),
    partner: await getPartnerById(partner.id) as Partner,
  }
}

export async function rejectApplication(
  applicationId: string,
  reviewedBy: string,
  reason: string
): Promise<PartnerApplication> {
  const result = await sql`
    UPDATE partner_applications SET
      status = 'rejected',
      reviewed_at = NOW(),
      reviewed_by = ${reviewedBy},
      rejection_reason = ${reason}
    WHERE id = ${applicationId}
    RETURNING *
  `

  return mapApplicationRow(result[0])
}

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

export async function getPartnerDashboard(userId: string): Promise<PartnerDashboard | null> {
  const partner = await getPartner(userId)
  if (!partner) return null

  const tierConfig = await getTierConfig(partner.tier)
  if (!tierConfig) return null

  const tiers = await getAllTiers()
  const currentTierIndex = tiers.findIndex(t => t.id === partner.tier)
  const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : undefined

  const recentReferrals = await getPartnerReferrals(partner.id, 10)
  const recentCommissions = await getPartnerCommissions(partner.id, undefined, 10)
  const clickStats = await getClickStats(partner.id, 30)

  // Get this month's stats
  const monthStats = await sql`
    SELECT
      COALESCE(SUM(commission_amount), 0) as commissions_this_month,
      COALESCE(SUM(transaction_amount), 0) as revenue_this_month
    FROM commissions
    WHERE partner_id = ${partner.id}
    AND created_at >= DATE_TRUNC('month', NOW())
  `

  const signupsThisMonth = await sql`
    SELECT COUNT(*) as count FROM referrals
    WHERE partner_id = ${partner.id}
    AND signed_up_at >= DATE_TRUNC('month', NOW())
  `

  return {
    partner,
    tierConfig,
    nextTier,
    recentReferrals,
    recentCommissions,
    pendingPayout: partner.pendingCommission,
    stats: {
      clicksThisMonth: clickStats.totalClicks,
      signupsThisMonth: Number(signupsThisMonth[0].count),
      revenueThisMonth: Number(monthStats[0].revenue_this_month),
      commissionsThisMonth: Number(monthStats[0].commissions_this_month),
      conversionRate: clickStats.conversionRate,
    },
  }
}

export async function getLeaderboard(limit: number = 20): Promise<LeaderboardEntry[]> {
  const result = await sql`
    SELECT * FROM v_partner_leaderboard LIMIT ${limit}
  `

  return result.map(row => ({
    id: row.id,
    name: row.name,
    companyName: row.company_name,
    tier: row.tier,
    tierName: row.tier_name,
    totalReferrals: Number(row.total_referrals),
    totalRevenueGenerated: Number(row.total_revenue_generated),
    totalCommissionsEarned: Number(row.total_commissions_earned),
    revenueRank: Number(row.revenue_rank),
    referralRank: Number(row.referral_rank),
  }))
}

// ============================================================================
// ROW MAPPERS
// ============================================================================

function mapPartnerRow(row: Record<string, unknown>): Partner {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    companyName: row.company_name as string | undefined,
    email: row.email as string,
    phone: row.phone as string | undefined,
    website: row.website as string | undefined,
    partnerType: row.partner_type as Partner['partnerType'],
    tier: row.tier as Partner['tier'],
    referralCode: row.referral_code as string,
    customLink: row.custom_link as string | undefined,
    commissionRate: Number(row.commission_rate),
    commissionType: row.commission_type as Partner['commissionType'],
    flatCommission: row.flat_commission ? Number(row.flat_commission) : undefined,
    recurringCommission: row.recurring_commission as boolean,
    recurringMonths: Number(row.recurring_months),
    paymentMethod: row.payment_method as Partner['paymentMethod'],
    paymentEmail: row.payment_email as string | undefined,
    bankAccountId: row.bank_account_id as string | undefined,
    cryptoWallet: row.crypto_wallet as string | undefined,
    minimumPayout: Number(row.minimum_payout),
    totalReferrals: Number(row.total_referrals),
    activeReferrals: Number(row.active_referrals),
    totalRevenueGenerated: Number(row.total_revenue_generated),
    totalCommissionsEarned: Number(row.total_commissions_earned),
    totalCommissionsPaid: Number(row.total_commissions_paid),
    pendingCommission: Number(row.pending_commission),
    status: row.status as Partner['status'],
    approvedAt: row.approved_at ? new Date(row.approved_at as string) : undefined,
    approvedBy: row.approved_by as string | undefined,
    notes: row.notes as string | undefined,
    tags: row.tags as string[] | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function mapTierRow(row: Record<string, unknown>): TierConfig {
  return {
    id: row.id as PartnerTier,
    name: row.name as string,
    minReferrals: Number(row.min_referrals),
    minRevenue: Number(row.min_revenue),
    baseCommissionRate: Number(row.base_commission_rate),
    bonusCommissionRate: Number(row.bonus_commission_rate),
    dedicatedSupport: row.dedicated_support as boolean,
    customLandingPages: row.custom_landing_pages as boolean,
    apiAccess: row.api_access as boolean,
    whiteLabel: row.white_label as boolean,
    coMarketing: row.co_marketing as boolean,
    earlyAccess: row.early_access as boolean,
    color: row.color as string,
    badgeUrl: row.badge_url as string | undefined,
  }
}

function mapReferralRow(row: Record<string, unknown>): Referral {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    referredUserId: row.referred_user_id as string,
    referredEmail: row.referred_email as string | undefined,
    referredName: row.referred_name as string | undefined,
    referralCode: row.referral_code as string,
    landingPage: row.landing_page as string | undefined,
    utmSource: row.utm_source as string | undefined,
    utmMedium: row.utm_medium as string | undefined,
    utmCampaign: row.utm_campaign as string | undefined,
    ipAddress: row.ip_address as string | undefined,
    userAgent: row.user_agent as string | undefined,
    clickedAt: row.clicked_at ? new Date(row.clicked_at as string) : undefined,
    signedUpAt: row.signed_up_at ? new Date(row.signed_up_at as string) : undefined,
    firstPurchaseAt: row.first_purchase_at ? new Date(row.first_purchase_at as string) : undefined,
    qualifiedAt: row.qualified_at ? new Date(row.qualified_at as string) : undefined,
    status: row.status as Referral['status'],
    totalRevenue: Number(row.total_revenue),
    totalTransactions: Number(row.total_transactions),
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function mapCommissionRow(row: Record<string, unknown>): Commission {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    referralId: row.referral_id as string,
    transactionId: row.transaction_id as string | undefined,
    transactionType: row.transaction_type as Commission['transactionType'],
    transactionAmount: Number(row.transaction_amount),
    transactionDate: new Date(row.transaction_date as string),
    commissionRate: Number(row.commission_rate),
    commissionType: row.commission_type as Commission['commissionType'],
    commissionAmount: Number(row.commission_amount),
    isRecurring: row.is_recurring as boolean,
    recurringMonth: row.recurring_month ? Number(row.recurring_month) : undefined,
    status: row.status as Commission['status'],
    approvedAt: row.approved_at ? new Date(row.approved_at as string) : undefined,
    approvedBy: row.approved_by as string | undefined,
    payoutId: row.payout_id as string | undefined,
    paidAt: row.paid_at ? new Date(row.paid_at as string) : undefined,
    notes: row.notes as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
  }
}

function mapPayoutRow(row: Record<string, unknown>): Payout {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    paymentMethod: row.payment_method as Payout['paymentMethod'],
    periodStart: new Date(row.period_start as string),
    periodEnd: new Date(row.period_end as string),
    commissionCount: Number(row.commission_count),
    status: row.status as Payout['status'],
    processedAt: row.processed_at ? new Date(row.processed_at as string) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    failedAt: row.failed_at ? new Date(row.failed_at as string) : undefined,
    failureReason: row.failure_reason as string | undefined,
    paymentReference: row.payment_reference as string | undefined,
    paymentDetails: row.payment_details as Record<string, unknown> | undefined,
    notes: row.notes as string | undefined,
    createdAt: new Date(row.created_at as string),
  }
}

function mapClickRow(row: Record<string, unknown>): ReferralClick {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    referralCode: row.referral_code as string,
    ipAddress: row.ip_address as string | undefined,
    userAgent: row.user_agent as string | undefined,
    referer: row.referer as string | undefined,
    landingPage: row.landing_page as string | undefined,
    utmSource: row.utm_source as string | undefined,
    utmMedium: row.utm_medium as string | undefined,
    utmCampaign: row.utm_campaign as string | undefined,
    utmTerm: row.utm_term as string | undefined,
    utmContent: row.utm_content as string | undefined,
    converted: row.converted as boolean,
    referralId: row.referral_id as string | undefined,
    clickedAt: new Date(row.clicked_at as string),
  }
}

function mapLinkRow(row: Record<string, unknown>): PartnerLink {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    name: row.name as string,
    slug: row.slug as string,
    destinationUrl: row.destination_url as string,
    utmSource: row.utm_source as string | undefined,
    utmMedium: row.utm_medium as string | undefined,
    utmCampaign: row.utm_campaign as string | undefined,
    clickCount: Number(row.click_count),
    conversionCount: Number(row.conversion_count),
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function mapApplicationRow(row: Record<string, unknown>): PartnerApplication {
  return {
    id: row.id as string,
    userId: row.user_id as string | undefined,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string | undefined,
    companyName: row.company_name as string | undefined,
    website: row.website as string | undefined,
    partnerType: row.partner_type as PartnerApplication['partnerType'],
    audienceSize: row.audience_size as string | undefined,
    audienceDescription: row.audience_description as string | undefined,
    promotionMethods: row.promotion_methods as string[] | undefined,
    monthlyTraffic: row.monthly_traffic ? Number(row.monthly_traffic) : undefined,
    existingPartnerships: row.existing_partnerships as string | undefined,
    status: row.status as PartnerApplication['status'],
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : undefined,
    reviewedBy: row.reviewed_by as string | undefined,
    rejectionReason: row.rejection_reason as string | undefined,
    partnerId: row.partner_id as string | undefined,
    notes: row.notes as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
  }
}
