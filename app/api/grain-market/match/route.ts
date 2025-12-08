// @ts-nocheck
import { NextResponse } from 'next/server';
import { findBackersForLoan, acceptBacking } from '@/lib/lending/grain-market';

/**
 * POST /api/grain-market/match
 * Find available backers for a loan
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      loan_id,
      grain_needed,
      loan_type,
      loan_amount,
      term_months,
      ltv,
      borrower_id,
      action,
    } = body;

    if (action === 'find') {
      // Find available backers
      if (!grain_needed || !loan_type || !loan_amount || !term_months) {
        return NextResponse.json(
          { success: false, error: 'Missing required loan parameters' },
          { status: 400 }
        );
      }

      const result = await findBackersForLoan({
        loan_id,
        grain_needed: parseFloat(grain_needed),
        loan_type,
        loan_amount: parseFloat(loan_amount),
        term_months: parseInt(term_months),
        ltv: parseFloat(ltv || 50),
        borrower_id,
      });

      return NextResponse.json(result);
    } else if (action === 'accept') {
      // Accept a specific backer
      const {
        lender_pool_id,
        borrower_email,
        grain_backed,
        secondary_lock_id,
      } = body;

      if (!loan_id || !lender_pool_id || !borrower_id || !borrower_email) {
        return NextResponse.json(
          { success: false, error: 'Missing required parameters' },
          { status: 400 }
        );
      }

      const result = await acceptBacking({
        loan_id,
        lender_pool_id,
        borrower_id,
        borrower_email,
        grain_backed: parseFloat(grain_backed || grain_needed),
        term_months: parseInt(term_months),
        secondary_lock_id,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        match: result.match,
        status: result.status,
        message:
          result.status === 'active'
            ? 'Backing accepted and activated'
            : 'Backing request sent, pending lender approval',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing match:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
