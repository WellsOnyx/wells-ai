/**
 * Supplier AI Quote Generator
 * Generates initial quotes from supplier catalog and pricing rules
 */

import Anthropic from '@anthropic-ai/sdk';
import { sqlQuery as sql } from '@/lib/db';
import {
  RFQQuote,
  SupplierCatalogItem,
  VolumeDiscount,
  QuoteTerms,
} from './types';
import { createQuote } from './quote-service';

const anthropic = new Anthropic();

// ============================================================================
// CATALOG MANAGEMENT
// ============================================================================

/**
 * Get catalog items for a supplier
 */
export async function getSupplierCatalog(
  supplierId: string
): Promise<SupplierCatalogItem[]> {
  const result = await sql`
    SELECT * FROM supplier_catalog
    WHERE supplier_id = ${supplierId}
      AND active = true
    ORDER BY product_category, product_name
  `;

  return result.rows.map(mapCatalogRow);
}

/**
 * Find catalog items matching an RFQ
 */
export async function findMatchingCatalogItems(
  rfqCategory: string,
  rfqDescription: string,
  supplierId: string
): Promise<SupplierCatalogItem[]> {
  // First try exact category match
  let result = await sql`
    SELECT * FROM supplier_catalog
    WHERE supplier_id = ${supplierId}
      AND active = true
      AND LOWER(product_category) = LOWER(${rfqCategory})
  `;

  // If no exact match, try fuzzy search
  if (result.rows.length === 0) {
    result = await sql`
      SELECT * FROM supplier_catalog
      WHERE supplier_id = ${supplierId}
        AND active = true
        AND (
          LOWER(product_category) LIKE LOWER(${'%' + rfqCategory + '%'})
          OR LOWER(product_name) LIKE LOWER(${'%' + rfqCategory + '%'})
          OR LOWER(product_description) LIKE LOWER(${'%' + rfqCategory + '%'})
        )
    `;
  }

  return result.rows.map(mapCatalogRow);
}

/**
 * Add or update a catalog item
 */
export async function upsertCatalogItem(
  supplierId: string,
  item: Partial<SupplierCatalogItem>
): Promise<SupplierCatalogItem> {
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
      ${JSON.stringify(item.volumeDiscounts || [])},
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
    ON CONFLICT (supplier_id, product_sku) DO UPDATE SET
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

  return mapCatalogRow(result.rows[0]);
}

// ============================================================================
// AI QUOTE GENERATION
// ============================================================================

/**
 * Generate an AI quote for an RFQ from a supplier's catalog
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
  // Find matching catalog items
  const catalogItems = await findMatchingCatalogItems(
    rfqDetails.category,
    rfqDetails.description,
    supplierId
  );

  if (catalogItems.length === 0) {
    // No catalog items - supplier needs to quote manually
    return null;
  }

  // Find best matching item
  const bestMatch = await selectBestCatalogMatch(catalogItems, rfqDetails);
  if (!bestMatch) return null;

  // Check if auto-quote is enabled
  if (!bestMatch.aiAutoQuoteEnabled) {
    return null;
  }

  // Calculate pricing
  const pricing = calculateQuotePricing(
    bestMatch,
    rfqDetails.quantity,
    rfqDetails.urgency
  );

  // Determine lead time
  const leadTime = rfqDetails.urgency === 'critical' && bestMatch.rushLeadTimeDays
    ? bestMatch.rushLeadTimeDays
    : bestMatch.standardLeadTimeDays;

  // Calculate shipping estimate
  const shippingCost = estimateShipping(
    rfqDetails.deliveryLocation,
    rfqDetails.quantity,
    bestMatch
  );

  // Generate quote notes using AI
  const notes = await generateQuoteNotes(rfqDetails, bestMatch, pricing);

  // Create the quote
  const quote = await createQuote({
    rfqId,
    supplierId,
    unitPrice: pricing.unitPrice,
    quantity: rfqDetails.quantity,
    leadTimeDays: leadTime,
    paymentTerms: bestMatch.defaultPaymentTerms,
    warrantyMonths: bestMatch.warrantyMonths,
    shippingCost,
    shippingMethod: 'Standard Ground',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    notes,
    aiGenerated: true,
    aiConfidenceScore: pricing.confidenceScore,
    sourceCatalogId: bestMatch.id,
  });

  return quote;
}

/**
 * Select the best catalog item for an RFQ using AI
 */
