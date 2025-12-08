// @ts-nocheck
import { NextResponse } from 'next/server';
import { processLenderEarnings, releaseLenderCollateral } from '@/lib/lending/grain-market';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/grain-market/loans/[loanId]/backing
 * Get backing details for a loan
 */
export async function GET(
  request: Request,
  { params }: { params: { loanId: string } }
) {
  try {
    // Get all matches for this loan
    const { data: matches, error: matchError } = await supabase
      .from('grain_lending_matches')
      .select(`
        *,
        grain_lending_pool (
          lender_name,
          lender_email,
          annual_rate
        )
      `)
      .eq('loan_id', params.loanId);

    if (matchError) throw matchError;

    // Get collateral locks for this loan
    const { data: locks, error: locksError } = await supabase
      .from('grain_collateral_locks')
      .select('*')
      .eq('loan_id', params.loanId);

    if (locksError) throw locksError;

    // Calculate totals
    const totalBacked = matches?.reduce(
      (sum, m) => sum + parseFloat(m.grain_backed),
      0
    ) || 0;

    const totalEarningsPaid = matches?.reduce(
      (sum, m) => sum + parseFloat(m.total_earnings_paid),
      0
    ) || 0;

    return NextResponse.json({
      success: true,
      matches: matches || [],
      locks: locks || [],
      summary: {
        total_backed: totalBacked,
        total_earnings_paid: totalEarningsPaid,
        active_backers: matches?.filter(m => m.status === 'active').length || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching backing details:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grain-market/loans/[loanId]/backing
 * Process loan payment or release collateral
 */
export async function POST(
  request: Request,
  { params }: { params: { loanId: string } }
) {
  try {
    const body = await request.json();
    const { action, payment_amount, payment_date } = body;

    if (action === 'payment') {
      // Process a loan payment and distribute earnings
      if (!payment_amount || payment_amount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Valid payment amount is required' },
          { status: 400 }
        );
      }

      const result = await processLenderEarnings({
        loan_id: params.loanId,
        payment_amount: parseFloat(payment_amount),
        payment_date: payment_date ? new Date(payment_date) : undefined,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        earnings: result.earnings,
        message: 'Lender earnings processed successfully',
      });
    } else if (action === 'release') {
      // Release all collateral (loan paid off)
      const result = await releaseLenderCollateral(params.loanId);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        matches: result.matches,
        message: 'Lender collateral released successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing backing action:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
