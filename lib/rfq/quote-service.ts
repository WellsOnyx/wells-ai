/**
 * RFQ Quote Service
 * Handles quote CRUD operations, comparison, and ranking
 */

import { sqlQuery as sql } from '@/lib/db';
import {
  RFQQuote,
  CreateQuoteInput,
  QuoteStatus,
  QuoteComparison,
  RFQConstraints,
  LineItem,
} from './types';

// ============================================================================
// QUOTE CRUD OPERATIONS
// ============================================================================

/**
 * Create a new quote for an RFQ
 */
export async function createQuote(input: CreateQuoteInput): Promise<RFQQuote> {
  const totalPrice = input.unitPrice * input.quantity + (input.shippingCost || 0);

  const result = await sql`
    INSERT INTO rfq_quotes (
      rfq_id,
      supplier_id,
      unit_price,
      quantity,
      total_price,
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
      parent_quote_id,
      negotiation_round,
      is_initial_quote
    ) VALUES (
      ${input.rfqId},
      ${input.supplierId},
      ${input.unitPrice},
      ${input.quantity},
      ${totalPrice},
      ${input.leadTimeDays},
      ${input.paymentTerms || null},
      ${input.warrantyMonths || null},
      ${input.shippingCost || 0},
      ${input.shippingMethod || null},
      ${input.validUntil ? new Date(input.validUntil) : null},
      ${input.notes || null},
      ${JSON.stringify(input.lineItems || [])},
      ${input.aiGenerated || false},
      ${input.aiConfidenceScore || null},
      ${input.sourceCatalogId || null},
      ${input.parentQuoteId || null},
      ${input.parentQuoteId ? 1 : 0},
      ${!input.parentQuoteId}
    )
    RETURNING *
  `;

  // Update RFQ status to quoting if still in matched state
  await sql`
    UPDATE rfqs
    SET status = 'quoting', updated_at = NOW()
    WHERE id = ${input.rfqId} AND status IN ('open', 'matched')
  `;

  return mapQuoteRow(result.rows[0]);
}

/**
 * Get a quote by ID
 */
export async function getQuoteById(quoteId: string): Promise<RFQQuote | null> {
  const result = await sql`
    SELECT q.*, s.company_name, s.contact_email
    FROM rfq_quotes q
    LEFT JOIN suppliers s ON q.supplier_id = s.id
    WHERE q.id = ${quoteId}
  `;

  if (result.rows.length === 0) return null;
  return mapQuoteRow(result.rows[0]);
}

/**
 * Get all quotes for an RFQ
 */
export async function getQuotesByRFQ(rfqId: string): Promise<RFQQuote[]> {
  const result = await sql`
    SELECT q.*, s.company_name, s.contact_email
    FROM rfq_quotes q
    LEFT JOIN suppliers s ON q.supplier_id = s.id
    WHERE q.rfq_id = ${rfqId}
    ORDER BY q.total_price ASC, q.lead_time_days ASC
  `;

  return result.rows.map(mapQuoteRow);
}

/**
 * Get active quotes for an RFQ (excludes rejected, expired, withdrawn)
 */
export async function getActiveQuotesByRFQ(rfqId: string): Promise<RFQQuote[]> {
  const result = await sql`
    SELECT q.*, s.company_name, s.contact_email
    FROM rfq_quotes q
    LEFT JOIN suppliers s ON q.supplier_id = s.id
    WHERE q.rfq_id = ${rfqId}
      AND q.status NOT IN ('rejected', 'expired', 'withdrawn')
    ORDER BY q.total_price ASC, q.lead_time_days ASC
  `;

  return result.rows.map(mapQuoteRow);
}

/**
 * Get the latest quote in a negotiation chain
 */
