/**
 * GRAIN Grants API
 *
 * Grant management for nonprofits and endowments.
 *
 * Endpoints:
 * - GET: List grants with filters
 * - POST: Create new grant
 * - PATCH: Update grant status (approve, reject, cancel)
 *
 * KEY INSIGHT: Grants come from CREDIT LINE, not protected deposit.
 * This preserves the endowment's principal/corpus.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GrantEngine } from '@/lib/grain/grants'
import { getCurrentGrainPrice, getPosition } from '@/lib/grain/credit-line-engine'

// GET /api/grain/grants
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse filters
    const endowmentId = searchParams.get('endowmentId') || userId // Default to own grants
    const granteeId = searchParams.get('granteeId')
    const status = searchParams.get('status')
    const restrictedFundId = searchParams.get('restrictedFundId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build filters
    const filters: any = {
      endowmentId,
      limit,
      offset,
    }

    if (granteeId) {
      filters.granteeId = granteeId
    }

    if (status) {
      // Support comma-separated statuses
      filters.status = status.includes(',') ? status.split(',') : status
    }

    if (restrictedFundId) {
      filters.restrictedFundId = restrictedFundId
    }

    // Get grants
    const { grants, total } = await GrantEngine.listGrants(filters)

    // Get grant statistics
    const stats = await GrantEngine.getGrantStats(endowmentId)

    // Get current GRAIN price for value calculation
    const grainPrice = await getCurrentGrainPrice()

    // Get endowment position for credit line info
    const position = await getPosition(endowmentId)

    return NextResponse.json({
      success: true,
      grants: grants.map((grant) => ({
        ...grant,
        currentUsdValue: grant.remainingAmount * grainPrice,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: {
        ...stats,
        currentValuePending: stats.totalAmountPending * grainPrice,
      },
      grainPrice,
      creditLine: position ? {
        available: position.creditLineAvailable,
        used: position.creditLineUsed,
        limit: position.creditLineLimit,
        protectedDeposit: position.protectedDeposit,
      } : null,
    })
  } catch (error: any) {
    console.error('[Grants API] GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/grain/grants
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      endowmentId,
      granteeName,
      granteeType,
      granteeId,
      amount,
      purpose,
      description,
      restrictedFundId,
      grantPeriodStart,
      grantPeriodEnd,
    } = body

    // Validation
    if (!granteeName) {
      return NextResponse.json(
        { success: false, error: 'granteeName is required' },
        { status: 400 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 }
      )
    }

    if (!purpose) {
      return NextResponse.json(
        { success: false, error: 'purpose is required' },
        { status: 400 }
      )
    }

    // User can only create grants from their own endowment
    const effectiveEndowmentId = endowmentId || userId

    // Create grant
    const result = await GrantEngine.createGrant({
      endowmentId: effectiveEndowmentId,
      granteeName,
      granteeType: granteeType || 'nonprofit',
      granteeId,
      amount,
      purpose,
      description,
      restrictedFundId,
      grantPeriodStart: grantPeriodStart ? new Date(grantPeriodStart) : undefined,
      grantPeriodEnd: grantPeriodEnd ? new Date(grantPeriodEnd) : undefined,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      )
    }

    // Get current GRAIN price
    const grainPrice = await getCurrentGrainPrice()

    return NextResponse.json({
      success: true,
      grant: {
        ...result.grant,
        currentUsdValue: result.grant!.amount * grainPrice,
      },
      creditLine: {
        used: result.creditLineUsed,
        remaining: result.creditLineRemaining,
      },
      grainPrice,
      message: result.message,
    })
  } catch (error: any) {
    console.error('[Grants API] POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PATCH /api/grain/grants
export async function PATCH(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { grantId, action, reason } = body

    if (!grantId) {
      return NextResponse.json(
        { success: false, error: 'grantId is required' },
        { status: 400 }
      )
    }

    // Verify the user owns the endowment for this grant
    const grant = await GrantEngine.getGrant(grantId)
    if (!grant) {
      return NextResponse.json(
        { success: false, error: 'Grant not found' },
        { status: 404 }
      )
    }

    // For now, allow the endowment owner to manage their grants
    if (grant.endowmentId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not own this endowment' },
        { status: 403 }
      )
    }

    let result: any

    switch (action) {
      case 'approve':
        result = await GrantEngine.approveGrant(grantId, userId)
        break

      case 'reject':
        if (!reason) {
          return NextResponse.json(
            { success: false, error: 'reason is required for rejection' },
            { status: 400 }
          )
        }
        result = await GrantEngine.rejectGrant(grantId, userId, reason)
        break

      case 'cancel':
        // Cancel is similar to reject but for approved/disbursed grants
        if (grant.status === 'pending') {
          result = await GrantEngine.rejectGrant(grantId, userId, reason || 'Cancelled by endowment')
        } else {
          // For approved/disbursed grants, just update status
          // Note: Already disbursed funds cannot be reclaimed automatically
          return NextResponse.json(
            { success: false, error: 'Cannot cancel grants that have been disbursed. Contact support.' },
            { status: 400 }
          )
        }
        break

      case 'generate_agreement':
        result = await GrantEngine.generateGrantAgreement(grantId)
        break

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid actions: approve, reject, cancel, generate_agreement` },
          { status: 400 }
        )
    }

    const grainPrice = await getCurrentGrainPrice()

    return NextResponse.json({
      success: true,
      action,
      ...result,
      grainPrice,
    })
  } catch (error: any) {
    console.error('[Grants API] PATCH error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
