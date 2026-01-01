/**
 * BALANCE API ROUTE
 *
 * Returns user's complete balance across all payment rails
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import PaymentService from '@/lib/payments/service';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const balance = await PaymentService.getBalance(userId);

    return NextResponse.json(balance);
  } catch (error: any) {
    console.error('Balance error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get balance' },
      { status: 500 }
    );
  }
}
