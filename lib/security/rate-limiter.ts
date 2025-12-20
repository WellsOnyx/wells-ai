/**
 * Rate Limiter for Wells AI / Grain & Vault
 *
 * Production-ready rate limiting with:
 * - In-memory storage (single instance) with Redis adapter option
 * - Endpoint-specific rate limits
 * - User ID + IP-based limiting
 * - Proper 429 responses with Retry-After headers
 *
 * Usage:
 * ```typescript
 * import { rateLimit, RateLimitType } from '@/lib/security/rate-limiter'
 *
 * export async function POST(req: NextRequest) {
 *   const rateLimitResult = await rateLimit(req, 'withdrawal')
 *   if (!rateLimitResult.success) {
 *     return NextResponse.json(
 *       { error: rateLimitResult.error },
 *       {
 *         status: 429,
 *         headers: rateLimitResult.headers
 *       }
 *     )
 *   }
 *   // ... rest of handler
 * }
 * ```
 */

import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Rate limit endpoint types with different limits
 */
export type RateLimitType = 'auth' | 'deposit' | 'withdrawal' | 'chat' | 'general'

/**
 * Configuration for a rate limit tier
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Time window in seconds */
  windowSeconds: number
  /** Human-readable name for logging */
  name: string
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean
  /** Error message if rate limited */
  error?: string
  /** Remaining requests in current window */
  remaining: number
  /** Total allowed requests */
  limit: number
  /** Seconds until rate limit resets */
  resetInSeconds: number
  /** Headers to include in response */
  headers: Record<string, string>
}

/**
 * Stored rate limit entry
 */
interface RateLimitEntry {
  /** Number of requests made in current window */
  count: number
  /** Window start timestamp (ms) */
  windowStart: number
}

/**
 * Rate limit storage adapter interface
 * Implement this for Redis, Upstash, etc.
 */
export interface RateLimitStore {
  /**
   * Get current rate limit state for a key
   */
  get(key: string): Promise<RateLimitEntry | null>

  /**
   * Increment request count and return new state
   */
  increment(key: string, windowMs: number): Promise<RateLimitEntry>

  /**
   * Clear rate limit for a key (for testing/admin)
   */
  clear(key: string): Promise<void>
}

// ============================================================================
// RATE LIMIT CONFIGURATIONS
// ============================================================================

/**
 * Rate limit configurations by endpoint type
 * Adjust these based on your production needs
 */
export const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  /**
   * Auth endpoints (login, signup, password reset)
   * Very strict to prevent brute force attacks
   */
  auth: {
    maxRequests: 5,
    windowSeconds: 60,
    name: 'Authentication',
  },

  /**
   * Deposit endpoints (adding funds)
   * Moderate limit - deposits are valuable but should be allowed
   */
  deposit: {
    maxRequests: 10,
    windowSeconds: 60,
    name: 'Deposit',
  },

  /**
   * Withdrawal endpoints (removing funds)
   * Moderate limit - need to allow legitimate withdrawals
   * but prevent rapid draining attempts
   */
  withdrawal: {
    maxRequests: 10,
    windowSeconds: 60,
    name: 'Withdrawal',
  },

  /**
   * Chat endpoints (AI conversations)
   * Higher limit but still controlled to manage AI costs
   */
  chat: {
    maxRequests: 30,
    windowSeconds: 60,
    name: 'Chat',
  },

  /**
   * General API endpoints
   * Generous limit for normal operations
   */
  general: {
    maxRequests: 60,
    windowSeconds: 60,
    name: 'General API',
  },
}

// ============================================================================
// IN-MEMORY STORE (Single Instance)
// ============================================================================

/**
 * In-memory rate limit store
 * Suitable for single-instance deployments
 *
 * IMPORTANT: For multi-instance deployments, use RedisRateLimitStore
 * to share state across instances
 */
class InMemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    // Check if window has expired
    const now = Date.now()
    if (now - entry.windowStart > 60 * 1000) {
      this.store.delete(key)
      return null
    }

    return entry
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now()
    const existing = this.store.get(key)

    if (!existing || now - existing.windowStart > windowMs) {
      // Start new window
      const entry: RateLimitEntry = {
        count: 1,
        windowStart: now,
      }
      this.store.set(key, entry)
      return entry
    }

    // Increment existing window
    existing.count++
    return existing
  }

  async clear(key: string): Promise<void> {
    this.store.delete(key)
  }

  /**
   * Remove expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now()
    const maxAge = 10 * 60 * 1000 // 10 minutes

    // Use Array.from for better ES2017 compatibility
    const entries = Array.from(this.store.entries())
    for (const [key, entry] of entries) {
      if (now - entry.windowStart > maxAge) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Stop cleanup interval (for testing)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Get store size (for monitoring)
   */
  size(): number {
    return this.store.size
  }
}

