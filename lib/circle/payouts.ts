/**
 * Circle Payouts API - Bank Withdrawals (Off-ramp)
 *
 * Send funds from your Circle account to external bank accounts.
 *
 * Flow:
 * 1. Create bank account (wire/ACH details)
 * 2. Create payout to that bank account
 * 3. Circle processes and sends to bank
 * 4. Webhook confirms completion (2-3 business days for ACH)
 *
 * Endpoints used:
 * - POST /v1/banks/wires - Create wire bank account
 * - POST /v1/banks/ach - Create ACH bank account (US only)
 * - POST /v1/payouts - Create payout
 * - GET /v1/payouts/{id} - Get payout status
 *
 * Docs: https://developers.circle.com/circle-mint/reference/createpayout
 */

import { CIRCLE_CONFIG, circleRequest, generateIdempotencyKey } from './config'

// =============================================================================
// TYPES
// =============================================================================

export interface BankAccount {
  id: string
  status: 'pending' | 'complete' | 'failed'
  description: string
  trackingRef: string
  fingerprint: string
  billingDetails: {
    name: string
    line1: string
    city: string
    postalCode: string
    country: string
  }
  bankAddress: {
    bankName?: string
    city?: string
    country: string
  }
  createDate: string
  updateDate: string
}

export interface Payout {
  id: string
  sourceWalletId: string
  destination: {
    type: 'wire' | 'ach'
    id: string
    name: string
  }
  amount: {
    amount: string
    currency: string
  }
  fees: {
    amount: string
    currency: string
  }
  status: 'pending' | 'complete' | 'failed'
  trackingRef?: string
  externalRef?: string
  errorCode?: string
  riskEvaluation?: {
    decision: string
    reason: string
  }
  createDate: string
  updateDate: string
}

export interface CreateBankAccountParams {
  type: 'wire' | 'ach'
  // For ACH (US only)
  accountNumber?: string
  routingNumber?: string
  // For Wire (international)
  iban?: string
  // Common fields
  billingDetails: {
    name: string
    line1: string
    line2?: string
    city: string
    postalCode: string
    country: string // ISO 3166-1 alpha-2
  }
  bankAddress: {
    bankName?: string
    city?: string
    country: string
  }
}

export interface CreatePayoutParams {
  amount: number // USD amount
  bankAccountId: string
  userId: string
  metadata?: Record<string, string>
}

// =============================================================================
// BANK ACCOUNT OPERATIONS
// =============================================================================

/**
 * Create an ACH bank account (US only)
 */
export async function createACHBankAccount(params: {
  accountNumber: string
  routingNumber: string
  accountHolderName: string
  billingAddress: {
    line1: string
    city: string
    state: string
    postalCode: string
  }
}): Promise<{ success: boolean; bankAccount?: BankAccount; error?: string }> {
  const { accountNumber, routingNumber, accountHolderName, billingAddress } = params

  const idempotencyKey = generateIdempotencyKey('ach', accountNumber.slice(-4))

  const response = await circleRequest<BankAccount>('/banks/ach', {
    method: 'POST',
    body: {
      idempotencyKey,
      accountNumber,
      routingNumber,
      billingDetails: {
        name: accountHolderName,
        line1: billingAddress.line1,
        city: billingAddress.city,
        district: billingAddress.state, // Circle uses "district" for US states
        postalCode: billingAddress.postalCode,
        country: 'US',
      },
      bankAddress: {
        country: 'US',
      },
    },
  })

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Failed to create bank account',
    }
  }

  return {
    success: true,
    bankAccount: response.data,
  }
}

/**
 * Create a wire bank account (international)
 */
