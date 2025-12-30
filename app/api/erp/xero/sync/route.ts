// @ts-nocheck
/**
 * Xero Sync API
 *
 * POST /api/erp/xero/sync - Trigger sync for a Xero connection
 * GET /api/erp/xero/sync - Get sync status
 *
 * Syncs contacts (vendors), bills (invoices), and payments from Xero
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { xero } from '@/lib/erp/xero'

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

    if (connection.provider !== 'xero') {
      return NextResponse.json(
        { error: 'This endpoint is for Xero connections only' },
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
      // Sync contacts (vendors/suppliers)
      const contacts = await xero.fetchContacts(connectionId)
      for (const contact of contacts) {
        try {
          await sql`
            INSERT INTO erp_vendors (
              erp_connection_id,
              external_vendor_id,
              vendor_name,
              vendor_display_name,
              email,
              phone,
              address_line1,
              address_line2,
              city,
              state,
              postal_code,
              country,
              tax_id,
              is_active,
              default_currency,
              raw_data
            ) VALUES (
              ${connectionId},
              ${contact.ContactID},
              ${contact.Name},
              ${contact.Name},
              ${contact.EmailAddress || null},
              ${contact.Phones?.[0]?.PhoneNumber || null},
              ${contact.Addresses?.[0]?.AddressLine1 || null},
              ${contact.Addresses?.[0]?.AddressLine2 || null},
              ${contact.Addresses?.[0]?.City || null},
              ${contact.Addresses?.[0]?.Region || null},
              ${contact.Addresses?.[0]?.PostalCode || null},
              ${contact.Addresses?.[0]?.Country || 'US'},
              ${contact.TaxNumber || null},
              ${contact.ContactStatus === 'ACTIVE'},
              ${contact.DefaultCurrency || 'USD'},
              ${JSON.stringify(contact)}
            )
            ON CONFLICT (erp_connection_id, external_vendor_id)
            DO UPDATE SET
              vendor_name = EXCLUDED.vendor_name,
              email = EXCLUDED.email,
              phone = EXCLUDED.phone,
              is_active = EXCLUDED.is_active,
              raw_data = EXCLUDED.raw_data,
              updated_at = NOW()
          `
          vendorsFound++
        } catch (error: any) {
          errors.push(`Contact ${contact.ContactID}: ${error.message}`)
        }
      }

      // Sync bills (ACCPAY invoices - last 90 days)
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const invoices = await xero.fetchInvoices(connectionId, {
        type: 'ACCPAY', // Bills/payables
        dateFrom: ninetyDaysAgo,
      })

      for (const invoice of invoices) {
        try {
          const totalAmount = invoice.Total || 0
          const amountPaid = invoice.AmountPaid || 0
          const amountDue = invoice.AmountDue || 0
          const wellsFee = totalAmount * 0.01
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
              ${invoice.InvoiceID},
              ${invoice.Contact?.ContactID || null},
              ${invoice.InvoiceNumber || null},
              ${invoice.Contact?.Name || 'Unknown'},
              ${totalAmount},
              ${invoice.CurrencyCode || 'USD'},
              ${invoice.Date},
              ${invoice.DueDate},
              ${amountDue > 0 ? 'pending' : 'paid_external'},
              ${amountDue > 0 ? 'unpaid' : 'paid'},
              ${amountPaid},
              ${wellsFee},
              ${paymentCostSaved},
              ${netSavings},
              ${JSON.stringify(invoice.LineItems || [])},
              ${invoice.Reference || null},
              ${JSON.stringify(invoice)}
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
          errors.push(`Invoice ${invoice.InvoiceID}: ${error.message}`)
        }
      }

      // Sync payments (last 90 days)
      const payments = await xero.fetchPayments(connectionId, {
        dateFrom: ninetyDaysAgo,
      })

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
              ${payment.PaymentID},
              ${payment.Invoice?.Contact?.ContactID || null},
              ${payment.Amount},
              ${payment.PaymentType || 'unknown'},
              ${payment.Date},
              ${payment.Reference || null},
              ${null},
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
          errors.push(`Payment ${payment.PaymentID}: ${error.message}`)
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
    console.error('[Xero Sync] Error:', error)
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
    console.error('[Xero Sync Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status', details: error.message },
      { status: 500 }
    )
  }
}
