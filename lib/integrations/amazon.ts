/**
 * Amazon Product Advertising API Integration
 *
 * Complete integration with Amazon PA-API 5.0
 * - Product search and discovery
 * - Affiliate link generation with Associates tracking
 * - Commission tracking (3-10% depending on category)
 */

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface AmazonConfig {
  accessKey: string // AWS Access Key
  secretKey: string // AWS Secret Key
  partnerTag: string // Amazon Associates Tag (e.g., "wellsai-20")
  marketplace: 'US' | 'UK' | 'CA' | 'DE' | 'FR' | 'JP' | 'IT' | 'ES' | 'IN' | 'AU' | 'BR' | 'MX'
}

export interface AmazonProduct {
  asin: string // Amazon Standard Identification Number
  title: string
  description?: string
  price: {
    amount: number
    currency: string
    formattedPrice: string
  }
  listPrice?: {
    amount: number
    currency: string
    formattedPrice: string
  }
  savings?: {
    amount: number
    percentage: number
  }
  brand?: string
  categoryPath: string[]
  images: {
    primary: string
    variants: string[]
  }
  rating?: {
    value: number // 0-5
    count: number
  }
  features: string[]
  productUrl: string
  affiliateUrl: string
  availability: string
  isPrime: boolean
  shipping: {
    isFreeShipping: boolean
    message?: string
  }
  variations?: Array<{
    asin: string
    dimension: string // e.g., "Color", "Size"
    value: string // e.g., "Blue", "Large"
  }>
  commissionRate: number
  estimatedCommission: number
}

export interface AmazonSearchParams {
  keywords: string
  category?: string // e.g., "All", "Electronics", "Books", "Fashion"
  minPrice?: number
  maxPrice?: number
  brand?: string
  minRating?: number // 0-5
  prime?: boolean // Amazon Prime eligible only
  condition?: 'New' | 'Used' | 'Refurbished'
  sortBy?: 'Relevance' | 'Price:LowToHigh' | 'Price:HighToLow' | 'AvgCustomerReviews' | 'NewestArrivals'
  page?: number
  itemsPerPage?: number // Max 10 per PA-API limits
}

export interface AmazonSearchResponse {
  searchUrl: string
  totalResults: number
  searchIndex: string
  items: AmazonProduct[]
}

// ==========================================
// AMAZON PA-API CLIENT
// ==========================================

export class AmazonClient {
  private config: AmazonConfig
  private endpoint: string
  private region: string

  constructor(config: AmazonConfig) {
    this.config = config

    // Set endpoint and region based on marketplace
    const marketplaceConfig = this.getMarketplaceConfig(config.marketplace)
    this.endpoint = marketplaceConfig.endpoint
    this.region = marketplaceConfig.region
  }

  private getMarketplaceConfig(marketplace: string): { endpoint: string; region: string } {
    const configs: Record<string, { endpoint: string; region: string }> = {
      US: { endpoint: 'webservices.amazon.com', region: 'us-east-1' },
      CA: { endpoint: 'webservices.amazon.ca', region: 'us-east-1' },
      MX: { endpoint: 'webservices.amazon.com.mx', region: 'us-east-1' },
      BR: { endpoint: 'webservices.amazon.com.br', region: 'us-east-1' },
      UK: { endpoint: 'webservices.amazon.co.uk', region: 'eu-west-1' },
      DE: { endpoint: 'webservices.amazon.de', region: 'eu-west-1' },
      FR: { endpoint: 'webservices.amazon.fr', region: 'eu-west-1' },
      IT: { endpoint: 'webservices.amazon.it', region: 'eu-west-1' },
      ES: { endpoint: 'webservices.amazon.es', region: 'eu-west-1' },
      IN: { endpoint: 'webservices.amazon.in', region: 'eu-west-1' },
      JP: { endpoint: 'webservices.amazon.co.jp', region: 'us-west-2' },
      AU: { endpoint: 'webservices.amazon.com.au', region: 'us-west-2' },
    }

    return configs[marketplace] || configs.US
  }

