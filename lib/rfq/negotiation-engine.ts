/**
 * AI-to-AI Negotiation Engine
 * Wells AI (buyer) negotiates with Supplier AI on behalf of buyers
 *
 * The core negotiation system:
 * 1. Start negotiation session - Create negotiation record, set initial positions
 * 2. Run negotiation rounds - Execute back-and-forth between buyer and supplier AI
 * 3. Generate buyer counter-offers - Based on constraints and negotiation strategy
 * 4. Process supplier responses - Handle supplier's counters
 * 5. Check for agreement - Detect when terms are acceptable
 * 6. Complete negotiation - Finalize terms, create final quote
 * 7. Handle edge cases - Timeout, stalemate, walk-away
 *
 * @module lib/rfq/negotiation-engine
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
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
  NegotiationAggression,
} from './types';
import {
  getConstraintsByRFQ,
  validateQuoteAgainstConstraints,
  checkAutoAcceptRejectThresholds,
  calculateNegotiationTarget,
  generateCounterOffer as generateBuyerCounterOffer,
} from './constraint-service';
import {
  generateNegotiationResponse,
  getCatalogItem,
  findMatchingCatalogItems,
} from './supplier-ai';

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_PREFIX = '[Negotiation Engine]';

const anthropic = new Anthropic();

/** Timeout for negotiation sessions in milliseconds (30 minutes) */
const NEGOTIATION_TIMEOUT_MS = 30 * 60 * 1000;

/** Stalemate threshold - if price gap doesn't change significantly for N rounds */
const STALEMATE_THRESHOLD_ROUNDS = 3;

/** Minimum price movement percentage to avoid stalemate detection */
const MIN_PRICE_MOVEMENT_PERCENT = 0.5;

/** Walk-away threshold - buyer won't accept if price exceeds budget by this percentage */
const WALK_AWAY_THRESHOLD_PERCENT = 50;

// ============================================================================
// LOGGING HELPERS
// ============================================================================

function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, service: 'negotiation-engine', message, ...meta };

  if (level === 'error') {
    console.error(`${LOG_PREFIX} ERROR: ${message}`, meta ? JSON.stringify(meta) : '');
  } else if (level === 'warn') {
    console.warn(`${LOG_PREFIX} WARN: ${message}`, meta ? JSON.stringify(meta) : '');
  } else {
    console.log(`${LOG_PREFIX} ${message}`, meta ? JSON.stringify(meta) : '');
  }
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class NegotiationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NegotiationError';
  }
}

export class NegotiationNotFoundError extends NegotiationError {
  constructor(negotiationId: string) {
    super(`Negotiation not found: ${negotiationId}`, 'NEGOTIATION_NOT_FOUND', 404, { negotiationId });
  }
}

export class NegotiationTimeoutError extends NegotiationError {
  constructor(negotiationId: string, elapsedMs: number) {
    super(
      `Negotiation timed out after ${Math.round(elapsedMs / 1000)}s`,
      'NEGOTIATION_TIMEOUT',
      408,
      { negotiationId, elapsedMs }
    );
  }
}

export class NegotiationStalemateError extends NegotiationError {
  constructor(negotiationId: string, roundsWithoutMovement: number) {
    super(
      `Negotiation stalemate detected - no significant movement for ${roundsWithoutMovement} rounds`,
      'NEGOTIATION_STALEMATE',
      409,
      { negotiationId, roundsWithoutMovement }
    );
  }
}

// ============================================================================
// 1. START NEGOTIATION SESSION
// ============================================================================

/**
 * Start a new negotiation session between buyer and supplier AI
 * Creates negotiation record and sets initial positions
 */
