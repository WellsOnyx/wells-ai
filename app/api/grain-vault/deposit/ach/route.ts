/**
 * ACH Deposit API
 * POST: Initiate ACH deposit from linked bank account
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { depositACH, getAccountByEmail } from '@/lib/grain-vault/payments';

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
        { error: 'Minimum deposit is $10' },
        { status: 400 }
      );
    }

    // Get account
    let account;
    if (accountId) {
      const { getAccount } = await import('@/lib/grain-vault/payments');
      account = await getAccount(accountId);
    } else if (email) {
      account = await getAccountByEmail(email);
    }

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Initiate ACH deposit
    const result = await depositACH(account.id, bankId, amount);

    return NextResponse.json({
      success: true,
      deposit: result,
    });
  } catch (error: any) {
    console.error('ACH deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate ACH deposit' },
      { status: 500 }
    );
  }
}
