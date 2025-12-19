/**
 * Create Account API
 * POST: Create new Grain & Vault account with Circle wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAccount } from '@/lib/grain-vault/circle-payments';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, fullName, dateOfBirth, phone } = body;

    // Validation
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }

    // Create account
    const account = await createAccount({
      email,
      fullName,
      dateOfBirth,
      phone,
    });

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        email: account.email,
        fullName: account.fullName,
        walletAddress: account.walletAddress,
        verificationLevel: account.verificationLevel,
        status: account.status,
      },
    });
  } catch (error: any) {
    console.error('Create account error:', error);

    // Check for duplicate email
    if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}
