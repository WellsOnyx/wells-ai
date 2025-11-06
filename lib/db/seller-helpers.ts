/**
 * Database Helpers for Seller Profiles
 *
 * CRUD operations for seller profiles and quote management
 */

import { prisma } from '../prisma'
import { SellerProfile, createSellerProfile as createProfile } from '../seller-onboarding'
import { PricingModel, NotificationFrequency } from '@prisma/client'

/**
 * Create a new seller profile in database
 */
export async function createSellerProfile(data: Partial<SellerProfile>) {
  const profile = createProfile(data)

  // Map pricing model string to enum
  const pricingModelMap: { [key: string]: PricingModel } = {
    'fixed': 'FIXED',
    'volume-discount': 'VOLUME_DISCOUNT',
    'negotiable': 'NEGOTIABLE',
    'rfq-only': 'RFQ_ONLY'
  }

  const notificationFreqMap: { [key: string]: NotificationFrequency } = {
    'instant': 'INSTANT',
    'daily-digest': 'DAILY_DIGEST',
    'weekly-digest': 'WEEKLY_DIGEST'
  }

  return await prisma.sellerProfile.create({
    data: {
      userId: profile.userId,
      companyName: profile.companyName,
      contactName: profile.contactName,
      email: profile.email,
      phone: profile.phone,
      categories: profile.categories,
      products: profile.products,
      services: profile.services,
      minimumOrderQuantity: profile.minimumOrderQuantity,
      maximumOrderQuantity: profile.maximumOrderQuantity,
      leadTimeDays: profile.leadTimeDays,
      shippingRegions: profile.shipmingRegions,
      yearsInBusiness: profile.yearsInBusiness,
      certifications: profile.certifications,
      website: profile.website,
      pricingModel: pricingModelMap[profile.pricingModel] || 'NEGOTIABLE',
      typicalPriceRange: profile.typicalPriceRange,
      notificationChannels: profile.notificationChannels,
      notificationFrequency: notificationFreqMap[profile.notificationFrequency] || 'INSTANT',
      verified: profile.verified,
      active: profile.active,
      rating: profile.rating,
      completedDeals: profile.completedDeals,
      onboardingCompleted: true
    }
  })
}

/**
 * Get seller profile by user ID
 */
export async function getSellerProfileByUserId(userId: string) {
  return await prisma.sellerProfile.findUnique({
    where: { userId },
    include: { quotes: true }
  })
}

/**
 * Get seller profile by ID
 */
export async function getSellerProfileById(id: string) {
  return await prisma.sellerProfile.findUnique({
    where: { id },
    include: { quotes: true }
  })
}

/**
 * Update seller profile
 */
export async function updateSellerProfile(
  userId: string,
  data: Partial<{
    companyName: string
    contactName: string
    email: string
    phone: string
    categories: string[]
    products: string[]
    services: string[]
    minimumOrderQuantity: number
    maximumOrderQuantity: number
    leadTimeDays: number
    shippingRegions: string[]
    yearsInBusiness: number
    certifications: string[]
    website: string
    pricingModel: PricingModel
    typicalPriceRange: string
    notificationChannels: string[]
    notificationFrequency: NotificationFrequency
    active: boolean
    verified: boolean
  }>
) {
  return await prisma.sellerProfile.update({
    where: { userId },
    data: {
      ...data,
      updatedAt: new Date()
    }
  })
}

/**
 * Get all active verified sellers
 */
export async function getActiveVerifiedSellers() {
  return await prisma.sellerProfile.findMany({
    where: {
      active: true,
      verified: true
    },
    orderBy: [
      { rating: 'desc' },
      { completedDeals: 'desc' }
    ]
  })
}

/**
 * Get all active sellers (verified or not)
 */
export async function getActiveSellers() {
  return await prisma.sellerProfile.findMany({
    where: { active: true },
    orderBy: [
      { verified: 'desc' },
      { rating: 'desc' },
      { completedDeals: 'desc' }
    ]
  })
}

/**
 * Search sellers by category
 */
export async function searchSellersByCategory(category: string) {
  return await prisma.sellerProfile.findMany({
    where: {
      active: true,
      categories: {
        hasSome: [category]
      }
    },
    orderBy: [
      { verified: 'desc' },
      { rating: 'desc' }
    ]
  })
}

/**
 * Search sellers by product keyword
 */
export async function searchSellersByProduct(keyword: string) {
  return await prisma.sellerProfile.findMany({
    where: {
      active: true,
      OR: [
        {
          products: {
            hasSome: [keyword]
          }
        },
        {
          categories: {
            hasSome: [keyword]
          }
        }
      ]
    },
    orderBy: [
      { verified: 'desc' },
      { rating: 'desc' }
    ]
  })
}

/**
 * Create a seller quote for an RFQ
 */
export async function createSellerQuote(data: {
  sellerId: string
  rfqId: string
  pricePerUnit: number // in cents
  totalPrice: number // in cents
  quantity: number
  leadTimeDays: number
  validUntil: Date
  notes?: string
  terms?: string
  specifications?: any
}) {
  return await prisma.sellerQuote.create({
    data: {
      sellerId: data.sellerId,
      rfqId: data.rfqId,
      pricePerUnit: data.pricePerUnit,
      totalPrice: data.totalPrice,
      quantity: data.quantity,
      leadTimeDays: data.leadTimeDays,
      validUntil: data.validUntil,
      notes: data.notes,
      terms: data.terms,
      specifications: data.specifications,
      status: 'pending'
    }
  })
}

/**
 * Get quotes for an RFQ
 */
export async function getQuotesForRFQ(rfqId: string) {
  return await prisma.sellerQuote.findMany({
    where: { rfqId },
    include: {
      seller: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
          verified: true,
          rating: true,
          completedDeals: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

/**
 * Accept a seller quote
 */
export async function acceptSellerQuote(quoteId: string, buyerUserId: string) {
  return await prisma.sellerQuote.update({
    where: { id: quoteId },
    data: {
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedBy: buyerUserId
    }
  })
}

/**
 * Reject a seller quote
 */
export async function rejectSellerQuote(quoteId: string) {
  return await prisma.sellerQuote.update({
    where: { id: quoteId },
    data: {
      status: 'rejected'
    }
  })
}

/**
 * Increment seller's completed deals counter
 */
export async function incrementCompletedDeals(sellerId: string) {
  return await prisma.sellerProfile.update({
    where: { id: sellerId },
    data: {
      completedDeals: {
        increment: 1
      }
    }
  })
}

/**
 * Update seller rating
 */
export async function updateSellerRating(sellerId: string, newRating: number) {
  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId }
  })

  if (!seller) throw new Error('Seller not found')

  // Calculate average rating (simple average for now)
  const currentRating = seller.rating || 0
  const completedDeals = seller.completedDeals || 0
  const totalWeight = completedDeals + 1
  const averageRating = ((currentRating * completedDeals) + newRating) / totalWeight

  return await prisma.sellerProfile.update({
    where: { id: sellerId },
    data: {
      rating: averageRating
    }
  })
}
