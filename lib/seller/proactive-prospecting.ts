// @ts-nocheck
/**
 * Proactive Prospecting System
 *
 * Wells doesn't just wait for leads - Wells finds them.
 * Monitor for buying signals:
 * - Job posts mentioning procurement/purchasing
 * - Complaints on X about competitors
 * - Funding announcements (they'll spend money)
 * - Company growth signals
 *
 * Match signals to seller's ICP
 * Draft personalized outreach for seller approval
 * Wells sends on seller's behalf (or as intro)
 */

import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import Anthropic from '@anthropic-ai/sdk'
import {
  generateOutreachMessage,
  PersonalityMode,
  OutreachContact,
  MessageContext,
} from '@/lib/coldstart/wells-voice'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type SignalType =
  | 'job_posting'          // Hiring procurement/purchasing roles
  | 'competitor_complaint' // Complaining about a competitor on X
  | 'funding_announcement' // Just raised money
  | 'expansion'            // Opening new office, growing team
  | 'contract_expiring'    // Mentioned contract renewal
  | 'pain_point_expressed' // Publicly mentioned a problem
  | 'decision_maker_change' // New VP/Director came in

export type SignalSource = 'twitter' | 'linkedin' | 'news' | 'job_board' | 'funding_db' | 'website'

export interface BuyingSignal {
  id: string
  source: SignalSource
  sourceUrl?: string
  sourceId?: string
  signalType: SignalType
  strength: number // 0-100
  confidence: number // 0-1
  companyName: string
  companyDomain?: string
  personName?: string
  personTitle?: string
  personLinkedin?: string
  personTwitter?: string
  title: string
  description: string
  rawContent?: string
  extractedKeywords: string[]
  signalDate: Date
  detectedAt: Date
  expiresAt?: Date
}

export interface SignalMatch {
  id: string
  signalId: string
  sellerUserId: string
  matchScore: number
  matchReasons: string[]
  recommendedAction: 'outreach_now' | 'monitor' | 'add_to_nurture'
  actionUrgency: 'immediate' | 'high' | 'normal' | 'low'
  draftMessage?: string
  draftChannel?: 'email' | 'linkedin' | 'twitter'
  draftPersonalization?: Record<string, unknown>
  status: 'new' | 'reviewed' | 'approved' | 'sent' | 'dismissed'
}

export interface SellerICP {
  id: string
  sellerId: string
  name: string
  industries: string[]
  companySizes: string[]
  targetTitles: string[]
  locations: string[]
  buyingSignals: string[]
  technologies: string[]
}

export interface ProspectingResult {
  signalsFound: number
  matchesCreated: number
  topSignals: BuyingSignal[]
  topMatches: SignalMatch[]
}

// ============================================================================
// SIGNAL DETECTION
// ============================================================================

/**
 * Twitter/X Signal Detection
 * Monitor for competitor complaints, pain points, procurement mentions
 */
export async function detectTwitterSignals(
  keywords: string[],
  competitors: string[]
): Promise<BuyingSignal[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN

  if (!bearerToken) {
    console.log('[Prospecting] Twitter not configured')
    return []
  }

  const signals: BuyingSignal[] = []

  // Build search query
  const searchTerms = [
    ...keywords.map(k => `"${k}"`),
    ...competitors.map(c => `${c} (frustrated OR terrible OR switching OR alternative OR hate OR worst)`),
    'looking for supplier',
    'need a vendor',
    'procurement challenge',
  ]

  const query = searchTerms.slice(0, 5).join(' OR ') // Twitter limits query length

  try {
    const response = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=100&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=name,username,description`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
      }
    )

    if (!response.ok) {
      console.error('[Prospecting] Twitter API error:', response.statusText)
      return []
    }

    const data = await response.json()
    const tweets = data.data || []
    const users = data.includes?.users || []

    for (const tweet of tweets) {
      const user = users.find((u: Record<string, string>) => u.id === tweet.author_id)

      // Analyze the tweet for signal type
      const analysis = await analyzeSignalContent(tweet.text, 'twitter')

      if (analysis.isSignal && analysis.signalType) {
        signals.push({
          id: uuidv4(),
          source: 'twitter',
          sourceUrl: `https://twitter.com/${user?.username}/status/${tweet.id}`,
          sourceId: tweet.id,
          signalType: analysis.signalType,
          strength: analysis.strength,
          confidence: analysis.confidence,
          companyName: analysis.companyName || 'Unknown',
          personName: user?.name,
          personTwitter: user?.username,
          title: `Twitter: ${analysis.signalType}`,
          description: analysis.summary,
          rawContent: tweet.text,
          extractedKeywords: analysis.keywords,
          signalDate: new Date(tweet.created_at),
          detectedAt: new Date(),
          expiresAt: analysis.signalType === 'competitor_complaint' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
        })
      }
    }
  } catch (error) {
    console.error('[Prospecting] Twitter detection error:', error)
  }

  return signals
}

