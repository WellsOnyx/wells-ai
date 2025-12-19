/**
 * Grain & Vault - Circle Custodial Payments
 *
 * CUSTODIAL MODEL:
 * - All deposits go to Wells' master Circle wallet
 * - Users have ledger balances tracked in database
 * - Wells earns 4.5% APY on aggregate funds
 * - USDC on Base L2 (low fees)
 *
 * Uses Circle for:
 * - Master wallet management
 * - On-ramp (card/bank to USDC)
 * - Off-ramp (USDC to bank)
 */

import { Circle, CircleEnvironments } from '@circle-fin/circle-sdk';
import { sqlQuery as sql } from '@/lib/db';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || '';
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || '';
const CIRCLE_ENV = (process.env.CIRCLE_ENV || 'sandbox') as 'sandbox' | 'production';

// WELLS MASTER WALLET - All deposits go here for custodial management
// This wallet earns the 4.5% APY on aggregate funds
const WELLS_MASTER_WALLET_ID = process.env.WELLS_MASTER_WALLET_ID || '';
const WELLS_MASTER_WALLET_ADDRESS = process.env.WELLS_MASTER_WALLET_ADDRESS || '';

// APY Configuration
const WELLS_APY_RATE = 0.045; // 4.5% annual yield on aggregate funds

let circleClient: Circle | null = null;

function getCircle(): Circle {
  if (!circleClient) {
    if (!CIRCLE_API_KEY) {
      throw new Error('CIRCLE_API_KEY not configured');
    }
    circleClient = new Circle(
      CIRCLE_API_KEY,
      CIRCLE_ENV === 'production' ? CircleEnvironments.production : CircleEnvironments.sandbox
    );
  }
  return circleClient;
}

// ============================================================================
// TYPES
// ============================================================================

export interface GrainAccount {
  id: string;
  email: string;
  fullName: string;
  walletId: string;
  walletAddress: string;
  usdBalance: number;
  grainBalance: number;
  verificationLevel: 'basic' | 'intermediate' | 'advanced';
  status: 'pending' | 'active' | 'suspended';
}

export interface DepositSession {
  sessionId: string;
  redirectUrl: string;
  amount: number;
}

export interface WithdrawalResult {
  transactionId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedArrival: string;
}

// ============================================================================
// ACCOUNT CREATION (CUSTODIAL - NO INDIVIDUAL WALLETS)
// ============================================================================

/**
 * Create a new Grain & Vault custodial account
 *
 * CUSTODIAL MODEL:
 * - No individual Circle wallets created
 * - User gets a ledger balance in our database
 * - All funds are held in Wells' master wallet
 * - Wells earns 4.5% APY on aggregate funds
 */
export async function createAccount(params: {
  email: string;
  fullName: string;
  dateOfBirth?: string;
  phone?: string;
}): Promise<GrainAccount> {
  try {
    // Generate unique IDs
    const accountId = crypto.randomUUID();
    const userToken = `gv_${accountId.replace(/-/g, '')}`;

    // In custodial model, user doesn't get their own wallet
    // They get a ledger balance that represents their share of the master wallet
    // The "wallet address" is just a reference identifier for display purposes
    const virtualWalletId = `vw_${accountId.replace(/-/g, '').slice(0, 16)}`;

    // Create account in database (ledger-only, no Circle wallet)
    await sql`
      INSERT INTO treasury_accounts (
        id,
        email,
        full_name,
        date_of_birth,
        phone,
        wallet_address,
        circle_wallet_id,
        circle_wallet_set_id,
        circle_user_token,
        verification_level,
        status,
        usd_balance,
        grain_balance,
        daily_deposit_limit,
        daily_withdraw_limit,
        created_at,
        updated_at
      ) VALUES (
        ${accountId},
        ${params.email},
        ${params.fullName},
        ${params.dateOfBirth || null},
        ${params.phone || null},
        ${WELLS_MASTER_WALLET_ADDRESS},
        ${virtualWalletId},
        ${WELLS_MASTER_WALLET_ID},
        ${userToken},
        'basic',
        'active',
        0,
        0,
        10000,
        10000,
        NOW(),
        NOW()
      )
    `;

    return {
      id: accountId,
      email: params.email,
      fullName: params.fullName,
      walletId: virtualWalletId,
      walletAddress: WELLS_MASTER_WALLET_ADDRESS, // All users share master wallet
      usdBalance: 0,
      grainBalance: 0,
      verificationLevel: 'basic',
      status: 'active',
    };
  } catch (error: any) {
    console.error('Error creating account:', error);
    throw new Error(`Failed to create account: ${error.message}`);
  }
}

