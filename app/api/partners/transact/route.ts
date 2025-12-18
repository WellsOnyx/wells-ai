// @ts-nocheck
/**
 * POST /api/partners/transact
 *
 * White-label partner transaction endpoint
 * Partners process transactions through Wells - users don't know about Wells
 * Every transaction silently enrolls both parties
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    // Validate API key
    const { data: partner, error: partnerError } = await supabase
      .from('white_label_partners')
      .select('*')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      external_id,
      sender_id,
      sender_email,
      recipient_id,
      recipient_email,
      amount,
      currency = 'USDC',
      metadata = {}
    } = body;

    if (!sender_id || !recipient_id || !amount) {
      return NextResponse.json(
        { error: 'sender_id, recipient_id, and amount are required' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be positive' },
        { status: 400 }
      );
    }

    // Calculate fees
    const wellsFeePercent = 0.01; // 1%
    const wellsFee = amount * wellsFeePercent;
    const partnerShare = wellsFee * (partner.revenue_share_percent / 100);
    const wellsNet = wellsFee - partnerShare;

    // Silent enroll sender
    let senderAccountId: string;
    const senderWallet = `0x${crypto.randomBytes(20).toString('hex')}`;

    const { data: existingSender } = await supabase
      .from('silent_accounts')
      .select('id')
      .eq('email', sender_email || `${sender_id}@${partner.domain}`)
      .single();

    if (existingSender) {
      senderAccountId = existingSender.id;
    } else {
      const { data: newSender, error: senderError } = await supabase
        .from('silent_accounts')
        .insert({
          email: sender_email || `${sender_id}@${partner.domain}`,
          wallet_address: senderWallet,
          first_touch: `white_label_${partner.platform_name}`,
          activation_level: 'ghost',
          metadata: {
            partner_id: partner.id,
            external_id: sender_id
          }
        })
        .select()
        .single();

      if (senderError) throw senderError;
      senderAccountId = newSender.id;
    }

    // Silent enroll recipient
    let recipientAccountId: string;
    const recipientWallet = `0x${crypto.randomBytes(20).toString('hex')}`;

    const { data: existingRecipient } = await supabase
      .from('silent_accounts')
      .select('id')
      .eq('email', recipient_email || `${recipient_id}@${partner.domain}`)
      .single();

    if (existingRecipient) {
      recipientAccountId = existingRecipient.id;
    } else {
      const { data: newRecipient, error: recipientError } = await supabase
        .from('silent_accounts')
        .insert({
          email: recipient_email || `${recipient_id}@${partner.domain}`,
          wallet_address: recipientWallet,
          first_touch: `white_label_${partner.platform_name}`,
          activation_level: 'ghost',
          metadata: {
            partner_id: partner.id,
            external_id: recipient_id
          }
        })
        .select()
        .single();

      if (recipientError) throw recipientError;
      recipientAccountId = newRecipient.id;
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('white_label_transactions')
      .insert({
        partner_id: partner.id,
        external_id,
        sender_external_id: sender_id,
        recipient_external_id: recipient_id,
        amount,
        currency,
        sender_account_id: senderAccountId,
        recipient_account_id: recipientAccountId,
        wells_fee: wellsFee,
        partner_share: partnerShare,
        wells_net: wellsNet,
        status: 'completed',
        metadata
      })
      .select()
      .single();

    if (txError) throw txError;

    // Update partner volume
    await supabase
      .from('white_label_partners')
      .update({
        total_volume: partner.total_volume + amount,
        monthly_volume: partner.monthly_volume + amount,
        transaction_count: partner.transaction_count + 1,
        total_fees_collected: partner.total_fees_collected + wellsFee,
        total_partner_share: partner.total_partner_share + partnerShare,
        total_wells_share: partner.total_wells_share + wellsNet,
        updated_at: new Date().toISOString()
      })
      .eq('id', partner.id);

    // Update silent account volumes
    await supabase.rpc('increment_account_volume', {
      account_id: senderAccountId,
      sent_amount: amount
    }).catch(() => {
      // Fallback if RPC doesn't exist
      supabase
        .from('silent_accounts')
        .update({
          total_volume_sent: amount,
          touch_count: 1
        })
        .eq('id', senderAccountId);
    });

    await supabase.rpc('increment_account_volume', {
      account_id: recipientAccountId,
      received_amount: amount
    }).catch(() => {
      // Fallback if RPC doesn't exist
      supabase
        .from('silent_accounts')
        .update({
          total_volume_received: amount,
          touch_count: 1
        })
        .eq('id', recipientAccountId);
    });

    // Track viral event
    await supabase.from('viral_events').insert({
      event: 'white_label_transaction',
      data: {
        partner_id: partner.id,
        partner_name: partner.platform_name,
        transaction_id: transaction.id,
        amount,
        wells_fee: wellsFee
      },
      partner_id: partner.id
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        external_id,
        amount,
        currency,
        status: 'completed',
        fees: {
          total: wellsFee,
          partner_share: partnerShare
        },
        created_at: transaction.created_at
      }
    });
  } catch (error) {
    console.error('Error processing partner transaction:', error);
    return NextResponse.json(
      { error: 'Failed to process transaction' },
      { status: 500 }
    );
  }
}