/**
 * Job Board Signal Detection
 * Find companies hiring for procurement roles
 */
export async function detectJobSignals(
  targetTitles: string[] = ['procurement', 'purchasing', 'supply chain', 'vendor management']
): Promise<BuyingSignal[]> {
  const signals: BuyingSignal[] = []

  // This would integrate with job APIs like LinkedIn, Indeed, etc.
  // For now, we'll mock the structure

  // In production:
  // 1. Use Greenhouse/Lever API if available
  // 2. Scrape job boards (with permission)
  // 3. Use aggregator APIs

  // Mock implementation
  const mockJobPostings = [
    {
      title: 'Senior Procurement Manager',
      company: 'TechCorp Inc',
      domain: 'techcorp.com',
      location: 'San Francisco, CA',
      postedDate: new Date(),
      url: 'https://jobs.example.com/1',
    },
  ]

  for (const job of mockJobPostings) {
    // Hiring for procurement = they're investing in this area
    signals.push({
      id: uuidv4(),
      source: 'job_board',
      sourceUrl: job.url,
      signalType: 'job_posting',
      strength: 70,
      confidence: 0.9,
      companyName: job.company,
      companyDomain: job.domain,
      title: `Hiring: ${job.title}`,
      description: `${job.company} is hiring a ${job.title} - indicates procurement focus`,
      extractedKeywords: ['procurement', 'hiring', job.company],
      signalDate: job.postedDate,
      detectedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    })
  }

  return signals
}

/**
 * Funding Signal Detection
 * Companies that raised money will spend it
 */
export async function detectFundingSignals(): Promise<BuyingSignal[]> {
  const signals: BuyingSignal[] = []

  // Integrate with:
  // 1. Crunchbase API
  // 2. PitchBook
  // 3. TechCrunch RSS
  // 4. ProductHunt

  // Mock implementation
  const recentFundings = [
    {
      company: 'NewStartup Inc',
      domain: 'newstartup.com',
      amount: 15000000,
      round: 'Series A',
      date: new Date(),
      source: 'https://techcrunch.com/example',
    },
  ]

  for (const funding of recentFundings) {
    // Raised money = will need to buy things
    signals.push({
      id: uuidv4(),
      source: 'funding_db',
      sourceUrl: funding.source,
      signalType: 'funding_announcement',
      strength: Math.min(90, 50 + (funding.amount / 1000000) * 5), // Higher amounts = stronger signal
      confidence: 0.95,
      companyName: funding.company,
      companyDomain: funding.domain,
      title: `Funding: ${funding.company} raised ${(funding.amount / 1000000).toFixed(1)}M ${funding.round}`,
      description: `${funding.company} just raised $${(funding.amount / 1000000).toFixed(1)}M in their ${funding.round}. They'll be spending.`,
      extractedKeywords: ['funding', funding.round, funding.company],
      signalDate: funding.date,
      detectedAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days - funding signal lasts
    })
  }

  return signals
}

/**
 * LinkedIn Signal Detection
 * Decision maker changes, company updates
 */
export async function detectLinkedInSignals(
  targetCompanies: string[] = []
): Promise<BuyingSignal[]> {
  // LinkedIn API requires special access
  // Alternatives: Phantombuster, Clay, or manual monitoring

  // Mock structure for what we'd detect
  const signals: BuyingSignal[] = []

  // Types of LinkedIn signals:
  // 1. New VP/Director of Procurement hired
  // 2. Company announces expansion
  // 3. Posts about looking for solutions
  // 4. Comments on competitor content

  return signals
}

/**
 * Analyze content to extract signal information
 */
async function analyzeSignalContent(
  content: string,
  source: string
): Promise<{
  isSignal: boolean
  signalType?: SignalType
  strength: number
  confidence: number
  companyName?: string
  summary: string
  keywords: string[]
}> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: `Analyze this ${source} content for B2B buying signals.

SIGNAL TYPES:
- job_posting: They're hiring for procurement/purchasing
- competitor_complaint: Frustrated with a competitor
- funding_announcement: Just raised money
- expansion: Growing, opening offices
- pain_point_expressed: Complaining about a problem
- decision_maker_change: New executive in procurement/ops

RESPOND WITH JSON:
{
  "isSignal": boolean,
  "signalType": "one of the types above or null",
  "strength": 0-100,
  "confidence": 0-1,
  "companyName": "extracted company name or null",
  "summary": "one sentence summary",
  "keywords": ["relevant", "keywords"]
}`,
    messages: [
      { role: 'user', content: `Analyze: "${content}"` },
    ],
  })

  const text = response.content.find(b => b.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  try {
    return JSON.parse(jsonMatch?.[0] || '{}')
  } catch {
    return {
      isSignal: false,
      strength: 0,
      confidence: 0,
      summary: '',
      keywords: [],
    }
  }
}

