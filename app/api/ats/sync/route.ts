import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { syncEmployees, getATSIntegrationInfo } from '@/lib/merge/ats'

/**
 * GET /api/ats/sync
 *
 * Sync employee data from HRIS
 * Also provides integration status and info
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const action = searchParams.get('action') // 'sync' or 'info'

    const accountToken = req.headers.get('X-Account-Token')

    if (!accountToken) {
      return NextResponse.json(
        { error: 'HRIS not connected. Please connect your HRIS first.' },
        { status: 400 }
      )
    }

    // Get integration info
    if (action === 'info') {
      const integrationInfo = await getATSIntegrationInfo(accountToken)
      return NextResponse.json({
        integration: integrationInfo,
      })
    }

    // Sync employees
    console.log('[HRIS] Starting employee sync for org:', orgId)

    const employees = await syncEmployees({
      accountToken,
      pageSize,
    })

    console.log(`[HRIS] Synced ${employees.length} employees`)

    // In production, you would save these to your database
    // For now, just return them
    return NextResponse.json({
      success: true,
      employees,
      count: employees.length,
      syncedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[HRIS] Sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync employees' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ats/sync
 *
 * Trigger manual sync of employee data
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { accountToken } = body

    if (!accountToken) {
      return NextResponse.json(
        { error: 'Account token required' },
        { status: 400 }
      )
    }

    console.log('[HRIS] Manual sync triggered for org:', orgId)

    const employees = await syncEmployees({
      accountToken,
      pageSize: 100,
    })

    // TODO: Save to database in production

    return NextResponse.json({
      success: true,
      count: employees.length,
      syncedAt: new Date().toISOString(),
      message: `Successfully synced ${employees.length} employees`,
    })
  } catch (error: any) {
    console.error('[HRIS] Manual sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync employees' },
      { status: 500 }
    )
  }
}
