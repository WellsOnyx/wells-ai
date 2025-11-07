/**
 * Seller Notification API
 *
 * POST /api/sellers/notify - Manually trigger notifications for an RFQ
 * Used by admins or automated systems to notify sellers about matching RFQs
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { matchRFQWithSellers, filterHighQualityMatches } from '@/lib/rfq-matching'
import { sendRFQMatchNotification } from '@/lib/seller-notifications'
import { getRFQById } from '@/lib/notion'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      rfqId,
      minMatchScore = 50, // Only notify high-quality matches by default
      includeUnverified = true,
      testMode = false // If true, don't actually send notifications
    } = body

    if (!rfqId) {
      return NextResponse.json(
        { success: false, error: 'rfqId is required' },
        { status: 400 }
      )
    }

    // Get RFQ details from Notion
    const rfq = await getRFQById(rfqId)

    if (!rfq) {
      return NextResponse.json(
        { success: false, error: 'RFQ not found' },
        { status: 404 }
      )
    }

    // Match sellers to this RFQ
    const matchResult = await matchRFQWithSellers(
      {
        id: rfqId,
        category: (rfq as any).category || 'General',
        title: (rfq as any).title || 'RFQ',
        description: (rfq as any).description || '',
        requirements: (rfq as any).requirements || (rfq as any).description || '',
        quantity: (rfq as any).quantity,
        budget: (rfq as any).budget,
        userId: (rfq as any).buyerId || userId
      },
      {
        minMatchScore: 30, // Lower threshold for matching
        includeUnverified
      }
    )

    // Filter for high-quality matches only (unless overridden)
    const sellersToNotify = filterHighQualityMatches(
      matchResult.instantNotifications,
      minMatchScore
    )

    if (sellersToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sellers matched criteria',
        matchResult: {
          totalMatches: matchResult.totalMatches,
          highQualityMatches: matchResult.highQualityMatches,
          minMatchScore
        }
      })
    }

    // Send notifications to matched sellers
    const notificationResults = []

    for (const seller of sellersToNotify) {
      if (testMode) {
        // Test mode: just log what would be sent
        notificationResults.push({
          success: true,
          sellerId: seller.sellerId,
          sellerName: seller.sellerName,
          matchScore: seller.matchScore,
          channels: seller.notificationChannels,
          testMode: true
        })
      } else {
        // Actually send the notification
        const result = await sendRFQMatchNotification(seller, {
          rfqId: (rfq as any).id,
          category: (rfq as any).category || 'General',
          title: (rfq as any).title || 'RFQ',
          description: (rfq as any).description || '',
          requirements: (rfq as any).requirements || (rfq as any).description || '',
          quantity: (rfq as any).quantity,
          budget: (rfq as any).budget,
          buyerName: (rfq as any).buyerName,
          createdAt: new Date((rfq as any).createdAt || Date.now())
        })

        notificationResults.push(result)
      }
    }

    // Calculate success metrics
    const totalNotified = notificationResults.length
    const successful = notificationResults.filter(r => r.success).length
    const failed = totalNotified - successful

    return NextResponse.json({
      success: true,
      rfqId,
      matchResult: {
        totalMatches: matchResult.totalMatches,
        highQualityMatches: matchResult.highQualityMatches,
        notified: totalNotified
      },
      notifications: {
        total: totalNotified,
        successful,
        failed,
        results: notificationResults
      },
      testMode
    })

  } catch (error: any) {
    console.error('[Seller Notification API] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send notifications' },
      { status: 500 }
    )
  }
}
