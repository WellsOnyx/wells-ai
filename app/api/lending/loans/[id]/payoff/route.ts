// @ts-nocheck
/**
 * Payoff Quote API
 * GET /api/lending/loans/[id]/payoff - Get payoff quote
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePayoffStatement } from '@/lib/lending/servicing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const payoffDateStr = searchParams.get('payoffDate');

    // Get loan details
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select('*')
      .eq('id', id)
      .single();

    if (loanError || !loan) {
      return NextResponse.json(
        {
          success: false,
          error: 'Loan not found',
        },
        { status: 404 }
      );
    }

    const payoffDate = payoffDateStr ? new Date(payoffDateStr) : new Date();
    const lastPaymentDate = loan.last_payment_date
      ? new Date(loan.last_payment_date)
      : new Date(loan.origination_date);

    // Generate payoff statement
    const payoffStatement = generatePayoffStatement(
      parseFloat(loan.current_balance),
      parseFloat(loan.interest_rate),
      lastPaymentDate,
      payoffDate
    );

    return NextResponse.json({
      success: true,
      payoff: {
        loanNumber: loan.loan_number,
        ...payoffStatement,
        note: 'This payoff quote is valid through the good-through date. Per diem interest will accrue daily thereafter.',
      },
    });
  } catch (error) {
    console.error('Error generating payoff quote:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate payoff quote',
      },
      { status: 500 }
    );
  }
}
