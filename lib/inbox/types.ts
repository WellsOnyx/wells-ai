// Unified Inbox Types
// Supports all messaging channels in one unified interface

export enum InboxProvider {
  Gmail = 'gmail',
  SMS = 'sms',
  LinkedIn = 'linkedin',
  X = 'x',
  Instagram = 'instagram',
  iMessage = 'imessage',
  Wells = 'wells',
}

export enum MessageDirection {
  Inbound = 'inbound',
  Outbound = 'outbound',
}

export enum AIPriority {
  Urgent = 'urgent',
  Important = 'important',
  Normal = 'normal',
  Low = 'low',
}

export enum AICategory {
  Deals = 'deals',
  Recruiting = 'recruiting',
  Support = 'support',
  Newsletter = 'newsletter',
  Personal = 'personal',
  Marketing = 'marketing',
  Spam = 'spam',
}

export enum AISentiment {
  Positive = 'positive',
  Neutral = 'neutral',
  Negative = 'negative',
  Urgent = 'urgent',
}

export enum ReminderType {
  FollowUp = 'follow_up',
  NoResponse = 'no_response',
  Custom = 'custom',
}

export enum SyncStatus {
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

// Connected account (Gmail, LinkedIn, X, etc.)
export interface InboxAccount {
  id: string;
  userId: string;
  provider: InboxProvider;
  email?: string;
  phone?: string;
  handle?: string;
  displayName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  lastSyncAt?: Date;
  syncCursor?: string;
  settings: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Unified contact across all channels
export interface InboxContact {
  id: string;
  userId: string;
  email?: string;
  phone?: string;
  name?: string;
  company?: string;
  avatarUrl?: string;
  linkedinUrl?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  tags: string[];
  vip: boolean;
  lastContactedAt?: Date;
  contactCount: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Conversation thread
export interface InboxThread {
  id: string;
  userId: string;
  accountId: string;
  provider: InboxProvider;
  externalThreadId?: string;
  subject?: string;
  snippet?: string;
  participants: InboxParticipant[];
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isSnoozed: boolean;
  snoozeUntil?: Date;
  aiSummary?: string;
  aiPriority?: AIPriority;
  aiCategory?: AICategory;
  aiSuggestedAction?: string;
  messageCount: number;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Thread participant
export interface InboxParticipant {
  id?: string;
  email?: string;
  phone?: string;
  name?: string;
  avatarUrl?: string;
}

// Individual message
export interface InboxMessage {
  id: string;
  threadId: string;
  accountId: string;
  userId: string;
  provider: InboxProvider;
  externalMessageId?: string;
  direction: MessageDirection;
  fromAddress?: string;
  fromName?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments: InboxAttachment[];
  isRead: boolean;
  isStarred: boolean;
  aiSummary?: string;
  aiSentiment?: AISentiment;
  aiEntities?: AIExtractedEntity[];
  aiSuggestedReply?: string;
  sentAt?: Date;
  receivedAt?: Date;
  createdAt: Date;
}

// Message attachment
export interface InboxAttachment {
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

// AI-extracted entities from messages
export interface AIExtractedEntity {
  type: 'date' | 'amount' | 'person' | 'company' | 'location' | 'phone' | 'email';
  value: string;
  confidence: number;
}

// Draft message
export interface InboxDraft {
  id: string;
  userId: string;
  accountId: string;
  threadId?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments: InboxAttachment[];
  aiGenerated: boolean;
  scheduledFor?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Snooze entry
export interface InboxSnooze {
  id: string;
  userId: string;
  threadId: string;
  snoozeUntil: Date;
  reason?: string;
  createdAt: Date;
}

// Reminder/follow-up
export interface InboxReminder {
  id: string;
  userId: string;
  threadId: string;
  messageId?: string;
  remindAt: Date;
  reminderType: ReminderType;
  note?: string;
  isCompleted: boolean;
  completedAt?: Date;
  createdAt: Date;
}

// Smart filter rule
export interface InboxRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  conditions: InboxRuleConditions;
  actions: InboxRuleActions;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InboxRuleConditions {
  from?: string[];
  to?: string[];
  subjectContains?: string[];
  bodyContains?: string[];
  hasAttachment?: boolean;
  provider?: InboxProvider[];
  aiCategory?: AICategory[];
  aiPriority?: AIPriority[];
  aiSentiment?: AISentiment[];
}

export interface InboxRuleActions {
  labels?: string[];
  archive?: boolean;
  markRead?: boolean;
  star?: boolean;
  important?: boolean;
  forwardTo?: string;
  autoReply?: string;
  snoozeHours?: number;
  delete?: boolean;
}

// Sync log entry
export interface InboxSyncLog {
  id: string;
  accountId: string;
  provider: InboxProvider;
  syncStartedAt: Date;
  syncCompletedAt?: Date;
  status: SyncStatus;
  messagesSynced: number;
  errorMessage?: string;
  createdAt: Date;
}

// API request/response types

export interface GetThreadsRequest {
  userId: string;
  accountId?: string;
  provider?: InboxProvider;
  labels?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  aiCategory?: AICategory;
  aiPriority?: AIPriority;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GetThreadsResponse {
  threads: InboxThread[];
  total: number;
  hasMore: boolean;
}

export interface GetThreadRequest {
  threadId: string;
  userId: string;
}

export interface GetThreadResponse {
  thread: InboxThread;
  messages: InboxMessage[];
  contact?: InboxContact;
}

export interface SearchMessagesRequest {
  userId: string;
  query: string;
  provider?: InboxProvider;
  dateFrom?: Date;
  dateTo?: Date;
  hasAttachment?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchMessagesResponse {
  messages: InboxMessage[];
  threads: InboxThread[];
  total: number;
}

export interface MarkAsReadRequest {
  threadIds: string[];
  userId: string;
  isRead: boolean;
}

export interface StarThreadRequest {
  threadIds: string[];
  userId: string;
  isStarred: boolean;
}

export interface ArchiveThreadRequest {
  threadIds: string[];
  userId: string;
}

export interface SnoozeThreadRequest {
  threadId: string;
  userId: string;
  snoozeUntil: Date;
  reason?: string;
}

export interface AddReminderRequest {
  threadId: string;
  messageId?: string;
  userId: string;
  remindAt: Date;
  reminderType: ReminderType;
  note?: string;
}

export interface GenerateAISummaryRequest {
  threadId: string;
  userId: string;
}

export interface GenerateAISummaryResponse {
  summary: string;
  priority: AIPriority;
  category: AICategory;
  suggestedAction?: string;
  entities: AIExtractedEntity[];
}

export interface SuggestReplyRequest {
  messageId: string;
  userId: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'formal';
  length?: 'short' | 'medium' | 'long';
}

export interface SuggestReplyResponse {
  suggestedReply: string;
  alternativeReplies: string[];
}

export interface SendMessageRequest {
  userId: string;
  accountId: string;
  threadId?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: InboxAttachment[];
}

export interface SendMessageResponse {
  messageId: string;
  threadId: string;
  success: boolean;
}

// Provider-specific sync cursors
export interface GmailSyncCursor {
  historyId: string;
  pageToken?: string;
}

export interface LinkedInSyncCursor {
  lastMessageId: string;
  lastTimestamp: number;
}

export interface XSyncCursor {
  lastMessageId: string;
  cursor?: string;
}

export interface InstagramSyncCursor {
  cursor: string;
  lastTimestamp: number;
}
