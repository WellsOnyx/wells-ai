/**
 * Seller AI Agent System
 *
 * The counterpart to the buyer side - allows sellers/vendors to have
 * Wells represent them in negotiations. This is the core of the
 * AI-to-AI negotiation system from the seller perspective.
 *
 * Key Features:
 * 1. Agent configuration (pricing rules, negotiation style)
 * 2. Automatic RFQ response and quote generation
 * 3. AI-powered negotiation handling
 * 4. Catalog management with import capabilities
 * 5. Performance analytics and insights
 *
 * @example
 * ```typescript
 * const agent = new SellerAgent();
 *
 * // Configure the agent
 * await agent.configureAgent(sellerId, {
 *   minMargin: 15,
 *   maxDiscount: 20,
 *   autoApproveBelow: 5000,
 *   negotiationStyle: 'balanced'
 * });
 *
 * // Receive an RFQ and generate quote
 * const response = await agent.receiveRFQ(sellerId, rfq);
 *
 * // Handle counter-offers in negotiation
 * const counter = await agent.respondToCounter(sellerId, sessionId, counterOffer);
 * ```
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import {
  SellerAIConfig,
  getDefaultConfig,
  saveSellerConfig,
  getSellerConfig,
  updateSellerConfig,
  PricingStrategy,
  NegotiationStyle,
  AutoResponseSettings,
} from './ai-agent-config';
import {
  CatalogService,
  CatalogProduct,
  getCatalogSummary,
  getSellerCatalog,
  searchCatalog,
  CatalogSummary,
  VolumeDiscount,
} from './catalog-service';
import {
  CatalogIngestion,
  ingestFromCSV,
  ingestFromShopify,
  IngestionJob,
} from './catalog-ingestion';
import {
  QuoteGenerator,
  generateQuoteForRFQ,
  approveQuote,
  rejectQuote,
  counterQuote,
  getSellerQuotes,
  GeneratedQuote,
  RFQRequest,
} from './quote-generator';
import {
  SellerNegotiationAgent,
  NegotiationSession,
  startNegotiation,
  processBuyerOffer,
  sellerManualResponse,
  getSellerNegotiations,
} from './seller-negotiation-agent';
import {
  PerformanceTracker,
  getSellerMetrics,
  generatePerformanceReport,
  generateInsights,
  PerformanceReport,
  SellerMetrics,
  PerformanceInsight,
} from './performance-tracker';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES - Seller Agent Configuration
// ============================================================================

export interface SellerAgentConfig {
  // Pricing strategy
  minMargin: number; // e.g., 15% minimum margin
  maxDiscount: number; // e.g., 20% max discount from list price
  autoApproveBelow: number; // Auto-approve deals under this amount

  // Response behavior
  responseTimeTarget: 'immediate' | 'within_hour' | 'within_day';
  negotiationStyle: 'aggressive' | 'balanced' | 'accommodating';

  // Preferences
  preferredPaymentTerms: string[];
  excludedBuyers?: string[]; // Buyers to not work with
  priorityBuyers?: string[]; // VIP buyers get better terms

  // Volume discount tiers
  volumeDiscountTiers?: {
    minQuantity: number;
    discountPercent: number;
    description?: string;
  }[];

  // Rush order settings
  rushOrderPremium?: number; // Percentage premium for rush orders
  standardLeadTimeDays?: number;
  rushLeadTimeDays?: number;

  // Auto-response limits
  requireApprovalAbove?: number; // Always require approval above this amount
  autoApproveMarginOver?: number; // Auto-approve if margin exceeds this
}

export interface RFQ {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerCompany?: string;
  productDescription: string;
  category?: string;
  quantity: number;
  targetPrice?: number;
  currency: string;
  urgency: 'standard' | 'urgent' | 'critical';
  requiredByDate?: Date;
  qualityRequirements?: string[];
  certifications?: string[];
  deliveryLocation: string;
  additionalNotes?: string;
  createdAt: Date;
}

export interface RFQResponse {
  accepted: boolean;
  quote?: Quote;
  message: string;
  autoApproved: boolean;
  requiresReview: boolean;
  estimatedResponseTime?: string;
  matchedProducts: string[];
  confidence: number;
}

export interface Quote {
  id: string;
  rfqId: string;
  sellerId: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discount: number;
  discountReason?: string;
  shipping: number;
  rushFee: number;
  total: number;
  currency: string;
  margin: number;
  validUntil: Date;
  paymentTerms: string;
  deliveryTerms: string;
  leadTimeDays: number;
  notes?: string;
  status: 'draft' | 'pending' | 'sent' | 'accepted' | 'rejected' | 'negotiating';
  createdAt: Date;
}

export interface QuoteLineItem {
  productId: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sku?: string;
}

export interface CounterOffer {
  proposedPrice: number;
  proposedQuantity?: number;
  proposedDeliveryDate?: Date;
  message?: string;
  buyerConstraints?: {
    maxBudget?: number;
    mustHaveDate?: Date;
    flexibleOnQuantity?: boolean;
  };
}

export interface CounterResponse {
  action: 'accept' | 'counter' | 'reject' | 'escalate';
  counterPrice?: number;
  counterTerms?: Partial<Quote>;
  message: string;
  reasoning: string;
  confidence: number;
  requiresHumanApproval: boolean;
}

export interface CatalogImportResult {
  success: boolean;
  jobId: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: Array<{ row: number; error: string }>;
  productsCreated: string[];
  productsUpdated: string[];
}

export interface PricingUpdate {
  productId?: string;
  category?: string;
  adjustmentType: 'percentage' | 'fixed';
  adjustmentAmount: number;
  applyToAll?: boolean;
}

export interface PricingRule {
  id: string;
  sellerId: string;
  ruleType: 'volume_discount' | 'buyer_tier' | 'seasonal' | 'margin_floor' | 'custom';
  name: string;
  conditions: Record<string, unknown>;
  adjustments: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

export interface SellerMetricsResponse {
  period: { start: Date; end: Date };
  rfqsReceived: number;
  quotesGenerated: number;
  quotesAccepted: number;
  winRate: number;
  totalRevenue: number;
  averageOrderValue: number;
  averageMargin: number;
  averageResponseTimeHours: number;
  topCategories: Array<{ category: string; revenue: number; count: number }>;
  negotiationStats: {
    total: number;
    won: number;
    averageDiscount: number;
    averageRounds: number;
  };
}

export interface RFQHistoryItem {
  rfqId: string;
  buyerCompany: string;
  productDescription: string;
  quantity: number;
  quoteAmount?: number;
  status: 'pending' | 'quoted' | 'won' | 'lost' | 'expired';
  createdAt: Date;
  respondedAt?: Date;
  outcome?: string;
}

// ============================================================================
// SELLER AGENT CONTEXT
// ============================================================================

export interface SellerAgentContext {
  sellerId: string;
  config?: SellerAIConfig;
  catalogSummary?: CatalogSummary;
  pendingQuotes?: GeneratedQuote[];
  activeNegotiations?: NegotiationSession[];
  recentMetrics?: SellerMetrics;
  conversationHistory: ConversationTurn[];
  currentIntent?: SellerIntent;
  pendingAction?: PendingAction;
}

export interface ConversationTurn {
  role: 'seller' | 'wells';
  content: string;
  timestamp: Date;
  intent?: SellerIntent;
  action?: ActionResult;
}

export type SellerIntent =
  | 'setup_profile'
  | 'add_products'
  | 'import_catalog'
  | 'update_pricing'
  | 'configure_agent'
  | 'review_quote'
  | 'approve_quote'
  | 'reject_quote'
  | 'counter_quote'
  | 'handle_negotiation'
  | 'get_performance'
  | 'get_insights'
  | 'general_question'
  | 'unknown';

export interface ActionResult {
  success: boolean;
  action: string;
  data?: Record<string, unknown>;
  message: string;
}

export interface PendingAction {
  type: 'confirm_catalog_import' | 'confirm_quote' | 'confirm_pricing_update' | 'confirm_config_change';
  data: Record<string, unknown>;
  expiresAt: Date;
}

export interface ChatResponse {
  message: string;
  intent: SellerIntent;
  action?: ActionResult;
  suggestions?: string[];
  quickActions?: QuickAction[];
  data?: {
    config?: Partial<SellerAIConfig>;
    catalog?: CatalogSummary;
    quotes?: GeneratedQuote[];
    negotiations?: NegotiationSession[];
    performance?: PerformanceReport;
    insights?: PerformanceInsight[];
  };
}

export interface QuickAction {
  label: string;
  action: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// SELLER TOOLS - Used by AI for function calling
// ============================================================================

const SELLER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'upload_catalog',
    description: 'Import product catalog from CSV data or file',
    input_schema: {
      type: 'object' as const,
      properties: {
        csvContent: { type: 'string', description: 'CSV content as string' },
        source: { type: 'string', enum: ['csv', 'shopify', 'erp'], description: 'Import source' },
      },
      required: ['source'],
    },
  },
  {
    name: 'add_products',
    description: 'Add products to catalog via natural language',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string', description: 'Natural language description of products' },
      },
      required: ['description'],
    },
  },
  {
    name: 'update_pricing',
    description: 'Update pricing rules or product prices',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['global_adjustment', 'volume_discount', 'product_specific'], description: 'Type of update' },
        adjustmentPercent: { type: 'number', description: 'Percentage adjustment' },
        category: { type: 'string', description: 'Category to apply to (optional)' },
        volumeDiscount: {
          type: 'object',
          properties: {
            minQuantity: { type: 'number' },
            discountPercent: { type: 'number' },
          },
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'configure_agent',
    description: 'Configure the seller AI agent settings',
    input_schema: {
      type: 'object' as const,
      properties: {
        minMargin: { type: 'number', description: 'Minimum acceptable margin percentage' },
        targetMargin: { type: 'number', description: 'Target margin percentage' },
        autoApproveUnder: { type: 'number', description: 'Auto-approve quotes under this amount' },
        negotiationStyle: { type: 'string', enum: ['conservative', 'balanced', 'aggressive'] },
        standardLeadTime: { type: 'number', description: 'Standard lead time in days' },
        minOrderValue: { type: 'number', description: 'Minimum order value' },
      },
    },
  },
  {
    name: 'review_quote',
    description: 'Review a pending quote and provide details',
    input_schema: {
      type: 'object' as const,
      properties: {
        quoteId: { type: 'string', description: 'Quote ID to review' },
        listPending: { type: 'boolean', description: 'List all pending quotes' },
      },
    },
  },
  {
    name: 'approve_quote',
    description: 'Approve a quote to send to buyer',
    input_schema: {
      type: 'object' as const,
      properties: {
        quoteId: { type: 'string', description: 'Quote ID to approve' },
        adjustedPrice: { type: 'number', description: 'Optional adjusted price' },
      },
      required: ['quoteId'],
    },
  },
  {
    name: 'reject_quote',
    description: 'Reject or decline a quote',
    input_schema: {
      type: 'object' as const,
      properties: {
        quoteId: { type: 'string', description: 'Quote ID to reject' },
        reason: { type: 'string', description: 'Reason for rejection' },
      },
      required: ['quoteId'],
    },
  },
  {
    name: 'counter_quote',
    description: 'Counter a quote with a different price',
    input_schema: {
      type: 'object' as const,
      properties: {
        quoteId: { type: 'string', description: 'Quote ID to counter' },
        newPrice: { type: 'number', description: 'New total price' },
      },
      required: ['quoteId', 'newPrice'],
    },
  },
  {
    name: 'handle_negotiation',
    description: 'Respond to an active negotiation',
    input_schema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'Negotiation session ID' },
        action: { type: 'string', enum: ['accept', 'counter', 'reject'] },
        counterPrice: { type: 'number', description: 'Counter offer price (if countering)' },
        message: { type: 'string', description: 'Message to buyer' },
      },
      required: ['sessionId', 'action'],
    },
  },
  {
    name: 'get_performance',
    description: 'Get performance metrics and analytics',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'quarter', 'year'], description: 'Time period' },
        includeInsights: { type: 'boolean', description: 'Include AI-generated insights' },
      },
    },
  },
];

// ============================================================================
// SELLER AGENT CLASS
// ============================================================================

export class SellerAgent {
  private context: SellerAgentContext | null = null;

  constructor() {
    // Stateless constructor - context loaded per operation
  }

  // ==========================================================================
  // AGENT CONFIGURATION
  // ==========================================================================

  /**
   * Configure the seller's AI agent
   */
  async configureAgent(sellerId: string, config: SellerAgentConfig): Promise<void> {
    const existingConfig = await getSellerConfig(sellerId);

    const pricingStrategy: PricingStrategy = {
      minMargin: config.minMargin,
      targetMargin: config.minMargin + 15, // Target 15% above minimum
      walkAwayMargin: Math.max(5, config.minMargin - 10),
      volumeDiscountTiers: config.volumeDiscountTiers || [
        { minQuantity: 100, discountPercent: 5 },
        { minQuantity: 500, discountPercent: 10 },
        { minQuantity: 1000, discountPercent: 15 },
      ],
      urgencyPremium: config.rushOrderPremium || 20,
      standardLeadTimeDays: config.standardLeadTimeDays || 7,
      rushLeadTimeDays: config.rushLeadTimeDays || 3,
      repeatCustomerDiscount: 5,
      firstOrderDiscount: 10,
    };

    const negotiationStyle: NegotiationStyle = {
      aggression: config.negotiationStyle,
      maxConcessions: config.negotiationStyle === 'aggressive' ? 2 : config.negotiationStyle === 'accommodating' ? 5 : 3,
      concessionSize: config.negotiationStyle === 'aggressive' ? 15 : config.negotiationStyle === 'accommodating' ? 35 : 25,
      walkAwayThreshold: 10,
      requireJustification: config.negotiationStyle === 'aggressive',
      bundleUpsell: true,
    };

    const autoResponse: AutoResponseSettings = {
      enabled: true,
      quoteResponseHours: config.responseTimeTarget === 'immediate' ? 0.5 :
        config.responseTimeTarget === 'within_hour' ? 1 : 24,
      autoApproveUnder: config.autoApproveBelow,
      requireApprovalOver: config.requireApprovalAbove || config.autoApproveBelow * 5,
      autoApproveMarginOver: config.autoApproveMarginOver || config.minMargin + 10,
      workingHoursOnly: config.responseTimeTarget !== 'immediate',
      workingHoursStart: 9,
      workingHoursEnd: 17,
      workingDays: [1, 2, 3, 4, 5],
    };

    if (existingConfig) {
      await updateSellerConfig(sellerId, {
        pricingStrategy,
        negotiationStyle,
        autoResponse,
      });
    } else {
      const defaults = getDefaultConfig(sellerId);
      await saveSellerConfig({
        id: `seller_${sellerId}_${Date.now()}`,
        sellerId,
        companyName: 'My Company',
        businessDescription: '',
        productCategories: [],
        specializations: [],
        pricingStrategy,
        negotiationStyle,
        autoResponse,
        notifications: defaults.notifications!,
        preferredContactMethod: 'email',
        contactEmail: '',
        agentTone: 'professional',
        valuePropositions: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Store excluded and priority buyers
    if (config.excludedBuyers || config.priorityBuyers) {
      await sql`
        INSERT INTO seller_buyer_preferences (seller_id, excluded_buyers, priority_buyers, updated_at)
        VALUES (${sellerId}, ${JSON.stringify(config.excludedBuyers || [])}, ${JSON.stringify(config.priorityBuyers || [])}, NOW())
        ON CONFLICT (seller_id) DO UPDATE SET
          excluded_buyers = ${JSON.stringify(config.excludedBuyers || [])},
          priority_buyers = ${JSON.stringify(config.priorityBuyers || [])},
          updated_at = NOW()
      `;
    }

    // Store payment terms
    if (config.preferredPaymentTerms?.length) {
      await sql`
        UPDATE seller_ai_configs
        SET preferred_payment_terms = ${JSON.stringify(config.preferredPaymentTerms)}
        WHERE seller_id = ${sellerId}
      `;
    }
  }

  // ==========================================================================
  // RFQ HANDLING
  // ==========================================================================

  /**
   * Receive and process an RFQ
   */
  async receiveRFQ(sellerId: string, rfq: RFQ): Promise<RFQResponse> {
    const config = await getSellerConfig(sellerId);
    if (!config || !config.isActive) {
      return {
        accepted: false,
        message: 'Seller agent is not active',
        autoApproved: false,
        requiresReview: true,
        matchedProducts: [],
        confidence: 0,
      };
    }

    // Check if buyer is excluded
    const buyerPrefs = await this.getBuyerPreferences(sellerId);
    if (buyerPrefs.excludedBuyers?.includes(rfq.buyerId)) {
      return {
        accepted: false,
        message: 'This buyer is on the exclusion list',
        autoApproved: false,
        requiresReview: false,
        matchedProducts: [],
        confidence: 1,
      };
    }

    // Convert to RFQRequest format
    const rfqRequest: RFQRequest = {
      id: rfq.id,
      buyerId: rfq.buyerId,
      buyerName: rfq.buyerName,
      buyerCompany: rfq.buyerCompany,
      productDescription: rfq.productDescription,
      category: rfq.category,
      quantity: rfq.quantity,
      targetPrice: rfq.targetPrice,
      currency: rfq.currency,
      urgency: rfq.urgency,
      requiredByDate: rfq.requiredByDate,
      qualityRequirements: rfq.qualityRequirements,
      certifications: rfq.certifications,
      deliveryLocation: rfq.deliveryLocation,
      additionalNotes: rfq.additionalNotes,
      createdAt: rfq.createdAt,
    };

    try {
      const result = await generateQuoteForRFQ(sellerId, rfqRequest);

      // Convert to Quote format
      const quote: Quote = {
        id: result.quote.id,
        rfqId: result.quote.rfqId,
        sellerId: result.quote.sellerId,
        lineItems: result.quote.lineItems.map(li => ({
          productId: li.productId,
          productName: li.productName,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          totalPrice: li.totalPrice,
        })),
        subtotal: result.quote.subtotal,
        discount: result.quote.discountAmount,
        discountReason: result.quote.discountReason,
        shipping: result.quote.shippingCost,
        rushFee: result.quote.rushFee,
        total: result.quote.total,
        currency: result.quote.currency,
        margin: result.quote.calculatedMargin,
        validUntil: result.quote.validUntil,
        paymentTerms: result.quote.paymentTerms,
        deliveryTerms: result.quote.deliveryTerms,
        leadTimeDays: result.quote.lineItems[0]?.leadTimeDays || 7,
        status: result.quote.status === 'sent' ? 'sent' : 'pending',
        createdAt: result.quote.createdAt,
      };

      // Check if priority buyer for better terms
      const isPriority = buyerPrefs.priorityBuyers?.includes(rfq.buyerId);
      if (isPriority) {
        quote.discount += quote.subtotal * 0.05; // Additional 5% for priority buyers
        quote.total = quote.subtotal - quote.discount + quote.shipping + quote.rushFee;
      }

      return {
        accepted: true,
        quote,
        message: result.message,
        autoApproved: result.autoSent,
        requiresReview: !result.autoSent,
        estimatedResponseTime: config.autoResponse.quoteResponseHours <= 1 ?
          'Within 1 hour' : `Within ${config.autoResponse.quoteResponseHours} hours`,
        matchedProducts: result.quote.matchedProducts,
        confidence: result.quote.confidenceScore,
      };
    } catch (error) {
      return {
        accepted: false,
        message: error instanceof Error ? error.message : 'Failed to generate quote',
        autoApproved: false,
        requiresReview: true,
        matchedProducts: [],
        confidence: 0,
      };
    }
  }

  /**
   * Generate a quote for an RFQ
   */
  async generateQuote(sellerId: string, rfq: RFQ): Promise<Quote> {
    const response = await this.receiveRFQ(sellerId, rfq);

    if (!response.accepted || !response.quote) {
      throw new Error(response.message);
    }

    return response.quote;
  }

  /**
   * Respond to a counter-offer in a negotiation
   */
  async respondToCounter(
    sellerId: string,
    sessionId: string,
    counter: CounterOffer
  ): Promise<CounterResponse> {
    const config = await getSellerConfig(sellerId);
    if (!config) {
      throw new Error('Seller not configured');
    }

    // Get current negotiation session
    const session = await this.getNegotiationSession(sessionId);
    if (!session) {
      throw new Error('Negotiation session not found');
    }

    // Get the original quote for margin calculation
    const quote = await QuoteGenerator.getQuote(session.quoteId);
    if (!quote) {
      throw new Error('Original quote not found');
    }

    // Calculate if we can accept
    const proposedMargin = this.calculateMargin(
      counter.proposedPrice,
      quote.subtotal * (1 - config.pricingStrategy.targetMargin / 100)
    );

    const canAccept = proposedMargin >= config.pricingStrategy.minMargin;
    const shouldAccept = proposedMargin >= config.pricingStrategy.targetMargin;
    const isWalkAway = proposedMargin < config.pricingStrategy.walkAwayMargin;

    // Use AI to determine best response
    const aiResponse = await this.getAINegotiationResponse(
      config,
      session,
      counter,
      {
        proposedMargin,
        canAccept,
        shouldAccept,
        isWalkAway,
        currentPrice: quote.total,
      }
    );

    // Determine if human approval is needed
    const requiresHumanApproval = aiResponse.action === 'accept' && (
      counter.proposedPrice > (config.autoResponse.requireApprovalOver || Infinity) ||
      proposedMargin < config.pricingStrategy.minMargin + 5
    );

    return {
      action: aiResponse.action,
      counterPrice: aiResponse.counterPrice,
      counterTerms: aiResponse.counterTerms,
      message: aiResponse.message,
      reasoning: aiResponse.reasoning,
      confidence: aiResponse.confidence,
      requiresHumanApproval,
    };
  }

  // ==========================================================================
  // CATALOG MANAGEMENT
  // ==========================================================================

  /**
   * Import product catalog from various sources
   */
  async importCatalog(
    sellerId: string,
    source: 'csv' | 'api' | 'manual',
    data: unknown
  ): Promise<CatalogImportResult> {
    if (source === 'csv') {
      const csvContent = typeof data === 'string' ? data : JSON.stringify(data);
      const job = await ingestFromCSV(sellerId, csvContent);

      return {
        success: job.status === 'completed',
        jobId: job.id,
        totalRecords: job.totalRecords,
        successfulRecords: job.successfulRecords,
        failedRecords: job.failedRecords,
        errors: job.errors.map((e, i) => ({ row: i, error: e.message })),
        productsCreated: [],
        productsUpdated: [],
      };
    }

    if (source === 'api') {
      // Handle API import (Shopify, WooCommerce, etc.)
      const apiConfig = data as { type: 'shopify' | 'woocommerce'; credentials: Record<string, string> };

      if (apiConfig.type === 'shopify') {
        const job = await ingestFromShopify(sellerId, apiConfig.credentials);
        return {
          success: job.status === 'completed',
          jobId: job.id,
          totalRecords: job.totalRecords,
          successfulRecords: job.successfulRecords,
          failedRecords: job.failedRecords,
          errors: job.errors.map((e, i) => ({ row: i, error: e.message })),
          productsCreated: [],
          productsUpdated: [],
        };
      }
    }

    if (source === 'manual') {
      // Handle manual product additions
      const products = data as Array<Partial<CatalogProduct>>;
      const productsCreated: string[] = [];
      const errors: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < products.length; i++) {
        try {
          const product = await CatalogService.createProduct(sellerId, {
            name: products[i].name || 'Unnamed Product',
            description: products[i].description || '',
            category: products[i].category || 'General',
            pricing: products[i].pricing || {
              basePrice: 0,
              currency: 'USD',
              priceUnit: 'unit',
              volumeDiscounts: [],
              minOrderQuantity: 1,
            },
            leadTime: products[i].leadTime || { standardDays: 7 },
            availability: products[i].availability || { inStock: true, madeToOrder: false },
            sourceType: 'manual',
          });
          productsCreated.push(product.id);
        } catch (error) {
          errors.push({
            row: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: errors.length === 0,
        jobId: `manual_${Date.now()}`,
        totalRecords: products.length,
        successfulRecords: productsCreated.length,
        failedRecords: errors.length,
        errors,
        productsCreated,
        productsUpdated: [],
      };
    }

    throw new Error(`Unsupported import source: ${source}`);
  }

  /**
   * Update pricing for products
   */
  async updatePricing(sellerId: string, updates: PricingUpdate[]): Promise<void> {
    for (const update of updates) {
      if (update.applyToAll) {
        await CatalogService.bulkUpdatePrices(sellerId, {
          type: update.adjustmentType,
          amount: update.adjustmentAmount,
          category: update.category,
        });
      } else if (update.productId) {
        const product = await CatalogService.getProduct(update.productId);
        if (product && product.sellerId === sellerId) {
          const newPrice = update.adjustmentType === 'percentage'
            ? product.pricing.basePrice * (1 + update.adjustmentAmount / 100)
            : product.pricing.basePrice + update.adjustmentAmount;

          await CatalogService.updateProduct(update.productId, {
            pricing: {
              ...product.pricing,
              basePrice: newPrice,
            },
          });
        }
      }
    }
  }

  /**
   * Get all pricing rules for a seller
   */
  async getPricingRules(sellerId: string): Promise<PricingRule[]> {
    const result = await sql`
      SELECT * FROM seller_pricing_rules
      WHERE seller_id = ${sellerId} AND is_active = true
      ORDER BY priority DESC
    `;

    return result.rows.map(row => ({
      id: row.id as string,
      sellerId: row.seller_id as string,
      ruleType: row.rule_type as PricingRule['ruleType'],
      name: row.name as string,
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      adjustments: typeof row.adjustments === 'string' ? JSON.parse(row.adjustments) : row.adjustments,
      priority: row.priority as number,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
    }));
  }

  // ==========================================================================
  // ANALYTICS
  // ==========================================================================

  /**
   * Get performance metrics for the seller
   */
  async getPerformanceMetrics(sellerId: string): Promise<SellerMetricsResponse> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const metrics = await getSellerMetrics(sellerId, {
      start: thirtyDaysAgo,
      end: new Date(),
    });

    // Get category breakdown
    const categoryResult = await sql`
      SELECT
        sq.matched_products->0->>'category' as category,
        SUM(sq.total) as revenue,
        COUNT(*) as count
      FROM seller_quotes sq
      WHERE sq.seller_id = ${sellerId}
        AND sq.status = 'accepted'
        AND sq.created_at >= ${thirtyDaysAgo.toISOString()}
      GROUP BY sq.matched_products->0->>'category'
      ORDER BY revenue DESC
      LIMIT 5
    `;

    // Get negotiation stats
    const negotiationResult = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('seller_accepted', 'buyer_accepted')) as won,
        AVG(
          CASE WHEN final_price IS NOT NULL AND initial_seller_price > 0
          THEN ((initial_seller_price - final_price) / initial_seller_price) * 100
          ELSE 0 END
        ) as avg_discount,
        AVG(round) as avg_rounds
      FROM seller_negotiations
      WHERE seller_id = ${sellerId}
        AND created_at >= ${thirtyDaysAgo.toISOString()}
    `;

    const negStats = negotiationResult.rows[0] || {};

    return {
      period: { start: thirtyDaysAgo, end: new Date() },
      rfqsReceived: metrics.rfqsReceived,
      quotesGenerated: metrics.quotesGenerated,
      quotesAccepted: metrics.dealsWon,
      winRate: metrics.winRate,
      totalRevenue: metrics.totalRevenue,
      averageOrderValue: metrics.averageDealSize,
      averageMargin: metrics.averageMargin,
      averageResponseTimeHours: metrics.averageResponseTimeHours,
      topCategories: categoryResult.rows.map(row => ({
        category: row.category as string || 'Unknown',
        revenue: parseFloat(row.revenue as string) || 0,
        count: parseInt(row.count as string) || 0,
      })),
      negotiationStats: {
        total: parseInt(negStats.total as string) || 0,
        won: parseInt(negStats.won as string) || 0,
        averageDiscount: parseFloat(negStats.avg_discount as string) || 0,
        averageRounds: parseFloat(negStats.avg_rounds as string) || 0,
      },
    };
  }

  /**
   * Get RFQ history for the seller
   */
  async getRFQHistory(sellerId: string): Promise<RFQHistoryItem[]> {
    const result = await sql`
      SELECT
        sq.rfq_id,
        sq.seller_company as buyer_company,
        sq.line_items->0->>'productName' as product_description,
        (sq.line_items->0->>'quantity')::integer as quantity,
        sq.total as quote_amount,
        sq.status,
        sq.created_at,
        sq.sent_at as responded_at
      FROM seller_quotes sq
      WHERE sq.seller_id = ${sellerId}
      ORDER BY sq.created_at DESC
      LIMIT 100
    `;

    return result.rows.map(row => ({
      rfqId: row.rfq_id as string,
      buyerCompany: row.buyer_company as string,
      productDescription: row.product_description as string || 'Unknown',
      quantity: row.quantity as number || 0,
      quoteAmount: parseFloat(row.quote_amount as string) || undefined,
      status: this.mapQuoteStatusToRFQStatus(row.status as string),
      createdAt: new Date(row.created_at as string),
      respondedAt: row.responded_at ? new Date(row.responded_at as string) : undefined,
    }));
  }

  // ==========================================================================
  // CONVERSATIONAL INTERFACE
  // ==========================================================================

  /**
   * Main chat interface - process seller message and respond
   */
  async chat(sellerId: string, message: string): Promise<ChatResponse> {
    // Initialize context if needed
    if (!this.context || this.context.sellerId !== sellerId) {
      await this.initializeContext(sellerId);
    }

    // Add seller message to history
    this.context!.conversationHistory.push({
      role: 'seller',
      content: message,
      timestamp: new Date(),
    });

    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt();

    // Process with Claude using tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      tools: SELLER_TOOLS,
      messages: this.context!.conversationHistory.slice(-10).map(turn => ({
        role: turn.role === 'seller' ? 'user' : 'assistant',
        content: turn.content,
      })) as Anthropic.MessageParam[],
    });

    // Process tool calls if any
    let actionResult: ActionResult | undefined;
    let responseMessage = '';
    let intent: SellerIntent = 'unknown';

    for (const block of response.content) {
      if (block.type === 'text') {
        responseMessage += block.text;
      } else if (block.type === 'tool_use') {
        intent = this.mapToolToIntent(block.name);
        actionResult = await this.executeTool(sellerId, block.name, block.input as Record<string, unknown>);

        // If tool was executed, get AI to generate a natural response
        const toolResultResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...this.context!.conversationHistory.slice(-5).map(turn => ({
              role: turn.role === 'seller' ? 'user' : 'assistant',
              content: turn.content,
            })) as Anthropic.MessageParam[],
            { role: 'user', content: message },
            { role: 'assistant', content: [block] },
            {
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(actionResult),
              }],
            },
          ],
        });

        const textContent = toolResultResponse.content.find(b => b.type === 'text');
        if (textContent && textContent.type === 'text') {
          responseMessage = textContent.text;
        }
      }
    }

    // Add Wells response to history
    this.context!.conversationHistory.push({
      role: 'wells',
      content: responseMessage,
      timestamp: new Date(),
      intent,
      action: actionResult,
    });

    // Generate suggestions and quick actions
    const suggestions = this.generateSuggestions(intent);
    const quickActions = this.generateQuickActions(intent);

    return {
      message: responseMessage,
      intent,
      action: actionResult,
      suggestions,
      quickActions,
      data: this.getResponseData(intent),
    };
  }

  /**
   * Handle incoming RFQ via the agent (wrapper for AI-to-AI integration)
   */
  async handleRFQ(sellerId: string, rfq: RFQRequest): Promise<{
    action: 'auto_quote' | 'pending_approval' | 'no_match';
    quote?: GeneratedQuote;
    reason?: string;
  }> {
    await this.initializeContext(sellerId);

    if (!this.context?.config) {
      return { action: 'no_match', reason: 'Seller not configured' };
    }

    try {
      const result = await generateQuoteForRFQ(sellerId, rfq);

      if (result.autoSent) {
        return { action: 'auto_quote', quote: result.quote };
      } else {
        return { action: 'pending_approval', quote: result.quote };
      }
    } catch (error) {
      return {
        action: 'no_match',
        reason: error instanceof Error ? error.message : 'Failed to generate quote',
      };
    }
  }

  /**
   * Handle incoming negotiation offer
   */
  async handleNegotiationOffer(
    sellerId: string,
    sessionId: string,
    offer: { price: number; message?: string }
  ): Promise<{
    session: NegotiationSession;
    response: {
      action: 'accept' | 'counter' | 'reject' | 'escalate';
      counterPrice?: number;
      message: string;
    };
  }> {
    const result = await processBuyerOffer(sessionId, {
      price: offer.price,
      message: offer.message,
    });

    const lastSellerMessage = result.session.messages
      .filter(m => m.from.includes('seller'))
      .pop();

    return {
      session: result.session,
      response: {
        action: result.response.action,
        counterPrice: result.response.counterPrice,
        message: lastSellerMessage?.content.message || result.response.message,
      },
    };
  }

  /**
   * Get seller status summary
   */
  async getStatus(sellerId: string): Promise<{
    configured: boolean;
    catalogProducts: number;
    pendingQuotes: number;
    activeNegotiations: number;
    monthlyRevenue: number;
    winRate: number;
  }> {
    await this.initializeContext(sellerId);

    return {
      configured: !!this.context?.config,
      catalogProducts: this.context?.catalogSummary?.totalProducts || 0,
      pendingQuotes: this.context?.pendingQuotes?.length || 0,
      activeNegotiations: this.context?.activeNegotiations?.length || 0,
      monthlyRevenue: this.context?.recentMetrics?.totalRevenue || 0,
      winRate: this.context?.recentMetrics?.winRate || 0,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async initializeContext(sellerId: string): Promise<void> {
    this.context = {
      sellerId,
      conversationHistory: [],
    };

    // Load seller configuration
    this.context.config = await getSellerConfig(sellerId) || undefined;

    // Load catalog summary if configured
    if (this.context.config) {
      try {
        this.context.catalogSummary = await getCatalogSummary(sellerId);
      } catch {
        // Catalog might not exist yet
      }

      // Load pending quotes
      try {
        this.context.pendingQuotes = await getSellerQuotes(sellerId, { status: 'pending_approval' });
      } catch {
        // No pending quotes
      }

      // Load active negotiations
      try {
        this.context.activeNegotiations = await getSellerNegotiations(sellerId, { status: 'active' });
      } catch {
        // No active negotiations
      }

      // Load recent metrics
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        this.context.recentMetrics = await getSellerMetrics(sellerId, {
          start: thirtyDaysAgo,
          end: new Date(),
        });
      } catch {
        // No metrics yet
      }
    }
  }

  private async getBuyerPreferences(sellerId: string): Promise<{
    excludedBuyers?: string[];
    priorityBuyers?: string[];
  }> {
    try {
      const result = await sql`
        SELECT excluded_buyers, priority_buyers
        FROM seller_buyer_preferences
        WHERE seller_id = ${sellerId}
      `;

      if (result.rows.length === 0) return {};

      const row = result.rows[0];
      return {
        excludedBuyers: typeof row.excluded_buyers === 'string'
          ? JSON.parse(row.excluded_buyers)
          : row.excluded_buyers,
        priorityBuyers: typeof row.priority_buyers === 'string'
          ? JSON.parse(row.priority_buyers)
          : row.priority_buyers,
      };
    } catch {
      return {};
    }
  }

  private async getNegotiationSession(sessionId: string): Promise<NegotiationSession | null> {
    const result = await sql`
      SELECT * FROM seller_negotiations WHERE id = ${sessionId}
    `;

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id as string,
      quoteId: row.quote_id as string,
      sellerId: row.seller_id as string,
      buyerId: row.buyer_id as string,
      initialSellerPrice: parseFloat(row.initial_seller_price as string),
      initialBuyerPrice: parseFloat(row.initial_buyer_offer as string) || undefined,
      currentPrice: parseFloat(row.current_seller_price as string),
      sellerFloorPrice: parseFloat(row.seller_floor_price as string),
      sellerTargetPrice: parseFloat(row.seller_target_price as string),
      status: row.status as NegotiationSession['status'],
      round: row.round as number,
      maxRounds: row.max_rounds as number,
      messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages || [],
      finalPrice: row.final_price ? parseFloat(row.final_price as string) : undefined,
      createdAt: new Date(row.started_at as string),
      expiresAt: new Date(row.expires_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }

  private calculateMargin(sellingPrice: number, costPrice: number): number {
    if (sellingPrice <= 0) return 0;
    return ((sellingPrice - costPrice) / sellingPrice) * 100;
  }

  private async getAINegotiationResponse(
    config: SellerAIConfig,
    session: NegotiationSession,
    counter: CounterOffer,
    analysis: {
      proposedMargin: number;
      canAccept: boolean;
      shouldAccept: boolean;
      isWalkAway: boolean;
      currentPrice: number;
    }
  ): Promise<{
    action: 'accept' | 'counter' | 'reject' | 'escalate';
    counterPrice?: number;
    counterTerms?: Partial<Quote>;
    message: string;
    reasoning: string;
    confidence: number;
  }> {
    const prompt = `You are an AI negotiator for a seller. Analyze this counter-offer and decide the best response.

Seller Configuration:
- Negotiation style: ${config.negotiationStyle.aggression}
- Min margin: ${config.pricingStrategy.minMargin}%
- Target margin: ${config.pricingStrategy.targetMargin}%
- Walk-away margin: ${config.pricingStrategy.walkAwayMargin}%
- Max concessions allowed: ${config.negotiationStyle.maxConcessions}

Current Negotiation:
- Round: ${session.round}/${session.maxRounds}
- Our current price: $${session.currentPrice}
- Their proposed price: $${counter.proposedPrice}
- Proposed margin: ${analysis.proposedMargin.toFixed(1)}%
- Our floor price: $${session.sellerFloorPrice}

Analysis:
- Can accept (margin >= minimum): ${analysis.canAccept}
- Should accept (margin >= target): ${analysis.shouldAccept}
- Walk-away threshold reached: ${analysis.isWalkAway}

Buyer's message: ${counter.message || 'No message provided'}

Decide the best response:
- ACCEPT: If the offer is acceptable
- COUNTER: If we should propose a middle ground
- REJECT: If the offer is unacceptable and we should walk away
- ESCALATE: If this needs human review

Return JSON:
{
  "action": "accept|counter|reject|escalate",
  "counterPrice": number (if countering),
  "message": "Professional message to buyer",
  "reasoning": "Internal reasoning for seller",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      });

      const textBlock = response.content.find(block => block.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch?.[0] || '{}');

      return {
        action: result.action || (analysis.shouldAccept ? 'accept' : analysis.isWalkAway ? 'reject' : 'counter'),
        counterPrice: result.counterPrice,
        message: result.message || 'Thank you for your offer.',
        reasoning: result.reasoning || 'AI decision based on margin analysis.',
        confidence: result.confidence || 0.7,
      };
    } catch {
      // Fallback logic
      if (analysis.isWalkAway) {
        return {
          action: 'reject',
          message: 'Unfortunately, this offer is below our minimum acceptable price.',
          reasoning: 'Walk-away threshold reached.',
          confidence: 0.9,
        };
      }

      if (analysis.shouldAccept) {
        return {
          action: 'accept',
          message: 'We are pleased to accept your offer.',
          reasoning: 'Offer exceeds target margin.',
          confidence: 0.9,
        };
      }

      // Counter at midpoint
      const midpoint = (session.currentPrice + counter.proposedPrice) / 2;
      return {
        action: 'counter',
        counterPrice: Math.round(midpoint * 100) / 100,
        message: `We can meet you partway at $${midpoint.toFixed(2)}.`,
        reasoning: 'Counter at midpoint to find agreement.',
        confidence: 0.7,
      };
    }
  }

  private buildSystemPrompt(): string {
    if (!this.context) return '';

    const configuredStatus = this.context.config ? 'configured' : 'not yet configured';
    const catalogInfo = this.context.catalogSummary
      ? `${this.context.catalogSummary.totalProducts} products across ${this.context.catalogSummary.categories.length} categories, price range $${this.context.catalogSummary.priceRange.min.toFixed(2)} - $${this.context.catalogSummary.priceRange.max.toFixed(2)}`
      : 'no products yet';
    const pendingInfo = this.context.pendingQuotes?.length
      ? `${this.context.pendingQuotes.length} quotes pending approval`
      : 'no pending quotes';
    const negotiationInfo = this.context.activeNegotiations?.length
      ? `${this.context.activeNegotiations.length} active negotiations`
      : 'no active negotiations';

    return `You are Wells, an AI assistant that represents sellers on the Wells AI marketplace.

Current seller context:
- Seller ID: ${this.context.sellerId}
- Status: ${configuredStatus}
- Catalog: ${catalogInfo}
- Pending: ${pendingInfo}
- Negotiations: ${negotiationInfo}
${this.context.config ? `
- Company: ${this.context.config.companyName}
- Target margin: ${this.context.config.pricingStrategy?.targetMargin || 30}%
- Min margin: ${this.context.config.pricingStrategy?.minMargin || 15}%
- Auto-approve under: $${this.context.config.autoResponse?.autoApproveUnder || 5000}
- Negotiation style: ${this.context.config.negotiationStyle?.aggression || 'balanced'}
` : ''}
${this.context.recentMetrics ? `
Recent performance (30 days):
- Win rate: ${this.context.recentMetrics.winRate.toFixed(1)}%
- Total revenue: $${this.context.recentMetrics.totalRevenue.toFixed(2)}
- Avg response time: ${this.context.recentMetrics.averageResponseTimeHours.toFixed(1)} hours
` : ''}

Your role:
1. Help sellers set up their AI agent to automatically respond to RFQs
2. Manage their product catalog (add products, import catalogs, update pricing)
3. Generate and approve quotes on their behalf
4. Handle negotiations with buyers
5. Provide performance insights and recommendations

Key behaviors:
- Be conversational and helpful
- When sellers describe products, extract details and add to catalog
- Proactively suggest next steps
- Ask clarifying questions when needed
- Use tools to take actions (don't just describe them)
- Protect seller margins while winning deals

If the seller is not configured yet, guide them through setup by asking:
1. What products they sell
2. Minimum order value
3. Standard lead time
4. Pricing/margin targets
5. How automated they want the agent to be`;
  }

  private mapToolToIntent(toolName: string): SellerIntent {
    const mapping: Record<string, SellerIntent> = {
      upload_catalog: 'import_catalog',
      add_products: 'add_products',
      update_pricing: 'update_pricing',
      configure_agent: 'configure_agent',
      review_quote: 'review_quote',
      approve_quote: 'approve_quote',
      reject_quote: 'reject_quote',
      counter_quote: 'counter_quote',
      handle_negotiation: 'handle_negotiation',
      get_performance: 'get_performance',
    };
    return mapping[toolName] || 'unknown';
  }

  private async executeTool(sellerId: string, toolName: string, input: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (toolName) {
        case 'add_products':
          return await this.executeAddProducts(sellerId, input);
        case 'upload_catalog':
          return await this.executeUploadCatalog(sellerId, input);
        case 'update_pricing':
          return await this.executeUpdatePricing(sellerId, input);
        case 'configure_agent':
          return await this.executeConfigureAgent(sellerId, input);
        case 'review_quote':
          return await this.executeReviewQuote(sellerId, input);
        case 'approve_quote':
          return await this.executeApproveQuote(sellerId, input);
        case 'reject_quote':
          return await this.executeRejectQuote(sellerId, input);
        case 'counter_quote':
          return await this.executeCounterQuote(sellerId, input);
        case 'handle_negotiation':
          return await this.executeHandleNegotiation(sellerId, input);
        case 'get_performance':
          return await this.executeGetPerformance(sellerId, input);
        default:
          return { success: false, action: toolName, message: 'Unknown tool' };
      }
    } catch (error) {
      return {
        success: false,
        action: toolName,
        message: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  private async executeAddProducts(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    const description = input.description as string;
    const result = await CatalogService.addProductsViaConversation(sellerId, description);

    // Refresh catalog summary
    this.context!.catalogSummary = await getCatalogSummary(sellerId);

    return {
      success: true,
      action: 'add_products',
      data: {
        productsAdded: result.productsAdded.length,
        products: result.productsAdded.map(p => ({
          name: p.name,
          price: p.pricing.basePrice,
          category: p.category,
        })),
      },
      message: result.response,
    };
  }

  private async executeUploadCatalog(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    const source = input.source as string;

    if (source === 'csv' && input.csvContent) {
      const job = await ingestFromCSV(sellerId, input.csvContent as string);

      // Refresh catalog summary
      this.context!.catalogSummary = await getCatalogSummary(sellerId);

      return {
        success: job.status === 'completed',
        action: 'upload_catalog',
        data: {
          jobId: job.id,
          totalRecords: job.totalRecords,
          successfulRecords: job.successfulRecords,
          failedRecords: job.failedRecords,
        },
        message: `Imported ${job.successfulRecords} products from CSV${job.failedRecords > 0 ? ` (${job.failedRecords} failed)` : ''}`,
      };
    }

    return {
      success: false,
      action: 'upload_catalog',
      message: 'Please provide CSV content or connect your Shopify/ERP',
    };
  }

  private async executeUpdatePricing(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    const type = input.type as string;

    if (type === 'global_adjustment' && input.adjustmentPercent) {
      const count = await CatalogService.bulkUpdatePrices(sellerId, {
        type: 'percentage',
        amount: input.adjustmentPercent as number,
        category: input.category as string | undefined,
      });

      return {
        success: true,
        action: 'update_pricing',
        data: { productsUpdated: count },
        message: `Updated pricing for ${count} products by ${input.adjustmentPercent}%`,
      };
    }

    if (type === 'volume_discount' && input.volumeDiscount) {
      const discount = input.volumeDiscount as { minQuantity: number; discountPercent: number };
      const count = await CatalogService.addGlobalVolumeDiscount(sellerId, {
        minQuantity: discount.minQuantity,
        maxQuantity: undefined,
        discountPercent: discount.discountPercent,
        discountType: 'percentage',
      });

      return {
        success: true,
        action: 'update_pricing',
        data: { productsUpdated: count, discount },
        message: `Added ${discount.discountPercent}% volume discount for orders of ${discount.minQuantity}+ units`,
      };
    }

    return {
      success: false,
      action: 'update_pricing',
      message: 'Please specify the type of pricing update',
    };
  }

  private async executeConfigureAgent(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    const config: Partial<SellerAgentConfig> = {
      minMargin: input.minMargin as number || 15,
      maxDiscount: 20,
      autoApproveBelow: input.autoApproveUnder as number || 5000,
      responseTimeTarget: 'within_hour',
      negotiationStyle: (input.negotiationStyle as SellerAgentConfig['negotiationStyle']) || 'balanced',
      preferredPaymentTerms: ['NET30'],
    };

    await this.configureAgent(sellerId, config as SellerAgentConfig);

    // Refresh context
    await this.initializeContext(sellerId);

    return {
      success: true,
      action: 'configure_agent',
      data: { config: this.context?.config },
      message: 'Agent configuration updated',
    };
  }

  private async executeReviewQuote(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    if (input.listPending || !input.quoteId) {
      const pending = await getSellerQuotes(sellerId, { status: 'pending_approval' });
      this.context!.pendingQuotes = pending;

      return {
        success: true,
        action: 'review_quote',
        data: {
          quotes: pending.map(q => ({
            id: q.id,
            rfqId: q.rfqId,
            total: q.total,
            margin: q.calculatedMargin,
            status: q.status,
            createdAt: q.createdAt,
          })),
        },
        message: `Found ${pending.length} pending quote(s)`,
      };
    }

    const quote = await QuoteGenerator.getQuote(input.quoteId as string);
    if (!quote || quote.sellerId !== sellerId) {
      return { success: false, action: 'review_quote', message: 'Quote not found' };
    }

    return {
      success: true,
      action: 'review_quote',
      data: {
        quote: {
          id: quote.id,
          rfqId: quote.rfqId,
          lineItems: quote.lineItems,
          subtotal: quote.subtotal,
          discountAmount: quote.discountAmount,
          total: quote.total,
          margin: quote.calculatedMargin,
          validUntil: quote.validUntil,
          aiReasoning: quote.aiReasoning,
        },
      },
      message: `Quote ${quote.id}: $${quote.total.toFixed(2)} (${quote.calculatedMargin.toFixed(1)}% margin)`,
    };
  }

  private async executeApproveQuote(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    const quoteId = input.quoteId as string;
    const adjustedPrice = input.adjustedPrice as number | undefined;

    let quote: GeneratedQuote;

    if (adjustedPrice) {
      quote = await counterQuote(quoteId, sellerId, adjustedPrice);
    } else {
      quote = await approveQuote(quoteId, sellerId);
    }

    // Refresh pending quotes
    this.context!.pendingQuotes = await getSellerQuotes(sellerId, { status: 'pending_approval' });

    return {
      success: true,
      action: 'approve_quote',
      data: { quote },
      message: `Quote approved and sent to buyer: $${quote.total.toFixed(2)}`,
    };
  }

  private async executeRejectQuote(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    const quoteId = input.quoteId as string;
    const reason = input.reason as string | undefined;

    await rejectQuote(quoteId, sellerId, reason);

    // Refresh pending quotes
    this.context!.pendingQuotes = await getSellerQuotes(sellerId, { status: 'pending_approval' });

    return {
      success: true,
      action: 'reject_quote',
      message: `Quote declined${reason ? `: ${reason}` : ''}`,
    };
  }

  private async executeCounterQuote(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    const quoteId = input.quoteId as string;
    const newPrice = input.newPrice as number;

    const quote = await counterQuote(quoteId, sellerId, newPrice);

    // Refresh pending quotes
    this.context!.pendingQuotes = await getSellerQuotes(sellerId, { status: 'pending_approval' });

    return {
      success: true,
      action: 'counter_quote',
      data: { quote },
      message: `Counter offer sent: $${quote.total.toFixed(2)}`,
    };
  }

  private async executeHandleNegotiation(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    const sessionId = input.sessionId as string;
    const action = input.action as 'accept' | 'counter' | 'reject';
    const counterPrice = input.counterPrice as number | undefined;
    const message = input.message as string | undefined;

    const session = await sellerManualResponse(sessionId, sellerId, {
      action,
      counterPrice,
      message,
    });

    // Refresh active negotiations
    this.context!.activeNegotiations = await getSellerNegotiations(sellerId, { status: 'active' });

    const actionWord = action === 'accept' ? 'accepted' : action === 'counter' ? 'countered' : 'rejected';

    return {
      success: true,
      action: 'handle_negotiation',
      data: { session },
      message: `Negotiation ${actionWord}${counterPrice ? ` at $${counterPrice.toFixed(2)}` : ''}`,
    };
  }

  private async executeGetPerformance(sellerId: string, input: Record<string, unknown>): Promise<ActionResult> {
    const periodMap: Record<string, number> = {
      today: 1,
      week: 7,
      month: 30,
      quarter: 90,
      year: 365,
    };

    const period = input.period as string || 'month';
    const days = periodMap[period] || 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const report = await generatePerformanceReport(sellerId, {
      start: startDate,
      end: endDate,
      label: period,
    });

    let insights: PerformanceInsight[] = [];
    if (input.includeInsights) {
      insights = await generateInsights(sellerId, report.metrics, report.trends);
    }

    return {
      success: true,
      action: 'get_performance',
      data: { report, insights },
      message: `${period} performance: $${report.metrics.totalRevenue.toFixed(2)} revenue, ${report.metrics.winRate.toFixed(1)}% win rate`,
    };
  }

  private generateSuggestions(intent: SellerIntent): string[] {
    const baseSuggestions = [
      'Show my pending quotes',
      'How am I performing this month?',
      'Update my pricing',
    ];

    if (!this.context?.config) {
      return [
        'I sell [your products]',
        'Set up my seller AI',
        'What can you do for me?',
      ];
    }

    if (!this.context.catalogSummary?.totalProducts) {
      return [
        'Add my products',
        'Import my catalog from CSV',
        'Connect my Shopify store',
      ];
    }

    switch (intent) {
      case 'add_products':
      case 'import_catalog':
        return ['Show my catalog', 'Update pricing', 'Configure volume discounts'];
      case 'approve_quote':
      case 'reject_quote':
      case 'counter_quote':
        return ['Show more pending quotes', 'Get performance stats', 'Configure auto-approval'];
      case 'get_performance':
        return ['Show insights', 'Compare to last month', 'What can I improve?'];
      default:
        return baseSuggestions;
    }
  }

  private generateQuickActions(intent: SellerIntent): QuickAction[] {
    const actions: QuickAction[] = [];

    if (this.context?.pendingQuotes && this.context.pendingQuotes.length > 0) {
      const nextQuote = this.context.pendingQuotes[0];
      actions.push({
        label: `Approve Quote ($${nextQuote.total.toFixed(0)})`,
        action: 'approve_quote',
        data: { quoteId: nextQuote.id },
      });
    }

    if (this.context?.activeNegotiations && this.context.activeNegotiations.length > 0) {
      actions.push({
        label: `View Negotiations (${this.context.activeNegotiations.length})`,
        action: 'view_negotiations',
      });
    }

    actions.push({
      label: 'Performance',
      action: 'get_performance',
      data: { period: 'month' },
    });

    return actions;
  }

  private getResponseData(intent: SellerIntent): ChatResponse['data'] {
    const data: ChatResponse['data'] = {};

    if (this.context?.config) {
      data.config = this.context.config;
    }

    if (this.context?.catalogSummary) {
      data.catalog = this.context.catalogSummary;
    }

    if (intent === 'review_quote' || intent === 'approve_quote') {
      data.quotes = this.context?.pendingQuotes;
    }

    if (intent === 'handle_negotiation') {
      data.negotiations = this.context?.activeNegotiations;
    }

    return data;
  }

  private mapQuoteStatusToRFQStatus(status: string): RFQHistoryItem['status'] {
    switch (status) {
      case 'accepted': return 'won';
      case 'rejected': return 'lost';
      case 'expired': return 'expired';
      case 'sent': return 'quoted';
      case 'pending_approval': return 'pending';
      case 'draft': return 'pending';
      default: return 'pending';
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a seller agent instance
 */
export async function createSellerAgent(sellerId: string): Promise<SellerAgent> {
  const agent = new SellerAgent();
  await agent.getStatus(sellerId); // Initialize context
  return agent;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default SellerAgent;
