/**
 * RFQ Matching Service
 *
 * Automatically matches new RFQs with qualified sellers based on:
 * - Category match (40 points)
 * - Product/service match (30 points)
 * - Verification status (20 points)
 * - Track record (10 points)
 *
 * Integrates with notification system to alert sellers of opportunities.
 */

import { matchSellersToRFQ } from './seller-onboarding'
import { getActiveSellers } from './db/seller-helpers'
import { NotificationFrequency } from '@prisma/client'

export interface RFQMatchInput {
  id: string
  category: string
  title: string
  description: string
  requirements: string
  quantity?: string
  budget?: string
  userId: string // Buyer user ID
}

export interface SellerMatch {
  sellerId: string
  sellerName: string
  contactName: string
  email: string
  phone?: string
  matchScore: number
  matchReasons: string[]
  notificationChannels: string[]
  notificationFrequency: NotificationFrequency
  verified: boolean
  rating?: number
  completedDeals: number
}

export interface RFQMatchResult {
  rfqId: string
  totalMatches: number
  highQualityMatches: number // Score > 50
  instantNotifications: SellerMatch[]
  dailyDigestSellers: SellerMatch[]
  weeklyDigestSellers: SellerMatch[]
}

/**
 * Match an RFQ with qualified sellers
 * Returns sellers grouped by notification preference
 */
export async function matchRFQWithSellers(
  rfq: RFQMatchInput,
  options: {
    minMatchScore?: number // Default: 30
    includeUnverified?: boolean // Default: true
  } = {}
): Promise<RFQMatchResult> {
  const minMatchScore = options.minMatchScore ?? 30
  const includeUnverified = options.includeUnverified ?? true

  // Get all active sellers from database
  const allSellers = await getActiveSellers()

  // Filter by verification if needed
  const eligibleSellers = includeUnverified
    ? allSellers
    : allSellers.filter(s => s.verified)

  // Convert database sellers to the format expected by matchSellersToRFQ
  const sellersForMatching = eligibleSellers.map(seller => ({
    id: seller.id,
    userId: seller.userId,
    companyName: seller.companyName,
    contactName: seller.contactName,
    email: seller.email,
    phone: seller.phone || undefined,
    categories: seller.categories,
    products: seller.products,
    services: seller.services,
    minimumOrderQuantity: seller.minimumOrderQuantity || undefined,
    maximumOrderQuantity: seller.maximumOrderQuantity || undefined,
    leadTimeDays: seller.leadTimeDays || undefined,
    shipmingRegions: seller.shippingRegions,
    yearsInBusiness: seller.yearsInBusiness || undefined,
    certifications: seller.certifications,
    website: seller.website || undefined,
    pricingModel: seller.pricingModel.toLowerCase().replace('_', '-') as any,
    typicalPriceRange: seller.typicalPriceRange || undefined,
    notificationChannels: seller.notificationChannels as ('email' | 'sms')[],
    notificationFrequency: seller.notificationFrequency.toLowerCase().replace('_', '-') as any,
    verified: seller.verified,
    active: seller.active,
    rating: seller.rating || undefined,
    completedDeals: seller.completedDeals,
    createdAt: seller.createdAt,
    updatedAt: seller.updatedAt
  }))

  // Use existing matching algorithm
  const matches = matchSellersToRFQ(
    {
      category: rfq.category,
      requirements: rfq.requirements,
      quantity: rfq.quantity,
      budget: rfq.budget
    },
    sellersForMatching
  )

  // Filter by minimum match score
  const qualifiedMatches = matches.filter(m => m.matchScore >= minMatchScore)

  // Convert to SellerMatch format and group by notification preference
  const instantNotifications: SellerMatch[] = []
  const dailyDigestSellers: SellerMatch[] = []
  const weeklyDigestSellers: SellerMatch[] = []

  for (const match of qualifiedMatches) {
    const sellerMatch: SellerMatch = {
      sellerId: match.seller.id,
      sellerName: match.seller.companyName,
      contactName: match.seller.contactName,
      email: match.seller.email,
      phone: match.seller.phone,
      matchScore: match.matchScore,
      matchReasons: match.matchReasons,
      notificationChannels: match.seller.notificationChannels,
      notificationFrequency: match.seller.notificationFrequency === 'instant'
        ? NotificationFrequency.INSTANT
        : match.seller.notificationFrequency === 'daily-digest'
        ? NotificationFrequency.DAILY_DIGEST
        : NotificationFrequency.WEEKLY_DIGEST,
      verified: match.seller.verified,
      rating: match.seller.rating,
      completedDeals: match.seller.completedDeals
    }

    // Group by notification frequency
    if (sellerMatch.notificationFrequency === NotificationFrequency.INSTANT) {
      instantNotifications.push(sellerMatch)
    } else if (sellerMatch.notificationFrequency === NotificationFrequency.DAILY_DIGEST) {
      dailyDigestSellers.push(sellerMatch)
    } else {
      weeklyDigestSellers.push(sellerMatch)
    }
  }

  return {
    rfqId: rfq.id,
    totalMatches: qualifiedMatches.length,
    highQualityMatches: qualifiedMatches.filter(m => m.matchScore > 50).length,
    instantNotifications,
    dailyDigestSellers,
    weeklyDigestSellers
  }
}

/**
 * Filter sellers for high-value notifications
 * Only notify sellers with match score > threshold
 */
export function filterHighQualityMatches(
  matches: SellerMatch[],
  threshold: number = 50
): SellerMatch[] {
  return matches.filter(m => m.matchScore > threshold)
}

/**
 * Sort sellers by match quality
 * Prioritizes: verified status, match score, track record
 */
export function sortSellersByQuality(matches: SellerMatch[]): SellerMatch[] {
  return [...matches].sort((a, b) => {
    // Verified sellers first
    if (a.verified && !b.verified) return -1
    if (!a.verified && b.verified) return 1

    // Then by match score
    if (a.matchScore !== b.matchScore) {
      return b.matchScore - a.matchScore
    }

    // Then by completed deals
    return b.completedDeals - a.completedDeals
  })
}

/**
 * Get top N sellers for an RFQ
 * Useful for limiting outreach to best matches
 */
export async function getTopSellersForRFQ(
  rfq: RFQMatchInput,
  limit: number = 10
): Promise<SellerMatch[]> {
  const matchResult = await matchRFQWithSellers(rfq, { minMatchScore: 40 })

  // Combine all matches
  const allMatches = [
    ...matchResult.instantNotifications,
    ...matchResult.dailyDigestSellers,
    ...matchResult.weeklyDigestSellers
  ]

  // Sort and limit
  const sorted = sortSellersByQuality(allMatches)
  return sorted.slice(0, limit)
}

/**
 * Calculate notification priority
 * Returns: 'high', 'medium', 'low'
 */
export function calculateNotificationPriority(match: SellerMatch): 'high' | 'medium' | 'low' {
  // High priority: Verified + high match score
  if (match.verified && match.matchScore >= 70) {
    return 'high'
  }

  // Medium priority: Good match or verified
  if (match.verified || match.matchScore >= 50) {
    return 'medium'
  }

  // Low priority: Basic match
  return 'low'
}
