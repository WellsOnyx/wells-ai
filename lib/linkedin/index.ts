// @ts-nocheck
/**
 * LinkedIn Integration for WellsAI
 *
 * A hybrid approach to LinkedIn outreach:
 * - Profile data fetching and caching
 * - AI-powered message drafting in Wells' voice
 * - Manual send queue (copy-paste workflow)
 * - Browser extension support (future)
 * - Content creation and scheduling
 * - Sales Navigator integration (optional)
 *
 * Everything is CONVERSATIONAL - managed through chat with Wells.
 */

// Profile Service - Fetch and cache LinkedIn profiles
export {
  parseLinkedInUrl,
  guessNameFromLinkedInId,
  saveProfile,
  getProfileByUrl,
  getProfileById,
  searchProfiles,
  getUserProfiles,
  updateConnectionStatus,
  enrichProfile,
  parseProfileFromDescription,
  formatProfileForChat,
  type LinkedInProfile,
  type ExperienceEntry,
  type EducationEntry,
  type PostInfo,
  type ProfileEnrichmentResult
} from './profile-service'

// Message Drafter - Generate personalized messages
export {
  draftMessage,
  draftConnectionRequest,
  draftInMail,
  draftFollowUp,
  draftComment,
  generateVariants,
  suggestImprovements,
  shortenMessage,
  MESSAGE_TEMPLATES,
  getTemplatesByType,
  fillTemplate,
  MESSAGE_LIMITS,
  type MessageType,
  type MessageContext,
  type DraftedMessage,
  type MessageTemplate
} from './message-drafter'

// Send Queue - Manual sending workflow
export {
  queueMessage,
  getQueuedMessages,
  getQueuedMessage,
  getNextToSend,
  markAsCopied,
  markAsSent,
  recordResponse,
  markAsDeclined,
  skipMessage,
  updateMessageContent,
  getQueueStats,
  checkRateLimits,
  bulkQueue,
  clearQueue,
  formatForCopyPaste,
  formatQueueForChat,
  type QueuedMessage,
  type QueuedMessageStatus,
  type QueueStats,
  type QueueFilters
} from './send-queue'

// Extension Bridge - Browser extension protocol
export {
  EXTENSION_API_ROUTES,
  createWellsToExtensionMessage,
  validateExtensionMessage,
  formatQueueForExtension,
  generateExtensionToken,
  validateExtensionToken,
  calculateNextSendTime,
  DEFAULT_EXTENSION_RATE_LIMITS,
  DEFAULT_EXTENSION_FLAGS,
  type ExtensionToWellsMessageType,
  type WellsToExtensionMessageType,
  type ExtensionMessage,
  type ExtensionState,
  type ExtensionRateLimits,
  type ExtensionFeatureFlags
} from './extension-bridge'

// Content Service - Posts and content creation
export {
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
  LINKEDIN_BEST_TIMES,
  type ContentType,
  type ContentStatus,
  type ContentItem,
  type ContentTheme,
  type ContentGenerationRequest,
  type ContentCalendarWeek
} from './content-service'

// Sales Navigator - Enterprise API integration
export {
  SalesNavigatorClient,
  syncLeadsToProfiles,
  formatLeadsForChat,
  parseSearchCriteria,
  type SalesNavigatorConfig,
  type SalesNavigatorLead,
  type LeadSearchCriteria,
  type LeadList,
  type InMailMessage,
  type InMailResult,
  type SalesNavigatorStats
} from './sales-navigator'

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { SalesNavigatorClient } from './sales-navigator'

/**
 * Check if Sales Navigator is available
 */
export function hasSalesNavigator(): boolean {
  return SalesNavigatorClient.isAvailable()
}

/**
 * Get a configured Sales Navigator client if available
 */
export function getSalesNavigator(): SalesNavigatorClient | null {
  return SalesNavigatorClient.fromEnv()
}

// ============================================================================
// LINKEDIN LIMITS REFERENCE
// ============================================================================

export const LINKEDIN_LIMITS = {
  // Connection requests
  connectionRequestsPerWeek: 100, // Soft limit, can get restricted
  connectionRequestsPerDay: 25, // Recommended safe limit

  // Messages
  connectionRequestNoteLimit: 300, // Characters
  inmailCharacterLimit: 1900,
  regularMessageLimit: 8000,
  commentLimit: 3000,

  // Profile views
  profileViewsPerDay: 150, // Before restrictions

  // Searches (without Sales Navigator)
  searchesPerMonth: 1000, // Commercial use limit

  // Best practices
  recommendedDailyConnections: 20,
  recommendedDailyMessages: 25,
  waitBetweenActions: 30 // seconds
}

/**
 * Check if user is approaching limits
 */
export async function checkLimits(userId: string): Promise<{
  connectionsThisWeek: number
  isNearConnectionLimit: boolean
  messagesThisWeek: number
  recommendations: string[]
}> {
  const { checkRateLimits } = await import('./send-queue')
  const limits = await checkRateLimits(userId)

  const recommendations: string[] = []

  if (limits.connectionRequestsRemaining <= 10) {
    recommendations.push('Approaching weekly connection limit - prioritize high-value targets')
  }

  if (limits.connectionRequestsThisWeek >= 70) {
    recommendations.push('Consider spacing out connections over the week')
  }

  return {
    connectionsThisWeek: limits.connectionRequestsThisWeek,
    isNearConnectionLimit: limits.isNearLimit,
    messagesThisWeek: limits.messagesThisWeek,
    recommendations
  }
}