// ============================================================================
// DEPOSITS VIA CIRCLE ON-RAMP (CUSTODIAL)
// ============================================================================

/**
 * Create a deposit session using Circle's on-ramp
 *
 * CUSTODIAL: All deposits go to Wells' master wallet
 * - User pays via Circle checkout
 * - Funds arrive in WELLS_MASTER_WALLET_ADDRESS
 * - User's ledger balance is credited
 * - Wells earns 4.5% APY on aggregate funds
 */
export async function createDepositSession(
  accountId: string,
  amount: number
): Promise<DepositSession> {
  // Get account
  const accountResult = await sql`
    SELECT * FROM treasury_accounts WHERE id = ${accountId}
  `;

  if (accountResult.rows.length === 0) {
    throw new Error('Account not found');
  }

  const account = accountResult.rows[0];

  // Check limits
  const dailyLimit = parseFloat(account.daily_deposit_limit || '10000');
  if (amount > dailyLimit) {
    throw new Error(`Amount exceeds daily limit of $${dailyLimit}`);
  }

  // For Circle on-ramp, we use their hosted checkout
  // This redirects user to Circle's payment page
  const sessionId = crypto.randomUUID();

  // Store pending deposit
  await sql`
    INSERT INTO grain_transactions (
      id,
      account_id,
      type,
      usd_amount,
      grain_price,
      payment_method,
      status,
      description,
      created_at
    ) VALUES (
      ${sessionId},
      ${accountId},
      'deposit',
      ${amount},
      1,
      'circle_onramp',
      'pending',
      ${`Deposit of $${amount} via Circle (custodial)`},
      NOW()
    )
  `;

  // Circle on-ramp URL - IMPORTANT: destinationAddress is Wells' master wallet
  // All deposits go to our custodial wallet, we credit user's ledger balance
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wellsai.vercel.app';
  const masterWallet = WELLS_MASTER_WALLET_ADDRESS || process.env.WELLS_MASTER_WALLET_ADDRESS;

  const redirectUrl = CIRCLE_ENV === 'production'
    ? `https://pay.circle.com/checkout?` +
      `amount=${amount}&` +
      `currency=USD&` +
      `destinationAddress=${masterWallet}&` + // All funds go to Wells' master wallet
      `blockchain=BASE&` +
      `metadata[accountId]=${accountId}&` + // Track which user this deposit is for
      `metadata[sessionId]=${sessionId}&` +
      `successUrl=${encodeURIComponent(`${baseUrl}/grain-vault/deposit/success?session=${sessionId}`)}&` +
      `cancelUrl=${encodeURIComponent(`${baseUrl}/grain-vault/deposit/cancel?session=${sessionId}`)}`
    : `${baseUrl}/grain-vault/deposit/demo?session=${sessionId}&amount=${amount}`;

  return {
    sessionId,
    redirectUrl,
    amount,
  };
}

/**
 * Complete deposit after Circle on-ramp success
 */
export async function completeDeposit(sessionId: string): Promise<void> {
  // Get transaction
  const txResult = await sql`
    SELECT * FROM grain_transactions WHERE id = ${sessionId}
  `;

  if (txResult.rows.length === 0) {
    throw new Error('Transaction not found');
  }

  const tx = txResult.rows[0];

  if (tx.status === 'completed') {
    return; // Already completed
  }

  const amount = parseFloat(tx.usd_amount);

  // Update transaction
  await sql`
    UPDATE grain_transactions
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${sessionId}
  `;

  // Credit user's balance
  await sql`
    UPDATE treasury_accounts
    SET usd_balance = usd_balance + ${amount}, updated_at = NOW()
    WHERE id = ${tx.account_id}
  `;
}

/**
 * Cancel pending deposit
 */
