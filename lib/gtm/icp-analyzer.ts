/**
 * ICP Analyzer - MVP Version
 *
 * Analyzes user's won deals in Notion to build Ideal Customer Profile
 * Ship tonight - keep it simple
 */

import { Client } from '@notionhq/client'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ICP {
  industries: string[]
  titles: string[]
  companySizes: string[]
  avgDealSize: number
  commonPainPoints: string[]
  buyingSignals: string[]
  summary: string
}

/**
 * Build ICP from Notion deals database
 */
export async function buildICPFromNotion(
  notionApiKey: string,
  dealsDbId: string
): Promise<ICP> {
  const notion = new Client({ auth: notionApiKey })

  // Get all won deals
  const response = await notion.databases.query({
    database_id: dealsDbId,
    filter: {
      property: 'Status',
      select: {
        equals: 'Won',
      },
    },
  })

  if (response.results.length === 0) {
    // No won deals yet - return default ICP
    return {
      industries: ['Technology', 'SaaS'],
      titles: ['CEO', 'VP Sales', 'Head of Revenue'],
      companySizes: ['50-200 employees'],
      avgDealSize: 50000,
      commonPainPoints: ['Need more customers', 'Sales team overwhelmed'],
      buyingSignals: ['Actively hiring', 'Raised funding'],
      summary: 'No won deals yet. Start with technology companies, 50-200 employees, selling B2B.',
    }
  }

  // Extract data from won deals
  const deals = response.results.map((page: any) => {
    const props = page.properties
    return {
      title: props.Name?.title?.[0]?.plain_text || '',
      value: props.Value?.number || 0,
      company: props.Company?.rich_text?.[0]?.plain_text || '',
      industry: props.Industry?.select?.name || '',
      contactTitle: props['Contact Title']?.rich_text?.[0]?.plain_text || '',
      companySize: props['Company Size']?.select?.name || '',
      notes: props.Notes?.rich_text?.[0]?.plain_text || '',
    }
  })

  // Calculate stats
  const avgDealSize = deals.reduce((sum, d) => sum + d.value, 0) / deals.length

  const industries = [...new Set(deals.map((d) => d.industry).filter(Boolean))]
  const titles = [...new Set(deals.map((d) => d.contactTitle).filter(Boolean))]
  const companySizes = [...new Set(deals.map((d) => d.companySize).filter(Boolean))]

  // Use Claude to analyze patterns
  const analysisPrompt = `Analyze these won deals and identify patterns:

${deals.map((d, i) => `Deal ${i + 1}:
- Company: ${d.company}
- Industry: ${d.industry}
- Contact: ${d.contactTitle}
- Value: $${d.value}
- Notes: ${d.notes}
`).join('\n')}

Identify:
1. Common pain points (what problems were they trying to solve?)
2. Buying signals (what indicated they were ready to buy?)

Respond in JSON:
{
  "commonPainPoints": ["pain point 1", "pain point 2", ...],
  "buyingSignals": ["signal 1", "signal 2", ...],
  "summary": "Brief description of ideal customer profile"
}`

  const response2 = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [{ role: 'user', content: analysisPrompt }],
  })

  const content = response2.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response')
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON in response')
  }

  const analysis = JSON.parse(jsonMatch[0])

  return {
    industries,
    titles,
    companySizes,
    avgDealSize,
    commonPainPoints: analysis.commonPainPoints,
    buyingSignals: analysis.buyingSignals,
    summary: analysis.summary,
  }
}

/**
 * Generate prospect search criteria from ICP
 */
export function icpToSearchCriteria(icp: ICP): {
  titles: string[]
  industries: string[]
  companySize: string
  keywords: string[]
} {
  return {
    titles: icp.titles,
    industries: icp.industries,
    companySize: icp.companySizes[0] || '50-200',
    keywords: icp.buyingSignals,
  }
}
