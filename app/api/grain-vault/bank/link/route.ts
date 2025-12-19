/**
 * Bank Account Linking API
 * POST: Create bank link session
 * GET: Get linked bank accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  createBankLinkSession,
  getLinkedBanks,
  getAccountByEmail,
} from '@/lib/grain-vault/payments';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, accountId } = body;

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

    // Create bank link session
    const session = await createBankLinkSession(account.id);

    return NextResponse.json({
      success: true,
      clientSecret: session.clientSecret,
      setupIntentId: session.setupIntentId,
    });
  } catch (error: any) {
    console.error('Bank link error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create bank link session' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = req.nextUrl.searchParams.get('email');
    const accountId = req.nextUrl.searchParams.get('accountId');

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

    const linkedBanks = await getLinkedBanks(account.id);

    return NextResponse.json({
      success: true,
      banks: linkedBanks,
    });
  } catch (error: any) {
    console.error('Get linked banks error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get linked banks' },
      { status: 500 }
    );
  }
}
