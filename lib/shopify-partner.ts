/**
 * Shopify Partner API Integration
 *
 * Enables Wells to:
 * - Create and manage development stores
 * - Track partner earnings and commissions
 * - Manage app installs and referrals
 * - Automate multi-store operations
 *
 * Revenue Model:
 * - 20% recurring commission on merchant subscriptions
 * - 20% of Shopify Plus monthly fees
 * - 80/20 revenue split on app sales
 */

// ======================
// TYPES & INTERFACES
// ======================

export interface ShopifyPartnerCredentials {
  apiKey: string
  partnerId: string
  organizationId?: string
}

export interface DevelopmentStore {
  id: string
  name: string
  myshopifyDomain: string
  url: string
  transferredAt?: string
  convertedAt?: string
  plan?: string
}

export interface PartnerEarnings {
  totalEarnings: number
  monthlyRecurring: number
  oneTimePayments: number
  pendingPayouts: number
}

export interface ReferralLink {
  url: string
  code: string
  expiresAt?: string
}

// ======================
// SHOPIFY PARTNER CLIENT
// ======================

class ShopifyPartnerClient {
  private apiKey: string
  private partnerId: string
  private apiVersion: string = '2025-10'
  private endpoint: string = 'https://partners.shopify.com'

  constructor(credentials: ShopifyPartnerCredentials) {
    this.apiKey = credentials.apiKey
    this.partnerId = credentials.partnerId
  }

  /**
   * Execute GraphQL query against Shopify Partner API
   */
  private async query<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
    const response = await fetch(`${this.endpoint}/${this.apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.apiKey,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })

    if (!response.ok) {
      throw new Error(`Shopify Partner API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`)
    }

    return data.data as T
  }

  /**
   * Create a development store
   * Used for testing and client onboarding
   */
  async createDevelopmentStore(params: {
    name: string
    password?: string
    language?: string
  }): Promise<DevelopmentStore> {
    const query = `
      mutation createDevelopmentStore($input: DevelopmentStoreInput!) {
        developmentStoreCreate(input: $input) {
          developmentStore {
            id
            name
            myshopifyDomain
            url
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const variables = {
      input: {
        name: params.name,
        password: params.password || this.generateSecurePassword(),
        language: params.language || 'en',
      },
    }

    const result = await this.query<{
      developmentStoreCreate: {
        developmentStore: DevelopmentStore
        userErrors: Array<{ field: string; message: string }>
      }
    }>(query, variables)

    if (result.developmentStoreCreate.userErrors.length > 0) {
      throw new Error(
        `Failed to create dev store: ${result.developmentStoreCreate.userErrors[0].message}`
      )
    }

    return result.developmentStoreCreate.developmentStore
  }

  /**
   * Get partner earnings summary
   * Track commissions from merchant referrals
   */
  async getEarnings(params?: {
    startDate?: string
    endDate?: string
  }): Promise<PartnerEarnings> {
    const query = `
      query {
        currentPartnerOrganization {
          id
          name
          totalRevenue {
            amount
            currencyCode
          }
        }
      }
    `

    const result = await this.query<{
      currentPartnerOrganization: {
        id: string
        name: string
        totalRevenue: {
          amount: string
          currencyCode: string
        }
      }
    }>(query)

    return {
      totalEarnings: parseFloat(result.currentPartnerOrganization.totalRevenue.amount),
      monthlyRecurring: 0, // Would need additional query
      oneTimePayments: 0, // Would need additional query
      pendingPayouts: 0, // Would need additional query
    }
  }

  /**
   * Generate referral link for new merchant signups
   * Earn 20% recurring commission when they subscribe
   */
  async generateReferralLink(params?: {
    source?: string
    campaign?: string
  }): Promise<ReferralLink> {
    // Shopify referral links follow this format:
    // https://www.shopify.com/signup?ref=PARTNER_ID
    const baseUrl = 'https://www.shopify.com/signup'
    const refCode = this.partnerId

    const url = new URL(baseUrl)
    url.searchParams.set('ref', refCode)

    if (params?.source) {
      url.searchParams.set('source', params.source)
    }

    if (params?.campaign) {
      url.searchParams.set('campaign', params.campaign)
    }

    return {
      url: url.toString(),
      code: refCode,
    }
  }

  /**
   * List all development stores
   */
  async listDevelopmentStores(): Promise<DevelopmentStore[]> {
    const query = `
      query {
        currentPartnerOrganization {
          stores(first: 50) {
            edges {
              node {
                id
                name
                myshopifyDomain
                url
              }
            }
          }
        }
      }
    `

    const result = await this.query<{
      currentPartnerOrganization: {
        stores: {
          edges: Array<{
            node: DevelopmentStore
          }>
        }
      }
    }>(query)

    return result.currentPartnerOrganization.stores.edges.map((edge) => edge.node)
  }

  /**
   * Transfer development store to merchant
   * This triggers the commission if they subscribe
   */
  async transferStore(storeId: string, recipientEmail: string): Promise<void> {
    // This would use the store transfer mutation
    // Not implementing full logic here as it requires additional setup
    console.log(`Would transfer store ${storeId} to ${recipientEmail}`)
  }

  /**
   * Utility: Generate secure random password
   */
  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }
}

// ======================
// SINGLETON INSTANCE
// ======================

let shopifyClient: ShopifyPartnerClient | null = null

export function getShopifyPartnerClient(): ShopifyPartnerClient {
  if (!shopifyClient) {
    const apiKey = process.env.SHOPIFY_PARTNER_API_KEY
    const partnerId = process.env.SHOPIFY_PARTNER_ID

    if (!apiKey || !partnerId) {
      throw new Error('Shopify Partner credentials not configured')
    }

    shopifyClient = new ShopifyPartnerClient({
      apiKey,
      partnerId,
    })
  }

  return shopifyClient
}

// ======================
// CONVENIENCE FUNCTIONS
// ======================

/**
 * Quick check if Shopify Partner integration is configured
 */
export function isShopifyConfigured(): boolean {
  return !!(
    process.env.SHOPIFY_PARTNER_API_KEY &&
    process.env.SHOPIFY_PARTNER_ID
  )
}

/**
 * Generate tracked referral link for Wells users
 */
export async function generateWellsReferralLink(
  userId: string,
  campaign: string = 'wells-ai'
): Promise<string> {
  const client = getShopifyPartnerClient()
  const link = await client.generateReferralLink({
    source: userId,
    campaign,
  })
  return link.url
}

/**
 * Create development store for Wells user
 */
export async function createStoreForUser(params: {
  userId: string
  businessName: string
}): Promise<DevelopmentStore> {
  const client = getShopifyPartnerClient()
  return await client.createDevelopmentStore({
    name: params.businessName,
  })
}
