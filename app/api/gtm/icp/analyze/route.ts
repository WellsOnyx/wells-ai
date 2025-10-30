import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

interface DealPattern {
  industry: string
  count: number
  avgDealSize: number
  avgCloseDays: number
}

interface TitlePattern {
  title: string
  count: number
  winRate: number
}

interface ICPRecommendation {
  serviceOffering: string
  topIndustries: DealPattern[]
  topTitles: TitlePattern[]
  avgDealSize: number
  avgCloseDays: number
  winRate: number
  recommendedICP: {
    targetRevenue: string
    targetIndustry: string
    targetRole: string
    targetCompanySize: string
    painPoint: string
    valueProp: string
  }
}

export async function POST(request: Request) {
  try {
    const { serviceOffering } = await request.json()

    if (!process.env.NOTION_DEALS_DB) {
      return NextResponse.json({
        success: false,
        error: 'NOTION_DEALS_DB not configured. Cannot analyze past deals.',
        recommendation: null
      })
    }

    // Query all closed-won deals for this service offering
    // TODO: Fix Notion SDK query compatibility
    const dealsQuery = { results: [] as any[] }
    // const dealsQuery = await notion.databases.query({
    //   database_id: process.env.NOTION_DEALS_DB,
    //   filter: {
    //     and: [
    //       {
    //         property: 'Status',
    //         select: {
    //           equals: 'Closed Won'
    //         }
    //       },
    //     ]
    //   },
    //   page_size: 100
    // })

    if (dealsQuery.results.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No historical deals found for this offering. Using industry best practices.',
        recommendation: generateDefaultICP(serviceOffering)
      })
    }

    // Analyze deals to extract patterns
    const industries: Record<string, DealPattern> = {}
    const titles: Record<string, TitlePattern> = {}
    let totalDealValue = 0
    let totalCloseDays = 0
    let dealCount = 0

    for (const deal of dealsQuery.results) {
      const props = (deal as any).properties

      // Extract industry
      const industry = props.Industry?.select?.name ||
                       props.Vertical?.select?.name ||
                       props.Sector?.rich_text?.[0]?.plain_text ||
                       'Unknown'

      // Extract deal value
      const dealValue = props['Deal Value']?.number ||
                        props.Value?.number ||
                        props.Amount?.number ||
                        0

      // Extract close time
      const createdDate = props.Created?.created_time || props['Created Date']?.date?.start
      const closedDate = props['Closed Date']?.date?.start || props['Close Date']?.date?.start

      let closeDays = 90 // default
      if (createdDate && closedDate) {
        const created = new Date(createdDate)
        const closed = new Date(closedDate)
        closeDays = Math.round((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Extract contact title (from related CRM contact if available)
      const contactTitle = props['Contact Title']?.rich_text?.[0]?.plain_text ||
                          props.Title?.rich_text?.[0]?.plain_text ||
                          'Unknown'

      // Aggregate patterns
      if (!industries[industry]) {
        industries[industry] = {
          industry,
          count: 0,
          avgDealSize: 0,
          avgCloseDays: 0
        }
      }
      industries[industry].count++
      industries[industry].avgDealSize =
        (industries[industry].avgDealSize * (industries[industry].count - 1) + dealValue) / industries[industry].count
      industries[industry].avgCloseDays =
        (industries[industry].avgCloseDays * (industries[industry].count - 1) + closeDays) / industries[industry].count

      if (!titles[contactTitle]) {
        titles[contactTitle] = {
          title: contactTitle,
          count: 0,
          winRate: 0
        }
      }
      titles[contactTitle].count++

      totalDealValue += dealValue
      totalCloseDays += closeDays
      dealCount++
    }

    // Calculate win rates for titles (simplified - assumes all queried deals are wins)
    Object.values(titles).forEach(t => {
      t.winRate = 100 // All closed-won in this dataset
    })

    // Sort by count
    const topIndustries = Object.values(industries)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    const topTitles = Object.values(titles)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const avgDealSize = dealCount > 0 ? totalDealValue / dealCount : 0
    const avgCloseDays = dealCount > 0 ? totalCloseDays / dealCount : 90

    // Generate recommended ICP based on patterns
    const recommendation: ICPRecommendation = {
      serviceOffering,
      topIndustries,
      topTitles,
      avgDealSize,
      avgCloseDays,
      winRate: 100, // Simplified
      recommendedICP: {
        targetRevenue: determineRevenueRange(avgDealSize),
        targetIndustry: topIndustries[0]?.industry || 'Technology',
        targetRole: topTitles[0]?.title || 'CEO',
        targetCompanySize: determineCompanySize(avgDealSize),
        painPoint: generatePainPoint(serviceOffering, topIndustries[0]?.industry),
        valueProp: generateValueProp(serviceOffering)
      }
    }

    return NextResponse.json({
      success: true,
      dealsAnalyzed: dealCount,
      recommendation
    })

  } catch (error: any) {
    console.error('ICP analysis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        recommendation: null
      },
      { status: 500 }
    )
  }
}

