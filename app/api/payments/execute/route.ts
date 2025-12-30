/**
 * Execute Payment API
 *
 * Executes authorized payments via GRAIN rail (primary) with USDC/USD fallback.
 * Called after user authorizes a payment in the chat UI.
 *
 * This endpoint is the bridge from the old payment system to the new GRAIN-first system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimit, RateLimitType } from '@/lib/security/rate-limiter';
import { grainRail, PaymentRequest, TransactionType } from '@/lib/payments/grain-rail';
import { unifiedUser } from '@/lib/identity/unified-user';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    // SECURITY FIX: Apply rate limiting based on action type
    let rateLimitType: RateLimitType = 'general';
    if (action === 'deposit') {
      rateLimitType = 'deposit';
    } else if (action === 'withdraw') {
      rateLimitType = 'withdrawal';
    }

    const rateLimitResult = await rateLimit(request, rateLimitType);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // Get user's unified identity
    const user = await unifiedUser.get(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'No account found. Please complete onboarding.' },
        { status: 400 }
      );
    }

    switch (action) {
      // ================================================================
      // TRANSFER - Send GRAIN to another user (primary payment action)
      // ================================================================
      case 'transfer': {
        const { recipient, amount, memo, currency = 'USD' } = params;

        if (!recipient || !amount) {
          return NextResponse.json(
            { error: 'Missing recipient or amount' },
            { status: 400 }
          );
        }

        // Resolve recipient
        const isEmail = recipient.includes('@');
        let recipientId: string | undefined;

        if (isEmail) {
          const recipientUser = await unifiedUser.findByEmail(recipient);
          if (recipientUser) {
            recipientId = recipientUser.unifiedId;
          } else {
            // Create account for new recipient
            const newRecipient = await unifiedUser.createOrLink({
              email: recipient,
              source: 'grainvault',
            });
            recipientId = newRecipient.unifiedId;
          }
        } else {
          recipientId = recipient;
        }

        // Build payment request
        const paymentRequest: PaymentRequest = {
          fromUserId: user.unifiedId,
          toUserId: recipientId,
          amount,
          currency: currency as 'USD' | 'GRAIN',
          type: 'transfer',
          memo,
          allowCreditLine: true,
          allowConversion: true,
        };

        // Route and execute
        const route = await grainRail.route(paymentRequest);

        if (!route.canExecute) {
          return NextResponse.json({
            success: false,
            needsFunding: true,
            route: {
              rail: route.rail,
              method: route.method,
              grainNeeded: route.grainAmount,
              usdNeeded: route.usdAmount,
              reason: route.reason,
            },
            profile: {
              grainBalance: user.grainBalance,
              creditAvailable: user.creditAvailable,
            },
          }, { status: 402 });
        }

        const result = await grainRail.pay(paymentRequest);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          transactionId: result.transactionId,
          rail: result.rail,
          method: result.method,
          executed: {
            amount: result.executedAmount,
            currency: result.executedCurrency,
            fee: result.feeAmount,
          },
          recipient: {
            receives: result.recipientReceives,
            currency: result.recipientCurrency,
          },
          message: `Successfully sent ${result.recipientReceives.toLocaleString()} ${result.recipientCurrency} to ${recipient}`,
        });
      }

      // ================================================================
      // DEPOSIT - Handled via separate deposit flow (redirect to Circle/Stripe)
      // ================================================================
      case 'deposit': {
        const { amount } = params;

        if (!amount || amount <= 0) {
          return NextResponse.json(
            { error: 'Invalid deposit amount' },
            { status: 400 }
          );
        }

        // Get current GRAIN price
        const { price } = await grainRail.getPrice();
        const grainToReceive = amount / price;

        // Return deposit instructions (actual deposit handled by /api/grain/deposit)
        return NextResponse.json({
          success: true,
          depositInfo: {
            usdAmount: amount,
            grainToReceive,
            grainPrice: price,
            redirectUrl: `/deposit?amount=${amount}`,
          },
          message: `Deposit $${amount.toFixed(2)} to receive ~${grainToReceive.toFixed(2)} GRAIN at $${price.toFixed(4)}/GRAIN`,
        });
      }

      // ================================================================
      // WITHDRAW - Request withdrawal to bank
      // ================================================================
      case 'withdraw': {
        const { amount, bankDetails } = params;

        if (!amount) {
          return NextResponse.json(
            { error: 'Missing amount' },
            { status: 400 }
          );
        }

        // Check KYC level
        if (!user.kycLevel || user.kycLevel === 'none' || user.kycLevel === 'basic') {
          return NextResponse.json({
            success: false,
            error: 'Withdrawals require verified KYC. Please complete verification.',
            kycRequired: true,
          }, { status: 403 });
        }

        // Check balance
        if (user.grainBalance < amount) {
          return NextResponse.json({
            success: false,
            error: `Insufficient GRAIN balance. Have ${user.grainBalance.toFixed(2)}, need ${amount.toFixed(2)}`,
          }, { status: 400 });
        }

        const { price } = await grainRail.getPrice();
        const usdEquivalent = amount * price;

        // Return withdrawal info (actual withdrawal handled by separate flow)
        return NextResponse.json({
          success: true,
          withdrawInfo: {
            grainAmount: amount,
            usdEquivalent,
            grainPrice: price,
            redirectUrl: `/withdraw?amount=${amount}`,
          },
          message: `Withdraw ${amount.toFixed(2)} GRAIN (~$${usdEquivalent.toFixed(2)}) to your bank`,
        });
      }

      // ================================================================
      // ESCROW - Create GRAIN escrow for a deal
      // ================================================================
      case 'escrow_create': {
        const { dealId, sellerUserId, sellerEmail, amount, releaseConditions } = params;

        if (!amount) {
          return NextResponse.json(
            { error: 'Missing amount' },
            { status: 400 }
          );
        }

        // Resolve seller
        let sellerId: string;
        if (sellerUserId) {
          sellerId = sellerUserId;
        } else if (sellerEmail) {
          const seller = await unifiedUser.findByEmail(sellerEmail);
          if (seller) {
            sellerId = seller.unifiedId;
          } else {
            const newSeller = await unifiedUser.createOrLink({
              email: sellerEmail,
              source: 'grainvault',
            });
            sellerId = newSeller.unifiedId;
          }
        } else {
          return NextResponse.json(
            { error: 'Missing seller (sellerUserId or sellerEmail required)' },
            { status: 400 }
          );
        }

        const result = await grainRail.escrow({
          fromUserId: user.unifiedId,
          toUserId: sellerId,
          amount,
          currency: 'USD',
          releaseConditions: releaseConditions || `Escrow for deal ${dealId || 'pending'}`,
          reference: dealId || `escrow-${Date.now()}`,
          allowPartialRelease: false,
        });

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          escrowId: result.escrowId,
          grainAmount: result.grainAmount,
          grainPrice: result.grainPriceAtLock,
          message: `Escrow created. ${result.grainAmount.toLocaleString()} GRAIN held pending release.`,
        });
      }

      // ================================================================
      // ESCROW RELEASE - Release GRAIN to seller
      // ================================================================
      case 'escrow_release': {
        const { escrowId, partialAmount } = params;

        if (!escrowId) {
          return NextResponse.json(
            { error: 'Missing escrow ID' },
            { status: 400 }
          );
        }

        const result = await grainRail.releaseEscrow(escrowId, userId, partialAmount);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          escrowId,
          releasedAmount: result.releasedAmount,
          currentValue: result.currentValue,
          message: `Escrow released. Seller received ${result.releasedAmount.toLocaleString()} GRAIN (worth $${result.currentValue.toFixed(2)})`,
        });
      }

      // ================================================================
      // BALANCE - Get current balance (convenience action)
      // ================================================================
      case 'balance': {
        const { price } = await grainRail.getPrice();

        return NextResponse.json({
          success: true,
          balance: {
            grain: user.grainBalance,
            grainValueUsd: user.grainBalance * price,
            usdc: user.usdcBalance,
            locked: user.lockedBalance,
            creditAvailable: user.creditAvailable,
            total: (user.grainBalance * price) + user.usdcBalance,
          },
          grainPrice: price,
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
