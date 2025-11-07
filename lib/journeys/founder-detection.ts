/**
 * Founder Intent Detection System
 *
 * Detects when user is a founder and classifies:
 * - Company stage (pre-seed, seed, Series A, B, C+)
 * - Current pain points (hiring, fundraising, GTM, ops, procurement)
 * - Urgency and capacity constraints
 */

import Anthropic from '@anthropic-ai/sdk'

export type CompanyStage = 'ideation' | 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'series-c-plus' | 'unknown'

export type FounderPainPoint =
  | 'hiring_execs'         // Need to hire C-level talent
  | 'fundraising'          // Raising capital
  | 'finding_customers'    // GTM, sales, lead gen
  | 'procurement'          // Sourcing suppliers, equipment, office space
  | 'operations'           // Building processes, tools, infrastructure
  | 'legal_compliance'     // Contracts, compliance, legal
  | 'finance'              // Accounting, CFO, financial planning
  | 'product'              // Building MVP, product-market fit

export interface FounderProfile {
  isFounder: boolean
  confidence: number // 0-1
  stage: CompanyStage
  painPoints: FounderPainPoint[]
  urgency: 'low' | 'medium' | 'high' // How urgent are their needs?
  signals: string[] // What triggered the detection
  context: {
    companyName?: string
    industry?: string
    teamSize?: number
    monthlyBurn?: number
    runway?: number // months
    revenue?: number // ARR/MRR
    hasRaised?: boolean
    lastRound?: string
  }
}

/**
 * Detect if user is a founder and classify their needs
 */
export async function detectFounderIntent(params: {
  messages: Array<{ role: string; content: string }>
  userData?: {
    userId?: string
    userType?: string
    company?: string
    name?: string
  }
}): Promise<FounderProfile> {
  const { messages, userData } = params

  if (!messages || messages.length === 0) {
    return {
      isFounder: false,
      confidence: 0,
      stage: 'unknown',
      painPoints: [],
      urgency: 'low',
      signals: [],
      context: {}
    }
  }

  const conversationText = messages.map(m => m.content).join('\n').toLowerCase()
  const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || ''

  // Quick keyword-based detection
  const quickDetection = detectFounderKeywords(conversationText, lastMessage, userData)

  // If confidence is high enough from keywords, return early
  if (quickDetection.confidence > 0.8) {
    return quickDetection
  }

  // Use AI for deeper analysis if we have API key
  if (process.env.ANTHROPIC_API_KEY && quickDetection.confidence > 0.4) {
    try {
      const aiDetection = await analyzeFounderIntentWithAI(messages, quickDetection)
      return aiDetection
    } catch (error) {
      console.error('[FOUNDER_DETECTION] AI analysis failed, using keyword detection:', error)
      return quickDetection
    }
  }

  return quickDetection
}

/**
 * Keyword-based founder detection (fast, no API calls)
 */
function detectFounderKeywords(
  conversationText: string,
  lastMessage: string,
  userData?: { company?: string; userType?: string }
): FounderProfile {
  const signals: string[] = []
  let confidence = 0
  let isFounder = false

  // Strong founder signals
  const strongSignals = [
    'i founded',
    'i started a company',
    'my startup',
    "i'm the founder",
    "i'm a founder",
    "i'm the ceo",
    'my co-founder',
    'we just raised',
    'pre-seed',
    'seed round',
    'series a',
    'series b',
    'building a company',
    'launched a startup'
  ]

  for (const signal of strongSignals) {
    if (conversationText.includes(signal)) {
      signals.push(`strong_signal:${signal}`)
      confidence += 0.4
      isFounder = true
    }
  }

  // Medium founder signals
  const mediumSignals = [
    'my company',
    'our startup',
    'we need to hire',
    'raising capital',
    'need a cfo',
    'need a cto',
    'need a ciso',
    'first customers',
    'product-market fit',
    'burn rate',
    'runway',
    'cap table',
    'term sheet'
  ]

  for (const signal of mediumSignals) {
    if (conversationText.includes(signal)) {
      signals.push(`medium_signal:${signal}`)
      confidence += 0.2
    }
  }

  // Multiple pain points = likely founder
  const hasProcurement = conversationText.includes('need') || conversationText.includes('source')
  const hasHiring = conversationText.includes('hire') || conversationText.includes('recruit')
  const hasGTM = conversationText.includes('customers') || conversationText.includes('sales')
  const hasFundraising = conversationText.includes('raise') || conversationText.includes('investors')

  const painPointCount = [hasProcurement, hasHiring, hasGTM, hasFundraising].filter(Boolean).length

  if (painPointCount >= 2) {
    signals.push('pattern:multiple_pain_points')
    confidence += 0.3
    isFounder = true
  }

  // Detect stage
  const stage = detectCompanyStage(conversationText, signals)

  // Detect pain points
  const painPoints = detectPainPoints(conversationText, lastMessage)

  // Detect urgency
  const urgency = detectUrgency(conversationText, lastMessage)

  // Extract context
  const context = extractFounderContext(conversationText, userData)

  return {
    isFounder: isFounder || confidence > 0.5,
    confidence: Math.min(confidence, 1),
    stage,
    painPoints,
    urgency,
    signals,
    context
  }
}