export async function createWireBankAccount(params: {
  iban: string
  accountHolderName: string
  billingAddress: {
    line1: string
    city: string
    postalCode: string
    country: string
  }
  bankAddress: {
    bankName: string
    city: string
    country: string
  }
}): Promise<{ success: boolean; bankAccount?: BankAccount; error?: string }> {
  const { iban, accountHolderName, billingAddress, bankAddress } = params

  const idempotencyKey = generateIdempotencyKey('wire', iban.slice(-4))

  const response = await circleRequest<BankAccount>('/banks/wires', {
    method: 'POST',
    body: {
      idempotencyKey,
      iban,
      billingDetails: {
        name: accountHolderName,
        line1: billingAddress.line1,
        city: billingAddress.city,
        postalCode: billingAddress.postalCode,
        country: billingAddress.country,
      },
      bankAddress: {
        bankName: bankAddress.bankName,
        city: bankAddress.city,
        country: bankAddress.country,
      },
    },
  })

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Failed to create wire account',
    }
  }

  return {
    success: true,
    bankAccount: response.data,
  }
}

/**
 * Get bank account details
 */
export async function getBankAccount(
  bankAccountId: string,
  type: 'wire' | 'ach' = 'ach'
): Promise<{ success: boolean; bankAccount?: BankAccount; error?: string }> {
  const endpoint = type === 'ach'
    ? `/banks/ach/${bankAccountId}`
    : `/banks/wires/${bankAccountId}`

  const response = await circleRequest<BankAccount>(endpoint)

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Bank account not found',
    }
  }

  return {
    success: true,
    bankAccount: response.data,
  }
}

// =============================================================================
// PAYOUT OPERATIONS
// =============================================================================

/**
 * Create a payout to a bank account
 */
export async function createPayout(
  params: CreatePayoutParams
): Promise<{ success: boolean; payout?: Payout; error?: string }> {
  const { amount, bankAccountId, userId, metadata = {} } = params

  // Validate amount
  if (amount < 1) {
    return { success: false, error: 'Minimum payout is $1' }
  }

  // Circle has a fee for payouts - typically $25 for wire, $0.25 for ACH
  // Check your Circle account for exact fees

  const idempotencyKey = generateIdempotencyKey('payout', userId, bankAccountId)

  const response = await circleRequest<Payout>('/payouts', {
    method: 'POST',
    body: {
      idempotencyKey,
      destination: {
        type: 'wire', // or 'ach' based on bank account type
        id: bankAccountId,
      },
      amount: {
        amount: amount.toFixed(2),
        currency: 'USD',
      },
      metadata: {
        userId,
        ...metadata,
      },
    },
  })

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Failed to create payout',
    }
  }

  return {
    success: true,
    payout: response.data,
  }
}

/**
 * Get payout status
 */
export async function getPayoutStatus(
  payoutId: string
): Promise<{ success: boolean; payout?: Payout; error?: string }> {
  const response = await circleRequest<Payout>(`/payouts/${payoutId}`)

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Payout not found',
    }
  }

  return {
    success: true,
    payout: response.data,
  }
}

/**
 * List payouts (with optional filters)
 */
export async function listPayouts(params?: {
  status?: 'pending' | 'complete' | 'failed'
  destinationId?: string
  pageSize?: number
}): Promise<{ success: boolean; payouts?: Payout[]; error?: string }> {
  const queryParams = new URLSearchParams()
  if (params?.status) queryParams.append('status', params.status)
  if (params?.destinationId) queryParams.append('destination', params.destinationId)
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())

  const endpoint = `/payouts${queryParams.toString() ? `?${queryParams}` : ''}`
  const response = await circleRequest<{ data: Payout[] }>(endpoint)

  if (!response.success) {
    return {
      success: false,
      error: response.error || 'Failed to list payouts',
    }
  }

  return {
    success: true,
    payouts: response.data?.data || [],
  }
}

// =============================================================================
// WITHDRAWAL FLOW
// =============================================================================

export interface WithdrawalRequest {
  userId: string
  amount: number
  bankDetails: {
    type: 'ach' | 'wire'
    accountNumber?: string
    routingNumber?: string
    iban?: string
    accountHolderName: string
    billingAddress: {
      line1: string
      city: string
      state?: string
      postalCode: string
      country: string
    }
    bankName?: string
    bankCity?: string
    bankCountry?: string
  }
}

export interface WithdrawalResult {
  success: boolean
  payoutId?: string
  bankAccountId?: string
  amount?: number
  fee?: number
  netAmount?: number
  estimatedArrival?: string
  error?: string
}

