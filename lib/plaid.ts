/**
 * Plaid Integration for ACH Payments
 *
 * Plaid provides ACH payment processing at $0.25 per transaction
 * vs Stripe's 2.9% + $0.30 for credit cards.
 *
 * For a $100K transaction:
 * - Stripe: $2,900.30
 * - Plaid ACH: $0.25
 * - Savings: $2,900.05
 *
 * This is CRITICAL for commodities (vegetables, grain, etc.)
 * where margins are often <2%.
 */

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'

// Initialize Plaid client
const configuration = new Configuration({
  basePath: process.env.PLAID_ENV === 'production'
    ? PlaidEnvironments.production
    : PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
})

const plaidClient = new PlaidApi(configuration)

/**
 * Create Plaid Link Token for ACH account connection
 * This token is used on the frontend to open Plaid Link
 */
export async function createLinkToken(userId: string, userName: string) {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: 'Wells AI',
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`,
    })

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    }
  } catch (error) {
    console.error('Error creating Plaid link token:', error)
    throw error
  }
}

/**
 * Exchange public token for access token
 * Called after user completes Plaid Link flow
 */
export async function exchangePublicToken(publicToken: string) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    })

    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    }
  } catch (error) {
    console.error('Error exchanging public token:', error)
    throw error
  }
}

/**
 * Get bank accounts for an item
 */
export async function getAccounts(accessToken: string) {
  try {
    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    })

    return response.data.accounts.map((account) => ({
      id: account.account_id,
      name: account.name,
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
      currentBalance: account.balances.current,
      availableBalance: account.balances.available,
    }))
  } catch (error) {
    console.error('Error getting accounts:', error)
    throw error
  }
}

/**
 * Create ACH payment
 *
 * Cost: $0.25 per transaction (regardless of amount)
 */
export async function createACHPayment(params: {
  accessToken: string
  accountId: string
  amount: number // In dollars
  description: string
  metadata?: Record<string, string>
}) {
  try {
    // Get account and routing numbers
    const authResponse = await plaidClient.authGet({
      access_token: params.accessToken,
    })

    const account = authResponse.data.accounts.find(
      (acc) => acc.account_id === params.accountId
    )

    if (!account) {
      throw new Error('Account not found')
    }

    const numbers = authResponse.data.numbers.ach?.find(
      (num) => num.account_id === params.accountId
    )

    if (!numbers) {
      throw new Error('ACH numbers not available for this account')
    }

    // In production, this would create the ACH transfer
    // For now, we'll return the details needed for the transfer
    return {
      accountNumber: numbers.account,
      routingNumber: numbers.routing,
      accountName: account.name,
      amount: params.amount,
      description: params.description,
      cost: 0.25, // Plaid fee
    }
  } catch (error) {
    console.error('Error creating ACH payment:', error)
    throw error
  }
}

/**
 * Get ACH payment status
 */
export async function getACHPaymentStatus(paymentId: string) {
  // In production, query Plaid for payment status
  // For now, return mock status
  return {
    paymentId,
    status: 'pending', // pending, completed, failed
    estimatedSettlement: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
  }
}

/**
 * Calculate ACH fee (always $0.25)
 */
export function calculateACHFee(amount: number): number {
  return 0.25 // Flat fee regardless of amount
}

/**
 * Compare payment method costs
 */
export function comparePaymentMethods(amount: number): {
  card: { cost: number; percentage: number }
  ach: { cost: number; percentage: number }
  wire: { cost: number; percentage: number }
  savings: { achVsCard: number; wireVsCard: number }
} {
  const cardCost = amount * 0.029 + 0.30
  const achCost = 0.25
  const wireCost = 15.00

  return {
    card: {
      cost: cardCost,
      percentage: (cardCost / amount) * 100,
    },
    ach: {
      cost: achCost,
      percentage: (achCost / amount) * 100,
    },
    wire: {
      cost: wireCost,
      percentage: (wireCost / amount) * 100,
    },
    savings: {
      achVsCard: cardCost - achCost,
      wireVsCard: cardCost - wireCost,
    },
  }
}

export default plaidClient
