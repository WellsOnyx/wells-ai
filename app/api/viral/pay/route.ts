// @ts-nocheck
/**
 * POST /api/viral/pay
 *
 * Create a viral payment - recipient automatically enrolled
 * Every payment is an invitation to Wells
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyPaymentReceived } from '@/lib/notifications/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sender_id,
      recipient_email,
      recipient_phone,
      recipient_company,
      amount,
      memo,
      invoice_id
    } = body;

    if (!sender_id || !amount) {
      return NextResponse.json(
        { error: 'sender_id and amount are required' },
        { status: 400 }
      );
    }

    if (!recipient_email && !recipient_phone && !recipient_company) {
      return NextResponse.json(
        { error: 'At least one recipient identifier required' },
        { status: 400 }
      );
    }

    // Generate wallet for recipient (silent enrollment)
    const recipientWallet = `0x${Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    // Check if recipient already has an account
    let existingAccount = null;
    if (recipient_email) {
      const { data } = await supabase
        .from('silent_accounts')
        .select('*')
        .eq('email', recipient_email)
        .single();
      existingAccount = data;
    }

    // Create silent account for recipient if doesn't exist
    let recipientAccountId: string;
    if (!existingAccount) {
      const { data: newAccount, error: accountError } = await supabase
        .from('silent_accounts')
        .insert({
          email: recipient_email,
          phone: recipient_phone,
          company_name: recipient_company,
          wallet_address: recipientWallet,
          first_touch: 'viral_payment_recipient',
          activation_level: 'ghost',
          metadata: {
            first_payment_from: sender_id,
            first_payment_amount: amount
          }
        })
        .select()
        .single();

      if (accountError) throw accountError;
      recipientAccountId = newAccount.id;
    } else {
      recipientAccountId = existingAccount.id;
    }

    // Generate payment ID and referral code
    const paymentId = `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const referralCode = `${sender_id.slice(0, 4)}-${Date.now().toString(36)}`.toUpperCase();
    const claimUrl = `https://wellsonyx.io/claim/${paymentId}?ref=${referralCode}`;

    // Get sender wallet
    const { data: senderWallet } = await supabase
      .from('treasury_wallets')
      .select('wallet_address')
      .eq('user_id', sender_id)
      .single();

    // Calculate fee (1% Wells fee)
    const wellsFee = amount * 0.01;
    const referrerBonus = amount * 0.001; // 0.1% to referrer

    // Create viral payment
    const { data: payment, error } = await supabase
      .from('viral_payments')
      .insert({
        id: paymentId,
        sender_id,
        sender_wallet: senderWallet?.wallet_address || sender_id,
        recipient_email,
        recipient_phone,
        recipient_company,
        recipient_wallet: existingAccount?.wallet_address || recipientWallet,
        recipient_account_id: recipientAccountId,
        amount_usdc: amount,
        memo,
        invoice_id,
        referral_code: referralCode,
        claim_url: claimUrl,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        wells_fee: wellsFee,
        referrer_bonus: referrerBonus
      })
      .select()
      .single();

    if (error) throw error;

    // Track viral event
    await supabase.from('viral_events').insert({
      event: 'payment_created',
      data: {
        payment_id: paymentId,
        sender_id,
        recipient_email,
        amount,
        referral_code: referralCode
      },
      account_id: recipientAccountId,
      referral_code: referralCode
    });

    // Get sender name for notification
    const { data: senderAccount } = await supabase
      .from('silent_accounts')
      .select('company_name, email')
      .eq('id', sender_id)
      .single();

    const senderName = senderAccount?.company_name || senderAccount?.email || 'Someone';

    // Send notification to recipient (email and/or SMS)
    await notifyPaymentReceived(
      recipient_email,
      recipient_phone,
      amount,
      senderName,
      claimUrl,
      {
        senderCompany: recipient_company,
        memo,
        expiresAt: payment.expires_at,
        userId: recipientAccountId,
      }
    ).catch((error) => {
      // Don't fail the payment if notification fails
      console.error('Failed to send payment notification:', error);
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount_usdc,
        claim_url: payment.claim_url,
        referral_code: payment.referral_code,
        expires_at: payment.expires_at,
        status: payment.status
      },
      recipient: {
        account_id: recipientAccountId,
        activation_level: existingAccount?.activation_level || 'ghost'
      }
    });
  } catch (error) {
    console.error('Error creating viral payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
