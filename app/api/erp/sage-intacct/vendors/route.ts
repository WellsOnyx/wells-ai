/**
 * Sage Intacct Vendors API
 *
 * CRUD operations for vendors in Sage Intacct
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createSageIntacctAdapter, SageIntacctConfig } from '@/lib/treasury-sdk/adapters/sage-intacct';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

async function getAdapterForConnection(connectionId: string) {
  if (!sql) {
    throw new Error('Database not configured');
  }

  const [connection] = await sql`
    SELECT * FROM erp_connections
    WHERE id = ${connectionId}
      AND provider = 'sage-intacct'
      AND connection_status = 'active'
  `;

  if (!connection) {
    throw new Error('Sage Intacct connection not found or inactive');
  }

  const credentials = JSON.parse(connection.access_token || '{}');
  const metadata = connection.metadata || {};

  const config: SageIntacctConfig = {
    endpoint: 'https://api.intacct.com/ia/xml/xmlgw.phtml',
    credentials: { type: 'basic' },
    senderId: credentials.senderId,
    senderPassword: credentials.senderPassword,
    companyId: connection.realm_id,
    userId: credentials.userId,
    userPassword: credentials.userPassword,
    entityId: metadata.entityId,
    locationId: metadata.locationId,
    departmentId: metadata.departmentId,
  };

  const adapter = createSageIntacctAdapter(config);
  await adapter.connect();
  return { adapter, connection };
}

// GET - List vendors
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const modifiedSince = searchParams.get('modifiedSince');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID required' },
        { status: 400 }
      );
    }

    const { adapter, connection } = await getAdapterForConnection(connectionId);

    try {
      const vendors = await adapter.getVendors({
        modifiedSince: modifiedSince ? new Date(modifiedSince) : undefined,
        limit,
      });

      // Optionally sync to local database
      if (sql) {
        for (const vendor of vendors) {
          await sql`
            INSERT INTO erp_vendors (
              erp_connection_id,
              external_vendor_id,
              vendor_name,
              email,
              phone,
              tax_id,
              default_currency,
              payment_terms,
              is_active,
              raw_data
            ) VALUES (
              ${connectionId},
              ${vendor.externalId},
              ${vendor.name},
              ${vendor.email || null},
              ${vendor.phone || null},
              ${vendor.taxId || null},
              ${vendor.currency || 'USD'},
              ${vendor.paymentTerms || null},
              true,
              ${JSON.stringify(vendor)}::jsonb
            )
            ON CONFLICT (erp_connection_id, external_vendor_id)
            DO UPDATE SET
              vendor_name = EXCLUDED.vendor_name,
              email = EXCLUDED.email,
              phone = EXCLUDED.phone,
              tax_id = EXCLUDED.tax_id,
              payment_terms = EXCLUDED.payment_terms,
              raw_data = EXCLUDED.raw_data,
              updated_at = NOW()
          `.catch(e => console.warn('Failed to sync vendor to DB:', e.message));
        }
      }

      return NextResponse.json({
        success: true,
        vendors,
        count: vendors.length,
        connectionId,
      });
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Sage Intacct vendors error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

// POST - Create vendor
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { connectionId, vendor } = body;

    if (!connectionId || !vendor) {
      return NextResponse.json(
        { error: 'Connection ID and vendor data required' },
        { status: 400 }
      );
    }

    if (!vendor.name) {
      return NextResponse.json(
        { error: 'Vendor name is required' },
        { status: 400 }
      );
    }

    const { adapter } = await getAdapterForConnection(connectionId);

    try {
      const result = await adapter.createVendor({
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        taxId: vendor.taxId,
        currency: vendor.currency || 'USD',
        paymentTerms: vendor.paymentTerms,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to create vendor' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        vendor: result.data,
        externalId: result.externalId,
      });
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Sage Intacct create vendor error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create vendor' },
      { status: 500 }
    );
  }
}

// PUT - Update vendor
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { connectionId, vendorId, updates } = body;

    if (!connectionId || !vendorId || !updates) {
      return NextResponse.json(
        { error: 'Connection ID, vendor ID, and updates required' },
        { status: 400 }
      );
    }

    const { adapter } = await getAdapterForConnection(connectionId);

    try {
      const result = await adapter.updateVendor(vendorId, updates);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to update vendor' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        vendor: result.data,
      });
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Sage Intacct update vendor error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update vendor' },
      { status: 500 }
    );
  }
}
