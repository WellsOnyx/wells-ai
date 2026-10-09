// SAP OAuth Initiation
import { NextRequest, NextResponse } from 'next/server';
import { sap } from '@/lib/erp/sap';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const state = searchParams.get('state');
    const sapHost = searchParams.get('sapHost');

    if (!state) {
      return NextResponse.json({ error: 'State parameter required' }, { status: 400 });
    }

    if (!sapHost) {
      return NextResponse.json({ error: 'SAP Host URL required' }, { status: 400 });
    }

    // Encode SAP host into state for callback
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    stateData.sapHost = sapHost;
    const enrichedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Generate authorization URL (for S/4HANA Cloud)
    const authUrl = sap.getAuthorizationUrl(enrichedState, sapHost);

    // Redirect to SAP OAuth
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('SAP connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Accept connection details via POST for direct setup (S/4HANA or Business One)
  try {
    const body = await req.json();
    const {
      companyId,
      sapHost,
      sapSystem, // 's4hana' or 'business_one'
      sapClient, // For S/4HANA
      companyDB, // For Business One
      username,
      password,
      clientId,
      clientSecret,
    } = body;

    if (!companyId || !sapHost) {
      return NextResponse.json(
        { error: 'companyId and sapHost are required' },
        { status: 400 }
      );
    }

    const { neon } = await import('@neondatabase/serverless');
    const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

    if (!sql) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    if (sapSystem === 'business_one' && username && password && companyDB) {
      // SAP Business One: Session-based authentication
      try {
        const session = await sap.loginBusinessOne(sapHost, companyDB, username, password);

        const sessionExpiry = new Date();
        sessionExpiry.setMinutes(sessionExpiry.getMinutes() + session.sessionTimeout);

        // Create connection with session
        const [connection] = await sql`
          INSERT INTO erp_connections (
            company_id,
            provider,
            connection_status,
            realm_id,
            access_token,
            token_expires_at,
            tenant_id,
            company_key,
            company_currency,
            sync_frequency_hours
          ) VALUES (
            ${companyId},
            'sap',
            'active',
            ${sapHost},
            ${session.sessionId},
            ${sessionExpiry.toISOString()},
            ${sapClient || null},
            'business_one',
            'USD',
            4
          )
          ON CONFLICT (company_id, provider)
          DO UPDATE SET
            realm_id = EXCLUDED.realm_id,
            access_token = EXCLUDED.access_token,
            token_expires_at = EXCLUDED.token_expires_at,
            tenant_id = EXCLUDED.tenant_id,
            company_key = EXCLUDED.company_key,
            connection_status = 'active',
            updated_at = NOW()
          RETURNING id
        `;

        // Test the connection
        const isConnected = await sap.testConnection(connection.id);

        if (!isConnected) {
          await sql`
            UPDATE erp_connections
            SET connection_status = 'error'
            WHERE id = ${connection.id}
          `;
          return NextResponse.json(
            { error: 'Failed to connect to SAP Business One' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          connectionId: connection.id,
          message: 'SAP Business One connection established successfully',
        });
      } catch (loginError: any) {
        return NextResponse.json(
          { error: `SAP login failed: ${loginError.message}` },
          { status: 400 }
        );
      }
    } else if (sapSystem === 's4hana' && username && password) {
      // S/4HANA with Basic Auth
      const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

      const [connection] = await sql`
        INSERT INTO erp_connections (
          company_id,
          provider,
          connection_status,
          realm_id,
          access_token,
          tenant_id,
          company_key,
          company_currency,
          sync_frequency_hours
        ) VALUES (
          ${companyId},
          'sap',
          'active',
          ${sapHost},
          ${basicAuth},
          ${sapClient || null},
          's4hana',
          'USD',
          4
        )
        ON CONFLICT (company_id, provider)
        DO UPDATE SET
          realm_id = EXCLUDED.realm_id,
          access_token = EXCLUDED.access_token,
          tenant_id = EXCLUDED.tenant_id,
          company_key = EXCLUDED.company_key,
          connection_status = 'active',
          updated_at = NOW()
        RETURNING id
      `;

      // Test the connection
      const isConnected = await sap.testConnection(connection.id);

      if (!isConnected) {
        await sql`
          UPDATE erp_connections
          SET connection_status = 'error'
          WHERE id = ${connection.id}
        `;
        return NextResponse.json(
          { error: 'Failed to connect to SAP S/4HANA' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        connectionId: connection.id,
        message: 'SAP S/4HANA connection established successfully',
      });
    }

    // OAuth 2.0 flow for S/4HANA Cloud
    const state = Buffer.from(JSON.stringify({ companyId, sapHost, sapSystem })).toString('base64');
    const authUrl = sap.getAuthorizationUrl(state, sapHost);

    return NextResponse.json({
      authUrl,
      message: 'Redirect user to authUrl to complete OAuth flow',
    });
  } catch (error: any) {
    console.error('SAP connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
