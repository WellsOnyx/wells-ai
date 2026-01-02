import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

// GET /api/ping - Simple ping endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.length} chars)` : 'missing',
      POSTGRES_URL: process.env.POSTGRES_URL ? `set (${process.env.POSTGRES_URL.length} chars)` : 'missing',
      NODE_ENV: process.env.NODE_ENV,
    }
  })
}
