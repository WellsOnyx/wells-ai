/**
 * AI-to-AI Negotiation Engine
 * Wells AI negotiates with Supplier AI on behalf of buyers
 */

import Anthropic from '@anthropic-ai/sdk';
import { sqlQuery as sql } from '@/lib/db';
import {
  RFQNegotiation,
  NegotiationMessage,
  NegotiationStatus,
  NegotiationOutcome,
  QuoteTerms,
  RFQConstraints,
  RFQQuote,
  StartNegotiationInput,
  NegotiationResult,
} from './types';
import { getQuoteById, createCounterOffer } from './quote-service';
import { getConstraintsByRFQ, shouldAcceptOffer, generateCounterOffer as generateBuyerCounter } from './constraint-service';
import { generateNegotiationResponse, findMatchingCatalogItems } from './supplier-ai';

const anthropic = new Anthropic();

// ============================================================================
// NEGOTIATION LIFECYCLE
// ============================================================================

/**
 * Start a new negotiation session
 */
export async function startNegotiation(
  input: StartNegotiationInput
): Promise<RFQNegotiation> {
  const quote = await getQuoteById(input.quoteId);
  if (!quote) throw new Error('Quote not found');

  const constraints = await getConstraintsByRFQ(input.rfqId);
  if (!constraints) throw new Error('Constraints not set for this RFQ');

  // Build initial supplier position from quote
  const supplierPosition: QuoteTerms = {
    unitPrice: quote.unitPrice,
    quantity: quote.quantity,
    totalPrice: quote.totalPrice,
    leadTimeDays: quote.leadTimeDays,
    paymentTerms: quote.paymentTerms || 'Net 30',
    warrantyMonths: quote.warrantyMonths,
    shippingCost: quote.shippingCost,
  };

  // Create negotiation record
  const result = await sql`
    INSERT INTO rfq_negotiations (
      rfq_id,
      quote_id,
      supplier_id,
      buyer_constraints,
      initial_supplier_position,
      current_supplier_position,
      status,
      current_round,
      max_rounds,
      messages
    ) VALUES (
      ${input.rfqId},
      ${input.quoteId},
      ${quote.supplierId},
      ${JSON.stringify(constraints)},
      ${JSON.stringify(supplierPosition)},
      ${JSON.stringify(supplierPosition)},
      'active',
      1,
      ${input.maxRounds || constraints.maxNegotiationRounds || 5},
      '{}'
    )
    RETURNING *
  `;

  // Update RFQ status
  await sql`
    UPDATE rfqs
    SET status = 'negotiating', updated_at = NOW()
    WHERE id = ${input.rfqId}
  `;

  // Update quote status
  await sql`
    UPDATE rfq_quotes
    SET status = 'negotiating', updated_at = NOW()
    WHERE id = ${input.quoteId}
  `;

  return mapNegotiationRow(result.rows[0]);
}

/**
 * Run a full negotiation session (async, runs to completion)
 */