  /**
   * Search for products
   */
  async searchItems(params: AmazonSearchParams): Promise<AmazonSearchResponse> {
    const apiParams = {
      Keywords: params.keywords,
      SearchIndex: params.category || 'All',
      ItemPage: params.page || 1,
      ItemCount: Math.min(params.itemsPerPage || 10, 10), // PA-API limit is 10
      Resources: [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ProductInfo',
        'ItemInfo.TechnicalInfo',
        'ItemInfo.Classifications',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Offers.Listings.Availability',
        'Offers.Listings.DeliveryInfo.IsPrimeEligible',
        'Offers.Listings.DeliveryInfo.IsAmazonFulfilled',
        'Offers.Listings.DeliveryInfo.IsFreeShippingEligible',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count',
        'BrowseNodeInfo.BrowseNodes',
      ],
      PartnerTag: this.config.partnerTag,
      PartnerType: 'Associates',
      Marketplace: `www.amazon.${this.getMarketplaceDomain()}`,
    }

    // Add optional filters
    if (params.minPrice || params.maxPrice) {
      const min = params.minPrice ? Math.floor(params.minPrice * 100) : 0
      const max = params.maxPrice ? Math.floor(params.maxPrice * 100) : 999999999
      apiParams['MinPrice'] = min
      apiParams['MaxPrice'] = max
    }

    if (params.brand) {
      apiParams['Brand'] = params.brand
    }

    if (params.condition) {
      apiParams['Condition'] = params.condition
    }

    if (params.sortBy) {
      apiParams['SortBy'] = params.sortBy
    }

    // Make API request using PA-API SDK
    try {
      const response = await this.makeRequest('SearchItems', apiParams)

      const items = response.SearchResult?.Items || []

      return {
        searchUrl: response.SearchResult?.SearchURL || '',
        totalResults: response.SearchResult?.TotalResultCount || 0,
        searchIndex: params.category || 'All',
        items: items.map((item: any) => this.normalizeProduct(item)),
      }
    } catch (error) {
      console.error('[Amazon API] Search error:', error)
      throw error
    }
  }

  /**
   * Get item details by ASIN
   */
  async getItem(asin: string): Promise<AmazonProduct> {
    const apiParams = {
      ItemIds: [asin],
      Resources: [
        'Images.Primary.Large',
        'Images.Variants.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ProductInfo',
        'ItemInfo.TechnicalInfo',
        'ItemInfo.Classifications',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Offers.Listings.Availability',
        'Offers.Listings.DeliveryInfo',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count',
        'BrowseNodeInfo.BrowseNodes',
      ],
      PartnerTag: this.config.partnerTag,
      PartnerType: 'Associates',
      Marketplace: `www.amazon.${this.getMarketplaceDomain()}`,
    }

    const response = await this.makeRequest('GetItems', apiParams)
    const item = response.ItemsResult?.Items?.[0]

    if (!item) {
      throw new Error(`Product not found: ${asin}`)
    }

    return this.normalizeProduct(item)
  }

  /**
   * Normalize API response to our interface
   */
  private normalizeProduct(item: any): AmazonProduct {
    const offer = item.Offers?.Listings?.[0]
    const price = offer?.Price
    const savingBasis = offer?.SavingBasis
    const images = item.Images?.Primary?.Large
    const rating = item.CustomerReviews?.StarRating
    const availability = offer?.Availability?.Message || 'Check availability'

    // Parse price
    const priceAmount = price ? parseFloat(price.Amount) : 0
    const listPriceAmount = savingBasis ? parseFloat(savingBasis.Amount) : priceAmount
    const savings = listPriceAmount > priceAmount ? {
      amount: listPriceAmount - priceAmount,
      percentage: Math.round(((listPriceAmount - priceAmount) / listPriceAmount) * 100)
    } : undefined

    // Get commission rate based on category
    const category = item.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName || 'General'
    const commissionRate = this.getCommissionRate(category)
    const estimatedCommission = priceAmount * commissionRate

    // Generate affiliate URL
    const affiliateUrl = this.generateAffiliateUrl(item.ASIN)

    return {
      asin: item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
      description: item.ItemInfo?.Features?.DisplayValues?.join(' ') || '',
      price: {
        amount: priceAmount,
        currency: price?.Currency || 'USD',
        formattedPrice: price?.DisplayAmount || `$${priceAmount.toFixed(2)}`,
      },
      listPrice: savingBasis ? {
        amount: listPriceAmount,
        currency: savingBasis.Currency,
        formattedPrice: savingBasis.DisplayAmount,
      } : undefined,
      savings,
      brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue,
      categoryPath: this.getCategoryPath(item.BrowseNodeInfo?.BrowseNodes),
      images: {
        primary: images?.URL || '',
        variants: item.Images?.Variants?.map((v: any) => v.Large?.URL).filter(Boolean) || [],
      },
      rating: rating ? {
        value: parseFloat(rating.Value),
        count: item.CustomerReviews?.Count || 0,
      } : undefined,
      features: item.ItemInfo?.Features?.DisplayValues || [],
      productUrl: item.DetailPageURL || '',
      affiliateUrl,
      availability,
      isPrime: offer?.DeliveryInfo?.IsPrimeEligible || false,
      shipping: {
        isFreeShipping: offer?.DeliveryInfo?.IsFreeShippingEligible || false,
        message: offer?.DeliveryInfo?.ShippingCharges?.DisplayAmount,
      },
      commissionRate,
      estimatedCommission,
    }
  }

