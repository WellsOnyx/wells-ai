/**
 * FLOAT METRICS API ROUTE
 *
 * Returns user's float earnings and projections
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
