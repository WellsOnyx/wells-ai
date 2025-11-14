/**
 * Wells Sourcing Engine
 *
 * Real-time product sourcing from multiple marketplaces with affiliate tracking
 * Revenue model: Affiliate commissions + partner revenue share
 */

import { EtsyClient, EtsyListing, formatEtsyPrice } from '@/lib/integrations/etsy'
import { createAmazonClient, AmazonProduct } from '@/lib/integrations/amazon'

// ==========================================
// TYPES & INTERFACES
// ==========================================

export type Marketplace = 'etsy' | 'ebay' | 'amazon' | 'alibaba' | 'faire' | 'tundra' | 'custom'

export interface SourcedProduct {
  id: string
  marketplace: Marketplace
  title: string
  description: string
  price: number
  currency: string
  formattedPrice: string
  quantity: number
  moq?: number // Minimum order quantity
  leadTime?: string // e.g., "3-5 business days"
  imageUrl: string
  productUrl: string
  affiliateUrl?: string // Tracked affiliate link
  supplierName: string
  supplierRating?: number
  shipsFrom: string
  shipsTo: string[]
  tags: string[]
  customizable: boolean
  bulkPricing?: Array<{
    minQty: number
    price: number
  }>
  commissionRate?: number // % commission Wells earns
  estimatedCommission?: number
}

export interface SourceRequest {
  query: string // Natural language: "branded water bottles"
  quantity?: number
  budget?: {
    min?: number
    max?: number
    currency: string
  }
  requirements?: {
    customizable?: boolean
    minRating?: number
    shipsTo?: string
    leadTimeMax?: number // days
    eco_friendly?: boolean
    made_in?: string
  }
  userId: string
  preferredMarketplaces?: Marketplace[]
}

export interface SourceResults {
  products: SourcedProduct[]
  totalResults: number
  searchQuery: string
  marketplacesSearched: Marketplace[]
  estimatedTotalRevenue: number // Total commission potential
  bestMatch?: SourcedProduct
  budgetMatches: SourcedProduct[]
  premiumOptions: SourcedProduct[]
}

// ==========================================
// AFFILIATE LINK GENERATORS
// ==========================================

/**
 * Generate tracked affiliate link with Wells commission tracking
 */
export function generateAffiliateLink(
  marketplace: Marketplace,
  productUrl: string,
  userId: string,
  productId: string
): string {
  const trackingId = `wells_${userId}_${productId}_${Date.now()}`

  switch (marketplace) {
    case 'etsy':
      // Etsy doesn't have traditional affiliate program, but we can track clicks
      return `${productUrl}?ref=wells_ai&tracking=${trackingId}`

    case 'amazon':
      // Amazon Associates link structure
      const amazonTag = process.env.AMAZON_ASSOCIATES_TAG || 'wellsai-20'
      return `${productUrl}?tag=${amazonTag}&tracking=${trackingId}`

    case 'alibaba':
      // Alibaba affiliate program
      return `${productUrl}?src=wells_ai&tracelog=${trackingId}`

    case 'faire':
      // Faire referral program
      return `${productUrl}?via=wells&ref=${trackingId}`

    default:
      return productUrl
  }
}

/**
 * Calculate expected commission
 */
export function calculateCommission(
  marketplace: Marketplace,
  price: number,
  quantity: number
): { rate: number; amount: number } {
  // Commission rates by marketplace (typical ranges)
  const rates: Record<Marketplace, number> = {
    etsy: 0.04, // 4% (partner program)
    ebay: 0.03, // 3% (eBay Partner Network, 1-6% by category)
    amazon: 0.03, // 3% (varies by category, up to 10%)
    alibaba: 0.05, // 5% (trade assurance)
    faire: 0.15, // 15% (first order) + 10% repeat
    tundra: 0.10, // 10% (negotiated)
    custom: 0.00, // Custom partnerships
  }

  const rate = rates[marketplace] || 0
  const amount = price * quantity * rate

  return { rate, amount }
}

// ==========================================
// ETSY SOURCING
// ==========================================