/**
 * Detect company stage from conversation
 */
function detectCompanyStage(conversationText: string, signals: string[]): CompanyStage {
  if (conversationText.includes('idea stage') || conversationText.includes('validating')) {
    return 'ideation'
  }

  if (conversationText.includes('pre-seed') || conversationText.includes('mvp')) {
    return 'pre-seed'
  }

  if (conversationText.includes('seed round') || conversationText.includes('seed stage') || conversationText.includes('just raised seed')) {
    return 'seed'
  }

  if (conversationText.includes('series a') || conversationText.includes('scaling gtm')) {
    return 'series-a'
  }

  if (conversationText.includes('series b') || conversationText.includes('multi-market')) {
    return 'series-b'
  }

  if (conversationText.includes('series c') || conversationText.includes('series d') || conversationText.includes('late stage')) {
    return 'series-c-plus'
  }

  // Infer from pain points
  if (signals.some(s => s.includes('first customers') || s.includes('mvp'))) {
    return 'pre-seed'
  }

  if (signals.some(s => s.includes('hire') && s.includes('exec'))) {
    return 'series-a' // Hiring execs typically happens at Series A
  }

  return 'unknown'
}

/**
 * Detect founder pain points from conversation
 */
function detectPainPoints(conversationText: string, lastMessage: string): FounderPainPoint[] {
  const painPoints: FounderPainPoint[] = []

  // Hiring signals
  if (conversationText.match(/hire|recruit|cto|cfo|ciso|vp of|head of|talent/i)) {
    painPoints.push('hiring_execs')
  }

  // Fundraising signals
  if (conversationText.match(/raise|fundrais|investor|pitch deck|term sheet|valuation/i)) {
    painPoints.push('fundraising')
  }

  // GTM signals
  if (conversationText.match(/customers|leads|sales|pipeline|outreach|gtm|go-to-market/i)) {
    painPoints.push('finding_customers')
  }

  // Procurement signals
  if (conversationText.match(/source|supplier|vendor|equipment|office|procurement|rfq/i)) {
    painPoints.push('procurement')
  }

  // Operations signals
  if (conversationText.match(/process|operations|tools|infrastructure|erp|workflow/i)) {
    painPoints.push('operations')
  }

  // Finance signals
  if (conversationText.match(/accounting|finance|burn rate|runway|cfo|financial planning/i)) {
    painPoints.push('finance')
  }

  // Legal signals
  if (conversationText.match(/legal|compliance|contracts|terms|lawyer/i)) {
    painPoints.push('legal_compliance')
  }

  // Product signals
  if (conversationText.match(/product-market fit|mvp|building|feature|roadmap/i)) {
    painPoints.push('product')
  }

  return painPoints
}

/**
 * Detect urgency from language patterns
 */
function detectUrgency(conversationText: string, lastMessage: string): 'low' | 'medium' | 'high' {
  const urgentPatterns = [
    'asap',
    'urgent',
    'immediately',
    'right now',
    'this week',
    'critical',
    'emergency',
    'running out',
    'burning cash',
    'desperate',
    'must have'
  ]

  const mediumUrgencyPatterns = [
    'soon',
    'next month',
    'upcoming',
    'planning',
    'need to',
    'looking for',
    'working on'
  ]

  // Check last message for urgency (most recent = most important)
  for (const pattern of urgentPatterns) {
    if (lastMessage.includes(pattern)) {
      return 'high'
    }
  }

  // Check full conversation
  for (const pattern of urgentPatterns) {
    if (conversationText.includes(pattern)) {
      return 'high'
    }
  }

  for (const pattern of mediumUrgencyPatterns) {
    if (conversationText.includes(pattern)) {
      return 'medium'
    }
  }

  return 'low'
}

/**
 * Extract founder context (company details, metrics)
 */
function extractFounderContext(
  conversationText: string,
  userData?: { company?: string }
): FounderProfile['context'] {
  const context: FounderProfile['context'] = {}

  // Company name
  if (userData?.company) {
    context.companyName = userData.company
  }

  // Team size
  const teamSizeMatch = conversationText.match(/(\d+)\s*(?:person|people|employee|team member)/i)
  if (teamSizeMatch) {
    context.teamSize = parseInt(teamSizeMatch[1])
  }

  // Burn rate
  const burnMatch = conversationText.match(/burn(?:ing)?\s*(?:rate)?\s*(?:is|of)?\s*\$?([\d,]+)k?\s*\/?\s*month/i)
  if (burnMatch) {
    context.monthlyBurn = parseInt(burnMatch[1].replace(/,/g, '')) * (burnMatch[1].includes('k') ? 1000 : 1)
  }

  // Runway
  const runwayMatch = conversationText.match(/(\d+)\s*months?\s*(?:of\s*)?runway/i)
  if (runwayMatch) {
    context.runway = parseInt(runwayMatch[1])
  }

  // Revenue
  const revenueMatch = conversationText.match(/(?:arr|mrr|revenue)(?:\s*of)?\s*\$?([\d,]+)([km])?\s*(?:\/month|\/year)?/i)
  if (revenueMatch) {
    let amount = parseInt(revenueMatch[1].replace(/,/g, ''))
    if (revenueMatch[2] === 'k') amount *= 1000
    if (revenueMatch[2] === 'm') amount *= 1000000
    context.revenue = amount
  }

  // Fundraising
  if (conversationText.includes('raised') || conversationText.includes('funding')) {
    context.hasRaised = true
  }

  // Last round
  const roundMatch = conversationText.match(/(pre-seed|seed|series [a-f])/i)
  if (roundMatch) {
    context.lastRound = roundMatch[1]
  }

  return context
}

