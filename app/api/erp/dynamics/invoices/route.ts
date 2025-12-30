// Dynamics 365 Invoices API
// List and sync invoices/bills from Dynamics 365 F&O / Business Central
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { dynamics365 } from '@/lib/erp/dynamics365';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

// GET - List invoices from database or fetch from Dynamics
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
      SELECT id, connection_status, dynamics_variant
      FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'dynamics365'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'Dynamics 365 connection not found' }, { status: 404 });
    }

    if (connection.connection_status !== 'active') {
      return NextResponse.json({ error: 'Dynamics 365 connection is not active' }, { status: 400 });
    }

    // If refresh requested, fetch from Dynamics and sync
    if (refresh) {
      const invoices = await dynamics365.fetchInvoices(connectionId, { limit: 500 });
      for (const invoice of invoices) {
        await dynamics365.syncInvoiceToDatabase(connectionId, invoice, connection.dynamics_variant);
      }
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
    console.error('Dynamics invoices error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// POST - Sync invoices from Dynamics
export async function POST(req: NextRequest) {
  try {
    const { connectionId, status, dueDateFrom, dueDateTo } = await req.json();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Get connection variant
    const [connection] = await sql`
      SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}
    `;

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Fetch and sync invoices
    const invoices = await dynamics365.fetchInvoices(connectionId, {
      status: status || 'Open', // Default to open
      dueDateFrom: dueDateFrom ? new Date(dueDateFrom) : undefined,
      dueDateTo: dueDateTo ? new Date(dueDateTo) : undefined,
      limit: 500,
    });

    let synced = 0;
    const errors: string[] = [];

    for (const invoice of invoices) {
      try {
        await dynamics365.syncInvoiceToDatabase(connectionId, invoice, connection.dynamics_variant);
        synced++;
      } catch (error) {
        const invoiceId = connection.dynamics_variant === 'finance_operations'
          ? (invoice as any).InvoiceId
          : (invoice as any).id;
        errors.push(`Invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      found: invoices.length,
      synced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Dynamics invoice sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync invoices' },
      { status: 500 }
    );
  }
}
