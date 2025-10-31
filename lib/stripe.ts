import Stripe from 'stripe'
import { clerkClient } from '@clerk/nextjs/server'

// Initialize Stripe with secret key
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not configured')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})

/**
 * Stripe Integration for Wells AI
 * - Buyer checkout and payment methods
 * - Seller onboarding and payouts (Stripe Connect)
 * - Wells AI platform fee (5.5% includes all processing costs)
 */

export interface CreateConnectAccountParams {
  email: string
  country?: string
  type?: 'express' | 'standard' | 'custom'
}

export interface CreateAccountLinkParams {
  accountId: string
  refreshUrl: string
  returnUrl: string
  type?: 'account_onboarding' | 'account_update'
}

export interface CreatePaymentIntentParams {
  amount: number // in cents
  currency: string
  sellerConnectAccountId: string
  applicationFeeAmount: number // in cents (5.5% platform fee includes processing)
  metadata?: Record<string, string>
  description?: string
}

/**
 * Create a Stripe Connect Account for a seller
 * Uses Express account type for easiest seller experience
 */
export async function createConnectAccount(
  params: CreateConnectAccountParams
): Promise<Stripe.Account> {
  const { email, country = 'US', type = 'express' } = params

  try {
    const account = await stripe.accounts.create({
      type,
      country,
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual', // Can be updated during onboarding
      settings: {
        payouts: {
          schedule: {
            interval: 'daily', // Automatic daily payouts
          },
        },
      },
    })

    return account
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error)
    throw error
  }
}

/**
 * Create an account link for seller onboarding
 * This link directs the seller to complete their Stripe onboarding
 */
export async function createAccountLink(
  params: CreateAccountLinkParams
): Promise<Stripe.AccountLink> {
  const { accountId, refreshUrl, returnUrl, type = 'account_onboarding' } = params

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type,
    })

    return accountLink
  } catch (error) {
    console.error('Error creating account link:', error)
    throw error
  }
}

/**
 * Get the status of a Connect account
 * Check if seller has completed onboarding
 */
export async function getAccountStatus(
  accountId: string
): Promise<{
  isComplete: boolean
  requiresOnboarding: boolean
  account: Stripe.Account
}> {
  try {
    const account = await stripe.accounts.retrieve(accountId)

    // Check if account is fully onboarded
    const isComplete =
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true

    const requiresOnboarding = !isComplete

    return {
      isComplete,
      requiresOnboarding,
      account,
    }
  } catch (error) {
    console.error('Error getting account status:', error)
    throw error
  }
}

/**
 * Create a login link for Stripe Express Dashboard
 * Sellers can manage their account, view payouts, etc.
 */
export async function createLoginLink(accountId: string): Promise<Stripe.LoginLink> {
  try {
    const loginLink = await stripe.accounts.createLoginLink(accountId)
    return loginLink
  } catch (error) {
    console.error('Error creating login link:', error)
    throw error
  }
}

/**
 * Create a payment intent with application fee (Wells AI's 5.5% platform fee)
 * This is how we collect our fee when a buyer pays a seller
 *
 * Example: $100 transaction
 * - Buyer pays: $100.00
 * - Wells AI fee (5.5%): $5.50
 * - Seller receives: $94.50 (Stripe fees already included in Wells AI fee)
 */
export async function createPaymentIntentWithFee(
  params: CreatePaymentIntentParams
): Promise<Stripe.PaymentIntent> {
  const {
    amount,
    currency,
    sellerConnectAccountId,
    applicationFeeAmount,
    metadata = {},
    description,
  } = params

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: sellerConnectAccountId,
      },
      metadata: {
        ...metadata,
        platform: 'Wells AI',
        wellsAIFee: applicationFeeAmount.toString(),
      },
      description: description || 'Wells AI Transaction',
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return paymentIntent
  } catch (error) {
    console.error('Error creating payment intent with fee:', error)
    throw error
  }
}

/**
 * Calculate Wells AI's platform fee (5.5% includes all processing costs)
 * @param amount - Transaction amount in cents
 * @returns Fee amount in cents (5.5%)
 * @deprecated Use calculateDynamicWellsAIFee for tier-based pricing
 */
export function calculateWellsAIFee(amount: number): number {
  // 5.5% platform fee (includes Stripe processing fees)
  return Math.round(amount * 0.055)
}

/**
 * Calculate dynamic Wells AI fee based on industry tier
 * @param amountInCents - Transaction amount in cents
 * @param productDescription - Description of product/service being sold
 * @param paymentMethod - Payment method (defaults to 'stripe')
 * @returns Promise with fee breakdown
 */