// ============================================================================
// SIGNAL MATCHING
// ============================================================================

/**
 * Match a signal to relevant sellers based on their ICP
 */
export async function matchSignalToSellers(signal: BuyingSignal): Promise<SignalMatch[]> {
  const matches: SignalMatch[] = []

  // Get all seller ICPs
  const icps = await query<Record<string, unknown>>(
    `SELECT i.*, s.user_id as seller_user_id
     FROM seller_icps i
     JOIN seller_profiles s ON i.seller_id = s.id
     WHERE i.is_active = true AND s.status = 'verified'`
  )

  for (const icp of icps.rows) {
    const matchResult = calculateICPMatch(signal, icp)

    if (matchResult.score >= 50) {
      // Generate draft outreach
      const draft = await generateSignalOutreach(signal, icp)

      matches.push({
        id: uuidv4(),
        signalId: signal.id,
        sellerUserId: icp.seller_user_id as string,
        matchScore: matchResult.score,
        matchReasons: matchResult.reasons,
        recommendedAction: matchResult.score >= 80 ? 'outreach_now' :
                          matchResult.score >= 60 ? 'monitor' : 'add_to_nurture',
        actionUrgency: matchResult.score >= 80 ? 'immediate' :
                      matchResult.score >= 60 ? 'high' : 'normal',
        draftMessage: draft.body,
        draftChannel: 'email',
        draftPersonalization: { signalType: signal.signalType, signalContent: signal.description },
        status: 'new',
      })
    }
  }

  return matches
}

/**
 * Calculate how well a signal matches a seller's ICP
 */
function calculateICPMatch(
  signal: BuyingSignal,
  icp: Record<string, unknown>
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  // Industry match
  const industries = icp.industries as string[] || []
  if (signal.extractedKeywords.some(k => industries.some(i => i.toLowerCase().includes(k.toLowerCase())))) {
    score += 25
    reasons.push('industry_match')
  }

  // Signal type match
  const buyingSignals = icp.buying_signals as string[] || []
  if (buyingSignals.includes(signal.signalType)) {
    score += 30
    reasons.push('signal_type_match')
  }

  // Title match (if person info available)
  const targetTitles = icp.target_titles as string[] || []
  if (signal.personTitle && targetTitles.some(t =>
    signal.personTitle?.toLowerCase().includes(t.toLowerCase())
  )) {
    score += 25
    reasons.push('title_match')
  }

  // Recency bonus
  const daysSinceSignal = (Date.now() - signal.signalDate.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceSignal < 3) {
    score += 20
    reasons.push('very_recent')
  } else if (daysSinceSignal < 7) {
    score += 10
    reasons.push('recent')
  }

  return { score: Math.min(100, score), reasons }
}

/**
 * Generate outreach message based on signal
 */
