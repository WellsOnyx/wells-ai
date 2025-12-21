/**
 * GRAIN Token - Circle Native Implementation
 *
 * Uses Circle's Programmable Wallets SDK to create GRAIN as an internal
 * accounting layer on top of USDC. This approach:
 *
 * 1. GRAIN = Internal ledger balance (our database)
 * 2. USDC = Actual custody (Circle wallets)
 * 3. 1 GRAIN = 1 USDC always
 *
 * Benefits:
 * - No smart contract deployment needed
 * - Circle handles custody, compliance, KYC
 * - Instant transfers between Circle wallets
 * - Real USDC backing at all times
 * - Circle's security and insurance
 */

import { sql } from '@vercel/postgres'

// Circle SDK configuration
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY
const CIRCLE_MASTER_WALLET_ID = process.env.CIRCLE_MASTER_WALLET_ID
const CIRCLE_API_URL = 'https://api.circle.com/v1'

// ============================================================================
// TYPES
// ============================================================================

export interface GrainBalance {
  userId: string
  grainBalance: number
  usdcValue: number
  walletId: string | null
  walletAddress: string | null
  lastSyncAt: Date | null
}

export interface GrainTransaction {
  id: string
  type: 'deposit' | 'withdraw' | 'transfer' | 'escrow_lock' | 'escrow_release' | 'fee'
  amount: number
  fromUserId: string | null
  toUserId: string | null
  dealId: string | null
  status: 'pending' | 'completed' | 'failed'
  circleTransferId: string | null
  createdAt: Date
}

export interface DepositResult {
  success: boolean
  grainAmount: number
  depositAddress: string
  instructions: string
}

export interface WithdrawResult {
  success: boolean
  grainAmount: number
  usdcAmount: number
  circleTransferId: string
  estimatedArrival: string
}

// ============================================================================
// CIRCLE API HELPERS
// ============================================================================

async function circleRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
) {
  const response = await fetch(`${CIRCLE_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${CIRCLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Circle API error: ${error}`)
  }

  return response.json()
}

/**
 * Create a Circle wallet for a user
 */
export async function createUserWallet(userId: string): Promise<{
  walletId: string
  address: string
}> {
  const result = await circleRequest('/w3s/developer/wallets', 'POST', {
    idempotencyKey: `wallet-${userId}-${Date.now()}`,
    entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET,
    walletSetId: process.env.CIRCLE_WALLET_SET_ID,
    count: 1,
    blockchains: ['BASE'],
  })

  const wallet = result.data.wallets[0]

  // Store wallet info in database
  await sql`
    INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance)
    VALUES (${userId}, ${wallet.id}, ${wallet.address}, 0)
    ON CONFLICT (user_id)
    DO UPDATE SET wallet_id = ${wallet.id}, wallet_address = ${wallet.address}
  `

  return {
    walletId: wallet.id,
    address: wallet.address,
  }
}

/**
 * Get or create wallet for user
 */
export async function getOrCreateWallet(userId: string): Promise<{
  walletId: string
  address: string
}> {
  // Check if user already has a wallet
  const existing = await sql`
    SELECT wallet_id, wallet_address FROM user_wallets WHERE user_id = ${userId}
  `

  if (existing.rows.length > 0 && existing.rows[0].wallet_id) {
    return {
      walletId: existing.rows[0].wallet_id,
      address: existing.rows[0].wallet_address,
    }
  }

  // Create new wallet
  return createUserWallet(userId)
}

// ============================================================================
// GRAIN LEDGER OPERATIONS (Database)
// ============================================================================

/**
 * Get user's GRAIN balance
 */
