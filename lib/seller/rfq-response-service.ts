/**
 * Seller RFQ Response Service
 * Reactive selling - responding to buyer RFQs through conversation
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import {
  RFQMatch,
  QuoteDraft,
  QuoteLineItem,
  SellerProfile,
  CatalogItem,
} from './types';
import { getSellerProfile, getCatalogItems } from './profile-service';

const anthropic = new Anthropic();

// =====================================================
// RFQ MATCHING
// =====================================================

/**
 * Get RFQs matched to this seller
 */
export async function getMatchedRFQs(
  sellerId: string,
  status?: string
): Promise<RFQMatch[]> {
  let query;
  if (status) {
    query = sql`
      SELECT m.*, r.category, r.description, r.quantity, r.target_price, r.urgency, r.status as rfq_status
      FROM seller_rfq_matches m
      JOIN rfqs r ON m.rfq_id = r.id
      WHERE m.seller_id = ${sellerId} AND m.status = ${status}
      ORDER BY m.created_at DESC
      LIMIT 50
    `;
  } else {
    query = sql`
      SELECT m.*, r.category, r.description, r.quantity, r.target_price, r.urgency, r.status as rfq_status
      FROM seller_rfq_matches m
      JOIN rfqs r ON m.rfq_id = r.id
      WHERE m.seller_id = ${sellerId}
      ORDER BY m.created_at DESC
      LIMIT 50
    `;
  }

  const result = await query;
  return result.rows.map(mapRowToMatch);
}

/**
 * Get a specific RFQ match
 */
export async function getRFQMatch(matchId: string): Promise<RFQMatch | null> {
  const result = await sql`
    SELECT m.*, r.category, r.description, r.quantity, r.target_price, r.urgency, r.status as rfq_status
    FROM seller_rfq_matches m
    JOIN rfqs r ON m.rfq_id = r.id
    WHERE m.id = ${matchId}
  `;

  if (result.rows.length === 0) return null;
  return mapRowToMatch(result.rows[0]);
}

/**
 * Mark RFQ as viewed
 */
export async function markRFQViewed(matchId: string): Promise<void> {
  await sql`
    UPDATE seller_rfq_matches
    SET status = 'viewed', viewed_at = NOW()
    WHERE id = ${matchId} AND status = 'pending'
  `;
}

/**
 * Decline an RFQ
 */
export async function declineRFQ(
  matchId: string,
  reason: string
): Promise<void> {
  await sql`
    UPDATE seller_rfq_matches
    SET status = 'declined', decline_reason = ${reason}, responded_at = NOW()
    WHERE id = ${matchId}
  `;
}

// =====================================================
// AI QUOTE GENERATION
// =====================================================

/**
 * AI generates a quote suggestion for an RFQ
 * Returns the suggestion as a conversational response
 */
export async function generateQuoteSuggestion(
  sellerId: string,
  matchId: string
): Promise<{
  draft: QuoteDraft;
  explanation: string;
  competitiveInsight: string;
}> {
  // Get all context
  const profile = await getSellerProfile(sellerId);
  if (!profile) throw new Error('Seller profile not found');

  const match = await getRFQMatch(matchId);
  if (!match) throw new Error('RFQ match not found');

  const catalog = await getCatalogItems(sellerId);

  // Find matching catalog items
  const matchingItems = findMatchingCatalogItems(catalog, match.rfq!);

  // Calculate base pricing
  const quantity = match.rfq!.quantity;
  const lineItems: QuoteLineItem[] = matchingItems.map((item) => {
    const unitPrice = calculateUnitPrice(item, quantity, profile.minMarginPercent);
    return {
      catalogId: item.id,
      name: item.name,
      quantity: quantity,
      unitPrice: unitPrice,
      total: unitPrice * quantity,
    };
  });

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);

  // Determine discount based on order size and urgency
  let discountPercent = 0;
  if (match.rfq!.urgency === 'urgent') {
    discountPercent = 0; // No discount for urgent
  } else if (quantity >= 1000) {
    discountPercent = 10;
  } else if (quantity >= 500) {
    discountPercent = 5;
  } else if (quantity >= 100) {
    discountPercent = 3;
  }

  const discountAmount = subtotal * (discountPercent / 100);
  const totalPrice = subtotal - discountAmount;

  // Use AI to craft explanation and insights
  const aiResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are a sales AI helping a seller craft a quote response.

