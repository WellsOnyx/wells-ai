// SAP OAuth Callback
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { sap } from '@/lib/erp/sap';
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
      console.error('SAP OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/erp/connect?error=sap&message=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // Parse state to get company ID, SAP host, and system type
    let stateData: { companyId: string; sapHost: string; sapSystem?: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    const { companyId, sapHost, sapSystem = 's4hana' } = stateData;

    if (!companyId || !sapHost) {
      return NextResponse.json({ error: 'Missing companyId or sapHost in state' }, { status: 400 });
    }

    // Exchange code for tokens
    const tokens = await sap.exchangeCodeForTokens(code, sapHost);

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
        realm_id,
        company_key,
        company_currency,
        sync_frequency_hours,
        auto_intercept_enabled,
        auto_vendor_enrollment,
        min_invoice_amount,
        max_invoice_amount
      ) VALUES (
        ${companyId},
        'sap',
        'active',
        ${tokens.access_token},
        ${tokens.refresh_token},
        ${expiresAt.toISOString()},
        ${sapHost},
        ${sapSystem},
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
        company_key = EXCLUDED.company_key,
        connection_status = 'active',
        updated_at = NOW()
      RETURNING id
    `;

    // Get company info
    try {
      const info = await sap.getCompanyInfo(connection.id);
      if (info) {
        const companyName = info.CompanyName || info.CompanyDB || `SAP ${sapSystem}`;
        await sql`
          UPDATE erp_connections
          SET company_name = ${companyName}
          WHERE id = ${connection.id}
        `;
      }
    } catch (e) {
      console.warn('Could not fetch SAP company info:', e);
    }

    // Trigger initial sync in background
    setTimeout(async () => {
      try {
        console.log(`Starting initial SAP sync for connection ${connection.id}`);
        await sap.fullSync(connection.id);
        await interceptService.scanForPayables(connection.id);
        console.log(`Completed initial SAP sync for connection ${connection.id}`);
      } catch (error) {
        console.error('Initial SAP sync failed:', error);
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
      new URL(`/erp/connect?success=sap&connectionId=${connection.id}`, req.url)
    );
  } catch (error: any) {
    console.error('SAP callback error:', error);
    return NextResponse.redirect(
      new URL(`/erp/connect?error=sap&message=${encodeURIComponent(error.message || 'Unknown error')}`, req.url)
    );
  }
}
