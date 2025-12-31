/**
 * Wells AI Matching Engine Types
 *
 * Core types for the AI-powered matching system that connects
 * buyers with suppliers and earns the 1% sourcing fee.
 */

// ============================================================================
// SOURCING REQUEST TYPES
// ============================================================================

export type RequestStatus = 'draft' | 'active' | 'matching' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
export type RequestUrgency = 'standard' | 'urgent' | 'critical';

export interface SourcingRequest {
  id: string;
  buyerId: string;
  buyerName?: string;
  buyerEmail?: string;

  // What they need
  title: string;
  description: string;
  rawRequest?: string; // Original natural language request

  // Parsed requirements
  category: string;
  parentCategory?: string;
  relatedCategories?: string[];

  // Specifications
  specifications: ProductSpecification[];
  requiredCertifications: string[];
  preferredCertifications?: string[];

  // Volume & Timing
  quantity: number;
  quantityUnit: string;
  frequency: 'one-time' | 'monthly' | 'quarterly' | 'annual';
  deliveryDeadline?: Date;
  urgency: RequestUrgency;

  // Location
  deliveryLocation: string;
  deliveryCity?: string;
  deliveryRegion?: string;
  deliveryCountry?: string;

  // Budget
  targetPrice?: number;
  maxPrice?: number;
  currency: string;

  // Preferences
  preferGrainEnabled: boolean; // Prioritize GRAIN suppliers
  requireGrainEnabled: boolean; // Only GRAIN suppliers

  // Status
  status: RequestStatus;
  matchingStartedAt?: Date;
  matchingCompletedAt?: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSpecification {
  name: string;
  value: string;
  required: boolean;
  unit?: string;
}

// ============================================================================
// SUPPLIER PROFILE TYPES (extended for matching)
// ============================================================================

export interface SupplierProfile {
  id: string;
  companyName: string;
  contactEmail: string;
  phone?: string;
  website?: string;

  // Categories and products
  categories: string[];
  products: string[];
  productDescriptions?: Record<string, string>;

  // Capabilities
  capabilities: SupplierCapabilities;
  certifications: string[];

  // Capacity
  capacity: SupplierCapacity;

  // Pricing
  pricing: SupplierPricing;

  // Location
  headquarters: string;
  shippingLocations: string[];
  warehouses?: string[];

  // GRAIN Integration
  grainEnabled: boolean;
  grainAccountId?: string;

  // Trust & Reputation
  trustScore: number;
  trustTier: 'new' | 'verified' | 'established' | 'trusted' | 'elite' | 'legendary';

  // Performance Metrics
  performance: SupplierPerformance;

  // Status
  status: 'pending' | 'active' | 'paused' | 'rejected';
  onboardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierCapabilities {
  dropShipCapable: boolean;
  whiteLabelCapable: boolean;
  customizationLevel: 'none' | 'basic' | 'advanced' | 'full';
  minOrderFlexibility: 'strict' | 'negotiable' | 'flexible';
  rushOrderCapable: boolean;
  technicalSpecs?: Record<string, string>;
}

export interface SupplierCapacity {
  monthlyVolume: number;
  monthlyVolumeUnit: string;
  currentUtilization: number; // 0-100%
  leadTimeStandard: number; // days
  leadTimeRush: number; // days
  canHandleVolume: (quantity: number) => boolean;
}

export interface SupplierPricing {
  minimumOrder: number;
  currency: string;
  paymentTerms: string;
  priceRanges?: PriceRange[];
  discountTiers?: DiscountTier[];
  competitiveIndex?: number; // 0-100, relative to category avg
}

export interface PriceRange {
  productCategory: string;
  minPrice: number;
  maxPrice: number;
  unit: string;
}

export interface DiscountTier {
  minQuantity: number;
  discountPct: number;
}

export interface SupplierPerformance {
  totalDeals: number;
  completedDeals: number;
  onTimeDeliveryRate: number;
  qualityRating: number; // 0-5
  responseTimeHours: number;
  disputeRate: number;
  repeatCustomerRate: number;
}

// ============================================================================
// MATCH TYPES
// ============================================================================

export type MatchStatus = 'pending' | 'sent' | 'viewed' | 'interested' | 'rejected' | 'connected' | 'deal_started' | 'deal_completed';

export interface SourcingMatch {
  id: string;
  requestId: string;
  supplierId: string;

