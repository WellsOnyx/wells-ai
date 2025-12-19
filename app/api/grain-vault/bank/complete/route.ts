/**
 * Complete Bank Link API
 * POST: Complete bank linking after Stripe flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { completeBankLink, getAccountByEmail } from '@/lib/grain-vault/payments';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, accountId, setupIntentId } = body;

    if (!setupIntentId) {
      return NextResponse.json(
        { error: 'setupIntentId is required' },
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

    // Complete bank link
    const linkedBank = await completeBankLink(account.id, setupIntentId);

    return NextResponse.json({
      success: true,
      bank: linkedBank,
    });
  } catch (error: any) {
    console.error('Complete bank link error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete bank link' },
      { status: 500 }
    );
  }
}
