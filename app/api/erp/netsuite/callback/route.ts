// NetSuite OAuth Callback
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { netsuite } from '@/lib/erp/netsuite';
import { interceptService } from '@/lib/erp/intercept-service';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('NetSuite OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/erp/connect?error=netsuite&message=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // Parse state to get company ID and account ID
    let stateData: { companyId: string; accountId: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    const { companyId, accountId } = stateData;

    if (!companyId || !accountId) {
      return NextResponse.json({ error: 'Missing companyId or accountId in state' }, { status: 400 });
    }

    // Exchange code for tokens
    const tokens = await netsuite.exchangeCodeForTokens(code, accountId);

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Try to get company info
    let companyName = `NetSuite ${accountId}`;
    try {
      // We'll get company name after connection is established
    } catch (e) {
      // Ignore - we'll use default name
    }

    // Create or update connection
    const [connection] = await sql`
      INSERT INTO erp_connections (
        company_id,
        provider,
        connection_status,
        access_token,
        refresh_token,
        token_expires_at,
        realm_id,
        company_name,
        company_currency,
        sync_frequency_hours,
        auto_intercept_enabled,
        auto_vendor_enrollment,
        min_invoice_amount,
        max_invoice_amount
      ) VALUES (
        ${companyId},
        'netsuite',
        'active',
        ${tokens.access_token},
        ${tokens.refresh_token},
        ${expiresAt.toISOString()},
        ${accountId},
        ${companyName},
        'USD',
        4,
        true,
        true,
        100,
        1000000
      )
      ON CONFLICT (company_id, provider)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        realm_id = EXCLUDED.realm_id,
        connection_status = 'active',
        updated_at = NOW()
      RETURNING id
    `;

    // Get company info now that connection is established
    try {
      const info = await netsuite.getCompanyInfo(connection.id);
      if (info?.companyName) {
        await sql`
          UPDATE erp_connections
          SET company_name = ${info.companyName}
          WHERE id = ${connection.id}
        `;
      }
    } catch (e) {
      console.warn('Could not fetch NetSuite company info:', e);
    }

    // Trigger initial sync in background
    setTimeout(async () => {
      try {
        console.log(`Starting initial NetSuite sync for connection ${connection.id}`);
        await netsuite.fullSync(connection.id);
        await interceptService.scanForPayables(connection.id);
        console.log(`Completed initial NetSuite sync for connection ${connection.id}`);
      } catch (error) {
        console.error('Initial NetSuite sync failed:', error);
        await sql`
          UPDATE erp_connections
          SET
            last_sync_status = 'failed',
            last_sync_error = ${error instanceof Error ? error.message : 'Unknown error'}
          WHERE id = ${connection.id}
        `;
      }
    }, 1000);

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/erp/connect?success=netsuite&connectionId=${connection.id}`, req.url)
    );
  } catch (error: any) {
    console.error('NetSuite callback error:', error);
    return NextResponse.redirect(
      new URL(`/erp/connect?error=netsuite&message=${encodeURIComponent(error.message || 'Unknown error')}`, req.url)
    );
  }
}
