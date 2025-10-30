import { NextRequest, NextResponse } from 'next/server'
import { cache, CacheKeys, CacheTTL } from '@/lib/cache'
import { Suppliers } from '@/lib/db'
import { monitorAPI } from '@/lib/monitoring'

/**
 * Cached supplier matching endpoint
 * Demonstrates Redis caching for improved performance
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/suppliers/cached', 'POST')

  try {
    const { categories } = await req.json()

    if (!categories || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'Categories array required' },
        { status: 400 }
      )
    }

    // Create cache key based on categories
    const cacheKey = CacheKeys.supplierList(categories.sort().join(','))

    // Try to get from cache first
    const cached = await cache.get(cacheKey)
    if (cached) {
      monitor.end(true, { source: 'cache', count: (cached as any[]).length })
      return NextResponse.json({
        suppliers: cached,
        source: 'cache',
        cached: true,
      })
    }

    // Cache miss - fetch from database
    const suppliers = await Suppliers.findByCategories(categories)

    // Cache the results for 5 minutes
    await cache.set(cacheKey, suppliers, {
      ttl: CacheTTL.MEDIUM,
      tags: ['suppliers', ...categories],
    })

    monitor.end(true, { source: 'database', count: suppliers.length })

    return NextResponse.json({
      suppliers,
      source: 'database',
      cached: false,
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Cached supplier match error:', error)

    return NextResponse.json(
      { error: 'Failed to match suppliers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
