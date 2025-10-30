import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * Launch complete GTM campaign
 * Service-agnostic - works for any B2B offering
 */

export async function POST(request: Request) {
  try {
    const {
      campaignName,
      serviceOffering,
      icp,
      targetCount = 100,
      messagesPerDay = 20,
      channels = ['Email'],
      autoApprove = false,
      // Legacy support
      name,
      targetIndustry,
      targetRole,
      targetRevenue
    } = await request.json()

    // Support both new and legacy formats
    const finalCampaignName = campaignName || name
    const finalICP = icp || {
      titles: targetRole ? [targetRole] : [],
      industries: targetIndustry ? [targetIndustry] : [],
      companySizes: [],
      painPoints: [],
      valueProps: []
    }

    if (!finalCampaignName || !serviceOffering) {
      return NextResponse.json(
        { success: false, error: 'campaignName and serviceOffering required' },
        { status: 400 }
      )
    }

    if (!process.env.NOTION_GTM_CAMPAIGNS_DB) {
      console.warn('NOTION_GTM_CAMPAIGNS_DB not configured')
      return NextResponse.json({
        success: true,
        message: 'Campaign launch simulated (Notion not configured)',
        campaignId: 'sim_' + Date.now(),
        simulation: true
      })
    }

    // Create campaign in Notion
    const campaignPage = await notion.pages.create({
      parent: { database_id: process.env.NOTION_GTM_CAMPAIGNS_DB },
      properties: {
        'Campaign Name': {
          title: [{ text: { content: finalCampaignName } }],
        },
        'Service Offering': {
          select: { name: serviceOffering },
        },
        'Status': {
          select: { name: 'Discovering' },
        },
        'Target Count': {
          number: targetCount
        },
        'Target Role': {
          rich_text: [{ text: { content: finalICP.titles?.join(', ') || '' } }],
        },
        'Target Industry': {
          rich_text: [{ text: { content: finalICP.industries?.join(', ') || targetIndustry || '' } }],
        },
        ...(targetRevenue && {
          'Target Revenue': {
            select: { name: targetRevenue },
          }
        }),
        'Created': {
          date: { start: new Date().toISOString() },
        },
        'Targets Found': {
          number: 0
        },
        'Outreach Sent': {
          number: 0
        },
        'Meetings Booked': {
          number: 0
        },
        'Deals Closed': {
          number: 0
        },
        'Total Revenue': {
          number: 0
        }
      },
    })

    const campaignId = campaignPage.id

    // Trigger discovery (async)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/gtm/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId,
        campaignName: finalCampaignName,
        serviceOffering,
        icp: finalICP,
        targetCount,
        // Legacy support
        targetIndustry: finalICP.industries?.[0],
        targetRole: finalICP.titles?.[0],
        targetCompanySize: finalICP.companySizes?.[0]
      })
    }).catch(err => console.error('Discovery trigger failed:', err))

    // Create activity log entry
    if (process.env.NOTION_ACTIVITY_LOG_DB) {
      try {
        await notion.pages.create({
          parent: { database_id: process.env.NOTION_ACTIVITY_LOG_DB },
          properties: {
            'Name': {
              title: [{ text: { content: `Campaign launched: ${finalCampaignName}` } }]
            },
            'Activity Type': {
              select: { name: 'Campaign Launch' }
            },
            'Category': {
              rich_text: [{ text: { content: serviceOffering } }]
            },
            'Details': {
              rich_text: [{
                text: {
                  content: `New GTM campaign: ${finalCampaignName}\nTargets: ${targetCount}\nICP: ${finalICP.titles?.join(', ')}`
                }
              }]
            }
          }
        })
      } catch (error) {
        console.log('Could not create activity log:', error)
      }
    }

    return NextResponse.json({
      success: true,
      campaignId,
      campaignName: finalCampaignName,
      message: `Campaign "${finalCampaignName}" launched! Discovery in progress...`,
      targetCount,
      workflow: {
        step1: 'Discovery (in progress)',
        step2: 'Message generation',
        step3: autoApprove ? 'Auto-send' : 'Await approval',
        step4: 'Track responses'
      },
      timeline: {
        discovery: '5-10 minutes',
        firstOutreach: autoApprove ? '15-20 minutes' : 'After approval',
        expectedMeetings: `~${Math.round(targetCount * 0.03)}`,
        expectedDeals: `~${Math.round(targetCount * 0.01)}`
      }
    })

  } catch (error: any) {
    console.error('Campaign launch error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
