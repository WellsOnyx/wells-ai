/**
 * RFQ Constraint Service
 * Manages buyer negotiation limits and preferences
 */

import { sqlQuery as sql } from '@/lib/db';
import {
  RFQConstraints,
  CreateConstraintsInput,
  QuoteTerms,
} from './types';

// ============================================================================
// CONSTRAINT CRUD OPERATIONS
// ============================================================================

/**
 * Create or update constraints for an RFQ
 */
export async function setConstraints(
  input: CreateConstraintsInput
): Promise<RFQConstraints> {
  // Check if constraints already exist
  const existing = await getConstraintsByRFQ(input.rfqId);

  if (existing) {
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
      ${input.maxTotalBudget || null},
      ${input.maxUnitPrice || null},
      ${input.targetTotalPrice || null},
      ${input.targetUnitPrice || null},
      ${input.requiredDeliveryDate ? new Date(input.requiredDeliveryDate) : null},
      ${input.maxLeadTimeDays || null},
      ${input.preferredLeadTimeDays || null},
      ${input.acceptablePaymentTerms || []},
      ${input.preferredPaymentTerms || null},
      ${input.minimumWarrantyMonths || null},
      ${input.requiredCertifications || []},
      ${input.autoNegotiate ?? true},
      ${input.negotiationAggression || 'balanced'},
      ${input.allowCounterOffers ?? true},
      ${input.maxNegotiationRounds || 5}
    )
    RETURNING *
  `;

  return mapConstraintRow(result.rows[0]);
}

/**
 * Get constraints for an RFQ
 */
export async function getConstraintsByRFQ(
  rfqId: string
): Promise<RFQConstraints | null> {
  const result = await sql`
    SELECT * FROM rfq_constraints
    WHERE rfq_id = ${rfqId}
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;
  return mapConstraintRow(result.rows[0]);
}

/**
 * Update existing constraints
 */
export async function updateConstraints(
  rfqId: string,
  updates: Partial<CreateConstraintsInput>
): Promise<RFQConstraints> {
  const result = await sql`
    UPDATE rfq_constraints
    SET
      max_total_budget = COALESCE(${updates.maxTotalBudget}, max_total_budget),
      max_unit_price = COALESCE(${updates.maxUnitPrice}, max_unit_price),
      target_total_price = COALESCE(${updates.targetTotalPrice}, target_total_price),
      target_unit_price = COALESCE(${updates.targetUnitPrice}, target_unit_price),
      required_delivery_date = COALESCE(${updates.requiredDeliveryDate ? new Date(updates.requiredDeliveryDate) : null}, required_delivery_date),
      max_lead_time_days = COALESCE(${updates.maxLeadTimeDays}, max_lead_time_days),
      preferred_lead_time_days = COALESCE(${updates.preferredLeadTimeDays}, preferred_lead_time_days),
      acceptable_payment_terms = COALESCE(${updates.acceptablePaymentTerms}, acceptable_payment_terms),
      preferred_payment_terms = COALESCE(${updates.preferredPaymentTerms}, preferred_payment_terms),
      minimum_warranty_months = COALESCE(${updates.minimumWarrantyMonths}, minimum_warranty_months),
      required_certifications = COALESCE(${updates.requiredCertifications}, required_certifications),
      auto_negotiate = COALESCE(${updates.autoNegotiate}, auto_negotiate),
      negotiation_aggression = COALESCE(${updates.negotiationAggression}, negotiation_aggression),
      allow_counter_offers = COALESCE(${updates.allowCounterOffers}, allow_counter_offers),
      max_negotiation_rounds = COALESCE(${updates.maxNegotiationRounds}, max_negotiation_rounds),
      updated_at = NOW()
    WHERE rfq_id = ${rfqId}
    RETURNING *
  `;

  return mapConstraintRow(result.rows[0]);
}

/**
 * Delete constraints for an RFQ
 */
export async function deleteConstraints(rfqId: string): Promise<void> {
  await sql`
    DELETE FROM rfq_constraints
    WHERE rfq_id = ${rfqId}
  `;
}

// ============================================================================
// CONSTRAINT VALIDATION
// ============================================================================

/**
 * Check if a quote meets the buyer's constraints
 */
