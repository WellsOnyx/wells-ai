import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * Update Category Pioneer partnership
 * Used to change status, update revenue, mark requirements met, etc.
 */

export async function POST(request: Request) {
  try {
    const {
      partnershipId,
      status,
      introCallDate,
      agreementSignedDate,
      goLiveDate,
      agreementUrl,
      tierRequirementsMet,
      notes
    } = await request.json()

    if (!partnershipId) {
      return NextResponse.json(
        { success: false, error: 'partnershipId required' },
        { status: 400 }
      )
    }

    if (!process.env.NOTION_PARTNERSHIPS_DB) {
      return NextResponse.json({
        success: true,
        message: 'Partnership updated (simulation mode - Notion not configured)'
      })
    }

    // Build update properties
    const updateProps: any = {}

    if (status) {
      updateProps['Status'] = { select: { name: status } }
    }

    if (introCallDate) {
      updateProps['Intro Call Date'] = { date: { start: introCallDate } }
    }

    if (agreementSignedDate) {
      updateProps['Agreement Signed Date'] = { date: { start: agreementSignedDate } }
    }

    if (goLiveDate) {
      updateProps['Go-Live Date'] = { date: { start: goLiveDate } }
    }

    if (agreementUrl) {
      updateProps['Agreement URL'] = { url: agreementUrl }
    }

    if (typeof tierRequirementsMet === 'boolean') {
      updateProps['Tier Requirements Met'] = { checkbox: tierRequirementsMet }
    }

    if (notes) {
      updateProps['Notes'] = { rich_text: [{ text: { content: notes } }] }
    }

    // Update partnership
    await notion.pages.update({
      page_id: partnershipId,
      properties: updateProps
    })

    // Get partnership details for activity log
    const partnershipPage = await notion.pages.retrieve({ page_id: partnershipId })
    const props = (partnershipPage as any).properties

    const company = props['Pioneer Company']?.rich_text?.[0]?.plain_text || 'Unknown'
    const category = props['Category Name']?.select?.name || 'Unknown'

    // Create activity log entry for status changes
    if (status && process.env.NOTION_ACTIVITY_LOG_DB) {
      let activityType = 'Partnership Updated'
      let details = `Partnership status updated to: ${status}`

      if (status === '✅ Live') {
        activityType = 'Partnership Signed'
        details = `${company} officially partnered on ${category}. Partnership is now live on the platform.`
      } else if (status === '🔵 Agreement Sent') {
        activityType = 'Partnership Signed'
        details = `Partnership agreement sent to ${company} for ${category}.`
      }

      await notion.pages.create({
        parent: { database_id: process.env.NOTION_ACTIVITY_LOG_DB },
        properties: {
          'Name': {
            title: [{ text: { content: `${activityType}: ${company} - ${category}` } }]
          },
          'Activity Type': {
            select: { name: activityType }
          },
          'Category': {
            rich_text: [{ text: { content: category } }]
          },
          'Company': {
            rich_text: [{ text: { content: company } }]
          },
          'Details': {
            rich_text: [{ text: { content: details } }]
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Partnership updated successfully',
      partnershipId
    })

  } catch (error: any) {
    console.error('Partnership update error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