export async function calculateDynamicWellsAIFee(
  amountInCents: number,
  productDescription: string,
  paymentMethod: 'stripe' | 'ach' | 'wire' | 'grain' = 'stripe'
): Promise<{
  totalFee: number // Total fee in cents
  processingCost: number // Payment processor cost in cents
  wellsAIMargin: number // Wells AI margin in cents
  industryTier: string
  confidence: number
  reasoning: string
}> {
  try {
    // Call pricing calculation API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/pricing/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInCents / 100, // Convert to dollars
        paymentMethod,
        productDescription,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to calculate dynamic pricing')
    }

    const data = await response.json()

    return {
      totalFee: Math.round(data.pricing.totalFee * 100), // Convert to cents
      processingCost: Math.round(data.pricing.processingCostTotal * 100),
      wellsAIMargin: Math.round(data.pricing.wellsAIRevenue * 100),
      industryTier: data.detection.tier,
      confidence: data.detection.confidence,
      reasoning: data.detection.reasoning,
    }
  } catch (error) {
    console.error('Error calculating dynamic fee, falling back to 10%:', error)
    // Fallback: 10% default (gtm-service tier)
    const amountInDollars = amountInCents / 100
    const totalFee = amountInDollars * 0.10
    const processingCost = amountInDollars * 0.029 + 0.30 // Stripe costs
    const wellsAIMargin = totalFee - processingCost

    return {
      totalFee: Math.round(totalFee * 100),
      processingCost: Math.round(processingCost * 100),
      wellsAIMargin: Math.round(wellsAIMargin * 100),
      industryTier: 'gtm-service',
      confidence: 0.5,
      reasoning: 'Fallback: Default 10% tier (API unavailable)',
    }
  }
}

/**
 * List recent transfers for a seller
 */
export async function getSellerTransfers(
  accountId: string,
  limit: number = 10
): Promise<Stripe.Transfer[]> {
  try {
    const transfers = await stripe.transfers.list({
      destination: accountId,
      limit,
    })

    return transfers.data
  } catch (error) {
    console.error('Error fetching seller transfers:', error)
    throw error
  }
}

/**
 * Get upcoming payout for a seller
 */
export async function getUpcomingPayout(
  accountId: string
): Promise<Stripe.Payout | null> {
  try {
    const payouts = await stripe.payouts.list(
      {
        limit: 1,
        status: 'pending',
      },
      {
        stripeAccount: accountId,
      }
    )

    return payouts.data[0] || null
  } catch (error) {
    console.error('Error fetching upcoming payout:', error)
    return null
  }
}

/**
 * Get seller balance
 */
export async function getSellerBalance(accountId: string): Promise<Stripe.Balance> {
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId,
    })

    return balance
  } catch (error) {
    console.error('Error fetching seller balance:', error)
    throw error
  }
}

// ===== CUSTOMER MANAGEMENT (BUYER SIDE) =====

/**
 * Get or create Stripe customer for a Clerk user
 */
export async function getOrCreateCustomer(userId: string): Promise<Stripe.Customer> {
  try {
    // Check if user already has a Stripe customer ID in Clerk metadata
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const existingCustomerId = user.publicMetadata.stripeCustomerId as string | undefined

    // If customer exists, retrieve it
    if (existingCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(existingCustomerId)
        if (!customer.deleted) {
          return customer as Stripe.Customer
        }
      } catch (error) {
        console.error('Error retrieving existing Stripe customer:', error)
        // Continue to create new customer
      }
    }

    // Create new customer
    const email = user.emailAddresses[0]?.emailAddress
    const name = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || undefined

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
        clerkUserId: userId
      }
    })

    // Save customer ID to Clerk user metadata
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        stripeCustomerId: customer.id
      }
    })

    console.log(`✅ Created Stripe customer ${customer.id} for user ${userId}`)
    return customer

  } catch (error) {
    console.error('Error in getOrCreateCustomer:', error)
    throw error
  }
}

/**
 * Get customer by ID
 */
export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) {
      return null
    }
    return customer as Stripe.Customer
  } catch (error) {
    console.error('Error retrieving customer:', error)
    return null
  }
}

// ===== PAYMENT METHODS =====

/**
 * Attach payment method to customer
 */
export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string
): Promise<Stripe.PaymentMethod> {
  return await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId
  })
}

/**
 * Detach payment method from customer
 */
export async function detachPaymentMethod(
  paymentMethodId: string
): Promise<Stripe.PaymentMethod> {
  return await stripe.paymentMethods.detach(paymentMethodId)
}

/**
 * List customer payment methods
 */
