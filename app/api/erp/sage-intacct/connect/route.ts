/**
 * Sage Intacct Connection Initiation
 *
 * Initiates connection to Sage Intacct using Web Services API credentials.
 * Sage Intacct uses session-based authentication, not OAuth redirect flow.
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createSageIntacctAdapter, SageIntacctConfig } from '@/lib/treasury-sdk/adapters/sage-intacct';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      senderId,
      senderPassword,
      intacctCompanyId,
      userId,
      userPassword,
      entityId,
      locationId,
      departmentId,
    } = body;

    // Validate required fields
    if (!companyId || !senderId || !senderPassword || !intacctCompanyId || !userId || !userPassword) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['companyId', 'senderId', 'senderPassword', 'intacctCompanyId', 'userId', 'userPassword']
        },
        { status: 400 }
      );
    }

    // Create adapter config
    const config: SageIntacctConfig = {
      endpoint: 'https://api.intacct.com/ia/xml/xmlgw.phtml',
      credentials: { type: 'basic' },
      senderId,
      senderPassword,
      companyId: intacctCompanyId,
      userId,
      userPassword,
      entityId,
      locationId,
      departmentId,
    };

    // Test connection
    const adapter = createSageIntacctAdapter(config);
    await adapter.connect();
    const isConnected = await adapter.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { error: 'Failed to connect to Sage Intacct. Please verify credentials.' },
        { status: 401 }
      );
    }

    // Get entities for multi-entity setups
    let entities: Array<{ id: string; name: string; currency: string }> = [];
    try {
      entities = await adapter.getEntities();
    } catch (e) {
      // Multi-entity may not be enabled, ignore
    }

    // Disconnect test session
    await adapter.disconnect();

    // Store connection in database
    if (sql) {
      const [connection] = await sql`
        INSERT INTO erp_connections (
          company_id,
          provider,
          connection_status,
          access_token,
          realm_id,
          company_name,
          company_currency,
          sync_frequency_hours,
          auto_intercept_enabled,
          auto_vendor_enrollment,
          min_invoice_amount,
          max_invoice_amount,
          webhook_enabled,
          metadata
        ) VALUES (
          ${companyId},
          'sage-intacct',
          'active',
          ${JSON.stringify({ senderId, senderPassword, userId, userPassword })},
          ${intacctCompanyId},
          ${intacctCompanyId},
          'USD',
          24,
          true,
          true,
          100,
          1000000,
          false,
          ${JSON.stringify({ entityId, locationId, departmentId, entities })}
        )
        ON CONFLICT (company_id, provider)
        DO UPDATE SET
          connection_status = 'active',
          access_token = EXCLUDED.access_token,
          realm_id = EXCLUDED.realm_id,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id, company_id, provider, connection_status
      `;

      return NextResponse.json({
        success: true,
        connection: {
          id: connection.id,
          companyId: connection.company_id,
          provider: connection.provider,
          status: connection.connection_status,
        },
        entities,
        message: 'Successfully connected to Sage Intacct'
      });
    }

    // Return success without database storage (for testing)
    return NextResponse.json({
      success: true,
      connection: {
        provider: 'sage-intacct',
        status: 'active',
      },
      entities,
      message: 'Successfully connected to Sage Intacct (database not configured)'
    });

  } catch (error) {
    console.error('Sage Intacct connect error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to connect to Sage Intacct',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// GET endpoint for connection status
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID required' },
        { status: 400 }
      );
    }

    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const [connection] = await sql`
      SELECT
        id,
        company_id,
        provider,
        connection_status,
        company_name,
        last_sync_at,
        last_sync_status,
        metadata
      FROM erp_connections
      WHERE company_id = ${companyId}
        AND provider = 'sage-intacct'
    `;

    if (!connection) {
      return NextResponse.json({
        connected: false,
        message: 'No Sage Intacct connection found'
      });
    }

    return NextResponse.json({
      connected: connection.connection_status === 'active',
      connection: {
        id: connection.id,
        companyId: connection.company_id,
        provider: connection.provider,
        status: connection.connection_status,
        companyName: connection.company_name,
        lastSyncAt: connection.last_sync_at,
        lastSyncStatus: connection.last_sync_status,
        metadata: connection.metadata
      }
    });

  } catch (error) {
    console.error('Sage Intacct status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get connection status' },
      { status: 500 }
    );
  }
}
