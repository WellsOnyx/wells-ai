// @ts-nocheck
/**
 * GET /api/partners/transactions
 * Get partner transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const { data: partner, error: partnerError } = await supabase
      .from('white_label_partners')
      .select('id')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { data: transactions, error } = await supabase
      .from('white_label_transactions')
      .select(`
        id,
        external_id,
        sender_external_id,
        recipient_external_id,
        amount,
        currency,
        wells_fee,
        partner_share,
        wells_net,
        status,
        metadata,
        created_at
      `)
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ transactions: transactions || [] });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