RFQ Details:
- Category: ${match.rfq!.category}
- Description: ${match.rfq!.description}
- Quantity: ${quantity}
- Target Price: ${match.rfq!.targetPrice ? '$' + match.rfq!.targetPrice : 'Not specified'}
- Urgency: ${match.rfq!.urgency}

Our Quote:
- Total: $${totalPrice.toLocaleString()}
- Unit Price: $${(totalPrice / quantity).toFixed(2)}
- Discount: ${discountPercent}%
- Margin: ~${profile.minMarginPercent}%

Seller Profile:
- Company: ${profile.companyName}
- Categories: ${profile.categories?.join(', ')}
- AI Aggression: ${profile.aiAggression}

Provide a brief, conversational explanation of this quote and one competitive insight. Keep it under 100 words total. Be direct and confident.`,
      },
    ],
  });

  const aiText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';
  const parts = aiText.split('\n\n');
  const explanation = parts[0] || 'This quote is based on your catalog pricing with volume adjustments.';
  const competitiveInsight = parts[1] || 'Competitive positioning looks good for this opportunity.';

  // Create draft in database
  const draftResult = await sql`
    INSERT INTO seller_quote_drafts (
      seller_id, rfq_id, match_id,
      line_items, subtotal, discount_percent, discount_amount, total_price,
      lead_time_days, payment_terms, validity_days,
      ai_suggested, ai_confidence, ai_rationale,
      status
    ) VALUES (
      ${sellerId},
      ${match.rfqId},
      ${matchId},
      ${JSON.stringify(lineItems)},
      ${subtotal},
      ${discountPercent},
      ${discountAmount},
      ${totalPrice},
      ${matchingItems[0]?.leadTimeDays || profile.typicalLeadTimeDays || 14},
      ${profile.defaultPaymentTerms || 'Net 30'},
      30,
      true,
      85,
      ${explanation},
      'draft'
    )
    RETURNING *
  `;

  return {
    draft: mapRowToDraft(draftResult.rows[0]),
    explanation,
    competitiveInsight,
  };
}

/**
 * Submit a quote (from draft or directly)
 */
export async function submitQuote(
  sellerId: string,
  draftId: string
): Promise<{ quoteId: string; message: string }> {
  // Get the draft
  const draftResult = await sql`
    SELECT * FROM seller_quote_drafts WHERE id = ${draftId} AND seller_id = ${sellerId}
  `;

  if (draftResult.rows.length === 0) {
    throw new Error('Quote draft not found');
  }

  const draft = draftResult.rows[0];

  // Create the actual quote in rfq_quotes
  const quoteResult = await sql`
    INSERT INTO rfq_quotes (
      rfq_id, supplier_id, unit_price, total_price,
      lead_time_days, payment_terms, validity_days, notes,
      status
    ) VALUES (
      ${draft.rfq_id},
      ${sellerId},
      ${draft.total_price / draft.line_items[0]?.quantity || 1},
      ${draft.total_price},
      ${draft.lead_time_days},
      ${draft.payment_terms},
      ${draft.validity_days},
      ${draft.notes || null},
      'submitted'
    )
    RETURNING id
  `;

  const quoteId = quoteResult.rows[0].id;

  // Update draft status
  await sql`
    UPDATE seller_quote_drafts
    SET status = 'submitted', submitted_at = NOW()
    WHERE id = ${draftId}
  `;

  // Update match status
  await sql`
    UPDATE seller_rfq_matches
    SET status = 'quoted', quote_id = ${quoteId}, responded_at = NOW()
    WHERE id = ${draft.match_id}
  `;

  return {
    quoteId,
    message: `Quote submitted. You quoted $${parseFloat(draft.total_price).toLocaleString()} for this opportunity. I'll let you know when the buyer responds or if AI negotiation begins.`,
  };
}

