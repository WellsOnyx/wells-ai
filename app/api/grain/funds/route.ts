// @ts-nocheck
/**
 * Grain & Vault Restricted Funds API
 *
 * Endpoints for managing restricted fund accounting:
 * - GET: List funds for organization
 * - POST: Create new fund
 * - PATCH: Update fund
 *
 * Supports all three fund types:
 * - Unrestricted
 * - Temporarily Restricted
 * - Permanently Restricted (Endowment)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  createFund,
  getFundsByOrg,
  getFundTotalsByType,
  updateFund,
  allocateDeposit,
  validateSpending,
  recordSpending,
  requestRestrictionRelease,
  completeRestrictionRelease,
  processScheduledReleases,
  type CreateFundInput,
  type UpdateFundInput,
  type RestrictionType,
  type FundStatus,
  type ReleaseType,
} from '@/lib/grain/restricted-funds'

// ============================================================================
// GET: List funds for organization
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const orgId = searchParams.get('orgId')
    const restrictionType = searchParams.get('type') as RestrictionType | null
    const status = searchParams.get('status') as FundStatus | null
    const includeTotals = searchParams.get('includeTotals') === 'true'
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      )
    }

    // Fetch funds
    const funds = await getFundsByOrg(orgId, {
      restrictionType: restrictionType || undefined,
      status: status || undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    })

    // Optionally include totals by type
    let totals = null
    if (includeTotals) {
      totals = await getFundTotalsByType(orgId)
    }

    return NextResponse.json({
      success: true,
      funds,
      totals,
      count: funds.length,
    })
  } catch (error) {
    console.error('Error fetching funds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch funds' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST: Create fund or perform actions
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, ...data } = body

    switch (action) {
      // ========================================
      // Create a new fund
      // ========================================
      case 'create':
      case undefined: {
        const input: CreateFundInput = {
          orgId: data.orgId,
          name: data.name,
          description: data.description,
          purpose: data.purpose,
          restrictionType: data.restrictionType || 'unrestricted',
          donorId: data.donorId,
          donorName: data.donorName,
          donorAnonymous: data.donorAnonymous,
          giftDate: data.giftDate ? new Date(data.giftDate) : undefined,
          giftAgreementUrl: data.giftAgreementUrl,
          releaseSchedule: data.releaseSchedule,
          releaseStartDate: data.releaseStartDate
            ? new Date(data.releaseStartDate)
            : undefined,
          releaseEndDate: data.releaseEndDate
            ? new Date(data.releaseEndDate)
            : undefined,
          releaseAmountPerPeriod: data.releaseAmountPerPeriod,
          spendingPolicy: data.spendingPolicy,
          spendingRatePercent: data.spendingRatePercent,
          underwaterThreshold: data.underwaterThreshold,
          initialPrincipal: data.initialPrincipal,
          createdBy: userId,
        }

        // Validation
        if (!input.orgId) {
          return NextResponse.json(
            { error: 'Organization ID required' },
            { status: 400 }
          )
        }

        if (!input.name) {
          return NextResponse.json(
            { error: 'Fund name required' },
            { status: 400 }
          )
        }

        if (!['unrestricted', 'temporarily_restricted', 'permanently_restricted'].includes(input.restrictionType)) {
          return NextResponse.json(
            { error: 'Invalid restriction type' },
            { status: 400 }
          )
        }

        // For temporarily restricted funds, require purpose
        if (input.restrictionType === 'temporarily_restricted' && !input.purpose) {
          return NextResponse.json(
            { error: 'Purpose required for temporarily restricted funds' },
            { status: 400 }
          )
        }

        // For permanently restricted (endowment), recommend spending policy
        if (input.restrictionType === 'permanently_restricted') {
          if (!input.spendingRatePercent && !input.spendingPolicy) {
            // Default to 5% spending rate if not specified
            input.spendingRatePercent = 0.05
            input.spendingPolicy = '5% of trailing 12-quarter average market value'
          }
        }

        const fund = await createFund(input)

        return NextResponse.json({
          success: true,
          fund,
          message: `${input.restrictionType.replace('_', ' ')} fund created successfully`,
        })
      }

      // ========================================
      // Allocate deposit to fund
      // ========================================
      case 'allocate': {
        if (!data.fundId || !data.allocatedAmount) {
          return NextResponse.json(
            { error: 'Fund ID and allocated amount required' },
            { status: 400 }
          )
        }

        const allocation = await allocateDeposit({
          depositId: data.depositId,
          depositAmount: data.depositAmount || data.allocatedAmount,
          depositDate: data.depositDate ? new Date(data.depositDate) : new Date(),
          donorId: data.donorId,
          fundId: data.fundId,
          allocatedAmount: data.allocatedAmount,
          allocationPercentage: data.allocationPercentage,
          designation: data.designation,
          donorIntent: data.donorIntent,
          allocatedBy: userId,
        })

        return NextResponse.json({
          success: true,
          allocation,
          message: 'Deposit allocated to fund',
        })
      }

      // ========================================
      // Validate spending request
      // ========================================
      case 'validate_spending': {
        if (!data.fundId || data.amount === undefined || !data.purpose) {
          return NextResponse.json(
            { error: 'Fund ID, amount, and purpose required' },
            { status: 400 }
          )
        }

        const validation = await validateSpending(
          data.fundId,
          data.amount,
          data.purpose
        )

        return NextResponse.json({
          success: true,
          validation,
          canSpend: validation.isValid,
        })
      }

      // ========================================
      // Record spending (with validation)
      // ========================================
      case 'spend': {
        if (!data.fundId || !data.amount || !data.description) {
          return NextResponse.json(
            { error: 'Fund ID, amount, and description required' },
            { status: 400 }
          )
        }

        const result = await recordSpending({
          fundId: data.fundId,
          amount: data.amount,
          type: data.type || 'program_expense',
          description: data.description,
          relatedGrantId: data.relatedGrantId,
          relatedProgramId: data.relatedProgramId,
          approvedBy: data.approvedBy || userId,
          createdBy: userId,
        })

        if (!result.success) {
          return NextResponse.json(
            { error: result.error, success: false },
            { status: 400 }
          )
        }

        return NextResponse.json({
          success: true,
          transaction: result.transaction,
          message: 'Spending recorded successfully',
        })
      }

      // ========================================
      // Request restriction release
      // ========================================
      case 'request_release': {
        if (!data.fundId || !data.amount || !data.releaseType || !data.reason) {
          return NextResponse.json(
            { error: 'Fund ID, amount, release type, and reason required' },
            { status: 400 }
          )
        }

        const validReleaseTypes: ReleaseType[] = [
          'time_based',
          'purpose_fulfilled',
          'board_approved',
          'donor_approved',
          'legal_requirement',
          'fund_termination',
        ]

        if (!validReleaseTypes.includes(data.releaseType)) {
          return NextResponse.json(
            { error: 'Invalid release type' },
            { status: 400 }
          )
        }

        const release = await requestRestrictionRelease({
          fundId: data.fundId,
          amount: data.amount,
          releaseType: data.releaseType,
          reason: data.reason,
          supportingDocumentation: data.supportingDocumentation,
          destinationFundId: data.destinationFundId,
          destinationType: data.destinationType,
          authorizedBy: data.authorizedBy || userId,
          authorizationDate: data.authorizationDate
            ? new Date(data.authorizationDate)
            : new Date(),
        })

        return NextResponse.json({
          success: true,
          release,
          message: 'Restriction release requested',
        })
      }

      // ========================================
      // Complete restriction release
      // ========================================
      case 'complete_release': {
        if (!data.releaseId) {
          return NextResponse.json(
            { error: 'Release ID required' },
            { status: 400 }
          )
        }

        const release = await completeRestrictionRelease(data.releaseId, userId)

        return NextResponse.json({
          success: true,
          release,
          message: 'Restriction release completed',
        })
      }

      // ========================================
      // Process scheduled releases (admin)
      // ========================================
      case 'process_scheduled': {
        const count = await processScheduledReleases()

        return NextResponse.json({
          success: true,
          releasesProcessed: count,
          message: `Processed ${count} scheduled releases`,
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in funds API:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH: Update fund
// ============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { fundId, ...updates } = body

    if (!fundId) {
      return NextResponse.json(
        { error: 'Fund ID required' },
        { status: 400 }
      )
    }

    const input: UpdateFundInput = {
      name: updates.name,
      description: updates.description,
      purpose: updates.purpose,
      releaseSchedule: updates.releaseSchedule,
      releaseStartDate: updates.releaseStartDate
        ? new Date(updates.releaseStartDate)
        : undefined,
      releaseEndDate: updates.releaseEndDate
        ? new Date(updates.releaseEndDate)
        : undefined,
      releaseAmountPerPeriod: updates.releaseAmountPerPeriod,
      spendingPolicy: updates.spendingPolicy,
      spendingRatePercent: updates.spendingRatePercent,
      underwaterThreshold: updates.underwaterThreshold,
      linkedGrantIds: updates.linkedGrantIds,
      linkedProgramIds: updates.linkedProgramIds,
      status: updates.status,
      updatedBy: userId,
    }

    // Validate status if provided
    if (input.status && !['active', 'frozen', 'fully_released', 'closed'].includes(input.status)) {
      return NextResponse.json(
        { error: 'Invalid fund status' },
        { status: 400 }
      )
    }

    const fund = await updateFund(fundId, input)

    if (!fund) {
      return NextResponse.json(
        { error: 'Fund not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      fund,
      message: 'Fund updated successfully',
    })
  } catch (error) {
    console.error('Error updating fund:', error)
    return NextResponse.json(
      { error: 'Failed to update fund' },
      { status: 500 }
    )
  }
}
