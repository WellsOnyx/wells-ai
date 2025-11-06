/**
 * Seller Onboarding & Profile System
 *
 * Handles seller registration, profile creation, and matching with buyer RFQs.
 * This enables the marketplace to have supply-side liquidity.
 */

export interface SellerProfile {
  id: string
  userId: string // From Clerk
  companyName: string
  contactName: string
  email: string
  phone?: string

  // What they sell
  categories: string[] // e.g., ['Electronics', 'PCB Manufacturing', 'Semiconductors']
  products: string[] // e.g., ['STM32 Microcontrollers', 'Custom PCBs']
  services: string[] // e.g., ['PCB Design', 'Prototyping']

  // Capabilities
  minimumOrderQuantity?: number
  maximumOrderQuantity?: number
  leadTimeDays?: number // Typical lead time
  shipmingRegions: string[] // e.g., ['North America', 'Global']

  // Business details
  yearsInBusiness?: number
  certifications: string[] // e.g., ['ISO 9001', 'RoHS', 'UL']
  website?: string

  // Pricing
  pricingModel: 'fixed' | 'volume-discount' | 'negotiable' | 'rfq-only'
  typicalPriceRange?: string // e.g., '$1-10 per unit'

  // Notification preferences
  notificationChannels: ('email' | 'sms')[]
  notificationFrequency: 'instant' | 'daily-digest' | 'weekly-digest'

  // Status
  verified: boolean
  active: boolean
  rating?: number
  completedDeals: number

  createdAt: Date
  updatedAt: Date
}

export interface SellerIntent {
  detected: boolean
  confidence: number
  category?: string
  products?: string[]
  extractedInfo: {
    companyName?: string
    contactName?: string
    email?: string
    phone?: string
  }
}

/**
 * Detect if user wants to sell products/services
 */
export function detectSellerIntent(message: string, conversationHistory: string[] = []): SellerIntent {
  const lowerMessage = message.toLowerCase()
  const fullContext = [...conversationHistory, message].join(' ').toLowerCase()

  // Seller intent keywords
  const sellerKeywords = [
    'i sell', 'we sell', 'i manufacture', 'we manufacture',
    'i supply', 'we supply', 'i\'m a supplier', 'we\'re a supplier',
    'i make', 'we make', 'i produce', 'we produce',
    'i offer', 'we offer', 'i provide', 'we provide',
    'looking for buyers', 'want to sell', 'interested in selling',
    'i\'m a vendor', 'we\'re a vendor', 'i distribute', 'we distribute'
  ]

  const hasSellerKeyword = sellerKeywords.some(keyword => lowerMessage.includes(keyword))

  if (!hasSellerKeyword) {
    return {
      detected: false,
      confidence: 0,
      extractedInfo: {}
    }
  }

  // Extract what they sell
  const products: string[] = []
  const productPatterns = [
    /(?:sell|manufacture|supply|make|produce|offer|provide)\s+([^.!?]+)/gi,
    /(?:we|i)\s+(?:are|am)\s+a\s+([^.!?]+?)\s+(?:manufacturer|supplier|vendor|distributor)/gi
  ]

  for (const pattern of productPatterns) {
    let match
    while ((match = pattern.exec(message)) !== null) {
      if (match[1]) {
        products.push(match[1].trim())
      }
    }
  }

  // Extract company/contact info
  const emailMatch = fullContext.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/)
  const phoneMatch = fullContext.match(/(\+?1?\s*\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4})/)

  const confidence = hasSellerKeyword ? 0.85 : 0

  return {
    detected: true,
    confidence,
    products: products.length > 0 ? products : undefined,
    extractedInfo: {
      email: emailMatch ? emailMatch[1] : undefined,
      phone: phoneMatch ? phoneMatch[1] : undefined
    }
  }
}

/**
 * Get onboarding questions for seller
 * Progressive disclosure - start simple, get deeper
 */
export function getSellerOnboardingQuestions(currentInfo: Partial<SellerProfile>): {
  question: string
  field: keyof SellerProfile
  type: 'text' | 'multi-select' | 'number'
  options?: string[]
} | null {
  // Required fields in order
  if (!currentInfo.companyName) {
    return {
      question: "What's your company name?",
      field: 'companyName',
      type: 'text'
    }
  }

  if (!currentInfo.contactName) {
    return {
      question: "What's your name? (Your main contact person)",
      field: 'contactName',
      type: 'text'
    }
  }

  if (!currentInfo.email) {
    return {
      question: "What's the best email to reach you?",
      field: 'email',
      type: 'text'
    }
  }

  if (!currentInfo.categories || currentInfo.categories.length === 0) {
    return {
      question: "What categories do you operate in? (Select all that apply)",
      field: 'categories',
      type: 'multi-select',
      options: [
        'Electronics & Semiconductors',
        'Manufacturing & Production',
        'Professional Services',
        'Software & Technology',
        'Industrial Equipment',
        'Construction Materials',
        'Chemical & Raw Materials',
        'Packaging & Logistics',
        'Other'
      ]
    }
  }

  if (!currentInfo.products || currentInfo.products.length === 0) {
    return {
      question: "What specific products or services do you offer? (Be specific - this helps us match you with the right buyers)",
      field: 'products',
      type: 'text'
    }
  }

  if (!currentInfo.leadTimeDays) {
    return {
      question: "What's your typical lead time in days? (Rough estimate is fine)",
      field: 'leadTimeDays',
      type: 'number'
    }
  }

  if (!currentInfo.pricingModel) {
    return {
      question: "How do you typically price your products?",
      field: 'pricingModel',
      type: 'multi-select',
      options: [
        'Fixed price per unit',
        'Volume discounts',
        'Negotiable (case-by-case)',
        'RFQ only (need specs first)'
      ]
    }
  }

  // All required fields collected
  return null
}

