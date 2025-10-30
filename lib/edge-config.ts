/**
 * Vercel Edge Config for load balancing and feature flags
 * Provides ultra-fast configuration reads at the edge
 */

// Edge Config values (configured in Vercel dashboard)
export interface EdgeConfig {
  // Feature flags
  features: {
    gtmAutomation: boolean
    aiChat: boolean
    paymentProcessing: boolean
    supplierMatching: boolean
    analytics: boolean
  }

  // Rate limiting
  rateLimits: {
    api: {
      perMinute: number
      perHour: number
    }
    chat: {
      perMinute: number
      perHour: number
    }
  }

  // Load balancing
  loadBalancing: {
    maxConcurrentRequests: number
    queueTimeout: number // ms
    enableQueueing: boolean
  }

  // Circuit breaker
  circuitBreaker: {
    enabled: boolean
    errorThreshold: number // percentage
    resetTimeout: number // ms
  }

  // Maintenance mode
  maintenance: {
    enabled: boolean
    message: string
    allowedIPs: string[]
  }
}

// Default configuration (used when Edge Config is not available)
const defaultConfig: EdgeConfig = {
  features: {
    gtmAutomation: true,
    aiChat: true,
    paymentProcessing: true,
    supplierMatching: true,
    analytics: true,
  },
  rateLimits: {
    api: {
      perMinute: 60,
      perHour: 1000,
    },
    chat: {
      perMinute: 30,
      perHour: 500,
    },
  },
  loadBalancing: {
    maxConcurrentRequests: 100,
    queueTimeout: 30000,
    enableQueueing: true,
  },
  circuitBreaker: {
    enabled: true,
    errorThreshold: 50, // 50% error rate
    resetTimeout: 60000, // 1 minute
  },
  maintenance: {
    enabled: false,
    message: 'Wells AI is currently undergoing maintenance. Please check back soon.',
    allowedIPs: [],
  },
}

/**
 * Get Edge Config value
 * In production, this would use @vercel/edge-config
 */
export async function getEdgeConfig(): Promise<EdgeConfig> {
  try {
    // In production with Vercel Edge Config:
    // const { get } = require('@vercel/edge-config')
    // return await get('wellsai')

    // For now, return default config
    return defaultConfig
  } catch (error) {
    console.error('[EDGE_CONFIG] Failed to fetch config:', error)
    return defaultConfig
  }
}

/**
 * Check if a feature is enabled
 */
export async function isFeatureEnabled(feature: keyof EdgeConfig['features']): Promise<boolean> {
  const config = await getEdgeConfig()
  return config.features[feature]
}

/**
 * Get rate limit for a specific service
 */
export async function getRateLimit(service: 'api' | 'chat'): Promise<{ perMinute: number; perHour: number }> {
  const config = await getEdgeConfig()
  return config.rateLimits[service]
}

/**
 * Check if system is in maintenance mode
 */
export async function isMaintenanceMode(clientIP?: string): Promise<boolean> {
  const config = await getEdgeConfig()

  if (!config.maintenance.enabled) {
    return false
  }

  // Allow specific IPs during maintenance
  if (clientIP && config.maintenance.allowedIPs.includes(clientIP)) {
    return false
  }

  return true
}

/**
 * Get load balancing configuration
 */
export async function getLoadBalancingConfig() {
  const config = await getEdgeConfig()
  return config.loadBalancing
}

/**
 * Circuit breaker state management
 */
class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const config = await getEdgeConfig()

    if (!config.circuitBreaker.enabled) {
      return fn()
    }

    // Check if circuit should reset
    if (
      this.state === 'open' &&
      Date.now() - this.lastFailureTime > config.circuitBreaker.resetTimeout
    ) {
      this.state = 'half-open'
      this.failures = 0
    }

    // If circuit is open, reject immediately
    if (this.state === 'open') {
      throw new Error('Circuit breaker is open - service temporarily unavailable')
    }

    try {
      const result = await fn()

      // Success - reset failures if in half-open state
      if (this.state === 'half-open') {
        this.state = 'closed'
        this.failures = 0
      }

      return result
    } catch (error) {
      this.failures++
      this.lastFailureTime = Date.now()

      // Open circuit if error threshold exceeded
      const errorRate = this.failures / (this.failures + 1) * 100
      if (errorRate >= config.circuitBreaker.errorThreshold) {
        this.state = 'open'
      }

      throw error
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    }
  }
}

export const circuitBreaker = new CircuitBreaker()

/**
 * Request queue for load management
 */
class RequestQueue {
  private queue: Array<() => Promise<any>> = []
  private processing = 0

  async add<T>(fn: () => Promise<T>): Promise<T> {
    const config = await getLoadBalancingConfig()

    // If under limit, execute immediately
    if (this.processing < config.maxConcurrentRequests) {
      this.processing++
      try {
        const result = await fn()
        this.processing--
        this.processQueue()
        return result
      } catch (error) {
        this.processing--
        this.processQueue()
        throw error
      }
    }

    // If queueing disabled, reject
    if (!config.enableQueueing) {
      throw new Error('Service at capacity - queueing disabled')
    }

    // Add to queue with timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.queue.findIndex(item => item === queuedFn)
        if (index !== -1) {
          this.queue.splice(index, 1)
        }
        reject(new Error('Request timeout - queue took too long'))
      }, config.queueTimeout)

      const queuedFn = async () => {
        clearTimeout(timeoutId)
        this.processing++
        try {
          const result = await fn()
          this.processing--
          this.processQueue()
          resolve(result)
        } catch (error) {
          this.processing--
          this.processQueue()
          reject(error)
        }
      }

      this.queue.push(queuedFn)
    })
  }

  private async processQueue() {
    const config = await getLoadBalancingConfig()

    while (
      this.queue.length > 0 &&
      this.processing < config.maxConcurrentRequests
    ) {
      const fn = this.queue.shift()
      if (fn) {
        fn()
      }
    }
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
    }
  }
}

export const requestQueue = new RequestQueue()
