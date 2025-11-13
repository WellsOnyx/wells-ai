/**
 * eBay API Integration
 *
 * Complete integration with eBay REST APIs
 * - Browse API: Search and discover products
 * - Finding API: Legacy search (still useful)
 * - Buy API: Marketplace insights
 * - Affiliate: eBay Partner Network (EPN) commission tracking
 */

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface EbayConfig {
  appId: string // Client ID
  devId: string // Developer ID
  certId: string // Client Secret
  environment: 'sandbox' | 'production'
  userToken?: string // OAuth token for user-specific operations
}

export interface EbayProduct {
  itemId: string
  title: string
  shortDescription?: string
  description?: string
  price: {
    value: string
    currency: string
  }
  condition: string
  conditionDescription?: string
  categoryPath: string
  brand?: string
  image: {
    imageUrl: string
  }
  itemWebUrl: string
  itemAffiliateWebUrl?: string // For EPN tracking
  seller: {
    username: string
    feedbackPercentage: string
    feedbackScore: number
  }
  shippingOptions: Array<{
    shippingCost: {
      value: string
      currency: string
    }
    shippingCostType: string
    minEstimatedDeliveryDate: string
    maxEstimatedDeliveryDate: string
  }>
  quantityAvailable?: number
  lotSize?: number // For bulk items
  buyingOptions: string[] // e.g., ["FIXED_PRICE", "AUCTION"]
  itemLocation: {
    city?: string
    stateOrProvince?: string
    postalCode?: string
    country: string
  }
}

export interface EbaySearchParams {
  q: string // Search query
  category_ids?: string // Category filter
  filter?: string // Advanced filters (e.g., "price:[10..100],priceCurrency:USD")
  sort?: 'price' | '-price' | 'distance' | 'newlyListed' // Sort order
  limit?: number // Results per page (max 200)
  offset?: number // Pagination offset
  buyingOptions?: 'AUCTION' | 'FIXED_PRICE' | 'BEST_OFFER'
}

export interface EbaySearchResponse {
  href: string
  total: number
  limit: number
  offset: number
  itemSummaries: EbayProduct[]
  warnings?: Array<{
    category: string
    message: string
  }>
}

// ==========================================
// EBAY API CLIENT
// ==========================================

export class EbayClient {
  private config: EbayConfig
  private baseUrl: string
  private browseApiUrl: string
  private accessToken?: string
  private tokenExpiry?: number

  constructor(config: EbayConfig) {
    this.config = config

    // Set API endpoints based on environment
    if (config.environment === 'sandbox') {
      this.baseUrl = 'https://api.sandbox.ebay.com'
      this.browseApiUrl = 'https://api.sandbox.ebay.com/buy/browse/v1'
    } else {
      this.baseUrl = 'https://api.ebay.com'
      this.browseApiUrl = 'https://api.ebay.com/buy/browse/v1'
    }
  }

  /**
   * Get OAuth 2.0 access token (Application token, not user token)
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    // Get new token using Client Credentials grant
    const credentials = Buffer.from(
      `${this.config.appId}:${this.config.certId}`
    ).toString('base64')

    const tokenUrl = this.config.environment === 'sandbox'
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token'

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`eBay OAuth error: ${error}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000 // Expire 1min early

    return this.accessToken
  }

  /**
   * Make authenticated request to eBay API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken()

    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', // US marketplace
      ...options.headers,
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`eBay API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  // ==========================================
  // BROWSE API - SEARCH & DISCOVERY
  // ==========================================

  /**
   * Search for items
   */
  async searchItems(params: EbaySearchParams): Promise<EbaySearchResponse> {
    const queryParams = new URLSearchParams()

    queryParams.append('q', params.q)

    if (params.category_ids) {
      queryParams.append('category_ids', params.category_ids)
    }

    if (params.filter) {
      queryParams.append('filter', params.filter)
    }

    if (params.sort) {
      queryParams.append('sort', params.sort)
    }

    queryParams.append('limit', String(params.limit || 50))

    if (params.offset) {
      queryParams.append('offset', String(params.offset))
    }

    const url = `${this.browseApiUrl}/item_summary/search?${queryParams}`

    const response = await this.request<EbaySearchResponse>(url)

    // Add affiliate tracking to URLs if needed
    if (response.itemSummaries) {
      response.itemSummaries = response.itemSummaries.map(item => ({
        ...item,
        itemAffiliateWebUrl: this.generateAffiliateUrl(item.itemWebUrl, item.itemId),
      }))
    }

    return response
  }

  /**
   * Get item details by ID
   */
  async getItem(itemId: string): Promise<EbayProduct> {
    const url = `${this.browseApiUrl}/item/${itemId}`
    const item = await this.request<EbayProduct>(url)

    // Add affiliate URL
    item.itemAffiliateWebUrl = this.generateAffiliateUrl(item.itemWebUrl, item.itemId)

    return item
  }

