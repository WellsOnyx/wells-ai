// @ts-nocheck
/**
 * GET /api/partners/me
 * Get current partner data (authenticated)
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
      .select(`
        id,
        company_name,
        platform_name,
        domain,
        contact_email,
        contact_name,
        contact_phone,
        industry,
        revenue_share_percent,
        total_volume,
        monthly_volume,
        transaction_count,
        total_fees_collected,
        total_partner_share,
        total_wells_share,
        webhook_url,
        status,
        created_at,
        updated_at
      `)
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (error || !partner) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    return NextResponse.json({ partner });
  } catch (error) {
    console.error('Error fetching partner:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner data' },
      { status: 500 }
    );
  }
}
