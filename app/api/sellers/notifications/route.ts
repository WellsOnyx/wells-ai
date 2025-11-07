/**
 * Seller Notification History API
 *
 * GET /api/sellers/notifications?sellerId=xxx - Get notification history for a seller
 * GET /api/sellers/notifications?sellerId=xxx&stats=true - Get notification statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getSellerNotificationHistory,
  getSellerNotificationStats
} from '@/lib/seller-notifications'
import { getSellerProfileByUserId } from '@/lib/db/seller-helpers'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')
    const stats = searchParams.get('stats') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // If no sellerId provided, get seller profile for current user
    let sellerIdToUse = sellerId

    if (!sellerIdToUse) {
      const sellerProfile = await getSellerProfileByUserId(userId)

      if (!sellerProfile) {
        return NextResponse.json(
          { success: false, error: 'Seller profile not found' },
          { status: 404 }
        )
      }

      sellerIdToUse = sellerProfile.id
    }

    // Return statistics if requested
    if (stats) {
      const statistics = await getSellerNotificationStats(sellerIdToUse)

      return NextResponse.json({
        success: true,
        sellerId: sellerIdToUse,
        stats: statistics
      })
    }

    // Return notification history
    const notifications = await getSellerNotificationHistory(sellerIdToUse, limit)

    return NextResponse.json({
      success: true,
      sellerId: sellerIdToUse,
      count: notifications.length,
      notifications: notifications.map(n => ({
        id: n.id,
        rfqId: n.rfqId,
        matchScore: n.matchScore,
        matchReasons: n.matchReasons,
        notificationType: n.notificationType,
        status: n.status,
        channels: n.channels,
        createdAt: n.createdAt,
        sentAt: n.sentAt,
        deliveredAt: n.deliveredAt,
        openedAt: n.openedAt,
        clickedAt: n.clickedAt,
        responded: n.responded,
        respondedAt: n.respondedAt
      }))
    })

  } catch (error: any) {
    console.error('[Seller Notification History API] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}