export async function getGrainBalance(userId: string): Promise<GrainBalance> {
  const result = await sql`
    SELECT
      user_id,
      balance as grain_balance,
      wallet_id,
      wallet_address,
      updated_at as last_sync_at
    FROM user_wallets
    WHERE user_id = ${userId}
  `

  if (result.rows.length === 0) {
    return {
      userId,
      grainBalance: 0,
      usdcValue: 0,
      walletId: null,
      walletAddress: null,
      lastSyncAt: null,
    }
  }

  const row = result.rows[0]
  const balance = parseFloat(row.grain_balance) || 0

  return {
    userId,
    grainBalance: balance,
    usdcValue: balance, // 1:1 with USDC
    walletId: row.wallet_id,
    walletAddress: row.wallet_address,
    lastSyncAt: row.last_sync_at,
  }
}

/**
 * Credit GRAIN to user (after USDC deposit confirmed)
 */
export async function creditGrain(
  userId: string,
  amount: number,
  reason: string,
  circleTransferId?: string
): Promise<void> {
  await sql`
    UPDATE user_wallets
    SET
      balance = balance + ${amount},
      updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Log transaction
  await sql`
    INSERT INTO grain_transactions (
      user_id, type, amount, reason, circle_transfer_id, status, created_at
    ) VALUES (
      ${userId}, 'deposit', ${amount}, ${reason}, ${circleTransferId || null}, 'completed', NOW()
    )
  `
}

/**
 * Debit GRAIN from user (before USDC withdrawal)
 *
 * CRITICAL FIX: Uses atomic conditional update to prevent race conditions.
 * The previous implementation had a TOCTOU (time-of-check-to-time-of-use)
 * vulnerability where multiple concurrent requests could pass the balance
 * check but all proceed to debit, resulting in negative balances.
 *
 * This fix uses a single atomic UPDATE with a WHERE clause that ensures
 * the balance is sufficient at the moment of update.
 */
export async function debitGrain(
  userId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  // CRITICAL: Use atomic conditional update to prevent double-spending
  // This single query atomically checks balance AND updates in one operation
  const result = await sql`
    UPDATE user_wallets
    SET
      balance = balance - ${amount},
      updated_at = NOW()
    WHERE user_id = ${userId}
      AND balance >= ${amount}
    RETURNING user_id, balance as new_balance
  `

  // If no rows were updated, either user doesn't exist or insufficient balance
  if (result.rows.length === 0) {
    return false
  }

  // Log the debit transaction
  await sql`
    INSERT INTO grain_transactions (
      user_id, type, amount, reason, status, created_at
    ) VALUES (
      ${userId}, 'debit', ${amount}, ${reason}, 'completed', NOW()
    )
  `

  return true
}

/**
 * Transfer GRAIN between users (internal ledger transfer)
 */
export async function transferGrain(
  fromUserId: string,
  toUserId: string,
  amount: number,
  dealId?: string,
  memo?: string
): Promise<{ success: boolean; transactionId: string }> {
  // Ensure recipient has a wallet record
  const toBalance = await getGrainBalance(toUserId)
  if (!toBalance.walletId) {
    await sql`
      INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance)
      VALUES (${toUserId}, NULL, NULL, 0)
      ON CONFLICT (user_id) DO NOTHING
    `
  }

  // Atomic transfer
  const result = await sql`
    WITH debit AS (
      UPDATE user_wallets
      SET balance = balance - ${amount}, updated_at = NOW()
      WHERE user_id = ${fromUserId} AND balance >= ${amount}
      RETURNING user_id
    ),
    credit AS (
      UPDATE user_wallets
      SET balance = balance + ${amount}, updated_at = NOW()
      WHERE user_id = ${toUserId}
        AND EXISTS (SELECT 1 FROM debit)
      RETURNING user_id
    )
    INSERT INTO grain_transactions (
      user_id, type, amount, to_user_id, deal_id, reason, status, created_at
    )
    SELECT
      ${fromUserId}, 'transfer', ${amount}, ${toUserId}, ${dealId || null}, ${memo || 'Transfer'}, 'completed', NOW()
    WHERE EXISTS (SELECT 1 FROM credit)
    RETURNING id
  `

  if (result.rows.length === 0) {
    return { success: false, transactionId: '' }
  }

  return {
    success: true,
    transactionId: result.rows[0].id,
  }
}

// ============================================================================
// DEPOSIT & WITHDRAW (Circle USDC <-> GRAIN Ledger)
// ============================================================================

/**
 * Initiate USDC deposit (returns address for user to send USDC)
 */
export async function initiateDeposit(userId: string): Promise<DepositResult> {
  const wallet = await getOrCreateWallet(userId)

  return {
    success: true,
    grainAmount: 0, // Will be credited when deposit confirms
    depositAddress: wallet.address,
    instructions: `Send USDC (Base L2) to ${wallet.address}. Your GRAIN balance will be credited automatically after 1 confirmation.`,
  }
}

/**
 * Process confirmed USDC deposit (called by webhook)
 */
export async function processDeposit(
  walletAddress: string,
  usdcAmount: number,
  circleTransferId: string
): Promise<void> {
  // Find user by wallet address
  const userResult = await sql`
    SELECT user_id FROM user_wallets WHERE wallet_address = ${walletAddress}
  `

  if (userResult.rows.length === 0) {
    console.error('No user found for wallet:', walletAddress)
    return
  }

  const userId = userResult.rows[0].user_id

  // Credit GRAIN (1:1 with USDC)
  await creditGrain(userId, usdcAmount, 'USDC deposit', circleTransferId)
}

/**
 * Initiate USDC withdrawal
 *
 * CRITICAL FIX: Uses a pending withdrawal pattern to handle Circle API failures.
 * If Circle transfer fails after GRAIN is debited, we automatically re-credit
 * the user's balance. This prevents fund loss due to API failures.
 */
export async function initiateWithdraw(
  userId: string,
  grainAmount: number,
  destinationAddress: string,
  idempotencyKey?: string
): Promise<WithdrawResult> {
  // Generate idempotency key if not provided
  const effectiveIdempotencyKey = idempotencyKey || `withdraw-${userId}-${Date.now()}`

  // Check for existing withdrawal with same idempotency key
  const existingResult = await sql`
    SELECT id, circle_transfer_id, status
    FROM grain_transactions
    WHERE idempotency_key = ${effectiveIdempotencyKey}
      AND user_id = ${userId}
      AND type = 'withdraw'
  `

  if (existingResult.rows.length > 0) {
    const existing = existingResult.rows[0]
    return {
      success: true,
      grainAmount,
      usdcAmount: grainAmount,
      circleTransferId: existing.circle_transfer_id || '',
      estimatedArrival: '~2 minutes (Base L2)',
    }
  }

  // Debit GRAIN first using atomic operation
  const debited = await debitGrain(userId, grainAmount, 'USDC withdrawal')
  if (!debited) {
    throw new Error('Insufficient GRAIN balance')
  }

  // Get user's Circle wallet
  const wallet = await getOrCreateWallet(userId)

  // Attempt Circle transfer with error recovery
  let circleTransferId: string
  try {
    const result = await circleRequest('/w3s/developer/transactions/transfer', 'POST', {
      idempotencyKey: effectiveIdempotencyKey,
      entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET,
      amounts: [grainAmount.toString()],
      destinationAddress,
      tokenId: process.env.CIRCLE_USDC_TOKEN_ID,
      walletId: CIRCLE_MASTER_WALLET_ID,
      blockchain: 'BASE',
    })
    circleTransferId = result.data.id
  } catch (circleError) {
    // CRITICAL: Circle API failed after GRAIN was debited
    // Re-credit the user's balance to prevent fund loss
    console.error('Circle transfer failed, reversing GRAIN debit:', circleError)

    await sql`
      UPDATE user_wallets
      SET balance = balance + ${grainAmount}, updated_at = NOW()
      WHERE user_id = ${userId}
    `

    // Log the failed attempt
    await sql`
      INSERT INTO grain_transactions (
        user_id, type, amount, reason, status, idempotency_key, created_at, metadata
      ) VALUES (
        ${userId}, 'withdraw_failed', ${grainAmount},
        ${'Circle API failed: ' + (circleError instanceof Error ? circleError.message : 'Unknown error')},
        'failed', ${effectiveIdempotencyKey}, NOW(),
        ${JSON.stringify({ destinationAddress: destinationAddress.substring(0, 10) + '...' })}::jsonb
      )
    `

    throw new Error('Withdrawal failed due to payment processor error. Your balance has been restored. Please try again.')
  }

  // Log successful transaction
  await sql`
    INSERT INTO grain_transactions (
      user_id, type, amount, reason, circle_transfer_id, status, idempotency_key, created_at
    ) VALUES (
      ${userId}, 'withdraw', ${grainAmount},
      ${'USDC withdrawal to ' + destinationAddress.substring(0, 10) + '...'},
      ${circleTransferId}, 'pending', ${effectiveIdempotencyKey}, NOW()
    )
  `

  return {
    success: true,
    grainAmount,
    usdcAmount: grainAmount, // 1:1
    circleTransferId,
    estimatedArrival: '~2 minutes (Base L2)',
  }
}

// ============================================================================
// ESCROW OPERATIONS (For deals)
// ============================================================================

const ESCROW_USER_ID = 'WELLS_ESCROW_ACCOUNT'

/**
 * Lock GRAIN in escrow for a deal
 */
export async function lockEscrow(
  buyerUserId: string,
  amount: number,
  dealId: string
): Promise<{ success: boolean; escrowId: string }> {
  // Ensure escrow account exists
  await sql`
    INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance)
    VALUES (${ESCROW_USER_ID}, 'ESCROW', 'ESCROW', 0)
    ON CONFLICT (user_id) DO NOTHING
  `

  // Transfer to escrow
  return transferGrain(buyerUserId, ESCROW_USER_ID, amount, dealId, 'Escrow lock')
}

/**
 * Release escrow to supplier
 */
export async function releaseEscrow(
  supplierUserId: string,
  amount: number,
  dealId: string,
  feeAmount: number = 0
): Promise<{ success: boolean; netAmount: number; feeCollected: number }> {
  const netAmount = amount - feeAmount

  // Transfer net amount to supplier
  const supplierTransfer = await transferGrain(
    ESCROW_USER_ID,
    supplierUserId,
    netAmount,
    dealId,
    'Escrow release - payment'
  )

  if (!supplierTransfer.success) {
    return { success: false, netAmount: 0, feeCollected: 0 }
  }

  // Collect fee to Wells treasury
  if (feeAmount > 0) {
    await transferGrain(
      ESCROW_USER_ID,
      'WELLS_TREASURY',
      feeAmount,
      dealId,
      'Transaction fee'
    )
  }

  return {
    success: true,
    netAmount,
    feeCollected: feeAmount,
  }
}

/**
 * Refund escrow to buyer (deal cancelled)
 */
export async function refundEscrow(
  buyerUserId: string,
  amount: number,
  dealId: string
): Promise<{ success: boolean }> {
  return transferGrain(ESCROW_USER_ID, buyerUserId, amount, dealId, 'Escrow refund')
}

// ============================================================================
// TREASURY STATS
// ============================================================================

/**
 * Get total GRAIN in circulation
 */
export async function getTotalGrainSupply(): Promise<{
  totalSupply: number
  totalUsers: number
  escrowBalance: number
  treasuryBalance: number
}> {
  const result = await sql`
    SELECT
      SUM(balance) as total_supply,
      COUNT(*) as total_users,
      SUM(CASE WHEN user_id = 'WELLS_ESCROW_ACCOUNT' THEN balance ELSE 0 END) as escrow_balance,
      SUM(CASE WHEN user_id = 'WELLS_TREASURY' THEN balance ELSE 0 END) as treasury_balance
    FROM user_wallets
  `

  const row = result.rows[0]
  return {
    totalSupply: parseFloat(row.total_supply) || 0,
    totalUsers: parseInt(row.total_users) || 0,
    escrowBalance: parseFloat(row.escrow_balance) || 0,
    treasuryBalance: parseFloat(row.treasury_balance) || 0,
  }
}
