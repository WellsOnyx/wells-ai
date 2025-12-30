// @ts-nocheck
/**
 * Infor CloudSuite General Ledger API
 *
 * GET /api/erp/infor/gl/accounts - List GL accounts
 * GET /api/erp/infor/gl/costcenters - List cost centers
 * POST /api/erp/infor/gl/journal - Create journal entry
 */

import { NextRequest, NextResponse } from 'next/server'
import { getInforAdapter } from '../connect/route'

/**
 * GET - Get GL accounts or cost centers
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenant = searchParams.get('tenant')
    const type = searchParams.get('type') || 'accounts'

    if (!tenant) {
      return NextResponse.json(
        { error: 'tenant parameter is required' },
        { status: 400 }
      )
    }

    const adapter = getInforAdapter(tenant)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Infor first via POST /api/erp/infor/connect',
        },
        { status: 400 }
      )
    }

    if (type === 'costcenters' || type === 'costCenters') {
      const costCenters = await adapter.getCostCenters()

      return NextResponse.json({
        costCenters,
        total: costCenters.length,
      })
    }

    // Default: GL accounts
    const accounts = await adapter.getGLAccounts()

    // Group by type for easier consumption
    const byType = accounts.reduce((acc, acct) => {
      if (!acc[acct.type]) {
        acc[acct.type] = []
      }
      acc[acct.type].push(acct)
      return acc
    }, {} as Record<string, typeof accounts>)

    return NextResponse.json({
      accounts,
      byType,
      total: accounts.length,
    })
  } catch (error) {
    console.error('Infor GL GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch GL data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Create journal entry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenant, ...journalData } = body

    if (!tenant) {
      return NextResponse.json(
        { error: 'tenant is required in request body' },
        { status: 400 }
      )
    }

    if (!journalData.lines || journalData.lines.length === 0) {
      return NextResponse.json(
        { error: 'lines array is required with at least one entry' },
        { status: 400 }
      )
    }

    // Validate journal entry balance
    const totalDebits = journalData.lines.reduce(
      (sum: number, line: { debit?: number }) => sum + (line.debit || 0),
      0
    )
    const totalCredits = journalData.lines.reduce(
      (sum: number, line: { credit?: number }) => sum + (line.credit || 0),
      0
    )

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        {
          error: 'Journal entry out of balance',
          totalDebits,
          totalCredits,
          difference: Math.abs(totalDebits - totalCredits),
        },
        { status: 400 }
      )
    }

    const adapter = getInforAdapter(tenant)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Infor first via POST /api/erp/infor/connect',
        },
        { status: 400 }
      )
    }

    // Parse date
    if (journalData.date) {
      journalData.date = new Date(journalData.date)
    } else {
      journalData.date = new Date()
    }

    const result = await adapter.createJournalEntry(journalData)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to create journal entry',
          message: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      journalEntry: result.data,
      externalId: result.externalId,
      warnings: result.warnings,
      message: 'Journal entry created successfully',
    })
  } catch (error) {
    console.error('Infor GL POST error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create journal entry',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
