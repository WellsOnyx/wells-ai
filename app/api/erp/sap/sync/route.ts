// SAP Sync API
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { sap } from '@/lib/erp/sap';
import { interceptService } from '@/lib/erp/intercept-service';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// GET: Get sync status
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Get connection and sync status
    const [connection] = await sql`
      SELECT
        id,
        provider,
        connection_status,
        company_name,
        company_key as sap_system,
        last_sync_at,
        last_sync_status,
        last_sync_error,
        next_sync_at,
        sync_frequency_hours,
        auto_intercept_enabled,
        auto_vendor_enrollment
      FROM erp_connections
      WHERE id = ${connectionId}
      AND provider = 'sap'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'SAP connection not found' }, { status: 404 });
    }

    // Get recent sync logs
    const logs = await sql`
      SELECT *
      FROM erp_sync_logs
      WHERE erp_connection_id = ${connectionId}
      ORDER BY started_at DESC
      LIMIT 10
    `;

    // Get entity counts
    const [billStats] = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'intercepted') as intercepted
      FROM erp_bills
      WHERE erp_connection_id = ${connectionId}
    `;

    const [vendorStats] = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE enrolled_in_wells = true) as enrolled
      FROM erp_vendors
      WHERE erp_connection_id = ${connectionId}
    `;

    const [paymentStats] = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed_by_wells = true) as wells_processed,
        COALESCE(SUM(wells_fee_collected), 0) as total_fees
      FROM erp_payments
      WHERE erp_connection_id = ${connectionId}
    `;

    return NextResponse.json({
      connection,
      logs,
      stats: {
        bills: {
          total: parseInt(billStats.total),
          pending: parseInt(billStats.pending),
          intercepted: parseInt(billStats.intercepted),
        },
        vendors: {
          total: parseInt(vendorStats.total),
          enrolled: parseInt(vendorStats.enrolled),
        },
        payments: {
          total: parseInt(paymentStats.total),
          wellsProcessed: parseInt(paymentStats.wells_processed),
          totalFees: parseFloat(paymentStats.total_fees),
        },
      },
    });
  } catch (error: any) {
    console.error('Get SAP sync status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

// POST: Trigger a sync
export async function POST(req: NextRequest) {
  try {
    const { connectionId, syncType = 'full' } = await req.json();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Verify connection
    const [connection] = await sql`
      SELECT id, connection_status, sync_frequency_hours FROM erp_connections
      WHERE id = ${connectionId}
      AND provider = 'sap'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'SAP connection not found' }, { status: 404 });
    }

    if (connection.connection_status !== 'active') {
      return NextResponse.json({ error: 'SAP connection is not active' }, { status: 400 });
    }

    // Create sync log entry
    const [syncLog] = await sql`
      INSERT INTO erp_sync_logs (
        erp_connection_id,
        sync_type,
        status,
        started_at
      ) VALUES (
        ${connectionId},
        ${syncType},
        'started',
        NOW()
      )
      RETURNING id
    `;

    // Update connection status
    await sql`
      UPDATE erp_connections
      SET
        last_sync_status = 'in_progress',
        updated_at = NOW()
      WHERE id = ${connectionId}
    `;

    try {
      let result: {
        billsFound: number;
        vendorsFound: number;
        paymentsFound: number;
        interceptsCreated?: number;
      };

      if (syncType === 'full') {
        // Full sync: vendors, bills, payments
        result = await sap.fullSync(connectionId);

        // Also run intercept scan
        const interceptResult = await interceptService.scanForPayables(connectionId);
        result.interceptsCreated = interceptResult.interceptsCreated;
      } else if (syncType === 'bills') {
        // Bills only
        const bills = await sap.fetchBills(connectionId);
        for (const bill of bills) {
          await sap.syncBillToDatabase(connectionId, bill);
        }
        result = { billsFound: bills.length, vendorsFound: 0, paymentsFound: 0 };
      } else if (syncType === 'vendors') {
        // Vendors only
        const vendors = await sap.fetchVendors(connectionId);
        for (const vendor of vendors) {
          await sap.syncVendorToDatabase(connectionId, vendor);
        }
        result = { billsFound: 0, vendorsFound: vendors.length, paymentsFound: 0 };
      } else if (syncType === 'payments') {
        // Payments only
        const payments = await sap.fetchPayments(connectionId);
        for (const payment of payments) {
          await sap.syncPaymentToDatabase(connectionId, payment);
        }
        result = { billsFound: 0, vendorsFound: 0, paymentsFound: payments.length };
      } else {
        return NextResponse.json({ error: 'Invalid syncType' }, { status: 400 });
      }

      // Update sync log
      await sql`
        UPDATE erp_sync_logs
        SET
          status = 'completed',
          completed_at = NOW(),
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at)),
          bills_found = ${result.billsFound},
          vendors_found = ${result.vendorsFound},
          payments_found = ${result.paymentsFound},
          intercepts_created = ${result.interceptsCreated || 0}
        WHERE id = ${syncLog.id}
      `;

      // Update connection
      await sql`
        UPDATE erp_connections
        SET
          last_sync_at = NOW(),
          last_sync_status = 'completed',
          last_sync_error = NULL,
          next_sync_at = NOW() + INTERVAL '${connection.sync_frequency_hours || 4} hours',
          updated_at = NOW()
        WHERE id = ${connectionId}
      `;

      return NextResponse.json({
        success: true,
        syncType,
        ...result,
        message: 'Sync completed successfully',
      });
    } catch (syncError: any) {
      // Update sync log with error
      await sql`
        UPDATE erp_sync_logs
        SET
          status = 'failed',
          completed_at = NOW(),
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at)),
          error_message = ${syncError.message}
        WHERE id = ${syncLog.id}
      `;

      // Update connection with error
      await sql`
        UPDATE erp_connections
        SET
          last_sync_status = 'failed',
          last_sync_error = ${syncError.message},
          updated_at = NOW()
        WHERE id = ${connectionId}
      `;

      throw syncError;
    }
  } catch (error: any) {
    console.error('SAP sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

// DELETE: Disconnect SAP
export async function DELETE(req: NextRequest) {
  try {
    const { connectionId } = await req.json();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Verify connection exists
    const [connection] = await sql`
      SELECT id, realm_id as sap_host, access_token, company_key as sap_system
      FROM erp_connections
      WHERE id = ${connectionId}
      AND provider = 'sap'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'SAP connection not found' }, { status: 404 });
    }

    // For Business One, logout the session
    if (connection.sap_system === 'business_one' && connection.access_token) {
      try {
        await sap.logoutBusinessOne(connection.sap_host, connection.access_token);
      } catch (e) {
        // Ignore logout errors
      }
    }

    // Update connection status to disconnected
    await sql`
      UPDATE erp_connections
      SET
        connection_status = 'disconnected',
        access_token = NULL,
        refresh_token = NULL,
        token_expires_at = NULL,
        updated_at = NOW()
      WHERE id = ${connectionId}
    `;

    return NextResponse.json({
      success: true,
      message: 'SAP connection disconnected',
    });
  } catch (error: any) {
    console.error('Disconnect SAP error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