  /**
   * Get commission rate based on category
   * Rates from: https://affiliate-program.amazon.com/help/operating/schedule
   */
  private getCommissionRate(category: string): number {
    const rates: Record<string, number> = {
      // Luxury Beauty, Amazon Coins: 10%
      'Luxury Beauty': 0.10,
      'Amazon Coins': 0.10,

      // Digital products: 5%
      'Amazon Music': 0.05,
      'Digital Music': 0.05,
      'Digital Videos': 0.05,

      // Physical products: 4%
      'Toys': 0.04,
      'Furniture': 0.04,
      'Home': 0.04,
      'Home Improvement': 0.04,
      'Lawn & Garden': 0.04,
      'Pet Products': 0.04,
      'Pantry': 0.04,

      // Electronics, computers: 2.5%
      'Electronics': 0.025,
      'Computers': 0.025,
      'Video Games': 0.025,

      // Everything else: 3%
    }

    return rates[category] || 0.03
  }

  /**
   * Generate Amazon Associates affiliate URL
   */
  private generateAffiliateUrl(asin: string): string {
    const domain = this.getMarketplaceDomain()
    return `https://www.amazon.${domain}/dp/${asin}?tag=${this.config.partnerTag}`
  }

  /**
   * Get marketplace domain
   */
  private getMarketplaceDomain(): string {
    const domains: Record<string, string> = {
      US: 'com',
      CA: 'ca',
      MX: 'com.mx',
      BR: 'com.br',
      UK: 'co.uk',
      DE: 'de',
      FR: 'fr',
      IT: 'it',
      ES: 'es',
      IN: 'in',
      JP: 'co.jp',
      AU: 'com.au',
    }

    return domains[this.config.marketplace] || 'com'
  }

  /**
   * Get category path from browse nodes
   */
  private getCategoryPath(browseNodes?: any[]): string[] {
    if (!browseNodes || browseNodes.length === 0) return []

    const path: string[] = []
    let node = browseNodes[0]

    while (node) {
      if (node.DisplayName) {
        path.unshift(node.DisplayName)
      }
      node = node.Ancestor
    }

    return path
  }

  /**
   * Make signed request to PA-API
   * Uses AWS Signature Version 4
   */
  private async makeRequest(operation: string, params: any): Promise<any> {
    // For production, use the paapi5-nodejs-sdk package
    // This is a simplified version for reference

    const timestamp = new Date().toISOString()
    const payload = JSON.stringify({
      ...params,
      Timestamp: timestamp,
    })

    const url = `https://${this.endpoint}/paapi5/${operation.toLowerCase()}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Amz-Target': `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
        'X-Amz-Date': timestamp,
        'Content-Encoding': 'amz-1.0',
        'Authorization': await this.signRequest(operation, payload, timestamp),
      },
      body: payload,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Amazon API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  /**
   * Sign request with AWS Signature V4
   * Simplified - use paapi5-nodejs-sdk in production
   */
  private async signRequest(operation: string, payload: string, timestamp: string): Promise<string> {
    // TODO: Implement AWS Signature V4 signing
    // For now, return placeholder
    // In production, use paapi5-nodejs-sdk which handles this automatically
    return `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/...`
  }
}

// ==========================================
// CONVENIENCE FUNCTIONS
// ==========================================

/**
 * Create Amazon client from environment variables
 */
export function createAmazonClient(): AmazonClient {
  const accessKey = process.env.AMAZON_ACCESS_KEY
  const secretKey = process.env.AMAZON_SECRET_KEY
  const partnerTag = process.env.AMAZON_ASSOCIATES_TAG || 'wellsai-20'
  const marketplace = (process.env.AMAZON_MARKETPLACE || 'US') as any

  if (!accessKey || !secretKey) {
    throw new Error('Amazon API credentials not configured')
  }

  return new AmazonClient({
    accessKey,
    secretKey,
    partnerTag,
    marketplace,
  })
}

/**
 * Popular Amazon categories
 */
export function getPopularCategories(): Record<string, string> {
  return {
    all: 'All',
    electronics: 'Electronics',
    computers: 'Computers',
    books: 'Books',
    fashion: 'Fashion',
    home: 'HomeAndKitchen',
    toys: 'ToysAndGames',
    sports: 'SportsAndOutdoors',
    beauty: 'Beauty',
    automotive: 'Automotive',
    grocery: 'GroceryAndGourmetFood',
    health: 'HealthAndPersonalCare',
    office: 'OfficeProducts',
    tools: 'ToolsAndHomeImprovement',
    garden: 'LawnAndGarden',
    pet: 'PetSupplies',
  }
}
