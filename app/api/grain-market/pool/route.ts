// @ts-nocheck
import { NextResponse } from 'next/server';
import { listGrainForLending } from '@/lib/lending/grain-market';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/grain-market/pool
 * List all active lending pools
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const lender_id = searchParams.get('lender_id');
    const min_amount = searchParams.get('min_amount');
    const loan_type = searchParams.get('loan_type');

    let query = supabase
      .from('grain_lending_pool')
      .select('*')
      .order('annual_rate', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (lender_id) {
      query = query.eq('lender_id', lender_id);
    }

    if (min_amount) {
      query = query.gte('grain_available', parseFloat(min_amount));
    }

    if (loan_type) {
      query = query.contains('accepted_loan_types', [loan_type]);
    }

    const { data: pools, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      pools: pools || [],
      count: pools?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching lending pools:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grain-market/pool
 * Create a new lending pool
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      lender_id,
      lender_email,
      lender_name,
      grain_amount,
      annual_rate,
      min_loan_amount,
      max_loan_amount,
      min_term_months,
      max_term_months,
      accepted_loan_types,
      max_ltv,
      auto_approve,
    } = body;

    // Validation
    if (!lender_id || !lender_email) {
      return NextResponse.json(
        { success: false, error: 'Lender ID and email are required' },
        { status: 400 }
      );
    }

    if (!grain_amount || grain_amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid GRAIN amount is required' },
        { status: 400 }
      );
    }

    if (!annual_rate || annual_rate < 0 || annual_rate > 100) {
      return NextResponse.json(
        { success: false, error: 'Annual rate must be between 0 and 100' },
        { status: 400 }
      );
    }

    const result = await listGrainForLending({
      lender_id,
      lender_email,
      lender_name,
      grain_amount: parseFloat(grain_amount),
      annual_rate: parseFloat(annual_rate),
      min_loan_amount: min_loan_amount ? parseFloat(min_loan_amount) : undefined,
      max_loan_amount: max_loan_amount ? parseFloat(max_loan_amount) : undefined,
      min_term_months: min_term_months ? parseInt(min_term_months) : undefined,
      max_term_months: max_term_months ? parseInt(max_term_months) : undefined,
      accepted_loan_types,
      max_ltv: max_ltv ? parseFloat(max_ltv) : undefined,
      auto_approve: auto_approve === true,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pool: result.pool,
      message: 'GRAIN successfully listed for lending',
    });
  } catch (error) {
    console.error('Error creating lending pool:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
