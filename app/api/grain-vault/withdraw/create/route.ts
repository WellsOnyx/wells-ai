/**
 * Create Withdrawal API
 * POST: Initiate withdrawal to bank via Circle off-ramp
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createWithdrawal, getAccountByEmail, getAccount } from '@/lib/grain-vault/circle-payments';

export async function POST(req: NextRequest) {
  try {
    // Auth required for withdrawals
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, accountId, amount, bankDetails } = body;

    // Validation
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

    if (!bankDetails) {
      return NextResponse.json(
        { error: 'Bank details are required' },
        { status: 400 }
      );
    }

    const { accountNumber, routingNumber, accountType, accountHolderName } = bankDetails;

    if (!accountNumber || !routingNumber || !accountHolderName) {
      return NextResponse.json(
        { error: 'Complete bank details are required (accountNumber, routingNumber, accountHolderName)' },
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

    // Create withdrawal
    const result = await createWithdrawal(account.id, amount, {
      accountNumber,
      routingNumber,
      accountType: accountType || 'checking',
      accountHolderName,
    });

    return NextResponse.json({
      success: true,
      withdrawal: result,
    });
  } catch (error: any) {
    console.error('Create withdrawal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create withdrawal' },
      { status: 500 }
    );
  }
}
