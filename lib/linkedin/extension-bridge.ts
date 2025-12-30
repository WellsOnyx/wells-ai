// @ts-nocheck
/**
 * LinkedIn Extension Bridge
 *
 * Defines the communication protocol between WellsAI and a
 * potential browser extension that could:
 * - Read messages from the queue
 * - Auto-fill LinkedIn message boxes
 * - Report success/failure
 * - Track responses
 *
 * This is the ARCHITECTURE for a future extension.
 * The extension itself would be a separate project.
 */

import { QueuedMessage, QueuedMessageStatus } from './send-queue'
import { LinkedInProfile } from './profile-service'

// ============================================================================
// MESSAGE PROTOCOL
// ============================================================================

/**
 * Message types from extension to WellsAI
 */
export type ExtensionToWellsMessageType =
  | 'EXTENSION_READY'          // Extension loaded and ready
  | 'EXTENSION_AUTHENTICATED'  // User authenticated with extension
  | 'QUEUE_REQUEST'            // Request next messages
  | 'MESSAGE_COPIED'           // User copied a message
  | 'MESSAGE_SENT'             // User sent a message on LinkedIn
  | 'MESSAGE_FAILED'           // Sending failed
  | 'RESPONSE_DETECTED'        // Extension detected a response
  | 'CONNECTION_ACCEPTED'      // Connection request accepted
  | 'CONNECTION_DECLINED'      // Connection request declined
  | 'PROFILE_DATA'             // Extension scraped profile data
  | 'RATE_LIMIT_WARNING'       // LinkedIn showing rate limit warnings
  | 'ERROR'                    // General error

/**
 * Message types from WellsAI to extension
 */
export type WellsToExtensionMessageType =
  | 'QUEUE_MESSAGES'           // Batch of messages to send
  | 'MESSAGE_UPDATE'           // Update to a specific message
  | 'SETTINGS_UPDATE'          // Update extension settings
  | 'PAUSE_SENDING'            // Pause all sending
  | 'RESUME_SENDING'           // Resume sending
  | 'REQUEST_PROFILE'          // Request profile data from page
  | 'ACKNOWLEDGE'              // Acknowledge received message

/**
 * Base message structure
 */
export interface ExtensionMessage<T extends string, P = any> {
  type: T
  payload: P
  timestamp: number
  messageId: string
  version: string // Protocol version
}

// ============================================================================
// PAYLOADS - Extension to Wells
// ============================================================================

export interface ExtensionReadyPayload {
  extensionVersion: string
  browserInfo: {
    name: string
    version: string
  }
  capabilities: string[]
}

export interface ExtensionAuthenticatedPayload {
  userId: string
  accessToken: string // Temporary token for API access
}

export interface QueueRequestPayload {
  maxMessages: number
  messageTypes?: string[]
  priority?: number
}

export interface MessageCopiedPayload {
  queueMessageId: string
  copiedAt: number
}

export interface MessageSentPayload {
  queueMessageId: string
  sentAt: number
  linkedinMessageId?: string // If we can capture it
  method: 'manual' | 'auto_fill' | 'extension_send'
}

export interface MessageFailedPayload {
  queueMessageId: string
  error: string
  errorCode?: string
  retryable: boolean
}

export interface ResponseDetectedPayload {
  queueMessageId?: string // If we can match it
  profileUrl: string
  responsePreview: string // First ~100 chars
  responseType: 'message' | 'connection_accept' | 'inmail_reply'
  detectedAt: number
}

export interface ConnectionStatusPayload {
  profileUrl: string
  queueMessageId?: string
  status: 'accepted' | 'declined' | 'pending'
}

export interface ProfileDataPayload {
  linkedinUrl: string
  rawHtml?: string // For parsing
  parsedData: Partial<LinkedInProfile>
  source: 'page_scrape' | 'api_intercept'
}

export interface RateLimitWarningPayload {
  warningType: 'connection_limit' | 'message_limit' | 'search_limit'
  message: string
  cooldownMinutes?: number
}

export interface ExtensionErrorPayload {
  error: string
  context?: string
  stack?: string
  recoverable: boolean
}

// ============================================================================
// PAYLOADS - Wells to Extension
// ============================================================================

export interface QueueMessagesPayload {
  messages: Array<{
    id: string
    profileUrl: string
    recipientName: string
    messageType: string
    content: string
    subject?: string
    priority: number
    instructions?: string
  }>
  totalInQueue: number
}

