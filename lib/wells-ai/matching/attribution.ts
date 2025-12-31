/**
 * Wells AI Success Attribution System
 *
 * Tracks whether matches lead to transactions and calculates the 1% sourcing fee.
 *
 * Attribution flow:
 * 1. Match created -> Attribution window opens
 * 2. Introduction sent -> Track engagement
 * 3. Deal room created -> Track progression
 * 4. Transaction completed -> Link to match, calculate fee
 * 5. Fee captured -> Revenue recognized
 */

import { sql } from '@vercel/postgres';
import {
  MatchAttribution,
  AttributionStatus,
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  DEFAULT_SOURCING_FEE_PERCENTAGE,
  SourcingMatch,
} from './types';

// ============================================================================
// ATTRIBUTION TRACKING
// ============================================================================

/**
 * Create attribution record when a match is created
 */
export async function createAttribution(match: SourcingMatch): Promise<MatchAttribution> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const attribution: MatchAttribution = {
    id: generateId(),
    matchId: match.id,
    requestId: match.requestId,
    supplierId: match.supplierId,
    buyerId: '', // Will be filled from request
    matchedAt: match.matchedAt,
    attributionWindowDays: DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    attributionExpiresAt: expiresAt,
    feePercentage: DEFAULT_SOURCING_FEE_PERCENTAGE,
    feeCurrency: 'USD',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Get buyer ID from request
    const requestResult = await sql`
      SELECT buyer_id FROM sourcing_requests WHERE id = ${match.requestId}
    `;
    if (requestResult.rows.length > 0) {
      attribution.buyerId = requestResult.rows[0].buyer_id;
    }

    await sql`
      INSERT INTO match_attributions (
        id, match_id, request_id, supplier_id, buyer_id,
        matched_at, attribution_window_days, attribution_expires_at,
        fee_percentage, fee_currency, status, created_at, updated_at
      ) VALUES (
        ${attribution.id}, ${attribution.matchId}, ${attribution.requestId},
        ${attribution.supplierId}, ${attribution.buyerId},
        ${attribution.matchedAt}, ${attribution.attributionWindowDays},
        ${attribution.attributionExpiresAt}, ${attribution.feePercentage},
        ${attribution.feeCurrency}, ${attribution.status},
        ${attribution.createdAt}, ${attribution.updatedAt}
      )
    `;
  } catch (error) {
    console.error('Error creating attribution:', error);
  }

  return attribution;
}

/**
 * Update attribution when introduction is sent
 */
export async function recordIntroductionSent(
  matchId: string,
  introductionId: string
): Promise<void> {
  try {
    await sql`
      UPDATE match_attributions
      SET introduced_at = NOW(), updated_at = NOW()
      WHERE match_id = ${matchId}
    `;
  } catch (error) {
    console.error('Error updating attribution for introduction:', error);
  }
}

/**
 * Update attribution when deal starts
 */
export async function recordDealStarted(
  matchId: string,
  dealRoomId: string
): Promise<void> {
  try {
    await sql`
      UPDATE match_attributions
      SET deal_started_at = NOW(), updated_at = NOW()
      WHERE match_id = ${matchId}
    `;
  } catch (error) {
    console.error('Error updating attribution for deal start:', error);
  }
}

/**
 * Link a completed transaction to a match for attribution
 */
export async function linkTransactionToMatch(
  transactionId: string,
  matchId: string,
  transactionValue: number
): Promise<{
  attribution: MatchAttribution;
  feeAmount: number;
  withinWindow: boolean;
}> {
  // Get attribution record
  const attribution = await getAttributionByMatch(matchId);
  if (!attribution) {
    throw new Error(`No attribution found for match: ${matchId}`);
  }

  // Check if within attribution window
  const now = new Date();
  const withinWindow = now <= attribution.attributionExpiresAt;

  // Calculate fee
  const feeAmount = transactionValue * attribution.feePercentage;

  // Update attribution
  try {
    await sql`
      UPDATE match_attributions
      SET
        transaction_id = ${transactionId},
        transaction_completed_at = NOW(),
        transaction_value = ${transactionValue},
        fee_amount = ${feeAmount},
        status = 'attributed',
        updated_at = NOW()
      WHERE id = ${attribution.id}
    `;
  } catch (error) {
    console.error('Error linking transaction:', error);
  }

  attribution.transactionId = transactionId;
  attribution.transactionCompletedAt = now;
  attribution.transactionValue = transactionValue;
  attribution.feeAmount = feeAmount;
  attribution.status = 'attributed';

  console.log(`[Attribution] Transaction ${transactionId} linked to match ${matchId}. Fee: $${feeAmount.toFixed(2)} (${withinWindow ? 'within' : 'outside'} window)`);

  return {
    attribution,
    feeAmount,
    withinWindow,
  };
}