export async function sourceFromEtsy(
  request: SourceRequest,
  etsyClient: EtsyClient
): Promise<SourcedProduct[]> {
  try {
    // Search active listings
    const listings = await etsyClient.getActiveListings(50)

    // Filter by query (simple keyword match for now)
    const keywords = request.query.toLowerCase().split(' ')
    const matchedListings = listings.filter(listing => {
      const searchText = `${listing.title} ${listing.description} ${listing.tags.join(' ')}`.toLowerCase()
      return keywords.some(keyword => searchText.includes(keyword))
    })

    // Convert to SourcedProduct format
    const products: SourcedProduct[] = matchedListings.map(listing => {
      const price = listing.price.amount / listing.price.divisor
      const quantity = request.quantity || 1
      const { rate, amount } = calculateCommission('etsy', price, quantity)

      return {
        id: `etsy_${listing.listing_id}`,
        marketplace: 'etsy',
        title: listing.title,
        description: listing.description,
        price,
        currency: listing.price.currency_code,
        formattedPrice: formatEtsyPrice(listing.price),
        quantity: listing.quantity,
        moq: 1,
        leadTime: `${listing.processing_min}-${listing.processing_max} business days`,
        imageUrl: '', // Would get from listing images
        productUrl: listing.url,
        affiliateUrl: generateAffiliateLink('etsy', listing.url, request.userId, String(listing.listing_id)),
        supplierName: `Etsy Shop ${listing.shop_id}`,
        shipsFrom: 'US', // Would parse from shipping profile
        shipsTo: ['US', 'CA', 'UK'], // Would get from shipping profile
        tags: listing.tags,
        customizable: true, // Etsy products are often customizable
        commissionRate: rate,
        estimatedCommission: amount,
      }
    })

    return products
  } catch (error) {
    console.error('[Etsy Sourcing] Error:', error)
    return []
  }
}

// ==========================================
// EBAY SOURCING
// ==========================================

export async function sourceFromEbay(
  request: SourceRequest
): Promise<SourcedProduct[]> {
  try {
    const { createEbayClient, formatEbayPrice, getLowestShippingCost } = await import('@/lib/integrations/ebay')

    const ebayClient = createEbayClient()

    // Build filter string
    const { EbayClient } = await import('@/lib/integrations/ebay')
    const filter = EbayClient.buildFilter({
      minPrice: request.budget?.min,
      maxPrice: request.budget?.max,
      currency: request.budget?.currency || 'USD',
      freeShipping: true, // Prefer free shipping
      returnsAccepted: true, // Prefer items with returns
    })

    // Search eBay
    const searchResult = await ebayClient.searchItems({
      q: request.query,
      filter: filter || undefined,
      limit: 50,
      sort: 'price', // Lowest price first
    })

    // Convert to SourcedProduct format
    const products: SourcedProduct[] = searchResult.itemSummaries.map(item => {
      const price = parseFloat(item.price.value)
      const quantity = request.quantity || 1
      const { rate, amount } = calculateCommission('ebay', price, quantity)
      const shipping = getLowestShippingCost(item.shippingOptions)

      return {
        id: `ebay_${item.itemId}`,
        marketplace: 'ebay',
        title: item.title,
        description: item.shortDescription || item.description || '',
        price,
        currency: item.price.currency,
        formattedPrice: formatEbayPrice(item.price),
        quantity: item.quantityAvailable || 1,
        moq: item.lotSize || 1,
        leadTime: `Ships from ${item.itemLocation.country}`,
        imageUrl: item.image.imageUrl,
        productUrl: item.itemWebUrl,
        affiliateUrl: item.itemAffiliateWebUrl || generateAffiliateLink('ebay', item.itemWebUrl, request.userId, item.itemId),
        supplierName: `eBay - ${item.seller.username}`,
        supplierRating: parseFloat(item.seller.feedbackPercentage) / 20, // Convert to 5-star scale
        shipsFrom: item.itemLocation.country,
        shipsTo: ['US'], // eBay ships worldwide
        tags: [item.condition, item.categoryPath],
        customizable: false, // Most eBay items aren't customizable
        commissionRate: rate,
        estimatedCommission: amount,
        bulkPricing: item.lotSize && item.lotSize > 1 ? [{
          minQty: item.lotSize,
          price: price / item.lotSize
        }] : undefined,
      }
    })

    return products
  } catch (error) {
    console.error('[eBay Sourcing] Error:', error)
    return []
  }
}

// ==========================================
// AMAZON SOURCING (Stub - requires Product Advertising API)
// ==========================================