export async function cancelDeposit(sessionId: string): Promise<void> {
  await sql`
    UPDATE grain_transactions
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${sessionId} AND status = 'pending'
  `;
}

// ============================================================================
// WITHDRAWALS VIA CIRCLE OFF-RAMP (CUSTODIAL)
// ============================================================================

/**
 * Withdraw USD to bank via Circle off-ramp
 *
 * CUSTODIAL: Funds are withdrawn from Wells' master wallet
 * - User requests withdrawal from their ledger balance
 * - Wells initiates Circle payout from master wallet
 * - User's ledger balance is debited
 */
export async function createWithdrawal(
  accountId: string,
  amount: number,
  bankDetails: {
    accountNumber: string;
    routingNumber: string;
    accountType: 'checking' | 'savings';
    accountHolderName: string;
  }
): Promise<WithdrawalResult> {
  const circle = getCircle();

  // Get account
  const accountResult = await sql`
    SELECT * FROM treasury_accounts WHERE id = ${accountId}
  `;

  if (accountResult.rows.length === 0) {
    throw new Error('Account not found');
  }

  const account = accountResult.rows[0];
  const currentBalance = parseFloat(account.usd_balance || '0');

  // Check balance
  if (currentBalance < amount) {
    throw new Error(`Insufficient balance. Available: $${currentBalance.toFixed(2)}`);
  }

  // Check limits
  const dailyLimit = parseFloat(account.daily_withdraw_limit || '10000');
  if (amount > dailyLimit) {
    throw new Error(`Amount exceeds daily limit of $${dailyLimit}`);
  }

  // Fee calculation (0.25% for ACH)
  const fee = Math.round(amount * 0.0025 * 100) / 100;
  const netAmount = amount - fee;

  const transactionId = crypto.randomUUID();

  try {
    // Create bank account in Circle (if not exists)
    // Note: In production, we'd store and reuse bank accounts
    const bankAccountResponse = await circle.payouts?.createBankAccount({
      idempotencyKey: `bank_${transactionId}`,
      accountNumber: bankDetails.accountNumber,
      routingNumber: bankDetails.routingNumber,
      billingDetails: {
        name: bankDetails.accountHolderName,
        line1: '123 Main St', // Required but not used for ACH
        city: 'New York',
        postalCode: '10001',
        country: 'US',
      },
      bankAddress: {
        country: 'US',
      },
    });

    const bankAccountId = bankAccountResponse?.data?.id;

    if (!bankAccountId) {
      throw new Error('Failed to create bank account');
    }

    // Initiate payout
    const payoutResponse = await circle.payouts?.createPayout({
      idempotencyKey: `payout_${transactionId}`,
      amount: {
        amount: netAmount.toFixed(2),
        currency: 'USD',
      },
      destination: {
        type: 'wire',
        id: bankAccountId,
      },
      metadata: {
        accountId,
        transactionId,
      },
    });

    const payoutId = payoutResponse?.data?.id;

    // Record transaction
    await sql`
      INSERT INTO grain_transactions (
        id,
        account_id,
        type,
        usd_amount,
        fee_usd,
        grain_price,
        payment_method,
        payment_reference,
        status,
        description,
        created_at
      ) VALUES (
        ${transactionId},
        ${accountId},
        'withdraw',
        ${amount},
        ${fee},
        1,
        'circle_offramp',
        ${payoutId || transactionId},
        'processing',
        ${`Withdrawal of $${netAmount.toFixed(2)} to bank (fee: $${fee.toFixed(2)})`},
        NOW()
      )
    `;

    // Debit balance immediately
    await sql`
      UPDATE treasury_accounts
      SET usd_balance = usd_balance - ${amount}, updated_at = NOW()
      WHERE id = ${accountId}
    `;

    // Estimate arrival (ACH is 2-3 business days)
    const estimatedArrival = new Date();
    estimatedArrival.setDate(estimatedArrival.getDate() + 3);

    return {
      transactionId,
      amount,
      fee,
      netAmount,
      status: 'processing',
      estimatedArrival: estimatedArrival.toISOString(),
    };
  } catch (error: any) {
    console.error('Withdrawal error:', error);
    throw new Error(`Failed to process withdrawal: ${error.message}`);
  }
}

