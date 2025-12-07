/**
 * CIRCLE INTEGRATION - USDC Payment Rails
 *
 * Circle provides programmable wallets and USDC infrastructure.
 * This is the crypto payment backbone for Wells AI.
 *
 * KEY FEATURES:
 * - Create wallets for users (custodial or self-custody)
 * - Send/receive USDC instantly
 * - Sub-second settlement
 * - Transparent on-chain tracking
 * - All payments tracked for float deployment
 *
 * DOCS: https://developers.circle.com/
 */

import { trackFloat } from '@/lib/scale/float-treasury-integration';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// TYPES
// ============================================================================

export interface CircleWallet {
  walletId: string;
  blockchain: 'ETH' | 'MATIC' | 'AVAX';
  address: string;
  balances: {
    currency: string;
    amount: string;
  }[];
}

export interface CirclePayment {
  id: string;
  source: {
    type: 'wallet' | 'blockchain';
    id: string;
  };
  destination: {
    type: 'wallet' | 'blockchain';
    address: string;
  };
  amount: {
    amount: string;
    currency: 'USD' | 'USDC';
  };
  status: 'pending' | 'confirmed' | 'complete' | 'failed';
  transactionHash?: string;
  createDate: string;
  updateDate: string;
}

export interface CreatePaymentParams {
  fromWalletId: string;
  toAddress: string;
  amount: string;
  currency: 'USDC';
  blockchain?: 'ETH' | 'MATIC' | 'AVAX';
  metadata?: {
    userId?: string;
    paymentType?: string;
    [key: string]: any;
  };
}

// ============================================================================
// CIRCLE API CLIENT
// ============================================================================

class CircleClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.circle.com/v1';

  constructor() {
    const apiKey = process.env.CIRCLE_API_KEY;
    if (!apiKey) {
      throw new Error('CIRCLE_API_KEY not configured');
    }
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Circle API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data;
  }

  // Wallet operations
  async createWallet(blockchain: 'ETH' | 'MATIC' | 'AVAX' = 'MATIC'): Promise<CircleWallet> {
    return this.request<CircleWallet>('POST', '/wallets', {
      idempotencyKey: crypto.randomUUID(),
      blockchain,
    });
  }

  async getWallet(walletId: string): Promise<CircleWallet> {
    return this.request<CircleWallet>('GET', `/wallets/${walletId}`);
  }

  async listWallets(): Promise<CircleWallet[]> {
    const data = await this.request<{ wallets: CircleWallet[] }>('GET', '/wallets');
    return data.wallets || [];
  }

  // Payment operations
  async createTransfer(params: CreatePaymentParams): Promise<CirclePayment> {
    const blockchain = params.blockchain || 'MATIC'; // Default to Polygon for low fees

    return this.request<CirclePayment>('POST', '/transfers', {
      idempotencyKey: crypto.randomUUID(),
      source: {
        type: 'wallet',
        id: params.fromWalletId,
      },
      destination: {
        type: 'blockchain',
        address: params.toAddress,
        chain: blockchain,
      },
      amount: {
        amount: params.amount,
        currency: params.currency,
      },
    });
  }

  async getTransfer(transferId: string): Promise<CirclePayment> {
    return this.request<CirclePayment>('GET', `/transfers/${transferId}`);
  }

  async listTransfers(params?: {
    walletId?: string;
    pageSize?: number;
    pageBefore?: string;
    pageAfter?: string;
  }): Promise<CirclePayment[]> {
    const query = new URLSearchParams();
    if (params?.walletId) query.append('walletId', params.walletId);
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params?.pageBefore) query.append('pageBefore', params.pageBefore);
    if (params?.pageAfter) query.append('pageAfter', params.pageAfter);

    const queryString = query.toString();
    const endpoint = `/transfers${queryString ? `?${queryString}` : ''}`;

    const data = await this.request<{ transfers: CirclePayment[] }>('GET', endpoint);
    return data.transfers || [];
  }

  // Balance operations
  async getBalance(walletId: string, currency: string = 'USDC'): Promise<string> {
    const wallet = await this.getWallet(walletId);
    const balance = wallet.balances.find(b => b.currency === currency);
    return balance?.amount || '0';
  }
}

// Singleton instance
let circleClient: CircleClient;

function getCircleClient(): CircleClient {
  if (!circleClient) {
    circleClient = new CircleClient();
  }
  return circleClient;
}

