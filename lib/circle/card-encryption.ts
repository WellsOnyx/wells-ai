/**
 * Circle Card Encryption
 *
 * Handles PGP encryption of card data for Circle Payments API.
 * Card numbers and CVVs must be encrypted before sending to Circle.
 *
 * Flow:
 * 1. Get public key from Circle
 * 2. Encrypt card number + CVV using OpenPGP
 * 3. Send encrypted data to create card
 */

import { CIRCLE_CONFIG, circleRequest } from './config'

// =============================================================================
// PUBLIC KEY
// =============================================================================

interface PublicKeyResponse {
  keyId: string
  publicKey: string
}

let cachedPublicKey: PublicKeyResponse | null = null
let publicKeyExpiry: number = 0

/**
 * Get Circle's public key for card encryption
 * Keys are cached for 1 hour
 */
export async function getPublicKey(): Promise<{ success: boolean; key?: PublicKeyResponse; error?: string }> {
  // Return cached key if still valid
  if (cachedPublicKey && Date.now() < publicKeyExpiry) {
    return { success: true, key: cachedPublicKey }
  }

  const response = await circleRequest<PublicKeyResponse>('/encryption/public')

  if (!response.success || !response.data) {
    return { success: false, error: response.error || 'Failed to get encryption key' }
  }

  // Cache for 1 hour
  cachedPublicKey = response.data
  publicKeyExpiry = Date.now() + 60 * 60 * 1000

  return { success: true, key: response.data }
}

// =============================================================================
// CARD ENCRYPTION
// =============================================================================

/**
 * Encrypt card data using Circle's public key
 *
 * SECURITY CRITICAL: This function handles raw card data.
 *
 * In production, this MUST use OpenPGP.js to encrypt:
 * { "number": "4111111111111111", "cvv": "123" }
 *
 * For sandbox ONLY, Circle accepts the default key1 and base64 encoded JSON.
 * This is NOT secure and should NEVER be used in production.
 */
export async function encryptCardData(
  cardNumber: string,
  cvv: string
): Promise<{ success: boolean; encryptedData?: string; keyId?: string; error?: string }> {
  // SECURITY: Validate environment configuration
  if (!CIRCLE_CONFIG.environment) {
    console.error('[Card Encryption] CRITICAL: CIRCLE_CONFIG.environment is not set!')
    return {
      success: false,
      error: 'Payment system misconfiguration. Please contact support.'
    }
  }

  // SECURITY: Explicitly validate environment is one of the allowed values
  if (CIRCLE_CONFIG.environment !== 'sandbox' && CIRCLE_CONFIG.environment !== 'production') {
    console.error('[Card Encryption] CRITICAL: Invalid CIRCLE_CONFIG.environment:', CIRCLE_CONFIG.environment)
    return {
      success: false,
      error: 'Payment system misconfiguration. Please contact support.'
    }
  }

  // Get public key
  const keyResult = await getPublicKey()
  if (!keyResult.success || !keyResult.key) {
    return { success: false, error: keyResult.error || 'Failed to get encryption key' }
  }

  const { keyId, publicKey } = keyResult.key

  // Clean card number (remove spaces/dashes)
  const cleanCardNumber = cardNumber.replace(/[\s-]/g, '')

  // SECURITY: Validate card number format (basic Luhn check would be better)
  if (!/^\d{13,19}$/.test(cleanCardNumber)) {
    return { success: false, error: 'Invalid card number format' }
  }

  // SECURITY: Validate CVV format
  if (!/^\d{3,4}$/.test(cvv)) {
    return { success: false, error: 'Invalid CVV format' }
  }

  // For sandbox mode ONLY, use simple base64 encoding
  // This is NOT secure and is only for testing
  if (CIRCLE_CONFIG.environment === 'sandbox') {
    console.warn('[Card Encryption] WARNING: Using sandbox mode with base64 encoding. NOT secure for production!')
    const payload = JSON.stringify({
      number: cleanCardNumber,
      cvv: cvv
    })
    const encryptedData = Buffer.from(payload).toString('base64')
    return { success: true, encryptedData, keyId }
  }

  // Production: Use OpenPGP encryption - this is the ONLY secure method
  if (CIRCLE_CONFIG.environment === 'production') {
    try {
      const openpgp = await import('openpgp')

      const payload = JSON.stringify({
        number: cleanCardNumber,
        cvv: cvv
      })

      // Decode the public key
      const publicKeyArmored = Buffer.from(publicKey, 'base64').toString('utf-8')

      // Read the public key
      const publicKeyObj = await openpgp.readKey({ armoredKey: publicKeyArmored })

      // Encrypt the message
      const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: payload }),
        encryptionKeys: publicKeyObj,
      })

      // Base64 encode the encrypted message
      const encryptedData = Buffer.from(encrypted as string).toString('base64')

      return { success: true, encryptedData, keyId }
    } catch (error: any) {
      console.error('[Card Encryption] OpenPGP error:', error)
      return { success: false, error: 'Failed to encrypt card data securely' }
    }
  }

  // SECURITY: Fail-safe - should never reach here due to validation above
  console.error('[Card Encryption] CRITICAL: Reached unreachable code path!')
  return {
    success: false,
    error: 'Payment system error. Please contact support.'
  }
}

// =============================================================================
// CARD CREATION
// =============================================================================

interface BillingDetails {
  name: string
  line1: string
  line2?: string
  city: string
  postalCode: string
  district?: string // State/Province
  country: string // ISO 3166-1 alpha-2
}

