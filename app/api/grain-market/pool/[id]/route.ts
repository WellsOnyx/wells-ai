// @ts-nocheck
import { NextResponse } from 'next/server';
import { updatePoolStatus, withdrawFromPool } from '@/lib/lending/grain-market';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/grain-market/pool/[id]
 * Get pool details
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data: pool, error } = await supabase
      .from('grain_lending_pool')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Get active matches for this pool
    const { data: matches, error: matchesError } = await supabase
      .from('grain_lending_matches')
      .select('*')
      .eq('lender_pool_id', params.id)
      .eq('status', 'active');

    if (matchesError) throw matchesError;

    return NextResponse.json({
      success: true,
      pool,
      active_matches: matches || [],
    });
  } catch (error) {
    console.error('Error fetching pool:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/grain-market/pool/[id]
 * Update pool status
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { lender_id, status } = body;

    if (!lender_id) {
      return NextResponse.json(
        { success: false, error: 'Lender ID is required' },
        { status: 400 }
      );
    }

    if (!status || !['active', 'paused', 'closed'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Valid status is required' },
        { status: 400 }
      );
    }

    const result = await updatePoolStatus(params.id, lender_id, status);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pool: result.pool,
      message: `Pool status updated to ${status}`,
    });
  } catch (error) {
    console.error('Error updating pool:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/grain-market/pool/[id]
 * Withdraw GRAIN from pool
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const lender_id = searchParams.get('lender_id');
    const amount = searchParams.get('amount');

    if (!lender_id) {
      return NextResponse.json(
        { success: false, error: 'Lender ID is required' },
        { status: 400 }
      );
    }

    const result = await withdrawFromPool(
      params.id,
      lender_id,
      amount ? parseFloat(amount) : undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pool: result.pool,
      withdrawn: result.withdrawn,
      message: `Successfully withdrew ${result.withdrawn} GRAIN`,
    });
  } catch (error) {
    console.error('Error withdrawing from pool:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
