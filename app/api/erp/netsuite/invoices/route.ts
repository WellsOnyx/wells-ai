// NetSuite Invoices/Bills API
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { netsuite } from '@/lib/erp/netsuite';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// GET: List invoices/bills from NetSuite
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const status = searchParams.get('status'); // pending, intercepted, paid_external
    const vendorId = searchParams.get('vendorId');
    const refresh = searchParams.get('refresh') === 'true';

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Verify connection exists and is active
    const [connection] = await sql`
      SELECT id, connection_status FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'netsuite'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'NetSuite connection not found' }, { status: 404 });
    }

    if (connection.connection_status !== 'active') {
      return NextResponse.json({ error: 'NetSuite connection is not active' }, { status: 400 });
    }

    // If refresh requested, fetch from NetSuite and sync
    if (refresh) {
      try {
        const bills = await netsuite.fetchBills(connectionId);
        for (const bill of bills) {
          await netsuite.syncBillToDatabase(connectionId, bill);
        }
      } catch (error: any) {
        console.error('Failed to refresh bills from NetSuite:', error);
        // Continue to return cached data
      }
    }

    // Build query based on filters
    let bills;
    if (status && vendorId) {
      bills = await sql`
        SELECT
          b.*,
          v.vendor_name,
          v.email as vendor_email,
          v.enrolled_in_wells
        FROM erp_bills b
        LEFT JOIN erp_vendors v ON b.external_vendor_id = v.external_vendor_id
          AND b.erp_connection_id = v.erp_connection_id
        WHERE b.erp_connection_id = ${connectionId}
        AND b.status = ${status}
        AND b.external_vendor_id = ${vendorId}
        ORDER BY b.due_date ASC
      `;
    } else if (status) {
      bills = await sql`
        SELECT
          b.*,
          v.vendor_name,
          v.email as vendor_email,
          v.enrolled_in_wells
        FROM erp_bills b
        LEFT JOIN erp_vendors v ON b.external_vendor_id = v.external_vendor_id
          AND b.erp_connection_id = v.erp_connection_id
        WHERE b.erp_connection_id = ${connectionId}
        AND b.status = ${status}
        ORDER BY b.due_date ASC
      `;
    } else if (vendorId) {
      bills = await sql`
        SELECT
          b.*,
          v.vendor_name,
          v.email as vendor_email,
          v.enrolled_in_wells
        FROM erp_bills b
        LEFT JOIN erp_vendors v ON b.external_vendor_id = v.external_vendor_id
          AND b.erp_connection_id = v.erp_connection_id
        WHERE b.erp_connection_id = ${connectionId}
        AND b.external_vendor_id = ${vendorId}
        ORDER BY b.due_date ASC
      `;
    } else {
      bills = await sql`
        SELECT
          b.*,
          v.vendor_name,
          v.email as vendor_email,
          v.enrolled_in_wells
        FROM erp_bills b
        LEFT JOIN erp_vendors v ON b.external_vendor_id = v.external_vendor_id
          AND b.erp_connection_id = v.erp_connection_id
        WHERE b.erp_connection_id = ${connectionId}
        AND b.status = 'pending'
        ORDER BY b.due_date ASC
      `;
    }

    // Calculate summary stats
    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'intercepted') as intercepted_count,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
        COALESCE(SUM(wells_fee_amount) FILTER (WHERE status = 'pending'), 0) as potential_fee
      FROM erp_bills
      WHERE erp_connection_id = ${connectionId}
    `;

    return NextResponse.json({
      bills,
      count: bills.length,
      stats: {
        pendingCount: parseInt(stats.pending_count),
        interceptedCount: parseInt(stats.intercepted_count),
        pendingAmount: parseFloat(stats.pending_amount),
        potentialFee: parseFloat(stats.potential_fee),
      },
      connectionId,
    });
  } catch (error: any) {
    console.error('Get NetSuite invoices error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get invoices' },
      { status: 500 }
    );
  }
}

// POST: Sync invoices from NetSuite
export async function POST(req: NextRequest) {
  try {
    const { connectionId, billId, startDate } = await req.json();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Verify connection
    const [connection] = await sql`
      SELECT id, connection_status FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'netsuite'
    `;

    if (!connection || connection.connection_status !== 'active') {
      return NextResponse.json({ error: 'Active NetSuite connection not found' }, { status: 404 });
    }

    if (billId) {
      // Sync specific bill
      const bill = await netsuite.fetchBill(connectionId, billId);
      if (bill) {
        await netsuite.syncBillToDatabase(connectionId, bill);
        return NextResponse.json({
          success: true,
          message: `Bill ${billId} synced successfully`,
        });
      } else {
        return NextResponse.json({ error: 'Bill not found in NetSuite' }, { status: 404 });
      }
    } else {
      // Full bill sync
      const filterDate = startDate ? new Date(startDate) : undefined;
      const bills = await netsuite.fetchBills(connectionId, filterDate);
      let synced = 0;
      let failed = 0;

      for (const bill of bills) {
        try {
          await netsuite.syncBillToDatabase(connectionId, bill);
          synced++;
        } catch (e) {
          failed++;
          console.error(`Failed to sync bill ${bill.id}:`, e);
        }
      }

      return NextResponse.json({
        success: true,
        synced,
        failed,
        total: bills.length,
      });
    }
  } catch (error: any) {
    console.error('Sync NetSuite invoices error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync invoices' },
      { status: 500 }
    );
  }
}
