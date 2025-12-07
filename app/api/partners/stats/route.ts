// @ts-nocheck
/**
 * GET /api/partners/stats
 * Get partner statistics
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

    const { data: partner, error } = await supabase
      .from('white_label_partners')
      .select('id, total_volume, monthly_volume, transaction_count, total_partner_share')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (error || !partner) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Calculate previous month volume for trend
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: recentTxs } = await supabase
      .from('white_label_transactions')
      .select('amount, created_at')
      .eq('partner_id', partner.id)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { data: previousTxs } = await supabase
      .from('white_label_transactions')
      .select('amount')
      .eq('partner_id', partner.id)
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const currentPeriodVolume = recentTxs?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
    const previousPeriodVolume = previousTxs?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;

    const volumeTrend = previousPeriodVolume > 0
      ? ((currentPeriodVolume - previousPeriodVolume) / previousPeriodVolume) * 100
      : 0;

    const avgTransactionSize = partner.transaction_count > 0
      ? partner.total_volume / partner.transaction_count
      : 0;

    const stats = {
      total_volume: parseFloat(partner.total_volume),
      monthly_volume: parseFloat(partner.monthly_volume),
      transaction_count: partner.transaction_count,
      fees_earned: parseFloat(partner.total_partner_share),
      avg_transaction_size: avgTransactionSize,
      volume_trend: volumeTrend,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
