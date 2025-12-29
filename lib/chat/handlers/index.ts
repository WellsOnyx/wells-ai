// @ts-nocheck
/**
 * Chat Handlers Index
 *
 * Exports all intent handlers for the chat system.
 * These handlers process specific categories of user intents.
 *
 * @module lib/chat/handlers
 */

// Negotiation Handler - All negotiation-related intents
export {
  negotiationHandler,
  handleNegotiation,
  startNegotiation,
  checkNegotiationStatus,
  setNegotiationConstraints,
  makeCounterOffer,
  acceptNegotiationOffer,
  rejectNegotiationOffer,
  enableAutonomousNegotiation,
  getNegotiationStrategy,
  reviewCurrentOffer,
  approvePendingAction,
  rejectPendingAction,
  pauseNegotiation,
  resumeNegotiation,
  type NegotiationHandlerParams,
  type NegotiationHandlerResult,
} from './negotiation-handler';

// Seller/GTM Handler - All seller and go-to-market intents
export {
  SellerHandler,
  handleSellerIntent,
  type SellerIntent,
  type SellerHandlerContext,
  type SellerHandlerResult,
} from './seller-handler';

// Help Handler - All help, guidance, and assistance intents
export {
  HelpHandler,
  handleHelpIntent,
  generateProactiveSuggestion,
  shouldShowHelp,
  type HelpHandlerInput,
  type HelpHandlerResult,
} from './help-handler';

// RFQ Handler - Conversational RFQ management
export {
  RFQHandler,
  getRFQHandler,
  type RFQHandlerResult,
  type RFQIntentContext,
} from './rfq-handler';

// Jobs Handler - Job search and applications
export {
  JobsHandler,
  getJobsHandler,
  type JobsHandlerResult,
  type JobsIntentContext,
} from './jobs-handler';

// Payments Handler - Treasury and GRAIN payments
export {
  PaymentsHandler,
  getPaymentsHandler,
  type PaymentsHandlerResult,
  type PaymentsIntentContext,
} from './payments-handler';

// ERP Handler - ERP and accounting integrations
export {
  ERPIntentHandler,
  createERPHandler,
  classifyERPIntent,
  extractEntities,
  INTENT_PATTERNS,
  type ERPIntent,
  type ERPIntentType,
  type ERPEntities,
  type ERPHandlerResult,
} from './erp-handler';

// Founder Handler - Founder and business owner tools
export {
  FounderHandler,
  getFounderHandler,
  type FounderHandlerResult,
  type FounderIntentContext,
} from './founder-handler';

// Inbox Handler - Unified inbox and communications
export {
  InboxHandler,
  getInboxHandler,
  type InboxHandlerResult,
  type InboxIntentContext,
} from './inbox-handler';

// Insights Handler - Analytics and insights
export {
  InsightsHandler,
  getInsightsHandler,
  type InsightsHandlerResult,
  type InsightsIntentContext,
} from './insights-handler';

// Onboarding Handler - User onboarding flows
export {
  OnboardingHandler,
  getOnboardingHandler,
  type OnboardingHandlerResult,
  type OnboardingIntentContext,
} from './onboarding-handler';

// Scheduling Handler - Calendar and meeting scheduling
export {
  SchedulingHandler,
  getSchedulingHandler,
  type SchedulingHandlerResult,
  type SchedulingIntentContext,
} from './scheduling-handler';

// Re-export all handlers as a single object for convenience
export const handlers = {
  negotiation: {
    handle: async (params: import('./negotiation-handler').NegotiationHandlerParams, context: import('../conversation-manager').ConversationContext) => {
      const { handleNegotiation } = await import('./negotiation-handler');
      return handleNegotiation(params, context);
    },
  },
  seller: {
    handle: async (message: string, context: import('./seller-handler').SellerHandlerContext) => {
      const { handleSellerIntent } = await import('./seller-handler');
      return handleSellerIntent(message, context);
    },
  },
  help: {
    handle: async (params: import('./help-handler').HelpHandlerInput) => {
      const { handleHelpIntent } = await import('./help-handler');
      return handleHelpIntent(params);
    },
  },
  rfq: {
    handle: async (context: import('./rfq-handler').RFQIntentContext) => {
      const { getRFQHandler } = await import('./rfq-handler');
      return getRFQHandler().handleIntent(context);
    },
  },
  jobs: {
    handle: async (context: import('./jobs-handler').JobsIntentContext) => {
      const { getJobsHandler } = await import('./jobs-handler');
      return getJobsHandler().handleIntent(context);
    },
  },
  payments: {
    handle: async (context: import('./payments-handler').PaymentsIntentContext) => {
      const { getPaymentsHandler } = await import('./payments-handler');
      return getPaymentsHandler().handleIntent(context);
    },
  },
  erp: {
    handle: async (message: string, userId: string, conversationContext: import('../conversation-manager').ConversationContext) => {
      const { createERPHandler, classifyERPIntent } = await import('./erp-handler');
      const handler = createERPHandler(userId);
      const intent = classifyERPIntent(message);
      return handler.handleIntent(intent, conversationContext);
    },
  },
  founder: {
    handle: async (context: import('./founder-handler').FounderIntentContext) => {
      const { getFounderHandler } = await import('./founder-handler');
      return getFounderHandler().handleIntent(context);
    },
  },
  inbox: {
    handle: async (context: import('./inbox-handler').InboxIntentContext) => {
      const { getInboxHandler } = await import('./inbox-handler');
      return getInboxHandler().handleIntent(context);
    },
  },
  insights: {
    handle: async (context: import('./insights-handler').InsightsIntentContext) => {
      const { getInsightsHandler } = await import('./insights-handler');
      return getInsightsHandler().handleIntent(context);
    },
  },
  onboarding: {
    handle: async (context: import('./onboarding-handler').OnboardingIntentContext) => {
      const { getOnboardingHandler } = await import('./onboarding-handler');
      return getOnboardingHandler().handleIntent(context);
    },
  },
  scheduling: {
    handle: async (context: import('./scheduling-handler').SchedulingIntentContext) => {
      const { getSchedulingHandler } = await import('./scheduling-handler');
      return getSchedulingHandler().handleIntent(context);
    },
  },
};

export default handlers;
