/**
 * Sage Intacct Webhook/Callback Handler
 *
 * Sage Intacct doesn't use OAuth callbacks, but this endpoint handles:
 * - Webhook notifications from Sage Intacct (if configured)
 * - Event notifications for bill/payment changes
 * - Connection refresh requests
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createSageIntacctAdapter } from '@/lib/treasury-sdk/adapters/sage-intacct';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// POST - Handle incoming webhooks/notifications
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

    console.log(`Sage Intacct webhook received: ${eventType} for ${entityType} ${entityId}`);

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
        'sage-intacct',
        ${eventType || 'unknown'},
        ${entityId || null},
        ${entityType || null},
        ${JSON.stringify(payload || body)}::jsonb,
        false
      )
    `;

    // Process based on event type
    if (eventType && connectionId) {
      // Get connection details
      const [connection] = await sql`
        SELECT * FROM erp_connections
        WHERE id = ${connectionId}
          AND provider = 'sage-intacct'
      `;

      if (connection) {
        const credentials = JSON.parse(connection.access_token || '{}');
        const metadata = connection.metadata || {};

        // Process specific event types
        switch (eventType) {
          case 'bill.created':
          case 'bill.updated':
            // Could trigger a sync for this specific bill
            console.log(`Bill event: ${eventType} for bill ${entityId}`);
            break;

          case 'payment.created':
          case 'payment.updated':
            console.log(`Payment event: ${eventType} for payment ${entityId}`);
            break;

          case 'vendor.created':
          case 'vendor.updated':
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
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed'
    });

  } catch (error) {
    console.error('Sage Intacct webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

// GET - Verify webhook endpoint (health check)
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    provider: 'sage-intacct',
    endpoint: 'callback',
    timestamp: new Date().toISOString(),
    message: 'Sage Intacct webhook endpoint is active'
  });
}
