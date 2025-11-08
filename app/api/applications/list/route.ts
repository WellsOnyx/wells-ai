import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// For now, return mock data since we don't have applications table yet
// TODO: Add JobApplication model to Prisma schema

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mock applications data (will be replaced with real database queries)
    const applications = [
      {
        id: 'app_001',
        jobId: 'job_eng_001',
        jobTitle: 'Senior Frontend Engineer',
        company: 'Fast-growing SaaS Startup',
        location: 'San Francisco, CA (Remote)',
        salary: { min: 140000, max: 180000, currency: 'USD' },
        status: 'interview',
        appliedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        lastUpdate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        nextStep: 'Technical interview scheduled for next Monday'
      },
      {
        id: 'app_002',
        jobId: 'job_pm_001',
        jobTitle: 'Senior Product Manager',
        company: 'AI-powered Analytics Platform',
        location: 'Remote (Global)',
        salary: { min: 160000, max: 200000, currency: 'USD' },
        status: 'pending',
        appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'app_003',
        jobId: 'job_eng_002',
        jobTitle: 'Full Stack Engineer',
        company: 'Series B Healthcare Tech',
        location: 'Remote (US)',
        salary: { min: 130000, max: 170000, currency: 'USD' },
        status: 'reviewing',
        appliedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        lastUpdate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]

    return NextResponse.json({
      applications,
      total: applications.length
    })

  } catch (error: any) {
    console.error('[APPLICATIONS LIST] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load applications' },
      { status: 500 }
    )
  }
}
