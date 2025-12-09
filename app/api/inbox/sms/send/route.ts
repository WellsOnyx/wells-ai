import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/inbox/providers/sms';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to prevent build-time errors
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) } as any;
  }
  return createClient(supabaseUrl, supabaseKey);
};

/**
 * POST /api/inbox/sms/send
 *
 * Send outbound SMS via Twilio
 *
 * Body:
 * {
 *   accountId: string;
 *   to: string;
 *   body: string;
 *   mediaUrls?: string[];
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { accountId, to, body, mediaUrls } = await req.json();

    // Validate required fields
    if (!accountId || !to || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, to, body' },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!isValidPhoneNumber(to)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)' },
        { status: 400 }
      );
    }

    // Validate account access
    const { data: account } = await supabase
      .from('accounts')
      .select('id, sms_enabled')
      .eq('id', accountId)
      .single();

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (!account.sms_enabled) {
      return NextResponse.json(
        { error: 'SMS not enabled for this account' },
        { status: 403 }
      );
    }

    // Send SMS
    const message = await sendSMS(accountId, to, body, mediaUrls);

    return NextResponse.json({
      success: true,
      message
    });

  } catch (error: any) {
    console.error('Error sending SMS:', error);

    // Handle Twilio-specific errors
    if (error.code) {
      return NextResponse.json(
        {
          error: 'Failed to send SMS',
          details: error.message,
          code: error.code
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  // Basic E.164 validation
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}
