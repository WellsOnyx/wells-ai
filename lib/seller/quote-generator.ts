/**
 * Quote Generator Service
 *
 * AI-powered quote generation for RFQs.
 * When an RFQ comes in:
 * 1. Match to seller's catalog
 * 2. Calculate pricing based on rules
 * 3. Generate professional quote
 * 4. If auto-response enabled, send immediately
 * 5. If not, notify seller for approval
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import { SellerAIConfig, getSellerConfig } from './ai-agent-config';
import { CatalogProduct, searchCatalog, getProduct } from './catalog-service';
import { notify } from '@/lib/notifications';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface RFQRequest {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerCompany?: string;

  // What they're looking for
  productDescription: string;
  category?: string;
  quantity: number;
  targetPrice?: number;
  currency: string;

  // Timeline
  urgency: 'standard' | 'urgent' | 'critical';
  requiredByDate?: Date;

  // Requirements
  qualityRequirements?: string[];
  certifications?: string[];
  deliveryLocation: string;
  additionalNotes?: string;

  // Metadata
  createdAt: Date;
}

export interface QuoteLineItem {
  productId: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  leadTimeDays: number;
  notes?: string;
}

export interface GeneratedQuote {
  id: string;
  rfqId: string;
  sellerId: string;
  sellerCompany: string;

  // Quote details
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountAmount: number;
  discountReason?: string;
  shippingCost: number;
  rushFee: number;
  total: number;
  currency: string;

  // Terms
  paymentTerms: string;
  validUntil: Date;
  deliveryTerms: string;
  warranty?: string;

  // Margin analysis (internal)
  calculatedMargin: number;
  targetMargin: number;
  isAutoApproved: boolean;
  requiresApproval: boolean;

  // Status
  status: 'draft' | 'pending_approval' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'negotiating';
  sentAt?: Date;
  respondedAt?: Date;

  // AI reasoning
  aiReasoning: string;
  confidenceScore: number;
  matchedProducts: string[];

  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteGenerationResult {
  quote: GeneratedQuote;
  autoSent: boolean;
  notificationSent: boolean;
  message: string;
}

// ============================================================================
// QUOTE GENERATION
// ============================================================================

/**
 * Generate a quote for an RFQ
 */
export async function generateQuoteForRFQ(
  sellerId: string,
  rfq: RFQRequest
): Promise<QuoteGenerationResult> {
  // Get seller config
  const config = await getSellerConfig(sellerId);
  if (!config || !config.isActive) {
    throw new Error('Seller agent is not active');
  }

  // Find matching products in catalog
  const matchedProducts = await findMatchingProducts(sellerId, rfq);
  if (matchedProducts.length === 0) {
    return {
      quote: createEmptyQuote(rfq, sellerId, config),
      autoSent: false,
      notificationSent: true,
      message: 'No matching products found. Notification sent to seller.',
    };
  }

  // Calculate pricing
  const pricing = await calculateQuotePricing(rfq, matchedProducts, config);

  // Generate the quote
  const quote = await buildQuote(rfq, sellerId, config, matchedProducts, pricing);

  // Determine if auto-send
  const shouldAutoSend = shouldAutoApprove(quote, config);
  quote.isAutoApproved = shouldAutoSend;
  quote.requiresApproval = !shouldAutoSend;

  // Save quote
  await saveQuote(quote);

  // Handle auto-send or notify seller
  if (shouldAutoSend) {
    quote.status = 'sent';
    quote.sentAt = new Date();
    await updateQuote(quote);
    await notifyBuyerOfQuote(rfq, quote);

    return {
      quote,
      autoSent: true,
      notificationSent: true,
      message: `Quote auto-sent: $${quote.total.toFixed(2)} (${quote.calculatedMargin.toFixed(1)}% margin)`,
    };
  } else {
    quote.status = 'pending_approval';
    await updateQuote(quote);
    await notifySellerForApproval(config, rfq, quote);

    return {
      quote,
      autoSent: false,
      notificationSent: true,
      message: `Quote pending approval: $${quote.total.toFixed(2)}. Seller notified.`,
    };
  }
}

/**
 * Find matching products for an RFQ
 */
