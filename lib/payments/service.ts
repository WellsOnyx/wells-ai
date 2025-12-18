/**
 * UNIFIED PAYMENT SERVICE
 *
 * Single interface for all payment operations across Circle (USDC) and Stripe (fiat).
 * Abstracts the complexity of multi-rail payments and automatic float tracking.
 *
 * PHILOSOPHY:
 * - User thinks in dollars
 * - System handles USDC/fiat conversion seamlessly
 * - All payments generate float for treasury
 * - Balance is unified view of USDC + fiat
 *
 * PAYMENT FLOW:
 * 1. Fiat deposit (Stripe card/ACH) → USDC balance
 * 2. USDC payment (Circle) → Settlement window → Float deployment
 * 3. USDC withdrawal → Fiat payout (Stripe to bank)
 */

import * as Circle from './circle';
import * as Stripe from './stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

// ============================================================================
// TYPES
// ============================================================================

export interface UnifiedBalance {
  userId: string;

  // USDC (primary balance - what user can spend)
  usdc: {
    available: number;
    pending: number;
    total: number;
  };

  // Fiat (for display - what user deposited)
  usd: {
    totalDeposited: number;
    totalWithdrawn: number;
    net: number;
  };

  // Float earnings (passive income from payments)
  yield: {
    earned: number;
    pending: number;
  };
}

export interface PaymentRequest {
  fromUserId: string;
  toAddress?: string; // Circle wallet address
  toBankAccountId?: string; // Stripe connected account
  amount: number; // In USDC
  method: 'usdc' | 'auto'; // Auto picks best method
  metadata?: {
    paymentType?: 'viral_payment' | 'partner_transaction' | 'credit_draw' | 'erp_intercept';
    sourceId?: string;
    description?: string;
  };
}

export interface DepositRequest {
  userId: string;
  amount: number; // In cents (USD)
  method: 'card' | 'ach';
  paymentMethodId?: string; // For saved cards
}

export interface WithdrawalRequest {
  userId: string;
  amount: number; // In USDC
  destination: 'bank'; // Future: 'crypto_wallet'
}

// ============================================================================
// UNIFIED BALANCE
// ============================================================================

/**
 * Get user's complete balance across all rails
 */
export async function getBalance(userId: string): Promise<UnifiedBalance> {
  // Get USDC balance from database
  const { data: balance } = await supabase
    .from('user_balances')
    .select('*')
    .eq('user_id', userId)
    .single();

  const usdcAvailable = balance?.usdc_balance || 0;

  // Get pending deposits (Stripe payment intents)
  const { data: pendingDeposits } = await supabase
    .from('stripe_payment_intents')
    .select('amount_cents')
    .eq('user_id', userId)
    .in('status', ['processing', 'requires_action']);

  const pendingUSDC = pendingDeposits
    ? pendingDeposits.reduce((sum, d) => sum + d.amount_cents / 100, 0)
    : 0;

  // Get deposit/withdrawal history
  const { data: deposits } = await supabase
    .from('stripe_payment_intents')
    .select('amount_cents')
    .eq('user_id', userId)
    .eq('status', 'succeeded');

  const totalDeposited = deposits
    ? deposits.reduce((sum, d) => sum + d.amount_cents / 100, 0)
    : 0;

  const { data: withdrawals } = await supabase
    .from('stripe_payouts')
    .select('amount_usdc')
    .eq('user_id', userId)
    .in('status', ['paid', 'in_transit']);

  const totalWithdrawn = withdrawals
    ? withdrawals.reduce((sum, w) => sum + w.amount_usdc, 0)
    : 0;

  // Get yield earnings from float
  const { data: rewards } = await supabase
    .from('account_rewards')
    .select('amount, status')
    .eq('account_id', userId)
    .eq('reward_type', 'float_yield');

  const yieldEarned = rewards
    ? rewards.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0)
    : 0;

  const yieldPending = rewards
    ? rewards.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0)
    : 0;

  return {
    userId,
    usdc: {
      available: usdcAvailable,
      pending: pendingUSDC,
      total: usdcAvailable + pendingUSDC,
    },
    usd: {
      totalDeposited,
      totalWithdrawn,
      net: totalDeposited - totalWithdrawn,
    },
    yield: {
      earned: yieldEarned,
      pending: yieldPending,
    },
  };
}

// ============================================================================
// DEPOSITS
// ============================================================================

/**
 * Deposit funds via card or ACH
 * Returns payment intent for frontend confirmation
 */
