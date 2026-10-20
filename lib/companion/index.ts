// @ts-nocheck
/**
 * Wells AI Proactive Companion & Insights Engine
 *
 * "Iron sharpens iron, and one man sharpens another." - Proverbs 27:17
 *
 * Wells is always there - always scanning, analyzing,
 * protecting, and celebrating victories with you. Wells doesn't wait - it reaches
 * out with insights, remembers your preferences, learns from interactions, and
 * builds trust over time.
 *
 * NEW IN THIS VERSION:
 * - Persistent Presence: Wells feels alive, always working in the background
 * - Deep Memory: Remembers communication style, deals, relationships, goals
 * - Trust & Autonomy: Earns trust over time, gains more autonomy
 * - Proactive Outreach: Morning briefings, celebrations, warnings
 * - Consistent Voice: Warm but professional, confident but humble
 * - Personalized Greetings: Context-aware, relationship-aware
 *
 * @example
 * ```typescript
 * import {
 *   CompanionPresence,
 *   DeepMemory,
 *   RelationshipService,
 *   VoiceService,
 *   ProactiveService,
 *   GreetingService,
 * } from '@/lib/companion';
 *
 * // Get Wells presence and status
 * const presence = await CompanionPresence.getPresence(userId);
 * const greeting = await GreetingService.generateWelcome(userId);
 *
 * // Check autonomy before taking action
 * const canNegotiate = await RelationshipService.canActAutonomously(userId, { type: 'negotiate' });
 *
 * // Generate proactive outreach
 * await ProactiveService.generateMorningBriefing(userId);
 * await ProactiveService.generateOpportunityAlert(userId, opportunity);
 *
 * // Get voice settings for personalized communication
 * const voice = await VoiceService.getVoice(userId);
 * const message = await VoiceService.formatWithVoice(userId, content);
 * ```
 */

// Insight Engine - Generate proactive insights
export {
  InsightEngine,
  generateInsights,
  generateComprehensiveInsights,
  detectSpendAnomalies,
  detectOpportunities,
  detectRisks,
  trackCompletions,
  storeInsight,
  getPendingInsights,
  markInsightActedUpon,
  dismissInsight,
  generateWelcomeBackMessage,
  type ProactiveInsight,
  type InsightCategory,
  type InsightUrgency,
  type InsightAction,
  type InsightGenerationContext,
  type UserMetrics,
  type UserJourney,
} from './insight-engine'

// Notification Hub - Multi-channel delivery
export {
  NotificationHub,
  getNotificationPreferences,
  saveNotificationPreferences,
  updateChannelPreferences,
  deliverInsight,
  generateAndSendDigest,
  processPendingDeliveries,
  // Chat queue functions (primary notification method)
  addToChatQueue,
  getChatQueue,
  markChatQueueRead,
  buildProactiveChatGreeting,
  notify,
  type NotificationChannel,
  type NotificationFrequency,
  type NotificationPreferences,
  type NotificationDelivery,
  type DigestContent,
  type ChatQueueItem,
} from './notification-hub'

// Trust Builder - Relationship tracking
export {
  TrustBuilder,
  getTrustScore,
  recordTrustEvent,
  updateAutonomy,
  checkAutonomy,
  getRecommendedAutonomy,
  calculateTrustScore,
  getTrustTier,
  getTierDescription,
  getTierColor,
  formatTrustSummary,
  // Autonomy functions
  getAutonomyLevel,
  canPerformAutonomousAction,
  getValueDelivered,
  recordValueDelivered,
  getTrustProgress,
  getTrustSummaryForChat,
  type TrustScore,
  type TrustTier,
  type TrustFactors,
  type TrustMilestone,
  type TrustEvent,
  type TrustEventType,
  type AutonomySettings,
  type AutonomyConfig,
} from './trust-builder'

// Memory Enhancement - Deep user memory
export {
  MemoryEnhancement,
  learnCommunicationStyle,
  getCommunicationPreference,
  createGoal,
  updateGoalProgress,
  getActiveGoals,
  storeConversationReference,
  getRelevantConversations,
  getDueFollowUps,
  getPersonalityAdaptation,
  updatePersonalityAdaptation,
  addImportantDate,
  getUpcomingDates,
  upsertRelationship,
  getRelationshipsNeedingAttention,
  getEnhancedMemory,
  buildEnhancedContext,
  // Chat context functions
  getContextForChat,
  generateContextualGreeting,
  buildSystemPromptContext,
  storeRichContext,
  type CommunicationPreference,
  type UserGoal,
  type GoalMilestone,
  type ConversationReference,
  type TrustLevel,
  type AutonomyLevel,
  type EnhancedMemory,
  type PersonalityAdaptation,
  type ImportantDate,
  type UserRelationship,
  type ChatContext,
} from './memory-enhancement'

