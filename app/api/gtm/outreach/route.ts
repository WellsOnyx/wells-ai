import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

// Generate personalized outreach message using Claude
async function generatePersonalizedMessage(target: any, campaign: any) {
  const prompt = `You are writing a highly personalized outreach message for Wells Onyx.

CONTEXT:
- Target: ${target.name}, ${target.title} at ${target.company}
- Industry: ${target.industry}
- Service offering: ${campaign.serviceOffering}
- Their pain point: ${campaign.painPoint}
- Our value prop: ${campaign.value_prop}
- The hook: ${campaign.hook}

RESEARCH (use this to personalize):
- Company: ${target.company}
- Industry: ${target.industry}
- Title: ${target.title}

YOUR TASK:
Write a highly personalized message (email or SMS style, 100-150 words) that:
1. References something specific about their company or role
2. Identifies their likely pain point
3. Presents our solution as 10x better, not incrementally better
4. Includes the conversational commerce hook (Wells AI platform)
5. Ends with a clear, low-friction call to action

TONE: Direct, confident, not salesy. Like a peer reaching out with something genuinely valuable.

DO NOT use generic templates. Make it feel like you did real research.

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
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    return data.content?.[0]?.text || 'Error generating message'
  } catch (error) {
    console.error('Message generation error:', error)
    return `Hi ${target.name},

Saw you're ${target.title} at ${target.company}. ${campaign.value_prop}

${campaign.hook}

Worth a quick conversation?`
  }
}

export async function POST(request: Request) {
  try {
    const { campaignId } = await request.json()

    // Get campaign details
    const campaign = await notion.pages.retrieve({ page_id: campaignId })
    const campaignProps = campaign as any

    // Get all targets for this campaign that haven't been processed
    // TODO: Fix Notion SDK
    const targetsQuery = { results: [] as any[] }
    // const targetsQuery = await notion.databases.query({
    //   database_id: process.env.NOTION_GTM_TARGETS_DB!,
    //   filter: {
    //     and: [
    //       {
    //         property: 'Campaign',
    //         relation: {
    //           contains: campaignId
    //         }
    //       },
    //       {
    //         property: 'Stage',
    //         select: {
    //           equals: 'Discovered'
    //         }
    //       }
    //     ]
    //   },
    //   page_size: 50 // Process 50 at a time
    // })

    console.log(`Generating outreach for ${targetsQuery.results.length} targets`)

    let messagesGenerated = 0

    for (const targetPage of targetsQuery.results) {
      const target = targetPage as any
      const targetProps = target.properties

      // Extract target data
      const targetData = {
        id: target.id,
        name: targetProps.Name?.title?.[0]?.plain_text || 'Unknown',
        title: targetProps.Title?.rich_text?.[0]?.plain_text || '',
        company: targetProps.Company?.rich_text?.[0]?.plain_text || '',
        email: targetProps.Email?.email || '',
        phone: targetProps.Phone?.phone_number || '',
        industry: targetProps.Industry?.rich_text?.[0]?.plain_text || ''
      }

      // Generate personalized message
      const message = await generatePersonalizedMessage(targetData, {
        serviceOffering: campaignProps.properties['Service Offering']?.select?.name,
        painPoint: campaignProps.properties['Pain Point']?.rich_text?.[0]?.plain_text || '',
        value_prop: campaignProps.properties['Value Prop']?.rich_text?.[0]?.plain_text || '',
        hook: campaignProps.properties['Hook']?.rich_text?.[0]?.plain_text || ''
      })

      // Create outreach record in Notion (PENDING APPROVAL)
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_GTM_OUTREACH_DB! },
        properties: {
          'Target': {
            relation: [{ id: target.id }]
          },
          'Campaign': {
            relation: [{ id: campaignId }]
          },
          'Message': {
            rich_text: [{ text: { content: message } }]
          },
          'Channel': {
            select: { name: targetData.email ? 'Email' : 'SMS' }
          },
          'Status': {
            select: { name: '⏸️ Pending Approval' }
          },
          'Generated': {
            date: { start: new Date().toISOString() }
          }
        }
      })

      messagesGenerated++

      // Update target stage
      await notion.pages.update({
        page_id: target.id,
        properties: {
          'Stage': { select: { name: 'Outreach Generated' } }
        }
      })
    }

    // Update campaign status
    await notion.pages.update({
      page_id: campaignId,
      properties: {
        'Status': { select: { name: '⏸️ Awaiting Approval' } },
        'Messages Generated': { number: messagesGenerated }
      }
    })

    return NextResponse.json({
      success: true,
      messagesGenerated,
      message: `${messagesGenerated} personalized messages ready for your review`
    })

  } catch (error: any) {
    console.error('Outreach generation error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