export async function getLatestNegotiatedQuote(
  rfqId: string,
  supplierId: string
): Promise<RFQQuote | null> {
  const result = await sql`
    SELECT q.*, s.company_name, s.contact_email
    FROM rfq_quotes q
    LEFT JOIN suppliers s ON q.supplier_id = s.id
    WHERE q.rfq_id = ${rfqId}
      AND q.supplier_id = ${supplierId}
    ORDER BY q.negotiation_round DESC, q.created_at DESC
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;
  return mapQuoteRow(result.rows[0]);
}

/**
 * Update quote status
 */
export async function updateQuoteStatus(
  quoteId: string,
  status: QuoteStatus
): Promise<RFQQuote> {
  const result = await sql`
    UPDATE rfq_quotes
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${quoteId}
    RETURNING *
  `;

  return mapQuoteRow(result.rows[0]);
}

/**
 * Mark quote as accepted
 */
export async function acceptQuote(quoteId: string): Promise<RFQQuote> {
  // First, reject all other quotes for this RFQ
  const quote = await getQuoteById(quoteId);
  if (!quote) throw new Error('Quote not found');

  await sql`
    UPDATE rfq_quotes
    SET status = 'rejected', updated_at = NOW()
    WHERE rfq_id = ${quote.rfqId}
      AND id != ${quoteId}
      AND status NOT IN ('rejected', 'expired', 'withdrawn')
  `;

  // Accept this quote
  const result = await sql`
    UPDATE rfq_quotes
    SET status = 'accepted', updated_at = NOW()
    WHERE id = ${quoteId}
    RETURNING *
  `;

  // Update RFQ status
  await sql`
    UPDATE rfqs
    SET status = 'awarded', updated_at = NOW()
    WHERE id = ${quote.rfqId}
  `;

  return mapQuoteRow(result.rows[0]);
}

/**
 * Supplier confirms their quote
 */
export async function confirmQuote(quoteId: string): Promise<RFQQuote> {
  const result = await sql`
    UPDATE rfq_quotes
    SET
      supplier_confirmed = true,
      supplier_confirmed_at = NOW(),
      status = 'active',
      updated_at = NOW()
    WHERE id = ${quoteId}
    RETURNING *
  `;

  return mapQuoteRow(result.rows[0]);
}

/**
 * Create a counter-offer quote (for negotiation)
 */
export async function createCounterOffer(
  parentQuoteId: string,
  newTerms: {
    unitPrice: number;
    leadTimeDays?: number;
    paymentTerms?: string;
    warrantyMonths?: number;
    shippingCost?: number;
    notes?: string;
  }
): Promise<RFQQuote> {
  const parent = await getQuoteById(parentQuoteId);
  if (!parent) throw new Error('Parent quote not found');

  return createQuote({
    rfqId: parent.rfqId,
    supplierId: parent.supplierId,
    unitPrice: newTerms.unitPrice,
    quantity: parent.quantity,
    leadTimeDays: newTerms.leadTimeDays ?? parent.leadTimeDays,
    paymentTerms: newTerms.paymentTerms ?? parent.paymentTerms,
    warrantyMonths: newTerms.warrantyMonths ?? parent.warrantyMonths,
    shippingCost: newTerms.shippingCost ?? parent.shippingCost,
    notes: newTerms.notes,
    parentQuoteId: parentQuoteId,
    aiGenerated: true,
  });
}

// ============================================================================
// QUOTE COMPARISON & ANALYSIS
// ============================================================================

/**
 * Compare all quotes for an RFQ against constraints
 */
export async function compareQuotes(
  rfqId: string,
  constraints?: RFQConstraints
): Promise<QuoteComparison> {
  const quotes = await getActiveQuotesByRFQ(rfqId);

  if (quotes.length === 0) {
    return {
      rfqId,
      quotes: [],
      constraints,
      analysis: {
        lowestPrice: { quoteId: '', totalPrice: 0 },
        fastestDelivery: { quoteId: '', leadTimeDays: 0 },
        bestValue: { quoteId: '', score: 0, reason: 'No quotes available' },
      },
    };
  }

  // Find lowest price
  const lowestPrice = quotes.reduce((min, q) =>
    q.totalPrice < min.totalPrice ? q : min
  );

  // Find fastest delivery
  const fastestDelivery = quotes.reduce((min, q) =>
    q.leadTimeDays < min.leadTimeDays ? q : min
  );

  // Calculate value scores
  const scoredQuotes = quotes.map((quote) => ({
    quote,
    score: calculateValueScore(quote, constraints),
  }));

  // Find best value
  const bestValue = scoredQuotes.reduce((best, current) =>
    current.score > best.score ? current : best
  );

  // Generate recommendation
  const recommendation = generateRecommendation(scoredQuotes, constraints);

  return {
    rfqId,
    quotes,
    constraints,
    recommendation,
    analysis: {
      lowestPrice: {
        quoteId: lowestPrice.id,
        totalPrice: lowestPrice.totalPrice,
      },
      fastestDelivery: {
        quoteId: fastestDelivery.id,
        leadTimeDays: fastestDelivery.leadTimeDays,
      },
      bestValue: {
        quoteId: bestValue.quote.id,
        score: bestValue.score,
        reason: generateValueReason(bestValue.quote, constraints),
      },
    },
  };
}

/**
 * Calculate value score for a quote (0-100)
 */
function calculateValueScore(
  quote: RFQQuote,
  constraints?: RFQConstraints
): number {
  let score = 50; // Base score

  if (!constraints) return score;

  // Price scoring (40 points max)
  if (constraints.targetTotalPrice) {
    const priceRatio = quote.totalPrice / constraints.targetTotalPrice;
    if (priceRatio <= 0.9) score += 40; // Under budget by 10%+
    else if (priceRatio <= 1.0) score += 30; // At or under budget
    else if (priceRatio <= 1.1) score += 15; // Slightly over
    else if (priceRatio <= 1.2) score += 5; // Moderately over
    // Over 20% = no bonus
  } else if (constraints.maxTotalBudget) {
    if (quote.totalPrice <= constraints.maxTotalBudget) {
      const savings = (constraints.maxTotalBudget - quote.totalPrice) / constraints.maxTotalBudget;
      score += Math.min(40, savings * 100);
    }
  }

  // Lead time scoring (30 points max)
  if (constraints.preferredLeadTimeDays) {
    if (quote.leadTimeDays <= constraints.preferredLeadTimeDays) {
      score += 30;
    } else if (constraints.maxLeadTimeDays && quote.leadTimeDays <= constraints.maxLeadTimeDays) {
      const ratio = (constraints.maxLeadTimeDays - quote.leadTimeDays) /
        (constraints.maxLeadTimeDays - constraints.preferredLeadTimeDays);
      score += 15 + (ratio * 15);
    }
  } else if (constraints.maxLeadTimeDays) {
    if (quote.leadTimeDays <= constraints.maxLeadTimeDays) {
      score += 20;
    }
  }

  // Warranty scoring (15 points max)
  if (constraints.minimumWarrantyMonths && quote.warrantyMonths) {
    if (quote.warrantyMonths >= constraints.minimumWarrantyMonths) {
      score += 10;
      // Bonus for extra warranty
      const extraMonths = quote.warrantyMonths - constraints.minimumWarrantyMonths;
      score += Math.min(5, extraMonths);
    }
  }

  // Payment terms scoring (15 points max)
  if (constraints.preferredPaymentTerms && quote.paymentTerms) {
    if (quote.paymentTerms === constraints.preferredPaymentTerms) {
      score += 15;
    } else if (constraints.acceptablePaymentTerms.includes(quote.paymentTerms)) {
      score += 10;
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Generate recommendation text
 */
function generateRecommendation(
  scoredQuotes: { quote: RFQQuote; score: number }[],
  constraints?: RFQConstraints
): { quoteId: string; reason: string; score: number } | undefined {
  if (scoredQuotes.length === 0) return undefined;

  const best = scoredQuotes.reduce((a, b) => (a.score > b.score ? a : b));

  if (best.score < 30) {
    return {
      quoteId: best.quote.id,
      reason: 'Best available option, but none meet all requirements. Consider negotiating.',
      score: best.score,
    };
  }

  return {
    quoteId: best.quote.id,
    reason: generateValueReason(best.quote, constraints),
    score: best.score,
  };
}

/**
 * Generate explanation for why a quote is good value
 */
function generateValueReason(
  quote: RFQQuote,
  constraints?: RFQConstraints
): string {
  const reasons: string[] = [];

  if (constraints?.targetTotalPrice && quote.totalPrice <= constraints.targetTotalPrice) {
    const savings = constraints.targetTotalPrice - quote.totalPrice;
    reasons.push(`$${savings.toFixed(2)} under target price`);
  }

  if (constraints?.preferredLeadTimeDays && quote.leadTimeDays <= constraints.preferredLeadTimeDays) {
    reasons.push(`Meets ${quote.leadTimeDays}-day delivery requirement`);
  }

  if (quote.warrantyMonths && constraints?.minimumWarrantyMonths &&
      quote.warrantyMonths >= constraints.minimumWarrantyMonths) {
    reasons.push(`${quote.warrantyMonths}-month warranty included`);
  }

  if (reasons.length === 0) {
    return 'Competitive pricing with acceptable terms';
  }

  return reasons.join('. ');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapQuoteRow(row: any): RFQQuote {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    supplierId: row.supplier_id,
    unitPrice: parseFloat(row.unit_price),
    quantity: row.quantity,
    totalPrice: parseFloat(row.total_price),
    currency: row.currency || 'USD',
    leadTimeDays: row.lead_time_days,
    paymentTerms: row.payment_terms,
    warrantyMonths: row.warranty_months,
    shippingCost: parseFloat(row.shipping_cost || '0'),
    shippingMethod: row.shipping_method,
    validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
    notes: row.notes,
    lineItems: row.line_items || [],
    aiGenerated: row.ai_generated,
    aiConfidenceScore: row.ai_confidence_score ? parseFloat(row.ai_confidence_score) : undefined,
    sourceCatalogId: row.source_catalog_id,
    isInitialQuote: row.is_initial_quote,
    parentQuoteId: row.parent_quote_id,
    negotiationRound: row.negotiation_round,
    status: row.status as QuoteStatus,
    supplierConfirmed: row.supplier_confirmed,
    supplierConfirmedAt: row.supplier_confirmed_at ? new Date(row.supplier_confirmed_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    supplier: row.company_name ? {
      id: row.supplier_id,
      companyName: row.company_name,
      contactEmail: row.contact_email,
    } : undefined,
  };
}

/**
 * Check if any quotes are expired and update their status
 */
export async function expireOldQuotes(): Promise<number> {
  const result = await sql`
    UPDATE rfq_quotes
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('pending', 'active')
      AND valid_until IS NOT NULL
      AND valid_until < NOW()
    RETURNING id
  `;

  return result.rows.length;
}
