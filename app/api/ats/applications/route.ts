import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  createCandidate,
  createApplication,
  listApplications,
  convertToATSApplication,
} from '@/lib/merge/ats'

/**
 * POST /api/ats/applications
 *
 * Submit job application to ATS
 * Creates candidate and application in connected ATS
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { jobId, jobSeeker, accountToken } = body

    if (!jobId || !jobSeeker || !accountToken) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, jobSeeker, accountToken' },
        { status: 400 }
      )
    }

    // Validate job seeker data
    if (!jobSeeker.firstName || !jobSeeker.lastName || !jobSeeker.email) {
      return NextResponse.json(
        { error: 'Job seeker must have firstName, lastName, and email' },
        { status: 400 }
      )
    }

    console.log('[ATS] Creating application for:', {
      jobId,
      candidate: `${jobSeeker.firstName} ${jobSeeker.lastName}`,
    })

    // Convert to ATS format
    const { candidate, application } = convertToATSApplication({
      jobSeeker,
      jobId,
      source: 'Wells AI',
    })

    // Step 1: Create candidate in ATS
    const createdCandidate = await createCandidate({
      accountToken,
      candidate,
    })

    console.log('[ATS] Candidate created:', createdCandidate.id)

    // Step 2: Create application (link candidate to job)
    const createdApplication = await createApplication({
      accountToken,
      application: {
        ...application,
        candidate: createdCandidate.id,
        job: jobId,
      },
    })

    console.log('[ATS] Application submitted:', createdApplication.id)

    return NextResponse.json({
      success: true,
      candidateId: createdCandidate.id,
      applicationId: createdApplication.id,
      message: 'Application submitted successfully',
    })
  } catch (error: any) {
    console.error('[ATS] Submit application error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit application' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ats/applications
 *
 * List applications from ATS
 * Query params:
 * - jobId: Filter by job
 * - candidateId: Filter by candidate
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

    const searchParams = req.nextUrl.searchParams
    const jobId = searchParams.get('jobId') || undefined
    const candidateId = searchParams.get('candidateId') || undefined
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const accountToken = req.headers.get('X-Account-Token')

    if (!accountToken) {
      return NextResponse.json(
        { error: 'ATS not connected. Please connect your ATS first.' },
        { status: 400 }
      )
    }

    const applications = await listApplications({
      accountToken,
      jobId,
      candidateId,
      pageSize,
    })

    console.log(`[ATS] Retrieved ${applications.length} applications for org ${orgId}`)

    return NextResponse.json({
      applications,
      count: applications.length,
    })
  } catch (error: any) {
    console.error('[ATS] List applications error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch applications' },
      { status: 500 }
    )
  }
}
