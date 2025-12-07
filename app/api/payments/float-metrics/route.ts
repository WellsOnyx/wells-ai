/**
 * FLOAT METRICS API ROUTE
 *
 * Returns user's float earnings and projections
 */

import { NextRequest, NextResponse } from 'next/server';
import PaymentService from '@/lib/payments/service';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get userId from session/auth
    const userId = 'demo-user'; // Replace with actual auth

    const metrics = await PaymentService.getUserFloatMetrics(userId);

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('Float metrics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get float metrics' },
      { status: 500 }
    );
  }
}