// ============================================================================
// HIGH-LEVEL WALLET OPERATIONS
// ============================================================================

/**
 * Get or create a Circle wallet for a user
 * Wallets are cached in the database
 */
export async function getUserWallet(userId: string): Promise<{
  walletId: string;
  address: string;
  blockchain: string;
}> {
  // Check if user already has a wallet
  const { data: existingWallet } = await supabase
    .from('circle_wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existingWallet) {
    return {
      walletId: existingWallet.wallet_id,
      address: existingWallet.address,
      blockchain: existingWallet.blockchain,
    };
  }

  // Create new wallet
  const client = getCircleClient();
  const wallet = await client.createWallet('MATIC'); // Use Polygon for low fees

  // Store in database
  await supabase.from('circle_wallets').insert({
    user_id: userId,
    wallet_id: wallet.walletId,
    address: wallet.address,
    blockchain: wallet.blockchain,
    created_at: new Date().toISOString(),
  });

  return {
    walletId: wallet.walletId,
    address: wallet.address,
    blockchain: wallet.blockchain,
  };
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(
  userId: string,
  currency: string = 'USDC'
): Promise<{
  currency: string;
  amount: string;
  amountInCents: number;
}> {
  const wallet = await getUserWallet(userId);
  const client = getCircleClient();
  const amount = await client.getBalance(wallet.walletId, currency);

  return {
    currency,
    amount,
    amountInCents: Math.round(parseFloat(amount) * 100),
  };
}

// ============================================================================
// PAYMENT OPERATIONS
// ============================================================================

/**
 * Send USDC payment
 * Automatically tracks float for treasury deployment
 */
export async function sendUSDC(params: {
  fromUserId: string;
  toAddress: string;
  amount: string; // In USDC (e.g., "100.00")
  metadata?: {
    paymentType?: 'viral_payment' | 'partner_transaction' | 'credit_draw' | 'erp_intercept';
    sourceId?: string;
    description?: string;
  };
}): Promise<{
  transferId: string;
  transactionHash?: string;
  status: string;
  floatPositionId?: string;
}> {
  const { fromUserId, toAddress, amount, metadata } = params;

  // Get sender's wallet
  const wallet = await getUserWallet(fromUserId);

  // Check balance
  const balance = await getWalletBalance(fromUserId);
  if (parseFloat(balance.amount) < parseFloat(amount)) {
    throw new Error(`Insufficient balance. Have ${balance.amount} USDC, need ${amount} USDC`);
  }

  // Create transfer
  const client = getCircleClient();
  const transfer = await client.createTransfer({
    fromWalletId: wallet.walletId,
    toAddress,
    amount,
    currency: 'USDC',
    metadata: {
      userId: fromUserId,
      ...metadata,
    },
  });

  // Store payment record
  const { data: payment } = await supabase
    .from('circle_payments')
    .insert({
      transfer_id: transfer.id,
      from_user_id: fromUserId,
      from_wallet_id: wallet.walletId,
      to_address: toAddress,
      amount_usdc: parseFloat(amount),
      status: transfer.status,
      transaction_hash: transfer.transactionHash,
      blockchain: wallet.blockchain,
      metadata,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Track float for treasury deployment
  let floatPositionId: string | undefined;
  if (metadata?.paymentType && metadata?.sourceId) {
    try {
      const floatPosition = await trackFloat(
        metadata.paymentType,
        metadata.sourceId,
        parseFloat(amount),
        3 // 3-day settlement window
      );
      floatPositionId = floatPosition.id;

      // Update payment with float position
      await supabase
        .from('circle_payments')
        .update({ float_position_id: floatPositionId })
        .eq('id', payment.id);
    } catch (error) {
      console.error('Failed to track float:', error);
      // Continue - payment already sent
    }
  }

  return {
    transferId: transfer.id,
    transactionHash: transfer.transactionHash,
    status: transfer.status,
    floatPositionId,
  };
}

/**
 * Check payment status
 */
export async function getPaymentStatus(transferId: string): Promise<{
  status: 'pending' | 'confirmed' | 'complete' | 'failed';
  transactionHash?: string;
  completedAt?: string;
}> {
  const client = getCircleClient();
  const transfer = await client.getTransfer(transferId);

  // Update in database
  await supabase
    .from('circle_payments')
    .update({
      status: transfer.status,
      transaction_hash: transfer.transactionHash,
      updated_at: new Date().toISOString(),
      completed_at: transfer.status === 'complete' ? new Date().toISOString() : null,
    })
    .eq('transfer_id', transferId);

  return {
    status: transfer.status,
    transactionHash: transfer.transactionHash,
    completedAt: transfer.status === 'complete' ? transfer.updateDate : undefined,
  };
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(
  userId: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  transferId: string;
  amount: number;
  status: string;
  toAddress: string;
  transactionHash?: string;
  createdAt: string;
  metadata?: any;
}>> {
  const { data: payments } = await supabase
    .from('circle_payments')
    .select('*')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!payments) return [];

  return payments.map(p => ({
    id: p.id,
    transferId: p.transfer_id,
    amount: p.amount_usdc,
    status: p.status,
    toAddress: p.to_address,
    transactionHash: p.transaction_hash,
    createdAt: p.created_at,
    metadata: p.metadata,
  }));
}

// ============================================================================
// INCOMING PAYMENT DETECTION
// ============================================================================

/**
 * Monitor wallet for incoming payments
 * This should be called via webhook or polling
 */
export async function detectIncomingPayments(userId: string): Promise<Array<{
  amount: string;
  from: string;
  transactionHash: string;
  timestamp: string;
}>> {
  const wallet = await getUserWallet(userId);
  const client = getCircleClient();

  // Get recent transfers to this wallet
  const transfers = await client.listTransfers({
    walletId: wallet.walletId,
    pageSize: 100,
  });

  // Filter for incoming transfers we haven't processed
  const incoming = transfers.filter(t => {
    return (
      t.destination.type === 'wallet' &&
      t.status === 'complete' &&
      t.transactionHash
    );
  });

  // Store new incoming payments
  const newPayments = [];
  for (const transfer of incoming) {
    // Check if we've already processed this
    const { data: existing } = await supabase
      .from('circle_incoming_payments')
      .select('id')
      .eq('transaction_hash', transfer.transactionHash)
      .single();

    if (!existing) {
      // New incoming payment
      await supabase.from('circle_incoming_payments').insert({
        user_id: userId,
        wallet_id: wallet.walletId,
        transfer_id: transfer.id,
        amount_usdc: parseFloat(transfer.amount.amount),
        transaction_hash: transfer.transactionHash,
        blockchain: wallet.blockchain,
        received_at: transfer.updateDate,
      });

      newPayments.push({
        amount: transfer.amount.amount,
        from: transfer.source.id,
        transactionHash: transfer.transactionHash!,
        timestamp: transfer.updateDate,
      });
    }
  }

  return newPayments;
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Process Circle webhook event
 * Called from webhook endpoint
 */
export async function handleCircleWebhook(event: {
  type: string;
  transfer?: CirclePayment;
  wallet?: CircleWallet;
}): Promise<void> {
  switch (event.type) {
    case 'transfers.created':
    case 'transfers.completed':
    case 'transfers.failed':
      if (event.transfer) {
        await handleTransferEvent(event.transfer);
      }
      break;

    case 'wallet.created':
      // Wallet creation events (if needed)
      break;

    default:
      console.log('Unhandled Circle webhook event:', event.type);
  }
}

async function handleTransferEvent(transfer: CirclePayment): Promise<void> {
  // Update payment status in database
  await supabase
    .from('circle_payments')
    .update({
      status: transfer.status,
      transaction_hash: transfer.transactionHash,
      updated_at: new Date().toISOString(),
      completed_at: transfer.status === 'complete' ? new Date().toISOString() : null,
    })
    .eq('transfer_id', transfer.id);

  // If payment completed, check if we need to settle float
  if (transfer.status === 'complete') {
    const { data: payment } = await supabase
      .from('circle_payments')
      .select('float_position_id')
      .eq('transfer_id', transfer.id)
      .single();

    if (payment?.float_position_id) {
      // Payment is complete, float can now be marked for settlement
      // The actual settlement happens based on the settlement window
      await supabase
        .from('float_positions')
        .update({ status: 'settling' })
        .eq('id', payment.float_position_id)
        .eq('status', 'deployed'); // Only update if still deployed
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getUserWallet,
  getWalletBalance,
  sendUSDC,
  getPaymentStatus,
  getPaymentHistory,
  detectIncomingPayments,
  handleCircleWebhook,
};
