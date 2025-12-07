/**
 * Credit Draw API
 * POST /api/credit/draw - Draw funds from credit line
 * GET /api/credit/draw - Get available credit info
 */

import { NextRequest, NextResponse } from 'next/server';
import { drawOnCredit, getCreditLine } from '@/lib/underwriting/decision';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const creditLine = await getCreditLine(userId);

    if (!creditLine) {
      return NextResponse.json({ error: 'No active credit line found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      creditLine: {
        id: creditLine.id,
        creditLimit: creditLine.creditLimit,
        availableCredit: creditLine.availableCredit,
        usedCredit: creditLine.creditLimit - creditLine.availableCredit,
        apr: creditLine.apr,
        status: creditLine.status,
      },
    });
  } catch (error) {
    console.error('Error getting credit line:', error);
    return NextResponse.json({ error: 'Failed to get credit line' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { creditLineId, amount, purpose, disbursementAccountId } = await req.json();

    if (!creditLineId || !amount) {
      return NextResponse.json(
        { error: 'Credit line ID and amount required' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    // Draw on credit
    const result = await drawOnCredit(creditLineId, amount, purpose, disbursementAccountId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      draw: {
        id: result.drawId,
        amount: result.amount,
        newAvailableCredit: result.newAvailableCredit,
        disbursedAt: result.disbursedAt,
      },
    });
  } catch (error) {
    console.error('Error processing credit draw:', error);
    return NextResponse.json({ error: 'Failed to process credit draw' }, { status: 500 });
  }
}