// ============================================================================
// REDIS STORE (Multi-Instance Ready)
// ============================================================================

/**
 * Redis-based rate limit store for multi-instance deployments
 *
 * To use:
 * ```typescript
 * import Redis from 'ioredis'
 * const redis = new Redis(process.env.REDIS_URL)
 * setRateLimitStore(new RedisRateLimitStore(redis))
 * ```
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redis: any // Redis client (ioredis or similar)
  private prefix: string

  constructor(redisClient: any, prefix: string = 'rl:') {
    this.redis = redisClient
    this.prefix = prefix
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const data = await this.redis.get(`${this.prefix}${key}`)
    if (!data) return null

    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const fullKey = `${this.prefix}${key}`
    const now = Date.now()

    // Use Lua script for atomic increment
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      local entry = nil

      if current then
        entry = cjson.decode(current)
        if tonumber(ARGV[1]) - entry.windowStart > tonumber(ARGV[2]) then
          entry = { count = 1, windowStart = tonumber(ARGV[1]) }
        else
          entry.count = entry.count + 1
        end
      else
        entry = { count = 1, windowStart = tonumber(ARGV[1]) }
      end

      redis.call('SET', KEYS[1], cjson.encode(entry))
      redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]) + 60000)

      return cjson.encode(entry)
    `

    try {
      const result = await this.redis.eval(luaScript, 1, fullKey, now, windowMs)
      return JSON.parse(result)
    } catch (error) {
      // Fallback to non-atomic operation if Lua fails
      console.error('Redis Lua script failed, using fallback:', error)
      const existing = await this.get(key)

      if (!existing || now - existing.windowStart > windowMs) {
        const entry: RateLimitEntry = { count: 1, windowStart: now }
        await this.redis.setex(fullKey, Math.ceil(windowMs / 1000) + 60, JSON.stringify(entry))
        return entry
      }

      existing.count++
      await this.redis.setex(fullKey, Math.ceil(windowMs / 1000) + 60, JSON.stringify(existing))
      return existing
    }
  }

  async clear(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}${key}`)
  }
}

// ============================================================================
// RATE LIMITER CORE
// ============================================================================

// Global store instance (can be swapped for Redis)
let rateLimitStore: RateLimitStore = new InMemoryRateLimitStore()

/**
 * Set custom rate limit store (for Redis integration)
 */
export function setRateLimitStore(store: RateLimitStore): void {
  rateLimitStore = store
}

/**
 * Get the current rate limit store (for testing/monitoring)
 */
export function getRateLimitStore(): RateLimitStore {
  return rateLimitStore
}

/**
 * Extract client identifier from request
 * Uses User ID if authenticated, otherwise IP address
 */
async function getClientIdentifier(req: NextRequest): Promise<{
  identifier: string
  type: 'user' | 'ip'
}> {
  // Try to get authenticated user ID from Clerk
  try {
    const { userId } = await auth()
    if (userId) {
      return { identifier: `user:${userId}`, type: 'user' }
    }
  } catch {
    // Auth failed, fall back to IP
  }

  // Fall back to IP address
  const ip = getClientIP(req)
  return { identifier: `ip:${ip}`, type: 'ip' }
}

/**
 * Extract client IP from request headers
 * Handles common proxy headers
 */
function getClientIP(req: NextRequest): string {
  // Check common proxy headers
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    const ips = forwardedFor.split(',').map((ip) => ip.trim())
    return ips[0] || 'unknown'
  }

  const realIP = req.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Vercel-specific header
  const vercelForwardedFor = req.headers.get('x-vercel-forwarded-for')
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  // Cloudflare-specific header
  const cfConnectingIP = req.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  return 'unknown'
}

/**
 * Main rate limiting function
 *
 * @param req - Next.js request object
 * @param type - Type of rate limit to apply
 * @returns Rate limit result with success status and headers
 */