export async function sourceFromAmazon(
  request: SourceRequest
): Promise<SourcedProduct[]> {
  try {
    // Check if Amazon credentials are configured
    if (!process.env.AMAZON_ACCESS_KEY || !process.env.AMAZON_SECRET_KEY) {
      console.log('[Amazon Sourcing] API credentials not configured')
      return []
    }

    const amazonClient = createAmazonClient()

    // Search for products
    const searchResults = await amazonClient.searchItems({
      keywords: request.query,
      category: 'All',
      minPrice: request.budget?.min,
      maxPrice: request.budget?.max,
      minRating: request.requirements?.minRating,
      sortBy: 'Relevance',
      itemsPerPage: 10,
    })

    // Map Amazon products to SourcedProduct format
    return searchResults.items.map((product: AmazonProduct) => {
      const affiliateUrl = generateAffiliateLink(
        'amazon',
        product.productUrl,
        request.userId,
        product.asin
      )

      return {
        id: product.asin,
        marketplace: 'amazon' as Marketplace,
        title: product.title,
        description: product.description || product.features.join(' | '),
        price: product.price.amount,
        currency: product.price.currency,
        formattedPrice: product.price.formattedPrice,
        quantity: request.quantity || 1,
        leadTime: product.isPrime ? '2 days (Prime)' : '5-7 days',
        imageUrl: product.images.primary,
        productUrl: product.productUrl,
        affiliateUrl,
        supplierName: product.brand || 'Amazon',
        supplierRating: product.rating?.value,
        shipsFrom: 'US', // Amazon marketplace
        shipsTo: ['US', 'CA', 'UK'], // Varies by product
        tags: product.categoryPath,
        customizable: false, // Amazon products generally not customizable
        commissionRate: product.commissionRate,
        estimatedCommission: product.estimatedCommission,
      }
    })
  } catch (error) {
    console.error('[Amazon Sourcing] Error:', error)
    return []
  }
}

// ==========================================
// ALIBABA SOURCING (Stub - requires Alibaba API)
// ==========================================

export async function sourceFromAlibaba(
  request: SourceRequest
): Promise<SourcedProduct[]> {
  // TODO: Implement Alibaba API
  // Great for bulk orders (MOQ 100+)
  // API: https://developers.alibaba.com/

  console.log('[Alibaba Sourcing] Not yet implemented')
  return []
}

// ==========================================
// FAIRE SOURCING (Stub - requires Faire API)
// ==========================================

export async function sourceFromFaire(
  request: SourceRequest
): Promise<SourcedProduct[]> {
  // TODO: Implement Faire API
  // Great for wholesale products
  // API: https://faire.com/api

  console.log('[Faire Sourcing] Not yet implemented')
  return []
}

// ==========================================
// UNIFIED SOURCING ENGINE
// ==========================================

