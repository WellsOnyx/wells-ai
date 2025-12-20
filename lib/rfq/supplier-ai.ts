/**
 * Supplier AI Quote Generation Service
 * Generates AI quotes from supplier catalogs with intelligent pricing
 *
 * Features:
 * - Match RFQ requirements to supplier catalog items
 * - Generate AI quotes with pricing based on catalog rules
 * - Apply volume discounts
 * - Calculate lead times
 * - Set confidence scores
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import {
  RFQQuote,
  SupplierCatalogItem,
  VolumeDiscount,
  QuoteTerms,
  CreateQuoteInput,
} from './types';

const anthropic = new Anthropic();

// Logging prefix for all supplier AI operations
const LOG_PREFIX = '[Supplier AI]';

// ============================================================================
// CATALOG MANAGEMENT
// ============================================================================

/**
 * Get all catalog items for a supplier
 */
export async function getSupplierCatalog(
  supplierId: string
): Promise<SupplierCatalogItem[]> {
  console.log(`${LOG_PREFIX} Fetching catalog for supplier: ${supplierId}`);

  const result = await sql`
    SELECT * FROM supplier_catalog
    WHERE supplier_id = ${supplierId}
      AND active = true
    ORDER BY product_category, product_name
  `;

  console.log(`${LOG_PREFIX} Found ${result.rows.length} catalog items for supplier ${supplierId}`);
  return result.rows.map(mapCatalogRow);
}

/**
 * Find catalog items matching an RFQ based on category and description
 */
export async function findMatchingCatalogItems(
  rfqCategory: string,
  rfqDescription: string,
  supplierId: string
): Promise<SupplierCatalogItem[]> {
  console.log(`${LOG_PREFIX} Finding catalog matches for category: "${rfqCategory}" from supplier: ${supplierId}`);

  // First try exact category match
  let result = await sql`
    SELECT * FROM supplier_catalog
    WHERE supplier_id = ${supplierId}
      AND active = true
      AND ai_auto_quote_enabled = true
      AND LOWER(product_category) = LOWER(${rfqCategory})
  `;

  // If no exact match, try fuzzy search on category, name, and description
  if (result.rows.length === 0) {
    console.log(`${LOG_PREFIX} No exact category match, trying fuzzy search`);

    const searchPattern = `%${rfqCategory}%`;
    result = await sql`
      SELECT * FROM supplier_catalog
      WHERE supplier_id = ${supplierId}
        AND active = true
        AND ai_auto_quote_enabled = true
        AND (
          LOWER(product_category) LIKE LOWER(${searchPattern})
          OR LOWER(product_name) LIKE LOWER(${searchPattern})
          OR LOWER(product_description) LIKE LOWER(${searchPattern})
        )
    `;
  }

  console.log(`${LOG_PREFIX} Found ${result.rows.length} matching catalog items`);
  return result.rows.map(mapCatalogRow);
}

/**
 * Add or update a catalog item for a supplier
 */
