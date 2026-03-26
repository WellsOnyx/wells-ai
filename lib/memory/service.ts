// @ts-nocheck
/**
 * Wells Memory Service
 *
 * "I will never forget you. See, I have engraved you on the palms of my hands."
 * - Isaiah 49:15-16
 *
 * The core memory service for Wells AI. Handles all memory operations:
 * - Saving and retrieving memories
 * - Updating partial memory data
 * - Extracting facts from conversations
 * - Building personalization context
 */

import { query, sqlQuery as sql } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import {
  WellsMemory,
  UserFacts,
  BehavioralPatterns,
  RelationshipHistory,
  RecentContext,
  LearnedPreferences,
  ExtractedMemory,
  PersonalizationContext,
  MemoryUpdate,
  createEmptyMemory,
  calculateTrustTier,
  daysSince,
  hoursSince,
} from './schema'

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// MEMORY RETRIEVAL
// ============================================================================

/**
 * Get complete memory for a user
 */
export async function getMemory(userId: string): Promise<WellsMemory | null> {
  try {
    // Get main memory record
    const result = await sql`
      SELECT * FROM user_memory WHERE user_id = ${userId}
    `

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]

    // Get additional data
    const [facts, interactions, preferences, recentMentions] = await Promise.all([
      getFactsFromDb(userId),
      getInteractionHistory(userId),
      getPreferencesFromDb(userId),
      getRecentMentions(userId),
    ])

    // Build complete memory object
    const memory: WellsMemory = {
      userId,

      facts: {
        name: row.name,
        preferredName: row.preferred_name,
        email: row.email,
        phone: row.phone,
        company: row.company,
        role: row.role,
        title: row.title,
        industry: row.industry,
        companySize: row.company_size,
        location: row.location,
        city: row.city,
        state: row.state,
        country: row.country,
        timezone: row.timezone,
        preferences: row.custom_preferences || {},
        tags: row.tags || [],
        ...facts,
      },

      patterns: {
        activeHours: row.active_hours,
        activeDays: row.active_days,
        responseSpeed: row.response_speed || 'varies',
        averageResponseTimeMinutes: row.avg_response_time,
        communicationStyle: row.communication_style || 'mixed',
        messageLength: row.message_length || 'varies',
        usesEmoji: row.uses_emoji || false,
        decisionStyle: row.decision_style || 'deliberate',
        averageDecisionTimeHours: row.avg_decision_time,
        sessionDuration: row.session_duration || 'varies',
        averageSessionMinutes: row.avg_session_minutes,
        frequentlyUsedFeatures: row.frequent_features || [],
        rarelyUsedFeatures: row.rare_features || [],
        typicalAbsenceHours: row.typical_absence_hours,
        typicalMood: row.typical_mood,
      },

      history: {
        firstContact: new Date(row.first_contact),
        firstInteractionSummary: row.first_interaction_summary,
        totalInteractions: row.total_interactions || 0,
        totalMessages: row.total_messages || 0,
        totalSessions: row.total_sessions || 0,
        successfulDeals: row.successful_deals || 0,
        failedDeals: row.failed_deals || 0,
        totalValueTransacted: parseFloat(row.total_value_transacted) || 0,
        averageDealValue: row.avg_deal_value ? parseFloat(row.avg_deal_value) : undefined,
        quotesRequested: row.quotes_requested || 0,
        quotesAccepted: row.quotes_accepted || 0,
        quoteConversionRate: row.quote_conversion_rate,
        lastInteraction: new Date(row.last_interaction),
        longestStreak: row.longest_streak,
        currentStreak: row.current_streak,
        trustScore: row.trust_score || 0,
        trustTier: row.trust_tier || 'new',
        milestones: row.milestones || [],
        referralsMade: row.referrals_made || 0,
        referralsReceived: row.referrals_received || 0,
        ...interactions,
      },

      recentContext: {
        lastTopic: row.last_topic,
        lastTopicTimestamp: row.last_topic_timestamp ? new Date(row.last_topic_timestamp) : undefined,
        ongoingProjects: row.ongoing_projects || [],
        pendingActions: row.pending_actions || [],
        mentionedPeople: recentMentions.people,
        mentionedCompanies: recentMentions.companies,
        mentionedProducts: recentMentions.products,
        mentionedAmounts: recentMentions.amounts,
        mentionedDates: recentMentions.dates,
        openQuestions: row.open_questions || [],
        promises: row.promises || [],
        concerns: row.concerns || [],
        sentimentTrend: row.sentiment_trend || 'stable',
        conversationSummaries: row.conversation_summaries || [],
      },

      learnedPreferences: {
        preferredSuppliers: preferences.preferredSuppliers,
        avoidSuppliers: preferences.avoidSuppliers,
        preferredCategories: preferences.preferredCategories,
        priceSensitivity: row.price_sensitivity || 'medium',
        maxAcceptablePremium: row.max_acceptable_premium,
        qualityPriority: row.quality_priority || 'medium',
        qualityIndicators: row.quality_indicators,
        speedPriority: row.speed_priority || 'medium',
        typicalLeadTimeRequirement: row.typical_lead_time,
        preferredContactMethod: row.preferred_contact_method || 'in-app',
        preferredContactTimes: row.preferred_contact_times,
        dontDisturbHours: row.dont_disturb_hours,
        notificationFrequency: row.notification_frequency || 'daily',
        notificationTypes: row.notification_types || {
          deals: true,
          quotes: true,
          reminders: true,
          insights: true,
          celebrations: true,
        },
        contentDetail: row.content_detail || 'balanced',
        wantsAlternatives: row.wants_alternatives ?? true,
        wantsExplanations: row.wants_explanations ?? true,
        wantsProactiveInsights: row.wants_proactive ?? true,
        preferredPaymentTerms: row.preferred_payment_terms,
        preferredPaymentMethods: row.preferred_payment_methods,
        negotiationStyle: row.negotiation_style,
        riskTolerance: row.risk_tolerance || 'moderate',
        brandPreferences: row.brand_preferences,
      },

      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }

    return memory
  } catch (error) {
    console.error('[MemoryService] Error getting memory:', error)
    return null
  }
}

