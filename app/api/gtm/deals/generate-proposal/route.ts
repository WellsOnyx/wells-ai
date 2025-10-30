import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { OFFER_PACKAGES } from '@/lib/gtm/offer-packages'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * Generate proposal using Claude
 * Creates professional proposal based on discovery conversation
 */

export async function POST(request: Request) {
  try {
    const { targetId, discoveryNotes, selectedPackage } = await request.json()

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'targetId required' },
        { status: 400 }
      )
    }

    // Get target and campaign details
    const targetPage = await notion.pages.retrieve({ page_id: targetId })
    const targetProps = (targetPage as any).properties

    const targetData = {
      name: targetProps.Name?.title?.[0]?.plain_text || 'Unknown',
      title: targetProps.Title?.rich_text?.[0]?.plain_text || '',
      company: targetProps.Company?.rich_text?.[0]?.plain_text || '',
      email: targetProps.Email?.email || ''
    }

    const campaignId = targetProps.Campaign?.relation?.[0]?.id
    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'No campaign linked to target' },
        { status: 400 }
      )
    }

    const campaignPage = await notion.pages.retrieve({ page_id: campaignId })
    const campaignProps = (campaignPage as any).properties
    const serviceOffering = campaignProps['Service Offering']?.select?.name || 'executive-search'

    // Get offer package details
    const offerPackage = OFFER_PACKAGES[serviceOffering as keyof typeof OFFER_PACKAGES]

    // Generate proposal with Claude
    const proposalPrompt = `You are creating a professional proposal for Wells Onyx.

CLIENT INFORMATION:
- Contact: ${targetData.name}, ${targetData.title}
- Company: ${targetData.company}

SERVICE OFFERING:
${JSON.stringify(offerPackage, null, 2)}

DISCOVERY NOTES:
${discoveryNotes || 'Standard engagement'}

SELECTED PACKAGE:
${selectedPackage || offerPackage.packages[0].name}

YOUR TASK:
Write a comprehensive proposal (500-800 words) that includes:

1. EXECUTIVE SUMMARY
   - Brief overview of their challenge
   - How we solve it
   - Expected outcomes

2. APPROACH & METHODOLOGY
   - Our process
   - Timeline
   - Deliverables

3. INVESTMENT
   - Package pricing
   - Payment terms
   - ROI framework

4. WHY WELLS ONYX
   - Relevant experience
   - Unique differentiators
   - Success metrics

5. NEXT STEPS
   - Clear path to engagement
   - Decision timeline

TONE:
- Professional but not stuffy
- Confident, not salesy
- Focus on outcomes, not features
- Wells Onyx voice: "Precise, but never cold; structured, yet deeply personal"

FORMAT:
Use proper markdown with headers, bullets, and emphasis where appropriate.

Proposal:`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: proposalPrompt }]
      })
    })

    const data = await response.json()
    const proposalContent = data.content?.[0]?.text || 'Error generating proposal'

    // Create proposal in Notion
    const proposalPage = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DEALS_DB || process.env.NOTION_GTM_TARGETS_DB! },
      properties: {
        'Name': {
          title: [{
            text: { content: `Proposal: ${targetData.company} - ${offerPackage.name}` }
          }]
        },
        'Contact': {
          relation: [{ id: targetId }]
        },
        'Status': {
          select: { name: 'Proposal Sent' }
        },
        'Amount': {
          number: extractProposalAmount(selectedPackage, offerPackage)
        },
        'Created Date': {
          date: { start: new Date().toISOString() }
        }
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: proposalContent }
            }]
          }
        }
      ]
    })

    // Update target stage
    await notion.pages.update({
      page_id: targetId,
      properties: {
        'Stage': { select: { name: 'Proposal Sent' } },
        'Proposal Sent Date': { date: { start: new Date().toISOString() } }
      }
    })

    return NextResponse.json({
      success: true,
      proposalId: proposalPage.id,
      proposalUrl: `https://notion.so/${proposalPage.id.replace(/-/g, '')}`,
      content: proposalContent
    })

  } catch (error: any) {
    console.error('Proposal generation error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

function extractProposalAmount(selectedPackage: string, offerPackage: any): number {
  const pkg = offerPackage.packages.find((p: any) => p.name === selectedPackage) || offerPackage.packages[0]

  // Extract numeric value from pricing string
  const pricingStr = pkg.pricing || ''
  const match = pricingStr.match(/\$([0-9,.]+)/)
  if (match) {
    return parseFloat(match[1].replace(/,/g, '')) * 1000 // Convert K to actual number
  }

  // Default amounts by service type
  const defaults: Record<string, number> = {
    'executive-search': 150000,
    'search-strategy': 1000000,
    'wells-os': 5000000,
    'ai-ops': 200000,
    'idre-agency': 3000000,
    'exo': 1000000,
    'fab': 500000
  }

  return defaults[offerPackage.category] || 500000
}
