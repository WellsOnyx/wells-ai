// @ts-nocheck
/**
 * Underwriting Decision API
 * GET /api/lending/decision/[applicationId] - Get underwriting decision
 * POST /api/lending/decision/[applicationId] - Run underwriting or accept/decline offer
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { underwriteLoan } from '@/lib/lending/underwriting';
import { calculateMonthlyPayment } from '@/lib/lending/underwriting';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  try {
    const { applicationId } = params;

    // Get existing decision
    const { data: decision, error } = await supabase
      .from('loan_underwriting_decisions')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!decision) {
      return NextResponse.json(
        {
          success: false,
          error: 'No decision found for this application',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      decision,
    });
  } catch (error) {
    console.error('Error fetching decision:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch decision',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  try {
    const { applicationId } = params;
    const body = await request.json();
    const { action } = body; // 'underwrite', 'accept', 'decline'

    // Get application with borrower and product info
    const { data: application, error: appError } = await supabase
      .from('loan_applications')
      .select(
        `
        *,
        borrower:borrower_profiles(*),
        product:loan_products(*)
      `
      )
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        {
          success: false,
          error: 'Application not found',
        },
        { status: 404 }
      );
    }

    if (action === 'underwrite') {
      // Run automated underwriting
      const yearsAtJob =
        (new Date().getTime() - new Date(application.borrower.employment_start_date).getTime()) /
        (1000 * 60 * 60 * 24 * 365);

      const underwritingInput = {
        creditScore: application.borrower.credit_score || 680, // Default if not available
        annualIncome: application.borrower.annual_income,
        additionalIncome: application.borrower.additional_income || 0,
        monthlyHousingPayment: application.borrower.monthly_housing_payment,
        monthlyDebtPayments: application.borrower.monthly_debt_payments,
        employmentType: application.borrower.employment_type,
        yearsAtJob,
        productCode: application.product.product_code,
        requestedAmount: application.requested_amount,
        downPayment: application.down_payment,
        propertyValue: application.property_value,
        vehicleValue: application.vehicle_value,
        grainStaked: application.borrower.grain_staked,
        liquidAssets: application.borrower.total_assets,
        totalAssets: application.borrower.total_assets,
      };

      const decision = await underwriteLoan(underwritingInput);

      // Save decision to database
      const { data: savedDecision, error: decisionError } = await supabase
        .from('loan_underwriting_decisions')
        .insert({
          application_id: applicationId,
          decision: decision.decision,
          decision_date: new Date().toISOString(),
          underwriter: 'AUTOMATED',
          approved_amount: decision.approvedAmount,
          approved_rate: decision.approvedRate,
          approved_term_months: decision.termMonths,
          monthly_payment: decision.monthlyPayment,
          apr: decision.apr,
          base_rate: decision.baseRate,
          credit_adjustment: decision.creditAdjustment,
          grain_discount: decision.grainDiscount,
          credit_score: underwritingInput.creditScore,
          dti_ratio: decision.dti,
          ltv_ratio: decision.ltv,
          conditions: decision.conditions,
          stipulations: decision.stipulations,
          decline_reasons: decision.declineReasons,
          risk_grade: decision.riskGrade,
          risk_score: decision.riskScore,
          risk_factors: decision.riskFactors,
        })
        .select()
        .single();

      if (decisionError) {
        console.error('Error saving decision:', decisionError);
        throw decisionError;
      }

      // Update application status
      await supabase
        .from('loan_applications')
        .update({
          status: decision.decision === 'approved' ? 'approved' : decision.decision,
          reviewed_at: new Date().toISOString(),
          decision_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      return NextResponse.json({
        success: true,
        decision: savedDecision,
      });
    } else if (action === 'accept') {
      // Borrower accepts the loan offer - create loan
      const { data: decision } = await supabase
        .from('loan_underwriting_decisions')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!decision || decision.decision !== 'approved') {
        return NextResponse.json(
          {
            success: false,
            error: 'No approved offer to accept',
          },
          { status: 400 }
        );
      }

      // Generate loan number
      const loanNumber = `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Calculate dates
      const originationDate = new Date();
      const firstPaymentDate = new Date(originationDate);
      firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
      firstPaymentDate.setDate(1);

      const maturityDate = new Date(originationDate);
      maturityDate.setMonth(maturityDate.getMonth() + decision.approved_term_months);

      // Create loan
      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .insert({
          loan_number: loanNumber,
          application_id: applicationId,
          borrower_id: application.borrower_id,
          product_id: application.product_id,
          original_amount: decision.approved_amount,
          current_balance: decision.approved_amount,
          interest_rate: decision.approved_rate,
          apr: decision.apr,
          term_months: decision.approved_term_months,
          remaining_months: decision.approved_term_months,
          monthly_payment: decision.monthly_payment,
          next_payment_date: firstPaymentDate.toISOString().split('T')[0],
          origination_date: originationDate.toISOString().split('T')[0],
          first_payment_date: firstPaymentDate.toISOString().split('T')[0],
          maturity_date: maturityDate.toISOString().split('T')[0],
          status: 'active',
        })
        .select()
        .single();

      if (loanError) {
        console.error('Error creating loan:', loanError);
        throw loanError;
      }

      // Update application status
      await supabase
        .from('loan_applications')
        .update({
          status: 'funded',
        })
        .eq('id', applicationId);

      return NextResponse.json({
        success: true,
        loan: {
          id: loan.id,
          loanNumber: loan.loan_number,
          amount: loan.original_amount,
          monthlyPayment: loan.monthly_payment,
          firstPaymentDate: loan.first_payment_date,
        },
        message: 'Loan created successfully!',
      });
    } else if (action === 'decline') {
      // Borrower declines the offer
      await supabase
        .from('loan_applications')
        .update({
          status: 'declined',
        })
        .eq('id', applicationId);

      return NextResponse.json({
        success: true,
        message: 'Offer declined',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing decision:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process decision',
      },
      { status: 500 }
    );
  }
}