// Insight Generator - Background job
export {
  InsightGenerator,
  runInsightGenerator,
  processScheduledDeliveries,
  getGeneratorStats,
  getInsightEffectiveness,
  type InsightGeneratorConfig,
  type GeneratorStats,
} from './insight-generator'

// Insight Engine Service - Class-based insight generation
export {
  InsightEngineService,
  type Insight,
  type SavingsInsight,
  type AnomalyInsight,
  type VendorInsight,
  type MarketInsight,
  type RiskInsight,
  type JobMatch,
  type ApplicationUpdate,
} from './insight-engine-service'

// Background Worker - Scheduled processing
export {
  BackgroundWorker,
  runBackgroundWorker,
  runForUser,
  getWorkerStatus,
  startWorkerSchedule,
  stopWorkerSchedule,
  logActivity,
  completeActivity,
  getWellsActivity,
  getWellsWorkingSummary,
  type WorkerStatus,
  type UserProcessingResult,
  type ActivityLogEntry,
} from './background-worker'

// Wells Status - "Wells is working" visibility system
export {
  WellsStatusService,
  getWellsStatus,
  getAnimatedTaskDescriptions,
  formatTaskForDisplay,
  getWellsPulse,
  type WellsStatus,
  type WellsTask,
  type WellsCompletion,
  type WellsStats,
} from './wells-status'

// ============================================================================
// Companion presence modules
// ============================================================================

// Companion Presence - Persistent, always-there presence
export {
  CompanionPresenceService,
  getPresence,
  updateHeartbeat,
  setActivity,
  clearActivity,
  addBackgroundWork,
  removeBackgroundWork,
  updateBackgroundWorkProgress,
  generateAmbientMessage,
  getPresenceForWidget,
  getActivityIcon,
  type CompanionPresence,
  type CompanionActivity,
  type ActivityType,
  type BackgroundWorkItem,
  type WorkItemType,
  type AmbientStatus,
  type PresenceWidgetData,
} from './presence'

// Deep Memory - Remember everything about the user
export {
  DeepMemoryService,
  getDeepMemory,
  getCommunicationStyle,
  updateCommunicationStyle,
  learnFromConversation,
  storeDealMemory,
  getDealMemory,
  getRecentDeals,
  updatePreferences,
  getPreferences,
  storeRelationship,
  getRelationship,
  getAllRelationships,
  storeDate,
  getUpcomingImportantDates,
  storeGoal,
  getGoals,
  updateGoalProgress as updateDeepGoalProgress,
  storeContext,
  getRecentContext,
  recallRelevantMemories,
  getMemorySummaryForChat,
  type DeepMemory,
  type CommunicationStyle,
  type DealMemory,
  type DealOutcome,
  type UserPreferences,
  type RelationshipMemory,
  type RelationshipType,
  type DateMemory,
  type DateType,
  type GoalMemory,
  type GoalStatus,
  type ConversationContext,
  type WellsLearning,
  type MemorySummary,
} from './memory'

// Relationship Service - Trust, autonomy, and relationship deepening
export {
  RelationshipService,
  getCompanionRelationship,
  recordInteraction,
  canActAutonomously,
  grantAutonomy,
  revokeAutonomy,
  addMilestone,
  getMilestones,
  assessRelationshipHealth,
  getRelationshipSummary,
  generateTrustInsight,
  type CompanionRelationship,
  type RelationshipTier,
  type AutonomyConfig,
  type Milestone,
  type MilestoneType,
  type InteractionRecord,
  type InteractionType as RelationshipInteractionType,
  type InteractionSentiment,
  type RelationshipHealth,
  type HealthStatus,
  type TrustInsight,
} from './relationship'

// Voice Service - Personality, tone, and language patterns
export {
  VoiceService,
  getVoice,
  updateVoice,
  getGreeting,
  getCelebration,
  getEncouragement,
  getAffirmation,
  formatWithVoice,
  generateProactiveMessage,
  getPersonalityPrompt,
  adaptVoiceToMood,
  type CompanionVoice,
  type PersonalityTraits,
  type ToneSettings,
  type LanguagePatterns,
  type UserMood,
  type MessageContext,
  type VoiceAdaptation,
} from './voice'

// Proactive Service - Reach out, don't just respond
export {
  ProactiveService,
  generateMorningBriefing,
  generateOpportunityAlert,
  generateWarningAlert,
  generateCelebration as generateCelebrationOutreach,
  generateReminder,
  generateCheckIn,
  generateGoalProgressUpdate,
  generateRelationshipNudge,
  getOutreachHistory,
  shouldSendOutreach,
  recordOutreachDelivery,
  runScheduledOutreach,
  getNextOutreachTime,
  type ProactiveOutreach,
  type OutreachType,
  type OutreachPriority,
  type OutreachChannel,
  type MorningBriefing,
  type OpportunityData,
  type WarningData,
  type CelebrationData,
  type ReminderData,
  type OutreachDelivery,
  type OutreachSchedule,
} from './proactive'