  /**
   * Search by category
   */
  async searchByCategory(
    categoryId: string,
    query?: string,
    limit: number = 50
  ): Promise<EbaySearchResponse> {
    return this.searchItems({
      q: query || '*', // Wildcard if no query
      category_ids: categoryId,
      limit,
    })
  }

  // ==========================================
  // AFFILIATE LINK GENERATION
  // ==========================================

  /**
   * Generate eBay Partner Network (EPN) affiliate link
   */
  private generateAffiliateUrl(itemUrl: string, itemId: string): string {
    // eBay Partner Network Campaign ID
    // TODO: Get from environment or user settings
    const campaignId = process.env.EBAY_CAMPAIGN_ID || '5338827094'

    // Add affiliate tracking parameters
    const url = new URL(itemUrl)
    url.searchParams.append('mkcid', '1') // eBay Partner Network
    url.searchParams.append('mkrid', '711-53200-19255-0') // US network
    url.searchParams.append('siteid', '0') // US site
    url.searchParams.append('campid', campaignId)
    url.searchParams.append('toolid', '10001') // Wells AI tool ID
    url.searchParams.append('mkevt', '1') // Event type

    return url.toString()
  }

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  /**
   * Build advanced filter string
   */
  static buildFilter(options: {
    minPrice?: number
    maxPrice?: number
    currency?: string
    condition?: 'NEW' | 'USED' | 'REFURBISHED'
    freeShipping?: boolean
    returnsAccepted?: boolean
    location?: string
  }): string {
    const filters: string[] = []

    if (options.minPrice || options.maxPrice) {
      const min = options.minPrice || 0
      const max = options.maxPrice || '*'
      filters.push(`price:[${min}..${max}]`)

      if (options.currency) {
        filters.push(`priceCurrency:${options.currency}`)
      }
    }

    if (options.condition) {
      filters.push(`conditions:{${options.condition}}`)
    }

    if (options.freeShipping) {
      filters.push('deliveryOptions:{FREE_SHIPPING}')
    }

    if (options.returnsAccepted) {
      filters.push('returnsAccepted:true')
    }

    if (options.location) {
      filters.push(`itemLocationCountry:${options.location}`)
    }

    return filters.join(',')
  }

  /**
   * Get popular categories
   */
  static getPopularCategories(): Record<string, string> {
    return {
      'electronics': '293', // Consumer Electronics
      'computers': '58058', // PC Laptops & Netbooks
      'clothing': '11450', // Clothing, Shoes & Accessories
      'home': '11700', // Home & Garden
      'toys': '220', // Toys & Hobbies
      'sports': '382', // Sporting Goods
      'automotive': '6000', // eBay Motors
      'jewelry': '281', // Jewelry & Watches
      'books': '267', // Books, Movies & Music
      'health': '26395', // Health & Beauty
      'business': '12576', // Business & Industrial
      'crafts': '14339', // Crafts
    }
  }
}

// ==========================================
// CONVENIENCE FUNCTIONS
// ==========================================

/**
 * Create eBay client from environment variables
 */
export function createEbayClient(): EbayClient {
  const appId = process.env.EBAY_APP_ID
  const devId = process.env.EBAY_DEV_ID
  const certId = process.env.EBAY_CERT_ID
  const environment = (process.env.EBAY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'

  if (!appId || !devId || !certId) {
    throw new Error('eBay API credentials not configured')
  }

  return new EbayClient({
    appId,
    devId,
    certId,
    environment,
    userToken: process.env.EBAY_USER_TOKEN,
  })
}

/**
 * Format eBay price for display
 */
export function formatEbayPrice(price: { value: string; currency: string }): string {
  const value = parseFloat(price.value)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency,
  }).format(value)
}

/**
 * Calculate shipping cost
 */
export function getLowestShippingCost(
  shippingOptions: EbayProduct['shippingOptions']
): { cost: number; formatted: string } {
  if (!shippingOptions || shippingOptions.length === 0) {
    return { cost: 0, formatted: 'FREE' }
  }

  const costs = shippingOptions.map(option => {
    const value = parseFloat(option.shippingCost.value)
    return isNaN(value) ? 0 : value
  })

  const lowest = Math.min(...costs)

  if (lowest === 0) {
    return { cost: 0, formatted: 'FREE' }
  }

  return {
    cost: lowest,
    formatted: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: shippingOptions[0].shippingCost.currency,
    }).format(lowest),
  }
}

/**
 * Validate eBay credentials
 */
export async function validateEbayCredentials(
  appId: string,
  devId: string,
  certId: string,
  environment: 'sandbox' | 'production'
): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = new EbayClient({
      appId,
      devId,
      certId,
      environment,
    })

    // Try to search for a simple query
    await client.searchItems({ q: 'test', limit: 1 })

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
