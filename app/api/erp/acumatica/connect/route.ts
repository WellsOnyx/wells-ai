/**
 * Acumatica Connection/OAuth Initiation
 *
 * Initiates OAuth 2.0 connection to Acumatica Cloud ERP.
 * Supports both authorization code flow and resource owner password flow.
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createAcumaticaAdapter, AcumaticaConfig } from '@/lib/treasury-sdk/adapters/acumatica';
import crypto from 'crypto';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

const ACUMATICA_REDIRECT_URI = process.env.ACUMATICA_REDIRECT_URI || 'https://wellsai.app/api/erp/acumatica/callback';

// GET - Initiate OAuth flow (authorization code)
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const instanceUrl = searchParams.get('instanceUrl');
    const clientId = searchParams.get('clientId');
    const state = searchParams.get('state');
    const companyId = searchParams.get('companyId');

    if (!instanceUrl || !clientId || !state) {
      return NextResponse.json(
        { error: 'Missing required parameters: instanceUrl, clientId, state' },
        { status: 400 }
      );
    }

    // Build OAuth authorization URL
    const authUrl = new URL(`${instanceUrl}/identity/connect/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', ACUMATICA_REDIRECT_URI);
    authUrl.searchParams.set('scope', 'api offline_access');
    authUrl.searchParams.set('state', state);

    // Optional: include company in state for multi-tenant
    if (companyId) {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      stateData.companyId = companyId;
      authUrl.searchParams.set('state', Buffer.from(JSON.stringify(stateData)).toString('base64'));
    }

    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('Acumatica OAuth initiation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}

// POST - Direct connection (resource owner password flow)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,  // Wells company ID
      instanceUrl,
      clientId,
      clientSecret,
      username,
      password,
      companyName,  // Acumatica company (for multi-tenant)
      branch,
      locale,
    } = body;

    // Validate required fields
    if (!companyId || !instanceUrl || !clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['companyId', 'instanceUrl', 'clientId', 'clientSecret']
        },
        { status: 400 }
      );
    }

    // Create adapter config
    const config: AcumaticaConfig = {
      instanceUrl,
      clientId,
      clientSecret,
      username,
      password,
      companyName,
      branch,
      locale,
      endpoint: instanceUrl,
      credentials: { type: 'oauth2' },
    };

    // Test connection
    const adapter = createAcumaticaAdapter(config);
    await adapter.connect();
    const isConnected = await adapter.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { error: 'Failed to connect to Acumatica. Please verify credentials.' },
        { status: 401 }
      );
    }

    // Get branches for multi-company setups
    let branches: Array<{ id: string; branchId: string; name: string; currency: string }> = [];
    try {
      branches = await adapter.getBranches();
    } catch (e) {
      // Multi-branch may not be enabled, ignore
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
          tenant_id,
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
          'acumatica',
          'active',
          ${JSON.stringify({ clientId, clientSecret, username, password })},
          ${instanceUrl},
          ${companyName || null},
          ${companyName || 'Acumatica'},
          'USD',
          24,
          true,
          true,
          100,
          1000000,
          false,
          ${JSON.stringify({ branch, locale, branches })}
        )
        ON CONFLICT (company_id, provider)
        DO UPDATE SET
          connection_status = 'active',
          access_token = EXCLUDED.access_token,
          realm_id = EXCLUDED.realm_id,
          tenant_id = EXCLUDED.tenant_id,
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
        branches,
        message: 'Successfully connected to Acumatica'
      });
    }

    // Return success without database storage (for testing)
    return NextResponse.json({
      success: true,
      connection: {
        provider: 'acumatica',
        status: 'active',
      },
      branches,
      message: 'Successfully connected to Acumatica (database not configured)'
    });

  } catch (error) {
    console.error('Acumatica connect error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to connect to Acumatica',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
