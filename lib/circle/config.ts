/**
 * Circle Integration Configuration
 *
 * Circle offers THREE separate products that we use:
 *
 * 1. PAYMENTS API - Card deposits, payment intents
 *    - Endpoint: https://api.circle.com/v1/payments
 *    - Auth: Bearer token (CIRCLE_API_KEY)
 *    - Webhook: payment.created, payment.confirmed, etc.
 *
 * 2. PROGRAMMABLE WALLETS (W3S) - Developer-controlled wallets
 *    - Endpoint: https://api.circle.com/v1/w3s
 *    - Auth: Bearer token + Entity Secret for signing
 *    - Used for: User wallets, USDC transfers, escrow
 *
 * 3. PAYOUTS API - Bank withdrawals (off-ramp)
 *    - Endpoint: https://api.circle.com/v1/payouts
 *    - Auth: Bearer token
 *    - Used for: ACH/wire transfers to bank accounts
 */

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

export const CIRCLE_CONFIG = {
  // API Key - used for all Circle APIs
  apiKey: process.env.CIRCLE_API_KEY || '',

  // Environment
  environment: (process.env.CIRCLE_ENV || 'sandbox') as 'sandbox' | 'production',

  // Base URLs
  baseUrl: process.env.CIRCLE_ENV === 'production'
    ? 'https://api.circle.com/v1'
    : 'https://api-sandbox.circle.com/v1',

  // Programmable Wallets (W3S) specific
  w3s: {
    entitySecret: process.env.CIRCLE_ENTITY_SECRET || '',
    walletSetId: process.env.CIRCLE_WALLET_SET_ID || '',
    masterWalletId: process.env.CIRCLE_MASTER_WALLET_ID || '',
    masterWalletAddress: process.env.CIRCLE_MASTER_WALLET_ADDRESS || '',
  },

  // Webhook secrets
  webhooks: {
    paymentsSecret: process.env.CIRCLE_PAYMENTS_WEBHOOK_SECRET || process.env.CIRCLE_ENTITY_SECRET || '',
    w3sSecret: process.env.CIRCLE_W3S_WEBHOOK_SECRET || process.env.CIRCLE_ENTITY_SECRET || '',
  },

  // USDC Configuration
  usdc: {
    // Base Mainnet
    baseMainnet: {
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      chainId: 'BASE',
    },
    // Base Sepolia (testnet)
    baseSepolia: {
      tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      chainId: 'BASE-SEPOLIA',
    },
  },

  // Default blockchain for operations
  defaultChain: process.env.CIRCLE_ENV === 'production' ? 'BASE' : 'BASE-SEPOLIA',
} as const

// =============================================================================
// VALIDATION
// =============================================================================

export function validateCircleConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!CIRCLE_CONFIG.apiKey) {
    errors.push('CIRCLE_API_KEY is required')
  }

  if (!CIRCLE_CONFIG.w3s.entitySecret) {
    errors.push('CIRCLE_ENTITY_SECRET is required for Programmable Wallets')
  }

  if (!CIRCLE_CONFIG.w3s.walletSetId) {
    errors.push('CIRCLE_WALLET_SET_ID is required for Programmable Wallets')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get headers for Circle API requests
 */
export function getCircleHeaders(): HeadersInit {
  return {
    'Authorization': `Bearer ${CIRCLE_CONFIG.apiKey}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Make a request to Circle API
 */
export async function circleRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: any
    retries?: number
  } = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const { method = 'GET', body, retries = 2 } = options

  const url = `${CIRCLE_CONFIG.baseUrl}${endpoint}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers: getCircleHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      })

      const responseData = await response.json()

      if (!response.ok) {
        console.error(`[Circle] API error: ${response.status}`, responseData)

        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          return {
            success: false,
            error: responseData.message || responseData.error || `HTTP ${response.status}`,
          }
        }

        // Retry on 5xx errors
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }

        return {
          success: false,
          error: responseData.message || responseData.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        data: responseData.data || responseData,
      }
    } catch (error: any) {
      console.error(`[Circle] Request failed (attempt ${attempt + 1}):`, error.message)

      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }

      return {
        success: false,
        error: error.message || 'Network error',
      }
    }
  }

  return { success: false, error: 'Max retries exceeded' }
}

/**
 * Generate idempotency key for Circle requests
 */
export function generateIdempotencyKey(prefix: string, ...parts: string[]): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${parts.join('_')}_${timestamp}_${random}`
}

// =============================================================================
// EXPORTS
// =============================================================================

export default CIRCLE_CONFIG
