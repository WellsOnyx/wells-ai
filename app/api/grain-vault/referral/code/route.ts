// @ts-nocheck
/**
 * Referral Code API
 * GET: Get user's referral code (creates one if doesn't exist)
 * POST: Create custom code (if allowed by tier)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import {
  generateReferralCode,
  validateCustomCode,
  getTierConfig,
  formatReferralLink,
  REFERRAL_TIERS
} from '@/lib/grain-vault/referrals'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has a referral code
    const existing = await sql`
      SELECT
        rc.*,
        tc.display_name as tier_name,
        tc.badge_color,
        tc.custom_code_enabled
      FROM referral_codes rc
      LEFT JOIN referral_tier_config tc ON rc.tier = tc.tier
      WHERE rc.user_id = ${userId}
    `

    if (existing.length > 0) {
      const code = existing[0]
      return NextResponse.json({
        code: code.code,
        customCode: code.custom_code,
        tier: code.tier,
        tierName: code.tier_name,
        badgeColor: code.badge_color,
        rewardAmount: code.reward_amount,
        refereeBonus: code.referee_bonus,
        totalReferrals: code.total_referrals,
        successfulReferrals: code.successful_referrals,
        totalGrainEarned: code.total_grain_earned,
        status: code.status,
        customCodeEnabled: code.custom_code_enabled,
        referralLink: formatReferralLink(code.custom_code || code.code),
        createdAt: code.created_at
      })
    }

    // Create new referral code
    const newCode = generateReferralCode()
    const starterTier = REFERRAL_TIERS[0]

    const result = await sql`
      INSERT INTO referral_codes (
        user_id,
        code,
        tier,
        reward_amount,
        referee_bonus
      ) VALUES (
        ${userId},
        ${newCode},
        'starter',
        ${starterTier.rewardPerReferral},
        ${starterTier.refereeBonus}
      )
      RETURNING *
    `

    const created = result[0]
    return NextResponse.json({
      code: created.code,
      tier: created.tier,
      tierName: starterTier.displayName,
      badgeColor: starterTier.badgeColor,
      rewardAmount: created.reward_amount,
      refereeBonus: created.referee_bonus,
      totalReferrals: 0,
      successfulReferrals: 0,
      totalGrainEarned: 0,
      status: 'active',
      customCodeEnabled: false,
      referralLink: formatReferralLink(newCode),
      createdAt: created.created_at,
      isNew: true
    })
  } catch (error) {
    console.error('Error getting referral code:', error)
    return NextResponse.json(
      { error: 'Failed to get referral code' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { customCode } = body

    if (!customCode) {
      return NextResponse.json(
        { error: 'Custom code is required' },
        { status: 400 }
      )
    }

    // Get user's current referral code and tier
    const existing = await sql`
      SELECT rc.*, tc.custom_code_enabled
      FROM referral_codes rc
      LEFT JOIN referral_tier_config tc ON rc.tier = tc.tier
      WHERE rc.user_id = ${userId}
    `

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'No referral code found. Create one first.' },
        { status: 400 }
      )
    }

    const userCode = existing[0]

    // Check if custom codes are enabled for this tier
    if (!userCode.custom_code_enabled) {
      const tierConfig = getTierConfig(userCode.tier)
      return NextResponse.json(
        {
          error: `Custom codes require ${tierConfig.displayName} tier or higher`,
          currentTier: userCode.tier,
          requiredTier: 'growth'
        },
        { status: 403 }
      )
    }

    // Validate the custom code format
    const validation = validateCustomCode(customCode)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Check if code is already taken
    const codeTaken = await sql`
      SELECT 1 FROM referral_codes
      WHERE (code = ${customCode.toUpperCase()} OR custom_code = ${customCode.toUpperCase()})
      AND user_id != ${userId}
    `

    if (codeTaken.length > 0) {
      return NextResponse.json(
        { error: 'This code is already taken' },
        { status: 409 }
      )
    }

    // Update with custom code
    const updated = await sql`
      UPDATE referral_codes
      SET
        custom_code = ${customCode.toUpperCase()},
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `

    return NextResponse.json({
      code: updated[0].code,
      customCode: updated[0].custom_code,
      referralLink: formatReferralLink(updated[0].custom_code),
      message: 'Custom code set successfully'
    })
  } catch (error) {
    console.error('Error setting custom code:', error)
    return NextResponse.json(
      { error: 'Failed to set custom code' },
      { status: 500 }
    )
  }
}
