// @ts-nocheck
/**
 * GET /api/viral/history?account_id=xxx
 *
 * Get payment history for a user
 * Shows sent payments, received payments, and network stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');

    if (!accountId) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      );
    }

    // Get account details
    const { data: account, error: accountError } = await supabase
      .from('silent_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Get sent payments
    const { data: sentPayments, error: sentError } = await supabase
      .from('viral_payments')
      .select('*')
      .eq('sender_id', accountId)
      .order('created_at', { ascending: false });

    if (sentError) throw sentError;

    // Get received payments
    const { data: receivedPayments, error: receivedError } = await supabase
      .from('viral_payments')
      .select('*')
      .eq('recipient_account_id', accountId)
      .order('created_at', { ascending: false });

    if (receivedError) throw receivedError;

    // Calculate stats
    const sentCount = sentPayments?.length || 0;
    const receivedCount = receivedPayments?.length || 0;

    const totalSentVolume = sentPayments?.reduce((sum, p) => sum + p.amount_usdc, 0) || 0;
    const totalReceivedVolume = receivedPayments?.reduce((sum, p) => sum + p.amount_usdc, 0) || 0;

    const totalReferrerBonus = sentPayments?.reduce((sum, p) => {
      return sum + (p.status === 'claimed' ? p.referrer_bonus : 0);
    }, 0) || 0;

    // Count unique recipients (network enrollments)
    const uniqueRecipients = new Set(
      sentPayments?.map(p => p.recipient_account_id) || []
    );
    const networkEnrollments = uniqueRecipients.size;

    // Get viral events for deeper insights
    const { data: viralEvents } = await supabase
      .from('viral_events')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100);

    return NextResponse.json({
      payments: {
        sent: sentPayments || [],
        received: receivedPayments || [],
      },
      stats: {
        total_sent: sentCount,
        total_received: receivedCount,
        total_volume_sent: totalSentVolume,
        total_volume_received: totalReceivedVolume,
        network_enrollments: networkEnrollments,
        total_referrer_bonus: totalReferrerBonus,
      },
      account: {
        id: account.id,
        activation_level: account.activation_level,
        wallet_address: account.wallet_address,
        total_volume_sent: account.total_volume_sent || 0,
        total_volume_received: account.total_volume_received || 0,
        touch_count: account.touch_count || 0,
      },
      viral_events: viralEvents || [],
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    );
  }
}
