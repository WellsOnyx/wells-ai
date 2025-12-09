// @ts-nocheck
/**
 * WhatsApp Cloud API Webhook
 *
 * Receives messages and status updates from Meta's WhatsApp Cloud API
 * 1,000 free service conversations per month!
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyWebhook,
  validateWebhookSignature,
  processWebhook,
} from '@/lib/inbox/providers/whatsapp-cloud';

/**
 * GET - Webhook Verification
 * Meta sends this to verify webhook ownership during setup
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (!mode || !token || !challenge) {
      return new NextResponse('Missing verification parameters', { status: 400 });
    }

    const response = verifyWebhook(mode, token, challenge);

    if (response !== null) {
      console.log('WhatsApp Cloud webhook verified');
      return new NextResponse(response, { status: 200 });
    }

    return new NextResponse('Verification failed', { status: 403 });
  } catch (error) {
    console.error('WhatsApp Cloud verification error:', error);
    return new NextResponse('Verification error', { status: 500 });
  }
}

/**
 * POST - Receive webhook events
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();

    // Verify signature in production
    if (process.env.NODE_ENV === 'production') {
      const signature = request.headers.get('x-hub-signature-256') || '';
      if (!validateWebhookSignature(signature, body)) {
        console.error('Invalid WhatsApp Cloud webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 }
        );
      }
    }

    const payload = JSON.parse(body);

    console.log('WhatsApp Cloud webhook:', JSON.stringify(payload).substring(0, 500));

    // Process the webhook
    await processWebhook(payload);

    // Always return 200 quickly to prevent Meta from retrying
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp Cloud webhook error:', error);
    // Still return 200 to prevent retries
    return NextResponse.json({ status: 'error_logged' });
  }
}