// ============================================================================
// USDC TRANSFERS (Wallet to Wallet)
// ============================================================================

/**
 * Transfer USDC to another wallet
 */
export async function transferUSDC(
  accountId: string,
  toAddress: string,
  amount: number
): Promise<{ transferId: string; txHash?: string }> {
  const circle = getCircle();

  // Get account
  const accountResult = await sql`
    SELECT * FROM treasury_accounts WHERE id = ${accountId}
  `;

  if (accountResult.rows.length === 0) {
    throw new Error('Account not found');
  }

  const account = accountResult.rows[0];
  const currentBalance = parseFloat(account.usd_balance || '0');

  if (currentBalance < amount) {
    throw new Error(`Insufficient balance. Available: $${currentBalance.toFixed(2)}`);
  }

  const transferId = crypto.randomUUID();

  try {
    // Initiate USDC transfer
    const transferResponse = await circle.transfers?.createTransfer({
      idempotencyKey: `transfer_${transferId}`,
      source: {
        type: 'wallet',
        id: account.circle_wallet_id,
      },
      destination: {
        type: 'blockchain',
        address: toAddress,
        chain: 'BASE',
      },
      amount: {
        amount: amount.toFixed(2),
        currency: 'USD',
      },
    });

    const txHash = transferResponse?.data?.transactionHash;

    // Record transaction
    await sql`
      INSERT INTO grain_transactions (
        id,
        account_id,
        type,
        usd_amount,
        grain_price,
        payment_method,
        payment_reference,
        status,
        description,
        created_at
      ) VALUES (
        ${transferId},
        ${accountId},
        'transfer_out',
        ${amount},
        1,
        'usdc_transfer',
        ${txHash || transferId},
        'processing',
        ${`Transfer of $${amount} to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`},
        NOW()
      )
    `;

    // Debit balance
    await sql`
      UPDATE treasury_accounts
      SET usd_balance = usd_balance - ${amount}, updated_at = NOW()
      WHERE id = ${accountId}
    `;

    return { transferId, txHash };
  } catch (error: any) {
    console.error('Transfer error:', error);
    throw new Error(`Failed to transfer: ${error.message}`);
  }
}

// ============================================================================
// GRAIN OPERATIONS
// ============================================================================

/**
 * Buy GRAIN with USD balance
 */
export async function buyGrain(
  accountId: string,
  usdAmount: number
): Promise<{
  grainAmount: number;
  grainPrice: number;
  transactionId: string;
}> {
  // Get account
  const accountResult = await sql`
    SELECT * FROM treasury_accounts WHERE id = ${accountId}
  `;

  if (accountResult.rows.length === 0) {
    throw new Error('Account not found');
  }

  const account = accountResult.rows[0];
  const currentBalance = parseFloat(account.usd_balance || '0');

  if (currentBalance < usdAmount) {
    throw new Error(`Insufficient USD balance. Available: $${currentBalance.toFixed(2)}`);
  }

  // Get current GRAIN price
  let grainPrice = 1.0;
  try {
    const priceResult = await sql`SELECT * FROM get_grain_price()`;
    grainPrice = parseFloat(priceResult.rows[0]?.price_usd || '1');
  } catch (e) {
    // Use default price if function doesn't exist
  }

  const grainAmount = usdAmount / grainPrice;
  const transactionId = crypto.randomUUID();

  await sql`
    INSERT INTO grain_transactions (
      id,
      account_id,
      type,
      usd_amount,
      grain_amount,
      grain_price,
      status,
      description,
      created_at,
      completed_at
    ) VALUES (
      ${transactionId},
      ${accountId},
      'buy_grain',
      ${usdAmount},
      ${grainAmount},
      ${grainPrice},
      'completed',
      ${`Bought ${grainAmount.toFixed(6)} GRAIN @ $${grainPrice.toFixed(4)}`},
      NOW(),
      NOW()
    )
  `;

  await sql`
    UPDATE treasury_accounts
    SET
      usd_balance = usd_balance - ${usdAmount},
      grain_balance = grain_balance + ${grainAmount},
      updated_at = NOW()
    WHERE id = ${accountId}
  `;

  return { grainAmount, grainPrice, transactionId };
}

/**
 * Sell GRAIN for USD
 */
