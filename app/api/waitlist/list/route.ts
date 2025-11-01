import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient } from '@/lib/notion'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: NextRequest) {
  try {
    // Require authentication (optional - you can add admin check here)
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const waitlistDbId = process.env.NOTION_WAITLIST_DATABASE_ID

    if (!waitlistDbId) {
      // Return empty list if Notion isn't configured
      return NextResponse.json({
        total: 0,
        waitlist: []
      })
    }

    const notion = createNotionClient()

    // Get all waitlist entries sorted by position
    // @ts-ignore - Notion SDK types issue
    const response = await notion.databases.query({
      database_id: waitlistDbId,
      sorts: [
        {
          property: 'Position',
          direction: 'ascending'
        }
      ]
    })

    const waitlist = response.results.map((page: any) => ({
      id: page.id,
      email: page.properties.Email?.email || '',
      position: page.properties.Position?.number || 0,
      inviteCode: page.properties['Invite Code']?.rich_text?.[0]?.text?.content || '',
      invitesUsed: page.properties['Invites Used']?.number || 0,
      invitesRemaining: page.properties['Invites Remaining']?.number || 3,
      status: page.properties.Status?.select?.name || 'Waiting',
      joinedDate: page.properties['Joined Date']?.date?.start || ''
    }))

    return NextResponse.json({
      total: waitlist.length,
      waitlist
    })

  } catch (error) {
    console.error('Waitlist fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch waitlist' },
      { status: 500 }
    )
  }
}
