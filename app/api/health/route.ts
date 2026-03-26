import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
    ),
  ])
}

// GET /api/health - Health check endpoint with real tests
export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {}
  }

  // Check 1: Database (with timeout)
  try {
    const start = Date.now()
    // Dynamic import to avoid initialization issues
    const { query } = await import('@/lib/db')
    const dbResult = await withTimeout(
      query('SELECT 1 as test'),
      5000,
      'Database query'
    )
    results.checks.database = {
      status: 'ok',
      latency: Date.now() - start
    }
  } catch (error: any) {
    results.checks.database = {
      status: 'error',
      error: error.message
    }
  }

  // Check 2: Anthropic API (with timeout)
  try {
    const start = Date.now()
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    })

    const response = await withTimeout(
      anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say ok' }]
      }),
      10000,
      'Anthropic API'
    )

    results.checks.anthropic = {
      status: 'ok',
      latency: Date.now() - start,
      model: response.model
    }
  } catch (error: any) {
    results.checks.anthropic = {
      status: 'error',
      error: error.message
    }
  }

  // Check 3: Environment variables
  results.checks.env = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.length} chars)` : 'missing',
    POSTGRES_URL: process.env.POSTGRES_URL ? `set (${process.env.POSTGRES_URL.length} chars)` : 'missing',
  }

  // Overall status
  const dbOk = results.checks.database?.status === 'ok'
  const aiOk = results.checks.anthropic?.status === 'ok'
  results.status = dbOk && aiOk ? 'healthy' : 'degraded'

  return NextResponse.json(results, {
    status: results.status === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
