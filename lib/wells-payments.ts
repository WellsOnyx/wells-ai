/**
 * Wells Payments - Unified Payment Layer
 *
 * Integrates Grain & Vault (Circle) with ALL WellsAI transactions:
 * - Deal escrows (AI-to-AI negotiations)
 * - Direct payments (treasury operations)
 * - Success fee collection (1% on closed deals)
 * - Viral payments (peer-to-peer GRAIN transfers)
 *
 * All funds flow through the Wells Master Wallet (custodial model)
 */

import { sql } from '@vercel/postgres';
import crypto from 'crypto';

// Circle API configuration
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || '';
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || '';
const CIRCLE_BASE_URL = CIRCLE_API_KEY.startsWith('TEST_')
  ? 'https://api.circle.com'
  : 'https://api.circle.com';

// Wells Master Wallet - all custodial funds
const WELLS_MASTER_WALLET_ID = process.env.WELLS_MASTER_WALLET_ID || '';
const WELLS_MASTER_WALLET_ADDRESS = process.env.WELLS_MASTER_WALLET_ADDRESS || '';

// Fee configuration (exported for use in other modules)
export const STANDARD_FEE_RATE = 0.01; // 1% success fee
export const WHITE_GLOVE_FEE_RATE = 0.033; // 3.3% for concierge
export const MINIMUM_FEE = 100; // $100 minimum

// ============================================================================
// CIRCLE API HELPERS
// ============================================================================

async function getEntitySecretCiphertext(): Promise<string> {
  // Fetch Circle's public key
  const pubKeyRes = await fetch(`${CIRCLE_BASE_URL}/v1/w3s/config/entity/publicKey`, {
    headers: { 'Authorization': `Bearer ${CIRCLE_API_KEY}` },
  });
  const { data } = await pubKeyRes.json();
  const publicKeyPem = data.publicKey;

  // Encrypt entity secret
  const entitySecretBuffer = Buffer.from(CIRCLE_ENTITY_SECRET, 'hex');
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    entitySecretBuffer
  );

  return encrypted.toString('base64');
}

async function circleRequest(
  method: 'GET' | 'POST',
  endpoint: string,
  body?: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(`${CIRCLE_BASE_URL}${endpoint}`, options);
    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.message || 'Circle API error' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================================
// ACCOUNT MANAGEMENT
// ============================================================================

export interface WellsAccount {
  id: string;
  clerkUserId: string;
  email: string;
  fullName: string;
  usdBalance: number;
  grainBalance: number;
  virtualWalletId: string;
  status: 'active' | 'suspended' | 'pending_kyc';
  createdAt: Date;
}

/**
 * Get or create a Wells account for a user
 * In custodial model, users don't get their own Circle wallet
 * They get a ledger balance in the Wells system
 */
export async function getOrCreateAccount(
  clerkUserId: string,
  email: string,
  fullName: string
): Promise<WellsAccount> {
  // Check for existing account
  const existing = await sql`
    SELECT * FROM treasury_accounts
    WHERE clerk_user_id = ${clerkUserId}
    LIMIT 1
  `;

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id,
      clerkUserId: row.clerk_user_id,
      email: row.email,
      fullName: row.full_name,
      usdBalance: parseFloat(row.usd_balance || '0'),
      grainBalance: parseFloat(row.grain_balance || '0'),
      virtualWalletId: row.circle_wallet_id || `vw_${row.id.replace(/-/g, '').slice(0, 16)}`,
      status: row.status || 'active',
      createdAt: row.created_at,
    };
  }

  // Create new account with virtual wallet ID (ledger entry, not real Circle wallet)
  const accountId = crypto.randomUUID();
  const virtualWalletId = `vw_${accountId.replace(/-/g, '').slice(0, 16)}`;

  await sql`
    INSERT INTO treasury_accounts (
      id, clerk_user_id, email, full_name,
      usd_balance, grain_balance,
      circle_wallet_id, wallet_address,
      status, verification_level, created_at
    ) VALUES (
      ${accountId}, ${clerkUserId}, ${email}, ${fullName},
      0, 0,
      ${virtualWalletId}, ${WELLS_MASTER_WALLET_ADDRESS},
      'active', 'basic', NOW()
    )
  `;

  return {
    id: accountId,
    clerkUserId,
    email,
    fullName,
    usdBalance: 0,
    grainBalance: 0,
    virtualWalletId,
    status: 'active',
    createdAt: new Date(),
  };
}

