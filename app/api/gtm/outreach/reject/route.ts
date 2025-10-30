import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

export async function POST(request: Request) {
  try {
    const { messageId } = await request.json()

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'messageId required' },
        { status: 400 }
      )
    }

    // Update outreach status in Notion
    await notion.pages.update({
      page_id: messageId,
      properties: {
        'Status': {
          select: { name: '❌ Rejected' }
        },
        'Rejected At': {
          date: { start: new Date().toISOString() }
        }
      }
    })

    // Get target to update their stage
    const outreachPage = await notion.pages.retrieve({ page_id: messageId })
    const props = (outreachPage as any).properties
    const targetId = props.Target?.relation?.[0]?.id

    if (targetId) {
      await notion.pages.update({
        page_id: targetId,
        properties: {
          'Stage': { select: { name: 'Outreach Rejected' } }
        }
      })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Rejection error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
