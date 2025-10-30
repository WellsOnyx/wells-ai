import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

// Regenerate personalized message using Claude
async function regenerateMessage(target: any, campaign: any) {
  const prompt = `You are writing a highly personalized outreach message for Wells Onyx.

CONTEXT:
- Target: ${target.name}, ${target.title} at ${target.company}
- Service offering: ${campaign.serviceOffering}
- Their pain point: ${campaign.painPoint}
- Our value prop: ${campaign.value_prop}
- The hook: ${campaign.hook}

IMPORTANT: The previous message wasn't quite right. Generate a DIFFERENT approach.
Try a different angle, tone, or hook. Keep it fresh and personalized.

YOUR TASK:
Write a highly personalized message (email or SMS style, 100-150 words) that:
1. References something specific about their company or role
2. Identifies their likely pain point
3. Presents our solution as 10x better, not incrementally better
4. Includes the conversational commerce hook (Wells AI platform)
5. Ends with a clear, low-friction call to action

TONE: Direct, confident, not salesy. Like a peer reaching out with something genuinely valuable.

DO NOT use the exact same structure as before. Vary your approach.

Message:`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0.9, // Higher temperature for more variation
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    return data.content?.[0]?.text || 'Error generating message'
  } catch (error) {
    console.error('Message generation error:', error)
    return `Hi ${target.name},

Different approach: ${campaign.value_prop}

${campaign.hook}

Quick call this week?`
  }
}

export async function POST(request: Request) {
  try {
    const { messageId } = await request.json()

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'messageId required' },
        { status: 400 }
      )
    }

    // Get outreach message
    const outreachPage = await notion.pages.retrieve({ page_id: messageId })
    const props = (outreachPage as any).properties

    // Get target details
    const targetId = props.Target?.relation?.[0]?.id
    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'No target linked' },
        { status: 400 }
      )
    }

    const targetPage = await notion.pages.retrieve({ page_id: targetId })
    const targetProps = (targetPage as any).properties

    const targetData = {
      name: targetProps.Name?.title?.[0]?.plain_text || 'Unknown',
      title: targetProps.Title?.rich_text?.[0]?.plain_text || '',
      company: targetProps.Company?.rich_text?.[0]?.plain_text || ''
    }

    // Get campaign details
    const campaignId = props.Campaign?.relation?.[0]?.id
    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'No campaign linked' },
        { status: 400 }
      )
    }

    const campaignPage = await notion.pages.retrieve({ page_id: campaignId })
    const campaignProps = (campaignPage as any).properties

    const campaignData = {
      serviceOffering: campaignProps['Service Offering']?.select?.name || '',
      painPoint: campaignProps['Pain Point']?.rich_text?.[0]?.plain_text || '',
      value_prop: campaignProps['Value Prop']?.rich_text?.[0]?.plain_text || '',
      hook: campaignProps['Hook']?.rich_text?.[0]?.plain_text || ''
    }

    // Generate new message
    const newMessage = await regenerateMessage(targetData, campaignData)

    // Update outreach in Notion
    await notion.pages.update({
      page_id: messageId,
      properties: {
        'Message': {
          rich_text: [{ text: { content: newMessage } }]
        },
        'Regenerated At': {
          date: { start: new Date().toISOString() }
        }
      }
    })

    return NextResponse.json({
      success: true,
      newMessage
    })

  } catch (error: any) {
    console.error('Regeneration error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
