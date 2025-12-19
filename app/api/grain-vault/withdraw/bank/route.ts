/**
 * Bank Withdrawal API
 * POST: Initiate withdrawal to linked bank account
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { withdrawToBank, getAccountByEmail, getAccount } from '@/lib/grain-vault/payments';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, accountId, bankId, amount } = body;

    // Validation
    if (!bankId) {
      return NextResponse.json(
        { error: 'bankId is required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    if (amount < 10) {
      return NextResponse.json(
        { error: 'Minimum withdrawal is $10' },
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
        { error: `Insufficient balance. Available: $${account.usdBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Initiate withdrawal
    const result = await withdrawToBank(account.id, bankId, amount);

    return NextResponse.json({
      success: true,
      withdrawal: result,
    });
  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate withdrawal' },
      { status: 500 }
    );
  }
}
