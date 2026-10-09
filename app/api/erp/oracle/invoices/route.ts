// Oracle Invoices API
// List and sync invoices/bills from Oracle Fusion Cloud / E-Business Suite
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { oracle } from '@/lib/erp/oracle';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// GET - List invoices from database or fetch from Oracle
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const refresh = searchParams.get('refresh') === 'true';
    const status = searchParams.get('status'); // 'pending', 'paid_external', 'intercepted'
    const vendorId = searchParams.get('vendorId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Verify connection exists and is active
    const [connection] = await sql`
      SELECT id, connection_status FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'oracle'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'Oracle connection not found' }, { status: 404 });
    }

    if (connection.connection_status !== 'active') {
      return NextResponse.json({ error: 'Oracle connection is not active' }, { status: 400 });
    }

    // If refresh requested, fetch from Oracle and sync
    if (refresh) {
      const invoices = await oracle.fetchInvoices(connectionId, { limit: 500 });
      for (const invoice of invoices) {
        await oracle.syncInvoiceToDatabase(connectionId, invoice);
      }
    }

    // Build query conditions
    let whereClause = `erp_connection_id = '${connectionId}'`;

    if (status) {
      whereClause += ` AND status = '${status}'`;
    }

    if (vendorId) {
      whereClause += ` AND external_vendor_id = '${vendorId}'`;
    }

    // Get invoices from database
    const invoices = await sql`
      SELECT
        id,
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
        intercept_proposed,
        intercept_accepted,
        intercept_executed,
        memo,
        created_at,
        updated_at
      FROM erp_bills
      WHERE erp_connection_id = ${connectionId}
      ${status ? sql`AND status = ${status}` : sql``}
      ${vendorId ? sql`AND external_vendor_id = ${vendorId}` : sql``}
      ORDER BY due_date ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*) as count FROM erp_bills
      WHERE erp_connection_id = ${connectionId}
      ${status ? sql`AND status = ${status}` : sql``}
      ${vendorId ? sql`AND external_vendor_id = ${vendorId}` : sql``}
    `;

    // Calculate summary stats
    const [stats] = await sql`
      SELECT
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'intercepted' THEN 1 ELSE 0 END) as intercepted_count,
        SUM(wells_fee_amount) as total_potential_revenue
      FROM erp_bills
      WHERE erp_connection_id = ${connectionId}
    `;

    return NextResponse.json({
      invoices,
      stats: {
        totalInvoices: parseInt(stats.total_invoices),
        pendingCount: parseInt(stats.pending_count),
        pendingAmount: parseFloat(stats.pending_amount || 0),
        interceptedCount: parseInt(stats.intercepted_count),
        potentialRevenue: parseFloat(stats.total_potential_revenue || 0),
      },
      pagination: {
        total: parseInt(count),
        limit,
        offset,
        hasMore: offset + limit < parseInt(count),
      },
    });
  } catch (error) {
    console.error('Oracle invoices error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// POST - Sync invoices from Oracle
export async function POST(req: NextRequest) {
  try {
    const { connectionId, status, dueDateFrom, dueDateTo } = await req.json();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Fetch and sync invoices
    const invoices = await oracle.fetchInvoices(connectionId, {
      status: status || 'N', // Default to unpaid
      dueDateFrom: dueDateFrom ? new Date(dueDateFrom) : undefined,
      dueDateTo: dueDateTo ? new Date(dueDateTo) : undefined,
      limit: 500,
    });

    let synced = 0;
    const errors: string[] = [];

    for (const invoice of invoices) {
      try {
        await oracle.syncInvoiceToDatabase(connectionId, invoice);
        synced++;
      } catch (error) {
        errors.push(`Invoice ${invoice.InvoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      found: invoices.length,
      synced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Oracle invoice sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync invoices' },
      { status: 500 }
    );
  }
}
