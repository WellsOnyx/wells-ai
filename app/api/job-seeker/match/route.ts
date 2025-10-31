/**
 * Job Matching API
 *
 * Match job seekers with open Executive Talent RFQs
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getRFQs } from '@/lib/notion'
import { matchJobSeekerToRFQs, generateMatchRecommendations } from '@/lib/job-seeker/matching'

/**
 * GET /api/job-seeker/match
 * Get matched jobs for current user
 *
 * Query params:
 * - category: Filter by category (optional)
 * - limit: Max results (default 20)
 * - minScore: Minimum compatibility score (default 40)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get job seeker profile
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const profile = (user.publicMetadata as any)?.jobSeekerProfile

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found - complete onboarding first' },
        { status: 404 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const limit = parseInt(searchParams.get('limit') || '20')
    const minScore = parseInt(searchParams.get('minScore') || '40')

    // Get all open RFQs
    const rfqs = await getRFQs(100)

    // Filter by category if specified
    const filteredRFQs = category
      ? rfqs.filter(rfq => rfq.category === category)
      : rfqs

    // Match job seeker to RFQs
    const matches = await matchJobSeekerToRFQs(profile, filteredRFQs, minScore)

    // Limit results
    const limitedMatches = matches.slice(0, limit)

    // Add recommendations to each match
    const enrichedMatches = limitedMatches.map(match => ({
      ...match,
      recommendations: generateMatchRecommendations(match)
    }))

    return NextResponse.json({
      success: true,
      matches: enrichedMatches,
      count: enrichedMatches.length,
      totalAvailable: matches.length
    })
  } catch (error: any) {
    console.error('Error matching jobs:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to match jobs' },
      { status: 500 }
    )
  }
}
