// @ts-nocheck
/**
 * Coupa GL/Accounting API
 *
 * GET /api/erp/coupa/gl?type=accounts - List chart of accounts
 * GET /api/erp/coupa/gl?type=departments - List departments (cost centers)
 * POST /api/erp/coupa/gl - Create journal entry (expense report in Coupa)
 *
 * Note: Coupa doesn't have native journal entries - we create expense reports
 * for GRAIN transactions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCoupaAdapter } from '../connect/route'

/**
 * GET - Get accounts or departments
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const instanceUrl = searchParams.get('instanceUrl')
    const type = searchParams.get('type') || 'accounts'

    if (!instanceUrl) {
      return NextResponse.json(
        { error: 'instanceUrl parameter is required' },
        { status: 400 }
      )
    }

    const instanceId = instanceUrl.replace(/\./g, '_')
    const adapter = getCoupaAdapter(instanceId)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Coupa first via POST /api/erp/coupa/connect',
        },
        { status: 400 }
      )
    }

    if (type === 'departments' || type === 'costcenters' || type === 'costCenters') {
      const costCenters = await adapter.getCostCenters()

      return NextResponse.json({
        departments: costCenters,
        costCenters, // Alias for consistency
        total: costCenters.length,
      })
    }

    // Default: Chart of accounts
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
    console.error('Coupa GL GET error:', error)
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
 * POST - Create journal entry (as expense report in Coupa)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { instanceUrl, ...journalData } = body

    if (!instanceUrl) {
      return NextResponse.json(
        { error: 'instanceUrl is required in request body' },
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

    const instanceId = instanceUrl.replace(/\./g, '_')
    const adapter = getCoupaAdapter(instanceId)

    if (!adapter) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect to Coupa first via POST /api/erp/coupa/connect',
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
          error: 'Failed to create expense report',
          message: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      journalEntry: result.data,
      externalId: result.externalId,
      warnings: result.warnings || [
        'Coupa does not support native journal entries. Created as Expense Report.',
      ],
      message: 'Expense report created successfully in Coupa',
      note: 'For full journal entry support, sync with your primary ERP system.',
    })
  } catch (error) {
    console.error('Coupa GL POST error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create expense report',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
