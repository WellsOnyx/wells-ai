/**
 * Create Deposit Session API
 * POST: Create deposit session via Circle on-ramp
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createDepositSession, getAccountByEmail, getAccount } from '@/lib/grain-vault/circle-payments';

export async function POST(req: NextRequest) {
  try {
    // Auth is optional for demo mode
    let userId = null;
    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch (e) {
      // Continue without auth for demo
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

    if (amount < 10) {
      return NextResponse.json(
        { error: 'Minimum deposit is $10' },
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

    // Create deposit session
    const session = await createDepositSession(account.id, amount);

    return NextResponse.json({
      success: true,
      deposit: session,
    });
  } catch (error: any) {
    console.error('Create deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create deposit session' },
      { status: 500 }
    );
  }
}
