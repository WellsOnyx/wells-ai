/**
 * Unified Inbox Types
 * For AI-to-AI communication and message reception
 */

export type MessageChannel = 'email' | 'sms' | 'slack' | 'discord' | 'teams' | 'whatsapp' | 'gchat'

export type MessageIntent =
  | 'ask_question'
  | 'request_meeting'
  | 'provide_info'
  | 'negotiate'
  | 'follow_up'
  | 'introduction'
  | 'thank_you'
  | 'complaint'
  | 'urgent_request'
  | 'auto_reply'
  | 'spam'
  | 'unknown'

export type MessageUrgency = 'low' | 'normal' | 'high' | 'critical'

export type MessageSentiment = 'positive' | 'neutral' | 'negative'

export interface InboundMessage {
  id: string
  userId: string

  // Channel
  channel: MessageChannel
  channelMessageId?: string

  // Sender
  senderId?: string
  senderName?: string
  senderEmail?: string
  senderPhone?: string
  senderMetadata?: Record<string, any>

  // Content
  subject?: string
  body: string
  htmlBody?: string
  attachments?: MessageAttachment[]

  // Threading
  threadId?: string
  internalThreadId?: string
  parentMessageId?: string
  isThreadStart: boolean

  // AI Understanding
  intent?: MessageIntent
  urgency: MessageUrgency
  sentiment?: MessageSentiment
  entities?: Record<string, any>
  actionItems?: ActionItem[]
  requiresResponse: boolean
  suggestedResponse?: string

  // Processing
  processedAt?: Date
  respondedAt?: Date
  responseMessageId?: string

  // Raw
  rawPayload?: Record<string, any>
  headers?: Record<string, any>

  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface MessageAttachment {
  id: string
  filename: string
  contentType: string
  sizeBytes: number
  storageUrl: string
  storageKey?: string
  extractedText?: string
  aiSummary?: string
}

export interface ActionItem {
  type: 'task' | 'deadline' | 'question' | 'decision'
  description: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  assignee?: string
}

export interface MessageThread {
  id: string
  userId: string

  channel: MessageChannel
  platformThreadId?: string

  subject?: string
  participants: Participant[]
  messageCount: number

  status: 'active' | 'archived' | 'closed'
  lastMessageAt?: Date

  threadSummary?: string
  threadContext?: Record<string, any>

  createdAt: Date
  updatedAt: Date
}

export interface Participant {
  id?: string
  name?: string
  email?: string
  phone?: string
  role?: string
}

export interface OutboundMessage {
  id: string
  userId: string

  inReplyTo?: string
  threadId?: string

  channel: MessageChannel
  recipientId?: string
  recipientEmail?: string
  recipientPhone?: string

  subject?: string
  body: string
  htmlBody?: string
  attachments?: MessageAttachment[]

  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'failed'
  approvedBy?: string
  approvedAt?: Date
  sentAt?: Date
  deliveredAt?: Date
  readAt?: Date

  platformMessageId?: string
  platformResponse?: Record<string, any>
  errorMessage?: string

  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface Contact {
  id: string
  userId: string

  name?: string
  email?: string
  phone?: string
  company?: string
  role?: string

  slackUserId?: string
  discordUserId?: string
  teamsUserId?: string
  linkedinUrl?: string

  relationshipType?: string
  importanceScore: number
  firstContactDate?: Date
  lastContactDate?: Date

  totalMessagesReceived: number
  totalMessagesSent: number
  avgResponseTimeMinutes?: number
  preferredChannel?: MessageChannel

  communicationStyle?: string
  topicsDiscussed?: string[]
  relationshipNotes?: string

  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface AutoResponseRule {
  id: string
  userId: string

  name: string
  enabled: boolean
  priority: number

  // Filters
  channelFilter?: MessageChannel
  senderFilter?: string
  intentFilter?: MessageIntent
  urgencyFilter?: MessageUrgency
  keywordFilters?: string[]
  timeWindow?: {
    days?: string[]
    hours?: number[]
  }

  // Action
  actionType: 'auto_respond' | 'notify_only' | 'forward' | 'ignore'
  responseTemplate?: string
  forwardTo?: string

  requireApproval: boolean
  cooldownHours: number

  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface WebhookEvent {
  id: string
  source: string
  eventType: string
  eventId?: string

  signature?: string
  signatureValid?: boolean

  rawPayload: Record<string, any>
  headers?: Record<string, any>

  processed: boolean
  processedAt?: Date
  errorMessage?: string
  createdMessageId?: string

  createdAt: Date
}

// Message understanding result from Claude
export interface MessageUnderstanding {
  intent: MessageIntent
  urgency: MessageUrgency
  sentiment: MessageSentiment
  entities: Record<string, any>
  actionItems: ActionItem[]
  requiresResponse: boolean
  suggestedResponse?: string
  summary: string
  keyTopics: string[]
}

// Inbox query filters
export interface InboxFilters {
  channel?: MessageChannel
  sender?: string
  intent?: MessageIntent
  urgency?: MessageUrgency
  requiresResponse?: boolean
  unprocessedOnly?: boolean
  dateFrom?: Date
  dateTo?: Date
  searchQuery?: string
}
