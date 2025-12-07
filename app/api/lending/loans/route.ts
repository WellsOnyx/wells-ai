// @ts-nocheck
/**
 * Loans API
 * GET /api/lending/loans - Get user's active loans
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status') || 'active';

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email parameter is required',
        },
        { status: 400 }
      );
    }

    // Get borrower profile
    const { data: borrower, error: borrowerError } = await supabase
      .from('borrower_profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (borrowerError || !borrower) {
      return NextResponse.json({
        success: true,
        loans: [],
      });
    }

    // Get loans
    const query = supabase
      .from('loans')
      .select(
        `
        *,
        product:loan_products(*),
        borrower:borrower_profiles(first_name, last_name, email)
      `
      )
      .eq('borrower_id', borrower.id);

    if (status) {
      query.eq('status', status);
    }

    const { data: loans, error: loansError } = await query.order('origination_date', {
      ascending: false,
    });

    if (loansError) {
      throw loansError;
    }

    // Calculate additional info for each loan
    const loansWithDetails = loans.map(loan => ({
      ...loan,
      percentPaid: ((loan.original_amount - loan.current_balance) / loan.original_amount) * 100,
      monthsRemaining: loan.remaining_months,
      nextPaymentDue: loan.next_payment_date,
      isDelinquent: loan.days_delinquent > 0,
    }));

    return NextResponse.json({
      success: true,
      loans: loansWithDetails,
      summary: {
        totalLoans: loans.length,
        totalBalance: loans.reduce((sum, loan) => sum + parseFloat(loan.current_balance), 0),
        totalMonthlyPayment: loans.reduce((sum, loan) => sum + parseFloat(loan.monthly_payment), 0),
      },
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch loans',
      },
      { status: 500 }
    );
  }
}