async function findMatchingProducts(
  sellerId: string,
  rfq: RFQRequest
): Promise<CatalogProduct[]> {
  // Search catalog using AI keywords
  const searchResults = await searchCatalog(
    sellerId,
    rfq.productDescription,
    { category: rfq.category }
  );

  // If no direct matches, use AI to find related products
  if (searchResults.length === 0) {
    return await aiProductMatch(sellerId, rfq);
  }

  return searchResults.map(r => r.product);
}

/**
 * AI-powered product matching for complex RFQs
 */
async function aiProductMatch(
  sellerId: string,
  rfq: RFQRequest
): Promise<CatalogProduct[]> {
  // Get all seller products for AI analysis
  const result = await sql`
    SELECT * FROM seller_catalog
    WHERE seller_id = ${sellerId} AND is_active = true
    LIMIT 100
  `;

  if (result.rows.length === 0) return [];

  const prompt = `You are matching an RFQ to a seller's product catalog.

RFQ Request:
- Description: ${rfq.productDescription}
- Category: ${rfq.category || 'Not specified'}
- Quantity: ${rfq.quantity}
- Requirements: ${rfq.qualityRequirements?.join(', ') || 'None'}

Available Products:
${result.rows.map((p, i) => `${i}. ${p.name}: ${p.description} (Category: ${p.category})`).join('\n')}

Return JSON with indexes of matching products (most relevant first):
{
  "matches": [0, 2, 5],
  "reasoning": "Brief explanation",
  "confidence": 0.0-1.0
}

If no good matches, return empty array.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const matchResult = JSON.parse(jsonMatch?.[0] || '{ "matches": [] }');

    return (matchResult.matches || [])
      .filter((idx: number) => idx < result.rows.length)
      .map((idx: number) => rowToProduct(result.rows[idx]));
  } catch {
    return [];
  }
}

/**
 * Calculate pricing based on seller rules
 */
async function calculateQuotePricing(
  rfq: RFQRequest,
  products: CatalogProduct[],
  config: SellerAIConfig
): Promise<{
  lineItems: QuoteLineItem[];
  subtotal: number;
  discount: number;
  discountReason?: string;
  shippingCost: number;
  rushFee: number;
  margin: number;
}> {
  const { pricingStrategy } = config;

  // Use the best matching product
  const product = products[0];
  const basePrice = product.pricing.basePrice;

  // Calculate volume discount
  let discount = 0;
  let discountReason: string | undefined;

  for (const tier of product.pricing.volumeDiscounts) {
    if (rfq.quantity >= tier.minQuantity) {
      discount = tier.discountPercent;
      discountReason = `${tier.discountPercent}% volume discount (${tier.minQuantity}+ units)`;
    }
  }

  // Check seller's global volume discounts
  for (const tier of pricingStrategy.volumeDiscountTiers) {
    if (rfq.quantity >= tier.minQuantity && tier.discountPercent > discount) {
      discount = tier.discountPercent;
      discountReason = tier.description || `${tier.discountPercent}% volume discount`;
    }
  }

  // Calculate unit price after discount
  const discountedUnitPrice = basePrice * (1 - discount / 100);
  const subtotal = discountedUnitPrice * rfq.quantity;
  const discountAmount = basePrice * rfq.quantity - subtotal;

  // Calculate rush fee if urgent
  let rushFee = 0;
  let leadTimeDays = product.leadTime.standardDays;

  if (rfq.urgency === 'critical' && product.leadTime.rushDays) {
    rushFee = subtotal * (pricingStrategy.urgencyPremium / 100);
    leadTimeDays = product.leadTime.rushDays;
  } else if (rfq.urgency === 'urgent') {
    rushFee = subtotal * (pricingStrategy.urgencyPremium / 200); // Half premium
    leadTimeDays = Math.ceil(product.leadTime.standardDays * 0.7);
  }

  // Estimate shipping (simplified)
  const shippingCost = estimateShipping(rfq.quantity, rfq.deliveryLocation);

  // Calculate margin
  const costPrice = product.pricing.costPrice || basePrice * 0.6; // Estimate if not set
  const totalCost = costPrice * rfq.quantity + shippingCost * 0.5; // Assume 50% shipping cost to seller
  const total = subtotal + rushFee + shippingCost;
  const profit = total - totalCost;
  const margin = (profit / total) * 100;

  return {
    lineItems: [{
      productId: product.id,
      productName: product.name,
      description: product.description,
      quantity: rfq.quantity,
      unitPrice: discountedUnitPrice,
      totalPrice: subtotal,
      leadTimeDays,
    }],
    subtotal,
    discount: discountAmount,
    discountReason,
    shippingCost,
    rushFee,
    margin,
  };
}

function estimateShipping(quantity: number, location: string): number {
  // Simple shipping estimation
  const baseRate = 50;
  const perUnitRate = 0.5;
  const locationMultiplier = location.toLowerCase().includes('international') ? 3 : 1;

  return (baseRate + quantity * perUnitRate) * locationMultiplier;
}

/**
 * Build the complete quote object
 */
async function buildQuote(
  rfq: RFQRequest,
  sellerId: string,
  config: SellerAIConfig,
  products: CatalogProduct[],
  pricing: {
    lineItems: QuoteLineItem[];
    subtotal: number;
    discount: number;
    discountReason?: string;
    shippingCost: number;
    rushFee: number;
    margin: number;
  }
): Promise<GeneratedQuote> {
  const quoteId = `quote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const total = pricing.subtotal + pricing.rushFee + pricing.shippingCost;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 14); // 2 week validity

  // Generate AI reasoning
  const reasoning = await generateQuoteReasoning(rfq, products, pricing, config);

  return {
    id: quoteId,
    rfqId: rfq.id,
    sellerId,
    sellerCompany: config.companyName,

    lineItems: pricing.lineItems,
    subtotal: pricing.subtotal,
    discountAmount: pricing.discount,
    discountReason: pricing.discountReason,
    shippingCost: pricing.shippingCost,
    rushFee: pricing.rushFee,
    total,
    currency: rfq.currency || 'USD',

    paymentTerms: 'NET30',
    validUntil,
    deliveryTerms: `Delivery to ${rfq.deliveryLocation}`,
    warranty: products[0].leadTime.customLeadDays
      ? `${products[0].leadTime.customLeadDays} months warranty`
      : undefined,

    calculatedMargin: pricing.margin,
    targetMargin: config.pricingStrategy.targetMargin,
    isAutoApproved: false,
    requiresApproval: true,

    status: 'draft',
    aiReasoning: reasoning.explanation,
    confidenceScore: reasoning.confidence,
    matchedProducts: products.map(p => p.id),

    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Generate AI reasoning for the quote
 */
async function generateQuoteReasoning(
  rfq: RFQRequest,
  products: CatalogProduct[],
  pricing: {
    subtotal: number;
    discount: number;
    margin: number;
  },
  config: SellerAIConfig
): Promise<{ explanation: string; confidence: number }> {
  const prompt = `You are Wells, explaining a quote to a seller.

RFQ Summary:
- Request: ${rfq.productDescription}
- Quantity: ${rfq.quantity}
- Urgency: ${rfq.urgency}
- Target price: ${rfq.targetPrice ? `$${rfq.targetPrice}` : 'Not specified'}

Quote Generated:
- Total: $${pricing.subtotal.toFixed(2)}
- Volume discount applied: $${pricing.discount.toFixed(2)}
- Margin: ${pricing.margin.toFixed(1)}%

Seller's targets:
- Target margin: ${config.pricingStrategy.targetMargin}%
- Minimum margin: ${config.pricingStrategy.minMargin}%

Generate a brief (2-3 sentences) explanation and confidence score.
Return JSON: { "explanation": "...", "confidence": 0.0-1.0 }`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || '{ "explanation": "Quote generated based on catalog pricing.", "confidence": 0.7 }');
  } catch {
    return {
      explanation: 'Quote generated based on catalog pricing and volume discounts.',
      confidence: 0.7,
    };
  }
}

