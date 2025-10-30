import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

export async function GET() {
  try {
    if (!process.env.NOTION_GTM_OUTREACH_DB) {
      return NextResponse.json({
        success: false,
        error: 'NOTION_GTM_OUTREACH_DB not configured',
        messages: []
      })
    }

    // Query Notion for pending outreach messages
    // TODO: Fix Notion SDK
    const response = { results: [] as any[] }
    // const response = await notion.databases.query({
    //   database_id: process.env.NOTION_GTM_OUTREACH_DB,
    //   filter: {
    //     property: 'Status',
    //     select: {
    //       equals: '⏸️ Pending Approval'
    //     }
    //   },
    //   sorts: [
    //     {
    //       property: 'Generated',
    //       direction: 'ascending'
    //     }
    //   ],
    //   page_size: 50
    // })

    // Format messages for frontend
    const messages = await Promise.all(
      response.results.map(async (page: any) => {
        const props = page.properties

        // Get target details from relation
        let targetData = {
          name: 'Unknown',
          title: '',
          company: '',
          email: '',
          phone: ''
        }

        if (props.Target?.relation?.[0]?.id) {
          try {
            const targetPage = await notion.pages.retrieve({
              page_id: props.Target.relation[0].id
            })
            const targetProps = (targetPage as any).properties
            targetData = {
              name: targetProps.Name?.title?.[0]?.plain_text || 'Unknown',
              title: targetProps.Title?.rich_text?.[0]?.plain_text || '',
              company: targetProps.Company?.rich_text?.[0]?.plain_text || '',
              email: targetProps.Email?.email || '',
              phone: targetProps.Phone?.phone_number || ''
            }
          } catch (error) {
            console.error('Failed to fetch target:', error)
          }
        }

        return {
          id: page.id,
          target: targetData,
          message: props.Message?.rich_text?.[0]?.plain_text || '',
          channel: props.Channel?.select?.name || 'Email',
          campaign: props.Campaign?.relation?.[0]?.id || '',
          status: props.Status?.select?.name || ''
        }
      })
    )

    return NextResponse.json({ success: true, messages })

  } catch (error: any) {
    console.error('Failed to fetch pending messages:', error)
    return NextResponse.json(
      { success: false, error: error.message, messages: [] },
      { status: 500 }
    )
  }
}