/**
 * Create a seller profile from onboarding data
 */
export function createSellerProfile(data: Partial<SellerProfile>): SellerProfile {
  return {
    id: `seller_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: data.userId || '',
    companyName: data.companyName || '',
    contactName: data.contactName || '',
    email: data.email || '',
    phone: data.phone,

    categories: data.categories || [],
    products: data.products || [],
    services: data.services || [],

    minimumOrderQuantity: data.minimumOrderQuantity,
    maximumOrderQuantity: data.maximumOrderQuantity,
    leadTimeDays: data.leadTimeDays,
    shipmingRegions: data.shipmingRegions || ['North America'],

    yearsInBusiness: data.yearsInBusiness,
    certifications: data.certifications || [],
    website: data.website,

    pricingModel: data.pricingModel || 'negotiable',
    typicalPriceRange: data.typicalPriceRange,

    notificationChannels: data.notificationChannels || ['email'],
    notificationFrequency: data.notificationFrequency || 'instant',

    verified: false, // Requires manual verification
    active: true,
    rating: undefined,
    completedDeals: 0,

    createdAt: new Date(),
    updatedAt: new Date()
  }
}

/**
 * Match RFQ with potential sellers
 * Returns list of sellers that could fulfill the request
 */
export function matchSellersToRFQ(
  rfq: {
    category: string
    requirements: string
    quantity?: string
    budget?: string
  },
  sellers: SellerProfile[]
): { seller: SellerProfile; matchScore: number; matchReasons: string[] }[] {
  const matches: { seller: SellerProfile; matchScore: number; matchReasons: string[] }[] = []

  for (const seller of sellers) {
    if (!seller.active) continue

    let matchScore = 0
    const matchReasons: string[] = []

    // Category match (40 points)
    if (seller.categories.some(cat =>
      rfq.category.toLowerCase().includes(cat.toLowerCase()) ||
      cat.toLowerCase().includes(rfq.category.toLowerCase())
    )) {
      matchScore += 40
      matchReasons.push('Category match')
    }

    // Product/keyword match (30 points)
    const rfqLower = rfq.requirements.toLowerCase()
    const productMatches = seller.products.filter(product =>
      rfqLower.includes(product.toLowerCase()) ||
      product.toLowerCase().includes(rfqLower.split(' ')[0]) // Check first word
    )

    if (productMatches.length > 0) {
      matchScore += 30
      matchReasons.push(`Sells: ${productMatches[0]}`)
    }

    // Verification bonus (20 points)
    if (seller.verified) {
      matchScore += 20
      matchReasons.push('Verified seller')
    }

    // Track record bonus (10 points)
    if (seller.completedDeals > 5) {
      matchScore += 10
      matchReasons.push(`${seller.completedDeals} completed deals`)
    }

    // Only include if match score > 30 (at least some relevance)
    if (matchScore > 30) {
      matches.push({ seller, matchScore, matchReasons })
    }
  }

  // Sort by match score (highest first)
  matches.sort((a, b) => b.matchScore - a.matchScore)

  return matches
}

/**
 * Generate welcome message for new seller
 */
export function getSellerWelcomeMessage(profile: SellerProfile): string {
  return `Welcome to Wells, ${profile.contactName}!

I've created your seller profile for ${profile.companyName}. Here's what happens next:

**How Wells works:**
1. **Get matched with buyers** - I find perfect-fit opportunities for your products
2. **Instant notifications** - ${profile.notificationChannels.join(' & ')} alerts when buyers need what you sell
3. **Submit quotes** - Respond directly in the conversation
4. **Get paid fast** - Grain Vault escrow = 1-2 day payouts (no 30-60 day wait)

**Your profile:**
• Products: ${profile.products.join(', ')}
• Lead time: ~${profile.leadTimeDays} days
• Pricing: ${profile.pricingModel}

**Fees (based on value):**
• **0.33%** - You bring your own buyer (we just facilitate)
• **3.3%** - You use Wells GTM engine to find buyers
• **7%** - Wells finds buyer & makes the intro

**Want more deals?**
Most sellers start with Wells-originated deals (we find buyers), then graduate to using our GTM engine to source their own at 3.3%.

Ready to start selling?`
}
