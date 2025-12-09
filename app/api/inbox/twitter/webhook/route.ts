// @ts-nocheck
/**
 * X (Twitter) Account Activity API Webhook
 *
 * Receives DM events from Twitter's Account Activity API
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateCRCResponse,
  verifyWebhookSignature,
  processWebhookEvent,
} from '@/lib/inbox/providers/twitter-dm';

/**
 * GET - CRC Challenge Response
 * Twitter sends this to verify webhook ownership
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const crcToken = searchParams.get('crc_token');

    if (!crcToken) {
      return NextResponse.json(
        { error: 'crc_token is required' },
        { status: 400 }
      );
    }

    // Generate CRC response
    const responseToken = generateCRCResponse(crcToken);

    return NextResponse.json({
      response_token: responseToken,
    });
  } catch (error) {
    console.error('Twitter CRC error:', error);
    return NextResponse.json(
      { error: 'CRC validation failed' },
      { status: 500 }
    );
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
      const signature = request.headers.get('x-twitter-webhooks-signature') || '';
      if (!verifyWebhookSignature(signature, body)) {
        console.error('Invalid Twitter webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 }
        );
      }
    }

    const payload = JSON.parse(body);

    console.log('Twitter webhook event:', JSON.stringify(payload).substring(0, 500));

    // Process events for each user
    const forUserId = payload.for_user_id;
    if (forUserId) {
      await processWebhookEvent(forUserId, payload);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Twitter webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