export async function getAccountByClerkId(clerkUserId: string): Promise<WellsAccount | null> {
  const result = await sql`
    SELECT * FROM treasury_accounts
    WHERE clerk_user_id = ${clerkUserId}
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    fullName: row.full_name,
    usdBalance: parseFloat(row.usd_balance || '0'),
    grainBalance: parseFloat(row.grain_balance || '0'),
    virtualWalletId: row.circle_wallet_id || `vw_${row.id.replace(/-/g, '').slice(0, 16)}`,
    status: row.status || 'active',
    createdAt: row.created_at,
  };
}

export async function getAccountById(accountId: string): Promise<WellsAccount | null> {
  const result = await sql`
    SELECT * FROM treasury_accounts
    WHERE id = ${accountId}
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    fullName: row.full_name,
    usdBalance: parseFloat(row.usd_balance || '0'),
    grainBalance: parseFloat(row.grain_balance || '0'),
    virtualWalletId: row.circle_wallet_id || `vw_${row.id.replace(/-/g, '').slice(0, 16)}`,
    status: row.status || 'active',
    createdAt: row.created_at,
  };
}

// ============================================================================
// DEPOSITS (External funds -> Wells Master Wallet -> User Ledger)
// ============================================================================

export interface DepositResult {
  success: boolean;
  sessionId?: string;
  depositUrl?: string;
  error?: string;
}

/**
 * Create a deposit session
 * User pays via Circle on-ramp, funds go to Wells master wallet,
 * user's ledger balance is credited
 */
