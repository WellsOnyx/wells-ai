// @ts-nocheck
/**
 * POST /api/partners/regenerate-key
 * Regenerate API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
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

    // Generate new API key
    const newApiKey = `wl_${crypto.randomBytes(24).toString('hex')}`;
    const newApiKeyHash = crypto.createHash('sha256').update(newApiKey).digest('hex');

    const { error } = await supabase
      .from('white_label_partners')
      .update({
        api_key: newApiKey,
        api_key_hash: newApiKeyHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', partner.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      api_key: newApiKey,
      message: 'API key regenerated successfully. Store this securely - it will not be shown again.',
    });
  } catch (error) {
    console.error('Error regenerating API key:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate API key' },
      { status: 500 }
    );
  }
}