export async function upsertCatalogItem(
  supplierId: string,
  item: Partial<SupplierCatalogItem>
): Promise<SupplierCatalogItem> {
  console.log(`${LOG_PREFIX} Upserting catalog item for supplier: ${supplierId}, product: ${item.productName}`);

  const volumeDiscountsJson = JSON.stringify(item.volumeDiscounts || []);

  const result = await sql`
    INSERT INTO supplier_catalog (
      supplier_id,
      product_category,
      product_name,
      product_sku,
      product_description,
      base_unit_price,
      currency,
      minimum_order_qty,
      volume_discounts,
      standard_lead_time_days,
      rush_lead_time_days,
      rush_fee_percentage,
      default_payment_terms,
      warranty_months,
      ai_pricing_enabled,
      ai_min_margin_percentage,
      ai_negotiation_floor_percentage,
      ai_auto_quote_enabled
    ) VALUES (
      ${supplierId},
      ${item.productCategory || 'General'},
      ${item.productName || 'Product'},
      ${item.productSku || null},
      ${item.productDescription || null},
      ${item.baseUnitPrice || 0},
      ${item.currency || 'USD'},
      ${item.minimumOrderQty || 1},
      ${volumeDiscountsJson}::jsonb,
      ${item.standardLeadTimeDays || 7},
      ${item.rushLeadTimeDays || null},
      ${item.rushFeePercentage || null},
      ${item.defaultPaymentTerms || 'Net 30'},
      ${item.warrantyMonths || null},
      ${item.aiPricingEnabled ?? true},
      ${item.aiMinMarginPercentage || 15},
      ${item.aiNegotiationFloorPercentage || 5},
      ${item.aiAutoQuoteEnabled ?? true}
    )
    ON CONFLICT (id) DO UPDATE SET
      product_category = EXCLUDED.product_category,
      product_name = EXCLUDED.product_name,
      product_description = EXCLUDED.product_description,
      base_unit_price = EXCLUDED.base_unit_price,
      volume_discounts = EXCLUDED.volume_discounts,
      standard_lead_time_days = EXCLUDED.standard_lead_time_days,
      rush_lead_time_days = EXCLUDED.rush_lead_time_days,
      rush_fee_percentage = EXCLUDED.rush_fee_percentage,
      default_payment_terms = EXCLUDED.default_payment_terms,
      warranty_months = EXCLUDED.warranty_months,
      ai_pricing_enabled = EXCLUDED.ai_pricing_enabled,
      ai_min_margin_percentage = EXCLUDED.ai_min_margin_percentage,
      ai_negotiation_floor_percentage = EXCLUDED.ai_negotiation_floor_percentage,
      ai_auto_quote_enabled = EXCLUDED.ai_auto_quote_enabled,
      updated_at = NOW()
    RETURNING *
  `;

  console.log(`${LOG_PREFIX} Catalog item upserted successfully: ${result.rows[0].id}`);
  return mapCatalogRow(result.rows[0]);
}

/**
 * Get a specific catalog item by ID
 */
export async function getCatalogItem(itemId: string): Promise<SupplierCatalogItem | null> {
  console.log(`${LOG_PREFIX} Fetching catalog item: ${itemId}`);

  const result = await sql`
    SELECT * FROM supplier_catalog
    WHERE id = ${itemId}
  `;

  if (result.rows.length === 0) {
    console.log(`${LOG_PREFIX} Catalog item not found: ${itemId}`);
    return null;
  }

  return mapCatalogRow(result.rows[0]);
}

// ============================================================================
// AI QUOTE GENERATION
// ============================================================================

/**
 * Generate an AI quote for an RFQ from a supplier's catalog
 * This is the main entry point for automated quote generation
 */
