/**
 * Airwallex Payment Integration
 *
 * Handles marketplace split payments, escrow, and payouts.
 * Lower costs than Stripe (2.8% domestic vs 2.9%) + better FX.
 */

// Configuration
const AIRWALLEX_API_URL = process.env.AIRWALLEX_API_URL || 'https://api.airwallex.com'
const AIRWALLEX_CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID
const AIRWALLEX_API_KEY = process.env.AIRWALLEX_API_KEY
const AIRWALLEX_ACCOUNT_ID = process.env.AIRWALLEX_ACCOUNT_ID

interface AirwallexAuthToken {
  token: string
  expiresAt: number
}

let authToken: AirwallexAuthToken | null = null

/**
 * Authenticate with Airwallex and get bearer token
 */
async function getAuthToken(): Promise<string> {
  // Return cached token if still valid (expires in 1 hour)
  if (authToken && authToken.expiresAt > Date.now()) {
    return authToken.token
  }

  if (!AIRWALLEX_CLIENT_ID || !AIRWALLEX_API_KEY) {
    throw new Error('Airwallex credentials not configured')
  }

  const response = await fetch(`${AIRWALLEX_API_URL}/api/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': AIRWALLEX_CLIENT_ID,
      'x-api-key': AIRWALLEX_API_KEY,
    },
  })

  if (!response.ok) {
    throw new Error(`Airwallex authentication failed: ${response.statusText}`)
  }

  const data = await response.json()

  // Cache token (expires in 1 hour)
  authToken = {
    token: data.token,
    expiresAt: Date.now() + 3600000, // 1 hour
  }

  return authToken.token
}

/**
 * Create a payment intent with platform fee split
 *
 * @param amount - Total transaction amount in cents
 * @param wellsFee - Platform fee in cents
 * @param sellerId - Seller's Airwallex account ID
 * @param metadata - Additional transaction metadata
 */
export async function createPaymentIntent(params: {
  amount: number
  wellsFee: number
  sellerId: string
  currency?: string
  metadata?: Record<string, string>
}): Promise<{
  success: boolean
  paymentIntentId?: string
  clientSecret?: string
  error?: string
}> {
  try {
    const token = await getAuthToken()

    const response = await fetch(`${AIRWALLEX_API_URL}/api/v1/pa/payment_intents/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request_id: `txn_${Date.now()}`, // Idempotency key
        amount: params.amount / 100, // Convert cents to dollars
        currency: params.currency || 'USD',
        merchant_order_id: params.metadata?.rfqId || `order_${Date.now()}`,
        metadata: params.metadata,
        // Split payment: seller gets (amount - wellsFee), Wells keeps wellsFee
        split_settlement: {
          splits: [
            {
              account_id: params.sellerId,
              amount: (params.amount - params.wellsFee) / 100,
              currency: params.currency || 'USD',
            },
            {
              account_id: AIRWALLEX_ACCOUNT_ID,
              amount: params.wellsFee / 100,
              currency: params.currency || 'USD',
            }
          ]
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.message || 'Failed to create payment intent'
      }
    }

    const data = await response.json()

    return {
      success: true,
      paymentIntentId: data.id,
      clientSecret: data.client_secret,
    }
  } catch (error: any) {
    console.error('[AIRWALLEX] Payment intent creation failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to create payment intent'
    }
  }
}

/**
 * Confirm payment and move funds to escrow
 */
export async function confirmPayment(paymentIntentId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const token = await getAuthToken()

    const response = await fetch(`${AIRWALLEX_API_URL}/api/v1/pa/payment_intents/${paymentIntentId}/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.message || 'Failed to confirm payment'
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('[AIRWALLEX] Payment confirmation failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to confirm payment'
    }
  }
}

/**
 * Release escrowed funds (automatic with split_settlement)
 *
 * With Airwallex split settlements, funds are automatically distributed
 * when the payment is confirmed. No separate release needed.
 *
 * This function exists for API compatibility with the transaction engine.
 */
export async function releaseEscrow(paymentIntentId: string): Promise<{
  success: boolean
  error?: string
}> {
  // With split_settlement, funds are automatically distributed
  // This is a no-op for API compatibility
  return { success: true }
}

/**
 * Create a refund for a payment
 */
export async function createRefund(params: {
  paymentIntentId: string
  amount?: number // Optional partial refund amount in cents
  reason?: string
}): Promise<{
  success: boolean
  refundId?: string
  error?: string
}> {
  try {
    const token = await getAuthToken()

    const response = await fetch(`${AIRWALLEX_API_URL}/api/v1/pa/refunds/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_intent_id: params.paymentIntentId,
        amount: params.amount ? params.amount / 100 : undefined, // Full refund if not specified
        reason: params.reason || 'requested_by_customer',
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.message || 'Failed to create refund'
      }
    }

    const data = await response.json()

    return {
      success: true,
      refundId: data.id,
    }
  } catch (error: any) {
    console.error('[AIRWALLEX] Refund creation failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to create refund'
    }
  }
}

/**
 * Get payment status
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<{
  success: boolean
  status?: 'requires_payment_method' | 'requires_confirmation' | 'requires_capture' | 'processing' | 'succeeded' | 'cancelled'
  amount?: number
  error?: string
}> {
  try {
    const token = await getAuthToken()

    const response = await fetch(`${AIRWALLEX_API_URL}/api/v1/pa/payment_intents/${paymentIntentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.message || 'Failed to get payment intent'
      }
    }

    const data = await response.json()

    return {
      success: true,
      status: data.status,
      amount: data.amount * 100, // Convert back to cents
    }
  } catch (error: any) {
    console.error('[AIRWALLEX] Get payment intent failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to get payment intent'
    }
  }
}

/**
 * Create a connected account for a seller
 * (Onboard sellers to receive split payments)
 */
export async function createConnectedAccount(params: {
  email: string
  businessName: string
  country: string
}): Promise<{
  success: boolean
  accountId?: string
  onboardingUrl?: string
  error?: string
}> {
  try {
    const token = await getAuthToken()

    const response = await fetch(`${AIRWALLEX_API_URL}/api/v1/accounts/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        business_name: params.businessName,
        country: params.country,
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.message || 'Failed to create connected account'
      }
    }

    const data = await response.json()

    return {
      success: true,
      accountId: data.id,
      onboardingUrl: data.onboarding_url,
    }
  } catch (error: any) {
    console.error('[AIRWALLEX] Connected account creation failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to create connected account'
    }
  }
}
