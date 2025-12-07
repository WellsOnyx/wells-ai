// @ts-nocheck
/**
 * Loan Details & Payment API
 * GET /api/lending/loans/[id] - Get loan details and payment schedule
 * POST /api/lending/loans/[id] - Make a payment
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAmortizationSchedule } from '@/lib/lending/amortization';
import { allocatePayment } from '@/lib/lending/servicing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Get loan details
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select(
        `
        *,
        product:loan_products(*),
        borrower:borrower_profiles(first_name, last_name, email, phone)
      `
      )
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

    // Get payment history
    const { data: payments, error: paymentsError } = await supabase
      .from('loan_payments')
      .select('*')
      .eq('loan_id', id)
      .order('payment_number', { ascending: true });

    if (paymentsError) {
      throw paymentsError;
    }

    // Generate or get amortization schedule
    const schedule = generateAmortizationSchedule(
      parseFloat(loan.original_amount),
      parseFloat(loan.interest_rate),
      loan.term_months,
      new Date(loan.first_payment_date)
    );

    // Get escrow info if mortgage
    let escrow = null;
    if (loan.product.product_type === 'mortgage') {
      const { data: escrowData } = await supabase
        .from('loan_escrow')
        .select('*')
        .eq('loan_id', id)
        .single();

      escrow = escrowData;
    }

    // Get collateral if secured loan
    let collateral = null;
    if (loan.product.is_secured) {
      const { data: collateralData } = await supabase
        .from('loan_collateral')
        .select('*')
        .eq('loan_id', id)
        .single();

      collateral = collateralData;
    }

    return NextResponse.json({
      success: true,
      loan: {
        ...loan,
        percentPaid: ((parseFloat(loan.original_amount) - parseFloat(loan.current_balance)) / parseFloat(loan.original_amount)) * 100,
      },
      schedule: {
        summary: schedule.summary,
        upcoming: schedule.schedule.slice(0, 12), // Next 12 payments
        full: schedule.schedule, // Full schedule
      },
      payments,
      escrow,
      collateral,
    });
  } catch (error) {
    console.error('Error fetching loan details:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch loan details',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { amount, paymentMethod, paymentReference } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payment amount',
        },
        { status: 400 }
      );
    }

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

    // Calculate accrued interest since last payment
    const daysSinceLastPayment = loan.last_payment_date
      ? Math.floor(
          (new Date().getTime() - new Date(loan.last_payment_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 30;

    const dailyRate = parseFloat(loan.interest_rate) / 365;
    const accruedInterest = parseFloat(loan.current_balance) * dailyRate * daysSinceLastPayment;

    // Get outstanding late fees
    const { data: unpaidPayments } = await supabase
      .from('loan_payments')
      .select('late_fee')
      .eq('loan_id', id)
      .eq('status', 'late');

    const outstandingLateFees = unpaidPayments
      ? unpaidPayments.reduce((sum, p) => sum + parseFloat(p.late_fee || 0), 0)
      : 0;

    // Allocate payment (waterfall: fees → interest → principal → escrow)
    const allocation = allocatePayment(
      amount,
      outstandingLateFees,
      accruedInterest,
      parseFloat(loan.current_balance),
      0 // escrow if applicable
    );

    // Get next payment number
    const { data: lastPayment } = await supabase
      .from('loan_payments')
      .select('payment_number')
      .eq('loan_id', id)
      .order('payment_number', { ascending: false })
      .limit(1)
      .single();

    const nextPaymentNumber = lastPayment ? lastPayment.payment_number + 1 : 1;

    // Record payment
    const { data: payment, error: paymentError } = await supabase
      .from('loan_payments')
      .insert({
        loan_id: id,
        payment_number: nextPaymentNumber,
        due_date: loan.next_payment_date,
        payment_date: new Date().toISOString().split('T')[0],
        amount_paid: amount,
        principal_paid: allocation.principal,
        interest_paid: allocation.interest,
        fees_paid: allocation.lateFees,
        escrow_paid: allocation.escrow,
        principal_balance_before: loan.current_balance,
        principal_balance_after: allocation.remainingBalance,
        payment_method: paymentMethod || 'ach',
        payment_reference: paymentReference,
        status: 'paid',
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error recording payment:', paymentError);
      throw paymentError;
    }

    // Update loan balance and stats
    const newBalance = allocation.remainingBalance;
    const newTotalPrincipalPaid = parseFloat(loan.total_principal_paid) + allocation.principal;
    const newTotalInterestPaid = parseFloat(loan.total_interest_paid) + allocation.interest;
    const newTotalFeesPaid = parseFloat(loan.total_fees_paid) + allocation.lateFees;

    // Calculate new next payment date
    const nextPaymentDate = new Date(loan.next_payment_date);
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    const { error: updateError } = await supabase
      .from('loans')
      .update({
        current_balance: newBalance,
        last_payment_date: new Date().toISOString().split('T')[0],
        next_payment_date: nextPaymentDate.toISOString().split('T')[0],
        total_principal_paid: newTotalPrincipalPaid,
        total_interest_paid: newTotalInterestPaid,
        total_fees_paid: newTotalFeesPaid,
        days_delinquent: 0,
        remaining_months: Math.max(0, loan.remaining_months - 1),
        status: newBalance <= 0 ? 'paid_off' : 'active',
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating loan:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount: amount,
        allocation,
        remainingBalance: newBalance,
        paidOff: newBalance <= 0,
      },
      message: newBalance <= 0 ? 'Congratulations! Your loan is paid off!' : 'Payment processed successfully',
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process payment',
      },
      { status: 500 }
    );
  }
}
