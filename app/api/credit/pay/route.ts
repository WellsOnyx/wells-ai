/**
 * Credit Payment API
 * POST /api/credit/pay - Make payment on credit line
 */

import { NextRequest, NextResponse } from 'next/server';
import { makePayment } from '@/lib/underwriting/decision';

export async function POST(req: NextRequest) {
  try {
    const { creditLineId, amount, paymentMethod, sourceAccountId } = await req.json();

    if (!creditLineId || !amount) {
      return NextResponse.json(
        { error: 'Credit line ID and amount required' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    // Process payment
    const result = await makePayment(
      creditLineId,
      amount,
      paymentMethod || 'ach',
      sourceAccountId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: result.paymentId,
        amount: result.amount,
        principalAmount: result.principalAmount,
        interestAmount: result.interestAmount,
        newAvailableCredit: result.newAvailableCredit,
        processedAt: result.processedAt,
      },
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}