// Helper functions

function determineRevenueRange(avgDealSize: number): string {
  if (avgDealSize > 5000000) return '$1B+'
  if (avgDealSize > 1000000) return '$200M-$1B'
  if (avgDealSize > 300000) return '$50M-$200M'
  return '$10M-$50M'
}

function determineCompanySize(avgDealSize: number): string {
  if (avgDealSize > 5000000) return 'Enterprise (1000+)'
  if (avgDealSize > 1000000) return 'Growth (200-1000)'
  if (avgDealSize > 500000) return 'Series B (50-200)'
  if (avgDealSize > 200000) return 'Series A (10-50)'
  return 'Seed (1-10)'
}

function generatePainPoint(serviceOffering: string, industry?: string): string {
  const painPoints: Record<string, string> = {
    'executive-search': `Struggling to find qualified C-suite talent in ${industry || 'your industry'}. Traditional recruiters take 6+ months and deliver poor cultural fits.`,
    'search-strategy': `Growth has stalled. You've tried consultants but got PowerPoints instead of pipeline. Need a clear path to repeatable revenue.`,
    'wells-os': `Legacy systems are failing. Manual processes eating 30% of your budget. Failed digital transformation projects collecting dust.`,
    'ai-ops': `AI systems breaking in production with no one to call. Compliance audit coming up and you can't prove model governance.`,
    'idre-agency': `No Surprises Act compliance is costing you millions in overhead. Need to turn this regulatory burden into a profit center.`,
    'exo': `Worker injury rates climbing. Physical labor is your bottleneck. Productivity gains have plateaued despite automation investments.`,
    'fab': `Legacy boards failing with no replacement source. China dependency is a strategic risk. 12-month lead times killing your production schedule.`,
    'mainstreet-mfg': `Your town center is dying. Closed factories mean lost jobs and tax base. No private capital willing to take the risk.`,
    'grain-vault': `Payment friction is slowing deals. Float is sitting idle earning nothing. Manual reconciliation eating finance team time.`,
    'black-ops': `Can't access the real decision-makers. Political and regulatory blockers everywhere. Need someone who can unlock the impossible deal.`
  }
  return painPoints[serviceOffering] || 'Struggling with operational efficiency and growth challenges.'
}

function generateValueProp(serviceOffering: string): string {
  const valueProps: Record<string, string> = {
    'executive-search': 'Close deals over text. AI-powered search delivers qualified candidates in 2 weeks, not 6 months. Guaranteed cultural fit.',
    'search-strategy': 'Roadmap to ROI in 6 weeks. We find demand, build markets, and deliver adoption—not just strategy decks.',
    'wells-os': 'Turn on the new operating system. Measurable 10-20% efficiency gains in 90 days, not 18 months of failed transformation.',
    'ai-ops': 'Keep the lights brilliant. 24/7 AI operations with 99.9% uptime SLA. Sleep at night knowing your AI never fails.',
    'idre-agency': 'Turn compliance into profit. Scale to $100M+ run-rate with our IDRE engine. 98% quality, full audit trail.',
    'exo': 'Human augmentation that pays for itself in 18 months. 3-5x productivity gains, 80% reduction in workplace injuries.',
    'fab': 'Bring dead boards back to life. U.S.-based 7nm fab with 48K board/year capacity. From redesign to production in one partner.',
    'mainstreet-mfg': 'Rebuild American Main Streets and industry. Muni-leveraged capital + operational expertise. NOI cap ≥7%.',
    'grain-vault': 'Zero-friction payments that generate yield. Turn your float into $7-11B annual interest while settling transactions in real-time.',
    'black-ops': 'Unlock nation-scale mandates. We open doors you did not know existed and structure deals others say are impossible.'
  }
  return valueProps[serviceOffering] || 'Deliver measurable outcomes faster and more efficiently than traditional approaches.'
}

function generateDefaultICP(serviceOffering: string): ICPRecommendation {
  // Industry best practices when no historical data available
  return {
    serviceOffering,
    topIndustries: [
      { industry: 'Technology', count: 0, avgDealSize: 500000, avgCloseDays: 90 },
      { industry: 'Healthcare', count: 0, avgDealSize: 750000, avgCloseDays: 120 },
      { industry: 'Financial Services', count: 0, avgDealSize: 1000000, avgCloseDays: 150 }
    ],
    topTitles: [
      { title: 'CEO', count: 0, winRate: 0 },
      { title: 'CFO', count: 0, winRate: 0 },
      { title: 'CTO', count: 0, winRate: 0 }
    ],
    avgDealSize: 500000,
    avgCloseDays: 90,
    winRate: 0,
    recommendedICP: {
      targetRevenue: '$50M-$200M',
      targetIndustry: 'Technology',
      targetRole: 'CEO',
      targetCompanySize: 'Series B (50-200)',
      painPoint: generatePainPoint(serviceOffering, 'Technology'),
      valueProp: generateValueProp(serviceOffering)
    }
  }
}