export async function generateSupplierQuote(
  rfqId: string,
  supplierId: string,
  rfqDetails: {
    category: string;
    description: string;
    quantity: number;
    targetPrice?: number;
    urgency: 'standard' | 'urgent' | 'critical';
    deliveryLocation: string;
  }
): Promise<RFQQuote | null> {
  console.log(`${LOG_PREFIX} Generating quote for RFQ: ${rfqId}, Supplier: ${supplierId}`);
  console.log(`${LOG_PREFIX} RFQ details - Category: ${rfqDetails.category}, Qty: ${rfqDetails.quantity}, Urgency: ${rfqDetails.urgency}`);

  // Find matching catalog items
  const catalogItems = await findMatchingCatalogItems(
    rfqDetails.category,
    rfqDetails.description,
    supplierId
  );

  if (catalogItems.length === 0) {
    console.log(`${LOG_PREFIX} No matching catalog items found - manual quote required`);
    return null;
  }

  // Find best matching item using AI
  const bestMatch = await selectBestCatalogMatch(catalogItems, rfqDetails);
  if (!bestMatch) {
    console.log(`${LOG_PREFIX} Could not select best catalog match`);
    return null;
  }

  console.log(`${LOG_PREFIX} Selected catalog item: ${bestMatch.productName} (${bestMatch.id})`);

  // Check if auto-quote is enabled for this item
  if (!bestMatch.aiAutoQuoteEnabled) {
    console.log(`${LOG_PREFIX} Auto-quote disabled for catalog item: ${bestMatch.id}`);
    return null;
  }

  // Check minimum order quantity
  if (rfqDetails.quantity < bestMatch.minimumOrderQty) {
    console.log(`${LOG_PREFIX} Quantity ${rfqDetails.quantity} below minimum ${bestMatch.minimumOrderQty}`);
    return null;
  }

  // Calculate pricing with volume discounts
  const pricing = calculateQuotePricing(
    bestMatch,
    rfqDetails.quantity,
    rfqDetails.urgency
  );

  console.log(`${LOG_PREFIX} Calculated pricing - Unit: $${pricing.unitPrice}, Total: $${pricing.totalPrice}, Discount: ${pricing.discountApplied}%`);

  // Determine lead time based on urgency
  const leadTimeDays = calculateLeadTime(bestMatch, rfqDetails.urgency);
  console.log(`${LOG_PREFIX} Lead time: ${leadTimeDays} days`);

  // Calculate shipping estimate
  const shippingCost = estimateShipping(
    rfqDetails.deliveryLocation,
    rfqDetails.quantity,
    bestMatch
  );
  console.log(`${LOG_PREFIX} Estimated shipping: $${shippingCost}`);

  // Generate professional quote notes using AI
  const notes = await generateQuoteNotes(rfqDetails, bestMatch, pricing);

  // Calculate valid until date (30 days from now)
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  // Create the quote in the database
  const quote = await createAIQuote({
    rfqId,
    supplierId,
    unitPrice: pricing.unitPrice,
    quantity: rfqDetails.quantity,
    totalPrice: pricing.totalPrice,
    leadTimeDays,
    paymentTerms: bestMatch.defaultPaymentTerms,
    warrantyMonths: bestMatch.warrantyMonths,
    shippingCost,
    shippingMethod: 'Standard Ground',
    validUntil: validUntil.toISOString(),
    notes,
    aiGenerated: true,
    aiConfidenceScore: pricing.confidenceScore,
    sourceCatalogId: bestMatch.id,
  });

  console.log(`${LOG_PREFIX} Quote generated successfully: ${quote.id}`);
  return quote;
}

/**
 * Select the best catalog item for an RFQ using AI
 */
async function selectBestCatalogMatch(
  items: SupplierCatalogItem[],
  rfqDetails: { category: string; description: string; quantity: number }
): Promise<SupplierCatalogItem | null> {
  if (items.length === 0) return null;
  if (items.length === 1) {
    console.log(`${LOG_PREFIX} Single catalog match, selecting automatically`);
    return items[0];
  }

  console.log(`${LOG_PREFIX} Using AI to select best match from ${items.length} items`);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: 'You are a procurement matching assistant. Select the best product match for the RFQ. Respond with only the product index (0-based) and nothing else.',
      messages: [
        {
          role: 'user',
          content: `RFQ Details:
Category: ${rfqDetails.category}
Description: ${rfqDetails.description}
Quantity: ${rfqDetails.quantity}

Available Products:
${items.map((item, i) => `${i}. ${item.productName} - ${item.productDescription || 'No description'} (Category: ${item.productCategory}, Base Price: $${item.baseUnitPrice})`).join('\n')}

Which product index (0-${items.length - 1}) is the best match? Respond with only the number.`,
        },
      ],
    });

    const indexText = response.content[0].type === 'text' ? response.content[0].text.trim() : '0';
    const index = parseInt(indexText);

    if (isNaN(index) || index < 0 || index >= items.length) {
      console.log(`${LOG_PREFIX} AI returned invalid index "${indexText}", defaulting to first item`);
      return items[0];
    }

    console.log(`${LOG_PREFIX} AI selected item at index ${index}: ${items[index].productName}`);
    return items[index];
  } catch (error) {
    console.error(`${LOG_PREFIX} Error in AI catalog matching:`, error);
    return items[0]; // Default to first item on error
  }
}

