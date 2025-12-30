// @ts-nocheck
/**
 * QuickBooks Sync API
 *
 * POST /api/erp/quickbooks/sync - Trigger sync for a QuickBooks connection
 * GET /api/erp/quickbooks/sync - Get sync status
 *
 * Syncs vendors, bills, and payments from QuickBooks Online
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { quickbooks } from '@/lib/erp/quickbooks'

const sql = process.env.DATABASE_URL?.startsWith('postgres')
  ? neon(process.env.DATABASE_URL)
  : null

export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes for full sync

/**
 * POST - Trigger a sync
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { connectionId, syncType = 'full' } = body

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      )
    }

    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Verify ownership
    const [connection] = await sql`
      SELECT id, user_id, provider, connection_status
      FROM erp_connections
      WHERE id = ${connectionId}
    `

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    if (connection.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (connection.provider !== 'quickbooks') {
      return NextResponse.json(
        { error: 'This endpoint is for QuickBooks connections only' },
        { status: 400 }
      )
    }

    if (connection.connection_status !== 'active') {
      return NextResponse.json(
        { error: 'Connection is not active - please reconnect' },
        { status: 400 }
      )
    }

    // Mark sync as started
    await sql`
      UPDATE erp_connections
      SET
        last_sync_at = NOW(),
        last_sync_status = 'running',
        updated_at = NOW()
      WHERE id = ${connectionId}
    `

    const errors: string[] = []
    let vendorsFound = 0
    let billsFound = 0
    let paymentsFound = 0

    try {
      // Sync vendors
      const vendors = await quickbooks.fetchVendors(connectionId)
      for (const vendor of vendors) {
        try {
          await quickbooks.syncVendorToDatabase(connectionId, vendor)
          vendorsFound++
        } catch (error: any) {
          errors.push(`Vendor ${vendor.Id}: ${error.message}`)
        }
      }

      // Sync bills (last 90 days)
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const bills = await quickbooks.fetchBills(connectionId, ninetyDaysAgo)

      for (const bill of bills) {
        try {
          // Use the private method via direct SQL since syncBillToDatabase is private
          const wellsFee = bill.TotalAmt * 0.01
          const paymentCostSaved = 25
          const netSavings = paymentCostSaved - wellsFee

          await sql`
            INSERT INTO erp_bills (
              erp_connection_id,
              external_bill_id,
              external_vendor_id,
              bill_number,
              vendor_name,
              total_amount,
              currency,
              bill_date,
              due_date,
              status,
              paid_status,
              amount_paid,
              wells_fee_amount,
              payment_cost_saved,
              net_customer_savings,
              line_items,
              memo,
              raw_data
            ) VALUES (
              ${connectionId},
              ${bill.Id},
              ${bill.VendorRef?.value || null},
              ${bill.DocNumber || null},
              ${bill.VendorRef?.name || 'Unknown'},
              ${bill.TotalAmt},
              'USD',
              ${bill.TxnDate},
              ${bill.DueDate},
              ${bill.Balance > 0 ? 'pending' : 'paid_external'},
              ${bill.Balance > 0 ? 'unpaid' : 'paid'},
              ${bill.TotalAmt - bill.Balance},
              ${wellsFee},
              ${paymentCostSaved},
              ${netSavings},
              ${JSON.stringify(bill.Line || [])},
              ${bill.PrivateNote || null},
              ${JSON.stringify(bill)}
            )
            ON CONFLICT (erp_connection_id, external_bill_id)
            DO UPDATE SET
              total_amount = EXCLUDED.total_amount,
              status = EXCLUDED.status,
              paid_status = EXCLUDED.paid_status,
              amount_paid = EXCLUDED.amount_paid,
              raw_data = EXCLUDED.raw_data,
              updated_at = NOW()
          `
          billsFound++
        } catch (error: any) {
          errors.push(`Bill ${bill.Id}: ${error.message}`)
        }
      }

      // Sync payments (last 90 days)
      const payments = await quickbooks.fetchPayments(connectionId, ninetyDaysAgo)
      for (const payment of payments) {
        try {
          await sql`
            INSERT INTO erp_payments (
              erp_connection_id,
              external_payment_id,
              external_vendor_id,
              payment_amount,
              payment_method,
              payment_date,
              reference_number,
              memo,
              raw_data
            ) VALUES (
              ${connectionId},
              ${payment.Id},
              ${payment.VendorRef?.value || null},
              ${payment.TotalAmt},
              ${payment.PayType || 'unknown'},
              ${payment.TxnDate},
              ${payment.DocNumber || null},
              ${payment.PrivateNote || null},
              ${JSON.stringify(payment)}
            )
            ON CONFLICT (erp_connection_id, external_payment_id)
            DO UPDATE SET
              payment_amount = EXCLUDED.payment_amount,
              raw_data = EXCLUDED.raw_data,
              updated_at = NOW()
          `
          paymentsFound++
        } catch (error: any) {
          errors.push(`Payment ${payment.Id}: ${error.message}`)
        }
      }

      // Update sync status
      await sql`
        UPDATE erp_connections
        SET
          last_sync_status = 'completed',
          last_sync_error = null,
          next_sync_at = NOW() + INTERVAL '4 hours',
          updated_at = NOW()
        WHERE id = ${connectionId}
      `
    } catch (error: any) {
      await sql`
        UPDATE erp_connections
        SET
          last_sync_status = 'failed',
          last_sync_error = ${error.message}
        WHERE id = ${connectionId}
      `
      errors.push(error.message)
    }

    return NextResponse.json({
      success: true,
      connectionId,
      syncType,
      results: {
        vendors: vendorsFound,
        bills: billsFound,
        payments: paymentsFound,
        errors,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[QuickBooks Sync] Error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET - Get sync status
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      )
    }

    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get connection with sync status
    const [connection] = await sql`
      SELECT
        id,
        user_id,
        provider,
        connection_status,
        last_sync_at,
        last_sync_status,
        last_sync_error,
        next_sync_at
      FROM erp_connections
      WHERE id = ${connectionId}
    `

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    if (connection.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get sync stats
    const [vendorCount] = await sql`
      SELECT COUNT(*) as count FROM erp_vendors
      WHERE erp_connection_id = ${connectionId}
    `

    const [billCount] = await sql`
      SELECT COUNT(*) as count FROM erp_bills
      WHERE erp_connection_id = ${connectionId}
    `

    const [paymentCount] = await sql`
      SELECT COUNT(*) as count FROM erp_payments
      WHERE erp_connection_id = ${connectionId}
    `

    return NextResponse.json({
      connectionId,
      status: connection.last_sync_status || 'never',
      lastSyncAt: connection.last_sync_at,
      lastSyncError: connection.last_sync_error,
      nextSyncAt: connection.next_sync_at,
      stats: {
        vendors: parseInt(vendorCount?.count || '0'),
        bills: parseInt(billCount?.count || '0'),
        payments: parseInt(paymentCount?.count || '0'),
      },
    })
  } catch (error: any) {
    console.error('[QuickBooks Sync Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status', details: error.message },
      { status: 500 }
    )
  }
}
