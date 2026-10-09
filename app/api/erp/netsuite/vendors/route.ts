// NetSuite Vendors API
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { netsuite } from '@/lib/erp/netsuite';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// GET: List vendors from NetSuite
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
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
        const vendors = await netsuite.fetchVendors(connectionId);
        for (const vendor of vendors) {
          await netsuite.syncVendorToDatabase(connectionId, vendor);
        }
      } catch (error: any) {
        console.error('Failed to refresh vendors from NetSuite:', error);
        // Continue to return cached data
      }
    }

    // Return vendors from database
    const vendors = await sql`
      SELECT
        id,
        external_vendor_id,
        vendor_name,
        vendor_display_name,
        email,
        phone,
        address_line1,
        city,
        state,
        postal_code,
        country,
        tax_id,
        default_currency,
        payment_terms,
        enrolled_in_wells,
        enrollment_date,
        wells_supplier_id,
        total_bills_count,
        total_amount_paid,
        last_payment_date,
        is_active,
        created_at,
        updated_at
      FROM erp_vendors
      WHERE erp_connection_id = ${connectionId}
      AND is_active = true
      ORDER BY vendor_name ASC
    `;

    return NextResponse.json({
      vendors,
      count: vendors.length,
      connectionId,
    });
  } catch (error: any) {
    console.error('Get NetSuite vendors error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get vendors' },
      { status: 500 }
    );
  }
}

// POST: Sync a specific vendor or trigger full vendor sync
export async function POST(req: NextRequest) {
  try {
    const { connectionId, vendorId } = await req.json();

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

    if (vendorId) {
      // Sync specific vendor
      const vendor = await netsuite.fetchVendor(connectionId, vendorId);
      if (vendor) {
        await netsuite.syncVendorToDatabase(connectionId, vendor);
        return NextResponse.json({
          success: true,
          message: `Vendor ${vendorId} synced successfully`,
        });
      } else {
        return NextResponse.json({ error: 'Vendor not found in NetSuite' }, { status: 404 });
      }
    } else {
      // Full vendor sync
      const vendors = await netsuite.fetchVendors(connectionId);
      let synced = 0;
      let failed = 0;

      for (const vendor of vendors) {
        try {
          await netsuite.syncVendorToDatabase(connectionId, vendor);
          synced++;
        } catch (e) {
          failed++;
          console.error(`Failed to sync vendor ${vendor.id}:`, e);
        }
      }

      return NextResponse.json({
        success: true,
        synced,
        failed,
        total: vendors.length,
      });
    }
  } catch (error: any) {
    console.error('Sync NetSuite vendors error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync vendors' },
      { status: 500 }
    );
  }
}
