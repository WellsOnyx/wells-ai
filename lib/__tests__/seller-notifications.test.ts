/**
 * Seller Notification System Tests
 *
 * Unit tests for RFQ matching and notification system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { matchSellersToRFQ } from '../seller-onboarding'
import { createDigest, calculateNotificationPriority } from '../seller-notifications'
import { filterHighQualityMatches, sortSellersByQuality } from '../rfq-matching'
import type { SellerMatch } from '../rfq-matching'

describe('Seller Notification System', () => {
  describe('RFQ Matching', () => {
    const mockSellers = [
      {
        id: 'seller_1',
        userId: 'user_1',
        companyName: 'Acme Electronics',
        contactName: 'John Doe',
        email: 'john@acme.com',
        phone: '+15551234567',
        categories: ['Electronics', 'PCB Manufacturing'],
        products: ['STM32 Microcontrollers', 'Custom PCBs'],
        services: ['PCB Design', 'Prototyping'],
        leadTimeDays: 14,
        shipmingRegions: ['North America'],
        certifications: ['ISO 9001', 'RoHS'],
        pricingModel: 'volume-discount' as const,
        notificationChannels: ['email', 'sms'] as const,
        notificationFrequency: 'instant' as const,
        verified: true,
        active: true,
        completedDeals: 10,
        rating: 4.5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'seller_2',
        userId: 'user_2',
        companyName: 'Beta Components',
        contactName: 'Jane Smith',
        email: 'jane@beta.com',
        categories: ['Electronics'],
        products: ['Resistors', 'Capacitors'],
        services: [],
        leadTimeDays: 7,
        shipmingRegions: ['Global'],
        certifications: [],
        pricingModel: 'fixed' as const,
        notificationChannels: ['email'] as const,
        notificationFrequency: 'daily-digest' as const,
        verified: false,
        active: true,
        completedDeals: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    const mockRFQ = {
      category: 'Electronics',
      requirements: 'Need STM32 microcontrollers for production run',
      quantity: '1000',
      budget: '$5000'
    }

    it('should match sellers based on category', () => {
      const matches = matchSellersToRFQ(mockRFQ, mockSellers)

      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0].matchScore).toBeGreaterThanOrEqual(40) // Category match
    })

    it('should prioritize verified sellers', () => {
      const matches = matchSellersToRFQ(mockRFQ, mockSellers)

      // Find verified and unverified matches
      const verifiedMatch = matches.find(m => m.seller.verified)
      const unverifiedMatch = matches.find(m => !m.seller.verified)

      if (verifiedMatch && unverifiedMatch) {
        expect(verifiedMatch.matchScore).toBeGreaterThan(unverifiedMatch.matchScore)
      }
    })

    it('should give bonus for product match', () => {
      const matches = matchSellersToRFQ(mockRFQ, mockSellers)

      const productMatch = matches.find(m =>
        m.seller.products.some(p => p.toLowerCase().includes('stm32'))
      )

      if (productMatch) {
        expect(productMatch.matchScore).toBeGreaterThanOrEqual(70) // Category + Product
      }
    })
  })

  describe('Match Quality Filtering', () => {
    const mockMatches: SellerMatch[] = [
      {
        sellerId: 'seller_1',
        sellerName: 'High Quality',
        contactName: 'John',
        email: 'john@example.com',
        matchScore: 85,
        matchReasons: ['Category', 'Product', 'Verified'],
        notificationChannels: ['sms', 'email'],
        notificationFrequency: 'INSTANT' as any,
        verified: true,
        completedDeals: 10
      },
      {
        sellerId: 'seller_2',
        sellerName: 'Medium Quality',
        contactName: 'Jane',
        email: 'jane@example.com',
        matchScore: 55,
        matchReasons: ['Category'],
        notificationChannels: ['email'],
        notificationFrequency: 'INSTANT' as any,
        verified: false,
        completedDeals: 3
      },
      {
        sellerId: 'seller_3',
        sellerName: 'Low Quality',
        contactName: 'Bob',
        email: 'bob@example.com',
        matchScore: 35,
        matchReasons: ['Category'],
        notificationChannels: ['email'],
        notificationFrequency: 'INSTANT' as any,
        verified: false,
        completedDeals: 0
      }
    ]

    it('should filter high-quality matches', () => {
      const highQuality = filterHighQualityMatches(mockMatches, 50)

      expect(highQuality.length).toBe(2)
      expect(highQuality[0].matchScore).toBeGreaterThan(50)
    })

    it('should sort by quality (verified first, then score)', () => {
      const sorted = sortSellersByQuality(mockMatches)

      // First should be verified
      expect(sorted[0].verified).toBe(true)
      expect(sorted[0].matchScore).toBe(85)
    })
  })

  describe('Notification Priority', () => {
    it('should mark verified + high score as high priority', () => {
      const match: SellerMatch = {
        sellerId: 'seller_1',
        sellerName: 'Test',
        contactName: 'John',
        email: 'test@example.com',
        matchScore: 75,
        matchReasons: ['Category', 'Product', 'Verified'],
        notificationChannels: ['sms'],
        notificationFrequency: 'INSTANT' as any,
        verified: true,
        completedDeals: 10
      }

      const priority = calculateNotificationPriority(match)
      expect(priority).toBe('high')
    })

    it('should mark unverified + low score as low priority', () => {
      const match: SellerMatch = {
        sellerId: 'seller_2',
        sellerName: 'Test',
        contactName: 'Jane',
        email: 'test@example.com',
        matchScore: 40,
        matchReasons: ['Category'],
        notificationChannels: ['email'],
        notificationFrequency: 'INSTANT' as any,
        verified: false,
        completedDeals: 1
      }

      const priority = calculateNotificationPriority(match)
      expect(priority).toBe('low')
    })
  })

  describe('Digest Creation', () => {
    const mockNotifications = [
      {
        id: 'notif_1',
        sellerId: 'seller_1',
        rfqId: 'rfq_1',
        matchScore: 80,
        matchReasons: ['Category', 'Product'],
        notificationType: 'DAILY_DIGEST',
        status: 'PENDING',
        channels: ['email'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'notif_2',
        sellerId: 'seller_1',
        rfqId: 'rfq_2',
        matchScore: 65,
        matchReasons: ['Category'],
        notificationType: 'DAILY_DIGEST',
        status: 'PENDING',
        channels: ['email'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'notif_3',
        sellerId: 'seller_1',
        rfqId: 'rfq_3',
        matchScore: 90,
        matchReasons: ['Category', 'Product', 'Verified'],
        notificationType: 'DAILY_DIGEST',
        status: 'PENDING',
        channels: ['email'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    it('should create daily digest with correct stats', () => {
      const digest = createDigest(mockNotifications, 'daily')

      expect(digest.count).toBe(3)
      expect(digest.avgMatchScore).toBe(78) // (80 + 65 + 90) / 3
      expect(digest.highestMatch).toBe(90)
      expect(digest.summary).toContain('3 new RFQ matches')
      expect(digest.summary).toContain('avg match score 78%')
    })

    it('should create weekly digest with correct stats', () => {
      const digest = createDigest(mockNotifications, 'weekly')

      expect(digest.count).toBe(3)
      expect(digest.summary).toContain('this week')
    })

    it('should handle empty notifications', () => {
      const digest = createDigest([], 'daily')

      expect(digest.count).toBe(0)
      expect(digest.avgMatchScore).toBe(0)
      expect(digest.highestMatch).toBe(-Infinity)
    })
  })
})
