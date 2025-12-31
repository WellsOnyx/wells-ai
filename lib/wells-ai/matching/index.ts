/**
 * Wells AI Matching Engine
 *
 * The core intelligence that connects buyers with suppliers
 * and earns the 1% sourcing fee.
 *
 * Key exports:
 * - MatchingEngine: Core matching functions
 * - ScoringSystem: Score calculation and explanation
 * - AIAssist: Natural language parsing and AI enhancements
 * - IntroductionSystem: Buyer-supplier introductions
 * - AttributionSystem: Transaction attribution and fee tracking
 */

// Core Engine
export {
  MatchingEngine,
  findMatchesForRequest,
  findOpportunitiesForSupplier,
  processMatchRequest,
  onNewRequest,
  onNewSupplier,
  reMatch,
} from './engine';

// Scoring System
export {
  ScoringSystem,
  calculateMatchScore,
  getMatchQuality,
  explainMatchScore,
  getCategoryWeights,
} from './scoring';

// AI Assistance
export {
  AIAssist,
  parseNaturalLanguageRequest,
  extractSpecsFromDescription,
  suggestMissingRequirements,
  generateIntroMessages,
  summarizeSupplierForBuyer,
  explainMatch,
  inferCategory,
} from './ai-assist';

// Introduction System
export {
  IntroductionSystem,
  createIntroduction,
  sendIntroduction,
  recordBuyerView,
  recordSupplierView,
  recordBuyerResponse,
  recordSupplierResponse,
  getBuyerIntroductions,
  getSupplierIntroductions,
  getIntroductionStats,
} from './introductions';

// Attribution System
export {
  AttributionSystem,
  createAttribution,
  recordIntroductionSent,
  recordDealStarted,
  linkTransactionToMatch,
  autoAttributeTransaction,
  calculateSourcingFee,
  captureFee,
  markFeePaid,
  getAttributionStats,
  getBuyerAttributions,
  getSupplierAttributions,
  generateAttributionReport,
} from './attribution';

// Types
export * from './types';

// ============================================================================
// UNIFIED API
// ============================================================================

import { MatchingEngine } from './engine';
import { ScoringSystem } from './scoring';
import { AIAssist } from './ai-assist';
import { IntroductionSystem } from './introductions';
import { AttributionSystem } from './attribution';

/**
 * Wells AI Matching - Unified API
 *
 * Usage:
 * ```typescript
 * import { WellsMatching } from '@/lib/wells-ai/matching';
 *
 * // Find matches for a request
 * const matches = await WellsMatching.findMatches('request_123');
 *
 * // Parse natural language request
 * const parsed = await WellsMatching.parseRequest("I need 10,000 kraft boxes monthly");
 *
 * // Create introduction
 * const intro = await WellsMatching.introduce('match_456');
 *
 * // Get attribution stats
 * const stats = await WellsMatching.getStats();
 * ```
 */
export const WellsMatching = {
  // Core Matching
  findMatches: MatchingEngine.findMatchesForRequest,
  findOpportunities: MatchingEngine.findOpportunitiesForSupplier,
  processRequest: MatchingEngine.processMatchRequest,
  triggerOnNewRequest: MatchingEngine.onNewRequest,
  triggerOnNewSupplier: MatchingEngine.onNewSupplier,
  reMatch: MatchingEngine.reMatch,

  // Scoring
  calculateScore: ScoringSystem.calculateMatchScore,
  getQuality: ScoringSystem.getMatchQuality,
  explainScore: ScoringSystem.explainMatchScore,

  // AI Assistance
  parseRequest: AIAssist.parseNaturalLanguageRequest,
  extractSpecs: AIAssist.extractSpecsFromDescription,
  suggestRequirements: AIAssist.suggestMissingRequirements,
  generateIntros: AIAssist.generateIntroMessages,
  summarizeSupplier: AIAssist.summarizeSupplierForBuyer,
  explainMatch: AIAssist.explainMatch,

  // Introductions
  introduce: IntroductionSystem.createIntroduction,
  sendIntro: IntroductionSystem.sendIntroduction,
  recordBuyerView: IntroductionSystem.recordBuyerView,
  recordSupplierView: IntroductionSystem.recordSupplierView,
  recordBuyerResponse: IntroductionSystem.recordBuyerResponse,
  recordSupplierResponse: IntroductionSystem.recordSupplierResponse,
  getIntroStats: IntroductionSystem.getIntroductionStats,

  // Attribution
  createAttribution: AttributionSystem.createAttribution,
  linkTransaction: AttributionSystem.linkTransactionToMatch,
  autoAttribute: AttributionSystem.autoAttributeTransaction,
  calculateFee: AttributionSystem.calculateSourcingFee,
  captureFee: AttributionSystem.captureFee,
  getStats: AttributionSystem.getAttributionStats,
  generateReport: AttributionSystem.generateAttributionReport,
};

export default WellsMatching;
