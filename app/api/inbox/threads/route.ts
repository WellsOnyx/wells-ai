/**
 * Message Threads API
 * GET /api/inbox/threads - Get all conversation threads
 */

import { NextRequest, NextResponse } from 'next/server'
import { MessageThreads } from '@/lib/inbox/db'
import { monitorAPI } from '@/lib/monitoring'

export async function GET(req: NextRequest) {
  const monitor = monitorAPI('/api/inbox/threads', 'GET')

  try {
    const userId = req.headers.get('x-user-id') || 'default-user'
    const searchParams = req.nextUrl.searchParams

    const status = searchParams.get('status') || undefined

    const threads = await MessageThreads.findByUser(userId, status)

    monitor.end(true)
    return NextResponse.json({
      success: true,
      threads,
      count: threads.length,
    })
  } catch (error) {
    monitor.end(false)
    console.error('[THREADS API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch threads',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
