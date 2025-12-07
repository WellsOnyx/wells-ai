/**
 * BALANCE API ROUTE
 *
 * Returns user's complete balance across all payment rails
 */

import { NextRequest, NextResponse } from 'next/server';
import PaymentService from '@/lib/payments/service';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get userId from session/auth
    const userId = 'demo-user'; // Replace with actual auth

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
