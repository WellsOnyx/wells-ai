import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listJobs, getJob } from '@/lib/merge/ats'

/**
 * GET /api/ats/jobs
 *
 * List all jobs from connected ATS
 * Query params:
 * - jobId: Get specific job
 * - status: Filter by status (OPEN, CLOSED, DRAFT, ARCHIVED)
 * - pageSize: Number of results
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

    // Get query params
    const searchParams = req.nextUrl.searchParams
    const jobId = searchParams.get('jobId')
    const status = searchParams.get('status') as 'OPEN' | 'CLOSED' | 'DRAFT' | 'ARCHIVED' | null
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    // Get account token from database (in production, fetch from DB)
    // For now, we'll expect it to be passed in the header
    const accountToken = req.headers.get('X-Account-Token')

    if (!accountToken) {
      return NextResponse.json(
        { error: 'ATS not connected. Please connect your ATS first.' },
        { status: 400 }
      )
    }

    // Get specific job or list jobs
    if (jobId) {
      const job = await getJob({ accountToken, jobId })
      return NextResponse.json({ job })
    }

    const jobs = await listJobs({
      accountToken,
      status: status || 'OPEN',
      pageSize,
    })

    console.log(`[ATS] Retrieved ${jobs.length} jobs for org ${orgId}`)

    return NextResponse.json({
      jobs,
      count: jobs.length,
    })
  } catch (error: any) {
    console.error('[ATS] List jobs error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}
