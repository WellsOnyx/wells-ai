// @ts-nocheck
/**
 * LinkedIn Content Service
 *
 * Manages Wells' LinkedIn presence through content:
 * - Post drafting for Wells' account
 * - Comment drafts for prospect engagement
 * - Article ideas based on industry trends
 * - Content scheduling and tracking
 *
 * All content is reviewed before posting (manual or via API).
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { WELLS_VOICE_PRINCIPLES } from '@/lib/coldstart/wells-voice'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type ContentType = 'post' | 'comment' | 'article_idea' | 'poll' | 'carousel_idea'

export type ContentStatus =
  | 'draft'           // Just created
  | 'ready'           // Reviewed and ready
  | 'scheduled'       // Scheduled for posting
  | 'posted'          // Published
  | 'archived'        // No longer relevant

export interface ContentItem {
  id: string
  userId: string
  type: ContentType
  status: ContentStatus

  // Content
  title?: string
  body: string
  hashtags?: string[]
  mentions?: string[]
  mediaUrls?: string[]

  // For comments
  targetPostUrl?: string
  targetPostContent?: string
  targetProfileUrl?: string

  // Scheduling
  scheduledFor?: Date
  postedAt?: Date
  linkedinPostId?: string

  // Performance (filled after posting)
  impressions?: number
  likes?: number
  comments?: number
  shares?: number
  engagementRate?: number

  // Metadata
  theme?: string
  goal?: string
  audience?: string
  wellsNotes?: string
  characterCount: number

  createdAt: Date
  updatedAt: Date
}

export interface ContentTheme {
  id: string
  name: string
  description: string
  topics: string[]
  frequency: 'daily' | 'weekly' | 'monthly'
  audienceType: string
}

export interface ContentGenerationRequest {
  type: ContentType
  theme?: string
  customPrompt?: string
  targetPost?: {
    url: string
    content: string
    authorName?: string
    authorCompany?: string
  }
  goal?: string
  audience?: string
  constraints?: string[]
}

// ============================================================================
// CONTENT THEMES
// ============================================================================

export const CONTENT_THEMES: ContentTheme[] = [
  {
    id: 'ai_in_commerce',
    name: 'AI in B2B Commerce',
    description: 'How AI is transforming business transactions',
    topics: [
      'AI agents vs traditional software',
      'The future of procurement automation',
      'When AI should vs shouldn\'t be used',
      'Behind the scenes of building an AI agent',
      'Lessons from AI failures'
    ],
    frequency: 'weekly',
    audienceType: 'executives'
  },
  {
    id: 'procurement_insights',
    name: 'Procurement Insights',
    description: 'Practical tips for buyers and procurement teams',
    topics: [
      'Negotiation strategies that work',
      'Hidden costs in vendor relationships',
      'RFQ best practices',
      'Building supplier trust',
      'Working capital optimization'
    ],
    frequency: 'weekly',
    audienceType: 'procurement'
  },
  {
    id: 'founder_journey',
    name: 'Founder Journey',
    description: 'Real talk about building Wells',
    topics: [
      'What we got wrong (and fixed)',
      'Customer feedback that changed everything',
      'The hard choices in product development',
      'Metrics that matter (and don\'t)',
      'Building in public'
    ],
    frequency: 'weekly',
    audienceType: 'founders'
  },
  {
    id: 'industry_trends',
    name: 'Industry Trends',
    description: 'What\'s happening in B2B and supply chain',
    topics: [
      'Supply chain disruptions and solutions',
      'Digital transformation in manufacturing',
      'The middleman problem',
      'Cross-border trade challenges',
      'Sustainability in procurement'
    ],
    frequency: 'monthly',
    audienceType: 'general'
  },
  {
    id: 'thought_leadership',
    name: 'Thought Leadership',
    description: 'Big ideas and contrarian takes',
    topics: [
      'Why most B2B software fails',
      'The future of work in commerce',
      'Hot takes on industry news',
      'Predictions and retrospectives',
      'Unpopular opinions'
    ],
    frequency: 'monthly',
    audienceType: 'executives'
  }
]

// ============================================================================
// POST GENERATION
// ============================================================================

/**
 * Generate a LinkedIn post
 */