export async function sellGrain(
  accountId: string,
  grainAmount: number
): Promise<{
  usdAmount: number;
  grainPrice: number;
  fee: number;
  netAmount: number;
  transactionId: string;
}> {
  // Get account
  const accountResult = await sql`
    SELECT * FROM treasury_accounts WHERE id = ${accountId}
  `;

  if (accountResult.rows.length === 0) {
    throw new Error('Account not found');
  }

  const account = accountResult.rows[0];
  const currentGrainBalance = parseFloat(account.grain_balance || '0');

  if (currentGrainBalance < grainAmount) {
    throw new Error(`Insufficient GRAIN. Available: ${currentGrainBalance.toFixed(6)}`);
  }

  // Get current GRAIN price
  let grainPrice = 1.0;
  try {
    const priceResult = await sql`SELECT * FROM get_grain_price()`;
    grainPrice = parseFloat(priceResult.rows[0]?.price_usd || '1');
  } catch (e) {
    // Use default price
  }

  const usdAmount = grainAmount * grainPrice;
  const fee = usdAmount * 0.001; // 0.1% fee
  const netAmount = usdAmount - fee;
  const transactionId = crypto.randomUUID();

  await sql`
    INSERT INTO grain_transactions (
      id,
      account_id,
      type,
      usd_amount,
      grain_amount,
      grain_price,
      fee_usd,
      status,
      description,
      created_at,
      completed_at
    ) VALUES (
      ${transactionId},
      ${accountId},
      'sell_grain',
      ${netAmount},
      ${grainAmount},
      ${grainPrice},
      ${fee},
      'completed',
      ${`Sold ${grainAmount.toFixed(6)} GRAIN @ $${grainPrice.toFixed(4)}`},
      NOW(),
      NOW()
    )
  `;

  await sql`
    UPDATE treasury_accounts
    SET
      usd_balance = usd_balance + ${netAmount},
      grain_balance = grain_balance - ${grainAmount},
      updated_at = NOW()
    WHERE id = ${accountId}
  `;

  return { usdAmount, grainPrice, fee, netAmount, transactionId };
}

// ============================================================================
// ACCOUNT QUERIES
// ============================================================================

/**
 * Get account by ID
 */
export async function getAccount(accountId: string): Promise<GrainAccount | null> {
  const result = await sql`
    SELECT * FROM treasury_accounts WHERE id = ${accountId}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const account = result.rows[0];

  return {
    id: account.id,
    email: account.email,
    fullName: account.full_name,
    walletId: account.circle_wallet_id || '',
    walletAddress: account.wallet_address,
    usdBalance: parseFloat(account.usd_balance || '0'),
    grainBalance: parseFloat(account.grain_balance || '0'),
    verificationLevel: account.verification_level || 'basic',
    status: account.status || 'active',
  };
}

/**
 * Get account by email
 */
export async function getAccountByEmail(email: string): Promise<GrainAccount | null> {
  const result = await sql`
    SELECT id FROM treasury_accounts WHERE email = ${email}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return getAccount(result.rows[0].id);
}

/**
 * Get account by wallet address
 */
export async function getAccountByWallet(walletAddress: string): Promise<GrainAccount | null> {
  const result = await sql`
    SELECT id FROM treasury_accounts WHERE wallet_address = ${walletAddress}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return getAccount(result.rows[0].id);
}

/**
 * Get wallet balance from Circle
 */
export async function getWalletBalance(accountId: string): Promise<number> {
  const circle = getCircle();

  const accountResult = await sql`
    SELECT circle_wallet_id FROM treasury_accounts WHERE id = ${accountId}
  `;

  if (accountResult.rows.length === 0 || !accountResult.rows[0].circle_wallet_id) {
    throw new Error('Account or wallet not found');
  }

  try {
    const wallet = await circle.wallets?.getWallet(accountResult.rows[0].circle_wallet_id);
    const balance = wallet?.data?.balances?.find((b: any) => b.currency === 'USD');
    return parseFloat(balance?.amount || '0');
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return 0;
  }
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  accountId: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  type: string;
  usdAmount: number;
  grainAmount?: number;
  grainPrice?: number;
  fee?: number;
  status: string;
  description: string;
  createdAt: string;
  completedAt?: string;
}>> {
  const result = await sql`
    SELECT * FROM grain_transactions
    WHERE account_id = ${accountId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    usdAmount: parseFloat(row.usd_amount || '0'),
    grainAmount: row.grain_amount ? parseFloat(row.grain_amount) : undefined,
    grainPrice: row.grain_price ? parseFloat(row.grain_price) : undefined,
    fee: row.fee_usd ? parseFloat(row.fee_usd) : undefined,
    status: row.status,
    description: row.description || '',
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  }));
}

