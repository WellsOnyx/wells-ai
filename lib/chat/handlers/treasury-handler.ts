// Treasury Handler - Conversational interface for all GRAIN & Vault operations
// This makes treasury fully conversational through the unified orchestrator

import { grainRail } from '@/lib/payments/grain-rail';
import { unifiedUser } from '@/lib/identity/unified-user';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');

// Action types the treasury handler supports
export type TreasuryAction =
  | 'get_balance'
  | 'get_price'
  | 'send_grain'
  | 'request_grain'
  | 'convert_to_grain'
  | 'convert_from_grain'
  | 'get_transactions'
  | 'create_escrow'
  | 'release_escrow'
  | 'check_escrow'
  | 'setup_credit_line'
  | 'check_credit'
  | 'draw_credit'
  | 'repay_credit'
  | 'run_payroll'
  | 'schedule_payment'
  | 'get_treasury_stats'
  | 'deposit_usdc'
  | 'withdraw_usdc'
  | 'invite_to_grain'
  | 'explain_grain';

export interface TreasuryActionResult {
  success: boolean;
  action: TreasuryAction;
  data?: any;
  error?: string;
  displayMessage: string;
  displayData?: Record<string, any>;
  suggestedActions?: Array<{
    label: string;
    action: string;
    params?: Record<string, any>;
  }>;
  nextSteps?: string[];
}

// Treasury Handler
export class TreasuryHandler {
  // Get user's GRAIN balance and financial profile
  async getBalance(userId: string): Promise<TreasuryActionResult> {
    try {
      const profile = await grainRail.getProfile(userId);

      return {
        success: true,
        action: 'get_balance',
        data: profile,
        displayMessage: `Your GRAIN balance is ${profile.grainBalance.toLocaleString()} GRAIN (worth $${(profile.grainBalance * profile.grainPrice).toLocaleString()}).`,
        displayData: {
          grainBalance: profile.grainBalance,
          usdcBalance: profile.usdcBalance,
          grainPrice: profile.grainPrice,
          grainValueUsd: profile.grainBalance * profile.grainPrice,
          creditAvailable: profile.creditAvailable,
          creditUsed: profile.creditUsed,
          totalLiquidity: profile.totalLiquidity,
        },
        suggestedActions: [
          { label: 'Send GRAIN', action: 'send_grain', params: {} },
          { label: 'View Transactions', action: 'get_transactions', params: {} },
          profile.creditAvailable > 0 ? { label: 'Draw Credit', action: 'draw_credit', params: {} } : null,
        ].filter(Boolean) as any[],
      };
    } catch (error) {
      return {
        success: false,
        action: 'get_balance',
        error: String(error),
        displayMessage: 'Unable to retrieve your balance. Please try again.',
      };
    }
  }

  // Get current GRAIN price with treasury breakdown
  async getPrice(): Promise<TreasuryActionResult> {
    try {
      const priceData = await grainRail.getPrice();

      return {
        success: true,
        action: 'get_price',
        data: priceData,
        displayMessage: `GRAIN is currently $${priceData.price.toFixed(4)}. The treasury holds $${priceData.backing.toLocaleString()} USDC backing ${priceData.supply.toLocaleString()} GRAIN.`,
        displayData: {
          price: priceData.price,
          backing: priceData.backing,
          supply: priceData.supply,
          assetValue: priceData.assetValue,
          backingRatio: (priceData.backing / priceData.supply * 100).toFixed(1) + '%',
        },
        suggestedActions: [
          { label: 'Buy GRAIN', action: 'convert_to_grain', params: {} },
          { label: 'Check Balance', action: 'get_balance', params: {} },
        ],
      };
    } catch (error) {
      return {
        success: false,
        action: 'get_price',
        error: String(error),
        displayMessage: 'Unable to retrieve GRAIN price.',
      };
    }
  }

