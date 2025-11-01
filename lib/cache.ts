import { Redis } from '@upstash/redis'
import { monitorCache } from './monitoring'

/**
 * Redis caching layer for Wells AI
 * Uses Upstash Redis for serverless-friendly caching
 */

// Lazy initialization - only create client when needed
let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  if (!redis) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured')
  }
  return redis
}

export interface CacheOptions {
  ttl?: number // Time to live in seconds (default: 300 = 5 minutes)
  tags?: string[] // Cache tags for invalidation
}

/**
 * Cache wrapper with monitoring
 */
class CacheManager {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const monitor = monitorCache('get', key)

    try {
      const client = getRedis()
      const value = await client.get<T>(key)
      monitor.end(true, { hit: value !== null })
      return value
    } catch (error) {
      monitor.end(false, { error: error instanceof Error ? error.message : 'Unknown error' })
      console.error('[CACHE] Get error:', error)
      return null
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    const monitor = monitorCache('set', key)
    const ttl = options.ttl || 300 // Default 5 minutes

    try {
      const client = getRedis()
      await client.setex(key, ttl, JSON.stringify(value))

      // Store tags for invalidation
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await client.sadd(`tag:${tag}`, key)
          await client.expire(`tag:${tag}`, ttl)
        }
      }

      monitor.end(true, { ttl })
      return true
    } catch (error) {
      monitor.end(false, { error: error instanceof Error ? error.message : 'Unknown error' })
      console.error('[CACHE] Set error:', error)
      return false
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    const monitor = monitorCache('del', key)

    try {
      const client = getRedis()
      await client.del(key)
      monitor.end(true)
      return true
    } catch (error) {
      monitor.end(false, { error: error instanceof Error ? error.message : 'Unknown error' })
      console.error('[CACHE] Delete error:', error)
      return false
    }
  }

  /**
   * Invalidate cache by tag
   */
  async invalidateTag(tag: string): Promise<number> {
    try {
      const client = getRedis()
      const keys = await client.smembers(`tag:${tag}`)

      if (keys.length > 0) {
        await client.del(...keys)
        await client.del(`tag:${tag}`)
      }

      return keys.length
    } catch (error) {
      console.error('[CACHE] Invalidate tag error:', error)
      return 0
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = getRedis()
      const result = await client.exists(key)
      return result === 1
    } catch (error) {
      console.error('[CACHE] Exists error:', error)
      return false
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Fetch and cache
    const value = await fetcher()
    await this.set(key, value, options)
    return value
  }

  /**
   * Increment counter
   */
  async increment(key: string, by: number = 1): Promise<number> {
    try {
      const client = getRedis()
      return await client.incrby(key, by)
    } catch (error) {
      console.error('[CACHE] Increment error:', error)
      return 0
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, by: number = 1): Promise<number> {
    try {
      const client = getRedis()
      return await client.decrby(key, by)
    } catch (error) {
      console.error('[CACHE] Decrement error:', error)
      return 0
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const client = getRedis()
      const values = await client.mget<T[]>(...keys)
      return values
    } catch (error) {
      console.error('[CACHE] Mget error:', error)
      return keys.map(() => null)
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(entries: Record<string, any>, ttl: number = 300): Promise<boolean> {
    try {
      const client = getRedis()
      const pipeline = client.pipeline()

      for (const [key, value] of Object.entries(entries)) {
        pipeline.setex(key, ttl, JSON.stringify(value))
      }

      await pipeline.exec()
      return true
    } catch (error) {
      console.error('[CACHE] Mset error:', error)
      return false
    }
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clear(): Promise<boolean> {
    try {
      const client = getRedis()
      await client.flushdb()
      return true
    } catch (error) {
      console.error('[CACHE] Clear error:', error)
      return false
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ keys: number; memory: string; hits: number; misses: number }> {
    try {
      // Upstash Redis REST API doesn't have info() command
      // Return mock stats for now
      return {
        keys: 0, // Would need to scan for accurate count
        memory: '0MB',
        hits: 0,
        misses: 0,
      }
    } catch (error) {
      console.error('[CACHE] Stats error:', error)
      return { keys: 0, memory: '0MB', hits: 0, misses: 0 }
    }
  }
}

// Export singleton instance
export const cache = new CacheManager()

/**
 * Cache key builders for consistency
 */
export const CacheKeys = {
  // Supplier caching
  supplier: (id: string) => `supplier:${id}`,
  supplierMatches: (rfqId: string) => `matches:${rfqId}`,
  supplierList: (filters: string) => `suppliers:list:${filters}`,

  // Quote caching
  quote: (id: string) => `quote:${id}`,
  quotesByRfq: (rfqId: string) => `quotes:rfq:${rfqId}`,
  quotesList: (status: string) => `quotes:${status}`,

  // Deal caching
  deal: (id: string) => `deal:${id}`,
  dealsList: (stage: string) => `deals:${stage}`,

  // Analytics caching
  analytics: (type: string, period: string) => `analytics:${type}:${period}`,

  // GTM caching
  prospects: (practiceGroup: string) => `prospects:${practiceGroup}`,
  icp: (practiceGroup: string) => `icp:${practiceGroup}`,

  // Rate limiting
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
}

/**
 * Cache TTL presets (in seconds)
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute - frequently changing data
  MEDIUM: 300, // 5 minutes - moderate change
  LONG: 3600, // 1 hour - rarely changing
  DAY: 86400, // 24 hours - very stable data
  WEEK: 604800, // 7 days - nearly static
}

/**
 * Rate limiting helper using Redis
 */
export class RateLimiter {
  /**
   * Check if action is allowed under rate limit
   */
  async checkLimit(
    identifier: string,
    limit: number,
    window: number // in seconds
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = CacheKeys.rateLimit(identifier)

    try {
      const client = getRedis()
      const count = await cache.increment(key)

      if (count === 1) {
        // First request, set expiry
        await client.expire(key, window)
      }

      const ttl = await client.ttl(key)
      const resetAt = Date.now() + (ttl * 1000)

      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
      }
    } catch (error) {
      console.error('[RATELIMIT] Check error:', error)
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: limit,
        resetAt: Date.now() + window * 1000,
      }
    }
  }
}

export const rateLimiter = new RateLimiter()