/**
 * Calculate quote pricing based on catalog, quantity, and urgency
 * Applies volume discounts and rush fees
 */
function calculateQuotePricing(
  catalogItem: SupplierCatalogItem,
  quantity: number,
  urgency: 'standard' | 'urgent' | 'critical'
): {
  unitPrice: number;
  totalPrice: number;
  discountApplied: number;
  confidenceScore: number;
} {
  let unitPrice = catalogItem.baseUnitPrice;
  let discountApplied = 0;

  // Apply volume discounts (check from highest to lowest tier)
  const volumeDiscounts = catalogItem.volumeDiscounts || [];
  const sortedDiscounts = [...volumeDiscounts].sort((a, b) => b.minQuantity - a.minQuantity);

  for (const discount of sortedDiscounts) {
    const meetsMinimum = quantity >= discount.minQuantity;
    const meetsMaximum = !discount.maxQuantity || quantity <= discount.maxQuantity;

    if (meetsMinimum && meetsMaximum) {
      discountApplied = discount.discountPercentage;
      unitPrice = catalogItem.baseUnitPrice * (1 - discount.discountPercentage / 100);
      console.log(`${LOG_PREFIX} Applied ${discount.discountPercentage}% volume discount for qty >= ${discount.minQuantity}`);
      break;
    }
  }

  // Apply rush fee if applicable
  if (urgency !== 'standard' && catalogItem.rushFeePercentage) {
    const rushMultiplier = urgency === 'critical' ? 1 : 0.5; // Full fee for critical, half for urgent
    const rushFee = (catalogItem.rushFeePercentage / 100) * rushMultiplier;
    unitPrice *= (1 + rushFee);
    console.log(`${LOG_PREFIX} Applied ${rushFee * 100}% rush fee for ${urgency} urgency`);
  }

  // Ensure minimum margin is maintained
  const minMarginPrice = catalogItem.baseUnitPrice * (1 + catalogItem.aiMinMarginPercentage / 100);
  if (unitPrice < minMarginPrice) {
    console.log(`${LOG_PREFIX} Adjusting price to maintain minimum margin of ${catalogItem.aiMinMarginPercentage}%`);
    unitPrice = minMarginPrice;
  }

  // Calculate confidence score based on data quality
  let confidenceScore = calculateConfidenceScore(catalogItem, quantity, volumeDiscounts);

  const totalPrice = unitPrice * quantity;

  return {
    unitPrice: Math.round(unitPrice * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
    discountApplied,
    confidenceScore,
  };
}

/**
 * Calculate confidence score for the generated quote
 */
function calculateConfidenceScore(
  catalogItem: SupplierCatalogItem,
  quantity: number,
  volumeDiscounts: VolumeDiscount[]
): number {
  let score = 75; // Base score

  // Higher confidence for well-documented products
  if (catalogItem.productDescription && catalogItem.productDescription.length > 50) {
    score += 5;
  }

  // Higher confidence for products with SKU
  if (catalogItem.productSku) {
    score += 5;
  }

  // Higher confidence for orders meeting minimum
  if (quantity >= catalogItem.minimumOrderQty * 2) {
    score += 5;
  }

  // Higher confidence with volume discounts defined
  if (volumeDiscounts.length > 0) {
    score += 5;
  }

  // Higher confidence if warranty is specified
  if (catalogItem.warrantyMonths) {
    score += 3;
  }

  // Higher confidence if payment terms are specified
  if (catalogItem.defaultPaymentTerms) {
    score += 2;
  }

  return Math.min(100, score);
}

/**
 * Calculate lead time based on urgency and catalog configuration
 */
function calculateLeadTime(
  catalogItem: SupplierCatalogItem,
  urgency: 'standard' | 'urgent' | 'critical'
): number {
  if (urgency === 'critical' && catalogItem.rushLeadTimeDays) {
    return catalogItem.rushLeadTimeDays;
  }

  if (urgency === 'urgent' && catalogItem.rushLeadTimeDays) {
    // For urgent, use midpoint between rush and standard
    return Math.ceil((catalogItem.rushLeadTimeDays + catalogItem.standardLeadTimeDays) / 2);
  }

  return catalogItem.standardLeadTimeDays;
}

/**
 * Estimate shipping cost based on destination and quantity
 */
function estimateShipping(
  destination: string,
  quantity: number,
  catalogItem: SupplierCatalogItem
): number {
  // Base shipping estimate
  let baseCost = 15;

  // Add per-unit cost for larger orders
  if (quantity > 100) {
    baseCost += (quantity - 100) * 0.25;
  } else if (quantity > 50) {
    baseCost += (quantity - 50) * 0.15;
  }

  // Regional adjustments based on destination
  const destinationLower = destination.toLowerCase();

  // Alaska and Hawaii - double the cost
  if (destinationLower.includes('alaska') || destinationLower.includes('ak') ||
      destinationLower.includes('hawaii') || destinationLower.includes('hi')) {
    baseCost *= 2;
  }
  // West coast - 20% premium
  else if (destinationLower.includes('california') || destinationLower.includes('ca') ||
           destinationLower.includes('washington') || destinationLower.includes('wa') ||
           destinationLower.includes('oregon') || destinationLower.includes('or')) {
    baseCost *= 1.2;
  }
  // International - 3x cost
  else if (!destinationLower.includes('usa') && !destinationLower.includes('united states') &&
           destinationLower.includes(',')) {
    baseCost *= 3;
  }

  return Math.round(baseCost * 100) / 100;
}

/**
 * Generate professional quote notes using AI
 */
async function generateQuoteNotes(
  rfqDetails: { category: string; description: string; quantity: number; urgency: string },
  catalogItem: SupplierCatalogItem,
  pricing: { unitPrice: number; discountApplied: number }
): Promise<string> {
  console.log(`${LOG_PREFIX} Generating quote notes with AI`);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      system: 'Generate a brief, professional quote note (2-3 sentences). Be specific but concise. Do not use markdown formatting.',
      messages: [
        {
          role: 'user',
          content: `Generate a quote note for:
Product: ${catalogItem.productName}
Customer request: ${rfqDetails.description}
Quantity: ${rfqDetails.quantity} units
Unit price: $${pricing.unitPrice}
${pricing.discountApplied > 0 ? `Volume discount: ${pricing.discountApplied}%` : ''}
Lead time: ${catalogItem.standardLeadTimeDays} days
${catalogItem.warrantyMonths ? `Warranty: ${catalogItem.warrantyMonths} months` : ''}`,
        },
      ],
    });

    const notes = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : 'Thank you for your inquiry. We look forward to working with you.';

    console.log(`${LOG_PREFIX} Generated quote notes successfully`);
    return notes;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error generating quote notes:`, error);
    return 'Quote generated based on current pricing and availability. Contact us for any questions.';
  }
}

/**
 * Create an AI-generated quote in the database
 */
async function createAIQuote(input: CreateQuoteInput): Promise<RFQQuote> {
  console.log(`${LOG_PREFIX} Creating AI quote in database for RFQ: ${input.rfqId}`);

  const totalPrice = input.unitPrice * input.quantity;
  const lineItemsJson = JSON.stringify(input.lineItems || []);

  const result = await sql`
    INSERT INTO rfq_quotes (
      rfq_id,
      supplier_id,
      unit_price,
      quantity,
      total_price,
      currency,
      lead_time_days,
      payment_terms,
      warranty_months,
      shipping_cost,
      shipping_method,
      valid_until,
      notes,
      line_items,
      ai_generated,
      ai_confidence_score,
      source_catalog_id,
      is_initial_quote,
      parent_quote_id,
      negotiation_round,
      status
    ) VALUES (
      ${input.rfqId},
      ${input.supplierId},
      ${input.unitPrice},
      ${input.quantity},
      ${totalPrice},
      'USD',
      ${input.leadTimeDays},
      ${input.paymentTerms || 'Net 30'},
      ${input.warrantyMonths || null},
      ${input.shippingCost || 0},
      ${input.shippingMethod || 'Standard Ground'},
      ${input.validUntil || null},
      ${input.notes || null},
      ${lineItemsJson}::jsonb,
      ${input.aiGenerated ?? true},
      ${input.aiConfidenceScore || null},
      ${input.sourceCatalogId || null},
      true,
      ${input.parentQuoteId || null},
      0,
      'pending'
    )
    RETURNING *
  `;

  console.log(`${LOG_PREFIX} Quote created with ID: ${result.rows[0].id}`);
  return mapQuoteRow(result.rows[0]);
}

// ============================================================================
// NEGOTIATION RESPONSE
// ============================================================================

/**
 * Generate supplier AI response to a buyer counter-offer
 */
export async function generateNegotiationResponse(
  catalogItem: SupplierCatalogItem,
  buyerOffer: QuoteTerms,
  currentPosition: QuoteTerms,
  negotiationRound: number,
  maxRounds: number
): Promise<{
  accept: boolean;
  counterOffer?: QuoteTerms;
  message: string;
}> {
  console.log(`${LOG_PREFIX} Processing negotiation round ${negotiationRound}/${maxRounds}`);
  console.log(`${LOG_PREFIX} Buyer offer: $${buyerOffer.totalPrice}, Current position: $${currentPosition.totalPrice}`);

  // Calculate floor price (minimum acceptable based on negotiation floor percentage)
  const floorPrice = catalogItem.baseUnitPrice * (1 - catalogItem.aiNegotiationFloorPercentage / 100);
  const floorTotal = floorPrice * buyerOffer.quantity;

  console.log(`${LOG_PREFIX} Floor price: $${floorPrice.toFixed(2)}/unit, Floor total: $${floorTotal.toFixed(2)}`);

  // Accept if buyer offer meets or exceeds floor
  if (buyerOffer.totalPrice >= floorTotal) {
    console.log(`${LOG_PREFIX} Buyer offer at or above floor - ACCEPTING`);
    return {
      accept: true,
      message: `We're pleased to accept your offer of $${buyerOffer.totalPrice.toFixed(2)}. Thank you for your business.`,
    };
  }

  // If we're at max rounds and offer is within 5% of floor, accept to close deal
  if (negotiationRound >= maxRounds - 1 && buyerOffer.totalPrice >= floorTotal * 0.95) {
    console.log(`${LOG_PREFIX} Final round, offer within 5% of floor - ACCEPTING`);
    return {
      accept: true,
      message: `We can agree to $${buyerOffer.totalPrice.toFixed(2)} to close this deal.`,
    };
  }

  // Calculate counter-offer with increasing concessions each round
  const gap = currentPosition.totalPrice - buyerOffer.totalPrice;
  const concessionRate = 0.3 + (negotiationRound * 0.1); // 30% base + 10% per round
  const concession = gap * Math.min(concessionRate, 0.7); // Cap at 70%

  let counterTotal = Math.max(floorTotal, currentPosition.totalPrice - concession);
  const counterUnit = counterTotal / buyerOffer.quantity;

  console.log(`${LOG_PREFIX} Counter-offer: $${counterTotal.toFixed(2)} (concession rate: ${(concessionRate * 100).toFixed(0)}%)`);

  // Generate message using AI
  const message = await generateNegotiationMessage(
    buyerOffer,
    { ...currentPosition, unitPrice: counterUnit, totalPrice: counterTotal },
    negotiationRound,
    maxRounds
  );

  return {
    accept: false,
    counterOffer: {
      ...currentPosition,
      unitPrice: Math.round(counterUnit * 100) / 100,
      totalPrice: Math.round(counterTotal * 100) / 100,
    },
    message,
  };
}

