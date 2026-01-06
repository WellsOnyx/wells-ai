// @ts-nocheck
/**
 * Grain & Vault Individual Fund API
 *
 * Endpoints for single fund operations:
 * - GET: Get fund details with balance and transactions
 * - POST: Fund-specific actions (investment, mark purpose fulfilled)
 * - DELETE: Close/archive fund
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getFund,
  getFundBalance,
  getFundTransactions,
  getRestrictionReleases,
  updateFund,
  recordInvestmentActivity,
  markPurposeFulfilled,
  calculateSpendable,
  type TransactionType,
} from '@/lib/grain/restricted-funds'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================================
// GET: Get fund details
// ============================================================================

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: fundId } = await params
    const searchParams = req.nextUrl.searchParams
    const includeTransactions = searchParams.get('transactions') !== 'false'
    const includeReleases = searchParams.get('releases') !== 'false'
    const transactionLimit = parseInt(searchParams.get('transactionLimit') || '50')
    const transactionType = searchParams.get('transactionType') as TransactionType | null

    // Get fund with summary
    const fund = await getFund(fundId)

    if (!fund) {
      return NextResponse.json(
        { error: 'Fund not found' },
        { status: 404 }
      )
    }

    // Calculate current spendable balance
    const spendable = await calculateSpendable(fundId)

    // Get transactions if requested
    let transactions = null
    if (includeTransactions) {
      transactions = await getFundTransactions(fundId, {
        type: transactionType || undefined,
        limit: transactionLimit,
      })
    }

    // Get releases if requested
    let releases = null
    if (includeReleases) {
      releases = await getRestrictionReleases(fundId, {
        limit: 20,
      })
    }

    return NextResponse.json({
      success: true,
      fund: {
        ...fund,
        spendableInfo: spendable,
      },
      transactions,
      releases,
    })
  } catch (error) {
    console.error('Error fetching fund:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fund' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST: Fund-specific actions
// ============================================================================

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: fundId } = await params
    const body = await req.json()
    const { action, ...data } = body

    // Verify fund exists
    const fund = await getFund(fundId)
    if (!fund) {
      return NextResponse.json(
        { error: 'Fund not found' },
        { status: 404 }
      )
    }

    switch (action) {
      // ========================================
      // Record investment income
      // ========================================
      case 'investment_income': {
        if (data.amount === undefined) {
          return NextResponse.json(
            { error: 'Amount required' },
            { status: 400 }
          )
        }

        const transaction = await recordInvestmentActivity({
          fundId,
          type: 'investment_income',
          amount: data.amount,
          description: data.description || 'Investment income',
          createdBy: userId,
        })

        return NextResponse.json({
          success: true,
          transaction,
          message: 'Investment income recorded',
        })
      }

      // ========================================
      // Record realized gain/loss
      // ========================================
      case 'realized_gain':
      case 'realized_loss': {
        if (data.amount === undefined) {
          return NextResponse.json(
            { error: 'Amount required' },
            { status: 400 }
          )
        }

        const transaction = await recordInvestmentActivity({
          fundId,
          type: action as 'realized_gain' | 'realized_loss',
          amount: data.amount,
          description: data.description || `Realized ${action === 'realized_gain' ? 'gain' : 'loss'}`,
          createdBy: userId,
        })

        return NextResponse.json({
          success: true,
          transaction,
          message: `Realized ${action === 'realized_gain' ? 'gain' : 'loss'} recorded`,
        })
      }

      // ========================================
      // Record appreciation/depreciation
      // ========================================
      case 'appreciation':
      case 'depreciation': {
        if (data.amount === undefined) {
          return NextResponse.json(
            { error: 'Amount required' },
            { status: 400 }
          )
        }

        const transaction = await recordInvestmentActivity({
          fundId,
          type: action as 'appreciation' | 'depreciation',
          amount: data.amount,
          description: data.description || `Market value ${action}`,
          createdBy: userId,
        })

        return NextResponse.json({
          success: true,
          transaction,
          message: `${action.charAt(0).toUpperCase() + action.slice(1)} recorded`,
        })
      }

      // ========================================
      // Mark purpose fulfilled (for temp restricted)
      // ========================================
      case 'mark_purpose_fulfilled': {
        if (fund.restrictionType !== 'temporarily_restricted') {
          return NextResponse.json(
            { error: 'Only temporarily restricted funds can be marked as purpose fulfilled' },
            { status: 400 }
          )
        }

        if (!data.notes) {
          return NextResponse.json(
            { error: 'Fulfillment notes required' },
            { status: 400 }
          )
        }

        const updatedFund = await markPurposeFulfilled(fundId, data.notes, userId)

        return NextResponse.json({
          success: true,
          fund: updatedFund,
          message: 'Fund purpose marked as fulfilled - restrictions released',
        })
      }

      // ========================================
      // Freeze fund
      // ========================================
      case 'freeze': {
        const updatedFund = await updateFund(fundId, {
          status: 'frozen',
          updatedBy: userId,
        })

        return NextResponse.json({
          success: true,
          fund: updatedFund,
          message: 'Fund frozen',
        })
      }

      // ========================================
      // Unfreeze fund
      // ========================================
      case 'unfreeze': {
        if (fund.status !== 'frozen') {
          return NextResponse.json(
            { error: 'Fund is not frozen' },
            { status: 400 }
          )
        }

        const updatedFund = await updateFund(fundId, {
          status: 'active',
          updatedBy: userId,
        })

        return NextResponse.json({
          success: true,
          fund: updatedFund,
          message: 'Fund unfrozen',
        })
      }

      // ========================================
      // Link grant to fund
      // ========================================
      case 'link_grant': {
        if (!data.grantId) {
          return NextResponse.json(
            { error: 'Grant ID required' },
            { status: 400 }
          )
        }

        const currentGrants = fund.linkedGrantIds || []
        if (!currentGrants.includes(data.grantId)) {
          currentGrants.push(data.grantId)
        }

        const updatedFund = await updateFund(fundId, {
          linkedGrantIds: currentGrants,
          updatedBy: userId,
        })

        return NextResponse.json({
          success: true,
          fund: updatedFund,
          message: 'Grant linked to fund',
        })
      }

      // ========================================
      // Unlink grant from fund
      // ========================================
      case 'unlink_grant': {
        if (!data.grantId) {
          return NextResponse.json(
            { error: 'Grant ID required' },
            { status: 400 }
          )
        }

        const currentGrants = fund.linkedGrantIds || []
        const updatedGrants = currentGrants.filter((id: string) => id !== data.grantId)

        const updatedFund = await updateFund(fundId, {
          linkedGrantIds: updatedGrants,
          updatedBy: userId,
        })

        return NextResponse.json({
          success: true,
          fund: updatedFund,
          message: 'Grant unlinked from fund',
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in fund action:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE: Close/archive fund
// ============================================================================

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: fundId } = await params
    const searchParams = req.nextUrl.searchParams
    const force = searchParams.get('force') === 'true'

    // Get fund
    const fund = await getFund(fundId)
    if (!fund) {
      return NextResponse.json(
        { error: 'Fund not found' },
        { status: 404 }
      )
    }

    // Check if fund has balance
    if (fund.balance && fund.balance.corpusValue > 0 && !force) {
      return NextResponse.json(
        {
          error: 'Cannot close fund with remaining balance',
          balance: fund.balance.corpusValue,
          hint: 'Transfer or spend remaining balance first, or use force=true',
        },
        { status: 400 }
      )
    }

    // For permanently restricted funds, require additional confirmation
    if (fund.restrictionType === 'permanently_restricted' && !force) {
      return NextResponse.json(
        {
          error: 'Closing a permanently restricted fund requires force=true',
          hint: 'This action may have legal implications',
        },
        { status: 400 }
      )
    }

    // Close the fund (soft delete)
    const closedFund = await updateFund(fundId, {
      status: 'closed',
      updatedBy: userId,
    })

    return NextResponse.json({
      success: true,
      fund: closedFund,
      message: 'Fund closed successfully',
    })
  } catch (error) {
    console.error('Error closing fund:', error)
    return NextResponse.json(
      { error: 'Failed to close fund' },
      { status: 500 }
    )
  }
}