/**
 * Determine if quote should be auto-approved
 */
function shouldAutoApprove(quote: GeneratedQuote, config: SellerAIConfig): boolean {
  const { autoResponse, pricingStrategy } = config;

  if (!autoResponse.enabled) return false;

  // Check if within auto-approve threshold
  if (quote.total <= autoResponse.autoApproveUnder) {
    // Also check margin is acceptable
    if (quote.calculatedMargin >= pricingStrategy.minMargin) {
      return true;
    }
  }

  // Auto-approve if margin exceeds target
  if (quote.calculatedMargin >= autoResponse.autoApproveMarginOver) {
    return true;
  }

  // Check if requires approval due to size
  if (quote.total > autoResponse.requireApprovalOver) {
    return false;
  }

  return false;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

async function notifyBuyerOfQuote(rfq: RFQRequest, quote: GeneratedQuote): Promise<void> {
  // In production, send email/notification to buyer
  console.log(`[Wells] Quote ${quote.id} sent to buyer ${rfq.buyerId}`);

  // Log the quote send event
  await sql`
    INSERT INTO quote_events (quote_id, event_type, actor_type, data)
    VALUES (${quote.id}, 'sent', 'ai', ${JSON.stringify({ buyerId: rfq.buyerId })})
  `;
}

async function notifySellerForApproval(
  config: SellerAIConfig,
  rfq: RFQRequest,
  quote: GeneratedQuote
): Promise<void> {
  const message = `New RFQ from ${rfq.buyerName}: ${rfq.quantity}x ${rfq.productDescription}. ` +
    `Suggested quote: $${quote.total.toFixed(2)} (${quote.calculatedMargin.toFixed(1)}% margin). ` +
    `Reply APPROVE or COUNTER [amount].`;

  if (config.notifications.sms && config.contactPhone) {
    try {
      await notify({
        type: 'sms',
        to: config.contactPhone,
        message,
      });
    } catch (error) {
      console.error('Failed to send SMS notification:', error);
    }
  }

  if (config.notifications.email) {
    try {
      await notify({
        type: 'email',
        to: config.contactEmail,
        subject: `[Wells] Quote Approval Needed: ${rfq.buyerCompany || rfq.buyerName}`,
        message,
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  // Log notification event
  await sql`
    INSERT INTO quote_events (quote_id, event_type, actor_type, data)
    VALUES (${quote.id}, 'approval_requested', 'ai', ${JSON.stringify({ sellerId: config.sellerId })})
  `;
}

// ============================================================================
// QUOTE ACTIONS
// ============================================================================

/**
 * Seller approves quote
 */
export async function approveQuote(
  quoteId: string,
  sellerId: string,
  modifications?: Partial<GeneratedQuote>
): Promise<GeneratedQuote> {
  const quote = await getQuote(quoteId);
  if (!quote || quote.sellerId !== sellerId) {
    throw new Error('Quote not found');
  }

  if (modifications) {
    Object.assign(quote, modifications);
    quote.updatedAt = new Date();
  }

  quote.status = 'sent';
  quote.sentAt = new Date();
  await updateQuote(quote);

  // Notify buyer
  const rfq = await getRFQ(quote.rfqId);
  if (rfq) {
    await notifyBuyerOfQuote(rfq, quote);
  }

  return quote;
}

/**
 * Seller rejects/withdraws quote
 */
export async function rejectQuote(
  quoteId: string,
  sellerId: string,
  reason?: string
): Promise<void> {
  const quote = await getQuote(quoteId);
  if (!quote || quote.sellerId !== sellerId) {
    throw new Error('Quote not found');
  }

  quote.status = 'rejected';
  quote.updatedAt = new Date();
  await updateQuote(quote);

  await sql`
    INSERT INTO quote_events (quote_id, event_type, actor_type, data)
    VALUES (${quoteId}, 'rejected', 'seller', ${JSON.stringify({ reason })})
  `;
}

/**
 * Counter-offer from seller
 */
export async function counterQuote(
  quoteId: string,
  sellerId: string,
  newTotal: number
): Promise<GeneratedQuote> {
  const quote = await getQuote(quoteId);
  if (!quote || quote.sellerId !== sellerId) {
    throw new Error('Quote not found');
  }

  // Recalculate line items proportionally
  const ratio = newTotal / quote.total;
  quote.lineItems = quote.lineItems.map(item => ({
    ...item,
    unitPrice: item.unitPrice * ratio,
    totalPrice: item.totalPrice * ratio,
  }));

  quote.subtotal = quote.subtotal * ratio;
  quote.total = newTotal;
  quote.status = 'sent';
  quote.sentAt = new Date();
  quote.updatedAt = new Date();

  await updateQuote(quote);

  const rfq = await getRFQ(quote.rfqId);
  if (rfq) {
    await notifyBuyerOfQuote(rfq, quote);
  }

  return quote;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function saveQuote(quote: GeneratedQuote): Promise<void> {
  await sql`
    INSERT INTO seller_quotes (
      id, rfq_id, seller_id, seller_company,
      line_items, subtotal, discount_amount, discount_reason,
      shipping_cost, rush_fee, total, currency,
      payment_terms, valid_until, delivery_terms, warranty,
      calculated_margin, target_margin, is_auto_approved, requires_approval,
      status, sent_at, responded_at,
      ai_reasoning, confidence_score, matched_products,
      created_at, updated_at
    ) VALUES (
      ${quote.id}, ${quote.rfqId}, ${quote.sellerId}, ${quote.sellerCompany},
      ${JSON.stringify(quote.lineItems)}, ${quote.subtotal}, ${quote.discountAmount}, ${quote.discountReason || null},
      ${quote.shippingCost}, ${quote.rushFee}, ${quote.total}, ${quote.currency},
      ${quote.paymentTerms}, ${quote.validUntil.toISOString()}, ${quote.deliveryTerms}, ${quote.warranty || null},
      ${quote.calculatedMargin}, ${quote.targetMargin}, ${quote.isAutoApproved}, ${quote.requiresApproval},
      ${quote.status}, ${quote.sentAt?.toISOString() || null}, ${quote.respondedAt?.toISOString() || null},
      ${quote.aiReasoning}, ${quote.confidenceScore}, ${JSON.stringify(quote.matchedProducts)},
      NOW(), NOW()
    )
  `;
}

async function updateQuote(quote: GeneratedQuote): Promise<void> {
  await sql`
    UPDATE seller_quotes SET
      line_items = ${JSON.stringify(quote.lineItems)},
      subtotal = ${quote.subtotal},
      discount_amount = ${quote.discountAmount},
      total = ${quote.total},
      status = ${quote.status},
      sent_at = ${quote.sentAt?.toISOString() || null},
      responded_at = ${quote.respondedAt?.toISOString() || null},
      updated_at = NOW()
    WHERE id = ${quote.id}
  `;
}

export async function getQuote(quoteId: string): Promise<GeneratedQuote | null> {
  const result = await sql`
    SELECT * FROM seller_quotes WHERE id = ${quoteId}
  `;

  if (result.rows.length === 0) return null;
  return rowToQuote(result.rows[0]);
}

export async function getSellerQuotes(
  sellerId: string,
  options?: { status?: GeneratedQuote['status']; limit?: number }
): Promise<GeneratedQuote[]> {
  let query;

  if (options?.status) {
    query = sql`
      SELECT * FROM seller_quotes
      WHERE seller_id = ${sellerId} AND status = ${options.status}
      ORDER BY created_at DESC
      LIMIT ${options.limit || 50}
    `;
  } else {
    query = sql`
      SELECT * FROM seller_quotes
      WHERE seller_id = ${sellerId}
      ORDER BY created_at DESC
      LIMIT ${options?.limit || 50}
    `;
  }

  const result = await query;
  return result.rows.map(rowToQuote);
}

async function getRFQ(rfqId: string): Promise<RFQRequest | null> {
  const result = await sql`
    SELECT * FROM rfqs WHERE id = ${rfqId}
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    buyerId: row.requestor_email || row.buyer_id,
    buyerName: row.requestor_name || 'Unknown',
    productDescription: row.description,
    category: row.category,
    quantity: row.quantity,
    targetPrice: row.target_price,
    currency: 'USD',
    urgency: row.urgency || 'standard',
    deliveryLocation: row.delivery_location || 'Unknown',
    additionalNotes: row.additional_requirements,
    createdAt: new Date(row.created_at),
  };
}

function createEmptyQuote(rfq: RFQRequest, sellerId: string, config: SellerAIConfig): GeneratedQuote {
  return {
    id: `quote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    rfqId: rfq.id,
    sellerId,
    sellerCompany: config.companyName,
    lineItems: [],
    subtotal: 0,
    discountAmount: 0,
    shippingCost: 0,
    rushFee: 0,
    total: 0,
    currency: rfq.currency,
    paymentTerms: 'NET30',
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    deliveryTerms: '',
    calculatedMargin: 0,
    targetMargin: config.pricingStrategy.targetMargin,
    isAutoApproved: false,
    requiresApproval: true,
    status: 'draft',
    aiReasoning: 'No matching products found in catalog.',
    confidenceScore: 0,
    matchedProducts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function rowToQuote(row: Record<string, unknown>): GeneratedQuote {
  return {
    id: row.id as string,
    rfqId: row.rfq_id as string,
    sellerId: row.seller_id as string,
    sellerCompany: row.seller_company as string,
    lineItems: parseJson(row.line_items) || [],
    subtotal: parseFloat(row.subtotal as string) || 0,
    discountAmount: parseFloat(row.discount_amount as string) || 0,
    discountReason: row.discount_reason as string | undefined,
    shippingCost: parseFloat(row.shipping_cost as string) || 0,
    rushFee: parseFloat(row.rush_fee as string) || 0,
    total: parseFloat(row.total as string) || 0,
    currency: row.currency as string || 'USD',
    paymentTerms: row.payment_terms as string,
    validUntil: new Date(row.valid_until as string),
    deliveryTerms: row.delivery_terms as string,
    warranty: row.warranty as string | undefined,
    calculatedMargin: parseFloat(row.calculated_margin as string) || 0,
    targetMargin: parseFloat(row.target_margin as string) || 0,
    isAutoApproved: row.is_auto_approved as boolean,
    requiresApproval: row.requires_approval as boolean,
    status: row.status as GeneratedQuote['status'],
    sentAt: row.sent_at ? new Date(row.sent_at as string) : undefined,
    respondedAt: row.responded_at ? new Date(row.responded_at as string) : undefined,
    aiReasoning: row.ai_reasoning as string,
    confidenceScore: parseFloat(row.confidence_score as string) || 0,
    matchedProducts: parseJson(row.matched_products) || [],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function rowToProduct(row: Record<string, unknown>): CatalogProduct {
  return {
    id: row.id as string,
    sellerId: row.seller_id as string,
    name: row.name as string,
    description: row.description as string,
    sku: row.sku as string | undefined,
    category: row.category as string,
    subcategory: row.subcategory as string | undefined,
    tags: parseJson(row.tags) || [],
    pricing: parseJson(row.pricing),
    leadTime: parseJson(row.lead_time),
    availability: parseJson(row.availability),
    specifications: parseJson(row.specifications) || {},
    images: parseJson(row.images) || [],
    searchKeywords: parseJson(row.search_keywords) || [],
    matchingWeight: parseFloat(row.matching_weight as string) || 1.0,
    sourceType: row.source_type as CatalogProduct['sourceType'],
    sourceId: row.source_id as string | undefined,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at as string) : undefined,
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function parseJson(value: unknown): unknown {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value as string);
  } catch {
    return null;
  }
}

// ============================================================================
// COMPETITION-AWARE PRICING
// ============================================================================

export interface CompetitionContext {
  competitorCount: number;
  estimatedCompetitorPrices: number[];
  marketPosition: 'premium' | 'competitive' | 'budget';
  urgencyLevel: 'low' | 'medium' | 'high';
  buyerHistory?: {
    previousOrders: number;
    averageOrderValue: number;
    paymentHistory: 'excellent' | 'good' | 'poor';
  };
}

/**
 * Calculate competitive price adjustments
 * Factors in market position, buyer history, and estimated competition
 */
export async function calculateCompetitivePrice(
  basePrice: number,
  rfq: RFQRequest,
  config: SellerAIConfig,
  competitionContext?: CompetitionContext
): Promise<{
  adjustedPrice: number;
  adjustment: number;
  adjustmentReason: string;
  competitiveScore: number;
}> {
  const { pricingStrategy } = config;
  let adjustment = 0;
  const adjustmentReasons: string[] = [];

  // Default competition context if not provided
  const competition = competitionContext || await estimateCompetition(rfq);

  // Competition-based adjustment
  if (competition.competitorCount > 5) {
    // Highly competitive - need to be aggressive
    const targetPosition = competition.marketPosition === 'budget' ? 0.85 : 0.92;
    const avgCompetitorPrice = competition.estimatedCompetitorPrices.length > 0
      ? competition.estimatedCompetitorPrices.reduce((a, b) => a + b, 0) / competition.estimatedCompetitorPrices.length
      : basePrice;

    if (basePrice > avgCompetitorPrice * targetPosition) {
      adjustment -= Math.min(0.15, (basePrice - avgCompetitorPrice * targetPosition) / basePrice);
      adjustmentReasons.push(`Competitive pressure (${competition.competitorCount} competitors)`);
    }
  } else if (competition.competitorCount <= 2) {
    // Low competition - can maintain or increase price
    if (rfq.urgency === 'critical') {
      adjustment += pricingStrategy.urgencyPremium / 100;
      adjustmentReasons.push('Limited competition + urgent need');
    }
  }

  // Buyer loyalty adjustment
  if (competition.buyerHistory) {
    if (competition.buyerHistory.previousOrders >= 5) {
      adjustment -= pricingStrategy.repeatCustomerDiscount / 100;
      adjustmentReasons.push(`Repeat customer discount (${competition.buyerHistory.previousOrders} previous orders)`);
    } else if (competition.buyerHistory.previousOrders === 0) {
      adjustment -= pricingStrategy.firstOrderDiscount / 100;
      adjustmentReasons.push('First order discount');
    }
  }

  // Buyer target price anchoring
  if (rfq.targetPrice && rfq.targetPrice < basePrice) {
    const targetGap = (basePrice - rfq.targetPrice) / basePrice;
    // Try to get closer to target while protecting margin
    const maxAdjust = (pricingStrategy.targetMargin - pricingStrategy.minMargin) / 100;
    const targetAdjust = Math.min(targetGap * 0.5, maxAdjust);
    adjustment -= targetAdjust;
    adjustmentReasons.push(`Anchored toward buyer target ($${rfq.targetPrice})`);
  }

  // Calculate final adjusted price
  const adjustedPrice = basePrice * (1 + adjustment);

  // Ensure minimum margin is protected
  const costPrice = basePrice * (1 - pricingStrategy.targetMargin / 100);
  const minPrice = costPrice / (1 - pricingStrategy.minMargin / 100);
  const finalPrice = Math.max(adjustedPrice, minPrice);
  const finalAdjustment = (finalPrice - basePrice) / basePrice;

  // Calculate competitive score (0-100)
  const competitiveScore = calculateCompetitiveScore(finalPrice, competition, rfq);

  return {
    adjustedPrice: finalPrice,
    adjustment: finalAdjustment,
    adjustmentReason: adjustmentReasons.join('; ') || 'Standard pricing',
    competitiveScore,
  };
}

/**
 * Estimate competition for an RFQ
 */
async function estimateCompetition(rfq: RFQRequest): Promise<CompetitionContext> {
  // Check how many other sellers might be quoting
  const result = await sql`
    SELECT COUNT(DISTINCT seller_id) as count
    FROM seller_catalog
    WHERE category = ${rfq.category || 'General'}
    AND is_active = true
  `;

  const competitorCount = parseInt(result.rows[0]?.count as string) || 3;

  // Check buyer history
  const buyerResult = await sql`
    SELECT
      COUNT(*) as order_count,
      COALESCE(AVG(total), 0) as avg_value
    FROM seller_quotes
    WHERE status = 'accepted'
    LIMIT 1
  `;

  const buyerHistory = buyerResult.rows.length > 0 && parseInt(buyerResult.rows[0]?.order_count as string) > 0
    ? {
        previousOrders: parseInt(buyerResult.rows[0].order_count as string),
        averageOrderValue: parseFloat(buyerResult.rows[0].avg_value as string) || 0,
        paymentHistory: 'good' as const,
      }
    : undefined;

  return {
    competitorCount,
    estimatedCompetitorPrices: [], // Would need market data integration
    marketPosition: 'competitive',
    urgencyLevel: rfq.urgency === 'critical' ? 'high' : rfq.urgency === 'urgent' ? 'medium' : 'low',
    buyerHistory,
  };
}

/**
 * Calculate how competitive a price is (0-100)
 */
function calculateCompetitiveScore(
  price: number,
  competition: CompetitionContext,
  rfq: RFQRequest
): number {
  let score = 50; // Base score

  // Compare to target price if available
  if (rfq.targetPrice) {
    const priceDiff = (price - rfq.targetPrice) / rfq.targetPrice;
    if (priceDiff <= 0) {
      score += 30; // At or below target
    } else if (priceDiff <= 0.1) {
      score += 20; // Within 10% of target
    } else if (priceDiff <= 0.2) {
      score += 10; // Within 20% of target
    } else {
      score -= 10; // More than 20% above target
    }
  }

  // Compare to competitor prices if available
  if (competition.estimatedCompetitorPrices.length > 0) {
    const avgCompetitor = competition.estimatedCompetitorPrices.reduce((a, b) => a + b, 0) /
      competition.estimatedCompetitorPrices.length;
    const compDiff = (price - avgCompetitor) / avgCompetitor;

    if (compDiff <= -0.1) {
      score += 20; // 10%+ below competition
    } else if (compDiff <= 0) {
      score += 10; // Below competition
    } else if (compDiff > 0.1) {
      score -= 15; // 10%+ above competition
    }
  }

  // Adjust for competition level
  if (competition.competitorCount > 5) {
    score -= 10; // Tough market
  } else if (competition.competitorCount <= 2) {
    score += 10; // Low competition
  }

  // Buyer relationship bonus
  if (competition.buyerHistory && competition.buyerHistory.previousOrders > 0) {
    score += Math.min(10, competition.buyerHistory.previousOrders * 2);
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get market insights for a product category
 */
export async function getMarketInsights(
  sellerId: string,
  category: string
): Promise<{
  avgMarketPrice: number;
  priceRange: { min: number; max: number };
  competitorCount: number;
  marketTrend: 'up' | 'stable' | 'down';
  recentWinRate: number;
  recommendations: string[];
}> {
  // Get seller's pricing in category
  const sellerResult = await sql`
    SELECT AVG((pricing->>'basePrice')::numeric) as avg_price
    FROM seller_catalog
    WHERE seller_id = ${sellerId}
    AND category = ${category}
    AND is_active = true
  `;

  // Get market pricing (all sellers)
  const marketResult = await sql`
    SELECT
      AVG((pricing->>'basePrice')::numeric) as avg_price,
      MIN((pricing->>'basePrice')::numeric) as min_price,
      MAX((pricing->>'basePrice')::numeric) as max_price,
      COUNT(DISTINCT seller_id) as competitor_count
    FROM seller_catalog
    WHERE category = ${category}
    AND is_active = true
  `;

  // Get recent win rate
  const winRateResult = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'accepted') * 100.0 / NULLIF(COUNT(*), 0) as win_rate
    FROM seller_quotes
    WHERE seller_id = ${sellerId}
    AND created_at > NOW() - INTERVAL '30 days'
  `;

  const sellerAvgPrice = parseFloat(sellerResult.rows[0]?.avg_price as string) || 0;
  const marketAvgPrice = parseFloat(marketResult.rows[0]?.avg_price as string) || 0;
  const minPrice = parseFloat(marketResult.rows[0]?.min_price as string) || 0;
  const maxPrice = parseFloat(marketResult.rows[0]?.max_price as string) || 0;
  const competitorCount = parseInt(marketResult.rows[0]?.competitor_count as string) || 0;
  const winRate = parseFloat(winRateResult.rows[0]?.win_rate as string) || 0;

  const recommendations: string[] = [];

  // Generate recommendations
  if (sellerAvgPrice > marketAvgPrice * 1.2) {
    recommendations.push(`Your prices are ${Math.round((sellerAvgPrice / marketAvgPrice - 1) * 100)}% above market average - consider adjusting for competitiveness`);
  } else if (sellerAvgPrice < marketAvgPrice * 0.8) {
    recommendations.push(`Your prices are ${Math.round((1 - sellerAvgPrice / marketAvgPrice) * 100)}% below market - you may have room to increase margins`);
  }

  if (winRate < 20) {
    recommendations.push('Your win rate is below 20% - consider more aggressive pricing or faster response times');
  } else if (winRate > 60) {
    recommendations.push('Your high win rate suggests you might be able to increase prices slightly');
  }

  if (competitorCount > 10) {
    recommendations.push('This is a highly competitive category - focus on differentiation and fast response times');
  }

  return {
    avgMarketPrice: marketAvgPrice,
    priceRange: { min: minPrice, max: maxPrice },
    competitorCount,
    marketTrend: 'stable', // Would need historical data
    recentWinRate: winRate,
    recommendations,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const QuoteGenerator = {
  generateQuoteForRFQ,
  approveQuote,
  rejectQuote,
  counterQuote,
  getQuote,
  getSellerQuotes,
  calculateCompetitivePrice,
  getMarketInsights,
};

export default QuoteGenerator;
