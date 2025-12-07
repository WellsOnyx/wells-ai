import { NextRequest, NextResponse } from 'next/server';
import { handleInboundSMS } from '@/lib/inbox/providers/sms';
import twilio from 'twilio';

/**
 * POST /api/inbox/sms/webhook
 *
 * Twilio webhook for inbound SMS messages
 */
export async function POST(req: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await req.formData();
    const twilioPayload: any = {};

    formData.forEach((value, key) => {
      twilioPayload[key] = value;
    });

    // Validate Twilio signature for security
    const signature = req.headers.get('x-twilio-signature') || '';
    const url = process.env.TWILIO_WEBHOOK_URL || req.url;

    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      signature,
      url,
      twilioPayload
    );

    if (!isValid && process.env.NODE_ENV === 'production') {
      console.error('Invalid Twilio signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Handle inbound SMS
    const message = await handleInboundSMS(twilioPayload);

    // Respond with TwiML (required by Twilio)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for your message. We'll get back to you soon!</Message>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    });

  } catch (error: any) {
    console.error('Error in SMS webhook:', error);

    // Return TwiML error response
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>We encountered an error processing your message. Please try again later.</Message>
</Response>`;

    return new NextResponse(errorTwiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    });
  }
}

/**
 * GET /api/inbox/sms/webhook
 *
 * Health check for webhook
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    webhook: 'SMS webhook endpoint',
    timestamp: new Date().toISOString()
  });
}