/**
 * Generate negotiation message using AI
 */
async function generateNegotiationMessage(
  buyerOffer: QuoteTerms,
  counterOffer: QuoteTerms,
  round: number,
  maxRounds: number
): Promise<string> {
  console.log(`${LOG_PREFIX} Generating negotiation message for round ${round}`);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 150,
      system: 'You are a supplier AI negotiating a deal. Be professional, concise, and reasonable. Generate a 1-2 sentence response. Do not use markdown.',
      messages: [
        {
          role: 'user',
          content: `Buyer offered $${buyerOffer.totalPrice.toFixed(2)} (round ${round}/${maxRounds}).
Our counter: $${counterOffer.totalPrice.toFixed(2)}.
Price difference: $${(counterOffer.totalPrice - buyerOffer.totalPrice).toFixed(2)}.
${round >= maxRounds - 1 ? 'This is the final round.' : ''}

Generate a professional response explaining our counter-offer.`,
        },
      ],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : `We appreciate your offer and can meet you at $${counterOffer.totalPrice.toFixed(2)}.`;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error generating negotiation message:`, error);
    return `We can offer $${counterOffer.totalPrice.toFixed(2)} which represents our best value for this order.`;
  }
}

// ============================================================================
// BATCH QUOTE GENERATION
// ============================================================================

/**
 * Request quotes from all matched suppliers for an RFQ
 */
export async function requestQuotesFromSuppliers(
  rfqId: string,
  rfqDetails: {
    category: string;
    description: string;
    quantity: number;
    targetPrice?: number;
    urgency: 'standard' | 'urgent' | 'critical';
    deliveryLocation: string;
  }
): Promise<{
  autoQuotes: RFQQuote[];
  manualRequests: string[];
}> {
  console.log(`${LOG_PREFIX} Requesting quotes from all matched suppliers for RFQ: ${rfqId}`);

  // Get matched suppliers for this RFQ
  const matches = await sql`
    SELECT supplier_id, match_score FROM supplier_matches
    WHERE rfq_id = ${rfqId}
      AND status NOT IN ('rejected', 'declined')
    ORDER BY match_score DESC
  `;

  console.log(`${LOG_PREFIX} Found ${matches.rows.length} matched suppliers`);

  const autoQuotes: RFQQuote[] = [];
  const manualRequests: string[] = [];

  for (const match of matches.rows) {
    try {
      console.log(`${LOG_PREFIX} Processing supplier: ${match.supplier_id} (score: ${match.match_score})`);

      const quote = await generateSupplierQuote(
        rfqId,
        match.supplier_id,
        rfqDetails
      );

      if (quote) {
        autoQuotes.push(quote);
        console.log(`${LOG_PREFIX} Auto-quote generated for supplier: ${match.supplier_id}`);
      } else {
        manualRequests.push(match.supplier_id);
        console.log(`${LOG_PREFIX} Manual quote required for supplier: ${match.supplier_id}`);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Error generating quote for supplier ${match.supplier_id}:`, error);
      manualRequests.push(match.supplier_id);
    }
  }

  // Update RFQ status if we got quotes
  if (autoQuotes.length > 0) {
    await sql`
      UPDATE rfqs
      SET status = 'quoted', updated_at = NOW()
      WHERE id = ${rfqId}
    `;
    console.log(`${LOG_PREFIX} Updated RFQ status to 'quoted'`);
  }

  console.log(`${LOG_PREFIX} Quote request complete - Auto: ${autoQuotes.length}, Manual: ${manualRequests.length}`);
  return { autoQuotes, manualRequests };
}