async function generateSignalOutreach(
  signal: BuyingSignal,
  icp: Record<string, unknown>
): Promise<{ subject: string; body: string }> {
  // Get seller info for context
  const sellerResult = await query<Record<string, unknown>>(
    'SELECT * FROM seller_profiles WHERE id = $1',
    [icp.seller_id]
  )

  const seller = sellerResult.rows[0]

  const context: MessageContext = {
    senderName: 'Wells',
    senderCompany: seller?.company_name as string || 'WellsAI',
    senderValue: seller?.company_description as string || 'We help with procurement',
    targetIcp: icp.name as string,
    campaignGoal: 'Start a conversation based on a buying signal',
  }

  const contact: OutreachContact = {
    firstName: signal.personName?.split(' ')[0],
    lastName: signal.personName?.split(' ').slice(1).join(' '),
    title: signal.personTitle,
    company: signal.companyName,
    linkedinUrl: signal.personLinkedin,
    recentActivity: [signal.description],
  }

  const message = await generateOutreachMessage(contact, context, 'email', 'thoughtful')

  return {
    subject: message.subject || `Re: ${signal.title}`,
    body: message.body,
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store a detected signal
 */
export async function storeSignal(signal: BuyingSignal): Promise<string> {
  await query(
    `INSERT INTO buying_signals (
      id, source, source_url, source_id, signal_type, strength, confidence,
      company_name, company_domain, person_name, person_title, person_linkedin, person_twitter,
      title, description, raw_content, extracted_keywords, signal_date, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (id) DO NOTHING`,
    [
      signal.id,
      signal.source,
      signal.sourceUrl,
      signal.sourceId,
      signal.signalType,
      signal.strength,
      signal.confidence,
      signal.companyName,
      signal.companyDomain,
      signal.personName,
      signal.personTitle,
      signal.personLinkedin,
      signal.personTwitter,
      signal.title,
      signal.description,
      signal.rawContent,
      signal.extractedKeywords,
      signal.signalDate,
      signal.expiresAt,
    ]
  )

  return signal.id
}

/**
 * Store a signal match
 */
export async function storeMatch(match: SignalMatch): Promise<string> {
  await query(
    `INSERT INTO signal_matches (
      id, signal_id, seller_user_id, match_score, match_reasons,
      recommended_action, action_urgency, draft_message, draft_channel, draft_personalization, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      match.id,
      match.signalId,
      match.sellerUserId,
      match.matchScore,
      JSON.stringify(match.matchReasons),
      match.recommendedAction,
      match.actionUrgency,
      match.draftMessage,
      match.draftChannel,
      JSON.stringify(match.draftPersonalization),
      match.status,
    ]
  )

  return match.id
}

/**
 * Get new matches for a seller
 */
export async function getNewMatchesForSeller(sellerUserId: string): Promise<Array<{
  match: SignalMatch
  signal: BuyingSignal
}>> {
  const result = await query<Record<string, unknown>>(
    `SELECT m.*, s.*
     FROM signal_matches m
     JOIN buying_signals s ON m.signal_id = s.id
     WHERE m.seller_user_id = $1 AND m.status = 'new'
     ORDER BY m.match_score DESC
     LIMIT 20`,
    [sellerUserId]
  )

  return result.rows.map(row => ({
    match: {
      id: row.id as string,
      signalId: row.signal_id as string,
      sellerUserId: row.seller_user_id as string,
      matchScore: row.match_score as number,
      matchReasons: row.match_reasons as string[],
      recommendedAction: row.recommended_action as SignalMatch['recommendedAction'],
      actionUrgency: row.action_urgency as SignalMatch['actionUrgency'],
      draftMessage: row.draft_message as string,
      draftChannel: row.draft_channel as SignalMatch['draftChannel'],
      status: row.status as SignalMatch['status'],
    },
    signal: {
      id: row.signal_id as string,
      source: row.source as SignalSource,
      signalType: row.signal_type as SignalType,
      strength: row.strength as number,
      confidence: row.confidence as number,
      companyName: row.company_name as string,
      companyDomain: row.company_domain as string,
      personName: row.person_name as string,
      personTitle: row.person_title as string,
      title: row.title as string,
      description: row.description as string,
      extractedKeywords: row.extracted_keywords as string[],
      signalDate: new Date(row.signal_date as string),
      detectedAt: new Date(row.detected_at as string),
    } as BuyingSignal,
  }))
}

/**
 * Approve a match and send outreach
 */
export async function approveMatch(
  matchId: string,
  sellerUserId: string,
  customMessage?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Get match and signal
  const result = await query<Record<string, unknown>>(
    `SELECT m.*, s.*
     FROM signal_matches m
     JOIN buying_signals s ON m.signal_id = s.id
     WHERE m.id = $1 AND m.seller_user_id = $2`,
    [matchId, sellerUserId]
  )

  if (result.rows.length === 0) {
    return { success: false, error: 'Match not found' }
  }

  const match = result.rows[0]
  const messageBody = customMessage || match.draft_message

  // Create contact if not exists
  const contactId = uuidv4()
  await query(
    `INSERT INTO outreach_contacts (
      id, user_id, email, first_name, last_name, title, company_name, company_domain,
      linkedin_url, twitter_handle, status, source_row_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new', $11)
    ON CONFLICT (user_id, email_hash) DO UPDATE SET updated_at = NOW()
    RETURNING id`,
    [
      contactId,
      sellerUserId,
      null, // Would need to find email
      match.person_name?.split(' ')[0],
      match.person_name?.split(' ').slice(1).join(' '),
      match.person_title,
      match.company_name,
      match.company_domain,
      match.person_linkedin,
      match.person_twitter,
      JSON.stringify({ signal_id: match.signal_id }),
    ]
  )

  // Create outreach message
  const messageId = uuidv4()
  await query(
    `INSERT INTO outreach_messages (
      id, user_id, contact_id, channel, subject, body,
      ai_generated, personalization_factors, status, scheduled_at
    ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, 'scheduled', NOW())`,
    [
      messageId,
      sellerUserId,
      contactId,
      match.draft_channel || 'email',
      `Re: ${match.title}`,
      messageBody,
      JSON.stringify({ signalType: match.signal_type, matchScore: match.match_score }),
    ]
  )

  // Update match status
  await query(
    "UPDATE signal_matches SET status = 'approved', approved_at = NOW() WHERE id = $1",
    [matchId]
  )

  return { success: true, messageId }
}

/**
 * Dismiss a match
 */
export async function dismissMatch(
  matchId: string,
  sellerUserId: string,
  reason?: string
): Promise<boolean> {
  const result = await query(
    `UPDATE signal_matches
     SET status = 'dismissed', dismissed_at = NOW(), dismiss_reason = $3
     WHERE id = $1 AND seller_user_id = $2`,
    [matchId, sellerUserId, reason]
  )

  return (result.rowCount || 0) > 0
}

// ============================================================================
// PROSPECTING RUNNER
// ============================================================================

/**
 * Run prospecting for all active sellers
 * This would be called by a cron job
 */
export async function runProspecting(): Promise<ProspectingResult> {
  console.log('[Prospecting] Starting prospecting run...')

  const allSignals: BuyingSignal[] = []
  const allMatches: SignalMatch[] = []

  // Get unique keywords and competitors from all seller ICPs
  const icpData = await query<{ keywords: string[]; competitors: string[] }>(
    `SELECT
       array_agg(DISTINCT unnest(industries)) as keywords,
       '{}' as competitors
     FROM seller_icps
     WHERE is_active = true`
  )

  const keywords = icpData.rows[0]?.keywords || ['procurement', 'purchasing', 'supply chain']
  const competitors = icpData.rows[0]?.competitors || []

  // Detect signals from various sources
  const [twitterSignals, jobSignals, fundingSignals] = await Promise.all([
    detectTwitterSignals(keywords, competitors),
    detectJobSignals(),
    detectFundingSignals(),
  ])

  allSignals.push(...twitterSignals, ...jobSignals, ...fundingSignals)

  console.log(`[Prospecting] Detected ${allSignals.length} signals`)

  // Store signals and match to sellers
  for (const signal of allSignals) {
    await storeSignal(signal)

    const matches = await matchSignalToSellers(signal)
    for (const match of matches) {
      await storeMatch(match)
      allMatches.push(match)
    }
  }

  console.log(`[Prospecting] Created ${allMatches.length} matches`)

  return {
    signalsFound: allSignals.length,
    matchesCreated: allMatches.length,
    topSignals: allSignals.slice(0, 5),
    topMatches: allMatches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5),
  }
}

/**
 * Get prospecting summary for a seller
 */
export async function getProspectingSummary(sellerUserId: string): Promise<{
  newMatches: number
  pendingReview: number
  sentThisWeek: number
  repliesReceived: number
  topOpportunities: Array<{ signal: BuyingSignal; match: SignalMatch }>
}> {
  const [matchCounts, sentCount, replyCount, opportunities] = await Promise.all([
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count
       FROM signal_matches
       WHERE seller_user_id = $1
       GROUP BY status`,
      [sellerUserId]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM outreach_messages m
       JOIN outreach_contacts c ON m.contact_id = c.id
       WHERE m.user_id = $1 AND m.sent_at > NOW() - INTERVAL '7 days'`,
      [sellerUserId]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM outreach_events e
       JOIN outreach_messages m ON e.message_id = m.id
       WHERE m.user_id = $1 AND e.event_type = 'replied' AND e.created_at > NOW() - INTERVAL '7 days'`,
      [sellerUserId]
    ),
    getNewMatchesForSeller(sellerUserId),
  ])

  const statusCounts = matchCounts.rows.reduce((acc, row) => {
    acc[row.status] = parseInt(row.count, 10)
    return acc
  }, {} as Record<string, number>)

  return {
    newMatches: statusCounts['new'] || 0,
    pendingReview: statusCounts['reviewed'] || 0,
    sentThisWeek: parseInt(sentCount.rows[0]?.count || '0', 10),
    repliesReceived: parseInt(replyCount.rows[0]?.count || '0', 10),
    topOpportunities: opportunities.slice(0, 3).map(o => ({
      signal: o.signal,
      match: o.match,
    })),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  detectTwitterSignals,
  detectJobSignals,
  detectFundingSignals,
  detectLinkedInSignals,
  matchSignalToSellers,
  storeSignal,
  storeMatch,
  getNewMatchesForSeller,
  approveMatch,
  dismissMatch,
  runProspecting,
  getProspectingSummary,
}