// Greeting Service - Personalized, context-aware greetings
export {
  GreetingService,
  generateWelcome,
  generateQuickGreeting,
  generateReturnGreeting,
  getTimeOfDay,
  getWorkSummary,
  detectSpecialOccasions,
  buildWelcomeContext,
  type WelcomeContext,
  type TimeOfDay,
  type SpecialOccasion,
  type WorkSummary,
  type GreetingResult,
  type GreetingAction,
  type GreetingMood,
} from './greetings'

// ============================================================================
// COMPANION SYSTEM OVERVIEW
// ============================================================================

/**
 * The Wells AI Companion System provides:
 *
 * 1. PERSISTENT PRESENCE
 *    - Always there, always working in the background
 *    - Activity tracking: scanning, analyzing, monitoring, negotiating
 *    - Ambient status messages: "Wells is reviewing 3 new supplier quotes..."
 *    - Background work visibility for dashboard widgets
 *    - Heartbeat system ensures Wells feels alive
 *
 * 2. DEEP MEMORY (Remembers Everything)
 *    - Communication style preferences (formal/casual, brief/detailed)
 *    - Past deals with outcomes and learnings
 *    - User preferences and settings
 *    - Relationship memory (who they work with, history)
 *    - Important dates (contract renewals, birthdays, deadlines)
 *    - Goals and progress tracking
 *    - Conversation context for continuity
 *
 * 3. TRUST & AUTONOMY (Earns Capabilities Over Time)
 *    - Trust tiers: new_acquaintance -> developing -> established -> trusted_partner -> guardian
 *    - Autonomy unlocks: auto-negotiate, auto-approve, proactive outreach
 *    - Milestone tracking for relationship progression
 *    - Value delivered tracking (money saved, earned, risks avoided)
 *    - Relationship health assessment
 *
 * 4. PROACTIVE OUTREACH (Reaches Out, Doesn't Just Respond)
 *    - Morning briefings with overnight activity summary
 *    - Opportunity alerts when matches are found
 *    - Warning alerts for risks or issues
 *    - Celebrations for wins and milestones
 *    - Reminders for important deadlines
 *    - Check-ins when user has been away
 *    - Goal progress updates
 *    - Relationship nudges for neglected contacts
 *
 * 5. CONSISTENT VOICE (Personality That Feels Real)
 *    - Personality traits: warmth, confidence, proactivity, directness
 *    - Tone settings: formality, verbosity, emotional range, humor
 *    - Language patterns: greetings, affirmations, encouragements
 *    - Context-aware messaging based on time, mood, urgency
 *    - Adapts to user preferences over time
 *
 * 6. PERSONALIZED GREETINGS (Context-Aware Welcome)
 *    - Time-of-day appropriate greetings
 *    - Return greetings after absence
 *    - Work summary integration
 *    - Special occasion detection
 *    - Trust-tier appropriate formality
 *    - Suggested actions based on context
 *
 * 7. PROACTIVE INSIGHTS (Original System)
 *    - Buyer insights: Cost increases, contract expirations, supplier risks
 *    - Seller insights: New RFQs, response time coaching, competitor alerts
 *    - Founder insights: Runway alerts, customer churn, price opportunities
 *    - Job seeker insights: Role matches, salary data, profile views
 *
 * 8. MULTI-CHANNEL DELIVERY
 *    - In-app chat (primary)
 *    - Email (daily/weekly digests)
 *    - Slack/Teams (urgent alerts)
 *    - SMS (critical only)
 *    - User controls frequency and channels
 *
 * 9. BACKGROUND PROCESSING
 *    - Periodic insight generation
 *    - Learning from insight outcomes
 *    - Scheduled delivery processing
 *    - Performance tracking
 */

// Example welcome messages for different scenarios:
export const EXAMPLE_MESSAGES = {
  morning_with_insights: "Good morning! While you were away, I saved you $2,400 on a supplier negotiation and found 3 new opportunities worth $25K.",
  contract_alert: "Heads up: Acme's invoice is due Friday and your cash position is tight. Want me to request extended terms?",
  celebration: "Congrats! You just closed your 10th deal. You're in the top 20% of users. Keep up the great work!",
  risk_alert: "I noticed an unusual $50K invoice from a new vendor. Want me to verify before you approve?",
  opportunity: "3 new RFQs match your profile. Quick response could win $25K in orders. Should I draft responses?",
  relationship: "Your customer at TechCorp hasn't ordered in 45 days. They usually reorder monthly. Want me to check in?",
}

export default {
  // Original modules
  InsightEngine,
  InsightEngineService,
  NotificationHub,
  TrustBuilder,
  MemoryEnhancement,
  InsightGenerator,
  BackgroundWorker,
  WellsStatusService,
  EXAMPLE_MESSAGES,
  // Companion presence modules
  CompanionPresenceService,
  DeepMemoryService,
  RelationshipService,
  VoiceService,
  ProactiveService,
  GreetingService,
}
