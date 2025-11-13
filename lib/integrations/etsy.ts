/**
 * Etsy API v3 Integration
 *
 * Comprehensive integration with Etsy Open API v3
 * Supports shop management, listings, orders, and analytics
 */

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface EtsyConfig {
  apiKey: string // x-api-key header
  userId: string // Numeric user ID
  accessToken: string // OAuth2 access token
  shopId?: string // Optional shop ID for shop-specific operations
}

export interface EtsyListing {
  listing_id: number
  user_id: number
  shop_id: number
  title: string
  description: string
  state: 'active' | 'inactive' | 'draft' | 'expired'
  price: {
    amount: number
    divisor: number
    currency_code: string
  }
  quantity: number
  tags: string[]
  materials: string[]
  shipping_profile_id: number
  processing_min: number
  processing_max: number
  created_timestamp: number
  updated_timestamp: number
  url: string
  views: number
  num_favorers: number
}

export interface EtsyShop {
  shop_id: number
  user_id: number
  shop_name: string
  title: string
  announcement: string
  currency_code: string
  is_vacation: boolean
  vacation_message: string
  sale_message: string
  digital_sale_message: string
  created_timestamp: number
  updated_timestamp: number
  listing_active_count: number
  digital_listing_count: number
  url: string
  icon_url_fullxfull: string
}

export interface EtsyOrder {
  receipt_id: number
  receipt_type: number
  seller_user_id: number
  seller_email: string
  buyer_user_id: number
  buyer_email: string
  name: string
  first_line: string
  second_line: string
  city: string
  state: string
  zip: string
  status: string
  formatted_address: string
  country_iso: string
  payment_method: string
  payment_email: string
  message_from_seller: string
  message_from_buyer: string
  message_from_payment: string
  is_paid: boolean
  is_shipped: boolean
  create_timestamp: number
  created_timestamp: number
  update_timestamp: number
  updated_timestamp: number
  grandtotal: {
    amount: number
    divisor: number
    currency_code: string
  }
  subtotal: {
    amount: number
    divisor: number
    currency_code: string
  }
  total_price: {
    amount: number
    divisor: number
    currency_code: string
  }
  total_shipping_cost: {
    amount: number
    divisor: number
    currency_code: string
  }
  total_tax_cost: {
    amount: number
    divisor: number
    currency_code: string
  }
  shipments: Array<{
    receipt_shipping_id: number
    shipment_notification_timestamp: number
    carrier_name: string
    tracking_code: string
  }>
}

export interface CreateListingParams {
  quantity: number
  title: string
  description: string
  price: number
  who_made: 'i_did' | 'someone_else' | 'collective'
  when_made: 'made_to_order' | '2020_2024' | '2010_2019' | '2000_2009' | 'before_2000' | '1990s' | '1980s' | '1970s' | '1960s' | '1950s' | '1940s' | '1930s' | '1920s' | '1910s' | '1900s' | '1800s' | '1700s' | 'before_1700'
  taxonomy_id: number
  shipping_profile_id: number
  return_policy_id: number
  materials?: string[]
  shop_section_id?: number
  processing_min?: number
  processing_max?: number
  tags?: string[]
  styles?: string[]
  item_weight?: number
  item_length?: number
  item_width?: number
  item_height?: number
  item_weight_unit?: 'oz' | 'lb' | 'g' | 'kg'
  item_dimensions_unit?: 'in' | 'ft' | 'mm' | 'cm' | 'm' | 'yd' | 'inches'
  is_personalizable?: boolean
  personalization_is_required?: boolean
  personalization_char_count_max?: number
  personalization_instructions?: string
  production_partner_ids?: number[]
  image_ids?: number[]
  is_supply?: boolean
  is_customizable?: boolean
  should_auto_renew?: boolean
  is_taxable?: boolean
  type?: 'physical' | 'download' | 'both'
}

export interface EtsyAPIResponse<T> {
  count: number
  results: T[]
}

// ==========================================
// ETSY API CLIENT
// ==========================================

export class EtsyClient {
  private baseUrl = 'https://api.etsy.com/v3'
  private config: EtsyConfig

  constructor(config: EtsyConfig) {
    this.config = config
  }

  /**
   * Make authenticated request to Etsy API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const headers: HeadersInit = {
      'x-api-key': this.config.apiKey,
      'Content-Type': 'application/json; charset=utf-8',
      ...options.headers,
    }

    // Add OAuth token if available
    if (this.config.userId && this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.userId}.${this.config.accessToken}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Etsy API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  // ==========================================
  // SHOP OPERATIONS
  // ==========================================

  /**
   * Get shop by shop ID
   */
  async getShop(shopId: string): Promise<EtsyShop> {
    const response = await this.request<EtsyShop>(`/application/shops/${shopId}`)
    return response
  }

  /**
   * Get shops by owner user ID
   */
  async getShopsByUser(userId: string): Promise<EtsyShop[]> {
    const response = await this.request<EtsyAPIResponse<EtsyShop>>(
      `/application/users/${userId}/shops`
    )
    return response.results
  }

