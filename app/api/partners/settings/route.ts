// @ts-nocheck
/**
 * PATCH /api/partners/settings
 * Update partner settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const allowedFields = ['contact_name', 'contact_email', 'contact_phone', 'webhook_url'];
    const updates: any = { updated_at: new Date().toISOString() };

    // Only allow updating specific fields
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: updatedPartner, error } = await supabase
      .from('white_label_partners')
      .update(updates)
      .eq('id', partner.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      partner: updatedPartner,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