export async function sourcingSearch(
  request: SourceRequest,
  config?: {
    etsyClient?: EtsyClient
  }
): Promise<SourceResults> {
  const startTime = Date.now()

  // Determine which marketplaces to search
  const marketplaces: Marketplace[] = request.preferredMarketplaces || [
    'etsy',
    'ebay',
    'amazon',
    'alibaba',
    'faire',
  ]

  // Search all marketplaces in parallel
  const searchPromises = marketplaces.map(async marketplace => {
    try {
      switch (marketplace) {
        case 'etsy':
          if (config?.etsyClient) {
            return await sourceFromEtsy(request, config.etsyClient)
          }
          return []

        case 'ebay':
          return await sourceFromEbay(request)

        case 'amazon':
          return await sourceFromAmazon(request)

        case 'alibaba':
          return await sourceFromAlibaba(request)

        case 'faire':
          return await sourceFromFaire(request)

        default:
          return []
      }
    } catch (error) {
      console.error(`[Sourcing] ${marketplace} error:`, error)
      return []
    }
  })

  const results = await Promise.all(searchPromises)
  const allProducts = results.flat()

  // Filter by requirements
  let filteredProducts = allProducts

  if (request.requirements?.minRating) {
    filteredProducts = filteredProducts.filter(
      p => (p.supplierRating || 0) >= (request.requirements!.minRating || 0)
    )
  }

  if (request.requirements?.customizable !== undefined) {
    filteredProducts = filteredProducts.filter(
      p => p.customizable === request.requirements!.customizable
    )
  }

  if (request.budget) {
    const { min, max } = request.budget
    filteredProducts = filteredProducts.filter(p => {
      if (min && p.price < min) return false
      if (max && p.price > max) return false
      return true
    })
  }

  // Sort by relevance (price, commission, rating)
  filteredProducts.sort((a, b) => {
    // Prioritize higher commission
    const commissionDiff = (b.estimatedCommission || 0) - (a.estimatedCommission || 0)
    if (Math.abs(commissionDiff) > 10) return commissionDiff > 0 ? 1 : -1

    // Then by rating
    const ratingDiff = (b.supplierRating || 0) - (a.supplierRating || 0)
    if (Math.abs(ratingDiff) > 0.5) return ratingDiff > 0 ? 1 : -1

    // Then by price
    return a.price - b.price
  })

  // Calculate revenue potential
  const estimatedTotalRevenue = filteredProducts.reduce(
    (sum, p) => sum + (p.estimatedCommission || 0),
    0
  )

  // Categorize results
  const budgetMatches = request.budget
    ? filteredProducts.filter(
        p => p.price <= (request.budget!.max || Infinity)
      )
    : []

  const premiumOptions = filteredProducts.filter(
    p => (p.supplierRating || 0) >= 4.5 && p.customizable
  )

  const searchTime = Date.now() - startTime

  console.log(`[Sourcing Engine] Searched ${marketplaces.length} marketplaces in ${searchTime}ms`)
  console.log(`[Sourcing Engine] Found ${filteredProducts.length} products`)
  console.log(`[Sourcing Engine] Est. revenue: $${estimatedTotalRevenue.toFixed(2)}`)

  return {
    products: filteredProducts,
    totalResults: filteredProducts.length,
    searchQuery: request.query,
    marketplacesSearched: marketplaces,
    estimatedTotalRevenue,
    bestMatch: filteredProducts[0],
    budgetMatches: budgetMatches.slice(0, 5),
    premiumOptions: premiumOptions.slice(0, 3),
  }
}

// ==========================================
// COMMISSION TRACKING
// ==========================================

export interface CommissionEvent {
  id: string
  userId: string
  productId: string
  marketplace: Marketplace
  productUrl: string
  affiliateUrl: string
  clickedAt?: Date
  purchasedAt?: Date
  orderValue?: number
  commissionRate?: number
  commissionAmount?: number
  status: 'clicked' | 'pending' | 'confirmed' | 'paid'
}

// In-memory tracking (TODO: Move to database)
const commissionTracking = new Map<string, CommissionEvent>()

/**
 * Track affiliate click
 */
export function trackAffiliateClick(
  userId: string,
  productId: string,
  marketplace: Marketplace,
  productUrl: string,
  affiliateUrl: string
): string {
  const eventId = `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const event: CommissionEvent = {
    id: eventId,
    userId,
    productId,
    marketplace,
    productUrl,
    affiliateUrl,
    clickedAt: new Date(),
    status: 'clicked',
  }

  commissionTracking.set(eventId, event)

  console.log(`[Commission Tracking] Click: ${marketplace} - ${productId} - User ${userId}`)

  return eventId
}

/**
 * Track purchase conversion
 */
export function trackPurchase(
  eventId: string,
  orderValue: number,
  commissionRate: number
): void {
  const event = commissionTracking.get(eventId)

  if (event) {
    event.purchasedAt = new Date()
    event.orderValue = orderValue
    event.commissionRate = commissionRate
    event.commissionAmount = orderValue * commissionRate
    event.status = 'pending'

    commissionTracking.set(eventId, event)

    console.log(`[Commission Tracking] Purchase: $${orderValue} → $${event.commissionAmount?.toFixed(2)} commission`)
  }
}

/**
 * Get total commission earned
 */
export function getTotalCommissions(
  status?: CommissionEvent['status']
): number {
  let total = 0

  for (const event of commissionTracking.values()) {
    if (!status || event.status === status) {
      total += event.commissionAmount || 0
    }
  }

  return total
}

/**
 * Get commission events for user
 */
export function getUserCommissions(userId: string): CommissionEvent[] {
  const events: CommissionEvent[] = []

  for (const event of commissionTracking.values()) {
    if (event.userId === userId) {
      events.push(event)
    }
  }

  return events.sort((a, b) => {
    const aTime = a.clickedAt?.getTime() || 0
    const bTime = b.clickedAt?.getTime() || 0
    return bTime - aTime
  })
}