  /**
   * Update shop
   */
  async updateShop(shopId: string, updates: {
    title?: string
    announcement?: string
    sale_message?: string
    digital_sale_message?: string
  }): Promise<EtsyShop> {
    const response = await this.request<EtsyShop>(
      `/application/shops/${shopId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    )
    return response
  }

  // ==========================================
  // LISTING OPERATIONS
  // ==========================================

  /**
   * Get active listings
   */
  async getActiveListings(limit: number = 25, offset: number = 0): Promise<EtsyListing[]> {
    const response = await this.request<EtsyAPIResponse<EtsyListing>>(
      `/application/listings?state=active&limit=${limit}&offset=${offset}`
    )
    return response.results
  }

  /**
   * Get shop listings
   */
  async getShopListings(
    shopId: string,
    state?: 'active' | 'inactive' | 'draft' | 'expired',
    limit: number = 25,
    offset: number = 0
  ): Promise<EtsyListing[]> {
    let endpoint = `/application/shops/${shopId}/listings?limit=${limit}&offset=${offset}`
    if (state) {
      endpoint += `&state=${state}`
    }

    const response = await this.request<EtsyAPIResponse<EtsyListing>>(endpoint)
    return response.results
  }

  /**
   * Get listing by ID
   */
  async getListing(listingId: number): Promise<EtsyListing> {
    const response = await this.request<EtsyListing>(
      `/application/listings/${listingId}`
    )
    return response
  }

  /**
   * Create new listing
   */
  async createListing(shopId: string, params: CreateListingParams): Promise<EtsyListing> {
    const response = await this.request<EtsyListing>(
      `/application/shops/${shopId}/listings`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    )
    return response
  }

  /**
   * Update listing
   */
  async updateListing(
    shopId: string,
    listingId: number,
    updates: Partial<CreateListingParams>
  ): Promise<EtsyListing> {
    const response = await this.request<EtsyListing>(
      `/application/shops/${shopId}/listings/${listingId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    )
    return response
  }

  /**
   * Delete listing
   */
  async deleteListing(listingId: number): Promise<void> {
    await this.request(`/application/listings/${listingId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Update listing inventory
   */
  async updateListingInventory(
    listingId: number,
    quantity: number
  ): Promise<void> {
    await this.request(
      `/application/listings/${listingId}/inventory`,
      {
        method: 'PUT',
        body: JSON.stringify({
          products: [{
            sku: `listing_${listingId}`,
            property_values: [],
            offerings: [{
              quantity,
              price: 0, // Price is required but won't be updated
              is_enabled: true,
            }],
          }],
        }),
      }
    )
  }

  // ==========================================
  // ORDER OPERATIONS
  // ==========================================

  /**
   * Get shop receipts (orders)
   */
  async getShopReceipts(
    shopId: string,
    limit: number = 25,
    offset: number = 0,
    wasShipped?: boolean,
    wasPaid?: boolean
  ): Promise<EtsyOrder[]> {
    let endpoint = `/application/shops/${shopId}/receipts?limit=${limit}&offset=${offset}`

    if (wasShipped !== undefined) {
      endpoint += `&was_shipped=${wasShipped}`
    }
    if (wasPaid !== undefined) {
      endpoint += `&was_paid=${wasPaid}`
    }

    const response = await this.request<EtsyAPIResponse<EtsyOrder>>(endpoint)
    return response.results
  }

  /**
   * Get receipt by ID
   */
  async getReceipt(shopId: string, receiptId: number): Promise<EtsyOrder> {
    const response = await this.request<EtsyOrder>(
      `/application/shops/${shopId}/receipts/${receiptId}`
    )
    return response
  }

  /**
   * Update shop receipt
   */
  async updateReceipt(
    shopId: string,
    receiptId: number,
    updates: {
      was_shipped?: boolean
      message_from_seller?: string
    }
  ): Promise<EtsyOrder> {
    const response = await this.request<EtsyOrder>(
      `/application/shops/${shopId}/receipts/${receiptId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    )
    return response
  }

  // ==========================================
  // ANALYTICS & STATS
  // ==========================================

  /**
   * Get shop stats
   */
  async getShopStats(shopId: string): Promise<{
    revenue: number
    views: number
    orders: number
    favorites: number
  }> {
    // Note: This would use the shop's listing and receipt data
    // Etsy doesn't have a single stats endpoint, so we aggregate
    const listings = await this.getShopListings(shopId, 'active')
    const receipts = await this.getShopReceipts(shopId, 100)

    const stats = {
      revenue: receipts.reduce((sum, r) => {
        return sum + (r.grandtotal?.amount || 0) / (r.grandtotal?.divisor || 100)
      }, 0),
      views: listings.reduce((sum, l) => sum + (l.views || 0), 0),
      orders: receipts.length,
      favorites: listings.reduce((sum, l) => sum + (l.num_favorers || 0), 0),
    }

    return stats
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Format Etsy price for display
 */
export function formatEtsyPrice(price: {
  amount: number
  divisor: number
  currency_code: string
}): string {
  const value = price.amount / price.divisor
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency_code,
  }).format(value)
}

/**
 * Create Etsy client from environment variables
 */
export function createEtsyClient(
  userId: string,
  accessToken: string
): EtsyClient {
  const apiKey = process.env.ETSY_API_KEY
  if (!apiKey) {
    throw new Error('ETSY_API_KEY environment variable not set')
  }

  return new EtsyClient({
    apiKey,
    userId,
    accessToken,
  })
}

/**
 * Validate Etsy credentials
 */
export async function validateEtsyCredentials(
  apiKey: string,
  userId: string,
  accessToken: string
): Promise<{ valid: boolean; error?: string; shop?: EtsyShop }> {
  try {
    const client = new EtsyClient({ apiKey, userId, accessToken })
    const shops = await client.getShopsByUser(userId)

    if (shops.length === 0) {
      return {
        valid: false,
        error: 'No shops found for this user',
      }
    }

    return {
      valid: true,
      shop: shops[0],
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