export async function runNegotiation(
  negotiationId: string
): Promise<NegotiationResult> {
  let negotiation = await getNegotiationById(negotiationId);
  if (!negotiation) throw new Error('Negotiation not found');

  const constraints = negotiation.buyerConstraints;
  let currentSupplierPosition = negotiation.currentSupplierPosition || negotiation.initialSupplierPosition;

  // Run negotiation rounds
  while (
    negotiation.status === 'active' &&
    negotiation.currentRound <= negotiation.maxRounds
  ) {
    // Step 1: Check if buyer should accept current offer
    const acceptCheck = shouldAcceptOffer(
      currentSupplierPosition,
      constraints,
      negotiation.currentRound
    );

    if (acceptCheck.accept) {
      // Buyer accepts - end negotiation successfully
      negotiation = await completeNegotiation(
        negotiationId,
        'agreement',
        currentSupplierPosition,
        acceptCheck.reason
      );
      break;
    }

    // Step 2: Generate buyer counter-offer
    const buyerCounter = generateBuyerCounter(
      currentSupplierPosition,
      constraints,
      negotiation.currentRound
    );

    // Add buyer message
    const buyerMessage = await generateBuyerNegotiationMessage(
      currentSupplierPosition,
      buyerCounter,
      negotiation.currentRound,
      negotiation.maxRounds
    );

    await addNegotiationMessage(negotiationId, {
      role: 'buyer_ai',
      content: buyerMessage,
      proposedTerms: buyerCounter,
      round: negotiation.currentRound,
    });

    // Step 3: Get supplier response
    const catalogItems = await findMatchingCatalogItems(
      negotiation.buyerConstraints.requiredCertifications[0] || 'general',
      '',
      negotiation.supplierId
    );

    const catalogItem = catalogItems[0]; // Use first match or create default

    const supplierResponse = catalogItem
      ? await generateNegotiationResponse(
          catalogItem,
          buyerCounter,
          currentSupplierPosition,
          negotiation.currentRound,
          negotiation.maxRounds
        )
      : generateFallbackSupplierResponse(
          buyerCounter,
          currentSupplierPosition,
          negotiation.currentRound,
          negotiation.maxRounds
        );

    // Add supplier message
    await addNegotiationMessage(negotiationId, {
      role: 'supplier_ai',
      content: supplierResponse.message,
      proposedTerms: supplierResponse.accept ? buyerCounter : supplierResponse.counterOffer,
      round: negotiation.currentRound,
    });

    if (supplierResponse.accept) {
      // Supplier accepts buyer's counter
      negotiation = await completeNegotiation(
        negotiationId,
        'agreement',
        buyerCounter,
        'Supplier accepted buyer counter-offer'
      );
      break;
    }

    // Update supplier position
    if (supplierResponse.counterOffer) {
      currentSupplierPosition = supplierResponse.counterOffer;
      await updateSupplierPosition(negotiationId, currentSupplierPosition);
    }

    // Advance round
    await advanceNegotiationRound(negotiationId);
    negotiation = await getNegotiationById(negotiationId);
    if (!negotiation) break;

    // Check if max rounds reached
    if (negotiation.currentRound > negotiation.maxRounds) {
      // Check if final offer is acceptable
      const finalCheck = shouldAcceptOffer(
        currentSupplierPosition,
        constraints,
        negotiation.currentRound
      );

      if (finalCheck.accept) {
        negotiation = await completeNegotiation(
          negotiationId,
          'agreement',
          currentSupplierPosition,
          'Accepted final offer after max rounds'
        );
      } else {
        negotiation = await completeNegotiation(
          negotiationId,
          'no_agreement',
          undefined,
          'Max rounds reached without agreement'
        );
      }
      break;
    }
  }

  // Create final quote if agreement reached
  let finalQuote: RFQQuote | undefined;
  if (negotiation.outcome === 'agreement' && negotiation.finalTerms) {
    finalQuote = await createCounterOffer(negotiation.quoteId, {
      unitPrice: negotiation.finalTerms.unitPrice,
      leadTimeDays: negotiation.finalTerms.leadTimeDays,
      paymentTerms: negotiation.finalTerms.paymentTerms,
      warrantyMonths: negotiation.finalTerms.warrantyMonths,
      shippingCost: negotiation.finalTerms.shippingCost,
      notes: 'Final negotiated terms',
    });

    // Link final quote to negotiation
    await sql`
      UPDATE rfq_negotiations
      SET final_quote_id = ${finalQuote.id}
      WHERE id = ${negotiationId}
    `;
  }

  // Calculate analytics
  const priceReduction = negotiation.initialSupplierPosition.totalPrice -
    (negotiation.finalTerms?.totalPrice || negotiation.initialSupplierPosition.totalPrice);

  return {
    negotiation,
    finalQuote,
    success: negotiation.outcome === 'agreement',
    summary: generateNegotiationSummary(negotiation, priceReduction),
  };
}

/**
 * Generate buyer's negotiation message using AI
 */
async function generateBuyerNegotiationMessage(
  currentOffer: QuoteTerms,
  counterOffer: QuoteTerms,
  round: number,
  maxRounds: number
): Promise<string> {
  try {
    const priceDiff = currentOffer.totalPrice - counterOffer.totalPrice;
    const percentDiff = (priceDiff / currentOffer.totalPrice) * 100;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 150,
      system: `You are Wells AI, negotiating on behalf of a buyer. Be professional, firm but fair.
      Generate a 1-2 sentence counter-offer message. Don't be too aggressive or rude.`,
      messages: [
        {
          role: 'user',
          content: `Negotiation round ${round}/${maxRounds}.
Current supplier offer: $${currentOffer.totalPrice.toFixed(2)}
Your counter-offer: $${counterOffer.totalPrice.toFixed(2)}
Difference: $${priceDiff.toFixed(2)} (${percentDiff.toFixed(1)}% reduction)

Generate a professional message presenting this counter-offer to the supplier.`,
        },
      ],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : `We'd like to propose $${counterOffer.totalPrice.toFixed(2)} for this order.`;
  } catch {
    return `We appreciate your quote. Based on our requirements and market analysis, we'd like to propose $${counterOffer.totalPrice.toFixed(2)}.`;
  }
}

