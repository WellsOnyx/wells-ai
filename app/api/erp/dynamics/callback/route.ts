// Dynamics 365 OAuth Callback
// Handles Azure AD OAuth2 callback for Dynamics 365 F&O and Business Central
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { dynamics365 } from '@/lib/erp/dynamics365';
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
      console.error('Dynamics OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/erp/connect?error=dynamics365&message=${encodeURIComponent(errorDescription || error)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // Parse state to get company ID and tenant info
    let stateData: {
      companyId: string;
      tenantId: string;
      variant: 'finance_operations' | 'business_central';
      dynamicsHost?: string;
      environment?: string;
    };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    const { companyId, tenantId, variant, dynamicsHost, environment } = stateData;

    if (!companyId || !tenantId) {
      return NextResponse.json({ error: 'Invalid state: missing companyId or tenantId' }, { status: 400 });
    }

    // Exchange code for tokens
    const tokens = await dynamics365.exchangeCodeForTokens(code, tenantId, variant);

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // For Business Central, get available companies
    let dynamicsCompanyId: string | null = null;
    let companyName: string | null = null;

    if (variant === 'business_central') {
      try {
        const companies = await dynamics365.getBusinessCentralCompanies(
          tokens.access_token,
          tenantId,
          environment || 'production'
        );

        if (companies.length > 0) {
          dynamicsCompanyId = companies[0].id;
          companyName = companies[0].displayName;
        }
      } catch (e) {
        console.error('Failed to fetch BC companies:', e);
      }
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
        dynamics_host,
        dynamics_variant,
        dynamics_tenant_id,
        dynamics_company_id,
        dynamics_environment,
        company_name,
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
        ${tokens.refresh_token},
        ${expiresAt.toISOString()},
        ${dynamicsHost || null},
        ${variant},
        ${tenantId},
        ${dynamicsCompanyId},
        ${environment || 'production'},
        ${companyName},
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
        dynamics_host = EXCLUDED.dynamics_host,
        dynamics_variant = EXCLUDED.dynamics_variant,
        dynamics_tenant_id = EXCLUDED.dynamics_tenant_id,
        dynamics_company_id = EXCLUDED.dynamics_company_id,
        dynamics_environment = EXCLUDED.dynamics_environment,
        company_name = EXCLUDED.company_name,
        connection_status = 'active',
        updated_at = NOW()
      RETURNING id
    `;

    // Trigger initial sync in background
    setTimeout(async () => {
      try {
        await dynamics365.fullSync(connection.id);
        // Also scan for intercept opportunities
        await interceptService.scanForPayables(connection.id);
      } catch (error) {
        console.error('Initial Dynamics sync failed:', error);
      }
    }, 1000);

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/erp/connect?success=dynamics365&connectionId=${connection.id}`, req.url)
    );
  } catch (error) {
    console.error('Dynamics callback error:', error);
    return NextResponse.redirect(
      new URL(`/erp/connect?error=dynamics365&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, req.url)
    );
  }
}
