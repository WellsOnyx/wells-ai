/**
 * Unified Inbox Module
 *
 * Provides a Superhuman-style unified inbox that aggregates messages from
 * multiple providers (Gmail, SMS, LinkedIn, X, etc.) with AI-powered features
 * and campaign reply tracking for cold start campaigns.
 */

// Core service
export { InboxService, inboxService } from './inbox-service';

// Campaign linking
export {
  detectCampaignReply,
  linkThreadToCampaign,
  linkMessageToCampaign,
  getCampaignContext,
  getCampaignReplies,
  campaignLinker,
  type CampaignMatch,
  type CampaignContext,
  type LinkResult,
} from './campaign-linker';

// Types
export * from './types';
