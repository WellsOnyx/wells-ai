// @ts-nocheck
/**
 * WELLS NATIVE COLD START
 *
 * Wells AI is the cold start. Not external tools.
 * Wells has social profiles and actively engages.
 * The product IS the demo.
 *
 * POST /api/coldstart/launch - Launch Wells' autonomous outreach
 * GET /api/coldstart/launch - Get campaign status
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import {
  wellsThinks,
  wellsReachesOut,
  generateWellsContent,
  WELLS_PERSONA,
  SOCIAL_PLATFORMS
} from '@/lib/coldstart/wells-native'

// ICP templates - who Wells is targeting
const ICP_TEMPLATES = {
  cpo: {
    title: 'Chief Procurement Officer',
    keywords: ['procurement', 'sourcing', 'supply chain', 'vendor management'],
    industries: ['manufacturing', 'distribution', 'retail', 'healthcare'],
    companySize: '100-10000',
    painPoints: [
      'Manual RFQ processes taking too long',
      'Too many vendors, not enough visibility',
      'Compliance and audit headaches',
      'Spend fragmented across departments'
    ],
    wellsValue: 'Talk to Wells, get 5 supplier quotes in 24 hours. 1% on closed deals.'
  },
  cfo: {
    title: 'Chief Financial Officer',
    keywords: ['finance', 'treasury', 'accounts payable', 'working capital'],
    industries: ['all'],
    companySize: '50-5000',
    painPoints: [
      'Cash flow unpredictable',
      'Invoice financing is expensive',
      'Payment timing issues',
      'Working capital stuck in receivables'
    ],
    wellsValue: 'GRAIN treasury system - 1:1 credit line on deposits, instant access.'
  },
  founder: {
    title: 'Startup Founder',
    keywords: ['startup', 'founder', 'ceo', 'entrepreneur'],
    industries: ['tech', 'saas', 'marketplace'],
    companySize: '1-100',
    painPoints: [
      'Need to hire but no time to recruit',
      'Looking for suppliers but don\'t know where',
      'GTM is a mess',
      'Cash flow is tight'
    ],
    wellsValue: 'Tell Wells what you need. Hiring, sourcing, sales - Wells does it.'
  }
}

// POST: Launch Wells' native outreach
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      icp,
      platforms = ['linkedin', 'twitter'],
      mode = 'content', // 'content' | 'outreach' | 'both'
      dailyBudget = 10, // Number of interactions per day
      user_id
    } = body

    // Resolve ICP
    const icpConfig = typeof icp === 'string' ? ICP_TEMPLATES[icp as keyof typeof ICP_TEMPLATES] : icp

    if (!icpConfig) {
      return NextResponse.json({
        error: 'Invalid ICP. Use "cpo", "cfo", "founder" or provide custom object'
      }, { status: 400 })
    }

    // Create campaign record
    const campaignResult = await sql`
      INSERT INTO coldstart_campaigns (
        user_id,
        name,
        icp_config,
        channels,
        daily_volume,
        status,
        created_at
      ) VALUES (
        ${user_id || 'wells_native'},
        ${'Wells Native - ' + icpConfig.title},
        ${JSON.stringify(icpConfig)}::JSONB,
        ${JSON.stringify(platforms)}::JSONB,
        ${dailyBudget},
        'active',
        NOW()
      )
      RETURNING id
    `
    const campaignId = campaignResult.rows[0].id

    // Generate initial content for each platform
    const generatedContent = []
    for (const platform of platforms) {
      if (mode === 'content' || mode === 'both') {
        const content = await generateWellsContent(platform as any)
        generatedContent.push({
          platform,
          content: content.content,
          theme: content.theme,
          status: 'ready_to_post'
        })
      }
    }

    // Generate sample outreach messages
    const sampleOutreach = []
    if (mode === 'outreach' || mode === 'both') {
      const outreach = await wellsReachesOut({
        platform: 'linkedin',
        name: '[Prospect Name]',
        company: '[Company]',
        title: icpConfig.title,
        industry: icpConfig.industries[0],
        trigger: `Noticed ${icpConfig.painPoints[0]}`
      })
      sampleOutreach.push(outreach)
    }

    // Log the campaign start
    await sql`
      INSERT INTO coldstart_activities (
        campaign_id,
        activity_type,
        channel,
        message,
        details
      ) VALUES (
        ${campaignId}::UUID,
        'campaign_started',
        'all',
        ${'Wells Native campaign launched for ' + icpConfig.title},
        ${JSON.stringify({ mode, platforms, dailyBudget })}::JSONB
      )
    `

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,

      wells_native: {
        philosophy: 'Wells AI IS the cold start. The product demonstrates itself.',
        profiles: SOCIAL_PLATFORMS,
        persona: WELLS_PERSONA
      },

      icp: icpConfig,

      generated_content: generatedContent,
      sample_outreach: sampleOutreach,

      strategy: {
        content: {
          description: 'Wells posts genuine insights about B2B commerce',
          frequency: `${platforms.length} posts per day across ${platforms.join(', ')}`,
          style: 'Helpful, direct, slightly witty. Never corporate.'
        },
        engagement: {
          description: 'Wells responds to comments, DMs, and relevant conversations',
          approach: 'Add value first, mention Wells only if relevant'
        },
        outreach: mode !== 'content' ? {
          description: 'Wells reaches out to prospects who match the ICP',
          approach: 'Genuine curiosity, not sales pitches',
          dailyTarget: dailyBudget
        } : null
      },

      next_steps: [
        {
          action: 'Review generated content',
          description: 'Approve or edit the content before posting'
        },
        {
          action: 'Connect social accounts',
          description: 'Link LinkedIn, Twitter, Instagram for Wells to post'
        },
        {
          action: 'Import prospect list',
          description: 'Add contacts for Wells to reach out to'
        }
      ],

      honesty_note: {
        title: 'Why Wells Native?',
        message: 'Most cold start tools are a mess of third-party integrations. They feel fake because they are. Wells Native is different - the AI that will help you run your business IS the AI talking to you. You\'re experiencing the product before you sign up.'
      }
    })
  } catch (error) {
    console.error('Wells Native launch error:', error)
    return NextResponse.json({
      error: 'Failed to launch campaign',
      details: error.message
    }, { status: 500 })
  }
}

// GET: Get Wells' activity
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id')

  try {
    if (campaignId) {
      // Get specific campaign
      const campaign = await sql`
        SELECT * FROM coldstart_campaigns
        WHERE id = ${campaignId}::UUID
      `

      const activities = await sql`
        SELECT * FROM coldstart_activities
        WHERE campaign_id = ${campaignId}::UUID
        ORDER BY created_at DESC
        LIMIT 50
      `

      return NextResponse.json({
        campaign: campaign.rows[0],
        activities: activities.rows,
        wells_status: {
          online: true,
          lastActivity: activities.rows[0]?.created_at || null,
          mood: 'Ready to engage'
        }
      })
    }

    // Get all active campaigns
    const campaigns = await sql`
      SELECT * FROM coldstart_campaigns
      WHERE status = 'active'
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      campaigns: campaigns.rows,
      wells_native: {
        profiles: SOCIAL_PLATFORMS,
        icp_templates: Object.keys(ICP_TEMPLATES),
        persona: WELLS_PERSONA
      },
      available_actions: [
        { action: 'generate_content', description: 'Have Wells create a post' },
        { action: 'respond_to_message', description: 'Have Wells respond to a DM/comment' },
        { action: 'reach_out', description: 'Have Wells reach out to a prospect' },
        { action: 'daily_routine', description: 'Run Wells\' full daily routine' }
      ]
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch campaigns',
      details: error.message
    }, { status: 500 })
  }
}