/**
 * Fallback supplier response when no catalog item
 */
function generateFallbackSupplierResponse(
  buyerOffer: QuoteTerms,
  currentPosition: QuoteTerms,
  round: number,
  maxRounds: number
): {
  accept: boolean;
  counterOffer?: QuoteTerms;
  message: string;
} {
  // Simple floor: 90% of initial price
  const floorPrice = currentPosition.totalPrice * 0.9;

  if (buyerOffer.totalPrice >= floorPrice) {
    return {
      accept: true,
      message: `We can accept $${buyerOffer.totalPrice.toFixed(2)}. Thank you for your business.`,
    };
  }

  // Counter at midpoint
  const counterTotal = (buyerOffer.totalPrice + currentPosition.totalPrice) / 2;
  const counterTotal_clamped = Math.max(floorPrice, counterTotal);

  return {
    accept: false,
    counterOffer: {
      ...currentPosition,
      totalPrice: counterTotal_clamped,
      unitPrice: counterTotal_clamped / currentPosition.quantity,
    },
    message: `We can meet you at $${counterTotal_clamped.toFixed(2)} which represents a significant value.`,
  };
}

/**
 * Generate summary of negotiation
 */
function generateNegotiationSummary(
  negotiation: RFQNegotiation,
  priceReduction: number
): string {
  const initial = negotiation.initialSupplierPosition.totalPrice;
  const percent = (priceReduction / initial) * 100;

  if (negotiation.outcome === 'agreement') {
    if (priceReduction > 0) {
      return `Negotiation successful! Achieved ${percent.toFixed(1)}% savings ($${priceReduction.toFixed(2)}) in ${negotiation.roundsUsed || negotiation.currentRound} rounds.`;
    }
    return `Agreement reached at initial terms after ${negotiation.roundsUsed || negotiation.currentRound} round(s).`;
  }

  return `Negotiation ended without agreement after ${negotiation.maxRounds} rounds.`;
}

// ============================================================================
// NEGOTIATION UPDATES
// ============================================================================

/**
 * Add a message to the negotiation
 */
async function addNegotiationMessage(
  negotiationId: string,
  message: Omit<NegotiationMessage, 'id' | 'timestamp'>
): Promise<void> {
  const fullMessage: NegotiationMessage = {
    id: crypto.randomUUID(),
    ...message,
    timestamp: new Date(),
  };

  await sql`
    UPDATE rfq_negotiations
    SET
      messages = array_append(messages, ${JSON.stringify(fullMessage)}::jsonb),
      last_activity_at = NOW()
    WHERE id = ${negotiationId}
  `;
}

/**
 * Update current supplier position
 */
async function updateSupplierPosition(
  negotiationId: string,
  position: QuoteTerms
): Promise<void> {
  await sql`
    UPDATE rfq_negotiations
    SET
      current_supplier_position = ${JSON.stringify(position)},
      last_activity_at = NOW()
    WHERE id = ${negotiationId}
  `;
}

/**
 * Advance negotiation round
 */
async function advanceNegotiationRound(negotiationId: string): Promise<void> {
  await sql`
    UPDATE rfq_negotiations
    SET
      current_round = current_round + 1,
      last_activity_at = NOW()
    WHERE id = ${negotiationId}
  `;
}

/**
 * Complete a negotiation
 */
async function completeNegotiation(
  negotiationId: string,
  outcome: NegotiationOutcome,
  finalTerms?: QuoteTerms,
  message?: string
): Promise<RFQNegotiation> {
  // Add system message about outcome
  if (message) {
    await addNegotiationMessage(negotiationId, {
      role: 'system',
      content: message,
      proposedTerms: finalTerms,
      round: 0,
    });
  }

  // Calculate analytics
  const negotiation = await getNegotiationById(negotiationId);
  const initial = negotiation?.initialSupplierPosition.totalPrice || 0;
  const final = finalTerms?.totalPrice || initial;
  const reduction = initial - final;
  const reductionPct = initial > 0 ? (reduction / initial) * 100 : 0;

  const result = await sql`
    UPDATE rfq_negotiations
    SET
      status = 'completed',
      outcome = ${outcome},
      final_terms = ${finalTerms ? JSON.stringify(finalTerms) : null},
      completed_at = NOW(),
      total_price_reduction = ${reduction},
      reduction_percentage = ${reductionPct},
      rounds_used = current_round
    WHERE id = ${negotiationId}
    RETURNING *
  `;

  // Update RFQ status based on outcome
  if (negotiation) {
    const rfqStatus = outcome === 'agreement' ? 'quoted' : 'matched';
    await sql`
      UPDATE rfqs
      SET status = ${rfqStatus}, updated_at = NOW()
      WHERE id = ${negotiation.rfqId}
    `;
  }

  return mapNegotiationRow(result.rows[0]);
}