/**
 * Attempt to auto-attribute a transaction to a match
 * Used when a transaction is detected between a buyer and supplier
 */
export async function autoAttributeTransaction(
  buyerId: string,
  supplierId: string,
  transactionValue: number,
  transactionId: string
): Promise<{
  attributed: boolean;
  matchId?: string;
  feeAmount?: number;
}> {
  try {
    // Find valid attribution for this buyer-supplier pair
    const result = await sql`
      SELECT ma.*
      FROM match_attributions ma
      WHERE ma.buyer_id = ${buyerId}
        AND ma.supplier_id = ${supplierId}
        AND ma.status = 'pending'
        AND ma.attribution_expires_at > NOW()
        AND ma.transaction_id IS NULL
      ORDER BY ma.matched_at DESC
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      console.log(`[Attribution] No valid attribution found for buyer ${buyerId} and supplier ${supplierId}`);
      return { attributed: false };
    }

    const attribution = rowToAttribution(result.rows[0]);
    const feeAmount = transactionValue * attribution.feePercentage;

    // Link the transaction
    await sql`
      UPDATE match_attributions
      SET
        transaction_id = ${transactionId},
        transaction_completed_at = NOW(),
        transaction_value = ${transactionValue},
        fee_amount = ${feeAmount},
        status = 'attributed',
        updated_at = NOW()
      WHERE id = ${attribution.id}
    `;

    // Update the match status
    await sql`
      UPDATE sourcing_matches
      SET
        transaction_id = ${transactionId},
        status = 'deal_completed',
        updated_at = NOW()
      WHERE id = ${attribution.matchId}
    `;

    console.log(`[Attribution] Auto-attributed transaction ${transactionId} to match ${attribution.matchId}. Fee: $${feeAmount.toFixed(2)}`);

    return {
      attributed: true,
      matchId: attribution.matchId,
      feeAmount,
    };
  } catch (error) {
    console.error('Error auto-attributing transaction:', error);
    return { attributed: false };
  }
}

// ============================================================================
// FEE CALCULATION & CAPTURE
// ============================================================================

/**
 * Calculate fee for a potential transaction
 */
export function calculateSourcingFee(
  transactionValue: number,
  options?: {
    feePercentage?: number;
    minimumFee?: number;
    maximumFee?: number;
  }
): {
  feeAmount: number;
  feePercentage: number;
  effectiveRate: number;
} {
  const feePercentage = options?.feePercentage || DEFAULT_SOURCING_FEE_PERCENTAGE;
  const minimumFee = options?.minimumFee || 10; // $10 minimum
  const maximumFee = options?.maximumFee || 10000; // $10,000 cap

  let feeAmount = transactionValue * feePercentage;

  // Apply minimum
  if (feeAmount < minimumFee) {
    feeAmount = minimumFee;
  }

  // Apply maximum (cap)
  if (feeAmount > maximumFee) {
    feeAmount = maximumFee;
  }

  const effectiveRate = transactionValue > 0 ? feeAmount / transactionValue : 0;

  return {
    feeAmount,
    feePercentage,
    effectiveRate,
  };
}

/**
 * Capture (collect) the sourcing fee from an attributed transaction
 */
export async function captureFee(attributionId: string): Promise<{
  success: boolean;
  feeAmount: number;
  invoiceId?: string;
  error?: string;
}> {
  const attribution = await getAttribution(attributionId);
  if (!attribution) {
    return { success: false, feeAmount: 0, error: 'Attribution not found' };
  }

  if (attribution.status !== 'attributed') {
    return { success: false, feeAmount: 0, error: `Invalid status: ${attribution.status}` };
  }

  if (!attribution.feeAmount) {
    return { success: false, feeAmount: 0, error: 'Fee amount not calculated' };
  }

  try {
    // Create fee invoice
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await sql`
      INSERT INTO fee_invoices (
        id, attribution_id, match_id, transaction_id,
        buyer_id, supplier_id, fee_amount, currency,
        status, created_at
      ) VALUES (
        ${invoiceId}, ${attributionId}, ${attribution.matchId},
        ${attribution.transactionId}, ${attribution.buyerId},
        ${attribution.supplierId}, ${attribution.feeAmount},
        ${attribution.feeCurrency}, 'pending', NOW()
      )
    `;

    // Update attribution status
    await sql`
      UPDATE match_attributions
      SET
        status = 'fee_calculated',
        fee_invoice_id = ${invoiceId},
        updated_at = NOW()
      WHERE id = ${attributionId}
    `;

    console.log(`[Attribution] Fee captured for ${attributionId}. Invoice: ${invoiceId}, Amount: $${attribution.feeAmount.toFixed(2)}`);

    // Here you would integrate with your payment system to actually collect the fee
    // For now, we just mark it as calculated

    return {
      success: true,
      feeAmount: attribution.feeAmount,
      invoiceId,
    };
  } catch (error) {
    console.error('Error capturing fee:', error);
    return { success: false, feeAmount: 0, error: 'Failed to capture fee' };
  }
}

/**
 * Mark fee as paid
 */
export async function markFeePaid(
  attributionId: string,
  paymentDetails?: {
    paymentId?: string;
    paymentMethod?: string;
  }
): Promise<void> {
  try {
    await sql`
      UPDATE match_attributions
      SET
        status = 'fee_captured',
        fee_paid_at = NOW(),
        updated_at = NOW()
      WHERE id = ${attributionId}
    `;

    // Update invoice
    if (paymentDetails?.paymentId) {
      await sql`
        UPDATE fee_invoices
        SET
          status = 'paid',
          payment_id = ${paymentDetails.paymentId},
          paid_at = NOW()
        WHERE attribution_id = ${attributionId}
      `;
    }

    console.log(`[Attribution] Fee marked as paid for ${attributionId}`);
  } catch (error) {
    console.error('Error marking fee paid:', error);
  }
}

// ============================================================================
// ATTRIBUTION QUERIES
// ============================================================================

async function getAttribution(id: string): Promise<MatchAttribution | null> {
  try {
    const result = await sql`
      SELECT * FROM match_attributions WHERE id = ${id}
    `;
    if (result.rows.length === 0) return null;
    return rowToAttribution(result.rows[0]);
  } catch (error) {
    console.error('Error fetching attribution:', error);
    return null;
  }
}

async function getAttributionByMatch(matchId: string): Promise<MatchAttribution | null> {
  try {
    const result = await sql`
      SELECT * FROM match_attributions WHERE match_id = ${matchId}
    `;
    if (result.rows.length === 0) return null;
    return rowToAttribution(result.rows[0]);
  } catch (error) {
    console.error('Error fetching attribution by match:', error);
    return null;
  }
}

/**
 * Get attribution statistics for a time period
 */
export async function getAttributionStats(options?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalMatches: number;
  attributedTransactions: number;
  totalTransactionValue: number;
  totalFeesEarned: number;
  feesCaptured: number;
  feesOutstanding: number;
  conversionRate: number;
  averageTransactionValue: number;
  averageFee: number;
}> {
  try {
    const startDate = options?.startDate || new Date(0);
    const endDate = options?.endDate || new Date();

    const result = await sql`
      SELECT
        COUNT(*) as total_matches,
        COUNT(*) FILTER (WHERE transaction_id IS NOT NULL) as attributed_transactions,
        COALESCE(SUM(transaction_value) FILTER (WHERE transaction_id IS NOT NULL), 0) as total_value,
        COALESCE(SUM(fee_amount) FILTER (WHERE transaction_id IS NOT NULL), 0) as total_fees,
        COALESCE(SUM(fee_amount) FILTER (WHERE status = 'fee_captured'), 0) as fees_captured,
        COALESCE(SUM(fee_amount) FILTER (WHERE status IN ('attributed', 'fee_calculated')), 0) as fees_outstanding
      FROM match_attributions
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
    `;

    const row = result.rows[0];
    const totalMatches = parseInt(row.total_matches);
    const attributedTransactions = parseInt(row.attributed_transactions);
    const totalValue = parseFloat(row.total_value);
    const totalFees = parseFloat(row.total_fees);

    return {
      totalMatches,
      attributedTransactions,
      totalTransactionValue: totalValue,
      totalFeesEarned: totalFees,
      feesCaptured: parseFloat(row.fees_captured),
      feesOutstanding: parseFloat(row.fees_outstanding),
      conversionRate: totalMatches > 0 ? (attributedTransactions / totalMatches) * 100 : 0,
      averageTransactionValue: attributedTransactions > 0 ? totalValue / attributedTransactions : 0,
      averageFee: attributedTransactions > 0 ? totalFees / attributedTransactions : 0,
    };
  } catch (error) {
    console.error('Error fetching attribution stats:', error);
    return {
      totalMatches: 0,
      attributedTransactions: 0,
      totalTransactionValue: 0,
      totalFeesEarned: 0,
      feesCaptured: 0,
      feesOutstanding: 0,
      conversionRate: 0,
      averageTransactionValue: 0,
      averageFee: 0,
    };
  }
}

/**
 * Get attributed transactions for a buyer
 */
export async function getBuyerAttributions(buyerId: string): Promise<MatchAttribution[]> {
  try {
    const result = await sql`
      SELECT * FROM match_attributions
      WHERE buyer_id = ${buyerId}
      ORDER BY created_at DESC
    `;
    return result.rows.map(rowToAttribution);
  } catch (error) {
    console.error('Error fetching buyer attributions:', error);
    return [];
  }
}

/**
 * Get attributed transactions for a supplier
 */
export async function getSupplierAttributions(supplierId: string): Promise<MatchAttribution[]> {
  try {
    const result = await sql`
      SELECT * FROM match_attributions
      WHERE supplier_id = ${supplierId}
      ORDER BY created_at DESC
    `;
    return result.rows.map(rowToAttribution);
  } catch (error) {
    console.error('Error fetching supplier attributions:', error);
    return [];
  }
}

/**
 * Get expired attributions (for cleanup)
 */
export async function getExpiredAttributions(): Promise<MatchAttribution[]> {
  try {
    const result = await sql`
      SELECT * FROM match_attributions
      WHERE status = 'pending'
        AND attribution_expires_at < NOW()
    `;
    return result.rows.map(rowToAttribution);
  } catch (error) {
    console.error('Error fetching expired attributions:', error);
    return [];
  }
}

/**
 * Mark expired attributions
 */
export async function markExpiredAttributions(): Promise<number> {
  try {
    const result = await sql`
      UPDATE match_attributions
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending'
        AND attribution_expires_at < NOW()
        AND transaction_id IS NULL
      RETURNING id
    `;

    console.log(`[Attribution] Marked ${result.rows.length} attributions as expired`);
    return result.rows.length;
  } catch (error) {
    console.error('Error marking expired attributions:', error);
    return 0;
  }
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Generate attribution report for a period
 */
export async function generateAttributionReport(options: {
  startDate: Date;
  endDate: Date;
  groupBy?: 'day' | 'week' | 'month';
}): Promise<{
  summary: Awaited<ReturnType<typeof getAttributionStats>>;
  byPeriod: Array<{
    period: string;
    matches: number;
    conversions: number;
    transactionValue: number;
    feesEarned: number;
  }>;
  topSuppliers: Array<{
    supplierId: string;
    supplierName?: string;
    transactions: number;
    totalValue: number;
    feesGenerated: number;
  }>;
  topCategories: Array<{
    category: string;
    transactions: number;
    totalValue: number;
    feesGenerated: number;
  }>;
}> {
  const summary = await getAttributionStats({
    startDate: options.startDate,
    endDate: options.endDate,
  });

  // Get period breakdown
  const periodFormat = options.groupBy === 'month'
    ? "YYYY-MM"
    : options.groupBy === 'week'
    ? "YYYY-WW"
    : "YYYY-MM-DD";

  let byPeriod: Array<{
    period: string;
    matches: number;
    conversions: number;
    transactionValue: number;
    feesEarned: number;
  }> = [];

  try {
    const periodResult = await sql`
      SELECT
        to_char(created_at, ${periodFormat}) as period,
        COUNT(*) as matches,
        COUNT(*) FILTER (WHERE transaction_id IS NOT NULL) as conversions,
        COALESCE(SUM(transaction_value), 0) as transaction_value,
        COALESCE(SUM(fee_amount), 0) as fees_earned
      FROM match_attributions
      WHERE created_at >= ${options.startDate} AND created_at <= ${options.endDate}
      GROUP BY to_char(created_at, ${periodFormat})
      ORDER BY period
    `;

    byPeriod = periodResult.rows.map(row => ({
      period: row.period,
      matches: parseInt(row.matches),
      conversions: parseInt(row.conversions),
      transactionValue: parseFloat(row.transaction_value),
      feesEarned: parseFloat(row.fees_earned),
    }));
  } catch (error) {
    console.error('Error getting period breakdown:', error);
  }

  // Get top suppliers
  let topSuppliers: Array<{
    supplierId: string;
    supplierName?: string;
    transactions: number;
    totalValue: number;
    feesGenerated: number;
  }> = [];

  try {
    const supplierResult = await sql`
      SELECT
        ma.supplier_id,
        s.company_name as supplier_name,
        COUNT(*) FILTER (WHERE ma.transaction_id IS NOT NULL) as transactions,
        COALESCE(SUM(ma.transaction_value), 0) as total_value,
        COALESCE(SUM(ma.fee_amount), 0) as fees_generated
      FROM match_attributions ma
      LEFT JOIN suppliers s ON ma.supplier_id = s.id
      WHERE ma.created_at >= ${options.startDate} AND ma.created_at <= ${options.endDate}
      GROUP BY ma.supplier_id, s.company_name
      HAVING COUNT(*) FILTER (WHERE ma.transaction_id IS NOT NULL) > 0
      ORDER BY fees_generated DESC
      LIMIT 10
    `;

    topSuppliers = supplierResult.rows.map(row => ({
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      transactions: parseInt(row.transactions),
      totalValue: parseFloat(row.total_value),
      feesGenerated: parseFloat(row.fees_generated),
    }));
  } catch (error) {
    console.error('Error getting top suppliers:', error);
  }

  // Get top categories
  let topCategories: Array<{
    category: string;
    transactions: number;
    totalValue: number;
    feesGenerated: number;
  }> = [];

  try {
    const categoryResult = await sql`
      SELECT
        sr.category,
        COUNT(*) FILTER (WHERE ma.transaction_id IS NOT NULL) as transactions,
        COALESCE(SUM(ma.transaction_value), 0) as total_value,
        COALESCE(SUM(ma.fee_amount), 0) as fees_generated
      FROM match_attributions ma
      JOIN sourcing_requests sr ON ma.request_id = sr.id
      WHERE ma.created_at >= ${options.startDate} AND ma.created_at <= ${options.endDate}
      GROUP BY sr.category
      HAVING COUNT(*) FILTER (WHERE ma.transaction_id IS NOT NULL) > 0
      ORDER BY fees_generated DESC
      LIMIT 10
    `;

    topCategories = categoryResult.rows.map(row => ({
      category: row.category,
      transactions: parseInt(row.transactions),
      totalValue: parseFloat(row.total_value),
      feesGenerated: parseFloat(row.fees_generated),
    }));
  } catch (error) {
    console.error('Error getting top categories:', error);
  }

  return {
    summary,
    byPeriod,
    topSuppliers,
    topCategories,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `attr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function rowToAttribution(row: Record<string, unknown>): MatchAttribution {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    requestId: row.request_id as string,
    supplierId: row.supplier_id as string,
    buyerId: row.buyer_id as string,
    matchedAt: new Date(row.matched_at as string),
    introducedAt: row.introduced_at ? new Date(row.introduced_at as string) : undefined,
    dealStartedAt: row.deal_started_at ? new Date(row.deal_started_at as string) : undefined,
    transactionId: row.transaction_id as string | undefined,
    transactionCompletedAt: row.transaction_completed_at
      ? new Date(row.transaction_completed_at as string)
      : undefined,
    attributionWindowDays: row.attribution_window_days as number,
    attributionExpiresAt: new Date(row.attribution_expires_at as string),
    transactionValue: row.transaction_value as number | undefined,
    feePercentage: row.fee_percentage as number,
    feeAmount: row.fee_amount as number | undefined,
    feeCurrency: row.fee_currency as string,
    status: row.status as AttributionStatus,
    feeInvoiceId: row.fee_invoice_id as string | undefined,
    feePaidAt: row.fee_paid_at ? new Date(row.fee_paid_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const AttributionSystem = {
  createAttribution,
  recordIntroductionSent,
  recordDealStarted,
  linkTransactionToMatch,
  autoAttributeTransaction,
  calculateSourcingFee,
  captureFee,
  markFeePaid,
  getAttributionStats,
  getBuyerAttributions,
  getSupplierAttributions,
  getExpiredAttributions,
  markExpiredAttributions,
  generateAttributionReport,
};

export default AttributionSystem;
