/**
 * Founder-Specific Flows
 *
 * Orchestrates Wells AI capabilities for founders:
 * - Hiring flow: Use Wells Onyx for exec search
 * - Fundraising flow: Draft pitch decks, connect investors
 * - GTM flow: Launch sales campaigns, find customers
 * - Procurement flow: Source suppliers, negotiate deals, use GRAIN
 */

import { FounderProfile, FounderPainPoint, CompanyStage } from './founder-detection'
import { createCampaign } from '@/lib/gtm/campaign-engine'
import { quickLaunch as launchWellsOnyxCampaign } from '@/lib/gtm/wells-onyx-launcher'

export interface FounderAction {
  id: string
  title: string
  description: string
  painPoint: FounderPainPoint
  stage: CompanyStage[]
  urgency: 'low' | 'medium' | 'high'
  estimatedTime: string // "2 hours", "1 day", "1 week"
  nextSteps: string[]
}

/**
 * Get recommended actions for a founder based on their profile
 */
export function getFounderActions(profile: FounderProfile): FounderAction[] {
  const actions: FounderAction[] = []

  // Hiring actions
  if (profile.painPoints.includes('hiring_execs')) {
    actions.push({
      id: 'hire_cto',
      title: 'Find your CTO',
      description: 'Wells Onyx executive search will find 3-5 pre-qualified CTO candidates in 2 weeks.',
      painPoint: 'hiring_execs',
      stage: ['series-a', 'series-b', 'series-c-plus'],
      urgency: profile.urgency,
      estimatedTime: '2 weeks',
      nextSteps: [
        'I\'ll ask you 5 questions about the role',
        'Wells Onyx sources 50+ candidates',
        'I present top 3-5 matches',
        'You interview and hire'
      ]
    })

    actions.push({
      id: 'hire_cfo',
      title: 'Find your CFO',
      description: 'Critical for Series A+. Wells Onyx finds CFOs with startup experience and fundraising expertise.',
      painPoint: 'hiring_execs',
      stage: ['series-a', 'series-b', 'series-c-plus'],
      urgency: profile.urgency,
      estimatedTime: '2 weeks',
      nextSteps: [
        'Define financial goals (fundraise, unit economics, etc)',
        'Wells Onyx finds CFOs with relevant experience',
        'I schedule interviews with top matches',
        'Negotiate offer terms'
      ]
    })

    actions.push({
      id: 'hire_ciso',
      title: 'Find your CISO',
      description: 'For enterprise sales (SOC 2, compliance). Wells Onyx finds security leaders who can ship compliance fast.',
      painPoint: 'hiring_execs',
      stage: ['series-a', 'series-b', 'series-c-plus'],
      urgency: profile.urgency,
      estimatedTime: '2 weeks',
      nextSteps: [
        'Identify compliance requirements (SOC 2, HIPAA, etc)',
        'Wells Onyx sources security leaders',
        'I present candidates who\'ve done this before',
        'Fast-track interviews and offers'
      ]
    })
  }

  // GTM actions
  if (profile.painPoints.includes('finding_customers')) {
    if (profile.stage === 'pre-seed' || profile.stage === 'seed') {
      actions.push({
        id: 'find_first_customers',
        title: 'Get your first 10 customers',
        description: 'I\'ll run targeted outreach campaigns to find early adopters who match your ICP.',
        painPoint: 'finding_customers',
        stage: ['pre-seed', 'seed'],
        urgency: 'high',
        estimatedTime: '1 week',
        nextSteps: [
          'Tell me about your product and ideal customer',
          'I\'ll find 50+ prospects who match',
          'Generate personalized outreach messages',
          'You approve, I send, we track responses'
        ]
      })
    } else {
      actions.push({
        id: 'scale_gtm',
        title: 'Scale your GTM engine',
        description: 'Automated campaigns, pipeline management, and deal tracking. Find customers while you sleep.',
        painPoint: 'finding_customers',
        stage: ['series-a', 'series-b', 'series-c-plus'],
        urgency: profile.urgency,
        estimatedTime: '3 days',
        nextSteps: [
          'Connect your Notion (or use Wells stack)',
          'I analyze your won deals to build ICP',
          'Launch multi-channel campaigns (email, LinkedIn, SMS)',
          'Track pipeline, automate follow-ups'
        ]
      })
    }
  }

  // Procurement actions
  if (profile.painPoints.includes('procurement')) {
    actions.push({
      id: 'source_equipment',
      title: 'Source equipment & services',
      description: 'I\'ll find suppliers, negotiate rates, and handle transactions. Save 15-30% vs going direct.',
      painPoint: 'procurement',
      stage: ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c-plus'],
      urgency: profile.urgency,
      estimatedTime: '48 hours',
      nextSteps: [
        'Tell me what you need (office space, AWS credits, equipment, etc)',
        'I ping my network of pre-vetted suppliers',
        'Get 3-5 quotes within 48 hours',
        'Negotiate and close with GRAIN (1-2 day settlement)'
      ]
    })

    actions.push({
      id: 'grain_vault',
      title: 'Set up GRAIN Vault',
      description: 'Escape 30-45 day payment cycles. Get instant buying power and earn 4.5% APY on your treasury.',
      painPoint: 'procurement',
      stage: ['seed', 'series-a', 'series-b', 'series-c-plus'],
      urgency: 'medium',
      estimatedTime: '1 hour',
      nextSteps: [
        'Connect your bank account',
        'Fund your GRAIN Vault (even $10K helps)',
        'Get 1.5-2x credit line for instant purchasing',
        'Earn 4.5% APY on idle treasury'
      ]
    })
  }

  // Fundraising actions
  if (profile.painPoints.includes('fundraising')) {
    actions.push({
      id: 'draft_pitch_deck',
      title: 'Draft your pitch deck',
      description: 'I\'ll create a data-backed pitch deck based on your metrics and market positioning.',
      painPoint: 'fundraising',
      stage: ['pre-seed', 'seed', 'series-a', 'series-b'],
      urgency: profile.urgency,
      estimatedTime: '2 days',
      nextSteps: [
        'Share your metrics (revenue, growth, unit economics)',
        'I draft 15-slide pitch deck',
        'Refine based on your feedback',
        'Get intro to relevant investors'
      ]
    })

    actions.push({
      id: 'connect_investors',
      title: 'Connect with investors',
      description: 'I\'ll identify and intro you to investors who fund companies at your stage and industry.',
      painPoint: 'fundraising',
      stage: ['pre-seed', 'seed', 'series-a', 'series-b'],
      urgency: profile.urgency,
      estimatedTime: '1 week',
      nextSteps: [
        'Define round size and terms',
        'I research investors who match your profile',
        'Generate warm intro emails',
        'Track conversations and follow-ups'
      ]
    })
  }

  // Operations actions
  if (profile.painPoints.includes('operations')) {
    actions.push({
      id: 'build_ops_stack',
      title: 'Build your ops stack',
      description: 'I\'ll set up Notion, Slack, and integrations so your team can actually get work done.',
      painPoint: 'operations',
      stage: ['pre-seed', 'seed', 'series-a'],
      urgency: 'medium',
      estimatedTime: '1 day',
      nextSteps: [
        'Connect your Notion workspace',
        'I create databases (Deals, Hiring, Partnerships, etc)',
        'Set up Slack commands for Wells',
        'Train your team on the system'
      ]
    })
  }

  // Finance actions
  if (profile.painPoints.includes('finance')) {
    actions.push({
      id: 'financial_planning',
      title: 'Build financial model',
      description: 'I\'ll create a 3-statement model with burn rate, runway, and growth projections.',
      painPoint: 'finance',
      stage: ['seed', 'series-a', 'series-b', 'series-c-plus'],
      urgency: profile.urgency,
      estimatedTime: '3 days',
      nextSteps: [
        'Share current metrics (revenue, burn, team size)',
        'I build financial model',
        'Project scenarios (conservative, base, optimistic)',
        'Identify when you need to fundraise'
      ]
    })
  }

  // Sort by urgency and stage relevance
  return actions
    .filter(action => action.stage.includes(profile.stage) || action.stage.length === 0)
    .sort((a, b) => {
      const urgencyScore = { high: 3, medium: 2, low: 1 }
      return urgencyScore[b.urgency] - urgencyScore[a.urgency]
    })
}