export async function startNegotiation(
  input: StartNegotiationInput
): Promise<RFQNegotiation> {
  log('info', 'Starting negotiation session', { rfqId: input.rfqId, quoteId: input.quoteId });

  // Get the quote being negotiated
  const quoteResult = await sql`
    SELECT * FROM rfq_quotes
    WHERE id = ${input.quoteId}
  `;

  if (quoteResult.rows.length === 0) {
    log('error', 'Quote not found for negotiation', { quoteId: input.quoteId });
    throw new NegotiationError('Quote not found', 'QUOTE_NOT_FOUND', 404, { quoteId: input.quoteId });
  }

  const quote = quoteResult.rows[0];

  // Get buyer constraints
  const constraints = await getConstraintsByRFQ(input.rfqId);
  if (!constraints) {
    log('error', 'Constraints not set for RFQ', { rfqId: input.rfqId });
    throw new NegotiationError('Buyer constraints not configured', 'CONSTRAINTS_NOT_SET', 400, { rfqId: input.rfqId });
  }

  // Check if auto-negotiate is enabled
  if (!constraints.autoNegotiate) {
    log('warn', 'Auto-negotiate disabled for this RFQ', { rfqId: input.rfqId });
    throw new NegotiationError('Auto-negotiation is disabled for this RFQ', 'AUTO_NEGOTIATE_DISABLED', 400);
  }

  // Build initial supplier position from quote
  const initialSupplierPosition: QuoteTerms = {
    unitPrice: parseFloat(quote.unit_price),
    quantity: quote.quantity,
    totalPrice: parseFloat(quote.total_price),
    leadTimeDays: quote.lead_time_days,
    paymentTerms: quote.payment_terms || 'Net 30',
    warrantyMonths: quote.warranty_months,
    shippingCost: parseFloat(quote.shipping_cost || '0'),
  };

  // Check if we should even start negotiation or just accept/reject
  const thresholdCheck = checkAutoAcceptRejectThresholds(initialSupplierPosition, constraints, 0);

  if (thresholdCheck.action === 'auto_accept') {
    log('info', 'Quote meets requirements - auto-accepting without negotiation', {
      reason: thresholdCheck.reason,
    });

    // Create a "negotiation" that's immediately completed with agreement
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
        messages,
        outcome,
        final_terms,
        completed_at,
        total_price_reduction,
        reduction_percentage,
        rounds_used
      ) VALUES (
        ${input.rfqId},
        ${input.quoteId},
        ${quote.supplier_id},
        ${JSON.stringify(constraints)},
        ${JSON.stringify(initialSupplierPosition)},
        ${JSON.stringify(initialSupplierPosition)},
        'completed',
        1,
        ${input.maxRounds || constraints.maxNegotiationRounds || 5},
        ${JSON.stringify([{
          id: crypto.randomUUID(),
          role: 'system',
          content: `Auto-accepted: ${thresholdCheck.reason}`,
          proposedTerms: initialSupplierPosition,
          timestamp: new Date().toISOString(),
          round: 0,
        }])},
        'buyer_accepted',
        ${JSON.stringify(initialSupplierPosition)},
        NOW(),
        0,
        0,
        0
      )
      RETURNING *
    `;

    await updateQuoteStatus(input.quoteId, 'accepted');
    await updateRFQStatus(input.rfqId, 'quoted');

    return mapNegotiationRow(result.rows[0]);
  }

  if (thresholdCheck.action === 'auto_reject') {
    log('info', 'Quote exceeds constraints - auto-rejecting', { reason: thresholdCheck.reason });

    // Create a "negotiation" that's immediately completed with no agreement
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
        messages,
        outcome,
        completed_at,
        rounds_used
      ) VALUES (
        ${input.rfqId},
        ${input.quoteId},
        ${quote.supplier_id},
        ${JSON.stringify(constraints)},
        ${JSON.stringify(initialSupplierPosition)},
        ${JSON.stringify(initialSupplierPosition)},
        'completed',
        0,
        ${input.maxRounds || constraints.maxNegotiationRounds || 5},
        ${JSON.stringify([{
          id: crypto.randomUUID(),
          role: 'system',
          content: `Auto-rejected: ${thresholdCheck.reason}`,
          proposedTerms: initialSupplierPosition,
          timestamp: new Date().toISOString(),
          round: 0,
        }])},
        'no_agreement',
        NOW(),
        0
      )
      RETURNING *
    `;

    await updateQuoteStatus(input.quoteId, 'rejected');

    return mapNegotiationRow(result.rows[0]);
  }

  // Normal case: Start active negotiation
  log('info', 'Creating active negotiation session', {
    aggression: constraints.negotiationAggression,
    maxRounds: input.maxRounds || constraints.maxNegotiationRounds || 5,
  });

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
      ${quote.supplier_id},
      ${JSON.stringify(constraints)},
      ${JSON.stringify(initialSupplierPosition)},
      ${JSON.stringify(initialSupplierPosition)},
      'active',
      1,
      ${input.maxRounds || constraints.maxNegotiationRounds || 5},
      '{}'
    )
    RETURNING *
  `;

  // Update RFQ and quote status
  await updateRFQStatus(input.rfqId, 'negotiating');
  await updateQuoteStatus(input.quoteId, 'negotiating');

  const negotiation = mapNegotiationRow(result.rows[0]);

  log('info', 'Negotiation session created', {
    negotiationId: negotiation.id,
    supplierId: negotiation.supplierId,
    initialPrice: initialSupplierPosition.totalPrice,
  });

  return negotiation;
}

// ============================================================================
// 2. RUN NEGOTIATION ROUND
// ============================================================================

/**
 * Execute one round of negotiation back-and-forth
 * Returns the updated negotiation state
 */
export async function runNegotiationRound(
  negotiationId: string
): Promise<{
  negotiation: RFQNegotiation;
  roundComplete: boolean;
  reachedAgreement: boolean;
  walkedAway: boolean;
}> {
  log('info', 'Running negotiation round', { negotiationId });

  const negotiation = await getNegotiationById(negotiationId);
  if (!negotiation) {
    throw new NegotiationNotFoundError(negotiationId);
  }

  // Check for timeout
  const elapsed = Date.now() - negotiation.startedAt.getTime();
  if (elapsed > NEGOTIATION_TIMEOUT_MS) {
    log('warn', 'Negotiation timeout detected', { negotiationId, elapsedMs: elapsed });
    const timedOut = await handleTimeout(negotiationId, negotiation);
    return {
      negotiation: timedOut,
      roundComplete: true,
      reachedAgreement: false,
      walkedAway: true,
    };
  }

  // Check if negotiation is still active
  if (negotiation.status !== 'active') {
    log('warn', 'Negotiation is not active', { negotiationId, status: negotiation.status });
    return {
      negotiation,
      roundComplete: true,
      reachedAgreement: negotiation.outcome === 'agreement',
      walkedAway: negotiation.outcome === 'no_agreement',
    };
  }

  const constraints = negotiation.buyerConstraints;
  const currentSupplierPosition = negotiation.currentSupplierPosition || negotiation.initialSupplierPosition;
  const currentRound = negotiation.currentRound;

  log('info', 'Round details', {
    round: currentRound,
    maxRounds: negotiation.maxRounds,
    currentPrice: currentSupplierPosition.totalPrice,
    targetPrice: constraints.targetTotalPrice,
  });

  // Step 1: Check if buyer should accept current supplier offer
  const acceptCheck = checkAutoAcceptRejectThresholds(
    currentSupplierPosition,
    constraints,
    currentRound
  );

  if (acceptCheck.action === 'auto_accept') {
    log('info', 'Buyer accepting current offer', { reason: acceptCheck.reason });
    const completed = await completeNegotiation(
      negotiationId,
      'agreement',
      currentSupplierPosition,
      acceptCheck.reason
    );
    return {
      negotiation: completed,
      roundComplete: true,
      reachedAgreement: true,
      walkedAway: false,
    };
  }

  // Step 2: Check for walk-away condition
  if (acceptCheck.action === 'auto_reject') {
    log('info', 'Buyer walking away from negotiation', { reason: acceptCheck.reason });
    const walkedAway = await handleWalkAway(negotiationId, acceptCheck.reason);
    return {
      negotiation: walkedAway,
      roundComplete: true,
      reachedAgreement: false,
      walkedAway: true,
    };
  }

  // Step 3: Generate buyer counter-offer
  const buyerCounterOffer = generateBuyerCounterOffer(
    currentSupplierPosition,
    constraints,
    currentRound
  );

  log('info', 'Generated buyer counter-offer', {
    supplierPrice: currentSupplierPosition.totalPrice,
    counterPrice: buyerCounterOffer.totalPrice,
    reduction: currentSupplierPosition.totalPrice - buyerCounterOffer.totalPrice,
  });

  // Generate negotiation message using AI
  const buyerMessage = await generateBuyerNegotiationMessage(
    currentSupplierPosition,
    buyerCounterOffer,
    currentRound,
    negotiation.maxRounds,
    constraints.negotiationAggression
  );

  // Add buyer message to negotiation
  await addNegotiationMessage(negotiationId, {
    role: 'buyer_ai',
    content: buyerMessage,
    proposedTerms: buyerCounterOffer,
    round: currentRound,
  });

  // Step 4: Get supplier response
  const supplierResponse = await processSupplierResponse(
    negotiation,
    buyerCounterOffer,
    currentSupplierPosition
  );

  // Add supplier message to negotiation
  await addNegotiationMessage(negotiationId, {
    role: 'supplier_ai',
    content: supplierResponse.message,
    proposedTerms: supplierResponse.accept ? buyerCounterOffer : supplierResponse.counterOffer,
    round: currentRound,
  });

  // Step 5: Check for agreement
  if (supplierResponse.accept) {
    log('info', 'Supplier accepted buyer counter-offer', { agreedPrice: buyerCounterOffer.totalPrice });
    const completed = await completeNegotiation(
      negotiationId,
      'agreement',
      buyerCounterOffer,
      'Supplier accepted buyer counter-offer'
    );
    return {
      negotiation: completed,
      roundComplete: true,
      reachedAgreement: true,
      walkedAway: false,
    };
  }

  // Step 6: Update supplier position and check for stalemate
  if (supplierResponse.counterOffer) {
    const stalemateCheck = checkForStalemate(
      negotiation.messages,
      supplierResponse.counterOffer,
      currentSupplierPosition
    );

    if (stalemateCheck.isStalemate) {
      log('warn', 'Stalemate detected', { roundsWithoutMovement: stalemateCheck.roundsWithoutMovement });
      const stalemated = await handleStalemate(negotiationId, stalemateCheck.roundsWithoutMovement);
      return {
        negotiation: stalemated,
        roundComplete: true,
        reachedAgreement: false,
        walkedAway: true,
      };
    }

    await updateSupplierPosition(negotiationId, supplierResponse.counterOffer);
  }

  // Step 7: Advance to next round or check if max rounds reached
  if (currentRound >= negotiation.maxRounds) {
    log('info', 'Max rounds reached', { maxRounds: negotiation.maxRounds });

    // Final check - accept supplier's last offer if it's valid
    const finalOffer = supplierResponse.counterOffer || currentSupplierPosition;
    const finalCheck = checkAutoAcceptRejectThresholds(finalOffer, constraints, currentRound);

    if (finalCheck.action === 'auto_accept' || finalCheck.action === 'negotiate') {
      // Accept final offer - we're out of rounds
      log('info', 'Accepting final offer after max rounds');
      const completed = await completeNegotiation(
        negotiationId,
        'agreement',
        finalOffer,
        'Accepted final offer after max negotiation rounds'
      );
      return {
        negotiation: completed,
        roundComplete: true,
        reachedAgreement: true,
        walkedAway: false,
      };
    }

    // No agreement possible
    const noAgreement = await completeNegotiation(
      negotiationId,
      'no_agreement',
      undefined,
      'Max rounds reached without agreement'
    );
    return {
      negotiation: noAgreement,
      roundComplete: true,
      reachedAgreement: false,
      walkedAway: true,
    };
  }

  // Advance round
  await advanceNegotiationRound(negotiationId);

  const updatedNegotiation = await getNegotiationById(negotiationId);

  return {
    negotiation: updatedNegotiation!,
    roundComplete: true,
    reachedAgreement: false,
    walkedAway: false,
  };
}

// ============================================================================
// 3. GENERATE BUYER COUNTER-OFFER
// ============================================================================

/**
 * Generate buyer negotiation message using AI
 * Uses negotiation aggression setting to determine tone
 */
async function generateBuyerNegotiationMessage(
  currentOffer: QuoteTerms,
  counterOffer: QuoteTerms,
  round: number,
  maxRounds: number,
  aggression: NegotiationAggression
): Promise<string> {
  log('info', 'Generating buyer negotiation message', { round, aggression });

  try {
    const priceDiff = currentOffer.totalPrice - counterOffer.totalPrice;
    const percentDiff = (priceDiff / currentOffer.totalPrice) * 100;

    const aggressionPrompt = {
      conservative: 'Be polite and relationship-focused. Prioritize maintaining a good partnership over maximum savings.',
      balanced: 'Be professional and fair. Aim for mutual benefit while advocating for your client.',
      aggressive: 'Be firm and value-focused. Push for the best possible price while remaining professional.',
    }[aggression];

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      system: `You are Wells AI, negotiating on behalf of a buyer. ${aggressionPrompt}
Generate a 1-2 sentence counter-offer message. Be concise and professional.
Do not use markdown formatting. Do not be rude or unprofessional.`,
      messages: [
        {
          role: 'user',
          content: `Negotiation round ${round}/${maxRounds}.
