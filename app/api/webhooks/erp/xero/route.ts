// Xero Webhook Handler
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { xero } from '@/lib/erp/xero';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-xero-signature');
    const body = await req.text();

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Parse payload
    const payload = JSON.parse(body);
    const events = payload.events || [];

    if (events.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Get tenant ID from first event
    const tenantId = events[0]?.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const [connection] = await sql`
      SELECT id, webhook_secret FROM erp_connections
      WHERE tenant_id = ${tenantId}
      AND provider = 'xero'
      AND connection_status = 'active'
    `;

    if (!connection) {
      console.log('No active connection found for tenant:', tenantId);
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Verify signature
    if (connection.webhook_secret) {
      const isValid = xero.verifyWebhookSignature(
        body,
        signature,
        connection.webhook_secret
      );

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Process webhook events
    await xero.processWebhookEvent(connection.id, events);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Xero webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Intent verification for Xero webhook setup
export async function GET(req: NextRequest) {
  // Xero sends a challenge during webhook setup
  return NextResponse.json({ status: 'ok' });
}
