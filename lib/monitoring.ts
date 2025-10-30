import * as Sentry from '@sentry/nextjs'

/**
 * Performance monitoring utilities for Wells AI
 * Tracks API response times, database queries, and AI operations
 */

export interface PerformanceMetric {
  operation: string
  duration: number
  success: boolean
  metadata?: Record<string, any>
}

export class PerformanceMonitor {
  private startTime: number
  private operation: string
  private metadata: Record<string, any>

  constructor(operation: string, metadata?: Record<string, any>) {
    this.operation = operation
    this.metadata = metadata || {}
    this.startTime = Date.now()
  }

  /**
   * End monitoring and record metrics
   */
  end(success: boolean = true, additionalMetadata?: Record<string, any>) {
    const duration = Date.now() - this.startTime

    const metric: PerformanceMetric = {
      operation: this.operation,
      duration,
      success,
      metadata: { ...this.metadata, ...additionalMetadata },
    }

    // Send to Sentry
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${this.operation}: ${duration}ms`,
      level: success ? 'info' : 'error',
      data: metric.metadata,
    })

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PERF] ${this.operation}: ${duration}ms`, metric.metadata)
    }

    // Alert if operation is slow (>2 seconds)
    if (duration > 2000) {
      Sentry.captureMessage(`Slow operation: ${this.operation}`, {
        level: 'warning',
        tags: {
          operation: this.operation,
          duration: `${duration}ms`,
        },
        extra: metric.metadata,
      })
    }

    return metric
  }

  /**
   * Add metadata to the current operation
   */
  addMetadata(key: string, value: any) {
    this.metadata[key] = value
  }
}

/**
 * Monitor API endpoint performance
 */
export function monitorAPI(endpoint: string, method: string = 'POST') {
  return new PerformanceMonitor('api', {
    endpoint,
    method,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Monitor database query performance
 */
export function monitorDB(query: string, type: 'postgres' | 'notion' = 'postgres') {
  return new PerformanceMonitor('database', {
    query: query.substring(0, 100), // Truncate long queries
    type,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Monitor AI operation performance
 */
export function monitorAI(operation: string, model: string = 'claude-sonnet-4') {
  return new PerformanceMonitor('ai', {
    operation,
    model,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Monitor cache operations
 */
export function monitorCache(operation: 'get' | 'set' | 'del', key: string) {
  return new PerformanceMonitor('cache', {
    operation,
    key,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Track custom business metrics
 */
export function trackMetric(name: string, value: number, unit: string = 'count') {
  Sentry.setMeasurement(name, value, unit)

  if (process.env.NODE_ENV === 'development') {
    console.log(`[METRIC] ${name}: ${value} ${unit}`)
  }
}

/**
 * Track user actions
 */
export function trackAction(action: string, userId?: string, metadata?: Record<string, any>) {
  Sentry.addBreadcrumb({
    category: 'user-action',
    message: action,
    level: 'info',
    data: {
      userId,
      ...metadata,
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Capture error with context
 */
export function captureError(
  error: Error,
  context?: {
    tags?: Record<string, string>
    extra?: Record<string, any>
    level?: 'error' | 'warning' | 'info'
  }
) {
  Sentry.captureException(error, {
    level: context?.level || 'error',
    tags: context?.tags,
    extra: context?.extra,
  })

  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR]', error, context)
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(userId: string, email?: string, metadata?: Record<string, any>) {
  Sentry.setUser({
    id: userId,
    email,
    ...metadata,
  })
}

/**
 * Clear user context
 */
export function clearUser() {
  Sentry.setUser(null)
}

/**
 * Start a transaction for distributed tracing
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
    tags: {
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Measure function execution time
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const monitor = new PerformanceMonitor(name, metadata)

  try {
    const result = await fn()
    monitor.end(true)
    return result
  } catch (error) {
    monitor.end(false, { error: error instanceof Error ? error.message : 'Unknown error' })
    throw error
  }
}

/**
 * Get current performance stats
 */
export function getPerformanceStats() {
  if (typeof window !== 'undefined' && window.performance) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const paint = performance.getEntriesByType('paint')

    return {
      // Page load metrics
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
      loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,

      // Paint metrics
      firstPaint: paint.find(entry => entry.name === 'first-paint')?.startTime,
      firstContentfulPaint: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime,

      // Resource metrics
      resourceCount: performance.getEntriesByType('resource').length,
    }
  }

  return null
}
