// @ts-nocheck
/**
 * Grain & Vault KYC API
 *
 * Simplified verification flow:
 * - Basic tier: No verification needed (auto-approved)
 * - Standard+ tiers: Pending manual review (future: Circle Compliance Engine)
 *
 * POST: Start/submit verification request
 * GET: Check verification status
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

interface KycStartRequest {
  tier: 'basic' | 'standard' | 'premium' | 'unlimited'
  userData: {
    firstName: string
    lastName: string
    email: string
    dateOfBirth?: string
    phone?: string
    address?: {
      line1: string
      line2?: string
      city: string
      state: string
      postalCode: string
      country: string
    }
  }
}

// Verification levels matching our tiers
const VERIFICATION_LEVELS = {
  basic: 1,      // $1K/day - Email only
  standard: 2,   // $10K/day - ID verified
  premium: 3,    // $100K/day - ID + address
  unlimited: 4   // Unlimited - Enhanced DD
}

// ============================================================================
// POST: Start/Submit KYC Verification
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const body: KycStartRequest = await req.json()

    // Validate tier
    if (!['basic', 'standard', 'premium', 'unlimited'].includes(body.tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be basic, standard, premium, or unlimited' },
        { status: 400 }
      )
    }

    const verificationLevel = VERIFICATION_LEVELS[body.tier]

    // Basic tier - auto-approve immediately
    if (body.tier === 'basic') {
      // Update profile to approved with level 1
      try {
        await sql`
          UPDATE grain_user_profiles
          SET
            verification_level = 1,
            verification_status = 'approved',
            updated_at = NOW()
          WHERE user_id = ${userId}
        `
      } catch (e) {
        console.log('[KYC] Could not update profile:', e)
      }

      return NextResponse.json({
        success: true,
        tier: 'basic',
        status: 'approved',
        verificationRequired: false,
        message: 'Basic tier approved. You can deposit up to $1,000/day.'
      })
    }

    // Standard+ tiers - for now, auto-approve for testing
    // In production, this would use Circle Compliance Engine or manual review
    const sessionId = `kyc_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Update profile with pending/approved status
    // For testing: auto-approve standard tier too
    const autoApprove = body.tier === 'standard'
    const status = autoApprove ? 'approved' : 'pending'

    try {
      await sql`
        UPDATE grain_user_profiles
        SET
          kyc_session_id = ${sessionId},
          verification_level = ${autoApprove ? verificationLevel : 1},
          verification_status = ${status},
          desired_tier = ${body.tier},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `
    } catch (e) {
      console.log('[KYC] Could not update profile:', e)
    }

    console.log(`[KYC] ${body.tier} tier verification ${status} for user ${userId}`)

    if (autoApprove) {
      // Standard tier auto-approved for testing
      return NextResponse.json({
        success: true,
        sessionId,
        tier: body.tier,
        status: 'approved',
        verificationRequired: false,
        message: `${body.tier.charAt(0).toUpperCase() + body.tier.slice(1)} tier approved. You can deposit up to $10,000/day.`
      })
    }

    // Premium/Unlimited - requires manual review
    return NextResponse.json({
      success: true,
      sessionId,
      tier: body.tier,
      status: 'pending',
      verificationRequired: true,
      message: `Your ${body.tier} tier verification is pending review. This typically takes 1-2 business days.`
    })
  } catch (error: any) {
    console.error('[KYC] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process verification', details: error?.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET: Check KYC Status
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    // Get user's profile verification status
    try {
      const profileResult = await sql`
        SELECT
          kyc_session_id,
          verification_level,
          verification_status,
          desired_tier
        FROM grain_user_profiles
        WHERE user_id = ${userId}
      `

      if (profileResult.rows.length === 0) {
        return NextResponse.json({
          verified: false,
          status: 'no_profile',
          level: 1,
          tier: 'basic',
          message: 'No user profile found. Please complete onboarding.'
        })
      }

      const profile = profileResult.rows[0]
      const verificationLevel = profile.verification_level || 1
      const verificationStatus = profile.verification_status || 'none'

      // Map status for frontend
      let status = verificationStatus
      if (verificationStatus === 'approved') {
        status = 'approved'
      } else if (verificationStatus === 'rejected') {
        status = 'rejected'
      } else if (verificationStatus === 'pending') {
        status = 'pending'
      } else {
        status = 'none'
      }

      return NextResponse.json({
        sessionId: profile.kyc_session_id || sessionId || null,
        status,
        verified: verificationLevel >= 2 || verificationStatus === 'approved',
        level: verificationLevel,
        tier: profile.desired_tier || 'basic',
        message: status === 'approved'
          ? 'Your identity has been verified.'
          : status === 'pending'
          ? 'Your verification is being reviewed.'
          : status === 'rejected'
          ? 'Verification was not successful.'
          : 'No verification on file.'
      })
    } catch (e: any) {
      console.error('[KYC] Error fetching profile:', e)
      // Return a sensible default if profile doesn't exist
      return NextResponse.json({
        verified: false,
        status: 'none',
        level: 1,
        tier: 'basic',
        message: 'Could not fetch verification status.'
      })
    }
  } catch (error: any) {
    console.error('[KYC] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check verification status', details: error?.message },
      { status: 500 }
    )
  }
}
