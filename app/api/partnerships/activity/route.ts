import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * Get Category Pioneer activity feed
 * Returns recent partnership activity for homepage live feed
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!process.env.NOTION_ACTIVITY_LOG_DB) {
      // Return mock activity when Notion not configured
      const mockActivity = [
        {
          id: '1',
          type: 'Partnership Signed',
          company: 'ABB',
          category: 'Industrial Robotics',
          tier: 3,
          details: 'ABB officially partnered on Industrial Robotics. Partnership is now live on the platform.',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          amount: null
        },
        {
          id: '2',
          type: 'Category Opened',
          company: null,
          category: 'Cybersecurity Services',
          tier: null,
          details: 'Cybersecurity Services now open for pioneering',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
          amount: null
        },
        {
          id: '3',
          type: 'Partnership Signed',
          company: 'Medtronic',
          category: 'Medical Device Manufacturing',
          tier: 2,
          details: 'Medtronic officially partnered on Medical Device Manufacturing. Partnership is now live on the platform.',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          amount: null
        },
        {
          id: '4',
          type: 'Inquiry Received',
          company: 'Acme Corp',
          category: 'Injection Molding',
          tier: 2,
          details: 'Acme Corp submitted partnership inquiry for Injection Molding',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          amount: null
        }
      ]

      return NextResponse.json({
        success: true,
        activity: mockActivity.slice(0, limit),
        source: 'mock'
      })
    }

    // Fetch activity from Notion
    // TODO: Fix Notion SDK
    const response = { results: [] as any[] }
    // const response = await notion.databases.query({
    //   database_id: process.env.NOTION_ACTIVITY_LOG_DB,
    //   sorts: [
    //     { property: 'Timestamp', direction: 'descending' }
    //   ],
    //   page_size: limit
    // })

    const activity = response.results.map((page: any) => {
      const props = page.properties

      // Calculate relative time
      const timestamp = props['Timestamp']?.created_time || page.created_time
      const relativeTime = getRelativeTime(new Date(timestamp))

      // Extract tier from details if available
      let tier = null
      const details = props['Details']?.rich_text?.[0]?.plain_text || ''
      const tierMatch = details.match(/Tier (\d)/)
      if (tierMatch) {
        tier = parseInt(tierMatch[1])
      }

      return {
        id: page.id,
        type: props['Activity Type']?.select?.name || 'Unknown',
        company: props['Company']?.rich_text?.[0]?.plain_text || null,
        category: props['Category']?.rich_text?.[0]?.plain_text || '',
        tier,
        details,
        timestamp,
        relativeTime,
        amount: props['Amount']?.number || null
      }
    })

    return NextResponse.json({
      success: true,
      activity,
      source: 'notion'
    })

  } catch (error: any) {
    console.error('Activity feed error:', error)

    // Return empty array on error
    return NextResponse.json({
      success: false,
      activity: [],
      error: error.message
    })
  }
}

// Helper function to calculate relative time
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`
}