// ============================================================================
// NEGOTIATION QUERIES
// ============================================================================

/**
 * Get negotiation by ID
 */
export async function getNegotiationById(
  negotiationId: string
): Promise<RFQNegotiation | null> {
  const result = await sql`
    SELECT * FROM rfq_negotiations
    WHERE id = ${negotiationId}
  `;

  if (result.rows.length === 0) return null;
  return mapNegotiationRow(result.rows[0]);
}

/**
 * Get negotiations for an RFQ
 */
export async function getNegotiationsByRFQ(
  rfqId: string
): Promise<RFQNegotiation[]> {
  const result = await sql`
    SELECT * FROM rfq_negotiations
    WHERE rfq_id = ${rfqId}
    ORDER BY created_at DESC
  `;

  return result.rows.map(mapNegotiationRow);
}

/**
 * Get active negotiations
 */
export async function getActiveNegotiations(): Promise<RFQNegotiation[]> {
  const result = await sql`
    SELECT * FROM rfq_negotiations
    WHERE status = 'active'
    ORDER BY last_activity_at DESC
  `;

  return result.rows.map(mapNegotiationRow);
}

// ============================================================================
// MANUAL INTERVENTION
// ============================================================================

/**
 * Buyer manually accepts current offer
 */
export async function manualAccept(
  negotiationId: string,
  acceptedBy: string
): Promise<RFQNegotiation> {
  const negotiation = await getNegotiationById(negotiationId);
  if (!negotiation) throw new Error('Negotiation not found');

  const finalTerms = negotiation.currentSupplierPosition || negotiation.initialSupplierPosition;

  return completeNegotiation(
    negotiationId,
    'manual_override',
    finalTerms,
    `Manually accepted by ${acceptedBy}`
  );
}

/**
 * Buyer manually rejects negotiation
 */
export async function manualReject(
  negotiationId: string,
  rejectedBy: string,
  reason: string
): Promise<RFQNegotiation> {
  return completeNegotiation(
    negotiationId,
    'no_agreement',
    undefined,
    `Manually rejected by ${rejectedBy}: ${reason}`
  );
}

/**
 * Pause negotiation for manual review
 */
export async function pauseNegotiation(
  negotiationId: string
): Promise<RFQNegotiation> {
  const result = await sql`
    UPDATE rfq_negotiations
    SET status = 'paused', last_activity_at = NOW()
    WHERE id = ${negotiationId}
    RETURNING *
  `;

  return mapNegotiationRow(result.rows[0]);
}

/**
 * Resume paused negotiation
 */
export async function resumeNegotiation(
  negotiationId: string
): Promise<RFQNegotiation> {
  const result = await sql`
    UPDATE rfq_negotiations
    SET status = 'active', last_activity_at = NOW()
    WHERE id = ${negotiationId}
    RETURNING *
  `;

  return mapNegotiationRow(result.rows[0]);
}

// ============================================================================
// HELPERS
// ============================================================================

function mapNegotiationRow(row: any): RFQNegotiation {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    quoteId: row.quote_id,
    supplierId: row.supplier_id,
    buyerConstraints: row.buyer_constraints,
    initialSupplierPosition: row.initial_supplier_position,
    currentSupplierPosition: row.current_supplier_position,
    status: row.status as NegotiationStatus,
    currentRound: row.current_round,
    maxRounds: row.max_rounds,
    messages: (row.messages || []).map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
    outcome: row.outcome as NegotiationOutcome | undefined,
    finalTerms: row.final_terms,
    finalQuoteId: row.final_quote_id,
    startedAt: new Date(row.started_at),
    lastActivityAt: new Date(row.last_activity_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    totalPriceReduction: row.total_price_reduction ? parseFloat(row.total_price_reduction) : undefined,
    reductionPercentage: row.reduction_percentage ? parseFloat(row.reduction_percentage) : undefined,
    roundsUsed: row.rounds_used,
  };
}
