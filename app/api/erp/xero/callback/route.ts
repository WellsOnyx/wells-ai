// Xero OAuth Callback
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { xero } from '@/lib/erp/xero';
import { interceptService } from '@/lib/erp/intercept-service';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // Exchange code for tokens
    const tokens = await xero.exchangeCodeForTokens(code);

    // Get tenant IDs (Xero organizations)
    const tenants = await xero.getTenants(tokens.access_token);

    if (tenants.length === 0) {
      throw new Error('No Xero organizations found');
    }

    // Use first tenant for now
    const tenant = tenants[0];

    // Parse state to get company ID
    const { companyId } = JSON.parse(Buffer.from(state, 'base64').toString());

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
        tenant_id,
        company_name
      ) VALUES (
        ${companyId},
        'xero',
        'active',
        ${tokens.access_token},
        ${tokens.refresh_token},
        ${expiresAt.toISOString()},
        ${tenant.tenantId},
        ${tenant.tenantName}
      )
      ON CONFLICT (company_id, provider)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        tenant_id = EXCLUDED.tenant_id,
        company_name = EXCLUDED.company_name,
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
      new URL(`/erp/connect?success=xero&connectionId=${connection.id}`, req.url)
    );
  } catch (error) {
    console.error('Xero callback error:', error);
    return NextResponse.redirect(
      new URL('/erp/connect?error=xero', req.url)
    );
  }
}