/**
 * Get or create memory for a user
 */
export async function getOrCreateMemory(userId: string): Promise<WellsMemory> {
  const existing = await getMemory(userId)
  if (existing) {
    return existing
  }

  // Create new memory
  return await createMemory(userId)
}

/**
 * Create a new memory for a user
 */
export async function createMemory(userId: string): Promise<WellsMemory> {
  const memory = createEmptyMemory(userId)

  try {
    await sql`
      INSERT INTO user_memory (
        user_id,
        first_contact,
        last_interaction,
        trust_score,
        trust_tier,
        total_interactions,
        total_messages,
        total_sessions,
        sentiment_trend,
        created_at,
        updated_at
      ) VALUES (
        ${userId},
        NOW(),
        NOW(),
        0,
        'new',
        0,
        0,
        0,
        'stable',
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO NOTHING
    `

    return memory
  } catch (error) {
    console.error('[MemoryService] Error creating memory:', error)
    return memory
  }
}

// ============================================================================
// MEMORY UPDATES
// ============================================================================

/**
 * Update memory with new data
 */
export async function updateMemory(
  userId: string,
  updates: Partial<{
    facts: Partial<UserFacts>
    patterns: Partial<BehavioralPatterns>
    history: Partial<RelationshipHistory>
    recentContext: Partial<RecentContext>
    learnedPreferences: Partial<LearnedPreferences>
  }>
): Promise<void> {
  try {
    // Ensure memory exists
    await getOrCreateMemory(userId)

    const setClauses: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Update facts
    if (updates.facts) {
      const f = updates.facts
      if (f.name !== undefined) { setClauses.push(`name = $${paramIndex++}`); params.push(f.name) }
      if (f.preferredName !== undefined) { setClauses.push(`preferred_name = $${paramIndex++}`); params.push(f.preferredName) }
      if (f.email !== undefined) { setClauses.push(`email = $${paramIndex++}`); params.push(f.email) }
      if (f.phone !== undefined) { setClauses.push(`phone = $${paramIndex++}`); params.push(f.phone) }
      if (f.company !== undefined) { setClauses.push(`company = $${paramIndex++}`); params.push(f.company) }
      if (f.role !== undefined) { setClauses.push(`role = $${paramIndex++}`); params.push(f.role) }
      if (f.title !== undefined) { setClauses.push(`title = $${paramIndex++}`); params.push(f.title) }
      if (f.industry !== undefined) { setClauses.push(`industry = $${paramIndex++}`); params.push(f.industry) }
      if (f.companySize !== undefined) { setClauses.push(`company_size = $${paramIndex++}`); params.push(f.companySize) }
      if (f.location !== undefined) { setClauses.push(`location = $${paramIndex++}`); params.push(f.location) }
      if (f.city !== undefined) { setClauses.push(`city = $${paramIndex++}`); params.push(f.city) }
      if (f.state !== undefined) { setClauses.push(`state = $${paramIndex++}`); params.push(f.state) }
      if (f.country !== undefined) { setClauses.push(`country = $${paramIndex++}`); params.push(f.country) }
      if (f.timezone !== undefined) { setClauses.push(`timezone = $${paramIndex++}`); params.push(f.timezone) }
      if (f.preferences !== undefined) { setClauses.push(`custom_preferences = $${paramIndex++}`); params.push(JSON.stringify(f.preferences)) }
      if (f.tags !== undefined) { setClauses.push(`tags = $${paramIndex++}`); params.push(f.tags) }
    }

    // Update patterns
    if (updates.patterns) {
      const p = updates.patterns
      if (p.activeHours !== undefined) { setClauses.push(`active_hours = $${paramIndex++}`); params.push(JSON.stringify(p.activeHours)) }
      if (p.activeDays !== undefined) { setClauses.push(`active_days = $${paramIndex++}`); params.push(p.activeDays) }
      if (p.responseSpeed !== undefined) { setClauses.push(`response_speed = $${paramIndex++}`); params.push(p.responseSpeed) }
      if (p.averageResponseTimeMinutes !== undefined) { setClauses.push(`avg_response_time = $${paramIndex++}`); params.push(p.averageResponseTimeMinutes) }
      if (p.communicationStyle !== undefined) { setClauses.push(`communication_style = $${paramIndex++}`); params.push(p.communicationStyle) }
      if (p.messageLength !== undefined) { setClauses.push(`message_length = $${paramIndex++}`); params.push(p.messageLength) }
      if (p.usesEmoji !== undefined) { setClauses.push(`uses_emoji = $${paramIndex++}`); params.push(p.usesEmoji) }
      if (p.decisionStyle !== undefined) { setClauses.push(`decision_style = $${paramIndex++}`); params.push(p.decisionStyle) }
      if (p.sessionDuration !== undefined) { setClauses.push(`session_duration = $${paramIndex++}`); params.push(p.sessionDuration) }
      if (p.frequentlyUsedFeatures !== undefined) { setClauses.push(`frequent_features = $${paramIndex++}`); params.push(p.frequentlyUsedFeatures) }
      if (p.typicalMood !== undefined) { setClauses.push(`typical_mood = $${paramIndex++}`); params.push(p.typicalMood) }
    }

    // Update history
    if (updates.history) {
      const h = updates.history
      if (h.totalInteractions !== undefined) { setClauses.push(`total_interactions = $${paramIndex++}`); params.push(h.totalInteractions) }
      if (h.totalMessages !== undefined) { setClauses.push(`total_messages = $${paramIndex++}`); params.push(h.totalMessages) }
      if (h.totalSessions !== undefined) { setClauses.push(`total_sessions = $${paramIndex++}`); params.push(h.totalSessions) }
      if (h.successfulDeals !== undefined) { setClauses.push(`successful_deals = $${paramIndex++}`); params.push(h.successfulDeals) }
      if (h.failedDeals !== undefined) { setClauses.push(`failed_deals = $${paramIndex++}`); params.push(h.failedDeals) }
      if (h.totalValueTransacted !== undefined) { setClauses.push(`total_value_transacted = $${paramIndex++}`); params.push(h.totalValueTransacted) }
      if (h.quotesRequested !== undefined) { setClauses.push(`quotes_requested = $${paramIndex++}`); params.push(h.quotesRequested) }
      if (h.quotesAccepted !== undefined) { setClauses.push(`quotes_accepted = $${paramIndex++}`); params.push(h.quotesAccepted) }
      if (h.trustScore !== undefined) { setClauses.push(`trust_score = $${paramIndex++}`); params.push(h.trustScore) }
      if (h.trustTier !== undefined) { setClauses.push(`trust_tier = $${paramIndex++}`); params.push(h.trustTier) }
      if (h.currentStreak !== undefined) { setClauses.push(`current_streak = $${paramIndex++}`); params.push(h.currentStreak) }
      if (h.milestones !== undefined) { setClauses.push(`milestones = $${paramIndex++}`); params.push(JSON.stringify(h.milestones)) }
    }

    // Update recent context
    if (updates.recentContext) {
      const r = updates.recentContext
      if (r.lastTopic !== undefined) { setClauses.push(`last_topic = $${paramIndex++}`); params.push(r.lastTopic) }
      if (r.lastTopicTimestamp !== undefined) { setClauses.push(`last_topic_timestamp = $${paramIndex++}`); params.push(r.lastTopicTimestamp) }
      if (r.ongoingProjects !== undefined) { setClauses.push(`ongoing_projects = $${paramIndex++}`); params.push(JSON.stringify(r.ongoingProjects)) }
      if (r.pendingActions !== undefined) { setClauses.push(`pending_actions = $${paramIndex++}`); params.push(JSON.stringify(r.pendingActions)) }
      if (r.openQuestions !== undefined) { setClauses.push(`open_questions = $${paramIndex++}`); params.push(r.openQuestions) }
      if (r.promises !== undefined) { setClauses.push(`promises = $${paramIndex++}`); params.push(JSON.stringify(r.promises)) }
      if (r.concerns !== undefined) { setClauses.push(`concerns = $${paramIndex++}`); params.push(r.concerns) }
      if (r.sentimentTrend !== undefined) { setClauses.push(`sentiment_trend = $${paramIndex++}`); params.push(r.sentimentTrend) }
      if (r.conversationSummaries !== undefined) { setClauses.push(`conversation_summaries = $${paramIndex++}`); params.push(JSON.stringify(r.conversationSummaries)) }
    }

    // Update learned preferences
    if (updates.learnedPreferences) {
      const l = updates.learnedPreferences
      if (l.priceSensitivity !== undefined) { setClauses.push(`price_sensitivity = $${paramIndex++}`); params.push(l.priceSensitivity) }
      if (l.maxAcceptablePremium !== undefined) { setClauses.push(`max_acceptable_premium = $${paramIndex++}`); params.push(l.maxAcceptablePremium) }
      if (l.qualityPriority !== undefined) { setClauses.push(`quality_priority = $${paramIndex++}`); params.push(l.qualityPriority) }
      if (l.qualityIndicators !== undefined) { setClauses.push(`quality_indicators = $${paramIndex++}`); params.push(l.qualityIndicators) }
      if (l.speedPriority !== undefined) { setClauses.push(`speed_priority = $${paramIndex++}`); params.push(l.speedPriority) }
      if (l.preferredContactMethod !== undefined) { setClauses.push(`preferred_contact_method = $${paramIndex++}`); params.push(l.preferredContactMethod) }
      if (l.preferredContactTimes !== undefined) { setClauses.push(`preferred_contact_times = $${paramIndex++}`); params.push(l.preferredContactTimes) }
      if (l.notificationFrequency !== undefined) { setClauses.push(`notification_frequency = $${paramIndex++}`); params.push(l.notificationFrequency) }
      if (l.notificationTypes !== undefined) { setClauses.push(`notification_types = $${paramIndex++}`); params.push(JSON.stringify(l.notificationTypes)) }
      if (l.contentDetail !== undefined) { setClauses.push(`content_detail = $${paramIndex++}`); params.push(l.contentDetail) }
      if (l.wantsAlternatives !== undefined) { setClauses.push(`wants_alternatives = $${paramIndex++}`); params.push(l.wantsAlternatives) }
      if (l.wantsExplanations !== undefined) { setClauses.push(`wants_explanations = $${paramIndex++}`); params.push(l.wantsExplanations) }
      if (l.wantsProactiveInsights !== undefined) { setClauses.push(`wants_proactive = $${paramIndex++}`); params.push(l.wantsProactiveInsights) }
      if (l.negotiationStyle !== undefined) { setClauses.push(`negotiation_style = $${paramIndex++}`); params.push(l.negotiationStyle) }
      if (l.riskTolerance !== undefined) { setClauses.push(`risk_tolerance = $${paramIndex++}`); params.push(l.riskTolerance) }
    }

    // Always update last_interaction and updated_at
    setClauses.push(`last_interaction = NOW()`)
    setClauses.push(`updated_at = NOW()`)

    if (setClauses.length > 2) {
      params.push(userId)
      const updateQuery = `
        UPDATE user_memory
        SET ${setClauses.join(', ')}
        WHERE user_id = $${paramIndex}
      `
      await query(updateQuery, params)
    }
  } catch (error) {
    console.error('[MemoryService] Error updating memory:', error)
  }
}