/**
 * Get all quotes for an RFQ
 */
export async function getQuotesForRFQ(rfqId: string): Promise<RFQQuote[]> {
  console.log(`${LOG_PREFIX} Fetching quotes for RFQ: ${rfqId}`);

  const result = await sql`
    SELECT q.*, s.company_name, s.contact_email
    FROM rfq_quotes q
    LEFT JOIN suppliers s ON q.supplier_id = s.id
    WHERE q.rfq_id = ${rfqId}
    ORDER BY q.total_price ASC
  `;

  console.log(`${LOG_PREFIX} Found ${result.rows.length} quotes for RFQ: ${rfqId}`);
  return result.rows.map(mapQuoteRow);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map database row to SupplierCatalogItem
 */
function mapCatalogRow(row: Record<string, unknown>): SupplierCatalogItem {
  return {
    id: row.id as string,
    supplierId: row.supplier_id as string,
    productCategory: row.product_category as string,
    productName: row.product_name as string,
    productSku: row.product_sku as string | undefined,
    productDescription: row.product_description as string | undefined,
    baseUnitPrice: parseFloat(row.base_unit_price as string),
    currency: (row.currency as string) || 'USD',
    minimumOrderQty: (row.minimum_order_qty as number) || 1,
    volumeDiscounts: (row.volume_discounts as VolumeDiscount[]) || [],
    standardLeadTimeDays: row.standard_lead_time_days as number,
    rushLeadTimeDays: row.rush_lead_time_days as number | undefined,
    rushFeePercentage: row.rush_fee_percentage ? parseFloat(row.rush_fee_percentage as string) : undefined,
    defaultPaymentTerms: row.default_payment_terms as string | undefined,
    warrantyMonths: row.warranty_months as number | undefined,
    aiPricingEnabled: row.ai_pricing_enabled as boolean,
    aiMinMarginPercentage: parseFloat((row.ai_min_margin_percentage as string) || '15'),
    aiNegotiationFloorPercentage: parseFloat((row.ai_negotiation_floor_percentage as string) || '5'),
    aiAutoQuoteEnabled: row.ai_auto_quote_enabled as boolean,
    active: row.active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Map database row to RFQQuote
 */
function mapQuoteRow(row: Record<string, unknown>): RFQQuote {
  return {
    id: row.id as string,
    rfqId: row.rfq_id as string,
    supplierId: row.supplier_id as string,
    unitPrice: parseFloat(row.unit_price as string),
    quantity: row.quantity as number,
    totalPrice: parseFloat(row.total_price as string),
    currency: (row.currency as string) || 'USD',
    leadTimeDays: row.lead_time_days as number,
    paymentTerms: row.payment_terms as string | undefined,
    warrantyMonths: row.warranty_months as number | undefined,
    shippingCost: parseFloat((row.shipping_cost as string) || '0'),
    shippingMethod: row.shipping_method as string | undefined,
    validUntil: row.valid_until ? new Date(row.valid_until as string) : undefined,
    notes: row.notes as string | undefined,
    lineItems: (row.line_items as RFQQuote['lineItems']) || [],
    aiGenerated: row.ai_generated as boolean,
    aiConfidenceScore: row.ai_confidence_score ? parseFloat(row.ai_confidence_score as string) : undefined,
    sourceCatalogId: row.source_catalog_id as string | undefined,
    isInitialQuote: row.is_initial_quote as boolean,
    parentQuoteId: row.parent_quote_id as string | undefined,
    negotiationRound: row.negotiation_round as number,
    status: row.status as RFQQuote['status'],
    supplierConfirmed: row.supplier_confirmed as boolean,
    supplierConfirmedAt: row.supplier_confirmed_at ? new Date(row.supplier_confirmed_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    supplier: row.company_name ? {
      id: row.supplier_id as string,
      companyName: row.company_name as string,
      contactEmail: row.contact_email as string,
    } : undefined,
  };
}