export async function listPaymentMethods(
  customerId: string,
  type: 'card' | 'us_bank_account' = 'card'
): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type
  })
  return paymentMethods.data
}

/**
 * Set default payment method
 */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> {
  return await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId
    }
  })
}

// ===== CHECKOUT SESSIONS =====

export interface CreateCheckoutSessionParams {
  /**
   * Amount in cents (before Wells AI fee)
   */
  amountInCents: number

  /**
   * Description of the purchase
   */
  description: string

  /**
   * Buyer's email address
   */
  buyerEmail: string

  /**
   * Buyer's user ID (Clerk)
   */
  buyerUserId: string

  /**
   * Optional: Seller's Stripe Connect account ID
   * If provided, uses application fees for Wells AI
   */
  sellerStripeAccountId?: string

  /**
   * Optional: Metadata to attach to the session
   */
  metadata?: Record<string, string>

  /**
   * Optional: Success URL (defaults to /payment-success)
   */
  successUrl?: string

  /**
   * Optional: Cancel URL (defaults to /quotes)
   */
  cancelUrl?: string
}

/**
 * Calculate total with Wells AI fee
 */
export function calculateTotalWithFee(amountInCents: number): {
  subtotal: number
  wellsAIFee: number
  total: number
} {
  const wellsAIFee = calculateWellsAIFee(amountInCents)
  return {
    subtotal: amountInCents,
    wellsAIFee,
    total: amountInCents + wellsAIFee
  }
}

/**
 * Create Stripe Checkout Session for buyer payments
 *
 * This function creates a Checkout Session for accepting payments.
 * It automatically calculates the Wells AI fee (5.5%) and adds it to the total.
 *
 * If a seller Stripe Connect account is provided, it uses application fees
 * to route the Wells AI fee directly to Wells AI's account.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const {
    amountInCents,
    description,
    buyerEmail,
    buyerUserId,
    sellerStripeAccountId,
    metadata = {},
    successUrl,
    cancelUrl
  } = params

  // Get or create customer
  const customer = await getOrCreateCustomer(buyerUserId)

  // Calculate fees
  const { subtotal, wellsAIFee, total } = calculateTotalWithFee(amountInCents)

  // Build success and cancel URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const successUrlFinal = successUrl
    ? `${baseUrl}${successUrl}`
    : `${baseUrl}/api/stripe/payment-success?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrlFinal = cancelUrl
    ? `${baseUrl}${cancelUrl}`
    : `${baseUrl}/quotes`

  // Base session parameters
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customer.id,
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: description,
            description: `Subtotal: $${(subtotal / 100).toFixed(2)} + Wells AI Fee: $${(wellsAIFee / 100).toFixed(2)}`
          },
          unit_amount: total
        },
        quantity: 1
      }
    ],
    success_url: successUrlFinal,
    cancel_url: cancelUrlFinal,
    metadata: {
      buyerUserId,
      buyerEmail,
      subtotal: subtotal.toString(),
      wellsAIFee: wellsAIFee.toString(),
      total: total.toString(),
      ...metadata
    },
    payment_intent_data: {
      metadata: {
        buyerUserId,
        buyerEmail,
        subtotal: subtotal.toString(),
        wellsAIFee: wellsAIFee.toString(),
        ...metadata
      }
    }
  }

  // If seller has Stripe Connect, use application fees
  if (sellerStripeAccountId) {
    sessionParams.payment_intent_data = {
      ...sessionParams.payment_intent_data,
      application_fee_amount: wellsAIFee,
      transfer_data: {
        destination: sellerStripeAccountId
      }
    }
  }

  // Create session
  const session = await stripe.checkout.sessions.create(sessionParams)

  console.log(`✅ Created checkout session: ${session.id} for ${buyerEmail}`)
  console.log(`   Amount: $${(amountInCents / 100).toFixed(2)} + Wells AI Fee: $${(wellsAIFee / 100).toFixed(2)} = Total: $${(total / 100).toFixed(2)}`)

  return session
}

/**
 * Retrieve checkout session
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent', 'customer']
  })
}

/**
 * Retrieve payment intent
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.retrieve(paymentIntentId)
}

/**
 * Cancel payment intent
 */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.cancel(paymentIntentId)
}

// ===== REFUNDS =====

/**
 * Create refund
 */
export async function createRefund(params: {
  paymentIntentId: string
  amount?: number // In cents, optional (full refund if not provided)
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  metadata?: Record<string, string>
}): Promise<Stripe.Refund> {
  return await stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: params.amount,
    reason: params.reason,
    metadata: params.metadata
  })
}

export { stripe }
export default stripe