  // Send GRAIN to another user
  async sendGrain(
    fromUserId: string,
    toEmail: string,
    amount: number,
    memo?: string
  ): Promise<TreasuryActionResult> {
    try {
      // Find recipient
      const recipient = await unifiedUser.findByEmail(toEmail);
      if (!recipient) {
        return {
          success: false,
          action: 'send_grain',
          displayMessage: `No user found with email ${toEmail}. Would you like to invite them to GRAIN?`,
          suggestedActions: [
            { label: 'Invite to GRAIN', action: 'invite_to_grain', params: { email: toEmail } },
          ],
        };
      }

      // Route and execute payment
      const route = await grainRail.route({
        payerId: fromUserId,
        amount,
        currency: 'GRAIN',
      });

      if (route.fundingNeeded > 0) {
        return {
          success: false,
          action: 'send_grain',
          displayMessage: `Insufficient balance. You need ${route.fundingNeeded.toFixed(2)} more GRAIN. Current balance: ${route.grainAvailable.toFixed(2)} GRAIN.`,
          displayData: {
            requested: amount,
            available: route.grainAvailable,
            needed: route.fundingNeeded,
          },
          suggestedActions: [
            { label: 'Deposit USDC', action: 'deposit_usdc', params: { amount: route.fundingNeeded } },
            { label: 'Draw Credit', action: 'draw_credit', params: { amount: route.fundingNeeded } },
          ],
        };
      }

      const payment = await grainRail.pay({
        payerId: fromUserId,
        recipientId: recipient.id,
        amount,
        currency: 'GRAIN',
        memo,
        type: 'transfer',
      });

      return {
        success: true,
        action: 'send_grain',
        data: payment,
        displayMessage: `Sent ${amount.toLocaleString()} GRAIN to ${recipient.companyName || toEmail}. Transaction ID: ${payment.transactionId}`,
        displayData: {
          amount,
          recipient: recipient.companyName || toEmail,
          transactionId: payment.transactionId,
          newBalance: payment.newBalance,
        },
        suggestedActions: [
          { label: 'Send More', action: 'send_grain', params: {} },
          { label: 'View Transactions', action: 'get_transactions', params: {} },
        ],
      };
    } catch (error) {
      return {
        success: false,
        action: 'send_grain',
        error: String(error),
        displayMessage: 'Failed to send GRAIN. Please try again.',
      };
    }
  }

  // Convert USDC to GRAIN
  async convertToGrain(userId: string, usdcAmount: number): Promise<TreasuryActionResult> {
    try {
      const priceData = await grainRail.getPrice();
      const grainAmount = usdcAmount / priceData.price;

      const result = await grainRail.convert({
        userId,
        fromCurrency: 'USDC',
        toCurrency: 'GRAIN',
        amount: usdcAmount,
      });

      return {
        success: true,
        action: 'convert_to_grain',
        data: result,
        displayMessage: `Converted $${usdcAmount.toLocaleString()} USDC to ${result.toAmount.toLocaleString()} GRAIN at $${priceData.price.toFixed(4)}/GRAIN.`,
        displayData: {
          usdcSpent: usdcAmount,
          grainReceived: result.toAmount,
          rate: priceData.price,
        },
        suggestedActions: [
          { label: 'Check Balance', action: 'get_balance', params: {} },
        ],
      };
    } catch (error) {
      return {
        success: false,
        action: 'convert_to_grain',
        error: String(error),
        displayMessage: 'Unable to convert to GRAIN.',
      };
    }
  }

