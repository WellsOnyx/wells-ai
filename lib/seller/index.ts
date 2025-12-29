/**
 * Seller AI Agent & Catalog System
 *
 * Complete seller automation for Wells AI.
 * Allows sellers to have an AI agent that automatically responds to RFQs
 * and negotiates on their behalf.
 *
 * NEW: Conversational Seller/GTM System
 * Natural language interface for sales automation:
 * - "Find companies that need industrial motors"
 * - "Who should I reach out to?"
 * - "Draft an email to that prospect"
 * - "Move Acme to proposal stage"
 * - "What deals are closing this month?"
 * - "What's my win rate?"
 * - "Show me incoming RFQs matching my catalog"
 * - "Create a quote for their request"
 * - "Launch a campaign targeting manufacturers"
 *
 * @example
 * ```typescript
 * import {
 *   SellerAgentConfig,
 *   CatalogService,
 *   QuoteGenerator,
 *   SellerNegotiationAgent,
 *   PerformanceTracker,
 *   ConversationalSeller,
 * } from '@/lib/seller';
 *
 * // NEW: Conversational lead discovery
 * const { leads, suggestions } = await ConversationalSeller.discoverLeads(
 *   sellerId,
 *   "Find companies that need industrial motors in Texas"
 * );
 *
 * // NEW: Get lead recommendations
 * const { recommended, reasoning } = await ConversationalSeller.getLeadRecommendations(
 *   sellerId
 * );
 *
 * // NEW: Generate personalized outreach
 * const { content, subject } = await ConversationalSeller.generateOutreach(
 *   sellerId,
 *   leadId,
 *   'email'
 * );
 *
 * // NEW: Track opportunities
 * const { opportunities, insights } = await ConversationalSeller.trackOpportunities(
 *   sellerId,
 *   "What deals are closing this month?"
 * );
 *
 * // NEW: Get sales insights
 * const insights = await ConversationalSeller.getSalesInsights(sellerId);
 *
 * // Set up agent via conversation
 * const result = await SellerAgentConfig.processSetupMessage(context, message);
 *
 * // Add products via conversation
 * const products = await CatalogService.addProductsViaConversation(
 *   sellerId,
 *   "I sell ball bearings, $2-$10 per unit"
 * );
 *
 * // Generate quote for RFQ
 * const quote = await QuoteGenerator.generateQuoteForRFQ(sellerId, rfq);
 *
 * // Handle negotiation
 * const { session, response } = await SellerNegotiationAgent.processBuyerOffer(
 *   sessionId,
 *   { price: 9000, message: "Can you do better?" }
 * );
 *
 * // Get performance report
 * const report = await PerformanceTracker.generatePerformanceReport(
 *   sellerId,
 *   { start: thirtyDaysAgo, end: now }
 * );
 * ```
 */

// Conversational Seller - NEW GTM System
export {
  ConversationalSeller,
  discoverLeads,
  getLeadRecommendations,
  generateOutreach,
  updatePipeline,
  trackOpportunities,
  getSalesInsights,
  matchRFQs,
  generateQuote as generateConversationalQuote,
  launchCampaign,
  type Lead as ConversationalLead,
  type Opportunity as ConversationalOpportunity,
  type Quote as ConversationalQuote,
  type Campaign as ConversationalCampaign,
  type RFQMatch,
  type SalesInsights,
  type PipelineMetrics,
  type PerformanceMetrics as ConversationalPerformanceMetrics,
  type ForecastMetrics,
} from './conversational-seller';

// Agent Configuration
export {
  SellerAgentConfig,
  getDefaultConfig,
  processSetupMessage,
  saveSellerConfig,
  getSellerConfig,
  updateSellerConfig,
  deactivateAgent,
  activateAgent,
  getActiveAgents,
  type SellerAIConfig,
  type PricingStrategy,
  type NegotiationStyle,
  type AutoResponseSettings,
  type NotificationPreferences,
  type ConversationalSetupContext,
  type SetupStep,
} from './ai-agent-config';

// Catalog Service
export {
  CatalogService,
  addProductsViaConversation,
  updateCatalogViaConversation,
  createProduct,
  getSellerCatalog,
  getCatalogSummary,
  searchCatalog,
  getProduct,
  updateProduct,
  deleteProduct,
  bulkUpdatePrices,
  addGlobalVolumeDiscount,
  type CatalogProduct,
  type VolumeDiscount,
  type ProductPricing,
  type LeadTimeConfig,
  type ProductAvailability,
  type CatalogSummary,
  type ProductSearchResult,
} from './catalog-service';

// Catalog Ingestion
export {
  CatalogIngestion,
  ingestFromCSV,
  ingestFromShopify,
  ingestFromERP,
  getIngestionJob,
  getSellerIngestionHistory,
  type IngestionJob,
  type IngestionError,
  type FieldMapping,
  type IngestionSource,
} from './catalog-ingestion';

// Quote Generator
export {
  QuoteGenerator,
  generateQuoteForRFQ,
  approveQuote,
  rejectQuote,
  counterQuote,
  getQuote,
  getSellerQuotes,
  type RFQRequest,
  type GeneratedQuote,
  type QuoteLineItem,
  type QuoteGenerationResult,
} from './quote-generator';

// Seller Negotiation Agent
export {
  SellerNegotiationAgent,
  startNegotiation,
  processBuyerOffer,
  sellerManualResponse,
  buyerAcceptsCounter,
  getNegotiationSession,
  getSellerNegotiations,
  type NegotiationSession,
  type NegotiationMessage,
  type NegotiationTerms,
  type BuyerOffer,
  type SellerResponse,
} from './seller-negotiation-agent';