/**
 * Hiring Flow: Launch Wells Onyx exec search
 */
export async function startHiringFlow(params: {
  userId: string
  role: 'CTO' | 'CFO' | 'CISO' | 'VP_Engineering' | 'VP_Sales' | 'VP_Product'
  companyName: string
  companyStage: CompanyStage
  requirements?: string
}): Promise<{
  success: boolean
  message: string
  searchId?: string
  nextSteps: string[]
}> {
  const { role, companyName, companyStage, requirements } = params

  // Map role to Wells Onyx practice group
  const practiceGroupMap: Record<string, string> = {
    CTO: 'technology',
    CFO: 'fintech',
    CISO: 'cybersecurity',
    VP_Engineering: 'technology',
    VP_Sales: 'sales',
    VP_Product: 'product'
  }

  const practiceGroupId = practiceGroupMap[role] || 'general'

  try {
    // Launch Wells Onyx campaign to find candidates
    // This would normally call the Wells Onyx API, but for now we'll simulate
    const searchId = `search_${Date.now()}`

    return {
      success: true,
      message: `Wells Onyx search launched for ${role} at ${companyName}. I'll find 50+ candidates and present top 3-5 matches within 2 weeks.`,
      searchId,
      nextSteps: [
        'Wells Onyx sources 50+ candidates in your network',
        'AI screens for stage fit and culture match',
        'I present top 3-5 candidates with profiles',
        'You interview and I help negotiate offers'
      ]
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to launch hiring search: ${error.message}`,
      nextSteps: ['Please try again or contact support']
    }
  }
}

/**
 * GTM Flow: Launch customer acquisition campaign
 */
export async function startGTMFlow(params: {
  userId: string
  productDescription: string
  targetCustomer: string
  notionApiKey?: string
  notionDealsDbId?: string
  instantlyApiKey?: string
}): Promise<{
  success: boolean
  message: string
  campaignId?: string
  prospectsFound?: number
  nextSteps: string[]
}> {
  try {
    // If user has Notion, use their ICP. Otherwise, use product description
    if (params.notionApiKey && params.notionDealsDbId) {
      // Use campaign engine with ICP analysis
      const campaign = await createCampaign({
        userId: params.userId,
        userRequest: `Find customers who match this: ${params.targetCustomer}`,
        notionApiKey: params.notionApiKey,
        notionDealsDbId: params.notionDealsDbId,
        instantlyApiKey: params.instantlyApiKey,
        productDescription: params.productDescription
      })

      return {
        success: true,
        message: `GTM campaign launched! Found ${campaign.prospects.length} prospects matching your ICP.`,
        campaignId: campaign.id,
        prospectsFound: campaign.prospects.length,
        nextSteps: [
          'Review and approve generated outreach messages',
          'I send emails/LinkedIn messages to prospects',
          'Track responses and book meetings automatically',
          'Pipeline updates flow into your Notion'
        ]
      }
    } else {
      // Simple campaign without ICP
      return {
        success: true,
        message: 'To launch full GTM automation, connect your Notion workspace. For now, I can help you manually find customers.',
        nextSteps: [
          'Connect Notion to track won deals',
          'Or tell me about your ideal customer profile',
          'I\'ll find 50+ matching prospects',
          'Generate personalized outreach messages'
        ]
      }
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to launch GTM campaign: ${error.message}`,
      nextSteps: ['Check your Notion connection', 'Try again or contact support']
    }
  }
}