  // Scores
  overallScore: number; // 0-100
  scoreBreakdown: MatchScoreBreakdown;

  // Match reasoning
  reasoning: string;
  strengths: string[];
  concerns: string[];

  // Estimates
  estimatedPrice?: number;
  estimatedLeadTime?: number;
  estimatedCapacityFit: 'exact' | 'good' | 'possible' | 'stretch';

  // Status tracking
  status: MatchStatus;

  // Introduction
  introductionId?: string;
  introducedAt?: Date;
  buyerViewedAt?: Date;
  buyerRespondedAt?: Date;
  supplierViewedAt?: Date;
  supplierRespondedAt?: Date;

  // Deal progression
  dealRoomId?: string;
  transactionId?: string;

  // Attribution
  feeEarned?: number;
  feeCapturedAt?: Date;

  // Metadata
  matchedAt: Date;
  updatedAt: Date;
}

export interface MatchScoreBreakdown {
  categoryMatch: ScoreComponent;
  capabilityMatch: ScoreComponent;
  locationMatch: ScoreComponent;
  capacityMatch: ScoreComponent;
  grainBonus: ScoreComponent;
  trustScore: ScoreComponent;
  priceCompetitiveness: ScoreComponent;

  // Weighted total
  weightedTotal: number;

  // Confidence
  confidence: 'high' | 'medium' | 'low';
  confidenceReasons: string[];
}

export interface ScoreComponent {
  score: number; // 0-100
  weight: number; // 0-1
  weighted: number; // score * weight
  explanation: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// SCORING CONFIGURATION
// ============================================================================

export interface ScoringConfig {
  weights: ScoringWeights;
  thresholds: MatchThresholds;
  bonuses: BonusConfig;
  penalties: PenaltyConfig;
}

export interface ScoringWeights {
  categoryMatch: number;
  capabilityMatch: number;
  locationMatch: number;
  capacityMatch: number;
  grainBonus: number;
  trustScore: number;
  priceCompetitiveness: number;
}

export interface MatchThresholds {
  strongMatch: number; // 80+
  goodMatch: number; // 60-79
  possibleMatch: number; // 40-59
  minimumScore: number; // Below this = no match
}

export interface BonusConfig {
  grainEnabled: number;
  exactCategoryMatch: number;
  allCertificationsMet: number;
  fastDelivery: number;
  highTrustTier: number;
  repeatPartnership: number;
}

export interface PenaltyConfig {
  missingCertification: number;
  capacityStrain: number;
  longLeadTime: number;
  pricePremium: number;
  lowTrustScore: number;
}

// ============================================================================
// INTRODUCTION TYPES
// ============================================================================

export type IntroStatus = 'draft' | 'sent' | 'opened' | 'buyer_interested' | 'buyer_passed' | 'supplier_interested' | 'supplier_passed' | 'mutual_interest' | 'deal_room_created';

export interface Introduction {
  id: string;
  matchId: string;
  requestId: string;
  buyerId: string;
  supplierId: string;

  // Content
  buyerIntroMessage: string;
  supplierIntroMessage: string;

  // Summarized info
  requestSummary: string;
  supplierSummary: string;

  // Status
  status: IntroStatus;

  // Tracking
  sentAt?: Date;
  buyerOpenedAt?: Date;
  buyerRespondedAt?: Date;
  buyerResponse?: 'interested' | 'passed' | 'need_more_info';
  supplierOpenedAt?: Date;
  supplierRespondedAt?: Date;
  supplierResponse?: 'interested' | 'passed' | 'need_more_info';