Current supplier offer: $${currentOffer.totalPrice.toFixed(2)}
Your counter-offer: $${counterOffer.totalPrice.toFixed(2)}
Difference: $${priceDiff.toFixed(2)} (${percentDiff.toFixed(1)}% reduction requested)
${round >= maxRounds - 1 ? 'This is near the final round.' : ''}

Generate a professional message presenting this counter-offer to the supplier AI.`,
        },
      ],
    });

    const message = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : `We'd like to propose $${counterOffer.totalPrice.toFixed(2)} for this order.`;

    log('info', 'Generated buyer message', { messageLength: message.length });
    return message;
  } catch (error) {
    log('error', 'Failed to generate buyer message with AI', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return `Based on our requirements and market analysis, we'd like to propose $${counterOffer.totalPrice.toFixed(2)} for this order.`;
  }
}

// ============================================================================
// 4. PROCESS SUPPLIER RESPONSE
// ============================================================================

/**
 * Get supplier AI response to buyer's counter-offer
 */
async function processSupplierResponse(
  negotiation: RFQNegotiation,
  buyerOffer: QuoteTerms,
  currentPosition: QuoteTerms
): Promise<{
  accept: boolean;
  counterOffer?: QuoteTerms;
  message: string;
}> {
  log('info', 'Processing supplier response', {
    buyerOffer: buyerOffer.totalPrice,
    currentPosition: currentPosition.totalPrice,
  });

  try {
    // Try to find supplier's catalog item for AI pricing rules
    const catalogItems = await findMatchingCatalogItems(
      negotiation.buyerConstraints.requiredCertifications?.[0] || 'general',
      '',
      negotiation.supplierId
    );

    if (catalogItems.length > 0) {
      // Use supplier AI with catalog rules
      const response = await generateNegotiationResponse(
        catalogItems[0],
        buyerOffer,
        currentPosition,
        negotiation.currentRound,
        negotiation.maxRounds
      );

      log('info', 'Received supplier AI response', {
        accept: response.accept,
        counterPrice: response.counterOffer?.totalPrice,
      });

      return response;
    }

    // Fallback: Generate response without catalog rules
    return generateFallbackSupplierResponse(
      buyerOffer,
      currentPosition,
      negotiation.currentRound,
      negotiation.maxRounds
    );
  } catch (error) {
    log('error', 'Failed to process supplier response', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return generateFallbackSupplierResponse(
      buyerOffer,
      currentPosition,
      negotiation.currentRound,
      negotiation.maxRounds
    );
  }
}

/**
 * Fallback supplier response when no catalog rules available
 * Uses simple negotiation logic
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
  log('info', 'Using fallback supplier response logic');

  // Floor price: 85% of initial quote (15% max discount)
  const floorPrice = currentPosition.totalPrice * 0.85;

  // Accept if buyer offer is at or above floor
  if (buyerOffer.totalPrice >= floorPrice) {
    return {
      accept: true,
      message: `We can accept your offer of $${buyerOffer.totalPrice.toFixed(2)}. Thank you for your business.`,
    };
  }

  // If final round and offer is close to floor, accept
  if (round >= maxRounds - 1 && buyerOffer.totalPrice >= floorPrice * 0.97) {
    return {
      accept: true,
      message: `We'll accept $${buyerOffer.totalPrice.toFixed(2)} to close this deal.`,
    };
  }

  // Calculate counter-offer moving towards buyer
  const gap = currentPosition.totalPrice - buyerOffer.totalPrice;
  const concession = gap * (0.3 + round * 0.1); // Increasing concessions each round
  const counterTotal = Math.max(floorPrice, currentPosition.totalPrice - concession);

  return {
    accept: false,
    counterOffer: {
      ...currentPosition,
      totalPrice: Math.round(counterTotal * 100) / 100,
      unitPrice: Math.round((counterTotal / currentPosition.quantity) * 100) / 100,
    },
    message: `We appreciate your interest. We can offer $${counterTotal.toFixed(2)} which represents excellent value for this quality.`,
  };
}

// ============================================================================
// 5. CHECK FOR AGREEMENT
// ============================================================================

/**
 * Check if current terms result in agreement
 */
function checkForAgreement(
  supplierOffer: QuoteTerms,
  buyerConstraints: RFQConstraints,
  round: number
): {
  agreed: boolean;
  reason: string;
} {
  const validation = validateQuoteAgainstConstraints(supplierOffer, buyerConstraints);
  const thresholdCheck = checkAutoAcceptRejectThresholds(supplierOffer, buyerConstraints, round);

  if (thresholdCheck.action === 'auto_accept') {
    return { agreed: true, reason: thresholdCheck.reason };
  }

  if (validation.valid && validation.score >= 85) {
    return { agreed: true, reason: 'Offer meets buyer requirements with good score' };
  }

  return { agreed: false, reason: 'Terms not yet acceptable' };
}

// ============================================================================
// 6. COMPLETE NEGOTIATION
// ============================================================================

/**
 * Complete a negotiation session and finalize terms
 */
async function completeNegotiation(
  negotiationId: string,
  outcome: NegotiationOutcome,
  finalTerms?: QuoteTerms,
  message?: string
): Promise<RFQNegotiation> {
  log('info', 'Completing negotiation', { negotiationId, outcome, finalPrice: finalTerms?.totalPrice });

  // Add system message about outcome
  if (message) {
    await addNegotiationMessage(negotiationId, {
      role: 'system',
      content: message,
      proposedTerms: finalTerms,
      round: 0,
    });
  }

  // Get current negotiation for analytics
  const negotiation = await getNegotiationById(negotiationId);
  if (!negotiation) {
    throw new NegotiationNotFoundError(negotiationId);
  }

  const initial = negotiation.initialSupplierPosition.totalPrice;
  const final = finalTerms?.totalPrice || initial;
  const reduction = initial - final;
  const reductionPct = initial > 0 ? (reduction / initial) * 100 : 0;

  log('info', 'Negotiation analytics', {
    initialPrice: initial,
    finalPrice: final,
    reduction,
    reductionPct: reductionPct.toFixed(2) + '%',
    roundsUsed: negotiation.currentRound,
  });

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

  // Update RFQ and quote status based on outcome
  if (outcome === 'agreement' || outcome === 'buyer_accepted') {
    await updateRFQStatus(negotiation.rfqId, 'quoted');
    await updateQuoteStatus(negotiation.quoteId, 'accepted');

    // Create final negotiated quote
    if (finalTerms) {
      await createFinalQuote(negotiation, finalTerms);
    }
  } else {
    await updateRFQStatus(negotiation.rfqId, 'matched');
    await updateQuoteStatus(negotiation.quoteId, 'rejected');
  }

  return mapNegotiationRow(result.rows[0]);
}

/**
 * Create final quote from negotiated terms
 */
async function createFinalQuote(
  negotiation: RFQNegotiation,
  finalTerms: QuoteTerms
): Promise<string> {
  log('info', 'Creating final quote from negotiation', { negotiationId: negotiation.id });

  const totalPrice = finalTerms.unitPrice * finalTerms.quantity + finalTerms.shippingCost;

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
      notes,
      ai_generated,
      is_initial_quote,
      parent_quote_id,
      negotiation_round,
      status
    ) VALUES (
      ${negotiation.rfqId},
      ${negotiation.supplierId},
      ${finalTerms.unitPrice},
      ${finalTerms.quantity},
      ${totalPrice},
      'USD',
      ${finalTerms.leadTimeDays},
      ${finalTerms.paymentTerms},
      ${finalTerms.warrantyMonths || null},
      ${finalTerms.shippingCost},
      ${'Final negotiated terms'},
      true,
      false,
      ${negotiation.quoteId},
      ${negotiation.currentRound},
      'accepted'
    )
    RETURNING id
  `;

  const finalQuoteId = result.rows[0].id;

  // Link final quote to negotiation
  await sql`
    UPDATE rfq_negotiations
    SET final_quote_id = ${finalQuoteId}
    WHERE id = ${negotiation.id}
  `;

  log('info', 'Final quote created', { finalQuoteId });
  return finalQuoteId;
}

// ============================================================================
// 7. HANDLE EDGE CASES
// ============================================================================

/**
 * Handle negotiation timeout
 */
async function handleTimeout(
  negotiationId: string,
  negotiation: RFQNegotiation
): Promise<RFQNegotiation> {
  log('warn', 'Handling negotiation timeout', { negotiationId });

  // Check if current offer is acceptable despite timeout
  const currentOffer = negotiation.currentSupplierPosition || negotiation.initialSupplierPosition;
  const thresholdCheck = checkAutoAcceptRejectThresholds(
    currentOffer,
    negotiation.buyerConstraints,
    negotiation.currentRound
  );

  if (thresholdCheck.action === 'auto_accept') {
    // Accept current offer due to timeout
    return completeNegotiation(
      negotiationId,
      'agreement',
      currentOffer,
      'Negotiation timed out - accepting current offer'
    );
  }

  // Mark as timed out with no agreement
  const result = await sql`
    UPDATE rfq_negotiations
    SET
      status = 'timeout',
      outcome = 'timeout',
      completed_at = NOW(),
      rounds_used = current_round
    WHERE id = ${negotiationId}
    RETURNING *
  `;

  await addNegotiationMessage(negotiationId, {
    role: 'system',
    content: 'Negotiation timed out without reaching agreement',
    round: negotiation.currentRound,
  });

  await updateRFQStatus(negotiation.rfqId, 'matched');
  await updateQuoteStatus(negotiation.quoteId, 'expired');

  return mapNegotiationRow(result.rows[0]);
}

/**
 * Handle negotiation stalemate (no significant price movement)
 */
async function handleStalemate(
  negotiationId: string,
  roundsWithoutMovement: number
): Promise<RFQNegotiation> {
  log('warn', 'Handling negotiation stalemate', { negotiationId, roundsWithoutMovement });

  const negotiation = await getNegotiationById(negotiationId);
  if (!negotiation) {
    throw new NegotiationNotFoundError(negotiationId);
  }

  // Check if current offer is acceptable despite stalemate
  const currentOffer = negotiation.currentSupplierPosition || negotiation.initialSupplierPosition;
  const thresholdCheck = checkAutoAcceptRejectThresholds(
    currentOffer,
    negotiation.buyerConstraints,
    negotiation.currentRound
  );

  if (thresholdCheck.action === 'auto_accept' || thresholdCheck.action === 'negotiate') {
    // Accept current offer to break stalemate
    return completeNegotiation(
      negotiationId,
      'agreement',
      currentOffer,
      `Accepting current offer to break stalemate after ${roundsWithoutMovement} rounds without progress`
    );
  }

  // End negotiation without agreement
  return completeNegotiation(
    negotiationId,
    'no_agreement',
    undefined,
    `Negotiation stalemate - no significant progress for ${roundsWithoutMovement} rounds`
  );
}

/**
 * Handle buyer walk-away (price too far from constraints)
 */
async function handleWalkAway(
  negotiationId: string,
  reason: string
): Promise<RFQNegotiation> {
  log('info', 'Handling buyer walk-away', { negotiationId, reason });

  await addNegotiationMessage(negotiationId, {
    role: 'system',
    content: `Buyer walked away: ${reason}`,
    round: 0,
  });

  const result = await sql`
    UPDATE rfq_negotiations
    SET
      status = 'completed',
      outcome = 'no_agreement',
      completed_at = NOW(),
      rounds_used = current_round
    WHERE id = ${negotiationId}
    RETURNING *
  `;

  const negotiation = mapNegotiationRow(result.rows[0]);

  await updateRFQStatus(negotiation.rfqId, 'matched');
  await updateQuoteStatus(negotiation.quoteId, 'rejected');

  return negotiation;
}

/**
 * Check for stalemate condition
 */
function checkForStalemate(
  messages: NegotiationMessage[],
  newSupplierPosition: QuoteTerms,
  previousPosition: QuoteTerms
): {
  isStalemate: boolean;
  roundsWithoutMovement: number;
} {
  // Calculate price movement
  const priceDiff = Math.abs(newSupplierPosition.totalPrice - previousPosition.totalPrice);
  const percentMovement = (priceDiff / previousPosition.totalPrice) * 100;

  if (percentMovement >= MIN_PRICE_MOVEMENT_PERCENT) {
    return { isStalemate: false, roundsWithoutMovement: 0 };
  }

  // Count consecutive rounds without significant movement
  let roundsWithoutMovement = 1;
  const supplierMessages = messages.filter(m => m.role === 'supplier_ai' && m.proposedTerms);

  for (let i = supplierMessages.length - 1; i >= 0; i--) {
    const currentMsg = supplierMessages[i];
    const prevMsg = supplierMessages[i - 1];

    if (!prevMsg || !currentMsg.proposedTerms || !prevMsg.proposedTerms) break;

    const currentPrice = currentMsg.proposedTerms.totalPrice || 0;
    const prevPrice = prevMsg.proposedTerms.totalPrice || 0;
    const movement = Math.abs(currentPrice - prevPrice) / prevPrice * 100;

    if (movement < MIN_PRICE_MOVEMENT_PERCENT) {
      roundsWithoutMovement++;
    } else {
      break;
    }
  }

  return {
    isStalemate: roundsWithoutMovement >= STALEMATE_THRESHOLD_ROUNDS,
    roundsWithoutMovement,
  };
}

// ============================================================================
// FULL NEGOTIATION RUN
// ============================================================================

/**
 * Run a complete negotiation from start to finish
 * This is the main entry point for automated negotiations
 */
export async function runFullNegotiation(
  input: StartNegotiationInput
): Promise<NegotiationResult> {
  log('info', 'Starting full negotiation run', { rfqId: input.rfqId, quoteId: input.quoteId });

  // Start the negotiation
  let negotiation = await startNegotiation(input);

  // If already completed (auto-accept or auto-reject), return result
  if (negotiation.status === 'completed') {
    log('info', 'Negotiation completed immediately', {
      outcome: negotiation.outcome,
      finalPrice: negotiation.finalTerms?.totalPrice,
    });

    return {
      negotiation,
      success: negotiation.outcome === 'agreement' || negotiation.outcome === 'buyer_accepted',
      summary: generateNegotiationSummary(negotiation),
    };
  }

  // Run negotiation rounds until complete
  let roundResult = await runNegotiationRound(negotiation.id);
  while (!roundResult.reachedAgreement && !roundResult.walkedAway) {
    roundResult = await runNegotiationRound(negotiation.id);
  }

  negotiation = roundResult.negotiation;

  // Get final quote if agreement reached
  let finalQuote: RFQQuote | undefined;
  if (negotiation.finalQuoteId) {
    const quoteResult = await sql`
      SELECT * FROM rfq_quotes WHERE id = ${negotiation.finalQuoteId}
    `;
    if (quoteResult.rows.length > 0) {
      finalQuote = mapQuoteRow(quoteResult.rows[0]);
    }
  }

  const result: NegotiationResult = {
    negotiation,
    finalQuote,
    success: roundResult.reachedAgreement,
    summary: generateNegotiationSummary(negotiation),
  };

  log('info', 'Full negotiation complete', {
    success: result.success,
    rounds: negotiation.roundsUsed,
    finalPrice: negotiation.finalTerms?.totalPrice,
    savings: negotiation.reductionPercentage ? `${negotiation.reductionPercentage.toFixed(1)}%` : 'N/A',
  });

  return result;
}

/**
 * Generate human-readable negotiation summary
 */
function generateNegotiationSummary(negotiation: RFQNegotiation): string {
  const initial = negotiation.initialSupplierPosition.totalPrice;
  const final = negotiation.finalTerms?.totalPrice || initial;
  const reduction = initial - final;
  const percent = (reduction / initial) * 100;

  if (negotiation.outcome === 'agreement' || negotiation.outcome === 'buyer_accepted') {
    if (reduction > 0) {
      return `Negotiation successful! Achieved ${percent.toFixed(1)}% savings ($${reduction.toFixed(2)}) in ${negotiation.roundsUsed || negotiation.currentRound} round(s). Final price: $${final.toFixed(2)}`;
    }
    return `Agreement reached at $${final.toFixed(2)} after ${negotiation.roundsUsed || negotiation.currentRound} round(s).`;
  }

  if (negotiation.outcome === 'timeout') {
    return `Negotiation timed out after ${negotiation.roundsUsed || negotiation.currentRound} rounds without agreement.`;
  }

  if (negotiation.outcome === 'supplier_withdrew') {
    return `Supplier withdrew from negotiation.`;
  }

  return `Negotiation ended without agreement after ${negotiation.maxRounds} rounds. Supplier's final offer: $${final.toFixed(2)}`;
}