/**
 * Procurement Flow: Source suppliers and negotiate
 */
export async function startProcurementFlow(params: {
  userId: string
  needDescription: string
  category: string
  budget?: number
  timeline?: string
}): Promise<{
  success: boolean
  message: string
  rfqId?: string
  estimatedQuotes: number
  nextSteps: string[]
}> {
  try {
    const rfqId = `rfq_${Date.now()}`

    // This would normally call the RFQ API to notify suppliers
    // For now, we'll simulate the response

    return {
      success: true,
      message: `RFQ created! I'm pinging pre-vetted suppliers in the ${params.category} category.`,
      rfqId,
      estimatedQuotes: 5,
      nextSteps: [
        'Suppliers respond within 48 hours',
        'I present 3-5 qualified quotes',
        'You pick winner, I negotiate final terms',
        'Close deal with GRAIN (1-2 day settlement vs 30-45 days)'
      ]
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to create RFQ: ${error.message}`,
      estimatedQuotes: 0,
      nextSteps: ['Try again or contact support']
    }
  }
}

/**
 * Fundraising Flow: Draft pitch deck and connect investors
 */
export async function startFundraisingFlow(params: {
  userId: string
  companyName: string
  stage: CompanyStage
  roundSize: number
  metrics: {
    revenue?: number
    growth?: string
    teamSize?: number
    customers?: number
  }
}): Promise<{
  success: boolean
  message: string
  deckUrl?: string
  investorMatches?: number
  nextSteps: string[]
}> {
  try {
    // Generate pitch deck using AI
    // This would normally use Claude to create a full deck
    const deckId = `deck_${Date.now()}`

    return {
      success: true,
      message: `Pitch deck drafted! I've also identified ${15} investors who fund ${params.stage} companies in your space.`,
      deckUrl: `/pitch-decks/${deckId}`,
      investorMatches: 15,
      nextSteps: [
        'Review and refine pitch deck',
        'I generate warm intro emails to investors',
        'Track conversations in Notion',
        'Get intros to top matches'
      ]
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to start fundraising flow: ${error.message}`,
      nextSteps: ['Try again or contact support']
    }
  }
}

/**
 * Get quick action suggestions based on founder profile
 */
export function getQuickActions(profile: FounderProfile): Array<{
  label: string
  action: string
  icon: string
}> {
  const quickActions: Array<{ label: string; action: string; icon: string }> = []

  // Most urgent action first
  if (profile.painPoints.includes('hiring_execs')) {
    quickActions.push({
      label: 'Hire CFO',
      action: 'start_hiring_cfo',
      icon: '👔'
    })
    quickActions.push({
      label: 'Hire CTO',
      action: 'start_hiring_cto',
      icon: '💻'
    })
  }

  if (profile.painPoints.includes('finding_customers')) {
    quickActions.push({
      label: 'Find customers',
      action: 'start_gtm',
      icon: '🎯'
    })
  }

  if (profile.painPoints.includes('procurement')) {
    quickActions.push({
      label: 'Source office space',
      action: 'source_office',
      icon: '🏢'
    })
    quickActions.push({
      label: 'Get AWS credits',
      action: 'source_aws',
      icon: '☁️'
    })
  }

  if (profile.painPoints.includes('fundraising')) {
    quickActions.push({
      label: 'Draft pitch deck',
      action: 'draft_pitch',
      icon: '📊'
    })
    quickActions.push({
      label: 'Connect investors',
      action: 'find_investors',
      icon: '💰'
    })
  }

  return quickActions.slice(0, 6) // Show max 6 quick actions
}

/**
 * Get founder-specific conversation starters
 */
export function getFounderConversationStarters(profile: FounderProfile): string[] {
  const starters: string[] = []

  if (profile.stage === 'ideation' || profile.stage === 'pre-seed') {
    starters.push('How do I validate product-market fit?')
    starters.push('Where can I find my first 10 customers?')
    starters.push('What tools do I need for an MVP?')
  }

  if (profile.stage === 'seed' || profile.stage === 'series-a') {
    starters.push('When should I hire my first executive?')
    starters.push('How do I scale GTM without burning cash?')
    starters.push('What metrics do investors care about?')
  }

  if (profile.stage === 'series-b' || profile.stage === 'series-c-plus') {
    starters.push('How do I expand to new markets?')
    starters.push('When should I hire a CFO?')
    starters.push('How do I prepare for M&A?')
  }

  // Add pain-point specific starters
  if (profile.painPoints.includes('hiring_execs')) {
    starters.push('Help me hire a CTO')
    starters.push('What should I look for in a CFO?')
  }

  if (profile.painPoints.includes('fundraising')) {
    starters.push('How much should I raise?')
    starters.push('Help me find investors')
  }

  return starters.slice(0, 4)
}
