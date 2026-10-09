// QuickBooks Webhook Handler
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { quickbooks } from '@/lib/erp/quickbooks';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('intuit-signature');
    const body = await req.text();

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Parse payload
    const payload = JSON.parse(body);

    // Get connection for this realm
    const realmId = payload.eventNotifications?.[0]?.realmId;

    if (!realmId) {
      return NextResponse.json({ error: 'Missing realmId' }, { status: 400 });
    }

    const [connection] = await sql`
      SELECT id, webhook_secret FROM erp_connections
      WHERE realm_id = ${realmId}
      AND provider = 'quickbooks'
      AND connection_status = 'active'
    `;

    if (!connection) {
      console.log('No active connection found for realm:', realmId);
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Verify signature
    if (connection.webhook_secret) {
      const isValid = quickbooks.verifyWebhookSignature(
        body,
        signature,
        connection.webhook_secret
      );

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Process webhook event
    await quickbooks.processWebhookEvent(connection.id, payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('QuickBooks webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Webhook verification endpoint
export async function GET(req: NextRequest) {
  // QuickBooks doesn't use GET for verification, but some systems do
  return NextResponse.json({ status: 'ok' });
}