export async function deposit(request: DepositRequest): Promise<{
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  method: string;
}> {
  const { userId, amount, method, paymentMethodId } = request;

  if (method === 'card') {
    // Card deposit
    const intent = await Stripe.createDepositIntent(userId, amount, {
      description: 'Deposit to Wells AI wallet',
      paymentType: 'card_deposit',
    });

    return {
      paymentIntentId: intent.paymentIntentId,
      clientSecret: intent.clientSecret,
      amount: intent.amount,
      method: 'card',
    };
  } else if (method === 'ach') {
    // ACH deposit
    const intent = await Stripe.createACHPayment(userId, amount, {
      description: 'ACH deposit to Wells AI wallet',
    });

    return {
      paymentIntentId: intent.paymentIntentId,
      clientSecret: intent.clientSecret,
      amount: intent.amount,
      method: 'ach',
    };
  } else {
    throw new Error('Invalid deposit method');
  }
}

/**
 * Confirm a deposit after user completes payment
 * This is called automatically via webhook or manually
 */
export async function confirmDeposit(paymentIntentId: string): Promise<{
  success: boolean;
  usdcCredited: number;
  newBalance: number;
}> {
  const result = await Stripe.confirmPayment(paymentIntentId);

  if (result.status === 'succeeded') {
    const usdcAmount = result.amount / 100; // Convert cents to USDC
    const balance = await getBalance(''); // Get from payment intent

    const { data: intent } = await supabase
      .from('stripe_payment_intents')
      .select('user_id')
      .eq('payment_intent_id', paymentIntentId)
      .single();

    if (intent) {
      const userBalance = await getBalance(intent.user_id);
      return {
        success: true,
        usdcCredited: usdcAmount,
        newBalance: userBalance.usdc.available,
      };
    }
  }

  return {
    success: false,
    usdcCredited: 0,
    newBalance: 0,
  };
}

// ============================================================================
// PAYMENTS
// ============================================================================

/**
 * Send payment to another user or address
 * Automatically selects best payment rail
 */
export async function createPayment(request: PaymentRequest): Promise<{
  paymentId: string;
  method: 'usdc' | 'fiat';
  status: string;
  transactionHash?: string;
  floatPositionId?: string;
}> {
  const { fromUserId, toAddress, amount, method, metadata } = request;

  // Check balance
  const balance = await getBalance(fromUserId);
  if (balance.usdc.available < amount) {
    throw new Error(
      `Insufficient balance. Have ${balance.usdc.available} USDC, need ${amount} USDC`
    );
  }

  // Use USDC via Circle
  if (method === 'usdc' || method === 'auto') {
    if (!toAddress) {
      throw new Error('Recipient address required for USDC payment');
    }

    const result = await Circle.sendUSDC({
      fromUserId,
      toAddress,
      amount: amount.toString(),
      metadata,
    });

    return {
      paymentId: result.transferId,
      method: 'usdc',
      status: result.status,
      transactionHash: result.transactionHash,
      floatPositionId: result.floatPositionId,
    };
  }

  throw new Error('Invalid payment method');
}

/**
 * Get payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<{
  status: string;
  completedAt?: string;
  transactionHash?: string;
}> {
  // Try Circle first
  try {
    const status = await Circle.getPaymentStatus(paymentId);
    return status;
  } catch (error) {
    // Payment not found in Circle
  }

  // Try Stripe
  try {
    const status = await Stripe.getPayoutStatus(paymentId);
    return {
      status: status.status,
      completedAt: status.arrivalDate,
    };
  } catch (error) {
    // Payment not found
  }

  throw new Error('Payment not found');
}

// ============================================================================
// WITHDRAWALS
// ============================================================================

/**
 * Withdraw USDC to bank account
 * Converts USDC → USD via Stripe
 */
export async function withdraw(request: WithdrawalRequest): Promise<{
  payoutId: string;
  amount: number;
  arrivalDate: string;
  status: string;
}> {
  const { userId, amount, destination } = request;

  if (destination === 'bank') {
    // Check if user has connected account
    const { data: connectedAccount } = await supabase
      .from('stripe_connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!connectedAccount) {
      throw new Error('Please connect your bank account first');
    }

    // Create payout
    const result = await Stripe.createPayout(userId, amount, {
      description: 'Withdrawal from Wells AI wallet',
    });

    return result;
  }

  throw new Error('Invalid withdrawal destination');
}

/**
 * Setup bank account for withdrawals
 */
export async function setupBankAccount(
  userId: string,
  email: string
): Promise<{
  accountId: string;
  onboardingUrl: string;
}> {
  return Stripe.createConnectedAccount(userId, email);
}

// ============================================================================
// PAYMENT HISTORY
// ============================================================================

export interface PaymentHistoryItem {
  id: string;
  type: 'deposit' | 'payment' | 'withdrawal' | 'reward';
  amount: number;
  currency: 'USD' | 'USDC';
  status: string;
  description?: string;
  createdAt: string;
  metadata?: any;
}

