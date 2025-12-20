/**
 * RFQ Constraint Service
 * Manages buyer negotiation limits and preferences for AI negotiations
 */

import { sql } from '@vercel/postgres';
import {
  RFQConstraints,
  CreateConstraintsInput,
  QuoteTerms,
  RFQQuote,
} from './types';

// ============================================================================
// LOGGING HELPER
// ============================================================================

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, service: 'constraint-service', message, ...meta };

  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

// ============================================================================
// CONSTRAINT CRUD OPERATIONS
// ============================================================================

/**
 * Create or update constraints for an RFQ
 * If constraints already exist for the RFQ, updates them instead
 */
export async function setConstraints(
  input: CreateConstraintsInput
): Promise<RFQConstraints> {
  try {
    log('info', 'Setting constraints for RFQ', { rfqId: input.rfqId });

    // Check if constraints already exist
    const existing = await getConstraintsByRFQ(input.rfqId);

    if (existing) {
      log('info', 'Constraints exist, updating', { rfqId: input.rfqId, constraintId: existing.id });
      return updateConstraints(input.rfqId, input);
    }

    const result = await sql`
      INSERT INTO rfq_constraints (
        rfq_id,
        max_total_budget,
        max_unit_price,
        target_total_price,
        target_unit_price,
        required_delivery_date,
        max_lead_time_days,
        preferred_lead_time_days,
        acceptable_payment_terms,
        preferred_payment_terms,
        minimum_warranty_months,
        required_certifications,
        auto_negotiate,
        negotiation_aggression,
        allow_counter_offers,
        max_negotiation_rounds
      ) VALUES (
        ${input.rfqId},
        ${input.maxTotalBudget ?? null},
        ${input.maxUnitPrice ?? null},
        ${input.targetTotalPrice ?? null},
        ${input.targetUnitPrice ?? null},
        ${input.requiredDeliveryDate ? new Date(input.requiredDeliveryDate).toISOString() : null},
        ${input.maxLeadTimeDays ?? null},
        ${input.preferredLeadTimeDays ?? null},
        ${input.acceptablePaymentTerms ?? []},
        ${input.preferredPaymentTerms ?? null},
        ${input.minimumWarrantyMonths ?? null},
        ${input.requiredCertifications ?? []},
        ${input.autoNegotiate ?? true},
        ${input.negotiationAggression ?? 'balanced'},
        ${input.allowCounterOffers ?? true},
        ${input.maxNegotiationRounds ?? 5}
      )
      RETURNING *
    `;

    const constraints = mapConstraintRow(result.rows[0]);
    log('info', 'Constraints created successfully', { rfqId: input.rfqId, constraintId: constraints.id });

    return constraints;
  } catch (error) {
    log('error', 'Failed to set constraints', {
      rfqId: input.rfqId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Failed to set constraints for RFQ ${input.rfqId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get constraints for an RFQ
 */
export async function getConstraintsByRFQ(
  rfqId: string
): Promise<RFQConstraints | null> {
  try {
    log('info', 'Fetching constraints for RFQ', { rfqId });

    const result = await sql`
      SELECT * FROM rfq_constraints
      WHERE rfq_id = ${rfqId}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      log('info', 'No constraints found for RFQ', { rfqId });
      return null;
    }

    const constraints = mapConstraintRow(result.rows[0]);
    log('info', 'Constraints retrieved successfully', { rfqId, constraintId: constraints.id });

    return constraints;
  } catch (error) {
    log('error', 'Failed to fetch constraints', {
      rfqId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Failed to fetch constraints for RFQ ${rfqId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update existing constraints
 */
export async function updateConstraints(
  rfqId: string,
  updates: Partial<CreateConstraintsInput>
): Promise<RFQConstraints> {
  try {
    log('info', 'Updating constraints for RFQ', { rfqId, updates: Object.keys(updates) });

    const result = await sql`
      UPDATE rfq_constraints
      SET
        max_total_budget = COALESCE(${updates.maxTotalBudget ?? null}, max_total_budget),
        max_unit_price = COALESCE(${updates.maxUnitPrice ?? null}, max_unit_price),
        target_total_price = COALESCE(${updates.targetTotalPrice ?? null}, target_total_price),
        target_unit_price = COALESCE(${updates.targetUnitPrice ?? null}, target_unit_price),
        required_delivery_date = COALESCE(${updates.requiredDeliveryDate ? new Date(updates.requiredDeliveryDate).toISOString() : null}, required_delivery_date),
        max_lead_time_days = COALESCE(${updates.maxLeadTimeDays ?? null}, max_lead_time_days),
        preferred_lead_time_days = COALESCE(${updates.preferredLeadTimeDays ?? null}, preferred_lead_time_days),
        acceptable_payment_terms = COALESCE(${updates.acceptablePaymentTerms ?? null}, acceptable_payment_terms),
        preferred_payment_terms = COALESCE(${updates.preferredPaymentTerms ?? null}, preferred_payment_terms),
        minimum_warranty_months = COALESCE(${updates.minimumWarrantyMonths ?? null}, minimum_warranty_months),
        required_certifications = COALESCE(${updates.requiredCertifications ?? null}, required_certifications),
        auto_negotiate = COALESCE(${updates.autoNegotiate ?? null}, auto_negotiate),
        negotiation_aggression = COALESCE(${updates.negotiationAggression ?? null}, negotiation_aggression),
        allow_counter_offers = COALESCE(${updates.allowCounterOffers ?? null}, allow_counter_offers),
        max_negotiation_rounds = COALESCE(${updates.maxNegotiationRounds ?? null}, max_negotiation_rounds),
        updated_at = NOW()
      WHERE rfq_id = ${rfqId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new Error(`No constraints found for RFQ ${rfqId}`);
    }

    const constraints = mapConstraintRow(result.rows[0]);
    log('info', 'Constraints updated successfully', { rfqId, constraintId: constraints.id });

    return constraints;
  } catch (error) {
    log('error', 'Failed to update constraints', {
      rfqId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Failed to update constraints for RFQ ${rfqId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete constraints for an RFQ
 */
export async function deleteConstraints(rfqId: string): Promise<void> {
  try {
    log('info', 'Deleting constraints for RFQ', { rfqId });

    await sql`
      DELETE FROM rfq_constraints
      WHERE rfq_id = ${rfqId}
    `;

    log('info', 'Constraints deleted successfully', { rfqId });
  } catch (error) {
    log('error', 'Failed to delete constraints', {
      rfqId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Failed to delete constraints for RFQ ${rfqId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// CONSTRAINT VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
  score: number; // 0-100 score for how well the quote matches constraints
}

/**
 * Validate if a quote meets the buyer's constraints
 * Returns violations (hard failures) and warnings (soft issues)
 */
export function validateQuoteAgainstConstraints(
  quote: QuoteTerms | RFQQuote,
  constraints: RFQConstraints
): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Extract values handling both QuoteTerms and RFQQuote types
  const totalPrice = 'totalPrice' in quote ? quote.totalPrice : 0;
  const unitPrice = 'unitPrice' in quote ? quote.unitPrice : 0;
  const leadTimeDays = 'leadTimeDays' in quote ? quote.leadTimeDays : 0;
  const warrantyMonths = 'warrantyMonths' in quote ? quote.warrantyMonths : undefined;
  const paymentTerms = 'paymentTerms' in quote ? quote.paymentTerms : undefined;

  // === BUDGET CONSTRAINTS ===

  // Max total budget - hard limit
  if (constraints.maxTotalBudget && totalPrice > constraints.maxTotalBudget) {
    violations.push(
      `Total price $${totalPrice.toFixed(2)} exceeds maximum budget $${constraints.maxTotalBudget.toFixed(2)}`
    );
    score -= 30;
  }

  // Max unit price - hard limit
  if (constraints.maxUnitPrice && unitPrice > constraints.maxUnitPrice) {
    violations.push(
      `Unit price $${unitPrice.toFixed(2)} exceeds maximum $${constraints.maxUnitPrice.toFixed(2)}`
    );
    score -= 20;
  }

  // Target price comparison - soft warning
  if (constraints.targetTotalPrice) {
    const overTarget = ((totalPrice - constraints.targetTotalPrice) / constraints.targetTotalPrice) * 100;
    if (overTarget > 10) {
      warnings.push(
        `Total price $${totalPrice.toFixed(2)} is ${overTarget.toFixed(1)}% above target $${constraints.targetTotalPrice.toFixed(2)}`
      );
      score -= Math.min(overTarget, 20);
    } else if (overTarget > 0) {
      score -= overTarget / 2;
    }
  }

  // Target unit price comparison
  if (constraints.targetUnitPrice) {
    const overTarget = ((unitPrice - constraints.targetUnitPrice) / constraints.targetUnitPrice) * 100;
    if (overTarget > 10) {
      warnings.push(
        `Unit price $${unitPrice.toFixed(2)} is ${overTarget.toFixed(1)}% above target $${constraints.targetUnitPrice.toFixed(2)}`
      );
      score -= Math.min(overTarget / 2, 10);
    }
  }

  // === TIMELINE CONSTRAINTS ===

  // Max lead time - hard limit
  if (constraints.maxLeadTimeDays && leadTimeDays > constraints.maxLeadTimeDays) {
    violations.push(
      `Lead time ${leadTimeDays} days exceeds maximum ${constraints.maxLeadTimeDays} days`
    );
    score -= 25;
  }

  // Preferred lead time - soft warning
  if (constraints.preferredLeadTimeDays && leadTimeDays > constraints.preferredLeadTimeDays) {
    warnings.push(
      `Lead time ${leadTimeDays} days exceeds preferred ${constraints.preferredLeadTimeDays} days`
    );
    score -= 5;
  }

  // Required delivery date check
  if (constraints.requiredDeliveryDate && leadTimeDays) {
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + leadTimeDays);

    if (estimatedDelivery > constraints.requiredDeliveryDate) {
      violations.push(
        `Estimated delivery ${estimatedDelivery.toLocaleDateString()} is after required date ${constraints.requiredDeliveryDate.toLocaleDateString()}`
      );
      score -= 25;
    }
  }

  // === QUALITY CONSTRAINTS ===

  // Warranty requirement - hard limit if specified
  if (constraints.minimumWarrantyMonths) {
    if (!warrantyMonths) {
      warnings.push(`No warranty specified, minimum required is ${constraints.minimumWarrantyMonths} months`);
      score -= 10;
    } else if (warrantyMonths < constraints.minimumWarrantyMonths) {
      violations.push(
        `Warranty ${warrantyMonths} months is below minimum ${constraints.minimumWarrantyMonths} months`
      );
      score -= 15;
    }
  }

  // === PAYMENT TERMS CONSTRAINTS ===

  if (constraints.acceptablePaymentTerms.length > 0 && paymentTerms) {
    const termsAccepted = constraints.acceptablePaymentTerms.some(
      term => term.toLowerCase() === paymentTerms.toLowerCase()
    );
    if (!termsAccepted) {
      warnings.push(
        `Payment terms "${paymentTerms}" not in acceptable list: ${constraints.acceptablePaymentTerms.join(', ')}`
      );
      score -= 5;
    }
  }

  // Ensure score stays in valid range
  score = Math.max(0, Math.min(100, score));

  log('info', 'Quote validation completed', {
    valid: violations.length === 0,
    violationCount: violations.length,
    warningCount: warnings.length,
    score
  });

  return {
    valid: violations.length === 0,
    violations,
    warnings,
    score,
  };
}

// ============================================================================
// AUTO-ACCEPT / AUTO-REJECT THRESHOLDS
// ============================================================================

export interface ThresholdCheckResult {
  action: 'auto_accept' | 'auto_reject' | 'negotiate' | 'manual_review';
  reason: string;
  confidence: number; // 0-100 confidence in the decision
}

/**
 * Check if a quote should be auto-accepted, auto-rejected, or requires negotiation
 * This is the core decision logic for AI negotiations
 */
export function checkAutoAcceptRejectThresholds(
  quote: QuoteTerms | RFQQuote,
  constraints: RFQConstraints,
  negotiationRound: number = 0
): ThresholdCheckResult {
  // First validate the quote
  const validation = validateQuoteAgainstConstraints(quote, constraints);

  // Extract price for calculations
  const totalPrice = 'totalPrice' in quote ? quote.totalPrice : 0;
  const leadTimeDays = 'leadTimeDays' in quote ? quote.leadTimeDays : 0;

  // === AUTO-REJECT CONDITIONS ===

  // Hard violations that cannot be negotiated
  if (validation.violations.length > 0) {
    // Check if violations are negotiable
    const hasNonNegotiableViolation = validation.violations.some(v =>
      v.includes('required date') || // Can't change calendar
      v.includes('certification') // Can't get certifications quickly
    );

    if (hasNonNegotiableViolation) {
      log('warn', 'Quote auto-rejected due to non-negotiable violations', { violations: validation.violations });
      return {
        action: 'auto_reject',
        reason: `Non-negotiable constraint violations: ${validation.violations.join('; ')}`,
        confidence: 95,
      };
    }

    // Price violations might be negotiable
    if (!constraints.allowCounterOffers) {
      log('warn', 'Quote auto-rejected, counter-offers not allowed', { violations: validation.violations });
      return {
        action: 'auto_reject',
        reason: `Constraint violations and counter-offers disabled: ${validation.violations.join('; ')}`,
        confidence: 90,
      };
    }

    // Budget exceeded by more than 50% - likely not worth negotiating
    if (constraints.maxTotalBudget && totalPrice > constraints.maxTotalBudget * 1.5) {
      log('warn', 'Quote auto-rejected, price exceeds budget by >50%');
      return {
        action: 'auto_reject',
        reason: `Price $${totalPrice.toFixed(2)} exceeds budget by more than 50%`,
        confidence: 85,
      };
    }
  }

  // === AUTO-ACCEPT CONDITIONS ===

  // Quote meets or beats target price with no violations
  if (constraints.targetTotalPrice && totalPrice <= constraints.targetTotalPrice && validation.valid) {
    log('info', 'Quote auto-accepted, meets target price');
    return {
      action: 'auto_accept',
      reason: `Price $${totalPrice.toFixed(2)} meets target $${constraints.targetTotalPrice.toFixed(2)}`,
      confidence: 95,
    };
  }

  // Quote is under budget by significant margin with good score
  if (constraints.maxTotalBudget && totalPrice < constraints.maxTotalBudget * 0.85 && validation.score >= 90) {
    log('info', 'Quote auto-accepted, significantly under budget with high score');
    return {
      action: 'auto_accept',
      reason: `Price $${totalPrice.toFixed(2)} is 15%+ under budget with score ${validation.score}`,
      confidence: 90,
    };
  }

  // Perfect score with valid quote
  if (validation.valid && validation.warnings.length === 0 && validation.score >= 95) {
    log('info', 'Quote auto-accepted, perfect score');
    return {
      action: 'auto_accept',
      reason: 'Quote meets all constraints with no warnings',
      confidence: 95,
    };
  }

  // Max negotiation rounds reached
  if (negotiationRound >= constraints.maxNegotiationRounds) {
    if (validation.valid) {
      log('info', 'Quote auto-accepted, max rounds reached but valid');
      return {
        action: 'auto_accept',
        reason: `Maximum ${constraints.maxNegotiationRounds} rounds reached, quote meets requirements`,
        confidence: 80,
      };
    } else {
      log('warn', 'Manual review needed, max rounds reached with invalid quote');
      return {
        action: 'manual_review',
        reason: `Maximum rounds reached but quote has violations: ${validation.violations.join('; ')}`,
        confidence: 60,
      };
    }
  }

  // === NEGOTIATION CONDITIONS ===

  // Auto-negotiation disabled - needs manual review
  if (!constraints.autoNegotiate) {
    log('info', 'Manual review needed, auto-negotiate disabled');
    return {
      action: 'manual_review',
      reason: 'Auto-negotiation is disabled for this RFQ',
      confidence: 100,
    };
  }

  // Conservative strategy - accept if within 5% of target
  if (constraints.negotiationAggression === 'conservative' && constraints.targetTotalPrice) {
    if (totalPrice <= constraints.targetTotalPrice * 1.05 && validation.valid) {
      log('info', 'Quote auto-accepted per conservative strategy');
      return {
        action: 'auto_accept',
        reason: 'Conservative strategy: price within 5% of target',
        confidence: 85,
      };
    }
  }

  // Valid quote with room for improvement - negotiate
  if (validation.valid || validation.violations.every(v => v.includes('price') || v.includes('Price'))) {
    const potentialSavings = constraints.targetTotalPrice
      ? ((totalPrice - constraints.targetTotalPrice) / totalPrice * 100).toFixed(1)
      : 'unknown';

    log('info', 'Entering negotiation', { potentialSavings: `${potentialSavings}%`, round: negotiationRound });
    return {
      action: 'negotiate',
      reason: `Room for negotiation exists, potential savings: ${potentialSavings}%`,
      confidence: 75,
    };
  }

  // Default to manual review for complex cases
  log('info', 'Manual review needed, complex case');
  return {
    action: 'manual_review',
    reason: 'Quote requires manual review due to mixed constraint results',
    confidence: 50,
  };
}

/**
 * Quick check if auto-accept is possible (convenience function)
 */
export function canAutoAccept(
  quote: QuoteTerms | RFQQuote,
  constraints: RFQConstraints
): boolean {
  const result = checkAutoAcceptRejectThresholds(quote, constraints);
  return result.action === 'auto_accept';
}

/**
 * Quick check if auto-reject is appropriate (convenience function)
 */
export function shouldAutoReject(
  quote: QuoteTerms | RFQQuote,
  constraints: RFQConstraints
): boolean {
  const result = checkAutoAcceptRejectThresholds(quote, constraints);
  return result.action === 'auto_reject';
}

// ============================================================================
// NEGOTIATION HELPERS
// ============================================================================

/**
 * Calculate negotiation target based on constraints
 */
export function calculateNegotiationTarget(
  currentOffer: QuoteTerms,
  constraints: RFQConstraints
): QuoteTerms {
  const aggression = constraints.negotiationAggression;

  // Determine target price
  let targetPrice: number;
  if (constraints.targetTotalPrice) {
    targetPrice = constraints.targetTotalPrice;
  } else if (constraints.maxTotalBudget) {
    // Aim for 80-95% of max budget depending on aggression
    const factor = aggression === 'aggressive' ? 0.8 : aggression === 'conservative' ? 0.95 : 0.9;
    targetPrice = constraints.maxTotalBudget * factor;
  } else {
    // Aim for 10-20% reduction
    const reduction = aggression === 'aggressive' ? 0.2 : aggression === 'conservative' ? 0.1 : 0.15;
    targetPrice = currentOffer.totalPrice * (1 - reduction);
  }

  // Determine target lead time
  let targetLeadTime = currentOffer.leadTimeDays;
  if (constraints.preferredLeadTimeDays && currentOffer.leadTimeDays > constraints.preferredLeadTimeDays) {
    targetLeadTime = constraints.preferredLeadTimeDays;
  }

  // Calculate unit price from total
  const targetUnitPrice = targetPrice / currentOffer.quantity;

  return {
    unitPrice: targetUnitPrice,
    quantity: currentOffer.quantity,
    totalPrice: targetPrice,
    leadTimeDays: targetLeadTime,
    paymentTerms: constraints.preferredPaymentTerms || currentOffer.paymentTerms,
    warrantyMonths: constraints.minimumWarrantyMonths,
    shippingCost: currentOffer.shippingCost,
  };
}

/**
 * Determine if we should accept the current offer or keep negotiating
 */
export function shouldAcceptOffer(
  offer: QuoteTerms,
  constraints: RFQConstraints,
  negotiationRound: number
): {
  accept: boolean;
  reason: string;
} {
  const result = checkAutoAcceptRejectThresholds(offer, constraints, negotiationRound);

  return {
    accept: result.action === 'auto_accept',
    reason: result.reason,
  };
}

/**
 * Generate buyer's counter-offer based on constraints and current offer
 */
export function generateCounterOffer(
  currentOffer: QuoteTerms,
  constraints: RFQConstraints,
  round: number
): QuoteTerms {
  const target = calculateNegotiationTarget(currentOffer, constraints);
  const aggression = constraints.negotiationAggression;

  // Calculate how much to reduce per round
  const remainingRounds = constraints.maxNegotiationRounds - round;
  const priceGap = currentOffer.totalPrice - target.totalPrice;

  // Counter-offer strategy based on aggression
  let counterPrice: number;

  if (aggression === 'aggressive') {
    // Ask for more than target initially, aim below target
    const stretchTarget = target.totalPrice * 0.95;
    counterPrice = stretchTarget + (priceGap * 0.3);
  } else if (aggression === 'conservative') {
    // Ask for slightly below current, gradual reduction
    counterPrice = currentOffer.totalPrice - (priceGap / (remainingRounds + 1));
  } else {
    // Balanced: aim for target with reasonable reduction
    counterPrice = currentOffer.totalPrice - (priceGap * 0.5);
  }

  // Ensure we don't go above current offer or below target
  counterPrice = Math.max(target.totalPrice, Math.min(currentOffer.totalPrice * 0.99, counterPrice));

  log('info', 'Generated counter-offer', {
    currentPrice: currentOffer.totalPrice,
    counterPrice,
    targetPrice: target.totalPrice,
    aggression,
    round
  });

  return {
    ...target,
    totalPrice: counterPrice,
    unitPrice: counterPrice / currentOffer.quantity,
  };
}

// ============================================================================
// NATURAL LANGUAGE PARSING
// ============================================================================

/**
 * Infer constraints from natural language input
 */
export function parseConstraintsFromText(text: string): Partial<CreateConstraintsInput> {
  const constraints: Partial<CreateConstraintsInput> = {};

  // Parse budget mentions
  const budgetMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:max|budget|maximum|cap|limit)/i) ||
                      text.match(/(?:max|budget|maximum|cap|limit)\s*(?:of|is|:)?\s*\$?([\d,]+(?:\.\d{2})?)/i);
  if (budgetMatch) {
    constraints.maxTotalBudget = parseFloat(budgetMatch[1].replace(/,/g, ''));
  }

  // Parse target price
  const targetMatch = text.match(/target\s*(?:price|of|:)?\s*\$?([\d,]+(?:\.\d{2})?)/i) ||
                      text.match(/\$?([\d,]+(?:\.\d{2})?)\s*target/i);
  if (targetMatch) {
    constraints.targetTotalPrice = parseFloat(targetMatch[1].replace(/,/g, ''));
  }

  // Parse timeline
  const timeMatch = text.match(/(\d+)\s*(?:days?|weeks?)/i);
  if (timeMatch) {
    let days = parseInt(timeMatch[1]);
    if (text.toLowerCase().includes('week')) days *= 7;
    constraints.maxLeadTimeDays = days;
  }

  // Parse urgency
  if (text.match(/asap|urgent|rush|critical|immediately/i)) {
    constraints.maxLeadTimeDays = constraints.maxLeadTimeDays || 7;
    constraints.negotiationAggression = 'conservative'; // Speed over price
  }

  // Parse aggression level
  if (text.match(/aggressive|hard\s*ball|push\s*hard/i)) {
    constraints.negotiationAggression = 'aggressive';
  } else if (text.match(/conservative|gentle|soft/i)) {
    constraints.negotiationAggression = 'conservative';
  }

  // Parse payment terms
  const netMatch = text.match(/net\s*(\d+)/i);
  if (netMatch) {
    const netDays = parseInt(netMatch[1]);
    constraints.preferredPaymentTerms = `Net ${netDays}`;
    constraints.acceptablePaymentTerms = [`Net ${netDays}`];
    // Also accept shorter terms
    if (netDays >= 60) constraints.acceptablePaymentTerms.push('Net 30', 'Net 45');
    else if (netDays >= 30) constraints.acceptablePaymentTerms.push('Net 15');
  }

  // Parse warranty requirements
  const warrantyMatch = text.match(/(\d+)\s*(?:month|year)s?\s*warranty/i);
  if (warrantyMatch) {
    let months = parseInt(warrantyMatch[1]);
    if (text.toLowerCase().includes('year')) months *= 12;
    constraints.minimumWarrantyMonths = months;
  }

  log('info', 'Parsed constraints from text', {
    inputLength: text.length,
    parsedFields: Object.keys(constraints)
  });

  return constraints;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map database row to RFQConstraints type
 */
function mapConstraintRow(row: Record<string, unknown>): RFQConstraints {
  return {
    id: row.id as string,
    rfqId: row.rfq_id as string,
    maxTotalBudget: row.max_total_budget ? parseFloat(row.max_total_budget as string) : undefined,
    maxUnitPrice: row.max_unit_price ? parseFloat(row.max_unit_price as string) : undefined,
    targetTotalPrice: row.target_total_price ? parseFloat(row.target_total_price as string) : undefined,
    targetUnitPrice: row.target_unit_price ? parseFloat(row.target_unit_price as string) : undefined,
    requiredDeliveryDate: row.required_delivery_date ? new Date(row.required_delivery_date as string) : undefined,
    maxLeadTimeDays: row.max_lead_time_days as number | undefined,
    preferredLeadTimeDays: row.preferred_lead_time_days as number | undefined,
    acceptablePaymentTerms: (row.acceptable_payment_terms as string[]) || [],
    preferredPaymentTerms: row.preferred_payment_terms as string | undefined,
    minimumWarrantyMonths: row.minimum_warranty_months as number | undefined,
    requiredCertifications: (row.required_certifications as string[]) || [],
    autoNegotiate: row.auto_negotiate as boolean,
    negotiationAggression: row.negotiation_aggression as RFQConstraints['negotiationAggression'],
    allowCounterOffers: row.allow_counter_offers as boolean,
    maxNegotiationRounds: row.max_negotiation_rounds as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