/**
 * Save a complete memory (replaces existing)
 */
export async function saveMemory(userId: string, memory: WellsMemory): Promise<void> {
  await updateMemory(userId, {
    facts: memory.facts,
    patterns: memory.patterns,
    history: memory.history,
    recentContext: memory.recentContext,
    learnedPreferences: memory.learnedPreferences,
  })
}

/**
 * Record an interaction (increment counters, update last seen)
 */
export async function recordInteraction(
  userId: string,
  type: 'message' | 'session_start' | 'session_end' | 'deal' | 'quote'
): Promise<void> {
  try {
    await getOrCreateMemory(userId)

    let updateSql: string

    switch (type) {
      case 'message':
        updateSql = `
          UPDATE user_memory
          SET total_messages = total_messages + 1,
              total_interactions = total_interactions + 1,
              last_interaction = NOW(),
              updated_at = NOW()
          WHERE user_id = $1
        `
        break
      case 'session_start':
        updateSql = `
          UPDATE user_memory
          SET total_sessions = total_sessions + 1,
              current_streak = CASE
                WHEN last_interaction > NOW() - INTERVAL '24 hours' THEN current_streak + 1
                ELSE 1
              END,
              last_interaction = NOW(),
              updated_at = NOW()
          WHERE user_id = $1
        `
        break
      case 'session_end':
        updateSql = `
          UPDATE user_memory
          SET last_interaction = NOW(),
              updated_at = NOW()
          WHERE user_id = $1
        `
        break
      case 'deal':
        updateSql = `
          UPDATE user_memory
          SET total_interactions = total_interactions + 1,
              last_interaction = NOW(),
              updated_at = NOW()
          WHERE user_id = $1
        `
        break
      case 'quote':
        updateSql = `
          UPDATE user_memory
          SET quotes_requested = quotes_requested + 1,
              total_interactions = total_interactions + 1,
              last_interaction = NOW(),
              updated_at = NOW()
          WHERE user_id = $1
        `
        break
    }

    await query(updateSql, [userId])
  } catch (error) {
    console.error('[MemoryService] Error recording interaction:', error)
  }
}

