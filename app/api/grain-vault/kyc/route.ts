// @ts-nocheck
/**
 * Grain & Vault KYC API
 *
 * POST: Start a new KYC verification session with Veriff
 * GET: Check the status of an existing KYC session
 *
 * SECURITY: Requires Clerk authentication
 *
 * Verification Tiers:
 * - basic: Email only, no KYC needed ($1K/day)
 * - standard: ID verification ($10K/day)
 * - premium: ID + address verification ($100K/day)
 * - unlimited: Full KYC + enhanced due diligence (unlimited)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import {
  getIdentityVerificationService,
  VerificationLevel,
  VerificationStatus,
  type UserData,
  type VerificationSession,
} from '@/lib/security/identity-verification'

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map tier to verification level
 */
function tierToLevel(tier: string): VerificationLevel {
  switch (tier) {
    case 'basic':
      return VerificationLevel.EMAIL_ONLY
    case 'standard':
      return VerificationLevel.PHONE_BASIC
    case 'premium':
      return VerificationLevel.FULL_KYC
    case 'unlimited':
      return VerificationLevel.ENHANCED_DD
    default:
      return VerificationLevel.EMAIL_ONLY
  }
}

/**
 * Map verification status to simple status string
 */
function simplifyStatus(status: VerificationStatus): string {
  switch (status) {
    case VerificationStatus.APPROVED:
      return 'approved'
    case VerificationStatus.REJECTED:
      return 'rejected'
    case VerificationStatus.EXPIRED:
      return 'expired'
    case VerificationStatus.RESUBMISSION_REQUIRED:
      return 'resubmission_required'
    case VerificationStatus.IN_REVIEW:
      return 'in_review'
    case VerificationStatus.PENDING:
    default:
      return 'pending'
  }
}

// ============================================================================
// POST: Start KYC Session
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Clerk user for additional data
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

    // Basic tier doesn't need KYC
    if (body.tier === 'basic') {
      return NextResponse.json({
        success: true,
        tier: 'basic',
        message: 'Basic tier does not require identity verification',
        verificationRequired: false
      })
    }

    // Validate user data
    if (!body.userData?.firstName || !body.userData?.lastName || !body.userData?.email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
        { status: 400 }
      )
    }

    // Premium and Unlimited tiers require address
    if ((body.tier === 'premium' || body.tier === 'unlimited') && !body.userData.address) {
      return NextResponse.json(
        { error: `${body.tier.charAt(0).toUpperCase() + body.tier.slice(1)} tier requires address information` },
        { status: 400 }
      )
    }

    // Prepare user data for Veriff
    const userData: UserData = {
      firstName: body.userData.firstName,
      lastName: body.userData.lastName,
      email: body.userData.email,
      dateOfBirth: body.userData.dateOfBirth,
      phone: body.userData.phone,
      address: body.userData.address
    }

    // Get the verification service
    const verificationService = getIdentityVerificationService()

    // Determine verification level based on tier
    const level = tierToLevel(body.tier)

    // Create verification session with Veriff
    console.log(`[KYC] Creating ${body.tier} verification session for user ${userId}`)

    const session = await verificationService.createVerificationSession(
      userId,
      userData,
      {
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://wells-ai.vercel.app'}/api/webhooks/veriff`,
        level
      }
    )

    // Store session reference in user profile
    try {
      await sql`
        UPDATE grain_user_profiles
        SET
          kyc_session_id = ${session.sessionId},
          verification_status = 'pending',
          desired_tier = ${body.tier},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `
    } catch (e) {
      console.log('[KYC] Could not update user profile with session ID:', e)
    }

    // Log the KYC attempt
    try {
      await sql`
        INSERT INTO grain_treasury_events (
          type,
          amount,
          user_id,
          notes,
          metadata,
          created_at
        ) VALUES (
          'kyc_started',
          0,
          ${userId},
          ${`KYC verification started for ${body.tier} tier`},
          ${JSON.stringify({
            sessionId: session.sessionId,
            tier: body.tier,
            level
          })},
          NOW()
        )
      `
    } catch (e) {
      // Audit logging failure shouldn't break the flow
      console.log('[KYC] Could not log treasury event:', e)
    }

    console.log(`[KYC] Session created: ${session.sessionId}, URL: ${session.verificationUrl}`)

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      verificationUrl: session.verificationUrl,
      tier: body.tier,
      expiresAt: session.expiresAt.toISOString(),
      message: 'Verification session created. Please complete verification at the provided URL.'
    })
  } catch (error: any) {
    console.error('[KYC] Error starting verification:', error)
    return NextResponse.json(
      {
        error: 'Failed to start verification',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET: Check KYC Status
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get session ID from query params
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      // If no session ID provided, check user's profile for latest session
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
            message: 'No user profile found'
          })
        }

        const profile = profileResult.rows[0]

        if (!profile.kyc_session_id) {
          return NextResponse.json({
            verified: profile.verification_level >= 2,
            status: profile.verification_status || 'none',
            level: profile.verification_level || 1,
            tier: profile.desired_tier || 'basic',
            message: 'No KYC session found'
          })
        }

        // Use the stored session ID
        const verificationService = getIdentityVerificationService()
        const result = await verificationService.getVerificationStatus(profile.kyc_session_id)

        return NextResponse.json({
          sessionId: profile.kyc_session_id,
          status: simplifyStatus(result.status),
          verified: result.status === VerificationStatus.APPROVED,
          level: result.level,
          tier: profile.desired_tier || 'basic',
          decision: result.decision,
          completedAt: result.completedAt?.toISOString(),
          rejectionReasons: result.rejectionReasons
        })
      } catch (e: any) {
        console.error('[KYC] Error fetching profile:', e)
        return NextResponse.json({
          verified: false,
          status: 'error',
          error: e.message
        })
      }
    }

    // Get verification status from Veriff
    const verificationService = getIdentityVerificationService()
    const result = await verificationService.getVerificationStatus(sessionId)

    // Also check our database for the session
    let dbSession = null
    try {
      const sessionResult = await sql`
        SELECT
          session_id,
          user_id,
          status,
          completed_at,
          result_data
        FROM grain_verification_sessions
        WHERE session_id = ${sessionId}
      `
      dbSession = sessionResult.rows[0]
    } catch (e) {
      // Table might not exist
    }

    // Verify the session belongs to this user
    if (dbSession && dbSession.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({
      sessionId,
      status: simplifyStatus(result.status),
      verified: result.status === VerificationStatus.APPROVED,
      level: result.level,
      decision: result.decision,
      completedAt: result.completedAt?.toISOString(),
      rejectionReasons: result.rejectionReasons,
      reviewRequired: result.reviewRequired,
      checks: result.checks
    })
  } catch (error: any) {
    console.error('[KYC] Error checking status:', error)
    return NextResponse.json(
      {
        error: 'Failed to check verification status',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}
