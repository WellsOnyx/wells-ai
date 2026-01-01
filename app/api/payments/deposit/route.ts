/**
 * DEPOSIT API ROUTE
 *
 * Creates payment intents for deposits via Stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import PaymentService from '@/lib/payments/service';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { amount, method } = body;

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