export async function createDeposit(
  accountId: string,
  amount: number,
  method: 'card' | 'ach' = 'card'
): Promise<DepositResult> {
  const account = await getAccountById(accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const sessionId = crypto.randomUUID();

  // Create deposit session in DB
  await sql`
    INSERT INTO deposit_sessions (
      id, account_id, amount, currency, status,
      created_at, expires_at
    ) VALUES (
      ${sessionId}, ${accountId}, ${amount}, 'USD', 'pending',
      NOW(), NOW() + INTERVAL '1 hour'
    )
  `;

  // Generate Circle on-ramp URL (funds go to master wallet)
  const isTestnet = CIRCLE_API_KEY.startsWith('TEST_');
  const baseUrl = isTestnet
    ? 'https://app-sandbox.circle.com/checkout'
    : 'https://app.circle.com/checkout';

  const depositUrl = `${baseUrl}?` + new URLSearchParams({
    destinationAddress: WELLS_MASTER_WALLET_ADDRESS,
    amount: amount.toString(),
    currency: 'USD',
    chain: isTestnet ? 'BASE-SEPOLIA' : 'BASE',
    'metadata[sessionId]': sessionId,
    'metadata[accountId]': accountId,
  }).toString();

  return {
    success: true,
    sessionId,
    depositUrl,
  };
}

/**
 * Complete a deposit (called by webhook or manual confirmation)
 * Credits user's ledger balance
 */
export async function completeDeposit(
  sessionId: string,
  circlePaymentId?: string
): Promise<{ success: boolean; error?: string }> {
  // Get the session
  const session = await sql`
    SELECT * FROM deposit_sessions WHERE id = ${sessionId}
  `;

  if (session.rows.length === 0) {
    return { success: false, error: 'Session not found' };
  }

  const { account_id, amount, status } = session.rows[0];

  if (status === 'completed') {
    return { success: true }; // Already completed
  }

  // Update session
  await sql`
    UPDATE deposit_sessions
    SET status = 'completed',
        circle_payment_id = ${circlePaymentId || null},
        completed_at = NOW()
    WHERE id = ${sessionId}
  `;

  // Credit user's ledger balance (1:1 USD to GRAIN)
  await sql`
    UPDATE treasury_accounts
    SET usd_balance = usd_balance + ${amount},
        grain_balance = grain_balance + ${amount}
    WHERE id = ${account_id}
  `;

  // Record transaction
  await sql`
    INSERT INTO grain_transactions (
      id, account_id, type, status,
      usd_amount, grain_amount,
      description, circle_transfer_id,
      created_at
    ) VALUES (
      ${crypto.randomUUID()}, ${account_id}, 'deposit', 'completed',
      ${amount}, ${amount},
      'Deposit via Circle', ${circlePaymentId || null},
      NOW()
    )
  `;

  // Audit log
  await sql`
    INSERT INTO payment_audit_log (account_id, action, details)
    VALUES (${account_id}, 'deposit', ${JSON.stringify({ amount, sessionId, circlePaymentId })})
  `;

  return { success: true };
}

// ============================================================================
// WITHDRAWALS (User Ledger -> Wells Master Wallet -> External bank)
// ============================================================================

export interface WithdrawalResult {
  success: boolean;
  withdrawalId?: string;
  estimatedArrival?: Date;
  error?: string;
}

/**
 * Request a withdrawal
 * Debits user's ledger, initiates payout from master wallet
 */
export async function requestWithdrawal(
  accountId: string,
  amount: number,
  bankDetails: {
    accountNumber: string;
    routingNumber: string;
    accountHolderName: string;
  }
): Promise<WithdrawalResult> {
  const account = await getAccountById(accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  if (account.grainBalance < amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  const withdrawalId = crypto.randomUUID();
  const fee = Math.max(amount * 0.001, 1); // 0.1% fee, min $1
  const netAmount = amount - fee;

  // Create withdrawal request
  await sql`
    INSERT INTO withdrawal_requests (
      id, account_id, amount, fee, net_amount, currency,
      bank_account_number_last4, bank_routing_number_last4, bank_account_holder_name,
      status, created_at, estimated_arrival
    ) VALUES (
      ${withdrawalId}, ${accountId}, ${amount}, ${fee}, ${netAmount}, 'USD',
      ${bankDetails.accountNumber.slice(-4)}, ${bankDetails.routingNumber.slice(-4)}, ${bankDetails.accountHolderName},
      'pending', NOW(), NOW() + INTERVAL '3 days'
    )
  `;

  // Debit user's ledger immediately
  await sql`
    UPDATE treasury_accounts
    SET usd_balance = usd_balance - ${amount},
        grain_balance = grain_balance - ${amount}
    WHERE id = ${accountId}
  `;

  // Record transaction
  await sql`
    INSERT INTO grain_transactions (
      id, account_id, type, status,
      usd_amount, grain_amount, fee_amount,
      description, created_at
    ) VALUES (
      ${crypto.randomUUID()}, ${accountId}, 'withdraw', 'processing',
      ${netAmount}, ${amount}, ${fee},
      'Withdrawal to bank', NOW()
    )
  `;

  // TODO: Initiate actual Circle payout from master wallet
  // This would call Circle's payout API

  return {
    success: true,
    withdrawalId,
    estimatedArrival: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  };
}

// ============================================================================
// INTERNAL TRANSFERS (User <-> User via ledger)
// ============================================================================

export interface TransferResult {
  success: boolean;
  transferId?: string;
  error?: string;
}

/**
 * Transfer GRAIN between users (ledger-to-ledger, no blockchain needed)
 * This is the core of frictionless payments
 */
export async function transfer(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  memo?: string
): Promise<TransferResult> {
  const fromAccount = await getAccountById(fromAccountId);
  const toAccount = await getAccountById(toAccountId);

  if (!fromAccount) {
    return { success: false, error: 'Sender account not found' };
  }
  if (!toAccount) {
    return { success: false, error: 'Recipient account not found' };
  }
  if (fromAccount.grainBalance < amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  const transferId = crypto.randomUUID();

  // Debit sender
  await sql`
    UPDATE treasury_accounts
    SET grain_balance = grain_balance - ${amount}
    WHERE id = ${fromAccountId}
  `;

  // Credit recipient
  await sql`
    UPDATE treasury_accounts
    SET grain_balance = grain_balance + ${amount}
    WHERE id = ${toAccountId}
  `;

  // Record transactions for both parties
  await sql`
    INSERT INTO grain_transactions (
      id, account_id, type, status,
      grain_amount, counterparty_id,
      description, created_at
    ) VALUES (
      ${transferId}, ${fromAccountId}, 'transfer_out', 'completed',
      ${amount}, ${toAccountId},
      ${memo || `Transfer to ${toAccount.fullName}`}, NOW()
    )
  `;

  await sql`
    INSERT INTO grain_transactions (
      id, account_id, type, status,
      grain_amount, counterparty_id,
      description, created_at
    ) VALUES (
      ${crypto.randomUUID()}, ${toAccountId}, 'transfer_in', 'completed',
      ${amount}, ${fromAccountId},
      ${memo || `Transfer from ${fromAccount.fullName}`}, NOW()
    )
  `;

  return { success: true, transferId };
}

/**
 * Transfer GRAIN by email (auto-creates account for recipient if needed)
 * This enables viral growth - anyone can receive GRAIN
 */
export async function transferByEmail(
  fromAccountId: string,
  toEmail: string,
  amount: number,
  memo?: string
): Promise<TransferResult> {
  // Check if recipient has an account
  const existing = await sql`
    SELECT id FROM treasury_accounts WHERE email = ${toEmail} LIMIT 1
  `;

  let toAccountId: string;

  if (existing.rows.length > 0) {
    toAccountId = existing.rows[0].id;
  } else {
    // Create pending account for recipient (they'll claim it when they sign up)
    toAccountId = crypto.randomUUID();
    const virtualWalletId = `vw_${toAccountId.replace(/-/g, '').slice(0, 16)}`;

    await sql`
      INSERT INTO treasury_accounts (
        id, email, full_name,
        usd_balance, grain_balance,
        circle_wallet_id, wallet_address,
        status, verification_level, created_at
      ) VALUES (
        ${toAccountId}, ${toEmail}, ${toEmail.split('@')[0]},
        0, 0,
        ${virtualWalletId}, ${WELLS_MASTER_WALLET_ADDRESS},
        'pending_claim', 'none', NOW()
      )
    `;
  }

  return transfer(fromAccountId, toAccountId, amount, memo);
}

// ============================================================================
// DEAL ESCROW (AI-to-AI negotiation settlements)
// ============================================================================

export interface EscrowResult {
  success: boolean;
  escrowId?: string;
  error?: string;
}

/**
 * Create escrow for a deal
 * Funds are held in buyer's ledger with 'escrow' status
 */
export async function createEscrow(
  dealId: string,
  buyerAccountId: string,
  sellerAccountId: string,
  amount: number,
  feeRate: number = STANDARD_FEE_RATE
): Promise<EscrowResult> {
  const buyer = await getAccountById(buyerAccountId);
  if (!buyer) {
    return { success: false, error: 'Buyer account not found' };
  }

  const fee = Math.max(amount * feeRate, MINIMUM_FEE);
  const totalRequired = amount + fee;

  if (buyer.grainBalance < totalRequired) {
    return { success: false, error: `Insufficient balance. Need ${totalRequired} GRAIN (${amount} + ${fee} fee)` };
  }

  const escrowId = crypto.randomUUID();

  // Hold funds in escrow (debit buyer, hold in escrow table)
  await sql`
    UPDATE treasury_accounts
    SET grain_balance = grain_balance - ${totalRequired}
    WHERE id = ${buyerAccountId}
  `;

  // Create escrow record
  await sql`
    INSERT INTO grain_transactions (
      id, account_id, type, status,
      grain_amount, fee_amount,
      counterparty_id, deal_id,
      description, created_at
    ) VALUES (
      ${escrowId}, ${buyerAccountId}, 'escrow_hold', 'held',
      ${amount}, ${fee},
      ${sellerAccountId}, ${dealId},
      'Deal escrow - funds held pending delivery', NOW()
    )
  `;

  return { success: true, escrowId };
}

/**
 * Release escrow after successful delivery
 * Pays seller (minus fee), fee goes to Wells treasury
 */
export async function releaseEscrow(
  escrowId: string
): Promise<{ success: boolean; error?: string }> {
  // Get escrow details
  const escrow = await sql`
    SELECT * FROM grain_transactions
    WHERE id = ${escrowId} AND type = 'escrow_hold' AND status = 'held'
  `;

  if (escrow.rows.length === 0) {
    return { success: false, error: 'Escrow not found or already released' };
  }

  const { account_id: buyerAccountId, counterparty_id: sellerAccountId, grain_amount, fee_amount } = escrow.rows[0];
  const sellerPayment = parseFloat(grain_amount);
  const wellsFee = parseFloat(fee_amount);

  // Pay seller
  await sql`
    UPDATE treasury_accounts
    SET grain_balance = grain_balance + ${sellerPayment}
    WHERE id = ${sellerAccountId}
  `;

  // Record seller receipt
  await sql`
    INSERT INTO grain_transactions (
      id, account_id, type, status,
      grain_amount, counterparty_id,
      description, created_at
    ) VALUES (
      ${crypto.randomUUID()}, ${sellerAccountId}, 'escrow_release', 'completed',
      ${sellerPayment}, ${buyerAccountId},
      'Payment received from deal', NOW()
    )
  `;

  // Record fee (stays in master wallet - Wells treasury)
  await sql`
    INSERT INTO grain_transactions (
      id, account_id, type, status,
      grain_amount, fee_amount,
      description, created_at
    ) VALUES (
      ${crypto.randomUUID()}, ${buyerAccountId}, 'platform_fee', 'completed',
      0, ${wellsFee},
      '1% success fee', NOW()
    )
  `;

  // Update escrow status
  await sql`
    UPDATE grain_transactions
    SET status = 'released'
    WHERE id = ${escrowId}
  `;

  return { success: true };
}

/**
 * Refund escrow (deal cancelled or dispute)
 */
export async function refundEscrow(
  escrowId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const escrow = await sql`
    SELECT * FROM grain_transactions
    WHERE id = ${escrowId} AND type = 'escrow_hold' AND status = 'held'
  `;

  if (escrow.rows.length === 0) {
    return { success: false, error: 'Escrow not found or already processed' };
  }

  const { account_id: buyerAccountId, grain_amount, fee_amount } = escrow.rows[0];
  const totalRefund = parseFloat(grain_amount) + parseFloat(fee_amount);

  // Refund buyer
  await sql`
    UPDATE treasury_accounts
    SET grain_balance = grain_balance + ${totalRefund}
    WHERE id = ${buyerAccountId}
  `;

  // Update escrow status
  await sql`
    UPDATE grain_transactions
    SET status = 'refunded', description = ${reason}
    WHERE id = ${escrowId}
  `;

  return { success: true };
}

// ============================================================================
// BALANCE & STATS
// ============================================================================

export async function getBalance(accountId: string): Promise<{
  usdBalance: number;
  grainBalance: number;
  escrowHeld: number;
  available: number;
} | null> {
  const account = await getAccountById(accountId);
  if (!account) return null;

  // Get escrowed amount
  const escrowResult = await sql`
    SELECT COALESCE(SUM(grain_amount + fee_amount), 0) as escrow_total
    FROM grain_transactions
    WHERE account_id = ${accountId}
    AND type = 'escrow_hold'
    AND status = 'held'
  `;

  const escrowHeld = parseFloat(escrowResult.rows[0]?.escrow_total || '0');

  return {
    usdBalance: account.usdBalance,
    grainBalance: account.grainBalance,
    escrowHeld,
    available: account.grainBalance, // Escrow already deducted from balance
  };
}

export async function getMasterWalletStats(): Promise<{
  totalUserBalances: number;
  totalEscrowHeld: number;
  totalFeesCollected: number;
  accountCount: number;
}> {
  const stats = await sql`
    SELECT
      COALESCE(SUM(grain_balance), 0) as total_balances,
      COUNT(*) as account_count
    FROM treasury_accounts
    WHERE status != 'pending_claim'
  `;

  const escrow = await sql`
    SELECT COALESCE(SUM(grain_amount + fee_amount), 0) as total
    FROM grain_transactions
    WHERE type = 'escrow_hold' AND status = 'held'
  `;

  const fees = await sql`
    SELECT COALESCE(SUM(fee_amount), 0) as total
    FROM grain_transactions
    WHERE type = 'platform_fee' AND status = 'completed'
  `;

  return {
    totalUserBalances: parseFloat(stats.rows[0]?.total_balances || '0'),
    totalEscrowHeld: parseFloat(escrow.rows[0]?.total || '0'),
    totalFeesCollected: parseFloat(fees.rows[0]?.total || '0'),
    accountCount: parseInt(stats.rows[0]?.account_count || '0'),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const WellsPayments = {
  // Account
  getOrCreateAccount,
  getAccountByClerkId,
  getAccountById,

  // Deposits & Withdrawals
  createDeposit,
  completeDeposit,
  requestWithdrawal,

  // Transfers
  transfer,
  transferByEmail,

  // Escrow
  createEscrow,
  releaseEscrow,
  refundEscrow,

  // Balance
  getBalance,
  getMasterWalletStats,

  // Constants
  STANDARD_FEE_RATE,
  WHITE_GLOVE_FEE_RATE,
  MINIMUM_FEE,
};

export default WellsPayments;
