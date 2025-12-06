// @ts-nocheck
/**
 * Referral Code Validation API
 * POST: Validate a referral code (for signup flow)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getTierConfig } from '@/lib/grain-vault/referrals'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { valid: false, error: 'Referral code is required' },
        { status: 400 }
      )
    }

    const normalizedCode = code.toUpperCase().trim()

    // Look up the code (check both code and custom_code)
    const result = await sql`
      SELECT
        rc.id,
        rc.user_id as referrer_id,
        rc.code,
        rc.custom_code,
        rc.tier,
        rc.referee_bonus,
        rc.status,
        rc.max_uses,
        rc.uses_count,
        tc.display_name as tier_name,
        tc.badge_color
      FROM referral_codes rc
      LEFT JOIN referral_tier_config tc ON rc.tier = tc.tier
      WHERE (rc.code = ${normalizedCode} OR rc.custom_code = ${normalizedCode})
    `

    if (result.length === 0) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid referral code'
      })
    }

    const referralCode = result[0]

    // Check if code is active
    if (referralCode.status !== 'active') {
      return NextResponse.json({
        valid: false,
        error: 'This referral code is no longer active'
      })
    }

    // Check if max uses reached
    if (referralCode.max_uses && referralCode.uses_count >= referralCode.max_uses) {
      return NextResponse.json({
        valid: false,
        error: 'This referral code has reached its maximum uses'
      })
    }

    // Code is valid
    return NextResponse.json({
      valid: true,
      referralCodeId: referralCode.id,
      referrerId: referralCode.referrer_id,
      code: referralCode.custom_code || referralCode.code,
      tier: referralCode.tier,
      tierName: referralCode.tier_name,
      badgeColor: referralCode.badge_color,
      refereeBonus: referralCode.referee_bonus,
      message: `You'll receive ${referralCode.referee_bonus} GRAIN when you sign up!`
    })
  } catch (error) {
    console.error('Error validating referral code:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to validate code' },
      { status: 500 }
    )
  }
}
