/**
 * Acumatica OAuth Callback Handler
 *
 * Handles the OAuth 2.0 authorization code callback from Acumatica.
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

const ACUMATICA_REDIRECT_URI = process.env.ACUMATICA_REDIRECT_URI || 'https://wellsai.app/api/erp/acumatica/callback';

// GET - Handle OAuth callback
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Acumatica OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/erp/connect?error=acumatica&message=${encodeURIComponent(errorDescription || error)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/erp/connect?error=acumatica&message=Missing code or state', req.url)
      );
    }

    // Parse state to get company ID and instance URL
    let stateData: {
      companyId?: string;
      instanceUrl?: string;
      clientId?: string;
      clientSecret?: string;
    };

    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/erp/connect?error=acumatica&message=Invalid state parameter', req.url)
      );
    }

    const { companyId, instanceUrl, clientId, clientSecret } = stateData;

    if (!instanceUrl || !clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/erp/connect?error=acumatica&message=Missing connection details in state', req.url)
      );
    }

    // Exchange code for tokens
    const tokenUrl = `${instanceUrl}/identity/connect/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: ACUMATICA_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Acumatica token exchange error:', errorText);
      return NextResponse.redirect(
        new URL(`/erp/connect?error=acumatica&message=${encodeURIComponent('Failed to exchange code for tokens')}`, req.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Calculate token expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));

    // Store connection in database
    if (sql && companyId) {
      const [connection] = await sql`
        INSERT INTO erp_connections (
          company_id,
          provider,
          connection_status,
          access_token,
          refresh_token,
          token_expires_at,
          realm_id,
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
          ${tokens.access_token},
          ${tokens.refresh_token || null},
          ${expiresAt.toISOString()},
          ${instanceUrl},
          'USD',
          24,
          true,
          true,
          100,
          1000000,
          false,
          ${JSON.stringify({ clientId, clientSecret, scope: tokens.scope })}
        )
        ON CONFLICT (company_id, provider)
        DO UPDATE SET
          connection_status = 'active',
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expires_at = EXCLUDED.token_expires_at,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id
      `;

      // Redirect to success page
      return NextResponse.redirect(
        new URL(`/erp/connect?success=acumatica&connectionId=${connection.id}`, req.url)
      );
    }

    // Redirect to success page (without DB)
    return NextResponse.redirect(
      new URL('/erp/connect?success=acumatica', req.url)
    );

  } catch (error) {
    console.error('Acumatica callback error:', error);
    return NextResponse.redirect(
      new URL(`/erp/connect?error=acumatica&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, req.url)
    );
  }
}

// POST - Handle webhook notifications
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventType,
      connectionId,
      entityType,
      entityId,
      payload,
    } = body;

    console.log(`Acumatica webhook received: ${eventType} for ${entityType} ${entityId}`);

    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Log webhook event
    await sql`
      INSERT INTO erp_webhook_events (
        erp_connection_id,
        provider,
        event_type,
        external_entity_id,
        entity_type,
        payload,
        processed
      ) VALUES (
        ${connectionId || null},
        'acumatica',
        ${eventType || 'unknown'},
        ${entityId || null},
        ${entityType || null},
        ${JSON.stringify(payload || body)}::jsonb,
        false
      )
    `;

    // Process based on event type
    if (eventType && connectionId) {
      switch (eventType) {
        case 'Bill.Created':
        case 'Bill.Updated':
          console.log(`Bill event: ${eventType} for bill ${entityId}`);
          break;

        case 'Check.Created':
        case 'Check.Updated':
          console.log(`Payment event: ${eventType} for check ${entityId}`);
          break;

        case 'Vendor.Created':
        case 'Vendor.Updated':
          console.log(`Vendor event: ${eventType} for vendor ${entityId}`);
          break;

        default:
          console.log(`Unknown event type: ${eventType}`);
      }

      // Mark webhook as processed
      await sql`
        UPDATE erp_webhook_events
        SET processed = true, processed_at = NOW()
        WHERE erp_connection_id = ${connectionId}
          AND external_entity_id = ${entityId}
          AND event_type = ${eventType}
          AND processed = false
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed'
    });

  } catch (error) {
    console.error('Acumatica webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
