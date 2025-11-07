/**
 * Circle API Integration for B2B Payments
 *
 * Handles USDC/EURC payments with instant settlement via Circle
 * Replaces traditional 30-60 day payment cycles with 1-2 day payouts
 */

import { Circle, CircleEnvironments } from '@circle-fin/circle-sdk'

// Initialize Circle client
const getCircleClient = () => {
  const apiKey = process.env.CIRCLE_API_KEY

  if (!apiKey) {
    throw new Error('CIRCLE_API_KEY environment variable not set')
  }

  // Use sandbox for testing, production for live
  const environment = process.env.NODE_ENV === 'production'
    ? CircleEnvironments.production
    : CircleEnvironments.sandbox

  return new Circle(apiKey, environment)
}

export interface CirclePaymentIntent {
  id: string
  amount: number // in cents
  currency: 'USD' | 'EUR'
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled'
  sellerId: string
  buyerId: string
  dealId: string
  fee: number // in cents
  netAmount: number // amount - fee
  createdAt: Date
  confirmedAt?: Date
}

export interface CircleWallet {
  id: string
  userId: string
  address: string
  balance: number // in cents (USDC/EURC)
  currency: 'USD' | 'EUR'
  createdAt: Date
}

/**
 * Create a payment intent for a B2B transaction
 * Puts funds into escrow until seller ships
 */
export async function createPaymentIntent(params: {
  buyerId: string
  sellerId: string
  dealId: string
  amount: number // in cents
  currency: 'USD' | 'EUR'
  feePercentage: number // 0.0033 for 33 bps, 0.033 for 3.3%, 0.07 for 7%
  description?: string
}): Promise<CirclePaymentIntent> {
  const circle = getCircleClient()

  const fee = Math.round(params.amount * params.feePercentage)
  const netAmount = params.amount - fee

  try {
    // Create payment in Circle
    const payment = await circle.payments.createPayment({
      idempotencyKey: `deal_${params.dealId}_${Date.now()}`,
      amount: {
        amount: (params.amount / 100).toFixed(2), // Convert cents to dollars
        currency: params.currency as 'USD' // Circle SDK only supports USD for now
      },
      source: {
        type: 'wallet' as 'card', // Circle SDK type mismatch
        id: params.buyerId // Buyer's Circle wallet ID
      },
      verification: 'none' as any, // Circle SDK requires this field
      description: params.description || `B2B Payment - Deal ${params.dealId}`,
      metadata: {
        dealId: params.dealId,
        sellerId: params.sellerId,
        buyerId: params.buyerId,
        fee: fee.toString(),
        feePercentage: params.feePercentage.toString()
      } as any // Circle SDK has strict metadata typing
    })

    return {
      id: (payment as any).data?.id || '',
      amount: params.amount,
      currency: params.currency,
      status: 'pending',
      sellerId: params.sellerId,
      buyerId: params.buyerId,
      dealId: params.dealId,
      fee,
      netAmount,
      createdAt: new Date()
    }
  } catch (error) {
    console.error('[CIRCLE] Payment creation failed:', error)
    throw new Error('Failed to create payment intent')
  }
}

/**
 * Release payment from escrow to seller
 * Called when buyer confirms delivery
 */
export async function releasePayment(params: {
  paymentIntentId: string
  sellerWalletId: string
  amount: number // in cents
  currency: 'USD' | 'EUR'
}): Promise<void> {
  const circle = getCircleClient()

  try {
    // Transfer from escrow to seller wallet
    await circle.transfers.createTransfer({
      idempotencyKey: `release_${params.paymentIntentId}_${Date.now()}`,
      source: {
        type: 'wallet',
        id: 'platform_escrow_wallet' // Wells escrow wallet
      },
      destination: {
        type: 'wallet',
        id: params.sellerWalletId
      },
      amount: {
        amount: (params.amount / 100).toFixed(2),
        currency: params.currency
      }
    })

    console.log('[CIRCLE] Payment released to seller:', params.sellerWalletId)
  } catch (error) {
    console.error('[CIRCLE] Payment release failed:', error)
    throw new Error('Failed to release payment')
  }
}

/**
 * Refund payment back to buyer
 * Called if deal is cancelled or disputed
 */
export async function refundPayment(params: {
  paymentIntentId: string
  buyerWalletId: string
  amount: number // in cents
  currency: 'USD' | 'EUR'
  reason?: string
}): Promise<void> {
  const circle = getCircleClient()

  try {
    await circle.transfers.createTransfer({
      idempotencyKey: `refund_${params.paymentIntentId}_${Date.now()}`,
      source: {
        type: 'wallet',
        id: 'platform_escrow_wallet'
      },
      destination: {
        type: 'wallet',
        id: params.buyerWalletId
      },
      amount: {
        amount: (params.amount / 100).toFixed(2),
        currency: params.currency
      }
    })

    console.log('[CIRCLE] Payment refunded to buyer:', params.buyerWalletId)
  } catch (error) {
    console.error('[CIRCLE] Refund failed:', error)
    throw new Error('Failed to process refund')
  }
}

/**
 * Create a Circle wallet for a user
 */
export async function createWallet(params: {
  userId: string
  currency: 'USD' | 'EUR'
}): Promise<CircleWallet> {
  const circle = getCircleClient()

  try {
    const wallet = await circle.wallets.createWallet({
      idempotencyKey: `wallet_${params.userId}_${Date.now()}`,
      description: `Wells B2B Wallet - ${params.userId}`
    })

    return {
      id: (wallet as any).data?.walletId || '',
      userId: params.userId,
      address: (wallet as any).data?.walletId || '',
      balance: 0,
      currency: params.currency,
      createdAt: new Date()
    }
  } catch (error) {
    console.error('[CIRCLE] Wallet creation failed:', error)
    throw new Error('Failed to create wallet')
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(walletId: string): Promise<number> {
  const circle = getCircleClient()

  try {
    const wallet = await circle.wallets.getWallet(walletId)

    // Convert balance to cents
    const balanceUSD = parseFloat((wallet as any).data?.balances?.[0]?.amount || '0')
    return Math.round(balanceUSD * 100)
  } catch (error) {
    console.error('[CIRCLE] Balance fetch failed:', error)
    return 0
  }
}

/**
 * Get payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<string> {
  const circle = getCircleClient()

  try {
    const payment = await circle.payments.getPayment(paymentId)
    return (payment as any).data?.status || 'unknown'
  } catch (error) {
    console.error('[CIRCLE] Status fetch failed:', error)
    return 'unknown'
  }
}

/**
 * Calculate payment with fees
 */
export function calculatePaymentWithFees(
  dealAmount: number, // in cents
  feePercentage: number // 0.0033 for 33 bps, etc.
): {
  totalAmount: number
  feeAmount: number
  sellerReceives: number
  displayText: string
} {
  const feeAmount = Math.round(dealAmount * feePercentage)
  const sellerReceives = dealAmount - feeAmount

  let displayText = ''
  if (feePercentage < 0.01) {
    const bps = Math.round(feePercentage * 10000)
    displayText = `${bps} bps fee`
  } else {
    const percent = (feePercentage * 100).toFixed(1)
    displayText = `${percent}% fee`
  }

  return {
    totalAmount: dealAmount,
    feeAmount,
    sellerReceives,
    displayText
  }
}

/**
 * Format amount for display
 */
export function formatCurrency(
  amountInCents: number,
  currency: 'USD' | 'EUR' = 'USD'
): string {
  const amount = amountInCents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount)
}
