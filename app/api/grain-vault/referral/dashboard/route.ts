// @ts-nocheck
/**
 * Referral Dashboard API
 * GET: Get user's complete referral dashboard data
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sqlQuery as sql } from '@/lib/db'
import { formatReferralLink, getShareUrls, getShareText } from '@/lib/grain-vault/referrals'

interface ReferralRow {
  id: string
  referee_email: string | null
  status: string
  referrer_reward: number
  created_at: string
  signed_up_at: string | null
  qualified_at: string | null
  rewarded_at: string | null
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's referral code and dashboard stats
    const dashboardResult = await sql`
      SELECT * FROM referral_dashboard
      WHERE user_id = ${userId}
    `

    if (dashboardResult.length === 0) {
      // No referral code yet - return empty state
      return NextResponse.json({
        hasCode: false,
        message: 'No referral code yet. Create one to start earning!'
      })
    }

    const dashboard = dashboardResult[0]
    const effectiveCode = dashboard.custom_code || dashboard.code
    const referralLink = formatReferralLink(effectiveCode)

    // Get recent referrals
    const recentReferrals = await sql`
      SELECT
        id,
        referee_email,
        status,
        referrer_reward,
        referee_reward,
        created_at,
        signed_up_at,
        qualified_at,
        rewarded_at
      FROM referrals
      WHERE referrer_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `

    // Get pending rewards
    const pendingRewards = await sql`
      SELECT
        SUM(amount) as total_pending
      FROM referral_rewards
      WHERE user_id = ${userId}
      AND status = 'pending'
    `

    // Get leaderboard position
    const leaderboardPosition = await sql`
      SELECT rank FROM referral_leaderboard
      WHERE user_id = ${userId}
    `

    return NextResponse.json({
      hasCode: true,

      // Code info
      code: effectiveCode,
      originalCode: dashboard.code,
      customCode: dashboard.custom_code,
      referralLink,
      shareText: getShareText(effectiveCode),
      shareUrls: getShareUrls(effectiveCode, referralLink),

      // Tier info
      tier: dashboard.tier,
      tierName: dashboard.tier_name,
      badgeColor: dashboard.badge_color,
      customCodeEnabled: dashboard.custom_code_enabled,

      // Progression
      nextTier: dashboard.next_tier,
      nextTierRequirement: dashboard.next_tier_requirement,
      referralsToNextTier: dashboard.referrals_to_next_tier,

      // Stats
      stats: {
        totalReferrals: dashboard.total_referrals,
        successfulReferrals: dashboard.successful_referrals,
        pendingReferrals: dashboard.pending_referrals,
        totalGrainEarned: dashboard.total_grain_earned,
        referralsThisMonth: dashboard.referrals_this_month,
        grainEarnedThisMonth: dashboard.grain_earned_this_month,
        pendingRewards: pendingRewards[0]?.total_pending || 0
      },

      // Rewards
      rewardAmount: dashboard.reward_amount,
      refereeBonus: dashboard.referee_bonus,

      // Recent activity
      recentReferrals: (recentReferrals.rows as ReferralRow[]).map((r: ReferralRow) => ({
        id: r.id,
        email: r.referee_email ? maskEmail(r.referee_email) : 'Anonymous',
        status: r.status,
        reward: r.referrer_reward,
        createdAt: r.created_at,
        signedUpAt: r.signed_up_at,
        qualifiedAt: r.qualified_at,
        rewardedAt: r.rewarded_at
      })),

      // Leaderboard
      leaderboardRank: leaderboardPosition[0]?.rank || null,

      // Timestamps
      status: dashboard.status,
      createdAt: dashboard.created_at,
      lastUsedAt: dashboard.last_used_at
    })
  } catch (error) {
    console.error('Error getting referral dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to get referral dashboard' },
      { status: 500 }
    )
  }
}

// Utility to mask email for privacy
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const maskedLocal = local.charAt(0) + '***' + (local.length > 1 ? local.charAt(local.length - 1) : '')
  return `${maskedLocal}@${domain}`
}
