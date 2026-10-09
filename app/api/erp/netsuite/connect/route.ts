// NetSuite OAuth Initiation
import { NextRequest, NextResponse } from 'next/server';
import { netsuite } from '@/lib/erp/netsuite';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const state = searchParams.get('state');
    const accountId = searchParams.get('accountId');

    if (!state) {
      return NextResponse.json({ error: 'State parameter required' }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({ error: 'NetSuite Account ID required' }, { status: 400 });
    }

    // Encode account ID into state for callback
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    stateData.accountId = accountId;
    const enrichedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Generate authorization URL
    const authUrl = netsuite.getAuthorizationUrl(enrichedState, accountId);

    // Redirect to NetSuite OAuth
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('NetSuite connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Alternative: Accept connection details via POST for TBA setup
  try {
    const body = await req.json();
    const {
      companyId,
      accountId,
      consumerKey,
      consumerSecret,
      tokenId,
      tokenSecret,
    } = body;

    if (!companyId || !accountId) {
      return NextResponse.json(
        { error: 'companyId and accountId are required' },
        { status: 400 }
      );
    }

    // For Token-Based Authentication (TBA), store credentials directly
    if (consumerKey && consumerSecret && tokenId && tokenSecret) {
      const { neon } = await import('@neondatabase/serverless');
      const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

      if (!sql) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
      }

      // Create connection with TBA credentials
      const [connection] = await sql`
        INSERT INTO erp_connections (
          company_id,
          provider,
          connection_status,
          realm_id,
          access_token,
          refresh_token,
          token_id,
          token_secret,
          company_currency,
          sync_frequency_hours
        ) VALUES (
          ${companyId},
          'netsuite',
          'active',
          ${accountId},
          ${consumerKey},
          ${consumerSecret},
          ${tokenId},
          ${tokenSecret},
          'USD',
          4
        )
        ON CONFLICT (company_id, provider)
        DO UPDATE SET
          realm_id = EXCLUDED.realm_id,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_id = EXCLUDED.token_id,
          token_secret = EXCLUDED.token_secret,
          connection_status = 'active',
          updated_at = NOW()
        RETURNING id
      `;

      // Test the connection
      const isConnected = await netsuite.testConnection(connection.id);

      if (!isConnected) {
        await sql`
          UPDATE erp_connections
          SET connection_status = 'error'
          WHERE id = ${connection.id}
        `;
        return NextResponse.json(
          { error: 'Failed to connect to NetSuite with provided credentials' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        connectionId: connection.id,
        message: 'NetSuite connection established successfully',
      });
    }

    // Return authorization URL for OAuth 2.0 flow
    const state = Buffer.from(JSON.stringify({ companyId, accountId })).toString('base64');
    const authUrl = netsuite.getAuthorizationUrl(state, accountId);

    return NextResponse.json({
      authUrl,
      message: 'Redirect user to authUrl to complete OAuth flow',
    });
  } catch (error: any) {
    console.error('NetSuite connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
