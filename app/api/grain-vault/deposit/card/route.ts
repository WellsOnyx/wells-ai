/**
 * Card Deposit API
 * POST: Initiate card deposit (returns client secret for Stripe Elements)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { depositCard, getAccountByEmail } from '@/lib/grain-vault/payments';

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

    if (amount < 10) {
      return NextResponse.json(
        { error: 'Minimum deposit is $10' },
        { status: 400 }
      );
    }

    if (amount > 10000) {
      return NextResponse.json(
        { error: 'Maximum card deposit is $10,000. Use ACH for larger amounts.' },
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

    // Initiate card deposit
    const result = await depositCard(account.id, amount);

    return NextResponse.json({
      success: true,
      deposit: result,
    });
  } catch (error: any) {
    console.error('Card deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate card deposit' },
      { status: 500 }
    );
  }
}
