/**
 * Redis Cache for Blockchain Data
 * Reduces RPC calls and improves performance
 */

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export interface CachedPrice {
  nav: number
  change24h: number
  change7d: number
  change30d: number
  timestamp: string
  supply: number
  totalAssets: number
  tiers: {
    liquid: number
    float: number
    physical: number
    investments: number
    receivables: number
  }
}

export interface PriceHistory {
  timestamp: string
  nav: number
  totalAssets: number
  supply: number
}

const KEYS = {
  CURRENT_PRICE: 'grain:price:current',
  PRICE_HISTORY_HOUR: 'grain:price:history:hour',
  PRICE_HISTORY_DAY: 'grain:price:history:day',
  PRICE_HISTORY_WEEK: 'grain:price:history:week',
  TOTAL_SUPPLY: 'grain:supply:total',
  INVESTOR_COUNT: 'grain:investors:count',
  TRANSACTION_VOLUME_24H: 'grain:volume:24h',
} as const

/**
 * Cache current GRAIN price (1 minute TTL)
 */
export async function cacheCurrentPrice(data: CachedPrice): Promise<void> {
  await redis.setex(KEYS.CURRENT_PRICE, 60, JSON.stringify(data))
}

/**
 * Get cached current price
 */
export async function getCachedPrice(): Promise<CachedPrice | null> {
  const cached = await redis.get<string>(KEYS.CURRENT_PRICE)
  if (!cached) return null
  return JSON.parse(cached)
}

/**
 * Add price to hourly history (keep 7 days)
 */
export async function addPriceToHistory(data: PriceHistory): Promise<void> {
  const key = KEYS.PRICE_HISTORY_HOUR
  await redis.zadd(key, { score: Date.now(), member: JSON.stringify(data) })

  // Keep only last 7 days (604800 seconds)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  await redis.zremrangebyscore(key, 0, weekAgo)
}

/**
 * Get price history for a time range
 */
export async function getPriceHistory(
  period: 'hour' | 'day' | 'week',
  limit: number = 100
): Promise<PriceHistory[]> {
  const key = KEYS.PRICE_HISTORY_HOUR
  const results = await redis.zrange(key, -limit, -1)

  if (!results || results.length === 0) return []

  return results.map((item) => JSON.parse(item as string))
}

/**
 * Calculate price change percentage
 */
export async function calculatePriceChange(currentNAV: number): Promise<{
  change24h: number
  change7d: number
  change30d: number
}> {
  const history = await getPriceHistory('hour', 1000)

  if (history.length === 0) {
    return { change24h: 0, change7d: 0, change30d: 0 }
  }

  const now = Date.now()
  const day24Ago = now - 24 * 60 * 60 * 1000
  const day7Ago = now - 7 * 24 * 60 * 60 * 1000
  const day30Ago = now - 30 * 24 * 60 * 60 * 1000

  // Find closest prices
  const price24h = history.find(
    (h) => new Date(h.timestamp).getTime() >= day24Ago
  )
  const price7d = history.find(
    (h) => new Date(h.timestamp).getTime() >= day7Ago
  )
  const price30d = history.find(
    (h) => new Date(h.timestamp).getTime() >= day30Ago
  )

  return {
    change24h: price24h ? ((currentNAV - price24h.nav) / price24h.nav) * 100 : 0,
    change7d: price7d ? ((currentNAV - price7d.nav) / price7d.nav) * 100 : 0,
    change30d: price30d ? ((currentNAV - price30d.nav) / price30d.nav) * 100 : 0,
  }
}

/**
 * Cache transaction volume
 */
export async function incrementVolume24h(amount: number): Promise<void> {
  const key = KEYS.TRANSACTION_VOLUME_24H
  await redis.incrby(key, Math.floor(amount))
  await redis.expire(key, 86400) // 24 hours
}

export async function getVolume24h(): Promise<number> {
  const volume = await redis.get<number>(KEYS.TRANSACTION_VOLUME_24H)
  return volume || 0
}

/**
 * Cache investor count
 */
export async function cacheInvestorCount(count: number): Promise<void> {
  await redis.setex(KEYS.INVESTOR_COUNT, 300, count) // 5 minutes
}

export async function getCachedInvestorCount(): Promise<number | null> {
  return await redis.get<number>(KEYS.INVESTOR_COUNT)
}

/**
 * Invalidate all caches (for admin updates)
 */
export async function invalidateAllCaches(): Promise<void> {
  await Promise.all([
    redis.del(KEYS.CURRENT_PRICE),
    redis.del(KEYS.TOTAL_SUPPLY),
    redis.del(KEYS.INVESTOR_COUNT),
  ])
}

/**
 * Health check
 */
export async function cacheHealthCheck(): Promise<boolean> {
  try {
    await redis.ping()
    return true
  } catch (error) {
    console.error('[Cache] Health check failed:', error)
    return false
  }
}