/**
 * Process a complete withdrawal (create bank account + payout)
 */
export async function processWithdrawal(
  request: WithdrawalRequest
): Promise<WithdrawalResult> {
  const { userId, amount, bankDetails } = request

  // Fee calculation
  const fee = bankDetails.type === 'wire' ? 25 : 0.25 // Example fees
  const netAmount = amount - fee

  if (netAmount <= 0) {
    return { success: false, error: `Amount too small after $${fee} fee` }
  }

  // Step 1: Create bank account
  let bankAccountResult
  if (bankDetails.type === 'ach') {
    bankAccountResult = await createACHBankAccount({
      accountNumber: bankDetails.accountNumber!,
      routingNumber: bankDetails.routingNumber!,
      accountHolderName: bankDetails.accountHolderName,
      billingAddress: {
        line1: bankDetails.billingAddress.line1,
        city: bankDetails.billingAddress.city,
        state: bankDetails.billingAddress.state || '',
        postalCode: bankDetails.billingAddress.postalCode,
      },
    })
  } else {
    bankAccountResult = await createWireBankAccount({
      iban: bankDetails.iban!,
      accountHolderName: bankDetails.accountHolderName,
      billingAddress: {
        line1: bankDetails.billingAddress.line1,
        city: bankDetails.billingAddress.city,
        postalCode: bankDetails.billingAddress.postalCode,
        country: bankDetails.billingAddress.country,
      },
      bankAddress: {
        bankName: bankDetails.bankName || '',
        city: bankDetails.bankCity || '',
        country: bankDetails.bankCountry || bankDetails.billingAddress.country,
      },
    })
  }

  if (!bankAccountResult.success || !bankAccountResult.bankAccount) {
    return {
      success: false,
      error: bankAccountResult.error || 'Failed to create bank account',
    }
  }

  // Step 2: Create payout
  const payoutResult = await createPayout({
    amount: netAmount,
    bankAccountId: bankAccountResult.bankAccount.id,
    userId,
    metadata: {
      originalAmount: amount.toString(),
      fee: fee.toString(),
    },
  })

  if (!payoutResult.success || !payoutResult.payout) {
    return {
      success: false,
      bankAccountId: bankAccountResult.bankAccount.id,
      error: payoutResult.error || 'Failed to create payout',
    }
  }

  // Estimate arrival
  const estimatedArrival = new Date()
  estimatedArrival.setDate(estimatedArrival.getDate() + (bankDetails.type === 'wire' ? 1 : 3))

  return {
    success: true,
    payoutId: payoutResult.payout.id,
    bankAccountId: bankAccountResult.bankAccount.id,
    amount,
    fee,
    netAmount,
    estimatedArrival: estimatedArrival.toISOString(),
  }
}

// =============================================================================
// WEBHOOK PROCESSING
// =============================================================================

export interface PayoutWebhookEvent {
  type: string
  payout?: Payout
}

/**
 * Parse payout webhook event
 */
export function parsePayoutWebhook(payload: any): {
  type: 'payout' | 'bank_account' | 'unknown'
  event: string
  payoutId?: string
  bankAccountId?: string
  status?: string
  amount?: number
  userId?: string
} {
  const eventType = payload.type || ''

  if (eventType.startsWith('payout')) {
    const payout = payload.payout
    return {
      type: 'payout',
      event: eventType,
      payoutId: payout?.id,
      status: payout?.status,
      amount: payout?.amount ? parseFloat(payout.amount.amount) : undefined,
      userId: payout?.metadata?.userId,
    }
  }

  if (eventType.includes('bank')) {
    const bankAccount = payload.bankAccount
    return {
      type: 'bank_account',
      event: eventType,
      bankAccountId: bankAccount?.id,
      status: bankAccount?.status,
    }
  }

  return { type: 'unknown', event: eventType }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Bank accounts
  createACHBankAccount,
  createWireBankAccount,
  getBankAccount,

  // Payouts
  createPayout,
  getPayoutStatus,
  listPayouts,

  // Complete flow
  processWithdrawal,

  // Webhooks
  parsePayoutWebhook,
}
