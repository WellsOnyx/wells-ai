// Dynamics 365 Vendors API
// List and sync vendors from Dynamics 365 F&O / Business Central
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { dynamics365 } from '@/lib/erp/dynamics365';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

// GET - List vendors from database or fetch from Dynamics
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const refresh = searchParams.get('refresh') === 'true';
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
      const vendors = await dynamics365.fetchVendors(connectionId, 500);
      for (const vendor of vendors) {
        await dynamics365.syncVendorToDatabase(connectionId, vendor, connection.dynamics_variant);
      }
    }

    // Get vendors from database
    const vendors = await sql`
      SELECT
        id,
        external_vendor_id,
        vendor_name,
        vendor_display_name,
        email,
        phone,
        tax_id,
        is_active,
        default_currency,
        payment_terms,
        bank_account_number,
        routing_number,
        enrolled_in_wells,
        wells_supplier_id,
        total_bills_count,
        total_amount_paid,
        last_payment_date,
        created_at,
        updated_at
      FROM erp_vendors
      WHERE erp_connection_id = ${connectionId}
      ORDER BY vendor_name ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*) as count FROM erp_vendors
      WHERE erp_connection_id = ${connectionId}
    `;

    return NextResponse.json({
      vendors,
      pagination: {
        total: parseInt(count),
        limit,
        offset,
        hasMore: offset + limit < parseInt(count),
      },
    });
  } catch (error) {
    console.error('Dynamics vendors error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

// POST - Sync vendors from Dynamics
export async function POST(req: NextRequest) {
  try {
    const { connectionId } = await req.json();

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

    // Fetch and sync vendors
    const vendors = await dynamics365.fetchVendors(connectionId, 500);
    let synced = 0;
    const errors: string[] = [];

    for (const vendor of vendors) {
      try {
        await dynamics365.syncVendorToDatabase(connectionId, vendor, connection.dynamics_variant);
        synced++;
      } catch (error) {
        const vendorId = connection.dynamics_variant === 'finance_operations'
          ? (vendor as any).VendorAccountNumber
          : (vendor as any).id;
        errors.push(`Vendor ${vendorId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      found: vendors.length,
      synced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Dynamics vendor sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync vendors' },
      { status: 500 }
    );
  }
}
