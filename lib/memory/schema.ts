// @ts-nocheck
/**
 * Wells Memory Schema
 *
 * "I will remember my covenant between me and you."
 * - Genesis 9:15
 *
 * The complete schema for Wells' memory system.
 * Wells remembers EVERYTHING and uses it to personalize the experience.
 */

// ============================================================================
// CORE MEMORY INTERFACE
// ============================================================================

export interface WellsMemory {
  userId: string

  // ========================================================================
  // EXPLICIT FACTS (user told us directly)
  // ========================================================================
  facts: UserFacts

  // ========================================================================
  // BEHAVIORAL PATTERNS (observed over time)
  // ========================================================================
  patterns: BehavioralPatterns

  // ========================================================================
  // RELATIONSHIP HISTORY
  // ========================================================================
  history: RelationshipHistory

  // ========================================================================
  // CONTEXTUAL MEMORY (recent / short-term)
  // ========================================================================
  recentContext: RecentContext

  // ========================================================================
  // LEARNED PREFERENCES (inferred from behavior)
  // ========================================================================
  learnedPreferences: LearnedPreferences

  // ========================================================================
  // METADATA
  // ========================================================================
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// USER FACTS (Explicit Information)
// ============================================================================

export interface UserFacts {
  // Identity
  name?: string
  preferredName?: string  // What they like to be called
  email?: string
  phone?: string
  avatar?: string

  // Professional
  company?: string
  role?: string
  title?: string
  industry?: string
  companySize?: 'solo' | 'startup' | 'small' | 'medium' | 'enterprise'
  department?: string

  // Location & Time
  location?: string
  city?: string
  state?: string
  country?: string
  timezone?: string

  // Custom preferences (flexible key-value store)
  preferences: Record<string, any>

  // Tags for categorization
  tags: string[]
}

// ============================================================================
// BEHAVIORAL PATTERNS (Observed)
// ============================================================================

export interface BehavioralPatterns {
  // When they're active
  activeHours?: {
    start: number  // 0-23
    end: number    // 0-23
    timezone: string
  }

  // Peak activity days
  activeDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[]

  // How fast they respond
  responseSpeed: 'instant' | 'quick' | 'thoughtful' | 'slow' | 'varies'
  averageResponseTimeMinutes?: number

  // Communication style
  communicationStyle: 'formal' | 'casual' | 'mixed' | 'adaptive'
  messageLength: 'brief' | 'moderate' | 'detailed' | 'varies'
  usesEmoji: boolean

  // Decision making
  decisionStyle: 'quick' | 'deliberate' | 'consensus' | 'data-driven'
  averageDecisionTimeHours?: number

  // Engagement patterns
  sessionDuration: 'short' | 'medium' | 'long' | 'varies'
  averageSessionMinutes?: number

  // Feature usage
  frequentlyUsedFeatures: string[]
  rarelyUsedFeatures: string[]

  // Time since last activity indicators
  typicalAbsenceHours?: number

  // Mood patterns (if detectable)
  typicalMood?: 'optimistic' | 'neutral' | 'stressed' | 'focused'
}

// ============================================================================
// RELATIONSHIP HISTORY
// ============================================================================

export interface RelationshipHistory {
  // First contact
  firstContact: Date
  firstInteractionSummary?: string

  // Engagement metrics
  totalInteractions: number
  totalMessages: number
  totalSessions: number

  // Business metrics
  successfulDeals: number
  failedDeals: number
  totalValueTransacted: number
  averageDealValue?: number

  // Quotes and RFQs
  quotesRequested: number
  quotesAccepted: number
  quoteConversionRate?: number

  // Time metrics
  lastInteraction: Date
  longestStreak?: number  // days of consecutive usage
  currentStreak?: number

  // Trust indicators
  trustScore: number  // 0-100
  trustTier: 'new' | 'developing' | 'established' | 'trusted' | 'guardian'

  // Milestones achieved
  milestones: Milestone[]

  // Referrals
  referralsMade: number
  referralsReceived: number
}

export interface Milestone {
  id: string
  title: string
  description: string
  achievedAt: Date
  celebrated: boolean
  celebrationMessage?: string
}

// ============================================================================
// RECENT CONTEXT (Short-term Memory)
// ============================================================================

export interface RecentContext {
  // Last conversation topic
  lastTopic?: string
  lastTopicTimestamp?: Date

