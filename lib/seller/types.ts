/**
 * Seller GTM & Sales Types
 * Complete type definitions for seller journey
 */

// =====================================================
// SELLER PROFILE & CATALOG
// =====================================================

export interface SellerProfile {
  id: string;
  userId: string;
  companyName: string;
  companyDescription?: string;
  website?: string;
  logoUrl?: string;

  // Business details
  industry?: string;
  companySize?: 'startup' | 'small' | 'medium' | 'enterprise';
  yearsInBusiness?: number;
  locations?: string[];

  // Capabilities
  categories?: string[];
  certifications?: string[];
  minOrderValue?: number;
  maxOrderValue?: number;
  typicalLeadTimeDays?: number;

  // Payment
  acceptedPaymentMethods?: string[];
  defaultPaymentTerms?: string;

  // AI settings
  aiEnabled: boolean;
  aiAggression: 'conservative' | 'balanced' | 'aggressive';
  autoQuoteEnabled: boolean;
  autoNegotiateEnabled: boolean;
  minMarginPercent: number;

  // GTM settings
  gtmEnabled: boolean;
  gtmBudgetMonthly?: number;
  gtmTargetIndustries?: string[];
  gtmTargetCompanySizes?: string[];
  gtmTargetLocations?: string[];

  // Status
  status: 'pending' | 'verified' | 'suspended';
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogItem {
  id: string;
  sellerId: string;

  // Product info
  sku?: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;

  // Pricing
  basePrice: number;
  currency: string;
  priceUnit: string;
  minQuantity: number;

  // Volume discounts
  volumeDiscounts?: VolumeDiscount[];

  // Availability
  inStock: boolean;
  stockQuantity?: number;
  leadTimeDays?: number;

  // AI pricing
  aiPricingEnabled: boolean;
  floorPrice?: number;
  ceilingPrice?: number;
  competitorMatch: boolean;

  // Metadata
  tags?: string[];
  images?: string[];
  specifications?: Record<string, any>;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VolumeDiscount {
  minQty: number;
  discountPercent: number;
}

// =====================================================
// REACTIVE: RFQ MATCHING
// =====================================================

export interface RFQMatch {
  id: string;
  sellerId: string;
  rfqId: string;

  // Match details
  matchScore: number;
  matchReasons: string[];

  // Response tracking
  status: 'pending' | 'viewed' | 'quoted' | 'declined' | 'expired';
  viewedAt?: Date;
  respondedAt?: Date;
  declineReason?: string;

  // Auto-quote
  autoQuoted: boolean;
  quoteId?: string;

  expiresAt: Date;
  createdAt: Date;

  // Joined data
  rfq?: {
    id: string;
    category: string;
    description: string;
    quantity: number;
    targetPrice?: number;
    urgency: string;
    buyerCompany?: string;
  };
}

export interface QuoteDraft {
  id: string;
  sellerId: string;
  rfqId: string;
  matchId: string;

  // Quote details
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  totalPrice: number;

  // Terms
  leadTimeDays: number;
  paymentTerms: string;
  validityDays: number;
  notes?: string;

  // AI
  aiSuggested: boolean;
  aiConfidence?: number;
  aiRationale?: string;

  status: 'draft' | 'submitted' | 'expired';
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteLineItem {
  catalogId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// =====================================================
// PROACTIVE: GTM & OUTBOUND
// =====================================================

export interface ICP {
  id: string;
  sellerId: string;

  name: string;
  description?: string;

  // Targeting
  industries?: string[];
  companySizes?: string[];
  companySizeMin?: number;
  companySizeMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  locations?: string[];

  // Title targeting
  targetTitles?: string[];
  decisionMakerLevel?: string[];

  // Signals
  buyingSignals?: string[];
  technologies?: string[];

  // Scoring weights
  weights?: ICPWeights;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICPWeights {
  industry: number;
  size: number;
  title: number;
  signals: number;
  location: number;
}

export interface Lead {
  id: string;
  sellerId: string;
  icpId?: string;

  // Company
  companyName: string;
  companyDomain?: string;
  companyLinkedin?: string;
  companyIndustry?: string;
  companySize?: string;
  companyEmployeeCount?: number;
  companyRevenueEstimate?: number;
  companyLocation?: string;
  companyDescription?: string;

  // Contact
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLinkedin?: string;

  // Scoring
  leadScore: number;
  scoreBreakdown?: Record<string, number>;

  // Signals
  buyingSignals?: BuyingSignal[];

  // Source
  source: 'apollo' | 'linkedin' | 'wells_network' | 'referral' | 'inbound' | 'manual';
  sourceData?: Record<string, any>;

  // Status
  status: LeadStatus;
  qualifiedAt?: Date;

  // Enrichment
  enriched: boolean;
  enrichedAt?: Date;
  enrichmentData?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export type LeadStatus =
  | 'new'
  | 'researching'
  | 'qualified'
  | 'outreach'
  | 'engaged'
  | 'opportunity'
  | 'won'
  | 'lost'
  | 'nurture';

export interface BuyingSignal {
  signal: string;
  data?: Record<string, any>;
  detectedAt: Date;
}

export interface Campaign {
  id: string;
  sellerId: string;
  icpId?: string;

  name: string;
  description?: string;
  type: 'email_sequence' | 'linkedin' | 'multi_channel' | 'event' | 'referral';

  // Targeting
  targetLeadScoreMin: number;
  targetStatuses: LeadStatus[];
  maxLeadsPerDay: number;

  // Content
  templates: CampaignStep[];

  // AI
  aiPersonalization: boolean;
  aiTimingOptimization: boolean;
  aiAbTesting: boolean;

  // Schedule
  sendDays: string[];
  sendHoursStart: number;
  sendHoursEnd: number;
  timezone: string;

  // Limits
  dailySendLimit: number;
  totalBudget?: number;

  // Status
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;

  // Stats
  stats: CampaignStats;

  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignStep {
  step: number;
  channel: 'email' | 'linkedin' | 'sms' | 'call';
  subject?: string;
  body: string;
  delayDays: number;
}

export interface CampaignStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalMeetings: number;
  totalOpportunities: number;
}

export interface Outreach {
  id: string;
  sellerId: string;
  campaignId?: string;
  leadId: string;

  // Message
  channel: 'email' | 'linkedin' | 'sms' | 'call';
  stepNumber: number;
  subject?: string;
  body: string;

  // AI
  aiGenerated: boolean;
  aiPersonalizationData?: Record<string, any>;

  // Scheduling
  scheduledAt?: Date;
  sentAt?: Date;

  // Engagement
  status: OutreachStatus;
  openedAt?: Date;
  clickedAt?: Date;
  repliedAt?: Date;

  // Response
  responseText?: string;
  responseSentiment?: 'positive' | 'neutral' | 'negative';

  // Next action
  nextAction?: string;
  nextActionAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type OutreachStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'unsubscribed';

// =====================================================
// PIPELINE & OPPORTUNITIES
// =====================================================

export interface PipelineStage {
  id: string;
  sellerId: string;
  name: string;
  description?: string;
  orderIndex: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
  requiredActions?: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface Opportunity {
  id: string;
  sellerId: string;
  leadId?: string;
  rfqId?: string;

  name: string;
  description?: string;

  // Value
  amount: number;
  currency: string;
  probability: number;
  weightedAmount: number;

  // Pipeline
  stageId: string;
  stageEnteredAt: Date;
  stage?: PipelineStage;

  // Source
  source: 'rfq' | 'outbound' | 'inbound' | 'referral';
  campaignId?: string;

  // Timing
  expectedCloseDate?: Date;

  // Products
  lineItems?: OpportunityLineItem[];

  // Competition
  competitors?: string[];
  competitiveNotes?: string;

  // Next steps
  nextStep?: string;
  nextStepDate?: Date;

  // Status
  status: 'open' | 'won' | 'lost';
  wonAt?: Date;
  lostAt?: Date;
  lostReason?: string;

  // Link
  dealId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface OpportunityLineItem {
  catalogId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OpportunityActivity {
  id: string;
  opportunityId: string;
  sellerId: string;

  type: 'email' | 'call' | 'meeting' | 'proposal' | 'negotiation' | 'note' | 'stage_change';
  title: string;
  description?: string;

  outreachId?: string;
  quoteId?: string;
  negotiationId?: string;

  fromStageId?: string;
  toStageId?: string;

  scheduledAt?: Date;
  completedAt?: Date;
  outcome?: string;

  createdAt: Date;
}

// =====================================================
// ANALYTICS
// =====================================================

export interface SellerDailyMetrics {
  id: string;
  sellerId: string;
  metricDate: Date;

  // RFQ metrics
  rfqsReceived: number;
  rfqsViewed: number;
  rfqsQuoted: number;
  rfqsWon: number;
  rfqResponseRate: number;
  rfqWinRate: number;
  rfqRevenue: number;

  // GTM metrics
  leadsDiscovered: number;
  leadsQualified: number;
  outreachSent: number;
  outreachOpened: number;
  outreachReplied: number;
  meetingsBooked: number;

  // Pipeline
  opportunitiesCreated: number;
  opportunitiesWon: number;
  opportunitiesLost: number;
  pipelineValue: number;
  closedRevenue: number;

  // AI
  aiQuotesGenerated: number;
  aiNegotiationsRun: number;
  aiOutreachPersonalized: number;

  createdAt: Date;
}

// =====================================================
// API RESPONSES
// =====================================================

export interface SellerDashboardResponse {
  profile: SellerProfile;
  stats: {
    todayMetrics: Partial<SellerDailyMetrics>;
    weekMetrics: Partial<SellerDailyMetrics>;
    monthMetrics: Partial<SellerDailyMetrics>;
  };
  recentRfqs: RFQMatch[];
  hotLeads: Lead[];
  activeOpportunities: Opportunity[];
  pendingOutreach: Outreach[];
}

export interface LeadDiscoveryRequest {
  icpId?: string;
  limit?: number;
  sources?: string[];
  enrichImmediately?: boolean;
}

export interface LeadDiscoveryResponse {
  success: boolean;
  leadsFound: number;
  leads: Lead[];
  creditsUsed?: number;
}

export interface OutreachGenerateRequest {
  leadId: string;
  campaignId?: string;
  channel: 'email' | 'linkedin';
  tone?: 'formal' | 'casual' | 'friendly';
  focus?: string; // What to emphasize
}

export interface OutreachGenerateResponse {
  success: boolean;
  outreach: {
    subject?: string;
    body: string;
    personalizationUsed: string[];
  };
}

export interface QuoteSuggestionRequest {
  rfqId: string;
  matchId: string;
}

export interface QuoteSuggestionResponse {
  success: boolean;
  suggestion: QuoteDraft;
  rationale: string;
  competitiveAnalysis?: {
    marketRange: { low: number; high: number };
    recommendedPosition: string;
  };
}
