// QuickBooks OAuth Callback
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { quickbooks } from '@/lib/erp/quickbooks';
import { interceptService } from '@/lib/erp/intercept-service';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const realmId = searchParams.get('realmId');

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // Exchange code for tokens
    const tokens = await quickbooks.exchangeCodeForTokens(code);

    // Parse state to get company ID
    const { companyId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Get company info
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
        realm_id
      ) VALUES (
        ${companyId},
        'quickbooks',
        'active',
        ${tokens.access_token},
        ${tokens.refresh_token},
        ${expiresAt.toISOString()},
        ${realmId}
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

    // Trigger initial sync in background
    setTimeout(async () => {
      try {
        await interceptService.scanForPayables(connection.id);
      } catch (error) {
        console.error('Initial sync failed:', error);
      }
    }, 1000);

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/erp/connect?success=quickbooks&connectionId=${connection.id}`, req.url)
    );
  } catch (error) {
    console.error('QuickBooks callback error:', error);
    return NextResponse.redirect(
      new URL('/erp/connect?error=quickbooks', req.url)
    );
  }
}