export interface MessageUpdatePayload {
  messageId: string
  updates: Partial<{
    content: string
    status: QueuedMessageStatus
    priority: number
  }>
}

export interface ExtensionSettingsPayload {
  autoFillEnabled: boolean
  autoSendEnabled: boolean // Very dangerous - likely always false
  sendDelay: number // Seconds between sends
  maxDailyMessages: number
  workingHoursOnly: boolean
  workingHours?: {
    start: number // Hour 0-23
    end: number
    timezone: string
  }
  pauseOnRateLimit: boolean
}

// ============================================================================
// EXTENSION STATE
// ============================================================================

export interface ExtensionState {
  isConnected: boolean
  isAuthenticated: boolean
  isPaused: boolean
  currentPage: 'unknown' | 'feed' | 'profile' | 'messaging' | 'search' | 'other'
  currentProfileUrl?: string
  lastActivity: number
  messagesInProgress: string[]
  settings: ExtensionSettingsPayload
  stats: {
    messagesSentToday: number
    connectionsToday: number
    errorsToday: number
    lastRateLimitWarning?: number
  }
}

// ============================================================================
// API ENDPOINTS (for extension to call)
// ============================================================================

/**
 * API routes the extension would call
 */
export const EXTENSION_API_ROUTES = {
  // Authentication
  authenticate: '/api/linkedin/extension/auth',
  refreshToken: '/api/linkedin/extension/refresh',

  // Queue operations
  getQueue: '/api/linkedin/extension/queue',
  updateMessage: '/api/linkedin/extension/message/:id',
  reportSent: '/api/linkedin/extension/message/:id/sent',
  reportFailed: '/api/linkedin/extension/message/:id/failed',
  reportResponse: '/api/linkedin/extension/message/:id/response',

  // Profile operations
  submitProfile: '/api/linkedin/extension/profile',

  // Settings
  getSettings: '/api/linkedin/extension/settings',
  updateSettings: '/api/linkedin/extension/settings',

  // Status
  ping: '/api/linkedin/extension/ping',
  reportError: '/api/linkedin/extension/error'
}

// ============================================================================
// MESSAGE BUILDERS
// ============================================================================

/**
 * Create a message for sending to the extension
 */
