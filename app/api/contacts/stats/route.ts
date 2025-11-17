import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'
import { formatContactStats, type ContactStats } from '@/lib/contacts/response-formatter'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get total count
    const total = await prisma.contact.count({
      where: { userId }
    })

    // Get counts by targeting zone
    const [zone8090, zone50below, zone100avoid, unscored] = await Promise.all([
      prisma.contact.count({
        where: { userId, targetingZone: '80-90' }
      }),
      prisma.contact.count({
        where: { userId, targetingZone: '50-below' }
      }),
      prisma.contact.count({
        where: { userId, targetingZone: '100-avoid' }
      }),
      prisma.contact.count({
        where: { userId, targetingZone: null }
      })
    ])

    // Get counts by source
    const [uploaded, apollo, clay, manual] = await Promise.all([
      prisma.contact.count({
        where: { userId, source: 'uploaded' }
      }),
      prisma.contact.count({
        where: { userId, source: 'apollo' }
      }),
      prisma.contact.count({
        where: { userId, source: 'clay' }
      }),
      prisma.contact.count({
        where: { userId, source: 'manual' }
      })
    ])

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [recentlyAdded, recentlyContacted] = await Promise.all([
      prisma.contact.count({
        where: {
          userId,
          uploadedAt: { gte: sevenDaysAgo }
        }
      }),
      prisma.contact.count({
        where: {
          userId,
          lastContacted: { gte: sevenDaysAgo }
        }
      })
    ])

    const stats: ContactStats = {
      total,
      byZone: {
        '80-90': zone8090,
        '50-below': zone50below,
        '100-avoid': zone100avoid,
        unscored
      },
      bySource: {
        uploaded,
        apollo,
        clay,
        manual
      },
      recentlyAdded,
      recentlyContacted
    }

    const formattedResponse = formatContactStats(stats)

    return NextResponse.json({
      success: true,
      stats,
      formattedResponse
    })
  } catch (error: any) {
    console.error('[CONTACTS_STATS] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get contact stats',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
