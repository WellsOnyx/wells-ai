import { NextResponse } from 'next/server'

/**
 * GTM Activity API - Log outreach activity
 *
 * POST /api/gtm/activity
 *
 * Logs sales activities (emails, calls, LinkedIn, demos)
 */

export interface Activity {
  id: string
  leadId: string
  type: 'email' | 'linkedin_connect' | 'linkedin_message' | 'linkedin_voice' | 'call' | 'demo' | 'loom' | 'meeting'
  subject?: string
  notes: string
  response?: string
  responseDate?: string
  outcome?: 'positive' | 'negative' | 'neutral' | 'no_response'
  templateUsed?: string
  touchNumber?: number
  createdAt: string
  createdBy?: string
}

export interface ActivityStats {
  totalActivities: number
  byType: Record<string, number>
  byOutcome: Record<string, number>
  responseRate: number
  avgTouchesBeforeResponse: number
}

// In-memory store for demo (replace with database in production)
const activities: Map<string, Activity> = new Map()

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      )
    }
    if (!body.type) {
      return NextResponse.json(
        { error: 'Activity type is required' },
        { status: 400 }
      )
    }

    // Validate type
    const validTypes = ['email', 'linkedin_connect', 'linkedin_message', 'linkedin_voice', 'call', 'demo', 'loom', 'meeting']
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid activity type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Calculate touch number for this lead
    const leadActivities = Array.from(activities.values()).filter(a => a.leadId === body.leadId)
    const touchNumber = leadActivities.length + 1

    // Create activity
    const activity: Activity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      leadId: body.leadId,
      type: body.type,
      subject: body.subject || '',
      notes: body.notes || '',
      response: body.response || '',
      responseDate: body.responseDate || '',
      outcome: body.outcome || 'no_response',
      templateUsed: body.templateUsed || '',
      touchNumber,
      createdAt: new Date().toISOString(),
      createdBy: body.createdBy || 'system',
    }

    // Store activity
    activities.set(activity.id, activity)

    return NextResponse.json({
      success: true,
      activity,
      message: 'Activity logged successfully',
    })
  } catch (error) {
    console.error('Error logging activity:', error)
    return NextResponse.json(
      { error: 'Failed to log activity' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')
    const type = searchParams.get('type')
    const outcome = searchParams.get('outcome')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const stats = searchParams.get('stats') === 'true'

    let filteredActivities = Array.from(activities.values())

    // Apply filters
    if (leadId) {
      filteredActivities = filteredActivities.filter(a => a.leadId === leadId)
    }
    if (type) {
      filteredActivities = filteredActivities.filter(a => a.type === type)
    }
    if (outcome) {
      filteredActivities = filteredActivities.filter(a => a.outcome === outcome)
    }

    // Sort by createdAt descending
    filteredActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // If stats requested, return statistics
    if (stats) {
      const byType: Record<string, number> = {}
      const byOutcome: Record<string, number> = {}
      let responsesReceived = 0
      let totalTouchesToResponse = 0
      let responsesCount = 0

      filteredActivities.forEach(a => {
        // Count by type
        byType[a.type] = (byType[a.type] || 0) + 1

        // Count by outcome
        if (a.outcome) {
          byOutcome[a.outcome] = (byOutcome[a.outcome] || 0) + 1
        }

        // Calculate response metrics
        if (a.outcome === 'positive' || a.outcome === 'negative') {
          responsesReceived++
          if (a.touchNumber) {
            totalTouchesToResponse += a.touchNumber
            responsesCount++
          }
        }
      })

      const activityStats: ActivityStats = {
        totalActivities: filteredActivities.length,
        byType,
        byOutcome,
        responseRate: filteredActivities.length > 0
          ? (responsesReceived / filteredActivities.length) * 100
          : 0,
        avgTouchesBeforeResponse: responsesCount > 0
          ? totalTouchesToResponse / responsesCount
          : 0,
      }

      return NextResponse.json({ stats: activityStats })
    }

    // Apply pagination
    const paginatedActivities = filteredActivities.slice(offset, offset + limit)

    return NextResponse.json({
      activities: paginatedActivities,
      total: filteredActivities.length,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 }
      )
    }

    const existingActivity = activities.get(body.id)
    if (!existingActivity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      )
    }

    // Update activity (commonly used to add response)
    const updatedActivity: Activity = {
      ...existingActivity,
      ...body,
    }

    activities.set(body.id, updatedActivity)

    return NextResponse.json({
      success: true,
      activity: updatedActivity,
      message: 'Activity updated successfully',
    })
  } catch (error) {
    console.error('Error updating activity:', error)
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    )
  }
}
