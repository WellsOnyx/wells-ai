/**
 * Sell GRAIN API
 * POST: Sell GRAIN for USD
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sellGrain, getAccountByEmail, getAccount } from '@/lib/grain-vault/payments';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, accountId, grainAmount } = body;

    // Validation
    if (!grainAmount || grainAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid GRAIN amount is required' },
        { status: 400 }
      );
    }

    // Get account
    let account;
    if (accountId) {
      account = await getAccount(accountId);
    } else if (email) {
      account = await getAccountByEmail(email);
    }

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Check balance
    if (account.grainBalance < grainAmount) {
      return NextResponse.json(
        { error: `Insufficient GRAIN balance. Available: ${account.grainBalance.toFixed(6)} GRAIN` },
        { status: 400 }
      );
    }

    // Sell GRAIN
    const result = await sellGrain(account.id, grainAmount);

    return NextResponse.json({
      success: true,
      sale: {
        ...result,
        newUsdBalance: account.usdBalance + result.netAmount,
        newGrainBalance: account.grainBalance - grainAmount,
      },
    });
  } catch (error: any) {
    console.error('Sell GRAIN error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sell GRAIN' },
      { status: 500 }
    );
  }
}