/**
 * Use Claude to analyze founder intent (deep analysis)
 */
async function analyzeFounderIntentWithAI(
  messages: Array<{ role: string; content: string }>,
  quickDetection: FounderProfile
): Promise<FounderProfile> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })

  const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')

  const prompt = `Analyze this conversation and determine if the user is a startup founder.

Conversation:
${conversationText}

Quick detection results:
- Is Founder: ${quickDetection.isFounder}
- Confidence: ${quickDetection.confidence}
- Signals: ${quickDetection.signals.join(', ')}

Please provide a detailed analysis in JSON format:
{
  "isFounder": boolean,
  "confidence": number (0-1),
  "stage": "ideation" | "pre-seed" | "seed" | "series-a" | "series-b" | "series-c-plus" | "unknown",
  "painPoints": ["hiring_execs", "fundraising", "finding_customers", "procurement", "operations", "legal_compliance", "finance", "product"],
  "urgency": "low" | "medium" | "high",
  "context": {
    "companyName": string or null,
    "industry": string or null,
    "teamSize": number or null,
    "monthlyBurn": number or null,
    "runway": number or null,
    "revenue": number or null,
    "hasRaised": boolean or null,
    "lastRound": string or null
  },
  "reasoning": "Brief explanation of why you reached this conclusion"
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  const textContent = response.content.find(block => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI')
  }

  // Extract JSON from response (may be wrapped in markdown)
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response')
  }

  const aiAnalysis = JSON.parse(jsonMatch[0])

  return {
    isFounder: aiAnalysis.isFounder,
    confidence: aiAnalysis.confidence,
    stage: aiAnalysis.stage,
    painPoints: aiAnalysis.painPoints,
    urgency: aiAnalysis.urgency,
    signals: [...quickDetection.signals, `ai_analysis:${aiAnalysis.reasoning}`],
    context: {
      ...quickDetection.context,
      ...aiAnalysis.context
    }
  }
}

/**
 * Get stage-specific guidance for founders
 */
export function getStageGuidance(stage: CompanyStage): {
  priorities: string[]
  wellsCanHelp: string[]
  commonMistakes: string[]
} {
  switch (stage) {
    case 'ideation':
      return {
        priorities: [
          'Validate product-market fit',
          'Build MVP',
          'Talk to potential customers',
          'Find co-founder if solo'
        ],
        wellsCanHelp: [
          'Find early customers to validate your idea',
          'Source equipment/tools for MVP',
          'Connect with technical co-founders'
        ],
        commonMistakes: [
          'Building in isolation without customer feedback',
          'Spending on expensive tools before validation',
          'Hiring too early'
        ]
      }

    case 'pre-seed':
    case 'seed':
      return {
        priorities: [
          'Get first 10 paying customers',
          'Prove repeatable sales motion',
          'Build core product',
          'Raise seed round'
        ],
        wellsCanHelp: [
          'GTM campaigns to find first customers',
          'Procurement for office/equipment at startup rates',
          'Connect with seed investors'
        ],
        commonMistakes: [
          'Hiring executives too early',
          'Over-engineering the product',
          'Burning cash on enterprise sales tools'
        ]
      }

    case 'series-a':
      return {
        priorities: [
          'Hire VP Sales, VP Engineering',
          'Scale GTM playbook',
          'Build repeatable processes',
          'Reach $1M+ ARR'
        ],
        wellsCanHelp: [
          'Executive search (Wells Onyx) for C-level hires',
          'Automated GTM campaigns',
          'Procurement at scale',
          'Investor connections for Series A'
        ],
        commonMistakes: [
          'Wrong executive hires',
          'Scaling before product-market fit',
          'Ignoring unit economics'
        ]
      }

    case 'series-b':
    case 'series-c-plus':
      return {
        priorities: [
          'Expand to new markets',
          'Hire CFO, build finance team',
          'Enterprise sales motion',
          'Prepare for exit/IPO'
        ],
        wellsCanHelp: [
          'Executive search for C-suite and VPs',
          'Enterprise GTM automation',
          'Multi-market procurement',
          'M&A advisory connections'
        ],
        commonMistakes: [
          'Losing company culture',
          'Over-hiring',
          'Ignoring operational efficiency'
        ]
      }

    default:
      return {
        priorities: ['Tell me about your company'],
        wellsCanHelp: ['Everything a founder needs'],
        commonMistakes: []
      }
  }
}