// ============================================================================
// CONVERSATION EXTRACTION
// ============================================================================

/**
 * Extract facts and context from a conversation
 */
export async function extractFromConversation(
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  topic?: string
): Promise<ExtractedMemory> {
  const defaultExtraction: ExtractedMemory = {
    facts: [],
    entities: { people: [], companies: [], products: [], amounts: [], dates: [] },
    preferences: [],
    topics: topic ? [topic] : [],
    sentiment: 'neutral',
    actionItems: [],
    questions: [],
  }

  try {
    // Only analyze if there's meaningful content
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content)
    if (userMessages.length === 0 || userMessages.join(' ').length < 20) {
      return defaultExtraction
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Analyze this conversation and extract information about the user. Return ONLY valid JSON.

Conversation:
${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

Extract and return JSON:
{
  "facts": [
    { "key": "string (e.g., 'company', 'role', 'location')", "value": "any", "confidence": 0.0-1.0, "source": "explicit or inferred" }
  ],
  "entities": {
    "people": ["names mentioned"],
    "companies": ["companies mentioned"],
    "products": ["products/categories mentioned"],
    "amounts": [{ "value": 1000, "currency": "USD", "context": "budget for X" }],
    "dates": [{ "date": "2024-01-15", "context": "deadline for X" }]
  },
  "preferences": [
    { "type": "string (e.g., 'communication', 'pricing', 'speed')", "value": "any", "confidence": 0.0-1.0 }
  ],
  "topics": ["main topics discussed"],
  "sentiment": "positive|neutral|negative|mixed",
  "actionItems": ["things the user wants done"],
  "questions": ["open questions that should be followed up on"]
}

Be conservative with confidence scores. Only mark something 'explicit' if the user directly stated it.`,
        },
      ],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return defaultExtraction
    }

    try {
      const extracted = JSON.parse(textBlock.text) as ExtractedMemory

      // Store extracted data
      await storeExtractedMemory(userId, extracted)

      return extracted
    } catch {
      console.log('[MemoryService] Could not parse extraction response')
      return defaultExtraction
    }
  } catch (error) {
    console.error('[MemoryService] Error extracting from conversation:', error)
    return defaultExtraction
  }
}

/**
 * Store extracted memory data
 */
async function storeExtractedMemory(userId: string, extracted: ExtractedMemory): Promise<void> {
  try {
    // Store facts
    for (const fact of extracted.facts) {
      if (fact.confidence >= 0.6) {
        await sql`
          INSERT INTO memory_facts (user_id, fact_key, fact_value, confidence, source, created_at)
          VALUES (${userId}, ${fact.key}, ${JSON.stringify(fact.value)}, ${fact.confidence}, ${fact.source}, NOW())
          ON CONFLICT (user_id, fact_key) DO UPDATE SET
            fact_value = CASE WHEN EXCLUDED.confidence > memory_facts.confidence
              THEN EXCLUDED.fact_value ELSE memory_facts.fact_value END,
            confidence = GREATEST(memory_facts.confidence, EXCLUDED.confidence),
            updated_at = NOW()
        `

        // Update main memory if it's a core fact
        const coreFactMapping: Record<string, string> = {
          name: 'name',
          company: 'company',
          role: 'role',
          title: 'title',
          industry: 'industry',
          location: 'location',
          city: 'city',
          state: 'state',
          country: 'country',
          timezone: 'timezone',
        }

        if (coreFactMapping[fact.key] && fact.confidence >= 0.8) {
          await updateMemory(userId, {
            facts: { [coreFactMapping[fact.key]]: fact.value },
          })
        }
      }
    }

    // Store entity mentions
    for (const person of extracted.entities.people) {
      await sql`
        INSERT INTO memory_interactions (user_id, entity_type, entity_name, mention_count, last_mentioned)
        VALUES (${userId}, 'person', ${person}, 1, NOW())
        ON CONFLICT (user_id, entity_type, entity_name) DO UPDATE SET
          mention_count = memory_interactions.mention_count + 1,
          last_mentioned = NOW()
      `
    }

    for (const company of extracted.entities.companies) {
      await sql`
        INSERT INTO memory_interactions (user_id, entity_type, entity_name, mention_count, last_mentioned)
        VALUES (${userId}, 'company', ${company}, 1, NOW())
        ON CONFLICT (user_id, entity_type, entity_name) DO UPDATE SET
          mention_count = memory_interactions.mention_count + 1,
          last_mentioned = NOW()
      `
    }

    for (const product of extracted.entities.products) {
      await sql`
        INSERT INTO memory_interactions (user_id, entity_type, entity_name, mention_count, last_mentioned)
        VALUES (${userId}, 'product', ${product}, 1, NOW())
        ON CONFLICT (user_id, entity_type, entity_name) DO UPDATE SET
          mention_count = memory_interactions.mention_count + 1,
          last_mentioned = NOW()
      `
    }

    // Store preferences
    for (const pref of extracted.preferences) {
      if (pref.confidence >= 0.6) {
        await sql`
          INSERT INTO memory_preferences (user_id, preference_type, preference_value, confidence, created_at)
          VALUES (${userId}, ${pref.type}, ${JSON.stringify(pref.value)}, ${pref.confidence}, NOW())
          ON CONFLICT (user_id, preference_type) DO UPDATE SET
            preference_value = CASE WHEN EXCLUDED.confidence > memory_preferences.confidence
              THEN EXCLUDED.preference_value ELSE memory_preferences.preference_value END,
            confidence = GREATEST(memory_preferences.confidence, EXCLUDED.confidence),
            updated_at = NOW()
        `
      }
    }

    // Update recent context
    const memory = await getMemory(userId)
    if (memory) {
      await updateMemory(userId, {
        recentContext: {
          lastTopic: extracted.topics[0],
          lastTopicTimestamp: new Date(),
          openQuestions: [
            ...memory.recentContext.openQuestions.slice(-5),
            ...extracted.questions,
          ].slice(-10),
          sentimentTrend: extracted.sentiment === 'positive' ? 'improving' :
            extracted.sentiment === 'negative' ? 'declining' : 'stable',
        },
      })
    }
  } catch (error) {
    console.error('[MemoryService] Error storing extracted memory:', error)
  }
}

// ============================================================================
// PERSONALIZATION CONTEXT
// ============================================================================

/**
 * Get personalization context for AI prompts
 */
export async function getPersonalizationContext(userId: string): Promise<PersonalizationContext> {
  const defaultContext: PersonalizationContext = {
    greeting: 'Hello',
    tone: 'professional',
    references: {
      recentTopics: [],
      activeProjects: [],
      upcomingDates: [],
      pendingItems: [],
    },
    avoidTopics: [],
    suggestions: [],
    memoryHighlights: [],
  }

  try {
    const memory = await getMemory(userId)
    if (!memory) {
      return defaultContext
    }

    // Determine greeting
    const hour = new Date().getHours()
    let timeGreeting = 'Hello'
    if (hour >= 5 && hour < 12) timeGreeting = 'Good morning'
    else if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon'
    else if (hour >= 17 && hour < 21) timeGreeting = 'Good evening'
    else timeGreeting = 'Hey there'

    const name = memory.facts.preferredName || memory.facts.name?.split(' ')[0]
    const greeting = name ? `${timeGreeting}, ${name}` : timeGreeting

    // Determine tone based on patterns and preferences
    let tone: PersonalizationContext['tone'] = 'professional'
    if (memory.patterns.communicationStyle === 'casual') tone = 'friendly'
    else if (memory.patterns.communicationStyle === 'formal') tone = 'formal'
    else if (memory.history.trustTier === 'guardian' || memory.history.trustTier === 'trusted') tone = 'warm'

    // Build references
    const references = {
      recentTopics: memory.recentContext.conversationSummaries
        .slice(0, 3)
        .map(s => s.topic),
      activeProjects: memory.recentContext.ongoingProjects
        .filter(p => p.status === 'active')
        .map(p => p.name),
      upcomingDates: memory.recentContext.mentionedDates
        .filter(d => d.date > new Date())
        .map(d => `${d.context}: ${d.date.toLocaleDateString()}`),
      pendingItems: memory.recentContext.pendingActions
        .filter(a => !a.reminderSent)
        .map(a => a.action),
    }

    // Build memory highlights for AI context
    const memoryHighlights: string[] = []

    if (memory.facts.company) {
      memoryHighlights.push(`Works at ${memory.facts.company}`)
    }
    if (memory.facts.role) {
      memoryHighlights.push(`Role: ${memory.facts.role}`)
    }
    if (memory.facts.industry) {
      memoryHighlights.push(`Industry: ${memory.facts.industry}`)
    }
    if (memory.history.successfulDeals > 0) {
      memoryHighlights.push(`Has completed ${memory.history.successfulDeals} successful deals`)
    }
    if (memory.history.totalValueTransacted > 0) {
      memoryHighlights.push(`Total value transacted: $${memory.history.totalValueTransacted.toLocaleString()}`)
    }
    if (memory.recentContext.lastTopic) {
      memoryHighlights.push(`Last discussed: ${memory.recentContext.lastTopic}`)
    }
    if (memory.learnedPreferences.priceSensitivity !== 'medium') {
      memoryHighlights.push(`Price sensitivity: ${memory.learnedPreferences.priceSensitivity}`)
    }
    if (memory.learnedPreferences.qualityPriority !== 'medium') {
      memoryHighlights.push(`Quality priority: ${memory.learnedPreferences.qualityPriority}`)
    }
    if (memory.learnedPreferences.speedPriority !== 'medium') {
      memoryHighlights.push(`Speed priority: ${memory.learnedPreferences.speedPriority}`)
    }
    if (memory.recentContext.concerns.length > 0) {
      memoryHighlights.push(`Current concerns: ${memory.recentContext.concerns.slice(0, 2).join(', ')}`)
    }

    // Proactive suggestions based on memory
    const suggestions: string[] = []

    if (memory.recentContext.openQuestions.length > 0) {
      suggestions.push(`Follow up on: "${memory.recentContext.openQuestions[0]}"`)
    }
    if (memory.recentContext.pendingActions.filter(a => a.priority === 'high').length > 0) {
      suggestions.push('Remind about high-priority pending items')
    }
    if (memory.history.trustTier === 'new' && memory.history.totalInteractions < 5) {
      suggestions.push('Still getting to know this user - ask about their needs')
    }

    return {
      greeting,
      tone,
      references,
      avoidTopics: memory.recentContext.concerns.filter(c => c.includes('avoid')),
      suggestions,
      memoryHighlights,
    }
  } catch (error) {
    console.error('[MemoryService] Error getting personalization context:', error)
    return defaultContext
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getFactsFromDb(userId: string): Promise<Partial<UserFacts>> {
  try {
    const result = await sql`
      SELECT fact_key, fact_value, confidence
      FROM memory_facts
      WHERE user_id = ${userId} AND confidence >= 0.7
      ORDER BY confidence DESC
    `

    const facts: Partial<UserFacts> = {}
    for (const row of result.rows) {
      const value = typeof row.fact_value === 'string' ? JSON.parse(row.fact_value) : row.fact_value
      facts[row.fact_key as keyof UserFacts] = value
    }

    return facts
  } catch {
    return {}
  }
}

async function getInteractionHistory(userId: string): Promise<Partial<RelationshipHistory>> {
  try {
    const result = await sql`
      SELECT
        SUM(CASE WHEN entity_type = 'deal' AND metadata->>'outcome' = 'success' THEN 1 ELSE 0 END) as successful_deals,
        SUM(CASE WHEN entity_type = 'deal' AND metadata->>'outcome' = 'failed' THEN 1 ELSE 0 END) as failed_deals,
        SUM(CASE WHEN entity_type = 'deal' THEN (metadata->>'value')::decimal ELSE 0 END) as total_value
      FROM memory_interactions
      WHERE user_id = ${userId}
    `

    if (result.rows.length === 0) return {}

    return {
      successfulDeals: parseInt(result.rows[0].successful_deals) || 0,
      failedDeals: parseInt(result.rows[0].failed_deals) || 0,
      totalValueTransacted: parseFloat(result.rows[0].total_value) || 0,
    }
  } catch {
    return {}
  }
}

async function getPreferencesFromDb(userId: string): Promise<Partial<LearnedPreferences>> {
  try {
    const result = await sql`
      SELECT preference_type, preference_value, confidence
      FROM memory_preferences
      WHERE user_id = ${userId} AND confidence >= 0.6
      ORDER BY confidence DESC
    `

    const prefs: Partial<LearnedPreferences> = {}
    for (const row of result.rows) {
      const value = typeof row.preference_value === 'string' ? JSON.parse(row.preference_value) : row.preference_value
      prefs[row.preference_type as keyof LearnedPreferences] = value
    }

    return prefs
  } catch {
    return {}
  }
}

async function getRecentMentions(userId: string): Promise<{
  people: RecentContext['mentionedPeople']
  companies: RecentContext['mentionedCompanies']
  products: RecentContext['mentionedProducts']
  amounts: RecentContext['mentionedAmounts']
  dates: RecentContext['mentionedDates']
}> {
  try {
    const result = await sql`
      SELECT entity_type, entity_name, mention_count, last_mentioned, metadata
      FROM memory_interactions
      WHERE user_id = ${userId}
        AND last_mentioned > NOW() - INTERVAL '30 days'
      ORDER BY last_mentioned DESC
      LIMIT 50
    `

    const people: RecentContext['mentionedPeople'] = []
    const companies: RecentContext['mentionedCompanies'] = []
    const products: RecentContext['mentionedProducts'] = []

    for (const row of result.rows) {
      const mention = {
        name: row.entity_name,
        context: row.metadata?.context,
        mentionCount: row.mention_count,
        lastMentioned: new Date(row.last_mentioned),
        sentiment: row.metadata?.sentiment,
        metadata: row.metadata,
      }

      if (row.entity_type === 'person') people.push(mention)
      else if (row.entity_type === 'company') companies.push(mention)
      else if (row.entity_type === 'product') products.push(mention)
    }

    return {
      people,
      companies,
      products,
      amounts: [],
      dates: [],
    }
  } catch {
    return { people: [], companies: [], products: [], amounts: [], dates: [] }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const MemoryService = {
  getMemory,
  getOrCreateMemory,
  createMemory,
  updateMemory,
  saveMemory,
  recordInteraction,
  extractFromConversation,
  getPersonalizationContext,
}

export default MemoryService
