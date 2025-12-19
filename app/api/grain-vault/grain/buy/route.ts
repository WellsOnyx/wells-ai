/**
 * Buy GRAIN API
 * POST: Buy GRAIN with USD balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buyGrain, getAccountByEmail, getAccount } from '@/lib/grain-vault/payments';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, accountId, amount } = body;

    // Validation
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    if (amount < 1) {
      return NextResponse.json(
        { error: 'Minimum purchase is $1' },
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
    if (account.usdBalance < amount) {
      return NextResponse.json(
        { error: `Insufficient USD balance. Available: $${account.usdBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Buy GRAIN
    const result = await buyGrain(account.id, amount);

    return NextResponse.json({
      success: true,
      purchase: {
        ...result,
        newUsdBalance: account.usdBalance - amount,
        newGrainBalance: account.grainBalance + result.grainAmount,
      },
    });
  } catch (error: any) {
    console.error('Buy GRAIN error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to buy GRAIN' },
      { status: 500 }
    );
  }
}
