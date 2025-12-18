// @ts-nocheck
/**
 * GET /api/partners/volume
 * Get partner volume data over time
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
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
    const days = parseInt(searchParams.get('days') || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: transactions, error } = await supabase
      .from('white_label_transactions')
      .select('amount, partner_share, created_at')
      .eq('partner_id', partner.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const volumeByDate: Record<string, { volume: number; transactions: number; fees_earned: number }> = {};

    transactions?.forEach((tx) => {
      const date = tx.created_at.split('T')[0]; // YYYY-MM-DD
      if (!volumeByDate[date]) {
        volumeByDate[date] = { volume: 0, transactions: 0, fees_earned: 0 };
      }
      volumeByDate[date].volume += parseFloat(tx.amount);
      volumeByDate[date].transactions += 1;
      volumeByDate[date].fees_earned += parseFloat(tx.partner_share);
    });

    // Convert to array and fill gaps
    const volumeData = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      volumeData.push({
        date: dateStr,
        volume: volumeByDate[dateStr]?.volume || 0,
        transactions: volumeByDate[dateStr]?.transactions || 0,
        fees_earned: volumeByDate[dateStr]?.fees_earned || 0,
      });
    }

    return NextResponse.json({ volume_data: volumeData });
  } catch (error) {
    console.error('Error fetching volume data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch volume data' },
      { status: 500 }
    );
  }
}
