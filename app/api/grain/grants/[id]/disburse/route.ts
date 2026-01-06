/**
 * Grant Disbursement API
 *
 * Disburse funds from an approved grant.
 *
 * POST /api/grain/grants/[id]/disburse
 *
 * CRITICAL INSIGHT: Disbursements come from CREDIT LINE, not protected deposit.
 * This preserves the endowment's principal/corpus while allowing grant operations.
 *
 * Flow:
 * 1. Validate grant is approved or partially disbursed
 * 2. Check credit line has sufficient funds
 * 3. Deduct from credit line (NOT protected deposit)
 * 4. Record transaction in credit line ledger
 * 5. Update grant totals
 * 6. Generate receipt
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GrantEngine } from '@/lib/grain/grants'
import { getCurrentGrainPrice, getPosition } from '@/lib/grain/credit-line-engine'

// POST /api/grain/grants/[id]/disburse
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id: grantId } = await params
    const body = await request.json()
    const { amount, method, methodDetails } = body

    // Validation
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 }
      )
    }

    if (!method) {
      return NextResponse.json(
        { success: false, error: 'method is required (ach, wire, check, grain_transfer, other)' },
        { status: 400 }
      )
    }

    const validMethods = ['ach', 'wire', 'check', 'grain_transfer', 'other']
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { success: false, error: `Invalid method. Must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      )
    }

    // Get grant to verify ownership
    const grant = await GrantEngine.getGrant(grantId)
    if (!grant) {
      return NextResponse.json(
        { success: false, error: 'Grant not found' },
        { status: 404 }
      )
    }

    // Verify user owns the endowment
    if (grant.endowmentId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not own this endowment' },
        { status: 403 }
      )
    }

    // Get current position for pre-disbursement info
    const positionBefore = await getPosition(grant.endowmentId)
    const grainPriceBefore = await getCurrentGrainPrice()

    // Perform disbursement
    const result = await GrantEngine.disburseGrant({
      grantId,
      amount,
      method,
      methodDetails,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      )
    }

    // Get updated position
    const positionAfter = await getPosition(grant.endowmentId)
    const grainPriceAfter = await getCurrentGrainPrice()

    return NextResponse.json({
      success: true,
      disbursement: {
        ...result.disbursement,
        usdValueFormatted: `$${result.disbursement!.usdValue.toLocaleString()}`,
        amountFormatted: `${result.disbursement!.amount.toLocaleString()} GRAIN`,
      },
      grant: {
        ...result.grant,
        totalDisbursedFormatted: `${result.grant!.totalDisbursed.toLocaleString()} GRAIN`,
        remainingAmountFormatted: `${result.grant!.remainingAmount.toLocaleString()} GRAIN`,
        currentRemainingUsdValue: result.grant!.remainingAmount * grainPriceAfter,
      },
      receipt: {
        ...result.receipt,
        // Additional receipt formatting
        timestamp: new Date().toISOString(),
        receiptText: formatReceiptText(result.receipt),
      },
      creditLineImpact: {
        before: {
          creditLineUsed: positionBefore?.creditLineUsed || 0,
          creditLineAvailable: positionBefore?.creditLineAvailable || 0,
          protectedDeposit: positionBefore?.protectedDeposit || 0,
        },
        after: {
          creditLineUsed: positionAfter?.creditLineUsed || 0,
          creditLineAvailable: positionAfter?.creditLineAvailable || 0,
          protectedDeposit: positionAfter?.protectedDeposit || 0,
        },
        change: {
          creditLineUsed: (positionAfter?.creditLineUsed || 0) - (positionBefore?.creditLineUsed || 0),
          protectedDepositChange: 0, // Principal is NEVER touched!
        },
      },
      grainPrice: grainPriceAfter,
      message: result.message,
      principalProtected: true, // Always true - key insight!
    })
  } catch (error: any) {
    console.error('[Grant Disburse API] POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET /api/grain/grants/[id]/disburse - Get disbursement history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id: grantId } = await params

    // Get grant to verify access
    const grant = await GrantEngine.getGrant(grantId)
    if (!grant) {
      return NextResponse.json(
        { success: false, error: 'Grant not found' },
        { status: 404 }
      )
    }

    // Verify user has access (endowment owner or grantee)
    if (grant.endowmentId !== userId && grant.granteeId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get disbursement history
    const disbursements = await GrantEngine.getGrantDisbursements(grantId)
    const grainPrice = await getCurrentGrainPrice()

    // Calculate totals
    const totalDisbursed = disbursements.reduce((sum, d) => sum + d.amount, 0)
    const totalUsdDisbursed = disbursements.reduce((sum, d) => sum + d.usdValue, 0)

    return NextResponse.json({
      success: true,
      grant: {
        id: grant.id,
        granteeName: grant.granteeName,
        amount: grant.amount,
        totalDisbursed: grant.totalDisbursed,
        remainingAmount: grant.remainingAmount,
        status: grant.status,
      },
      disbursements: disbursements.map((d) => ({
        ...d,
        amountFormatted: `${d.amount.toLocaleString()} GRAIN`,
        usdValueFormatted: `$${d.usdValue.toLocaleString()}`,
        currentUsdValue: d.amount * grainPrice,
      })),
      summary: {
        totalDisbursements: disbursements.length,
        totalDisbursed,
        totalDisbursedFormatted: `${totalDisbursed.toLocaleString()} GRAIN`,
        totalUsdDisbursed,
        totalUsdDisbursedFormatted: `$${totalUsdDisbursed.toLocaleString()}`,
        remainingAmount: grant.remainingAmount,
        remainingAmountFormatted: `${grant.remainingAmount.toLocaleString()} GRAIN`,
        percentDisbursed: grant.amount > 0 ? ((grant.totalDisbursed / grant.amount) * 100).toFixed(1) : '0',
      },
      grainPrice,
    })
  } catch (error: any) {
    console.error('[Grant Disburse API] GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Format a human-readable receipt text
 */
function formatReceiptText(receipt: any): string {
  return `
================================================================================
                           GRANT DISBURSEMENT RECEIPT
================================================================================

Receipt ID:     ${receipt.receiptId}
Date:           ${receipt.disbursedAt.toISOString()}

GRANTEE:        ${receipt.granteeName}
ENDOWMENT:      ${receipt.endowmentId}

--------------------------------------------------------------------------------
                              DISBURSEMENT DETAILS
--------------------------------------------------------------------------------

Amount:         ${receipt.amount.toLocaleString()} GRAIN
USD Value:      $${receipt.usdValue.toLocaleString()}
GRAIN Price:    $${receipt.grainPrice.toFixed(4)}

Method:         ${receipt.method.toUpperCase()}
Purpose:        ${receipt.purpose}

--------------------------------------------------------------------------------
                               IMPORTANT NOTICE
--------------------------------------------------------------------------------

This disbursement was made from the endowment's CREDIT LINE.
The endowment's protected deposit (principal) remains intact.

================================================================================
                          Thank you for using GRAIN
================================================================================
`.trim()
}