// Performance Tracker
export {
  PerformanceTracker,
  getSellerMetrics,
  getPerformanceTrends,
  generateInsights,
  generatePerformanceReport,
  getDailySnapshots,
  storePerformanceSnapshot,
  getTopSellers,
  generateActionableRecommendations,
  applyRecommendation,
  getBenchmarkComparison,
  type SellerMetrics,
  type PerformanceTrend,
  type PerformanceInsight,
  type PerformanceReport,
  type DailySnapshot,
  type ActionableRecommendation,
} from './performance-tracker';

// Main Seller Agent (Unified Conversational Interface)
export {
  SellerAgent as SellerAgentClass,
  createSellerAgent,
  type SellerAgentConfig,
  type RFQ,
  type RFQResponse,
  type Quote,
  type QuoteLineItem as SellerQuoteLineItem,
  type CounterOffer,
  type CounterResponse,
  type CatalogImportResult,
  type PricingUpdate,
  type PricingRule,
  type SellerMetricsResponse,
  type RFQHistoryItem,
  type SellerAgentContext,
  type ConversationTurn,
  type SellerIntent,
  type ActionResult,
  type PendingAction,
  type ChatResponse,
  type QuickAction,
} from './seller-agent';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

import { SellerAgent as SellerAgentClassInternal } from './seller-agent';

/**
 * Full seller agent setup and management
 *
 * @example
 * ```typescript
 * // Quick setup with the unified SellerAgent
 * const agent = await SellerAgent.create('seller_123');
 *
 * // Configure the agent
 * await agent.configureAgent('seller_123', {
 *   minMargin: 15,
 *   maxDiscount: 20,
 *   autoApproveBelow: 5000,
 *   negotiationStyle: 'balanced',
 *   preferredPaymentTerms: ['NET30'],
 *   responseTimeTarget: 'within_hour',
 * });
 *
 * // Receive and process an RFQ
 * const response = await agent.receiveRFQ('seller_123', rfq);
 *
 * // Handle counter-offer in negotiation
 * const counter = await agent.respondToCounter('seller_123', sessionId, counterOffer);
 *
 * // Get performance metrics
 * const metrics = await agent.getPerformanceMetrics('seller_123');
 *
 * // Chat interface for conversational setup
 * const chatResponse = await agent.chat('seller_123', 'Show my pending quotes');
 * ```
 */
export const SellerAgent = {
  // Create conversational agent
  create: createSellerAgent,

  // Create agent instance directly
  createInstance: () => new SellerAgentClassInternal(),

  // Configuration
  configure: saveSellerConfig,
  getConfig: getSellerConfig,
  updateConfig: updateSellerConfig,
  activate: activateAgent,
  deactivate: deactivateAgent,

  // Catalog
  addProducts: addProductsViaConversation,
  updateCatalog: updateCatalogViaConversation,
  importCSV: ingestFromCSV,
  importShopify: ingestFromShopify,
  importERP: ingestFromERP,

  // Quoting
  generateQuote: generateQuoteForRFQ,
  approveQuote: approveQuote,
  rejectQuote: rejectQuote,
  counterQuote: counterQuote,

  // Negotiation
  startNegotiation: startNegotiation,
  handleBuyerOffer: processBuyerOffer,
  manualRespond: sellerManualResponse,

  // Performance
  getMetrics: getSellerMetrics,
  getReport: generatePerformanceReport,
  getInsights: generateInsights,
  getRecommendations: generateActionableRecommendations,
  applyRecommendation: applyRecommendation,
  getBenchmarks: getBenchmarkComparison,

  // Advanced: Direct RFQ handling for AI-to-AI integration
  async receiveRFQ(sellerId: string, rfq: import('./seller-agent').RFQ) {
    const agent = new SellerAgentClassInternal();
    return agent.receiveRFQ(sellerId, rfq);
  },

  // Advanced: Handle counter-offer in negotiation
  async respondToCounter(sellerId: string, sessionId: string, counter: import('./seller-agent').CounterOffer) {
    const agent = new SellerAgentClassInternal();
    return agent.respondToCounter(sellerId, sessionId, counter);
  },

  // Advanced: Import catalog from various sources
  async importCatalog(sellerId: string, source: 'csv' | 'api' | 'manual', data: unknown) {
    const agent = new SellerAgentClassInternal();
    return agent.importCatalog(sellerId, source, data);
  },

  // Advanced: Update pricing
  async updatePricing(sellerId: string, updates: import('./seller-agent').PricingUpdate[]) {
    const agent = new SellerAgentClassInternal();
    return agent.updatePricing(sellerId, updates);
  },

  // Advanced: Get pricing rules
  async getPricingRules(sellerId: string) {
    const agent = new SellerAgentClassInternal();
    return agent.getPricingRules(sellerId);
  },

  // Advanced: Get performance metrics
  async getPerformanceMetrics(sellerId: string) {
    const agent = new SellerAgentClassInternal();
    return agent.getPerformanceMetrics(sellerId);
  },

  // Advanced: Get RFQ history
  async getRFQHistory(sellerId: string) {
    const agent = new SellerAgentClassInternal();
    return agent.getRFQHistory(sellerId);
  },

  // Chat interface
  async chat(sellerId: string, message: string) {
    const agent = new SellerAgentClassInternal();
    return agent.chat(sellerId, message);
  },

  // Get seller status summary
  async getStatus(sellerId: string) {
    const agent = new SellerAgentClassInternal();
    return agent.getStatus(sellerId);
  },
};

export default SellerAgent;