// ============================================================================
// DATABASE OPERATIONS
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
    ORDER BY started_at DESC
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
 * Update RFQ status
 */
async function updateRFQStatus(rfqId: string, status: string): Promise<void> {
  await sql`
    UPDATE rfqs
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${rfqId}
  `;
}

/**
 * Update quote status
 */
async function updateQuoteStatus(quoteId: string, status: string): Promise<void> {
  await sql`
    UPDATE rfq_quotes
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${quoteId}
  `;
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
  log('info', 'Manual accept requested', { negotiationId, acceptedBy });

  const negotiation = await getNegotiationById(negotiationId);
  if (!negotiation) {
    throw new NegotiationNotFoundError(negotiationId);
  }

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
  log('info', 'Manual reject requested', { negotiationId, rejectedBy, reason });

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
  negotiationId: string,
  reason?: string
): Promise<RFQNegotiation> {
  log('info', 'Pausing negotiation', { negotiationId, reason });

  if (reason) {
    await addNegotiationMessage(negotiationId, {
      role: 'system',
      content: `Negotiation paused: ${reason}`,
      round: 0,
    });
  }

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
  log('info', 'Resuming negotiation', { negotiationId });

  await addNegotiationMessage(negotiationId, {
    role: 'system',
    content: 'Negotiation resumed',
    round: 0,
  });

  const result = await sql`
    UPDATE rfq_negotiations
    SET status = 'active', last_activity_at = NOW()
    WHERE id = ${negotiationId}
    RETURNING *
  `;

  return mapNegotiationRow(result.rows[0]);
}

