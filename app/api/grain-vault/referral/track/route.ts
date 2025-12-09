// @ts-nocheck
/**
 * Referral Tracking API
 * POST: Track a referral (when user signs up with code)
 * PUT: Update referral status (when user qualifies)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sqlQuery as sql } from '@/lib/db'
import { REFERRAL_EXPIRY_DAYS } from '@/lib/grain-vault/referrals'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    const body = await req.json()
    const { code, email, source, campaign, landingPage } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      )
    }

    const normalizedCode = code.toUpperCase().trim()

    // Look up the referral code
    const codeResult = await sql`
      SELECT id, user_id, reward_amount, referee_bonus
      FROM referral_codes
      WHERE (code = ${normalizedCode} OR custom_code = ${normalizedCode})
      AND status = 'active'
    `

    if (codeResult.length === 0) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      )
    }

    const referralCode = codeResult[0]

    // Prevent self-referral
    if (userId && userId === referralCode.user_id) {
      return NextResponse.json(
        { error: 'Cannot use your own referral code' },
        { status: 400 }
      )
    }

    // Check if this user/email already has a pending referral
    if (userId || email) {
      const existing = await sql`
        SELECT id FROM referrals
        WHERE (referee_id = ${userId} OR referee_email = ${email})
        AND status NOT IN ('rejected', 'expired')
      `

      if (existing.length > 0) {
        return NextResponse.json({
          message: 'Referral already tracked',
          referralId: existing[0].id
        })
      }
    }

    // Calculate expiry date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFERRAL_EXPIRY_DAYS)

    // Create the referral tracking record
    const referral = await sql`
      INSERT INTO referrals (
        referrer_id,
        referral_code_id,
        referee_id,
        referee_email,
        status,
        qualification_type,
        referrer_reward,
        referee_reward,
        source,
        campaign,
        landing_page,
        expires_at
      ) VALUES (
        ${referralCode.user_id},
        ${referralCode.id},
        ${userId || null},
        ${email || null},
        ${userId ? 'signed_up' : 'pending'},
        'first_deposit',
        ${referralCode.reward_amount},
        ${referralCode.referee_bonus},
        ${source || 'link'},
        ${campaign || null},
        ${landingPage || null},
        ${expiresAt}
      )
      RETURNING id, status, referee_reward
    `

    return NextResponse.json({
      success: true,
      referralId: referral[0].id,
      status: referral[0].status,
      refereeBonus: referral[0].referee_reward,
      message: `Referral tracked! You'll receive ${referral[0].referee_reward} GRAIN after completing signup.`
    })
  } catch (error) {
    console.error('Error tracking referral:', error)
    return NextResponse.json(
      { error: 'Failed to track referral' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, referralId } = body

    // Get the referral for this user (as referee)
    const referral = await sql`
      SELECT r.*, rc.user_id as referrer_user_id
      FROM referrals r
      JOIN referral_codes rc ON r.referral_code_id = rc.id
      WHERE r.referee_id = ${userId}
      AND r.status NOT IN ('rewarded', 'rejected', 'expired')
      ${referralId ? sql`AND r.id = ${referralId}::uuid` : sql``}
      ORDER BY r.created_at DESC
      LIMIT 1
    `

    if (referral.length === 0) {
      return NextResponse.json(
        { error: 'No pending referral found' },
        { status: 404 }
      )
    }

    const ref = referral[0]

    switch (action) {
      case 'signup_complete':
        // User completed signup
        await sql`
          UPDATE referrals
          SET status = 'signed_up', signed_up_at = NOW()
          WHERE id = ${ref.id}
        `
        return NextResponse.json({
          success: true,
          status: 'signed_up',
          message: 'Signup tracked. Complete verification to qualify.'
        })

      case 'kyc_complete':
        // User completed KYC
        await sql`
          UPDATE referrals
          SET status = 'verified'
          WHERE id = ${ref.id}
        `
        return NextResponse.json({
          success: true,
          status: 'verified',
          message: 'Verification complete. Make your first deposit to qualify.'
        })

      case 'qualify':
        // User qualified (e.g., made first deposit)
        await sql`
          UPDATE referrals
          SET status = 'qualified', qualified_at = NOW()
          WHERE id = ${ref.id}
        `

        // Create reward records for both parties
        await sql`
          INSERT INTO referral_rewards (user_id, referral_id, amount, type, description)
          VALUES
            (${ref.referrer_user_id}, ${ref.id}, ${ref.referrer_reward}, 'referrer_bonus', 'Referral bonus for successful referral'),
            (${userId}, ${ref.id}, ${ref.referee_reward}, 'referee_bonus', 'Welcome bonus from referral')
        `

        return NextResponse.json({
          success: true,
          status: 'qualified',
          referrerReward: ref.referrer_reward,
          refereeReward: ref.referee_reward,
          message: `Qualified! ${ref.referee_reward} GRAIN bonus pending.`
        })

      case 'distribute_rewards':
        // This would typically be called by an admin/cron job
        // For now, we'll mark as rewarded
        if (ref.status !== 'qualified') {
          return NextResponse.json(
            { error: 'Referral must be qualified first' },
            { status: 400 }
          )
        }

        await sql`
          UPDATE referrals
          SET
            status = 'rewarded',
            rewarded_at = NOW(),
            referrer_rewarded_at = NOW(),
            referee_rewarded_at = NOW()
          WHERE id = ${ref.id}
        `

        await sql`
          UPDATE referral_rewards
          SET status = 'credited', credited_at = NOW()
          WHERE referral_id = ${ref.id}
        `

        // Update referral code stats
        await sql`
          UPDATE referral_codes
          SET total_grain_earned = total_grain_earned + ${ref.referrer_reward}
          WHERE id = ${ref.referral_code_id}
        `

        return NextResponse.json({
          success: true,
          status: 'rewarded',
          message: 'Rewards distributed!'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating referral:', error)
    return NextResponse.json(
      { error: 'Failed to update referral' },
      { status: 500 }
    )
  }
}
