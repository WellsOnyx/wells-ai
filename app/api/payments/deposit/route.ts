/**
 * DEPOSIT API ROUTE
 *
 * Creates payment intents for deposits via Stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import PaymentService from '@/lib/payments/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, method } = body;

    // TODO: Get userId from session/auth
    const userId = 'demo-user'; // Replace with actual auth

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: 'Minimum deposit is $1.00' },
        { status: 400 }
      );
    }

    if (!['card', 'ach'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    const result = await PaymentService.deposit({
      userId,
      amount,
      method,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create deposit' },
      { status: 500 }
    );
  }
}