interface CreateCardParams {
  encryptedData: string
  keyId: string
  billingDetails: BillingDetails
  expMonth: number
  expYear: number
  email: string
  phoneNumber?: string
  sessionId: string
  ipAddress: string
}

interface CardResponse {
  id: string
  status: 'pending' | 'complete' | 'failed'
  billingDetails: BillingDetails
  expMonth: number
  expYear: number
  network: string
  last4: string
  fingerprint: string
  verification: {
    avs: string
    cvv: string
  }
  createDate: string
  updateDate: string
}

/**
 * Create a card in Circle's system
 */
export async function createCard(
  params: CreateCardParams
): Promise<{ success: boolean; card?: CardResponse; error?: string }> {
  const {
    encryptedData,
    keyId,
    billingDetails,
    expMonth,
    expYear,
    email,
    phoneNumber,
    sessionId,
    ipAddress
  } = params

  const idempotencyKey = `card_${sessionId}_${Date.now()}`

  const response = await circleRequest<CardResponse>('/cards', {
    method: 'POST',
    body: {
      idempotencyKey,
      keyId,
      encryptedData,
      billingDetails,
      expMonth,
      expYear,
      metadata: {
        email,
        phoneNumber: phoneNumber || '',
        sessionId,
        ipAddress
      }
    }
  })

  if (!response.success || !response.data) {
    return { success: false, error: response.error || 'Failed to create card' }
  }

  return { success: true, card: response.data }
}

// =============================================================================
// CARD PAYMENT
// =============================================================================

interface CreateCardPaymentParams {
  cardId: string
  amount: number
  email: string
  sessionId: string
  ipAddress: string
  phoneNumber?: string
  description?: string
  verificationSuccessUrl: string
  verificationFailureUrl: string
}

interface PaymentResponse {
  id: string
  type: string
  status: 'pending' | 'confirmed' | 'paid' | 'failed' | 'action_required'
  amount: { amount: string; currency: string }
  fees: { amount: string; currency: string }
  source: { id: string; type: string }
  description: string
  merchantId: string
  merchantWalletId: string
  requiredAction?: {
    type: 'three_d_secure_required'
    redirectUrl: string
  }
  createDate: string
  updateDate: string
}

/**
 * Create a payment using a card
 */
export async function createCardPayment(
  params: CreateCardPaymentParams
): Promise<{ success: boolean; payment?: PaymentResponse; error?: string }> {
  const {
    cardId,
    amount,
    email,
    sessionId,
    ipAddress,
    phoneNumber,
    description,
    verificationSuccessUrl,
    verificationFailureUrl
  } = params

  const idempotencyKey = `payment_${sessionId}_${Date.now()}`

  const response = await circleRequest<PaymentResponse>('/payments', {
    method: 'POST',
    body: {
      idempotencyKey,
      amount: {
        amount: amount.toFixed(2),
        currency: 'USD'
      },
      verification: 'three_d_secure',
      verificationSuccessUrl,
      verificationFailureUrl,
      source: {
        id: cardId,
        type: 'card'
      },
      description: description || 'GRAIN deposit',
      metadata: {
        email,
        phoneNumber: phoneNumber || '',
        sessionId,
        ipAddress
      },
      channel: '',
      autoCapture: true
    }
  })

  if (!response.success || !response.data) {
    return { success: false, error: response.error || 'Failed to create payment' }
  }

  return { success: true, payment: response.data }
}

/**
 * Complete card deposit flow
 *
 * 1. Encrypt card data
 * 2. Create card
 * 3. Create payment
 * 4. Return redirect URL for 3DS if needed
 */
export async function processCardDeposit(params: {
  cardNumber: string
  cvv: string
  expMonth: number
  expYear: number
  billingDetails: BillingDetails
  amount: number
  email: string
  sessionId: string
  ipAddress: string
  phoneNumber?: string
  successUrl: string
  failureUrl: string
}): Promise<{
  success: boolean
  paymentId?: string
  redirectUrl?: string
  status?: string
  error?: string
}> {
  const {
    cardNumber,
    cvv,
    expMonth,
    expYear,
    billingDetails,
    amount,
    email,
    sessionId,
    ipAddress,
    phoneNumber,
    successUrl,
    failureUrl
  } = params

  // Step 1: Encrypt card data
  const encryptResult = await encryptCardData(cardNumber, cvv)
  if (!encryptResult.success) {
    return { success: false, error: encryptResult.error }
  }

  // Step 2: Create card
  const cardResult = await createCard({
    encryptedData: encryptResult.encryptedData!,
    keyId: encryptResult.keyId!,
    billingDetails,
    expMonth,
    expYear,
    email,
    phoneNumber,
    sessionId,
    ipAddress
  })

  if (!cardResult.success) {
    return { success: false, error: cardResult.error }
  }

  // Step 3: Create payment
  const paymentResult = await createCardPayment({
    cardId: cardResult.card!.id,
    amount,
    email,
    sessionId,
    ipAddress,
    phoneNumber,
    description: 'GRAIN deposit',
    verificationSuccessUrl: successUrl,
    verificationFailureUrl: failureUrl
  })

  if (!paymentResult.success) {
    return { success: false, error: paymentResult.error }
  }

  const payment = paymentResult.payment!

  // Check if 3DS is required
  if (payment.status === 'action_required' && payment.requiredAction?.redirectUrl) {
    return {
      success: true,
      paymentId: payment.id,
      redirectUrl: payment.requiredAction.redirectUrl,
      status: 'action_required'
    }
  }

  return {
    success: true,
    paymentId: payment.id,
    status: payment.status
  }
}

export default {
  getPublicKey,
  encryptCardData,
  createCard,
  createCardPayment,
  processCardDeposit
}