/**
 * Get complete payment history for a user
 */
export async function getPaymentHistory(
  userId: string,
  limit: number = 50
): Promise<PaymentHistoryItem[]> {
  const history: PaymentHistoryItem[] = [];

  // Get deposits (Stripe)
  const { data: deposits } = await supabase
    .from('stripe_payment_intents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (deposits) {
    history.push(
      ...deposits.map(d => ({
        id: d.payment_intent_id,
        type: 'deposit' as const,
        amount: d.amount_cents / 100,
        currency: 'USD' as const,
        status: d.status,
        description: d.metadata?.description,
        createdAt: d.created_at,
        metadata: d.metadata,
      }))
    );
  }

  // Get payments (Circle)
  const { data: payments } = await supabase
    .from('circle_payments')
    .select('*')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (payments) {
    history.push(
      ...payments.map(p => ({
        id: p.transfer_id,
        type: 'payment' as const,
        amount: p.amount_usdc,
        currency: 'USDC' as const,
        status: p.status,
        description: p.metadata?.description,
        createdAt: p.created_at,
        metadata: p.metadata,
      }))
    );
  }

  // Get withdrawals (Stripe)
  const { data: withdrawals } = await supabase
    .from('stripe_payouts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (withdrawals) {
    history.push(
      ...withdrawals.map(w => ({
        id: w.payout_id,
        type: 'withdrawal' as const,
        amount: w.amount_usdc,
        currency: 'USDC' as const,
        status: w.status,
        description: w.metadata?.description,
        createdAt: w.created_at,
        metadata: w.metadata,
      }))
    );
  }

  // Get rewards
  const { data: rewards } = await supabase
    .from('account_rewards')
    .select('*')
    .eq('account_id', userId)
    .eq('reward_type', 'float_yield')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (rewards) {
    history.push(
      ...rewards.map(r => ({
        id: r.id,
        type: 'reward' as const,
        amount: r.amount,
        currency: 'USDC' as const,
        status: r.status,
        description: 'Float yield earnings',
        createdAt: r.created_at,
        metadata: {},
      }))
    );
  }

  // Sort by date and limit
  return history
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

// ============================================================================
// FLOAT METRICS FOR USER
// ============================================================================

export interface UserFloatMetrics {
  // Current float positions
  activeFloatPositions: number;
  totalFloatAmount: number;

  // Yield earned
  totalYieldEarned: number;
  pendingYield: number;

  // Projections
  estimatedMonthlyYield: number;
  currentAPY: number;
}

/**
 * Get float metrics for a specific user
 */
export async function getUserFloatMetrics(userId: string): Promise<UserFloatMetrics> {
  // Get user's active float positions
  const { data: userPayments } = await supabase
    .from('circle_payments')
    .select('float_position_id')
    .eq('from_user_id', userId)
    .not('float_position_id', 'is', null);

  const floatPositionIds = userPayments?.map(p => p.float_position_id) || [];

  if (floatPositionIds.length === 0) {
    return {
      activeFloatPositions: 0,
      totalFloatAmount: 0,
      totalYieldEarned: 0,
      pendingYield: 0,
      estimatedMonthlyYield: 0,
      currentAPY: 0.05,
    };
  }

  // Get float positions
  const { data: positions } = await supabase
    .from('float_positions')
    .select('*')
    .in('id', floatPositionIds);

  const activePositions = positions?.filter(p => p.status !== 'settled') || [];
  const totalFloatAmount = activePositions.reduce((sum, p) => sum + p.amount_usdc, 0);

  const settledPositions = positions?.filter(p => p.status === 'settled') || [];
  const totalYieldEarned = settledPositions.reduce((sum, p) => sum + (p.yield_earned || 0), 0);

  // Get pending yield from rewards
  const { data: rewards } = await supabase
    .from('account_rewards')
    .select('amount, status')
    .eq('account_id', userId)
    .eq('reward_type', 'float_yield')
    .eq('status', 'pending');

  const pendingYield = rewards?.reduce((sum, r) => sum + r.amount, 0) || 0;

  // Estimate yield based on current positions
  const currentAPY = 0.05; // 5% base APY
  const estimatedMonthlyYield = totalFloatAmount * (currentAPY / 12);

  return {
    activeFloatPositions: activePositions.length,
    totalFloatAmount,
    totalYieldEarned,
    pendingYield,
    estimatedMonthlyYield,
    currentAPY,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Balance
  getBalance,

  // Deposits
  deposit,
  confirmDeposit,

  // Payments
  createPayment,
  getPaymentStatus,

  // Withdrawals
  withdraw,
  setupBankAccount,

  // History
  getPaymentHistory,

  // Float
  getUserFloatMetrics,
};
