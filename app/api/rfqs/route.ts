import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getRFQs, getRFQById } from '@/lib/notion'
import { matchRFQWithSellers, filterHighQualityMatches } from '@/lib/rfq-matching'
import { sendRFQMatchNotification } from '@/lib/seller-notifications'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/rfqs
 * Fetch RFQs from Notion - Organization-scoped
 *
 * Query params:
 * - id: Get specific RFQ by ID
 * - orgId: Filter RFQs by organization ID
 */
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
    const id = searchParams.get('id')
    const orgId = searchParams.get('orgId')

    // Get specific RFQ by ID
    if (id) {
      const rfq = await getRFQById(id)
      if (!rfq) {
        return NextResponse.json(
          { success: false, error: 'RFQ not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, rfq })
    }

    // Get RFQs with optional organization filter
    const rfqs = await getRFQs(50, orgId || undefined)

    return NextResponse.json({
      success: true,
      rfqs,
      count: rfqs.length,
      organizationId: orgId || null
    })

  } catch (error: any) {
    console.error('Error fetching RFQs:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch RFQs' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rfqs
 * Create a new RFQ and automatically notify matching sellers
 *
 * Body:
 * - category: RFQ category
 * - title: RFQ title
 * - description: RFQ description
 * - requirements: Detailed requirements
 * - quantity: Optional quantity
 * - budget: Optional budget
 * - autoNotify: Whether to automatically notify sellers (default: true)
 * - minMatchScore: Minimum match score for notifications (default: 50)
 */
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
      category,
      title,
      description,
      requirements,
      quantity,
      budget,
      autoNotify = true,
      minMatchScore = 50
    } = body

    // Validate required fields
    if (!category || !title || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: category, title, description' },
        { status: 400 }
      )
    }

    // Create RFQ in database
    const rfq = await prisma.rFQ.create({
      data: {
        userId,
        category,
        title,
        description,
        requirements: requirements ? { requirements } : undefined,
        status: 'open'
      }
    })

    console.log(`[RFQ Created] ${rfq.id} - ${title}`)

    // Auto-notify matching sellers if enabled
    let notificationResults = null

    if (autoNotify) {
      try {
        // Match sellers to this RFQ
        const matchResult = await matchRFQWithSellers(
          {
            id: rfq.id,
            category,
            title,
            description,
            requirements: requirements || description,
            quantity,
            budget,
            userId
          },
          {
            minMatchScore: 30, // Lower threshold for matching
            includeUnverified: true
          }
        )

        // Filter for high-quality instant notifications only
        const sellersToNotify = filterHighQualityMatches(
          matchResult.instantNotifications,
          minMatchScore
        )

        console.log(`[RFQ ${rfq.id}] Matched ${matchResult.totalMatches} sellers, notifying ${sellersToNotify.length} high-quality matches`)

        // Send notifications asynchronously (don't block response)
        const notifications = []

        for (const seller of sellersToNotify) {
          const result = await sendRFQMatchNotification(seller, {
            rfqId: rfq.id,
            category,
            title,
            description,
            requirements: requirements || description,
            quantity,
            budget,
            createdAt: rfq.createdAt
          })

          notifications.push(result)
        }

        const successful = notifications.filter(n => n.success).length

        notificationResults = {
          totalMatches: matchResult.totalMatches,
          highQualityMatches: matchResult.highQualityMatches,
          notified: sellersToNotify.length,
          successful,
          failed: sellersToNotify.length - successful
        }

        console.log(`[RFQ ${rfq.id}] Notifications sent: ${successful}/${sellersToNotify.length} successful`)

      } catch (notifyError: any) {
        console.error(`[RFQ ${rfq.id}] Notification error:`, notifyError)
        // Don't fail the request if notifications fail
        notificationResults = {
          error: notifyError.message
        }
      }
    }

    return NextResponse.json({
      success: true,
      rfq: {
        id: rfq.id,
        category: rfq.category,
        title: rfq.title,
        description: rfq.description,
        status: rfq.status,
        createdAt: rfq.createdAt
      },
      notifications: autoNotify ? notificationResults : { autoNotify: false }
    })

  } catch (error: any) {
    console.error('[RFQ Creation] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create RFQ' },
      { status: 500 }
    )
  }
}
