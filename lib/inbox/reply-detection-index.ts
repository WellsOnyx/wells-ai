/**
 * Reply Detection System Index
 *
 * Complete system for matching incoming messages to cold-start outreach campaigns.
 *
 * Features:
 * - Multi-method reply matching (In-Reply-To, References, Subject, Phone)
 * - AI-powered sentiment and intent analysis
 * - Real-time hot lead notifications (SMS, Slack, Email)
 * - A/B test tracking and variant performance
 * - Campaign reply metrics and analytics
 *
 * @example
 * ```typescript
 * import {
 *   replyMatcher,
 *   replyAnalyzer,
 *   hotLeadNotifications
 * } from '@/lib/inbox/reply-detection-index';
 *
 * // Match an incoming message
 * const matchResult = await replyMatcher.matchReply(incomingMessage);
 *
 * // Analyze the reply
 * const analysis = await replyAnalyzer.analyzeReply(replyBody, subject);
 *
 * // Send hot lead notification
 * await hotLeadNotifications.notifyHotLead(notification, settings);
 * ```
 */

// Reply Matcher - Matches incoming messages to campaigns
export {
  ReplyMatcherService,
  replyMatcher,
  type MatchMethod,
  type ReplyChannel,
  type IncomingMessage,
  type MatchResult,
  type CampaignReplyMatch,
} from './reply-matcher';

// Reply Analyzer - AI analysis of reply content
export {
  ReplyAnalyzerService,
  replyAnalyzer,
  type Sentiment,
  type ReplyIntent,
  type BuyingSignal,
  type Objection,
  type ReplyAnalysis,
  type AnalysisContext,
} from './reply-analyzer';

// Hot Lead Notifications - Real-time alerts
export {
  HotLeadNotificationService,
  hotLeadNotifications,
  type NotificationChannel,
  type NotificationSettings,
  type ReplyNotification,
  type NotificationResult,
} from './hot-lead-notifications';

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

import { replyMatcher, IncomingMessage, MatchResult } from './reply-matcher';
import { replyAnalyzer, ReplyAnalysis } from './reply-analyzer';
import { hotLeadNotifications, ReplyNotification } from './hot-lead-notifications';

/**
 * Process an incoming message end-to-end:
 * 1. Match to campaign
 * 2. Analyze content
 * 3. Send notifications if hot lead
 */
export async function processIncomingReply(
  message: IncomingMessage,
  userId?: string
): Promise<{
  matched: boolean;
  matchResult?: MatchResult;
  analysis?: ReplyAnalysis;
  notificationsSent?: number;
}> {
  // Step 1: Match
  const matchResult = await replyMatcher.matchReply(message);

  if (!matchResult.matched) {
    return { matched: false };
  }

  // Step 2: Analyze
  const match = await replyMatcher.getMatch(message.id);
  if (!match) {
    return { matched: true, matchResult };
  }

  const analysis = await replyAnalyzer.analyzeAndStore(match);

  // Step 3: Notify if hot lead
  let notificationsSent = 0;
  if (analysis.isHotLead && userId) {
    const settings = await hotLeadNotifications.getSettings(userId);
    if (settings) {
      const notification: ReplyNotification = {
        matchId: match.id,
        userId,
        campaignId: match.campaignId,
        replyChannel: match.channel,
        replyPreview: match.replyBody.slice(0, 500),
        replyReceivedAt: match.replyReceivedAt,
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        leadScore: analysis.leadScore,
        isHotLead: analysis.isHotLead,
        suggestedResponse: analysis.suggestedResponse,
      };

      const results = await hotLeadNotifications.notifyHotLead(notification, settings);
      notificationsSent = results.filter(r => r.success).length;
    }
  }

  return {
    matched: true,
    matchResult,
    analysis,
    notificationsSent,
  };
}

/**
 * Quick check if a message might be a campaign reply
 * (without full analysis, for filtering)
 */
export async function isLikelyCampaignReply(
  message: IncomingMessage
): Promise<boolean> {
  const result = await replyMatcher.matchReply(message);
  return result.matched && result.confidence > 0.5;
}

/**
 * Get reply detection system health/stats
 */
export async function getSystemHealth(): Promise<{
  pendingMatches: number;
  recentlyProcessed: number;
  hotLeadsToday: number;
  notificationsSentToday: number;
}> {
  // This would query the database for current stats
  // Placeholder implementation
  return {
    pendingMatches: 0,
    recentlyProcessed: 0,
    hotLeadsToday: 0,
    notificationsSentToday: 0,
  };
}
