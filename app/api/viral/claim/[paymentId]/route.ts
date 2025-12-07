// @ts-nocheck
/**
 * POST /api/viral/claim/[paymentId]
 *
 * Claim a viral payment - this is the activation moment
 * One click, money appears, they're now a Wells user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { email, phone } = body; // Optional: verify identity

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from('viral_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Check status
    if (payment.status === 'claimed') {
      return NextResponse.json(
        { error: 'Payment already claimed' },
        { status: 400 }
      );
    }

    if (payment.status === 'expired') {
      return NextResponse.json(
        { error: 'Payment has expired' },
        { status: 400 }
      );
    }

    if (new Date(payment.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('viral_payments')
        .update({ status: 'expired' })
        .eq('id', paymentId);

      return NextResponse.json(
        { error: 'Payment has expired' },
        { status: 400 }
      );
    }

    // Upgrade recipient account from ghost to aware
    const { data: account, error: accountError } = await supabase
      .from('silent_accounts')
      .update({
        activation_level: 'aware',
        email: email || undefined, // Update if provided
        phone: phone || undefined,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', payment.recipient_account_id)
      .select()
      .single();

    if (accountError) throw accountError;

    // Update payment status
    const { error: updateError } = await supabase
      .from('viral_payments')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) throw updateError;

    // Update account volumes
    await supabase
      .from('silent_accounts')
      .update({
        total_volume_received: account.total_volume_received + payment.amount_usdc,
        touch_count: account.touch_count + 1
      })
      .eq('id', payment.recipient_account_id);

    // Update sender's sent volume
    const { data: senderAccount } = await supabase
      .from('silent_accounts')
      .select('*')
      .eq('wallet_address', payment.sender_wallet)
      .single();

    if (senderAccount) {
      await supabase
        .from('silent_accounts')
        .update({
          total_volume_sent: senderAccount.total_volume_sent + payment.amount_usdc
        })
        .eq('id', senderAccount.id);
    }

    // Track viral event
    await supabase.from('viral_events').insert({
      event: 'payment_claimed',
      data: {
        payment_id: paymentId,
        amount: payment.amount_usdc,
        referral_code: payment.referral_code,
        time_to_claim_ms: new Date().getTime() - new Date(payment.created_at).getTime()
      },
      account_id: payment.recipient_account_id,
      referral_code: payment.referral_code
    });

    // Credit referrer bonus (0.1% of transaction)
    if (payment.referrer_bonus > 0) {
      // TODO: Credit to referrer's account
      console.log(`Credit referrer bonus: $${payment.referrer_bonus}`);
    }

    // Auto-approve credit line based on this transaction
    await autoApproveCreditLine(payment.recipient_account_id, payment.amount_usdc);

    return NextResponse.json({
      success: true,
      claimed: {
        amount: payment.amount_usdc,
        wallet: account.wallet_address,
        memo: payment.memo
      },
      account: {
        id: account.id,
        activation_level: 'aware',
        total_received: account.total_volume_received + payment.amount_usdc
      },
      // Show them what's next
      next_steps: {
        credit_available: calculateCreditLimit(payment.amount_usdc),
        send_payment_url: 'https://wellsonyx.io/send',
        invite_bonus: '0.1% on payments you send'
      }
    });
  } catch (error) {
    console.error('Error claiming payment:', error);
    return NextResponse.json(
      { error: 'Failed to claim payment' },
      { status: 500 }
    );
  }
}

// GET - Check payment status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;

    const { data: payment, error } = await supabase
      .from('viral_payments')
      .select('id, amount_usdc, memo, status, expires_at, recipient_company, created_at')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Check if expired
    const isExpired = new Date(payment.expires_at) < new Date();

    return NextResponse.json({
      payment: {
        id: payment.id,
        amount: payment.amount_usdc,
        memo: payment.memo,
        status: isExpired && payment.status === 'pending' ? 'expired' : payment.status,
        expires_at: payment.expires_at,
        from_company: payment.recipient_company,
        created_at: payment.created_at
      },
      claimable: payment.status === 'pending' && !isExpired
    });
  } catch (error) {
    console.error('Error getting payment:', error);
    return NextResponse.json(
      { error: 'Failed to get payment' },
      { status: 500 }
    );
  }
}

/**
 * Auto-approve credit line based on transaction
 */
async function autoApproveCreditLine(accountId: string, transactionAmount: number): Promise<void> {
  // Credit limit = 2x the transaction amount (up to $100K on first transaction)
  const creditLimit = Math.min(transactionAmount * 2, 100000);

  // Check if already has credit line
  const { data: existing } = await supabase
    .from('credit_lines')
    .select('id')
    .eq('account_id', accountId)
    .single();

  if (existing) return;

  // Create credit line
  await supabase.from('credit_lines').insert({
    account_id: accountId,
    credit_limit: creditLimit,
    available: creditLimit,
    used: 0,
    apr: 0.12,          // 12% APR
    funding_cost: 0.05, // 5% cost
    spread: 0.07,       // 7% margin
    approval_source: 'transaction_history',
    approval_data: {
      first_transaction_amount: transactionAmount,
      approved_at: new Date().toISOString()
    },
    status: 'active'
  });
}

function calculateCreditLimit(transactionAmount: number): number {
  return Math.min(transactionAmount * 2, 100000);
}
