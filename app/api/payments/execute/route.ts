/**
 * Execute Payment API
 *
 * Executes authorized payments via Wells Payments (Circle integration)
 * Called after user authorizes a payment in the chat UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getAccountByClerkId,
  transfer,
  transferByEmail,
  createDeposit,
  requestWithdrawal,
  createEscrow,
  releaseEscrow,
} from '@/lib/wells-payments';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    // Get user's account
    const account = await getAccountByClerkId(userId);
    if (!account) {
      return NextResponse.json(
        { error: 'No Wells account found. Please complete onboarding.' },
        { status: 400 }
      );
    }

    switch (action) {
      // ================================================================
      // TRANSFER - Send GRAIN to another user
      // ================================================================
      case 'transfer': {
        const { recipient, amount, memo } = params;

        if (!recipient || !amount) {
          return NextResponse.json(
            { error: 'Missing recipient or amount' },
            { status: 400 }
          );
        }

        // Check if recipient is email or account ID
        const isEmail = recipient.includes('@');

        const result = isEmail
          ? await transferByEmail(account.id, recipient, amount, memo)
          : await transfer(account.id, recipient, amount, memo);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          transferId: result.transferId,
          message: `Successfully sent ${amount.toLocaleString()} GRAIN to ${recipient}`,
        });
      }

      // ================================================================
      // DEPOSIT - Create deposit session (redirect to Circle)
      // ================================================================
      case 'deposit': {
        const { amount, method = 'card' } = params;

        if (!amount || amount <= 0) {
          return NextResponse.json(
            { error: 'Invalid deposit amount' },
            { status: 400 }
          );
        }

        const result = await createDeposit(account.id, amount, method);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          sessionId: result.sessionId,
          depositUrl: result.depositUrl,
          message: `Deposit session created. Redirecting to payment...`,
        });
      }

      // ================================================================
      // WITHDRAW - Request withdrawal to bank
      // ================================================================
      case 'withdraw': {
        const { amount, bankDetails } = params;

        if (!amount || !bankDetails) {
          return NextResponse.json(
            { error: 'Missing amount or bank details' },
            { status: 400 }
          );
        }

        const result = await requestWithdrawal(account.id, amount, bankDetails);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          withdrawalId: result.withdrawalId,
          estimatedArrival: result.estimatedArrival,
          message: `Withdrawal of ${amount.toLocaleString()} GRAIN initiated. Expected arrival: ${result.estimatedArrival?.toLocaleDateString()}`,
        });
      }

      // ================================================================
      // ESCROW - Create escrow for a deal
      // ================================================================
      case 'escrow_create': {
        const { dealId, sellerAccountId, amount, feeRate } = params;

        if (!dealId || !sellerAccountId || !amount) {
          return NextResponse.json(
            { error: 'Missing deal parameters' },
            { status: 400 }
          );
        }

        const result = await createEscrow(
          dealId,
          account.id,
          sellerAccountId,
          amount,
          feeRate
        );

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          escrowId: result.escrowId,
          message: `Escrow created. ${amount.toLocaleString()} GRAIN held pending delivery.`,
        });
      }

      // ================================================================
      // ESCROW RELEASE - Release funds to seller
      // ================================================================
      case 'escrow_release': {
        const { escrowId } = params;

        if (!escrowId) {
          return NextResponse.json(
            { error: 'Missing escrow ID' },
            { status: 400 }
          );
        }

        const result = await releaseEscrow(escrowId);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: 'Escrow released. Seller has been paid.',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Payment execution error:', error);
    return NextResponse.json(
      { error: 'Payment failed' },
      { status: 500 }
    );
  }
}