  // Get transaction history
  async getTransactions(
    userId: string,
    limit: number = 10
  ): Promise<TreasuryActionResult> {
    try {
      const transactions = await sql`
        SELECT * FROM unified_transactions
        WHERE payer_id = ${userId} OR recipient_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      const formatted = transactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        date: tx.created_at,
        direction: tx.payer_id === userId ? 'sent' : 'received',
        counterparty: tx.payer_id === userId ? tx.recipient_id : tx.payer_id,
      }));

      return {
        success: true,
        action: 'get_transactions',
        data: formatted,
        displayMessage: `Here are your last ${formatted.length} transactions.`,
        displayData: {
          transactions: formatted,
          count: formatted.length,
        },
        suggestedActions: [
          { label: 'Send GRAIN', action: 'send_grain', params: {} },
          { label: 'Check Balance', action: 'get_balance', params: {} },
        ],
      };
    } catch (error) {
      return {
        success: false,
        action: 'get_transactions',
        error: String(error),
        displayMessage: 'Unable to retrieve transactions.',
      };
    }
  }

  // Create escrow for a deal
  async createEscrow(
    buyerId: string,
    sellerId: string,
    amount: number,
    dealId: string,
    description?: string
  ): Promise<TreasuryActionResult> {
    try {
      const escrow = await grainRail.escrow({
        buyerId,
        sellerId,
        grainAmount: amount,
        dealId,
        expiresInDays: 30,
      });

      return {
        success: true,
        action: 'create_escrow',
        data: escrow,
        displayMessage: `Created escrow of ${amount.toLocaleString()} GRAIN for deal ${dealId}. Escrow ID: ${escrow.escrowId}. GRAIN locked at $${escrow.priceAtLock.toFixed(4)}.`,
        displayData: {
          escrowId: escrow.escrowId,
          amount,
          priceAtLock: escrow.priceAtLock,
          dealId,
        },
        suggestedActions: [
          { label: 'Check Escrow', action: 'check_escrow', params: { escrowId: escrow.escrowId } },
        ],
      };
    } catch (error) {
      return {
        success: false,
        action: 'create_escrow',
        error: String(error),
        displayMessage: 'Failed to create escrow.',
      };
    }
  }

  // Release escrow to seller
  async releaseEscrow(escrowId: string, releaserId: string): Promise<TreasuryActionResult> {
    try {
      const result = await grainRail.releaseEscrow(escrowId, releaserId);

      return {
        success: true,
        action: 'release_escrow',
        data: result,
        displayMessage: `Escrow released! ${result.grainReleased.toLocaleString()} GRAIN sent to seller.${result.appreciation > 0 ? ` GRAIN appreciated $${result.appreciation.toFixed(2)} while locked!` : ''}`,
        displayData: {
          grainReleased: result.grainReleased,
          appreciation: result.appreciation,
          wellsFee: result.wellsFee,
        },
      };
    } catch (error) {
      return {
        success: false,
        action: 'release_escrow',
        error: String(error),
        displayMessage: 'Failed to release escrow.',
      };
    }
  }

  // Check credit line status
  async checkCredit(userId: string): Promise<TreasuryActionResult> {
    try {
      const user = await unifiedUser.get(userId);
      if (!user) {
        return {
          success: false,
          action: 'check_credit',
          displayMessage: 'User not found.',
        };
      }

      const tier = await unifiedUser.calculateCreditTier(userId);

      return {
        success: true,
        action: 'check_credit',
        data: {
          creditLimit: user.creditLimit,
          creditUsed: user.creditUsed,
          creditAvailable: user.creditLimit - user.creditUsed,
          tier,
        },
        displayMessage: `Credit Line: $${(user.creditLimit - user.creditUsed).toLocaleString()} available of $${user.creditLimit.toLocaleString()} limit. Tier: ${tier.level} (${tier.apr}% APR).`,
        displayData: {
          limit: user.creditLimit,
          used: user.creditUsed,
          available: user.creditLimit - user.creditUsed,
          tier: tier.level,
          apr: tier.apr,
        },
        suggestedActions: user.creditLimit - user.creditUsed > 0
          ? [{ label: 'Draw Credit', action: 'draw_credit', params: {} }]
          : [{ label: 'Increase Limit', action: 'setup_credit_line', params: {} }],
      };
    } catch (error) {
      return {
        success: false,
        action: 'check_credit',
        error: String(error),
        displayMessage: 'Unable to check credit status.',
      };
    }
  }

  // Run payroll batch
  async runPayroll(
    payerId: string,
    recipients: Array<{ userId: string; amount: number; memo?: string }>
  ): Promise<TreasuryActionResult> {
    try {
      const result = await grainRail.payroll({
        payerId,
        payments: recipients.map(r => ({
          recipientId: r.userId,
          grainAmount: r.amount,
          memo: r.memo || 'Payroll',
        })),
        memo: 'Batch payroll',
      });

      if (result.fundingNeeded > 0) {
        return {
          success: false,
          action: 'run_payroll',
          displayMessage: `Insufficient funds for payroll. Need ${result.fundingNeeded.toLocaleString()} more GRAIN.`,
          displayData: {
            totalRequired: result.totalRequired,
            available: result.grainAvailable,
            fundingNeeded: result.fundingNeeded,
          },
          suggestedActions: [
            { label: 'Deposit USDC', action: 'deposit_usdc', params: { amount: result.fundingNeeded } },
          ],
        };
      }

      return {
        success: true,
        action: 'run_payroll',
        data: result,
        displayMessage: `Payroll complete! Paid ${result.successCount} recipients totaling ${result.totalPaid.toLocaleString()} GRAIN.`,
        displayData: {
          successCount: result.successCount,
          failedCount: result.failedCount,
          totalPaid: result.totalPaid,
          batchId: result.batchId,
        },
      };
    } catch (error) {
      return {
        success: false,
        action: 'run_payroll',
        error: String(error),
        displayMessage: 'Payroll failed.',
      };
    }
  }

  // Get treasury stats (admin/founder view)
  async getTreasuryStats(): Promise<TreasuryActionResult> {
    try {
      const priceData = await grainRail.getPrice();

      // Get additional stats
      const stats = await sql`
        SELECT
          COUNT(*) as total_transactions,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_volume,
          COUNT(DISTINCT payer_id) as unique_payers
        FROM unified_transactions
        WHERE created_at > NOW() - INTERVAL '30 days'
      `;

      const escrowStats = await sql`
        SELECT
          COUNT(*) as active_escrows,
          SUM(grain_amount) as escrowed_grain
        FROM grain_escrows
        WHERE status = 'locked'
      `;

      return {
        success: true,
        action: 'get_treasury_stats',
        data: {
          price: priceData,
          transactions: stats[0],
          escrows: escrowStats[0],
        },
        displayMessage: `GRAIN Treasury: $${priceData.backing.toLocaleString()} backing, ${priceData.supply.toLocaleString()} supply, $${priceData.price.toFixed(4)} price. 30-day volume: $${Number(stats[0]?.total_volume || 0).toLocaleString()}.`,
        displayData: {
          grainPrice: priceData.price,
          backing: priceData.backing,
          supply: priceData.supply,
          backingRatio: ((priceData.backing / priceData.supply) * 100).toFixed(1),
          thirtyDayVolume: Number(stats[0]?.total_volume || 0),
          thirtyDayTransactions: Number(stats[0]?.total_transactions || 0),
          activeEscrows: Number(escrowStats[0]?.active_escrows || 0),
          escrowedGrain: Number(escrowStats[0]?.escrowed_grain || 0),
        },
      };
    } catch (error) {
      return {
        success: false,
        action: 'get_treasury_stats',
        error: String(error),
        displayMessage: 'Unable to retrieve treasury stats.',
      };
    }
  }

  // Explain GRAIN to user
  async explainGrain(): Promise<TreasuryActionResult> {
    return {
      success: true,
      action: 'explain_grain',
      displayMessage: `**GRAIN** is a treasury-backed stablecoin:

1. **$1 Floor** - Price = (USDC Backing + Asset Value) / Supply. Never below $1.
2. **Appreciates** - Fees go to treasury, growing the backing ratio over time.
3. **Instant Settlement** - Send GRAIN anywhere, instantly, with no gas fees.
4. **Credit Lines** - Borrow against your transaction history at 0-3% APR.
5. **Escrow** - Lock GRAIN for deals. If price rises while locked, you keep the gains.

Your idle cash should work for you.`,
      suggestedActions: [
        { label: 'Get Started', action: 'get_balance', params: {} },
        { label: 'Check Price', action: 'get_price', params: {} },
      ],
    };
  }

  // Main dispatch method
  async handleAction(
    action: TreasuryAction,
    userId: string,
    params: Record<string, any> = {}
  ): Promise<TreasuryActionResult> {
    switch (action) {
      case 'get_balance':
        return this.getBalance(userId);

      case 'get_price':
        return this.getPrice();

      case 'send_grain':
        return this.sendGrain(userId, params.toEmail, params.amount, params.memo);

      case 'convert_to_grain':
        return this.convertToGrain(userId, params.amount);

      case 'get_transactions':
        return this.getTransactions(userId, params.limit);

      case 'create_escrow':
        return this.createEscrow(userId, params.sellerId, params.amount, params.dealId, params.description);

      case 'release_escrow':
        return this.releaseEscrow(params.escrowId, userId);

      case 'check_credit':
        return this.checkCredit(userId);

      case 'run_payroll':
        return this.runPayroll(userId, params.recipients);

      case 'get_treasury_stats':
        return this.getTreasuryStats();

      case 'explain_grain':
        return this.explainGrain();

      default:
        return {
          success: false,
          action,
          displayMessage: `Unknown treasury action: ${action}`,
        };
    }
  }
}

// Singleton
export const treasuryHandler = new TreasuryHandler();