async function selectBestCatalogMatch(
  items: SupplierCatalogItem[],
  rfqDetails: { category: string; description: string; quantity: number }
): Promise<SupplierCatalogItem | null> {
  if (items.length === 1) return items[0];

  // Use AI to select best match
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    system: 'You are a procurement matching assistant. Select the best product match for the RFQ. Respond with only the product index (0-based).',
    messages: [
      {
        role: 'user',
        content: `RFQ Details:
Category: ${rfqDetails.category}
Description: ${rfqDetails.description}
Quantity: ${rfqDetails.quantity}

Available Products:
${items.map((item, i) => `${i}. ${item.productName} - ${item.productDescription || 'No description'} (Category: ${item.productCategory})`).join('\n')}

Which product index (0-${items.length - 1}) is the best match? Respond with only the number.`,
      },
    ],
  });

  const indexText = response.content[0].type === 'text' ? response.content[0].text.trim() : '0';
  const index = parseInt(indexText);

  if (isNaN(index) || index < 0 || index >= items.length) {
    return items[0]; // Default to first item
  }

  return items[index];
}

/**
 * Calculate quote pricing based on catalog, quantity, and urgency
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

  // Apply volume discount
  const volumeDiscounts = catalogItem.volumeDiscounts || [];
  for (const discount of volumeDiscounts.sort((a, b) => b.minQuantity - a.minQuantity)) {
    if (quantity >= discount.minQuantity && (!discount.maxQuantity || quantity <= discount.maxQuantity)) {
      discountApplied = discount.discountPercentage;
      unitPrice = catalogItem.baseUnitPrice * (1 - discount.discountPercentage / 100);
      break;
    }
  }

  // Apply rush fee if applicable
  if (urgency !== 'standard' && catalogItem.rushFeePercentage) {
    const rushMultiplier = urgency === 'critical' ? 1 : 0.5;
    unitPrice *= (1 + (catalogItem.rushFeePercentage / 100) * rushMultiplier);
  }

  // Ensure minimum margin
  const minMarginPrice = catalogItem.baseUnitPrice * (1 + catalogItem.aiMinMarginPercentage / 100);
  if (unitPrice < minMarginPrice) {
    unitPrice = minMarginPrice;
  }

  // Calculate confidence score
  let confidenceScore = 85;
  if (quantity >= (catalogItem.minimumOrderQty * 2)) confidenceScore += 5;
  if (volumeDiscounts.length > 0) confidenceScore += 5;
  if (catalogItem.productDescription) confidenceScore += 5;

  return {
    unitPrice: Math.round(unitPrice * 100) / 100,
    totalPrice: Math.round(unitPrice * quantity * 100) / 100,
    discountApplied,
    confidenceScore: Math.min(100, confidenceScore),
  };
}

/**
 * Estimate shipping cost
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
  }

  // Add for long-distance (rough estimate based on common locations)
  const destination_lower = destination.toLowerCase();
  if (destination_lower.includes('ak') || destination_lower.includes('hawaii') || destination_lower.includes('hi')) {
    baseCost *= 2;
  } else if (destination_lower.includes('west') || destination_lower.includes('ca') || destination_lower.includes('wa')) {
    baseCost *= 1.2;
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
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      system: 'Generate a brief, professional quote note (2-3 sentences). Be specific but concise.',
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

    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : 'Thank you for your inquiry. We look forward to working with you.';
  } catch {
    return 'Quote generated based on current pricing and availability. Contact us for any questions.';
  }
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
  // Calculate floor price (minimum acceptable)
  const floorPrice = catalogItem.baseUnitPrice * (1 - catalogItem.aiNegotiationFloorPercentage / 100);
  const floorTotal = floorPrice * buyerOffer.quantity;

  // Check if buyer offer is at or above floor
  if (buyerOffer.totalPrice >= floorTotal) {
    return {
      accept: true,
      message: `We're pleased to accept your offer of $${buyerOffer.totalPrice.toFixed(2)}. Thank you for your business.`,
    };
  }

  // If we're at max rounds and offer is reasonable, accept
  if (negotiationRound >= maxRounds - 1 && buyerOffer.totalPrice >= floorTotal * 0.95) {
    return {
      accept: true,
      message: `We can agree to $${buyerOffer.totalPrice.toFixed(2)} to close this deal.`,
    };
  }

  // Calculate counter-offer
  const gap = currentPosition.totalPrice - buyerOffer.totalPrice;
  const concession = gap * (0.3 + (negotiationRound * 0.1)); // Increase concessions each round

  let counterTotal = Math.max(floorTotal, currentPosition.totalPrice - concession);
  const counterUnit = counterTotal / buyerOffer.quantity;

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
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 150,
      system: 'You are a supplier AI negotiating a deal. Be professional, concise, and reasonable. Generate a 1-2 sentence response.',
      messages: [
        {
          role: 'user',
          content: `Buyer offered $${buyerOffer.totalPrice.toFixed(2)} (round ${round}/${maxRounds}).
Our counter: $${counterOffer.totalPrice.toFixed(2)}.
Price difference: $${(counterOffer.totalPrice - buyerOffer.totalPrice).toFixed(2)}.

Generate a professional response explaining our counter-offer.`,
        },
      ],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : `We appreciate your offer and can meet you at $${counterOffer.totalPrice.toFixed(2)}.`;
  } catch {
    return `We can offer $${counterOffer.totalPrice.toFixed(2)} which represents our best value for this order.`;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function mapCatalogRow(row: any): SupplierCatalogItem {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    productCategory: row.product_category,
    productName: row.product_name,
    productSku: row.product_sku,
    productDescription: row.product_description,
    baseUnitPrice: parseFloat(row.base_unit_price),
    currency: row.currency || 'USD',
    minimumOrderQty: row.minimum_order_qty || 1,
    volumeDiscounts: row.volume_discounts || [],
    standardLeadTimeDays: row.standard_lead_time_days,
    rushLeadTimeDays: row.rush_lead_time_days,
    rushFeePercentage: row.rush_fee_percentage ? parseFloat(row.rush_fee_percentage) : undefined,
    defaultPaymentTerms: row.default_payment_terms,
    warrantyMonths: row.warranty_months,
    aiPricingEnabled: row.ai_pricing_enabled,
    aiMinMarginPercentage: parseFloat(row.ai_min_margin_percentage || '15'),
    aiNegotiationFloorPercentage: parseFloat(row.ai_negotiation_floor_percentage || '5'),
    aiAutoQuoteEnabled: row.ai_auto_quote_enabled,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Request quotes from all matched suppliers
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
  manualRequests: string[]; // supplier IDs that need manual quotes
}> {
  // Get matched suppliers for this RFQ
  const matches = await sql`
    SELECT supplier_id FROM supplier_matches
    WHERE rfq_id = ${rfqId}
      AND status NOT IN ('rejected')
    ORDER BY match_score DESC
  `;

  const autoQuotes: RFQQuote[] = [];
  const manualRequests: string[] = [];

  for (const match of matches.rows) {
    try {
      const quote = await generateSupplierQuote(
        rfqId,
        match.supplier_id,
        rfqDetails
      );

      if (quote) {
        autoQuotes.push(quote);
      } else {
        manualRequests.push(match.supplier_id);
      }
    } catch (error) {
      console.error(`Error generating quote for supplier ${match.supplier_id}:`, error);
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
  }

  return { autoQuotes, manualRequests };
}