// ============================================================================
// CUSTODIAL TREASURY MANAGEMENT
// ============================================================================

/**
 * Get Wells' master wallet balance from Circle
 * This is the aggregate of all user deposits
 */
export async function getMasterWalletBalance(): Promise<{
  usdcBalance: number;
  totalUserLiabilities: number;
  netPosition: number;
  estimatedDailyYield: number;
}> {
  try {
    // For Programmable Wallets, we track balance via ledger
    // The actual USDC balance will be fetched via Circle Programmable Wallets API when needed
    // For now, use the sum of user balances as a proxy for master wallet balance
    let usdcBalance = 0;

    // Get total user liabilities (sum of all user balances)
    const liabilitiesResult = await sql`
      SELECT COALESCE(SUM(usd_balance), 0) as total_usd,
             COALESCE(SUM(grain_balance), 0) as total_grain
      FROM treasury_accounts
      WHERE status = 'active'
    `;

    const totalUserLiabilities = parseFloat(liabilitiesResult.rows[0]?.total_usd || '0');
    const netPosition = usdcBalance - totalUserLiabilities;

    // Calculate estimated daily yield (4.5% APY)
    const estimatedDailyYield = (usdcBalance * WELLS_APY_RATE) / 365;

    return {
      usdcBalance,
      totalUserLiabilities,
      netPosition,
      estimatedDailyYield,
    };
  } catch (error: any) {
    console.error('Error getting master wallet balance:', error);
    return {
      usdcBalance: 0,
      totalUserLiabilities: 0,
      netPosition: 0,
      estimatedDailyYield: 0,
    };
  }
}

/**
 * Get treasury statistics
 */
export async function getTreasuryStats(): Promise<{
  totalAccounts: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalUsdBalance: number;
  totalGrainBalance: number;
  estimatedAnnualYield: number;
}> {
  const accountsResult = await sql`
    SELECT
      COUNT(*) as total_accounts,
      COALESCE(SUM(usd_balance), 0) as total_usd,
      COALESCE(SUM(grain_balance), 0) as total_grain
    FROM treasury_accounts
    WHERE status = 'active'
  `;

  const depositsResult = await sql`
    SELECT COALESCE(SUM(usd_amount), 0) as total
    FROM grain_transactions
    WHERE type = 'deposit' AND status = 'completed'
  `;

  const withdrawalsResult = await sql`
    SELECT COALESCE(SUM(usd_amount), 0) as total
    FROM grain_transactions
    WHERE type = 'withdraw' AND status = 'completed'
  `;

  const totalUsdBalance = parseFloat(accountsResult.rows[0]?.total_usd || '0');
  const estimatedAnnualYield = totalUsdBalance * WELLS_APY_RATE;

  return {
    totalAccounts: parseInt(accountsResult.rows[0]?.total_accounts || '0'),
    totalDeposits: parseFloat(depositsResult.rows[0]?.total || '0'),
    totalWithdrawals: parseFloat(withdrawalsResult.rows[0]?.total || '0'),
    totalUsdBalance,
    totalGrainBalance: parseFloat(accountsResult.rows[0]?.total_grain || '0'),
    estimatedAnnualYield,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Account
  createAccount,
  getAccount,
  getAccountByEmail,
  getAccountByWallet,
  getWalletBalance,
  getTransactionHistory,

  // Deposits
  createDepositSession,
  completeDeposit,
  cancelDeposit,

  // Withdrawals
  createWithdrawal,

  // Transfers
  transferUSDC,

  // GRAIN
  buyGrain,
  sellGrain,

  // Custodial Treasury
  getMasterWalletBalance,
  getTreasuryStats,
};