  // Ongoing projects/deals
  ongoingProjects: ProjectContext[]

  // Pending actions
  pendingActions: PendingAction[]

  // People mentioned recently
  mentionedPeople: EntityMention[]

  // Companies mentioned recently
  mentionedCompanies: EntityMention[]

  // Products/categories discussed
  mentionedProducts: EntityMention[]

  // Numbers/amounts discussed
  mentionedAmounts: AmountMention[]

  // Dates discussed
  mentionedDates: DateMention[]

  // Open questions Wells should follow up on
  openQuestions: string[]

  // Promises Wells made
  promises: Promise[]

  // User frustrations or concerns
  concerns: string[]

  // Recent sentiment trend
  sentimentTrend: 'improving' | 'stable' | 'declining'

  // Last N conversation summaries
  conversationSummaries: ConversationSummary[]
}

export interface ProjectContext {
  id: string
  name: string
  type: 'deal' | 'rfq' | 'negotiation' | 'job' | 'custom'
  status: 'active' | 'pending' | 'completed' | 'stalled'
  lastUpdate: Date
  nextSteps?: string[]
  blockers?: string[]
}

export interface PendingAction {
  id: string
  action: string
  dueDate?: Date
  priority: 'critical' | 'high' | 'medium' | 'low'
  relatedTo?: string  // project ID or topic
  reminderSent: boolean
}

export interface EntityMention {
  name: string
  context?: string
  mentionCount: number
  lastMentioned: Date
  sentiment?: 'positive' | 'neutral' | 'negative'
  metadata?: Record<string, any>
}

export interface AmountMention {
  amount: number
  currency: string
  context: string
  timestamp: Date
}

export interface DateMention {
  date: Date
  context: string
  importance: 'deadline' | 'milestone' | 'meeting' | 'reminder'
  timestamp: Date
}

export interface Promise {
  id: string
  promise: string
  madeAt: Date
  dueBy?: Date
  fulfilled: boolean
  fulfilledAt?: Date
}

export interface ConversationSummary {
  id: string
  date: Date
  topic: string
  summary: string
  keyTakeaways: string[]
  actionItems: string[]
  userSentiment: 'positive' | 'neutral' | 'frustrated' | 'confused'
}

// ============================================================================
// LEARNED PREFERENCES (Inferred)
// ============================================================================

export interface LearnedPreferences {
  // Supplier preferences
  preferredSuppliers?: SupplierPreference[]
  avoidSuppliers?: SupplierPreference[]

  // Category preferences
  preferredCategories?: string[]

  // Price sensitivity
  priceSensitivity: 'very_high' | 'high' | 'medium' | 'low' | 'price_not_priority'
  maxAcceptablePremium?: number  // percentage above market

  // Quality priority
  qualityPriority: 'critical' | 'high' | 'medium' | 'low' | 'flexible'
  qualityIndicators?: string[]  // what they care about

  // Speed priority
  speedPriority: 'critical' | 'high' | 'medium' | 'low' | 'flexible'
  typicalLeadTimeRequirement?: string

  // Communication preferences
  preferredContactMethod: 'email' | 'sms' | 'in-app' | 'phone' | 'any'
  preferredContactTimes?: string[]  // e.g., ['morning', 'afternoon']
  dontDisturbHours?: { start: number, end: number }

  // Notification preferences
  notificationFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly'
  notificationTypes: {
    deals: boolean
    quotes: boolean
    reminders: boolean
    insights: boolean
    celebrations: boolean
  }

  // Content preferences
  contentDetail: 'summary' | 'balanced' | 'detailed'
  wantsAlternatives: boolean
  wantsExplanations: boolean
  wantsProactiveInsights: boolean

  // Payment preferences
  preferredPaymentTerms?: string[]  // e.g., ['Net 30', 'Net 45']
  preferredPaymentMethods?: string[]

  // Negotiation style
  negotiationStyle?: 'aggressive' | 'collaborative' | 'analytical' | 'relationship-focused'

  // Risk tolerance
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'

