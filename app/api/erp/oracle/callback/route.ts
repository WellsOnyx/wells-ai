// Oracle OAuth Callback
// Handles OAuth2 callback from Oracle Fusion Cloud
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { oracle } from '@/lib/erp/oracle';
import { interceptService } from '@/lib/erp/intercept-service';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Oracle OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/erp/connect?error=oracle&message=${encodeURIComponent(errorDescription || error)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // Parse state to get company ID and Oracle host
    let stateData: { companyId: string; oracleHost: string; variant: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    const { companyId, oracleHost, variant } = stateData;

    if (!companyId || !oracleHost) {
      return NextResponse.json({ error: 'Invalid state: missing companyId or oracleHost' }, { status: 400 });
    }

    // Exchange code for tokens
    const tokens = await oracle.exchangeCodeForTokens(code, oracleHost);

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Create or update connection
    const [connection] = await sql`
      INSERT INTO erp_connections (
        company_id,
        provider,
        connection_status,
        access_token,
        refresh_token,
        token_expires_at,
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
        ${tokens.access_token},
        ${tokens.refresh_token},
        ${expiresAt.toISOString()},
        ${oracleHost},
        ${variant || 'fusion'},
        true,
        true,
        100,
        1000000,
        4
      )
      ON CONFLICT (company_id, provider)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        oracle_host = EXCLUDED.oracle_host,
        oracle_variant = EXCLUDED.oracle_variant,
        connection_status = 'active',
        updated_at = NOW()
      RETURNING id
    `;

    // Trigger initial sync in background
    setTimeout(async () => {
      try {
        await oracle.fullSync(connection.id);
        // Also scan for intercept opportunities
        await interceptService.scanForPayables(connection.id);
      } catch (error) {
        console.error('Initial Oracle sync failed:', error);
      }
    }, 1000);

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/erp/connect?success=oracle&connectionId=${connection.id}`, req.url)
    );
  } catch (error) {
    console.error('Oracle callback error:', error);
    return NextResponse.redirect(
      new URL(`/erp/connect?error=oracle&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, req.url)
    );
  }
}
