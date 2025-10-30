import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * Book meeting with prospect
 * Creates Calendly link and updates target stage
 */

export async function POST(request: Request) {
  try {
    const { targetId, meetingType = 'discovery' } = await request.json()

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'targetId required' },
        { status: 400 }
      )
    }

    // Get target details
    const targetPage = await notion.pages.retrieve({ page_id: targetId })
    const targetProps = (targetPage as any).properties

    const targetData = {
      name: targetProps.Name?.title?.[0]?.plain_text || 'Unknown',
      email: targetProps.Email?.email || '',
      company: targetProps.Company?.rich_text?.[0]?.plain_text || '',
      title: targetProps.Title?.rich_text?.[0]?.plain_text || ''
    }

    // Get campaign to determine service offering
    const campaignId = targetProps.Campaign?.relation?.[0]?.id
    let serviceOffering = 'general'
    if (campaignId) {
      const campaignPage = await notion.pages.retrieve({ page_id: campaignId })
      const campaignProps = (campaignPage as any).properties
      serviceOffering = campaignProps['Service Offering']?.select?.name || 'general'
    }

    // Generate Calendly link with pre-filled data
    const calendlyLinks: Record<string, string> = {
      'executive-search': process.env.CALENDLY_EXECUTIVE_SEARCH || 'https://calendly.com/jonah-manning/executive-search',
      'search-strategy': process.env.CALENDLY_SEARCH_STRATEGY || 'https://calendly.com/jonah-manning/strategy',
      'wells-os': process.env.CALENDLY_WELLS_OS || 'https://calendly.com/jonah-manning/wells-os',
      'ai-ops': process.env.CALENDLY_AI_OPS || 'https://calendly.com/jonah-manning/ai-ops',
      'general': process.env.CALENDLY_GENERAL || 'https://calendly.com/jonah-manning/discovery'
    }

    const baseCalendlyUrl = calendlyLinks[serviceOffering] || calendlyLinks['general']

    // Add pre-fill parameters
    const calendlyUrl = new URL(baseCalendlyUrl)
    calendlyUrl.searchParams.set('name', targetData.name)
    calendlyUrl.searchParams.set('email', targetData.email)
    calendlyUrl.searchParams.set('a1', targetData.company) // Custom answer field
    calendlyUrl.searchParams.set('a2', targetData.title)   // Custom answer field

    const meetingLink = calendlyUrl.toString()

    // Update target stage in Notion
    await notion.pages.update({
      page_id: targetId,
      properties: {
        'Stage': { select: { name: 'Meeting Booked' } },
        'Meeting Link': { url: meetingLink },
        'Meeting Booked Date': { date: { start: new Date().toISOString() } }
      }
    })

    // Create interaction record
    if (process.env.NOTION_INTERACTIONS_DB) {
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_INTERACTIONS_DB },
        properties: {
          'Name': {
            title: [{ text: { content: `Meeting Booked: ${targetData.name}` } }]
          },
          'Type': {
            select: { name: 'Meeting' }
          },
          'Contact': {
            relation: [{ id: targetId }]
          },
          'Date': {
            date: { start: new Date().toISOString() }
          },
          'Notes': {
            rich_text: [{
              text: {
                content: `${meetingType} meeting booked with ${targetData.name} from ${targetData.company}. Calendly link: ${meetingLink}`
              }
            }]
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      meetingLink,
      message: `Meeting booked with ${targetData.name}`
    })

  } catch (error: any) {
    console.error('Meeting booking error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
