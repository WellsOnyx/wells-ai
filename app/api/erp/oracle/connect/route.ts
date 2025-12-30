// Oracle OAuth Initiation
// Supports both Oracle Fusion Cloud and Oracle E-Business Suite
import { NextRequest, NextResponse } from 'next/server';
import { oracle } from '@/lib/erp/oracle';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const state = searchParams.get('state');
    const oracleHost = searchParams.get('oracleHost');
    const variant = searchParams.get('variant') || 'fusion'; // 'fusion' or 'ebs'

    if (!state) {
      return NextResponse.json({ error: 'State parameter required' }, { status: 400 });
    }

    if (!oracleHost) {
      return NextResponse.json({ error: 'Oracle host required' }, { status: 400 });
    }

    // For E-Business Suite, we use basic auth instead of OAuth
    if (variant === 'ebs') {
      // Redirect to a form to collect credentials
      return NextResponse.redirect(
        new URL(`/erp/connect/oracle-ebs?state=${state}`, req.url)
      );
    }

    // Encode variant into state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    stateData.oracleHost = oracleHost;
    stateData.variant = variant;
    const enhancedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Generate authorization URL for Oracle Fusion Cloud
    const authUrl = oracle.getAuthorizationUrl(enhancedState, oracleHost);

    // Redirect to Oracle OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Oracle connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Handle E-Business Suite basic auth connection
    const { companyId, oracleHost, username, password, variant } = await req.json();

    if (!companyId || !oracleHost || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, oracleHost, username, password' },
        { status: 400 }
      );
    }

    // For EBS, we store basic auth credentials
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL || '');

    // Create connection record with basic auth
    const accessToken = Buffer.from(`${username}:${password}`).toString('base64');

    const [connection] = await sql`
      INSERT INTO erp_connections (
        company_id,
        provider,
        connection_status,
        access_token,
        oracle_host,
        oracle_variant,
        auto_intercept_enabled,
        auto_vendor_enrollment,
        min_invoice_amount,
        max_invoice_amount,
        sync_frequency_hours
      ) VALUES (
        ${companyId},
        'oracle',
        'active',
        ${accessToken},
        ${oracleHost},
        ${variant || 'ebs'},
        true,
        true,
        100,
        1000000,
        4
      )
      ON CONFLICT (company_id, provider)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        oracle_host = EXCLUDED.oracle_host,
        oracle_variant = EXCLUDED.oracle_variant,
        connection_status = 'active',
        updated_at = NOW()
      RETURNING id
    `;

    // Test connection
    const isConnected = await oracle.testConnection(connection.id);

    if (!isConnected) {
      await sql`
        UPDATE erp_connections
        SET connection_status = 'error'
        WHERE id = ${connection.id}
      `;
      return NextResponse.json({ error: 'Connection test failed' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
    });
  } catch (error) {
    console.error('Oracle EBS connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect' },
      { status: 500 }
    );
  }
}