export async function generatePost(
  request: ContentGenerationRequest
): Promise<ContentItem> {
  const theme = request.theme
    ? CONTENT_THEMES.find(t => t.id === request.theme)
    : CONTENT_THEMES[Math.floor(Math.random() * CONTENT_THEMES.length)]

  const topic = theme
    ? theme.topics[Math.floor(Math.random() * theme.topics.length)]
    : 'general industry insight'

  const systemPrompt = `You are Wells, an AI commerce agent, writing LinkedIn posts.

${WELLS_VOICE_PRINCIPLES}

LINKEDIN POST GUIDELINES:
- Sweet spot is 150-250 words
- Hook in the first line (this shows in preview)
- Use whitespace - break up paragraphs
- End with a question or CTA to drive engagement
- Max 3 hashtags, placed at the end
- Be genuine, not preachy
- It's okay to have opinions
- Share real insights, not platitudes

AUDIENCE: ${request.audience || theme?.audienceType || 'business professionals'}
GOAL: ${request.goal || 'thought leadership and engagement'}
THEME: ${theme?.name || 'general'}
TOPIC: ${topic}

${request.constraints?.length ? `CONSTRAINTS:\n${request.constraints.map(c => `- ${c}`).join('\n')}` : ''}

RESPOND WITH JSON:
{
  "title": "internal title for tracking",
  "body": "the actual post content",
  "hashtags": ["tag1", "tag2"],
  "wellsNotes": "why you wrote it this way"
}`

  const userPrompt = request.customPrompt || `Write a LinkedIn post about: ${topic}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  })

  const text = response.content.find(b => b.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  try {
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')

    return {
      id: uuidv4(),
      userId: '', // Set by caller
      type: 'post',
      status: 'draft',
      title: parsed.title,
      body: parsed.body || text,
      hashtags: parsed.hashtags || [],
      theme: theme?.id,
      goal: request.goal,
      audience: request.audience,
      wellsNotes: parsed.wellsNotes,
      characterCount: (parsed.body || text).length,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  } catch {
    return {
      id: uuidv4(),
      userId: '',
      type: 'post',
      status: 'draft',
      body: text,
      characterCount: text.length,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
}

// ============================================================================
// COMMENT GENERATION
// ============================================================================

/**
 * Generate a comment for a prospect's post
 */
export async function generateComment(
  request: ContentGenerationRequest
): Promise<ContentItem> {
  if (!request.targetPost) {
    throw new Error('Target post required for comment generation')
  }

  const systemPrompt = `You are Wells, an AI commerce agent, writing a LinkedIn comment.

${WELLS_VOICE_PRINCIPLES}

COMMENT GUIDELINES:
- Be genuinely engaging, not promotional
- Add value to the conversation
- Don't hijack with your own agenda
- Show you actually read their post
- Keep it under 300 characters ideally
- No emojis unless the conversation is casual
- Ask a thoughtful question if appropriate

AUTHOR: ${request.targetPost.authorName || 'Unknown'} ${request.targetPost.authorCompany ? `at ${request.targetPost.authorCompany}` : ''}
GOAL: ${request.goal || 'engage authentically and build relationship'}

THEIR POST:
"${request.targetPost.content}"

RESPOND WITH JSON:
{
  "body": "the comment",
  "wellsNotes": "why this approach"
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Write an engaging comment for this post.` }]
  })

  const text = response.content.find(b => b.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  try {
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')

    return {
      id: uuidv4(),
      userId: '',
      type: 'comment',
      status: 'draft',
      body: parsed.body || text,
      targetPostUrl: request.targetPost.url,
      targetPostContent: request.targetPost.content,
      goal: request.goal,
      wellsNotes: parsed.wellsNotes,
      characterCount: (parsed.body || text).length,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  } catch {
    return {
      id: uuidv4(),
      userId: '',
      type: 'comment',
      status: 'draft',
      body: text,
      targetPostUrl: request.targetPost.url,
      characterCount: text.length,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
}

// ============================================================================
// ARTICLE IDEAS
// ============================================================================

/**
 * Generate article ideas based on trends
 */
export async function generateArticleIdeas(
  count: number = 5,
  focus?: string
): Promise<Array<{
  title: string
  outline: string[]
  targetAudience: string
  keyTakeaway: string
  estimatedLength: string
}>> {
  const systemPrompt = `You are Wells, an AI commerce agent, brainstorming LinkedIn article ideas.

Generate ${count} article ideas that would resonate with B2B professionals.
${focus ? `Focus area: ${focus}` : ''}

Each article should:
- Have a compelling, specific title (not clickbait)
- Address a real problem or opportunity
- Offer actionable insights
- Fit Wells' voice (direct, helpful, honest about AI)

RESPOND WITH JSON:
{
  "ideas": [
    {
      "title": "Article title",
      "outline": ["Point 1", "Point 2", "Point 3"],
      "targetAudience": "who this is for",
      "keyTakeaway": "the main insight",
      "estimatedLength": "e.g., 5-7 min read"
    }
  ]
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Generate article ideas.' }]
  })

  const text = response.content.find(b => b.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  try {
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')
    return parsed.ideas || []
  } catch {
    return []
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Save content to database
 */
export async function saveContent(
  content: ContentItem
): Promise<ContentItem> {
  const result = await query<ContentItem>(`
    INSERT INTO linkedin_content_queue (
      id, user_id, type, status,
      title, body, hashtags, mentions, media_urls,
      target_post_url, target_post_content, target_profile_url,
      scheduled_for, posted_at, linkedin_post_id,
      impressions, likes, comments, shares, engagement_rate,
      theme, goal, audience, wells_notes, character_count,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25,
      $26, $27
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      body = EXCLUDED.body,
      scheduled_for = EXCLUDED.scheduled_for,
      posted_at = EXCLUDED.posted_at,
      linkedin_post_id = EXCLUDED.linkedin_post_id,
      impressions = EXCLUDED.impressions,
      likes = EXCLUDED.likes,
      comments = EXCLUDED.comments,
      shares = EXCLUDED.shares,
      engagement_rate = EXCLUDED.engagement_rate,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `, [
    content.id,
    content.userId,
    content.type,
    content.status,
    content.title,
    content.body,
    JSON.stringify(content.hashtags || []),
    JSON.stringify(content.mentions || []),
    JSON.stringify(content.mediaUrls || []),
    content.targetPostUrl,
    content.targetPostContent,
    content.targetProfileUrl,
    content.scheduledFor,
    content.postedAt,
    content.linkedinPostId,
    content.impressions,
    content.likes,
    content.comments,
    content.shares,
    content.engagementRate,
    content.theme,
    content.goal,
    content.audience,
    content.wellsNotes,
    content.characterCount,
    content.createdAt,
    content.updatedAt
  ])

  return result.rows[0]
}

/**
 * Get content items
 */
export async function getContent(
  userId: string,
  filters: {
    type?: ContentType
    status?: ContentStatus | ContentStatus[]
    theme?: string
    limit?: number
    offset?: number
  } = {}
): Promise<ContentItem[]> {
  const conditions: string[] = ['user_id = $1']
  const params: any[] = [userId]
  let paramIndex = 2

  if (filters.type) {
    conditions.push(`type = $${paramIndex}`)
    params.push(filters.type)
    paramIndex++
  }

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    conditions.push(`status = ANY($${paramIndex})`)
    params.push(statuses)
    paramIndex++
  }

  if (filters.theme) {
    conditions.push(`theme = $${paramIndex}`)
    params.push(filters.theme)
    paramIndex++
  }

  const limit = filters.limit || 50
  const offset = filters.offset || 0
  params.push(limit, offset)

  const result = await query<ContentItem>(`
    SELECT * FROM linkedin_content_queue
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE status WHEN 'scheduled' THEN 0 WHEN 'ready' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
      scheduled_for ASC NULLS LAST,
      created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `, params)

  return result.rows
}

/**
 * Schedule content for posting
 */
export async function scheduleContent(
  contentId: string,
  scheduledFor: Date
): Promise<void> {
  await query(`
    UPDATE linkedin_content_queue
    SET status = 'scheduled', scheduled_for = $2, updated_at = NOW()
    WHERE id = $1
  `, [contentId, scheduledFor])
}

/**
 * Mark content as posted
 */
export async function markAsPosted(
  contentId: string,
  linkedinPostId?: string
): Promise<void> {
  await query(`
    UPDATE linkedin_content_queue
    SET status = 'posted', posted_at = NOW(), linkedin_post_id = $2, updated_at = NOW()
    WHERE id = $1
  `, [contentId, linkedinPostId])
}

/**
 * Update content performance metrics
 */
export async function updateMetrics(
  contentId: string,
  metrics: {
    impressions?: number
    likes?: number
    comments?: number
    shares?: number
  }
): Promise<void> {
  const engagementRate = metrics.impressions && metrics.impressions > 0
    ? ((metrics.likes || 0) + (metrics.comments || 0) * 2 + (metrics.shares || 0) * 3) / metrics.impressions * 100
    : 0

  await query(`
    UPDATE linkedin_content_queue
    SET
      impressions = COALESCE($2, impressions),
      likes = COALESCE($3, likes),
      comments = COALESCE($4, comments),
      shares = COALESCE($5, shares),
      engagement_rate = $6,
      updated_at = NOW()
    WHERE id = $1
  `, [contentId, metrics.impressions, metrics.likes, metrics.comments, metrics.shares, engagementRate])
}

// ============================================================================
// CONTENT CALENDAR
// ============================================================================

export interface ContentCalendarWeek {
  weekStart: Date
  weekEnd: Date
  scheduled: ContentItem[]
  suggestions: Array<{
    dayOfWeek: number
    theme: ContentTheme
    topic: string
  }>
}

/**
 * Generate a content calendar for the week
 */
export async function generateContentCalendar(
  userId: string,
  weekStart: Date
): Promise<ContentCalendarWeek> {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  // Get already scheduled content
  const scheduled = await getContent(userId, {
    status: 'scheduled'
  })

  const scheduledThisWeek = scheduled.filter(c =>
    c.scheduledFor && c.scheduledFor >= weekStart && c.scheduledFor < weekEnd
  )

  // Generate suggestions for empty days
  const suggestions: ContentCalendarWeek['suggestions'] = []
  const daysWithContent = new Set(
    scheduledThisWeek.map(c => new Date(c.scheduledFor!).getDay())
  )

  // Suggest content for Tuesday, Wednesday, Thursday (best LinkedIn days)
  const idealDays = [2, 3, 4] // Tue, Wed, Thu
  for (const day of idealDays) {
    if (!daysWithContent.has(day)) {
      const theme = CONTENT_THEMES[Math.floor(Math.random() * CONTENT_THEMES.length)]
      suggestions.push({
        dayOfWeek: day,
        theme,
        topic: theme.topics[Math.floor(Math.random() * theme.topics.length)]
      })
    }
  }

  return {
    weekStart,
    weekEnd,
    scheduled: scheduledThisWeek,
    suggestions
  }
}

// ============================================================================
// BEST PRACTICES & TIMING
// ============================================================================

export const LINKEDIN_BEST_TIMES = {
  // Day of week -> best hours (24h format)
  1: [8, 10, 12], // Monday
  2: [8, 10, 12, 17], // Tuesday (best day)
  3: [8, 10, 12, 17], // Wednesday (best day)
  4: [8, 10, 12, 17], // Thursday (best day)
  5: [8, 10], // Friday (OK but engagement drops)
  0: [], // Sunday (avoid)
  6: [] // Saturday (avoid)
}

/**
 * Get the next optimal posting time
 */
export function getNextOptimalPostTime(fromDate: Date = new Date()): Date {
  const result = new Date(fromDate)

  // Find the next good time slot
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(fromDate)
    checkDate.setDate(checkDate.getDate() + dayOffset)
    const dayOfWeek = checkDate.getDay()

    const bestHours = LINKEDIN_BEST_TIMES[dayOfWeek as keyof typeof LINKEDIN_BEST_TIMES]
    if (!bestHours.length) continue

    for (const hour of bestHours) {
      const candidate = new Date(checkDate)
      candidate.setHours(hour, 0, 0, 0)

      if (candidate > fromDate) {
        return candidate
      }
    }
  }

  // Fallback: next Tuesday at 10am
  while (result.getDay() !== 2) {
    result.setDate(result.getDate() + 1)
  }
  result.setHours(10, 0, 0, 0)
  return result
}

// ============================================================================
// CHAT FORMATTING
// ============================================================================

/**
 * Format content for chat display
 */
export function formatContentForChat(content: ContentItem): string {
  const lines: string[] = []

  lines.push(`**${content.type.charAt(0).toUpperCase() + content.type.slice(1)}** (${content.status})`)

  if (content.title) {
    lines.push(`*${content.title}*`)
  }

  lines.push('')
  lines.push('---')
  lines.push(content.body.length > 500 ? content.body.substring(0, 500) + '...' : content.body)
  lines.push('---')
  lines.push('')

  if (content.hashtags?.length) {
    lines.push(`Hashtags: ${content.hashtags.map(t => `#${t}`).join(' ')}`)
  }

  lines.push(`Characters: ${content.characterCount}`)

  if (content.scheduledFor) {
    lines.push(`Scheduled: ${content.scheduledFor.toLocaleDateString()} at ${content.scheduledFor.toLocaleTimeString()}`)
  }

  if (content.wellsNotes) {
    lines.push('')
    lines.push(`*Wells' note: ${content.wellsNotes}*`)
  }

  return lines.join('\n')
}

/**
 * Format article ideas for chat
 */
export function formatArticleIdeasForChat(
  ideas: Awaited<ReturnType<typeof generateArticleIdeas>>
): string {
  if (!ideas.length) {
    return "Couldn't generate article ideas. Try again with a specific focus area."
  }

  const lines: string[] = ['**Article Ideas**\n']

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    lines.push(`${i + 1}. **${idea.title}**`)
    lines.push(`   - Audience: ${idea.targetAudience}`)
    lines.push(`   - Key takeaway: ${idea.keyTakeaway}`)
    lines.push(`   - Length: ${idea.estimatedLength}`)
    lines.push('')
  }

  lines.push('\nSay "expand on #X" to develop any of these further.')

  return lines.join('\n')
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CONTENT_THEMES,
  generatePost,
  generateComment,
  generateArticleIdeas,
  saveContent,
  getContent,
  scheduleContent,
  markAsPosted,
  updateMetrics,
  generateContentCalendar,
  getNextOptimalPostTime,
  formatContentForChat,
  formatArticleIdeasForChat,
  LINKEDIN_BEST_TIMES
}