export async function rateLimit(
  req: NextRequest,
  type: RateLimitType = 'general'
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIGS[type]
  const windowMs = config.windowSeconds * 1000

  // Get client identifier
  const { identifier, type: identifierType } = await getClientIdentifier(req)

  // Create rate limit key: type:identifier
  const key = `${type}:${identifier}`

  // Get current state and increment
  const entry = await rateLimitStore.increment(key, windowMs)

  // Calculate remaining requests and reset time
  const remaining = Math.max(0, config.maxRequests - entry.count)
  const resetTime = entry.windowStart + windowMs
  const resetInSeconds = Math.ceil((resetTime - Date.now()) / 1000)

  // Build standard rate limit headers
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
    'X-RateLimit-Policy': `${config.maxRequests};w=${config.windowSeconds}`,
  }

  // Check if rate limited
  if (entry.count > config.maxRequests) {
    // Log rate limit hit for monitoring
    console.warn(
      `[RateLimit] ${config.name} limit exceeded for ${identifierType}: ${identifier.split(':')[1]?.substring(0, 8)}... ` +
        `(${entry.count}/${config.maxRequests} requests)`
    )

    return {
      success: false,
      error: `Rate limit exceeded. Please try again in ${resetInSeconds} seconds.`,
      remaining: 0,
      limit: config.maxRequests,
      resetInSeconds,
      headers: {
        ...headers,
        'Retry-After': resetInSeconds.toString(),
      },
    }
  }

  return {
    success: true,
    remaining,
    limit: config.maxRequests,
    resetInSeconds,
    headers,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a 429 Too Many Requests response
 *
 * @param result - Rate limit result from rateLimit()
 * @param customMessage - Optional custom error message
 */
export function rateLimitResponse(
  result: RateLimitResult,
  customMessage?: string
): Response {
  return new Response(
    JSON.stringify({
      error: customMessage || result.error || 'Too many requests',
      retryAfter: result.resetInSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...result.headers,
      },
    }
  )
}

/**
 * Rate limit with automatic response
 * Returns null if allowed, or a Response if rate limited
 *
 * Usage:
 * ```typescript
 * const blocked = await rateLimitOrRespond(req, 'withdrawal')
 * if (blocked) return blocked
 * ```
 */
export async function rateLimitOrRespond(
  req: NextRequest,
  type: RateLimitType = 'general',
  customMessage?: string
): Promise<Response | null> {
  const result = await rateLimit(req, type)
  if (!result.success) {
    return rateLimitResponse(result, customMessage)
  }
  return null
}

/**
 * Check rate limit without incrementing
 * Useful for pre-flight checks
 */
export async function checkRateLimit(
  req: NextRequest,
  type: RateLimitType = 'general'
): Promise<{
  wouldBeAllowed: boolean
  currentCount: number
  limit: number
}> {
  const config = RATE_LIMIT_CONFIGS[type]
  const { identifier } = await getClientIdentifier(req)
  const key = `${type}:${identifier}`

  const entry = await rateLimitStore.get(key)
  const currentCount = entry?.count || 0

  return {
    wouldBeAllowed: currentCount < config.maxRequests,
    currentCount,
    limit: config.maxRequests,
  }
}

/**
 * Clear rate limit for a specific user/IP
 * Useful for admin actions or after successful verification
 */
export async function clearRateLimit(
  identifier: string,
  type: RateLimitType = 'general'
): Promise<void> {
  const key = `${type}:${identifier}`
  await rateLimitStore.clear(key)
}

/**
 * Clear all rate limits for a user ID
 */
export async function clearUserRateLimits(userId: string): Promise<void> {
  const types: RateLimitType[] = ['auth', 'deposit', 'withdrawal', 'chat', 'general']
  const identifier = `user:${userId}`

  await Promise.all(types.map((type) => clearRateLimit(identifier, type)))
}

// ============================================================================
// MIDDLEWARE WRAPPER
// ============================================================================

/**
 * Create a rate-limited API handler wrapper
 *
 * Usage:
 * ```typescript
 * export const POST = withRateLimit('withdrawal', async (req) => {
 *   // Your handler logic
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function withRateLimit<T>(
  type: RateLimitType,
  handler: (req: NextRequest) => Promise<T>
): (req: NextRequest) => Promise<T | Response> {
  return async (req: NextRequest) => {
    const blocked = await rateLimitOrRespond(req, type)
    if (blocked) return blocked
    return handler(req)
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default rateLimit
