// @ts-nocheck
/**
 * WhatsApp Webhook - Receives messages from Twilio
 *
 * Twilio sends webhooks here when WhatsApp messages arrive.
 * Same format as SMS but with whatsapp: prefix on numbers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleInboundWhatsApp } from '@/lib/inbox/providers/whatsapp';
import twilio from 'twilio';

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';

/**
 * Validate Twilio signature
 */
function validateTwilioRequest(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) return true; // Skip validation in dev
  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * POST - Receive inbound WhatsApp message
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData();
    const payload: Record<string, string> = {};
    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    // Validate Twilio signature in production
    const signature = request.headers.get('x-twilio-signature') || '';
    const url = request.url;

    if (process.env.NODE_ENV === 'production') {
      const isValid = validateTwilioRequest(TWILIO_AUTH_TOKEN, signature, url, payload);
      if (!isValid) {
        console.error('Invalid Twilio signature');
        return new NextResponse('Invalid signature', { status: 403 });
      }
    }

    // Check if this is a WhatsApp message
    const from = payload.From || '';
    const to = payload.To || '';

    if (!from.startsWith('whatsapp:') && !to.startsWith('whatsapp:')) {
      // Not a WhatsApp message, return empty response
      return new NextResponse('Not a WhatsApp message', { status: 400 });
    }

    console.log('Received WhatsApp message:', {
      from: payload.From,
      to: payload.To,
      body: payload.Body?.substring(0, 50),
      profileName: payload.ProfileName,
    });

    // Handle the inbound message
    const message = await handleInboundWhatsApp(payload);

    // Return TwiML response (empty is fine for WhatsApp)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    );
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET - Webhook verification (for initial setup)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    provider: 'whatsapp',
    message: 'WhatsApp webhook endpoint ready',
  });
}
