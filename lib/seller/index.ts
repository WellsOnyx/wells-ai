/**
 * Seller AI Agent & Catalog System
 *
 * Complete seller automation for Wells AI.
 * Allows sellers to have an AI agent that automatically responds to RFQs
 * and negotiates on their behalf.
 *
 * @example
 * ```typescript
 * import {
 *   SellerAgentConfig,
 *   CatalogService,
 *   QuoteGenerator,
 *   SellerNegotiationAgent,
 *   PerformanceTracker
 * } from '@/lib/seller';
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
  type SellerMetrics,
  type PerformanceTrend,
  type PerformanceInsight,
  type PerformanceReport,
  type DailySnapshot,
} from './performance-tracker';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Full seller agent setup and management
 */
export const SellerAgent = {
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
};

export default SellerAgent;