export function createWellsToExtensionMessage<T extends WellsToExtensionMessageType>(
  type: T,
  payload: any
): ExtensionMessage<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
    messageId: `wells_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    version: '1.0.0'
  }
}

/**
 * Validate an incoming extension message
 */
export function validateExtensionMessage(
  message: any
): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Invalid message format' }
  }

  if (!message.type || typeof message.type !== 'string') {
    return { valid: false, error: 'Missing message type' }
  }

  if (!message.timestamp || typeof message.timestamp !== 'number') {
    return { valid: false, error: 'Missing timestamp' }
  }

  if (!message.messageId || typeof message.messageId !== 'string') {
    return { valid: false, error: 'Missing message ID' }
  }

  if (!message.version || typeof message.version !== 'string') {
    return { valid: false, error: 'Missing version' }
  }

  // Check if message is too old (5 minutes)
  if (Date.now() - message.timestamp > 5 * 60 * 1000) {
    return { valid: false, error: 'Message expired' }
  }

  return { valid: true }
}

// ============================================================================
// QUEUE FORMATTING FOR EXTENSION
// ============================================================================

/**
 * Format queued messages for extension consumption
 */
export function formatQueueForExtension(
  messages: QueuedMessage[]
): QueueMessagesPayload['messages'] {
  return messages.map(m => ({
    id: m.id,
    profileUrl: m.linkedinUrl,
    recipientName: m.recipientName,
    messageType: m.messageType,
    content: m.content,
    subject: m.subject,
    priority: m.priority,
    instructions: getAutoFillInstructions(m.messageType, m.linkedinUrl)
  }))
}

/**
 * Get DOM selectors and instructions for auto-fill
 */
function getAutoFillInstructions(
  messageType: string,
  profileUrl: string
): string {
  // These would be JSON instructions for the extension
  const instructions: Record<string, any> = {
    connection_request: {
      steps: [
        { action: 'navigate', url: profileUrl },
        { action: 'click', selector: 'button[aria-label*="Connect"]' },
        { action: 'wait', milliseconds: 500 },
        { action: 'click', selector: 'button[aria-label*="Add a note"]' },
        { action: 'fill', selector: 'textarea[name="message"]', field: 'content' },
        { action: 'click', selector: 'button[aria-label*="Send"]' }
      ]
    },
    direct_message: {
      steps: [
        { action: 'navigate', url: 'https://www.linkedin.com/messaging/' },
        { action: 'search', query: 'recipientName' },
        { action: 'fill', selector: 'div[role="textbox"]', field: 'content' },
        { action: 'click', selector: 'button[type="submit"]' }
      ]
    }
  }

  return JSON.stringify(instructions[messageType] || {})
}

// ============================================================================
// SECURITY
// ============================================================================

/**
 * Generate a secure token for extension authentication
 */
export function generateExtensionToken(
  userId: string,
  expiresInMinutes: number = 60
): { token: string; expiresAt: number } {
  // In production, this would use proper JWT or similar
  const expiresAt = Date.now() + (expiresInMinutes * 60 * 1000)
  const payload = {
    userId,
    expiresAt,
    scope: 'extension',
    nonce: Math.random().toString(36).substring(7)
  }

  // In production: jwt.sign(payload, secret)
  const token = Buffer.from(JSON.stringify(payload)).toString('base64')

  return { token, expiresAt }
}

/**
 * Validate an extension token
 */
export function validateExtensionToken(
  token: string
): { valid: boolean; userId?: string; error?: string } {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString())

    if (!payload.userId || !payload.expiresAt) {
      return { valid: false, error: 'Invalid token structure' }
    }

    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'Token expired' }
    }

    if (payload.scope !== 'extension') {
      return { valid: false, error: 'Invalid token scope' }
    }

    return { valid: true, userId: payload.userId }
  } catch {
    return { valid: false, error: 'Token parsing failed' }
  }
}

// ============================================================================
// RATE LIMITING FOR EXTENSION
// ============================================================================

/**
 * Extension-aware rate limiting
 */
export interface ExtensionRateLimits {
  maxMessagesPerMinute: number
  maxMessagesPerHour: number
  maxConnectionsPerDay: number
  minDelayBetweenMessages: number // milliseconds
  backoffMultiplier: number // Increase delay on errors
}

export const DEFAULT_EXTENSION_RATE_LIMITS: ExtensionRateLimits = {
  maxMessagesPerMinute: 2,
  maxMessagesPerHour: 20,
  maxConnectionsPerDay: 25, // Conservative, LinkedIn limit is ~100/week
  minDelayBetweenMessages: 30000, // 30 seconds
  backoffMultiplier: 2
}

/**
 * Calculate next allowed send time
 */
export function calculateNextSendTime(
  lastSendTime: number,
  errorCount: number,
  limits: ExtensionRateLimits = DEFAULT_EXTENSION_RATE_LIMITS
): number {
  let delay = limits.minDelayBetweenMessages

  // Apply backoff for errors
  if (errorCount > 0) {
    delay = delay * Math.pow(limits.backoffMultiplier, Math.min(errorCount, 5))
  }

  return lastSendTime + delay
}

// ============================================================================
// EXTENSION FEATURE FLAGS
// ============================================================================

export interface ExtensionFeatureFlags {
  // Core features
  autoFillEnabled: boolean
  profileScrapingEnabled: boolean
  responseDetectionEnabled: boolean

  // Experimental/dangerous features
  autoSendEnabled: boolean // VERY DANGEROUS - likely always false
  bulkSendEnabled: boolean
  apiInterceptionEnabled: boolean

  // Safety features
  requireConfirmation: boolean
  showDebugPanel: boolean
  logAllActions: boolean
}

export const DEFAULT_EXTENSION_FLAGS: ExtensionFeatureFlags = {
  autoFillEnabled: true,
  profileScrapingEnabled: true,
  responseDetectionEnabled: true,

  autoSendEnabled: false, // NEVER enable by default
  bulkSendEnabled: false,
  apiInterceptionEnabled: false,

  requireConfirmation: true,
  showDebugPanel: false,
  logAllActions: true
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  EXTENSION_API_ROUTES,
  createWellsToExtensionMessage,
  validateExtensionMessage,
  formatQueueForExtension,
  generateExtensionToken,
  validateExtensionToken,
  calculateNextSendTime,
  DEFAULT_EXTENSION_RATE_LIMITS,
  DEFAULT_EXTENSION_FLAGS
}
