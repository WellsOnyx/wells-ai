// @ts-nocheck
/**
 * Wells AI Proactive Companion & Insights Engine
 *
 * "Iron sharpens iron, and one man sharpens another." - Proverbs 27:17
 *
 * This module makes Wells feel like a living companion that's always working for you.
 * Wells doesn't wait - it reaches out with insights, remembers your preferences,
 * learns from interactions, and builds trust over time.
 *
 * @example
 * ```typescript
 * import {
 *   InsightEngine,
 *   NotificationHub,
 *   TrustBuilder,
 *   MemoryEnhancement,
 *   InsightGenerator
 * } from '@/lib/companion';
 *
 * // Generate and deliver proactive insights
 * const insights = await InsightEngine.generateInsights(context);
 * for (const insight of insights) {
 *   await InsightEngine.storeInsight(insight);
 *   await NotificationHub.deliverInsight(insight);
 * }
 *
 * // Track trust and relationship
 * await TrustBuilder.recordTrustEvent(userId, 'deal_completed', { value: 10000 });
 * const trustScore = await TrustBuilder.getTrustScore(userId);
 *
 * // Get enhanced user memory
 * const memory = await MemoryEnhancement.getEnhancedMemory(userId);
 * const contextForAI = await MemoryEnhancement.buildEnhancedContext(userId);
 *
 * // Run background insight generation
 * await InsightGenerator.run();
 * ```
 */

// Insight Engine - Generate proactive insights
export {
  InsightEngine,
  generateInsights,
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
  type NotificationChannel,
  type NotificationFrequency,
  type NotificationPreferences,
  type NotificationDelivery,
  type DigestContent,
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
  type TrustScore,
  type TrustTier,
  type TrustFactors,
  type TrustMilestone,
  type TrustEvent,
  type TrustEventType,
  type AutonomySettings,
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

// ============================================================================
// COMPANION SYSTEM OVERVIEW
// ============================================================================

/**
 * The Wells AI Companion System provides:
 *
 * 1. PROACTIVE INSIGHTS
 *    - Buyer insights: Cost increases, contract expirations, supplier risks
 *    - Seller insights: New RFQs, response time coaching, competitor alerts
 *    - Founder insights: Runway alerts, customer churn, price opportunities
 *    - Job seeker insights: Role matches, salary data, profile views
 *
 * 2. MULTI-CHANNEL DELIVERY
 *    - In-app chat (primary)
 *    - Email (daily/weekly digests)
 *    - Slack/Teams (urgent alerts)
 *    - SMS (critical only)
 *    - User controls frequency and channels
 *
 * 3. TRUST & RELATIONSHIP BUILDING
 *    - Trust tiers: new -> developing -> trusted -> partner
 *    - Milestones for achievements
 *    - Autonomy settings based on trust level
 *    - Value delivered tracking (money saved, earned, risks avoided)
 *
 * 4. DEEP USER MEMORY
 *    - Communication preferences (formal/casual, verbose/concise)
 *    - Goals and timeline tracking
 *    - Past conversation references
 *    - Personality adaptation
 *    - Important dates and relationships
 *
 * 5. BACKGROUND PROCESSING
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
  InsightEngine,
  NotificationHub,
  TrustBuilder,
  MemoryEnhancement,
  InsightGenerator,
  EXAMPLE_MESSAGES,
}
