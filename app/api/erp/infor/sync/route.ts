// @ts-nocheck
/**
 * Infor Sync API
 *
 * POST /api/erp/infor/sync - Trigger sync for an Infor connection
 * GET /api/erp/infor/sync - Get sync status
 *
 * Syncs vendors, bills/invoices, and payments from Infor
 * Supports: CloudSuite Financials (CSF), LN Finance, M3, SyteLine
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { infor } from '@/lib/erp/infor'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

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
      SELECT id, user_id, provider, connection_status, infor_product
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

    if (connection.provider !== 'infor') {
      return NextResponse.json(
        { error: 'This endpoint is for Infor connections only' },
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

    // Run the sync
    const result = await infor.fullSync(connectionId)

    return NextResponse.json({
      success: true,
      connectionId,
      product: connection.infor_product,
      syncType,
      results: {
        vendors: result.vendorsFound,
        bills: result.billsFound,
        payments: result.paymentsFound,
        errors: result.errors,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Infor Sync] Error:', error)

    // Try to update sync status to failed
    const body = await request.json().catch(() => ({}))
    if (body.connectionId && sql) {
      await sql`
        UPDATE erp_connections
        SET
          last_sync_status = 'failed',
          last_sync_error = ${error.message}
        WHERE id = ${body.connectionId}
      `.catch(() => {})
    }

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
        next_sync_at,
        infor_product
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
      product: connection.infor_product,
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
    console.error('[Infor Sync Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status', details: error.message },
      { status: 500 }
    )
  }
}
