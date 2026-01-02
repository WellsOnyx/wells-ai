import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

// GET /api/health - Health check endpoint with real tests
export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {}
  }

  // Check 1: Database
  try {
    const start = Date.now()
    const dbResult = await query('SELECT 1 as test')
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

  // Check 2: Anthropic API
  try {
    const start = Date.now()
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say ok' }]
    })

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
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.slice(0,10)}...)` : 'missing',
    POSTGRES_URL: process.env.POSTGRES_URL ? 'set' : 'missing',
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
