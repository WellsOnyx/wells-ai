/**
 * Complete Deposit API
 * POST: Complete deposit after Circle on-ramp success
 */

import { NextRequest, NextResponse } from 'next/server';
import { completeDeposit, cancelDeposit } from '@/lib/grain-vault/circle-payments';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, status } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (status === 'cancelled' || status === 'failed') {
      await cancelDeposit(sessionId);
      return NextResponse.json({
        success: true,
        status: 'cancelled',
      });
    }

    // Complete deposit
    await completeDeposit(sessionId);

    return NextResponse.json({
      success: true,
      status: 'completed',
    });
  } catch (error: any) {
    console.error('Complete deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete deposit' },
      { status: 500 }
    );
  }
}
