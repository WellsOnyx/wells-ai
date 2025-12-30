// Dynamics 365 OAuth Initiation
// Supports both Dynamics 365 Finance & Operations and Business Central
import { NextRequest, NextResponse } from 'next/server';
import { dynamics365 } from '@/lib/erp/dynamics365';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const state = searchParams.get('state');
    const tenantId = searchParams.get('tenantId');
    const variant = (searchParams.get('variant') || 'business_central') as 'finance_operations' | 'business_central';

    if (!state) {
      return NextResponse.json({ error: 'State parameter required' }, { status: 400 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Azure AD tenant ID required' }, { status: 400 });
    }

    // Encode additional info into state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    stateData.tenantId = tenantId;
    stateData.variant = variant;
    const enhancedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Generate authorization URL
    const authUrl = dynamics365.getAuthorizationUrl(enhancedState, tenantId, variant);

    // Redirect to Azure AD OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Dynamics connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}

// POST - For programmatic connection setup (service principal / client credentials)
export async function POST(req: NextRequest) {
  try {
    const {
      companyId,
      tenantId,
      variant,
      dynamicsHost,
      environment,
      dynamicsCompanyId,
    } = await req.json();

    if (!companyId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, tenantId' },
        { status: 400 }
      );
    }

    // For service principal auth (server-to-server)
    const clientId = process.env.DYNAMICS_CLIENT_ID;
    const clientSecret = process.env.DYNAMICS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Dynamics 365 credentials not configured' },
        { status: 500 }
      );
    }

    // Get access token using client credentials
    const scope = variant === 'finance_operations'
      ? 'https://finance.dynamics.com/.default'
      : 'https://api.businesscentral.dynamics.com/.default';

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
          scope,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      return NextResponse.json(
        { error: `Authentication failed: ${error}` },
        { status: 400 }
      );
    }

    const tokens = await tokenResponse.json();

    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL || '');

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Create connection record
    const [connection] = await sql`
      INSERT INTO erp_connections (
        company_id,
        provider,
        connection_status,
        access_token,
        token_expires_at,
        dynamics_host,
        dynamics_variant,
        dynamics_tenant_id,
        dynamics_company_id,
        dynamics_environment,
        auto_intercept_enabled,
        auto_vendor_enrollment,
        min_invoice_amount,
        max_invoice_amount,
        sync_frequency_hours
      ) VALUES (
        ${companyId},
        'dynamics365',
        'active',
        ${tokens.access_token},
        ${expiresAt.toISOString()},
        ${dynamicsHost || null},
        ${variant || 'business_central'},
        ${tenantId},
        ${dynamicsCompanyId || null},
        ${environment || 'production'},
        true,
        true,
        100,
        1000000,
        4
      )
      ON CONFLICT (company_id, provider)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        token_expires_at = EXCLUDED.token_expires_at,
        dynamics_host = EXCLUDED.dynamics_host,
        dynamics_variant = EXCLUDED.dynamics_variant,
        dynamics_tenant_id = EXCLUDED.dynamics_tenant_id,
        dynamics_company_id = EXCLUDED.dynamics_company_id,
        dynamics_environment = EXCLUDED.dynamics_environment,
        connection_status = 'active',
        updated_at = NOW()
      RETURNING id
    `;

    // Test connection
    const isConnected = await dynamics365.testConnection(connection.id);

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
    console.error('Dynamics connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect' },
      { status: 500 }
    );
  }
}