/**
 * Adjust quote from conversation
 */
export async function adjustQuoteDraft(
  draftId: string,
  adjustments: {
    priceChange?: number; // Percentage change (+5 = 5% higher)
    leadTimeChange?: number; // Days change
    paymentTermsChange?: string;
    addNote?: string;
  }
): Promise<QuoteDraft> {
  const draftResult = await sql`SELECT * FROM seller_quote_drafts WHERE id = ${draftId}`;
  if (draftResult.rows.length === 0) throw new Error('Draft not found');

  const draft = draftResult.rows[0];
  let newTotal = parseFloat(draft.total_price);
  let newLeadTime = draft.lead_time_days;
  let newTerms = draft.payment_terms;
  let notes = draft.notes || '';

  if (adjustments.priceChange) {
    const multiplier = 1 + (adjustments.priceChange / 100);
    newTotal = newTotal * multiplier;
  }

  if (adjustments.leadTimeChange) {
    newLeadTime = newLeadTime + adjustments.leadTimeChange;
  }

  if (adjustments.paymentTermsChange) {
    newTerms = adjustments.paymentTermsChange;
  }

  if (adjustments.addNote) {
    notes = notes ? notes + '\n' + adjustments.addNote : adjustments.addNote;
  }

  const updateResult = await sql`
    UPDATE seller_quote_drafts
    SET
      total_price = ${newTotal},
      lead_time_days = ${newLeadTime},
      payment_terms = ${newTerms},
      notes = ${notes},
      updated_at = NOW()
    WHERE id = ${draftId}
    RETURNING *
  `;

  return mapRowToDraft(updateResult.rows[0]);
}

// =====================================================
// CONVERSATIONAL PARSING
// =====================================================

/**
 * Parse quote adjustments from natural language
 */
export function parseQuoteAdjustmentsFromText(text: string): {
  priceChange?: number;
  leadTimeChange?: number;
  paymentTermsChange?: string;
  addNote?: string;
} {
  const adjustments: {
    priceChange?: number;
    leadTimeChange?: number;
    paymentTermsChange?: string;
    addNote?: string;
  } = {};

  // Price changes
  const priceUpMatch = text.match(/(?:increase|raise|bump|go up|higher)\s*(?:price|it)?\s*(?:by)?\s*(\d+)\s*%/i);
  if (priceUpMatch) {
    adjustments.priceChange = parseInt(priceUpMatch[1]);
  }

  const priceDownMatch = text.match(/(?:decrease|lower|reduce|drop|cut|go down)\s*(?:price|it)?\s*(?:by)?\s*(\d+)\s*%/i);
  if (priceDownMatch) {
    adjustments.priceChange = -parseInt(priceDownMatch[1]);
  }

  // Absolute price
  const absolutePriceMatch = text.match(/(?:make it|set it to|change to)\s*\$?([\d,]+)/i);
  if (absolutePriceMatch) {
    // Would need draft context to calculate percentage
    // For now, flag it
    adjustments.addNote = `Requested price: $${absolutePriceMatch[1]}`;
  }

  // Lead time
  const fasterMatch = text.match(/(\d+)\s*(?:days?|weeks?)\s*(?:faster|sooner|quicker)/i);
  if (fasterMatch) {
    const days = text.includes('week') ? parseInt(fasterMatch[1]) * 7 : parseInt(fasterMatch[1]);
    adjustments.leadTimeChange = -days;
  }

  const slowerMatch = text.match(/(?:add|extend|extra)\s*(\d+)\s*(?:days?|weeks?)/i);
  if (slowerMatch) {
    const days = text.includes('week') ? parseInt(slowerMatch[1]) * 7 : parseInt(slowerMatch[1]);
    adjustments.leadTimeChange = days;
  }

  // Payment terms
  const termsMatch = text.match(/(?:payment terms?|terms)\s*(?:to|of|:)?\s*(net\s*\d+|due on receipt|50% up front)/i);
  if (termsMatch) {
    adjustments.paymentTermsChange = termsMatch[1];
  }

  // Notes
  const noteMatch = text.match(/(?:add note|note that|mention)\s*(?:that|:)?\s*(.+)/i);
  if (noteMatch) {
    adjustments.addNote = noteMatch[1].trim();
  }

  return adjustments;
}