  // Brand preferences
  brandPreferences?: {
    preferred: string[]
    avoided: string[]
  }
}

export interface SupplierPreference {
  supplierId: string
  name: string
  reason?: string
  lastInteraction?: Date
  rating?: number
}

// ============================================================================
// MEMORY UPDATE TYPES
// ============================================================================

export interface MemoryUpdate {
  userId: string
  updateType: 'facts' | 'patterns' | 'history' | 'context' | 'preferences'
  data: Partial<UserFacts | BehavioralPatterns | RelationshipHistory | RecentContext | LearnedPreferences>
  source: 'explicit' | 'inferred' | 'system'
  confidence: number  // 0-1
  timestamp: Date
}

// ============================================================================
// MEMORY EXTRACTION TYPES
// ============================================================================

export interface ExtractedMemory {
  // Facts extracted
  facts: Array<{
    key: string
    value: any
    confidence: number
    source: string
  }>

  // Entities mentioned
  entities: {
    people: string[]
    companies: string[]
    products: string[]
    amounts: Array<{ value: number, currency: string, context: string }>
    dates: Array<{ date: string, context: string }>
  }

  // Preferences detected
  preferences: Array<{
    type: string
    value: any
    confidence: number
  }>

  // Topics discussed
  topics: string[]

  // Sentiment
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'

  // Action items
  actionItems: string[]

  // Open questions
  questions: string[]
}

// ============================================================================
// PERSONALIZATION CONTEXT
// ============================================================================

export interface PersonalizationContext {
  // User greeting
  greeting: string

  // Tone to use
  tone: 'formal' | 'professional' | 'friendly' | 'casual' | 'warm'

  // Things to reference
  references: {
    recentTopics: string[]
    activeProjects: string[]
    upcomingDates: string[]
    pendingItems: string[]
  }

  // Things to avoid
  avoidTopics: string[]

  // Proactive suggestions
  suggestions: string[]

  // Memory highlights for AI context
  memoryHighlights: string[]
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createEmptyMemory(userId: string): WellsMemory {
  const now = new Date()

  return {
    userId,

    facts: {
      preferences: {},
      tags: [],
    },

    patterns: {
      responseSpeed: 'varies',
      communicationStyle: 'mixed',
      messageLength: 'varies',
      usesEmoji: false,
      decisionStyle: 'deliberate',
      sessionDuration: 'varies',
      frequentlyUsedFeatures: [],
      rarelyUsedFeatures: [],
    },

    history: {
      firstContact: now,
      totalInteractions: 0,
      totalMessages: 0,
      totalSessions: 0,
      successfulDeals: 0,
      failedDeals: 0,
      totalValueTransacted: 0,
      quotesRequested: 0,
      quotesAccepted: 0,
      lastInteraction: now,
      trustScore: 0,
      trustTier: 'new',
      milestones: [],
      referralsMade: 0,
      referralsReceived: 0,
    },

    recentContext: {
      ongoingProjects: [],
      pendingActions: [],
      mentionedPeople: [],
      mentionedCompanies: [],
      mentionedProducts: [],
      mentionedAmounts: [],
      mentionedDates: [],
      openQuestions: [],
      promises: [],
      concerns: [],
      sentimentTrend: 'stable',
      conversationSummaries: [],
    },

    learnedPreferences: {
      priceSensitivity: 'medium',
      qualityPriority: 'medium',
      speedPriority: 'medium',
      preferredContactMethod: 'in-app',
      notificationFrequency: 'daily',
      notificationTypes: {
        deals: true,
        quotes: true,
        reminders: true,
        insights: true,
        celebrations: true,
      },
      contentDetail: 'balanced',
      wantsAlternatives: true,
      wantsExplanations: true,
      wantsProactiveInsights: true,
      riskTolerance: 'moderate',
    },

    createdAt: now,
    updatedAt: now,
  }
}

export function calculateTrustTier(history: RelationshipHistory): RelationshipHistory['trustTier'] {
  const { totalInteractions, successfulDeals, totalValueTransacted, trustScore } = history

  // Calculate based on multiple factors
  if (trustScore >= 90 || (successfulDeals >= 10 && totalValueTransacted >= 100000)) {
    return 'guardian'
  }

  if (trustScore >= 70 || (successfulDeals >= 5 && totalValueTransacted >= 25000)) {
    return 'trusted'
  }

  if (trustScore >= 50 || (successfulDeals >= 2 && totalInteractions >= 20)) {
    return 'established'
  }

  if (totalInteractions >= 5) {
    return 'developing'
  }

  return 'new'
}

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function hoursSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60))
}
