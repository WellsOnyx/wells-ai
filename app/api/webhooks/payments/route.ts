/**
 * PAYMENT WEBHOOKS
 *
 * Unified webhook endpoint for Circle and Stripe payment events.
 * Handles payment confirmations, failures, and float deployment triggers.
 *
 * ENDPOINTS:
 * - POST /api/webhooks/payments?provider=circle
 * - POST /api/webhooks/payments?provider=stripe
 *
 * SECURITY:
 * - Circle: Validates signature using entity secret
 * - Stripe: Validates signature using webhook secret
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as CirclePayments from '@/lib/payments/circle';
import * as StripePayments from '@/lib/payments/stripe';

// ============================================================================
// CIRCLE WEBHOOKS
// ============================================================================

/**
 * Verify Circle webhook signature
 */
function verifyCircleSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Circle uses HMAC SHA256 for webhook signatures
  // Signature format: v1=<hex_signature>
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `v1=${hmac.digest('hex')}`;

  return signature === expectedSignature;
}

/**
 * Handle Circle webhook events
 */
async function handleCircleWebhook(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('circle-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Verify signature
    const secret = process.env.CIRCLE_ENTITY_SECRET;
    if (!secret) {
      console.error('CIRCLE_ENTITY_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const isValid = verifyCircleSignature(rawBody, signature, secret);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse event
    const event = JSON.parse(rawBody);

    // Handle event
    await CirclePayments.handleCircleWebhook(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Circle webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// STRIPE WEBHOOKS
// ============================================================================

/**
 * Handle Stripe webhook events
 */
async function handleStripeWebhook(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Verify and construct event
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (error: any) {
      console.error('Stripe signature verification failed:', error.message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Handle event
    await StripePayments.handleStripeWebhook(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// UNIFIED WEBHOOK HANDLER
// ============================================================================

/**
 * Main webhook handler
 * Routes to appropriate provider based on query param
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');

  if (!provider) {
    return NextResponse.json(
      { error: 'Missing provider query parameter' },
      { status: 400 }
    );
  }

  switch (provider.toLowerCase()) {
    case 'circle':
      return handleCircleWebhook(request);

    case 'stripe':
      return handleStripeWebhook(request);

    default:
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    providers: ['circle', 'stripe'],
    endpoints: {
      circle: '/api/webhooks/payments?provider=circle',
      stripe: '/api/webhooks/payments?provider=stripe',
    },
  });
}
