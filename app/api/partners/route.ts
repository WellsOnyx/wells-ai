// @ts-nocheck
/**
 * White-Label Partner API
 *
 * POST /api/partners - Create new partner
 * GET /api/partners - List partners (admin)
 *
 * Other platforms embed Wells treasury - their volume = our volume
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

// Create new white-label partner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_name,
      platform_name,
      domain,
      contact_email,
      contact_name,
      contact_phone,
      industry,
      webhook_url,
      estimated_monthly_volume,
      use_case,
      revenue_share_percent = 20 // Default 20% to partner
    } = body;

    if (!company_name || !platform_name || !domain) {
      return NextResponse.json(
        { error: 'company_name, platform_name, and domain are required' },
        { status: 400 }
      );
    }

    // Generate API credentials
    const apiKey = `wl_${crypto.randomBytes(24).toString('hex')}`;
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Create partner
    const { data: partner, error } = await supabase
      .from('white_label_partners')
      .insert({
        company_name,
        platform_name,
        domain,
        contact_email,
        contact_name,
        contact_phone,
        industry,
        api_key: apiKey,
        api_key_hash: apiKeyHash,
        webhook_url,
        webhook_secret: webhookSecret,
        revenue_share_percent,
        estimated_monthly_volume,
        use_case,
        total_volume: 0,
        monthly_volume: 0,
        transaction_count: 0,
        total_fees_collected: 0,
        total_partner_share: 0,
        total_wells_share: 0,
        status: 'active'
      })
      .select('id, company_name, platform_name, domain, revenue_share_percent, status, created_at')
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Domain already registered' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      partner: {
        ...partner,
        // Only return API key once, at creation
        api_key: apiKey,
        webhook_secret: webhookSecret
      },
      integration: {
        base_url: 'https://api.wellsonyx.io/v1',
        docs_url: 'https://docs.wellsonyx.io/partners',
        endpoints: {
          create_transaction: 'POST /v1/transactions',
          get_transaction: 'GET /v1/transactions/:id',
          create_wallet: 'POST /v1/wallets',
          get_balance: 'GET /v1/wallets/:id/balance'
        }
      }
    });
  } catch (error) {
    console.error('Error creating partner:', error);
    return NextResponse.json(
      { error: 'Failed to create partner' },
      { status: 500 }
    );
  }
}

// List partners (admin only)
export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('white_label_partners')
      .select(`
        id,
        company_name,
        platform_name,
        domain,
        revenue_share_percent,
        total_volume,
        monthly_volume,
        transaction_count,
        total_fees_collected,
        total_partner_share,
        total_wells_share,
        status,
        created_at
      `)
      .order('total_volume', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: partners, error } = await query;

    if (error) throw error;

    // Calculate totals
    const totals = partners?.reduce(
      (acc, p) => ({
        total_volume: acc.total_volume + (p.total_volume || 0),
        total_fees: acc.total_fees + (p.total_fees_collected || 0),
        total_transactions: acc.total_transactions + (p.transaction_count || 0)
      }),
      { total_volume: 0, total_fees: 0, total_transactions: 0 }
    );

    return NextResponse.json({
      partners,
      totals,
      count: partners?.length || 0
    });
  } catch (error) {
    console.error('Error listing partners:', error);
    return NextResponse.json(
      { error: 'Failed to list partners' },
      { status: 500 }
    );
  }
}
