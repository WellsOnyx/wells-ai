import { NextResponse } from 'next/server'

export async function GET() {
  const hasDatabase = !!process.env.DATABASE_URL
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

  return NextResponse.json({
    DATABASE_URL: hasDatabase ? 'SET' : 'MISSING',
    ANTHROPIC_API_KEY: hasAnthropic ? 'SET' : 'MISSING',
    DATABASE_URL_PREFIX: hasDatabase ? process.env.DATABASE_URL!.substring(0, 15) + '...' : 'N/A',
  })
}
