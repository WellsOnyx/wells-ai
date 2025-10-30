import { NextRequest, NextResponse } from 'next/server'
import { Conversations, Deals, Analytics } from '@/lib/db'
import { cache, CacheKeys, CacheTTL } from '@/lib/cache'
import { monitorAPI } from '@/lib/monitoring'

/**
 * Analytics dashboard API
 * Provides real-time metrics for internal monitoring
 */
export async function GET(req: NextRequest) {
  const monitor = monitorAPI('/api/analytics/dashboard', 'GET')

  try {
    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || '7d'

    // Calculate date range
    const now = new Date()
    const startDate = new Date()

    switch (range) {
      case '24h':
        startDate.setHours(now.getHours() - 24)
        break
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      default:
        startDate.setDate(now.getDate() - 7)
    }

    // Try cache first
    const cacheKey = CacheKeys.analytics('dashboard', range)
    const cached = await cache.get(cacheKey)

    if (cached) {
      monitor.end(true, { source: 'cache' })
      return NextResponse.json(cached)
    }

    // Fetch metrics from database
    const [conversationStats, revenueData] = await Promise.all([
      Conversations.getStats(startDate, now),
      Deals.getRevenue(startDate, now),
    ])

    // Get trend data
    const trendData = await Analytics.getEventCounts('conversation', startDate, now)

    // Calculate performance metrics (mock for now - would come from performance_metrics table)
    const performance = {
      avgResponseTime: 850, // ms
      p95ResponseTime: 1500,
      p99ResponseTime: 2200,
      errorRate: 0.005, // 0.5%
    }

    // Cache statistics
    const cacheStats = await cache.getStats()
    const totalRequests = 1000 // Would track this in Redis
    const cacheHits = 850 // Would track this in Redis

    const analyticsData = {
      performance,
      usage: {
        totalConversations: conversationStats.totalConversations,
        totalMessages: conversationStats.totalMessages,
        avgMessagesPerConversation: conversationStats.avgMessagesPerConversation,
        activeUsers: Math.floor(conversationStats.totalConversations * 0.7), // Approximate
      },
      revenue: {
        totalRevenue: revenueData,
        totalDeals: await getDealsCount(startDate, now),
        avgDealSize: await getAvgDealSize(startDate, now),
        wellsFees: revenueData * 0.0033, // 0.33% fee
      },
      cache: {
        hitRate: cacheHits / totalRequests,
        missRate: (totalRequests - cacheHits) / totalRequests,
        totalKeys: parseInt(cacheStats.keys.toString()),
      },
      trends: trendData.map(day => ({
        date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        conversations: day.count,
        deals: Math.floor(day.count * 0.15), // Mock: 15% conversion
        revenue: Math.floor(day.count * 0.15 * 45000), // Mock: avg deal $45k
      })),
    }

    // Cache for 1 minute
    await cache.set(cacheKey, analyticsData, { ttl: 60 })

    monitor.end(true, { source: 'database' })

    return NextResponse.json(analyticsData)
  } catch (error) {
    monitor.end(false)
    console.error('[API] Analytics dashboard error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Helper functions
 */
async function getDealsCount(startDate: Date, endDate: Date): Promise<number> {
  try {
    const result = await Deals.getRevenue(startDate, endDate)
    // This is a simplification - would actually count deals
    return Math.floor(result / 45000) // Assuming avg deal is $45k
  } catch (error) {
    return 0
  }
}

async function getAvgDealSize(startDate: Date, endDate: Date): Promise<number> {
  try {
    const totalRevenue = await Deals.getRevenue(startDate, endDate)
    const totalDeals = await getDealsCount(startDate, endDate)
    return totalDeals > 0 ? Math.floor(totalRevenue / totalDeals) : 0
  } catch (error) {
    return 0
  }
}
