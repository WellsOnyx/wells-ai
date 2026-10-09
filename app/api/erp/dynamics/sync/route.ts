// Dynamics 365 Full Sync API
// Trigger manual sync or get sync status for Dynamics 365 F&O / Business Central
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { dynamics365 } from '@/lib/erp/dynamics365';
import { interceptService } from '@/lib/erp/intercept-service';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// POST - Trigger full sync
export async function POST(req: NextRequest) {
  try {
    const { connectionId, scanForIntercepts = true } = await req.json();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Verify connection exists and is active
    const [connection] = await sql`
      SELECT id, connection_status, dynamics_variant, company_id, company_name
      FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'dynamics365'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'Dynamics 365 connection not found' }, { status: 404 });
    }

    if (connection.connection_status !== 'active') {
      return NextResponse.json({ error: 'Dynamics 365 connection is not active' }, { status: 400 });
    }

    // Create sync log
    const [syncLog] = await sql`
      INSERT INTO erp_sync_logs (
        erp_connection_id,
        sync_type,
        status,
        started_at
      ) VALUES (
        ${connectionId},
        'full',
        'started',
        NOW()
      )
      RETURNING id
    `;

    // Perform full sync
    const startTime = Date.now();
    const result = await dynamics365.fullSync(connectionId);

    // Update sync log
    const duration = Math.round((Date.now() - startTime) / 1000);
    await sql`
      UPDATE erp_sync_logs
      SET
        status = ${result.errors.length > 0 ? 'completed_with_errors' : 'completed'},
        vendors_found = ${result.vendorsFound},
        invoices_found = ${result.invoicesFound},
        payments_found = ${result.paymentsFound},
        error_message = ${result.errors.length > 0 ? result.errors.join('; ') : null},
        completed_at = NOW(),
        duration_seconds = ${duration}
      WHERE id = ${syncLog.id}
    `;

    // Scan for intercept opportunities if requested
    let interceptResult = null;
    if (scanForIntercepts) {
      try {
        interceptResult = await interceptService.scanForPayables(connectionId);
      } catch (error) {
        console.error('Intercept scan failed:', error);
      }
    }

    return NextResponse.json({
      success: true,
      syncId: syncLog.id,
      duration,
      vendorsFound: result.vendorsFound,
      invoicesFound: result.invoicesFound,
      paymentsFound: result.paymentsFound,
      errors: result.errors.length > 0 ? result.errors : undefined,
      intercepts: interceptResult || undefined,
    });
  } catch (error) {
    console.error('Dynamics sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// GET - Get sync status
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Get connection sync status
    const [connection] = await sql`
      SELECT
        id,
        connection_status,
        dynamics_variant,
        dynamics_host,
        dynamics_tenant_id,
        dynamics_company_id,
        dynamics_environment,
        company_name,
        last_sync_at,
        last_sync_status,
        last_sync_error,
        next_sync_at
      FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'dynamics365'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'Dynamics 365 connection not found' }, { status: 404 });
    }

    // Get recent sync logs
    const logs = await sql`
      SELECT
        id,
        sync_type,
        status,
        vendors_found,
        invoices_found,
        payments_found,
        intercepts_created,
        error_message,
        started_at,
        completed_at,
        duration_seconds
      FROM erp_sync_logs
      WHERE erp_connection_id = ${connectionId}
      ORDER BY started_at DESC
      LIMIT 10
    `;

    // Get overall stats
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*) FROM erp_vendors WHERE erp_connection_id = ${connectionId}) as total_vendors,
        (SELECT COUNT(*) FROM erp_bills WHERE erp_connection_id = ${connectionId}) as total_invoices,
        (SELECT COUNT(*) FROM erp_bills WHERE erp_connection_id = ${connectionId} AND status = 'pending') as pending_invoices,
        (SELECT SUM(total_amount) FROM erp_bills WHERE erp_connection_id = ${connectionId} AND status = 'pending') as pending_amount,
        (SELECT COUNT(*) FROM erp_bills WHERE erp_connection_id = ${connectionId} AND status = 'intercepted') as intercepted_invoices,
        (SELECT COUNT(*) FROM erp_payments WHERE erp_connection_id = ${connectionId}) as total_payments
    `;

    return NextResponse.json({
      connection: {
        id: connection.id,
        status: connection.connection_status,
        variant: connection.dynamics_variant,
        host: connection.dynamics_host,
        tenantId: connection.dynamics_tenant_id,
        companyId: connection.dynamics_company_id,
        environment: connection.dynamics_environment,
        companyName: connection.company_name,
        lastSyncAt: connection.last_sync_at,
        lastSyncStatus: connection.last_sync_status,
        lastSyncError: connection.last_sync_error,
        nextSyncAt: connection.next_sync_at,
      },
      stats: {
        totalVendors: parseInt(stats.total_vendors),
        totalInvoices: parseInt(stats.total_invoices),
        pendingInvoices: parseInt(stats.pending_invoices),
        pendingAmount: parseFloat(stats.pending_amount || 0),
        interceptedInvoices: parseInt(stats.intercepted_invoices),
        totalPayments: parseInt(stats.total_payments),
      },
      recentLogs: logs,
    });
  } catch (error) {
    console.error('Dynamics sync status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