// =====================================================
// HELPERS
// =====================================================

function findMatchingCatalogItems(
  catalog: CatalogItem[],
  rfq: { category: string; description: string }
): CatalogItem[] {
  const categoryMatch = catalog.filter(
    (item) => item.category.toLowerCase() === rfq.category.toLowerCase()
  );

  if (categoryMatch.length > 0) return categoryMatch;

  // Fuzzy match on description keywords
  const keywords = rfq.description.toLowerCase().split(/\s+/);
  const scored = catalog.map((item) => {
    let score = 0;
    const itemText = (item.name + ' ' + item.description + ' ' + item.category).toLowerCase();
    for (const kw of keywords) {
      if (itemText.includes(kw)) score++;
    }
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.item);
}

function calculateUnitPrice(
  item: CatalogItem,
  quantity: number,
  minMarginPercent: number
): number {
  let price = item.basePrice;

  // Apply volume discounts
  if (item.volumeDiscounts && item.volumeDiscounts.length > 0) {
    const applicable = item.volumeDiscounts
      .filter((vd) => quantity >= vd.minQty)
      .sort((a, b) => b.minQty - a.minQty);

    if (applicable.length > 0) {
      const discount = applicable[0].discountPercent;
      price = price * (1 - discount / 100);
    }
  }

  // Ensure floor price
  if (item.floorPrice && price < item.floorPrice) {
    price = item.floorPrice;
  }

  return Math.round(price * 100) / 100;
}

function mapRowToMatch(row: any): RFQMatch {
  return {
    id: row.id,
    sellerId: row.seller_id,
    rfqId: row.rfq_id,
    matchScore: parseFloat(row.match_score || 0),
    matchReasons: row.match_reasons || [],
    status: row.status,
    viewedAt: row.viewed_at ? new Date(row.viewed_at) : undefined,
    respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
    declineReason: row.decline_reason,
    autoQuoted: row.auto_quoted,
    quoteId: row.quote_id,
    expiresAt: new Date(row.expires_at || Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(row.created_at),
    rfq: row.category ? {
      id: row.rfq_id,
      category: row.category,
      description: row.description,
      quantity: row.quantity,
      targetPrice: row.target_price ? parseFloat(row.target_price) : undefined,
      urgency: row.urgency || 'standard',
    } : undefined,
  };
}

function mapRowToDraft(row: any): QuoteDraft {
  return {
    id: row.id,
    sellerId: row.seller_id,
    rfqId: row.rfq_id,
    matchId: row.match_id,
    lineItems: row.line_items || [],
    subtotal: parseFloat(row.subtotal),
    discountPercent: row.discount_percent ? parseFloat(row.discount_percent) : undefined,
    discountAmount: row.discount_amount ? parseFloat(row.discount_amount) : undefined,
    totalPrice: parseFloat(row.total_price),
    leadTimeDays: row.lead_time_days,
    paymentTerms: row.payment_terms,
    validityDays: row.validity_days,
    notes: row.notes,
    aiSuggested: row.ai_suggested,
    aiConfidence: row.ai_confidence ? parseFloat(row.ai_confidence) : undefined,
    aiRationale: row.ai_rationale,
    status: row.status,
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