  // Deal room
  dealRoomCreatedAt?: Date;
  dealRoomId?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ATTRIBUTION TYPES
// ============================================================================

export type AttributionStatus = 'pending' | 'attributed' | 'fee_calculated' | 'fee_captured' | 'expired';

export interface MatchAttribution {
  id: string;
  matchId: string;
  requestId: string;
  supplierId: string;
  buyerId: string;

  // Tracking
  matchedAt: Date;
  introducedAt?: Date;
  dealStartedAt?: Date;
  transactionId?: string;
  transactionCompletedAt?: Date;

  // Attribution window
  attributionWindowDays: number;
  attributionExpiresAt: Date;

  // Fee calculation
  transactionValue?: number;
  feePercentage: number; // 1% = 0.01
  feeAmount?: number;
  feeCurrency: string;

  // Status
  status: AttributionStatus;

  // Payment
  feeInvoiceId?: string;
  feePaidAt?: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// AI ASSIST TYPES
// ============================================================================

export interface ParsedRequest {
  // Extracted from natural language
  title: string;
  description: string;

  // Category inference
  inferredCategory: string;
  categoryConfidence: number;
  alternativeCategories?: string[];

  // Extracted specs
  extractedSpecs: ProductSpecification[];

  // Quantity parsing
  quantity?: number;
  quantityUnit?: string;
  frequency?: 'one-time' | 'monthly' | 'quarterly' | 'annual';

  // Deadline parsing
  deliveryDeadline?: Date;
  urgency: RequestUrgency;

  // Budget parsing
  targetPrice?: number;
  maxPrice?: number;
  currency: string;

  // Location parsing
  deliveryLocation?: string;

  // Missing info
  missingFields: string[];
  suggestedQuestions: string[];
}

export interface SupplierCapabilitySummary {
  headline: string;
  keyStrengths: string[];
  specializations: string[];
  capacityHighlight: string;
  certificationHighlight: string;
  trustHighlight: string;
}

export interface GeneratedIntroMessage {
  forBuyer: {
    subject: string;
    body: string;
  };
  forSupplier: {
    subject: string;
    body: string;
  };
}

// ============================================================================
// API TYPES
// ============================================================================

export interface MatchRequest {
  requestId?: string;
  rawRequest?: string;
  parsedRequest?: Partial<SourcingRequest>;
  maxResults?: number;
  minScore?: number;
  requireGrain?: boolean;
  categoryOverride?: string;
}

export interface MatchResponse {
  matches: SourcingMatch[];
  request: SourcingRequest;
  totalSuppliersConsidered: number;
  matchingDuration: number;
  timestamp: Date;
}

export interface OpportunityRequest {
  supplierId: string;
  categories?: string[];
  maxResults?: number;
  minScore?: number;
}

export interface OpportunityResponse {
  opportunities: SourcingMatch[];
  supplier: SupplierProfile;
  totalRequestsConsidered: number;
  timestamp: Date;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    categoryMatch: 0.20,
    capabilityMatch: 0.15,
    locationMatch: 0.10,
    capacityMatch: 0.15,
    grainBonus: 0.10, // GRAIN is our moat
    trustScore: 0.15,
    priceCompetitiveness: 0.15,
  },
  thresholds: {
    strongMatch: 80,
    goodMatch: 60,
    possibleMatch: 40,
    minimumScore: 30,
  },
  bonuses: {
    grainEnabled: 15,
    exactCategoryMatch: 10,
    allCertificationsMet: 10,
    fastDelivery: 5,
    highTrustTier: 10,
    repeatPartnership: 10,
  },
  penalties: {
    missingCertification: -15,
    capacityStrain: -10,
    longLeadTime: -10,
    pricePremium: -5,
    lowTrustScore: -15,
  },
};

export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 90;
export const DEFAULT_SOURCING_FEE_PERCENTAGE = 0.01; // 1%
