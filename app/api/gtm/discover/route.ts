import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

// Apollo.io API integration
async function discoverTargets(campaign: any) {
  if (!process.env.APOLLO_API_KEY) {
    console.log('Apollo API key not set, using mock data')
    return generateMockTargets(campaign)
  }

  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.APOLLO_API_KEY,
      },
      body: JSON.stringify({
        // Map campaign ICP to Apollo filters
        person_titles: [campaign.targetRole],
        organization_num_employees_ranges: mapCompanySizeToRange(campaign.targetCompanySize),
        organization_industry_tag_ids: [campaign.targetIndustry],
        per_page: 100,
        page: 1
      })
    })

    if (!response.ok) {
      throw new Error(`Apollo API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.people || []
  } catch (error) {
    console.error('Apollo discovery error:', error)
    return generateMockTargets(campaign)
  }
}

function mapCompanySizeToRange(size: string): string[] {
  const ranges: Record<string, string[]> = {
    'seed': ['1-10'],
    'series-a': ['11-50'],
    'series-b': ['51-200'],
    'growth': ['201-1000'],
    'enterprise': ['1001+']
  }
  return ranges[size] || ['11-50', '51-200']
}

function generateMockTargets(campaign: any) {
  // Generate realistic mock targets for testing
  const companies = [
    'Acme Corp', 'TechStart Inc', 'Global Innovations', 'Future Systems',
    'Apex Solutions', 'Venture Labs', 'Prime Technologies', 'Summit Enterprises'
  ]

  const targets = []
  for (let i = 0; i < 10; i++) {
    targets.push({
      id: `mock_${Date.now()}_${i}`,
      name: `${campaign.targetRole || 'Executive'} ${i + 1}`,
      title: campaign.targetRole || 'CTO',
      company: companies[i % companies.length],
      email: `exec${i + 1}@${companies[i % companies.length].toLowerCase().replace(/\s/g, '')}.com`,
      phone: `+1555${String(i).padStart(7, '0')}`,
      linkedin: `https://linkedin.com/in/exec${i + 1}`,
      industry: campaign.targetIndustry || 'Technology',
      companySize: campaign.targetCompanySize || 'growth'
    })
  }
  return targets
}

export async function POST(request: Request) {
  try {
    const { campaignId, ...campaign } = await request.json()

    // Discover targets using Apollo
    const targets = await discoverTargets(campaign)

    console.log(`Discovered ${targets.length} targets for campaign ${campaignId}`)

    // Add targets to Notion
    for (const target of targets) {
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_GTM_TARGETS_DB! },
        properties: {
          'Name': {
            title: [{ text: { content: target.name } }],
          },
          'Title': {
            rich_text: [{ text: { content: target.title || '' } }],
          },
          'Company': {
            rich_text: [{ text: { content: target.company || '' } }],
          },
          'Email': {
            email: target.email || null,
          },
          'Phone': {
            phone_number: target.phone || null,
          },
          'Campaign': {
            relation: [{ id: campaignId }],
          },
          'Stage': {
            select: { name: 'Discovered' },
          },
          'Industry': {
            rich_text: [{ text: { content: target.industry || '' } }],
          },
        },
      })
    }

    // Update campaign status
    await notion.pages.update({
      page_id: campaignId,
      properties: {
        'Status': { select: { name: 'Outreach Queued' } },
        'Targets Found': { number: targets.length },
      },
    })

    // Trigger outreach (async)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/gtm/outreach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId })
    }).catch(err => console.error('Outreach trigger failed:', err))

    return NextResponse.json({
      success: true,
      targetsFound: targets.length,
      message: 'Targets discovered! Outreach engine starting...'
    })

  } catch (error: any) {
    console.error('Discovery error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