export function validateQuoteAgainstConstraints(
  quote: QuoteTerms,
  constraints: RFQConstraints
): {
  valid: boolean;
  violations: string[];
  warnings: string[];
} {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Price checks
  if (constraints.maxTotalBudget && quote.totalPrice > constraints.maxTotalBudget) {
    violations.push(
      `Total price $${quote.totalPrice.toFixed(2)} exceeds maximum budget $${constraints.maxTotalBudget.toFixed(2)}`
    );
  }

  if (constraints.maxUnitPrice && quote.unitPrice > constraints.maxUnitPrice) {
    violations.push(
      `Unit price $${quote.unitPrice.toFixed(2)} exceeds maximum $${constraints.maxUnitPrice.toFixed(2)}`
    );
  }

  if (constraints.targetTotalPrice && quote.totalPrice > constraints.targetTotalPrice * 1.1) {
    warnings.push(
      `Total price $${quote.totalPrice.toFixed(2)} is more than 10% above target $${constraints.targetTotalPrice.toFixed(2)}`
    );
  }

  // Lead time checks
  if (constraints.maxLeadTimeDays && quote.leadTimeDays > constraints.maxLeadTimeDays) {
    violations.push(
      `Lead time ${quote.leadTimeDays} days exceeds maximum ${constraints.maxLeadTimeDays} days`
    );
  }

  if (constraints.preferredLeadTimeDays && quote.leadTimeDays > constraints.preferredLeadTimeDays) {
    warnings.push(
      `Lead time ${quote.leadTimeDays} days exceeds preferred ${constraints.preferredLeadTimeDays} days`
    );
  }

  // Warranty check
  if (constraints.minimumWarrantyMonths && quote.warrantyMonths) {
    if (quote.warrantyMonths < constraints.minimumWarrantyMonths) {
      violations.push(
        `Warranty ${quote.warrantyMonths} months is below minimum ${constraints.minimumWarrantyMonths} months`
      );
    }
  }

  // Payment terms check
  if (constraints.acceptablePaymentTerms.length > 0 && quote.paymentTerms) {
    if (!constraints.acceptablePaymentTerms.includes(quote.paymentTerms)) {
      warnings.push(
        `Payment terms "${quote.paymentTerms}" not in acceptable list`
      );
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

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
  // If we've hit max rounds, accept if valid
  if (negotiationRound >= constraints.maxNegotiationRounds) {
    const validation = validateQuoteAgainstConstraints(offer, constraints);
    if (validation.valid) {
      return {
        accept: true,
        reason: 'Maximum negotiation rounds reached, offer meets requirements',
      };
    }
    return {
      accept: false,
      reason: 'Maximum rounds reached but offer does not meet requirements',
    };
  }

  // Check if offer meets target (not just max)
  if (constraints.targetTotalPrice && offer.totalPrice <= constraints.targetTotalPrice) {
    return {
      accept: true,
      reason: `Price $${offer.totalPrice.toFixed(2)} meets target $${constraints.targetTotalPrice.toFixed(2)}`,
    };
  }

  // For conservative negotiation, accept if within 5% of target
  if (constraints.negotiationAggression === 'conservative' && constraints.targetTotalPrice) {
    if (offer.totalPrice <= constraints.targetTotalPrice * 1.05) {
      return {
        accept: true,
        reason: 'Conservative: price within 5% of target',
      };
    }
  }

  // For aggressive negotiation, keep going if under budget
  if (constraints.negotiationAggression === 'aggressive') {
    if (constraints.maxTotalBudget && offer.totalPrice < constraints.maxTotalBudget * 0.85) {
      return {
        accept: false,
        reason: 'Aggressive: continuing to negotiate for better terms',
      };
    }
  }

  // Default: continue negotiating if there's room
  const validation = validateQuoteAgainstConstraints(offer, constraints);
  if (validation.valid && validation.warnings.length === 0) {
    return {
      accept: true,
      reason: 'Offer meets all requirements without warnings',
    };
  }

  return {
    accept: false,
    reason: 'Continuing negotiation to improve terms',
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

  return {
    ...target,
    totalPrice: counterPrice,
    unitPrice: counterPrice / currentOffer.quantity,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function mapConstraintRow(row: any): RFQConstraints {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    maxTotalBudget: row.max_total_budget ? parseFloat(row.max_total_budget) : undefined,
    maxUnitPrice: row.max_unit_price ? parseFloat(row.max_unit_price) : undefined,
    targetTotalPrice: row.target_total_price ? parseFloat(row.target_total_price) : undefined,
    targetUnitPrice: row.target_unit_price ? parseFloat(row.target_unit_price) : undefined,
    requiredDeliveryDate: row.required_delivery_date ? new Date(row.required_delivery_date) : undefined,
    maxLeadTimeDays: row.max_lead_time_days,
    preferredLeadTimeDays: row.preferred_lead_time_days,
    acceptablePaymentTerms: row.acceptable_payment_terms || [],
    preferredPaymentTerms: row.preferred_payment_terms,
    minimumWarrantyMonths: row.minimum_warranty_months,
    requiredCertifications: row.required_certifications || [],
    autoNegotiate: row.auto_negotiate,
    negotiationAggression: row.negotiation_aggression as RFQConstraints['negotiationAggression'],
    allowCounterOffers: row.allow_counter_offers,
    maxNegotiationRounds: row.max_negotiation_rounds,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

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
    if (text.match(/weeks?/i)) days *= 7;
    constraints.maxLeadTimeDays = days;
  }

  // Parse urgency
  if (text.match(/asap|urgent|rush|critical|immediately/i)) {
    constraints.maxLeadTimeDays = constraints.maxLeadTimeDays || 7;
    constraints.negotiationAggression = 'conservative'; // Speed over price
  }

  // Parse payment terms
  if (text.match(/net\s*30/i)) {
    constraints.acceptablePaymentTerms = ['Net 30'];
    constraints.preferredPaymentTerms = 'Net 30';
  } else if (text.match(/net\s*60/i)) {
    constraints.acceptablePaymentTerms = ['Net 60', 'Net 30'];
    constraints.preferredPaymentTerms = 'Net 60';
  }

  return constraints;
}