/**
 * Handle supplier withdrawal
 */
export async function handleSupplierWithdrawal(
  negotiationId: string,
  reason?: string
): Promise<RFQNegotiation> {
  log('warn', 'Supplier withdrawal', { negotiationId, reason });

  const result = await sql`
    UPDATE rfq_negotiations
    SET
      status = 'supplier_withdrawn',
      outcome = 'supplier_withdrew',
      completed_at = NOW(),
      rounds_used = current_round
    WHERE id = ${negotiationId}
    RETURNING *
  `;

  await addNegotiationMessage(negotiationId, {
    role: 'system',
    content: `Supplier withdrew from negotiation${reason ? `: ${reason}` : ''}`,
    round: 0,
  });

  const negotiation = mapNegotiationRow(result.rows[0]);

  await updateRFQStatus(negotiation.rfqId, 'matched');
  await updateQuoteStatus(negotiation.quoteId, 'withdrawn');

  return negotiation;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map database row to RFQNegotiation type
 */
function mapNegotiationRow(row: Record<string, unknown>): RFQNegotiation {
  return {
    id: row.id as string,
    rfqId: row.rfq_id as string,
    quoteId: row.quote_id as string,
    supplierId: row.supplier_id as string,
    buyerConstraints: row.buyer_constraints as RFQConstraints,
    initialSupplierPosition: row.initial_supplier_position as QuoteTerms,
    currentSupplierPosition: row.current_supplier_position as QuoteTerms | undefined,
    status: row.status as NegotiationStatus,
    currentRound: row.current_round as number,
    maxRounds: row.max_rounds as number,
    messages: ((row.messages as NegotiationMessage[]) || []).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp as unknown as string),
    })),
    outcome: row.outcome as NegotiationOutcome | undefined,
    finalTerms: row.final_terms as QuoteTerms | undefined,
    finalQuoteId: row.final_quote_id as string | undefined,
    startedAt: new Date(row.started_at as string),
    lastActivityAt: new Date(row.last_activity_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    totalPriceReduction: row.total_price_reduction
      ? parseFloat(row.total_price_reduction as string)
      : undefined,
    reductionPercentage: row.reduction_percentage
      ? parseFloat(row.reduction_percentage as string)
      : undefined,
    roundsUsed: row.rounds_used as number | undefined,
  };
}

/**
 * Map database row to RFQQuote type
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
    aiConfidenceScore: row.ai_confidence_score
      ? parseFloat(row.ai_confidence_score as string)
      : undefined,
    sourceCatalogId: row.source_catalog_id as string | undefined,
    isInitialQuote: row.is_initial_quote as boolean,
    parentQuoteId: row.parent_quote_id as string | undefined,
    negotiationRound: row.negotiation_round as number,
    status: row.status as RFQQuote['status'],
    supplierConfirmed: row.supplier_confirmed as boolean,
    supplierConfirmedAt: row.supplier_confirmed_at
      ? new Date(row.supplier_confirmed_at as string)
      : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Negotiation Engine API
 * Main entry points for AI-to-AI negotiation
 */
const NegotiationEngine = {
  // Core negotiation functions
  startNegotiation,
  runNegotiationRound,
  runFullNegotiation,

  // Query functions
  getNegotiationById,
  getNegotiationsByRFQ,
  getActiveNegotiations,

  // Manual intervention
  manualAccept,
  manualReject,
  pauseNegotiation,
  resumeNegotiation,
  handleSupplierWithdrawal,
};

export default NegotiationEngine;
