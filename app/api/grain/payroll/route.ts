// @ts-nocheck
/**
 * GRAIN Payroll API
 *
 * POST /api/grain/payroll - Execute batch payroll in GRAIN
 * GET /api/grain/payroll - Get payroll history
 *
 * Companies can pay workers in GRAIN, giving them appreciating assets
 * instead of depreciating fiat. Workers benefit from treasury growth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { grainRail, PayrollEntry } from '@/lib/payments/grain-rail'
import { unifiedUser } from '@/lib/identity/unified-user'
import { neon } from '@neondatabase/serverless'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes for large payrolls

/**
 * POST - Execute batch payroll
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      entries,
      payPeriodStart,
      payPeriodEnd,
      currency = 'USD',
    } = body

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'No payroll entries provided' }, { status: 400 })
    }

    // Get company's unified identity
    const company = await unifiedUser.get(clerkUserId)
    if (!company) {
      return NextResponse.json(
        { error: 'Company account not found. Please complete onboarding.' },
        { status: 400 }
      )
    }

    // Get current GRAIN price
    const { price } = await grainRail.getPrice()

    // Process entries - resolve recipients and create PayrollEntry objects
    const payrollEntries: PayrollEntry[] = []
    const resolveErrors: Array<{ email: string; error: string }> = []

    for (const entry of entries) {
      const { email, userId, amount, description, jobId } = entry

      if (!amount || amount <= 0) {
        resolveErrors.push({ email: email || userId, error: 'Invalid amount' })
        continue
      }

      // Resolve employee
      let employeeUserId: string

      if (userId) {
        employeeUserId = userId
      } else if (email) {
        const employee = await unifiedUser.findByEmail(email)
        if (employee) {
          employeeUserId = employee.unifiedId
        } else {
          // Create account for new employee
          const newEmployee = await unifiedUser.createOrLink({
            email,
            source: 'grainvault',
          })
          employeeUserId = newEmployee.unifiedId
        }
      } else {
        resolveErrors.push({ email: 'unknown', error: 'Missing email or userId' })
        continue
      }

      payrollEntries.push({
        employeeUserId,
        amount,
        currency: currency as 'USD' | 'GRAIN',
        payPeriodStart: new Date(payPeriodStart || Date.now()),
        payPeriodEnd: new Date(payPeriodEnd || Date.now()),
        jobId,
        description,
      })
    }

    if (payrollEntries.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid payroll entries',
        resolveErrors,
      }, { status: 400 })
    }

    // Calculate totals before execution
    const totalUsd = payrollEntries.reduce((sum, e) =>
      sum + (e.currency === 'USD' ? e.amount : e.amount * price), 0)
    const totalGrainNeeded = totalUsd / price
    const feeEstimate = totalGrainNeeded * 0.01 // 1% fee

    // Check company balance
    const companyProfile = await grainRail.getProfile(company.unifiedId)
    const availableFunds = (companyProfile?.grainBalance || 0) +
                          (companyProfile?.creditAvailable || 0)

    if (availableFunds < totalGrainNeeded + feeEstimate) {
      return NextResponse.json({
        success: false,
        needsFunding: true,
        required: {
          totalGrain: totalGrainNeeded,
          totalUsd,
          fee: feeEstimate,
          totalNeeded: totalGrainNeeded + feeEstimate,
        },
        available: {
          grainBalance: companyProfile?.grainBalance || 0,
          creditAvailable: companyProfile?.creditAvailable || 0,
          total: availableFunds,
        },
        shortage: (totalGrainNeeded + feeEstimate) - availableFunds,
      }, { status: 402 }) // Payment Required
    }

    // Execute payroll
    const result = await grainRail.payroll(company.unifiedId, payrollEntries)

    // Get updated company balance
    const updatedProfile = await grainRail.getProfile(company.unifiedId)

    return NextResponse.json({
      success: result.success,
      batchId: result.batchId,
      summary: {
        totalGrain: result.totalGrain,
        totalUsd: result.totalUsd,
        grainPrice: price,
        successCount: result.successCount,
        failedCount: result.failedCount,
        entriesProcessed: payrollEntries.length,
      },
      failures: result.failures,
      resolveErrors,
      companyBalance: {
        grain: updatedProfile?.grainBalance || 0,
        creditUsed: updatedProfile?.creditUsed || 0,
        creditAvailable: updatedProfile?.creditAvailable || 0,
      },
      message: result.success
        ? `Payroll complete: ${result.successCount} employees paid ${result.totalGrain.toLocaleString()} GRAIN ($${result.totalUsd.toFixed(2)})`
        : `Payroll partially complete: ${result.successCount}/${payrollEntries.length} payments succeeded`,
    })

  } catch (error: any) {
    console.error('[GRAIN Payroll] Error:', error)
    return NextResponse.json(
      { error: 'Payroll failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET - Get payroll history
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sql) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const searchParams = request.nextUrl.searchParams
    const batchId = searchParams.get('batchId')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get user's unified identity
    const user = await unifiedUser.get(clerkUserId)
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 })
    }

    let batches

    if (batchId) {
      // Get specific batch
      batches = await sql`
        SELECT * FROM payroll_batches
        WHERE id = ${batchId} AND company_user_id = ${user.unifiedId}
      `
    } else {
      // Get recent batches
      batches = await sql`
        SELECT * FROM payroll_batches
        WHERE company_user_id = ${user.unifiedId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }

    // Get individual payroll transactions for each batch
    const batchesWithDetails = await Promise.all(
      batches.map(async (batch: any) => {
        const transactions = await sql`
          SELECT
            ut.*,
            ta.email as employee_email
          FROM unified_transactions ut
          LEFT JOIN treasury_accounts ta ON ta.id::text = ut.counterparty_id OR ta.clerk_user_id = ut.counterparty_id
          WHERE ut.reference = ${batch.id}
            AND ut.type = 'payroll'
          ORDER BY ut.created_at
        `

        // Get current price for appreciation calculation
        const { price } = await grainRail.getPrice()
        const priceAtPayment = parseFloat(batch.grain_price)
        const appreciation = priceAtPayment > 0
          ? ((price - priceAtPayment) / priceAtPayment) * 100
          : 0

        return {
          id: batch.id,
          totalGrain: parseFloat(batch.total_grain),
          totalUsd: parseFloat(batch.total_usd),
          grainPriceAtPayment: priceAtPayment,
          currentGrainPrice: price,
          appreciationPercent: appreciation.toFixed(2),
          currentTotalValue: parseFloat(batch.total_grain) * price,
          entryCount: batch.entry_count,
          successCount: batch.success_count,
          failedCount: batch.failed_count,
          payPeriodStart: batch.pay_period_start,
          payPeriodEnd: batch.pay_period_end,
          status: batch.status,
          createdAt: batch.created_at,
          payments: transactions.map((t: any) => ({
            transactionId: t.id,
            employeeUserId: t.counterparty_id,
            employeeEmail: t.employee_email,
            grainAmount: parseFloat(t.amount),
            grainPriceAtPayment: parseFloat(t.grain_price_at_execution),
            currentValue: parseFloat(t.amount) * price,
            status: t.status,
            createdAt: t.created_at,
          })),
        }
      })
    )

    // Also get incoming payroll for this user (if they're an employee)
    const incomingPayroll = await sql`
      SELECT
        ut.*,
        ta.company_name as company_name,
        ta.email as company_email
      FROM unified_transactions ut
      LEFT JOIN treasury_accounts ta ON ta.id::text = ut.user_id OR ta.clerk_user_id = ut.user_id
      WHERE ut.counterparty_id = ${user.unifiedId}
        AND ut.type = 'payroll'
      ORDER BY ut.created_at DESC
      LIMIT ${limit}
    `

    const { price: currentPrice } = await grainRail.getPrice()

    const incomingTransformed = incomingPayroll.map((t: any) => {
      const grainAmount = parseFloat(t.amount)
      const priceAtPayment = parseFloat(t.grain_price_at_execution)
      const currentValue = grainAmount * currentPrice
      const valueAtPayment = grainAmount * priceAtPayment
      const appreciation = currentValue - valueAtPayment

      return {
        transactionId: t.id,
        from: t.company_name || t.company_email || t.user_id,
        grainAmount,
        grainPriceAtPayment: priceAtPayment,
        usdValueAtPayment: valueAtPayment,
        currentValue,
        appreciation,
        appreciationPercent: priceAtPayment > 0
          ? (((currentPrice - priceAtPayment) / priceAtPayment) * 100).toFixed(2)
          : '0',
        memo: t.memo,
        reference: t.reference,
        status: t.status,
        createdAt: t.created_at,
      }
    })

    return NextResponse.json({
      asCompany: {
        batches: batchesWithDetails,
      },
      asEmployee: {
        payments: incomingTransformed,
        totalEarnings: incomingTransformed.reduce((sum, t) => sum + t.grainAmount, 0),
        totalCurrentValue: incomingTransformed.reduce((sum, t) => sum + t.currentValue, 0),
        totalAppreciation: incomingTransformed.reduce((sum, t) => sum + t.appreciation, 0),
      },
      currentGrainPrice: currentPrice,
    })

  } catch (error: any) {
    console.error('[GRAIN Payroll GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get payroll history', details: error.message },
      { status: 500 }
    )
  }
}
