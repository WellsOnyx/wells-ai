/**
 * RFQ Award Service
 * Handles awarding quotes, creating deals, and initiating escrow
 */

import { sqlQuery as sql } from '@/lib/db';
import {
  RFQAward,
  CreateAwardInput,
  AwardResult,
  AwardStatus,
  ERPSyncStatus,
  QuoteTerms,
  RFQQuote,
} from './types';
import { getQuoteById, acceptQuote } from './quote-service';
import { getNegotiationById } from './negotiation-engine';

// ============================================================================
// AWARD CREATION
// ============================================================================

/**
 * Award a quote to a supplier
 * Creates deal, initiates escrow, and triggers ERP sync
 */
export async function awardQuote(
  input: CreateAwardInput
): Promise<AwardResult> {
  // Get the quote
  const quote = await getQuoteById(input.quoteId);
  if (!quote) throw new Error('Quote not found');

  // Get negotiation details if applicable
  let negotiation = null;
  let awardTerms: QuoteTerms;

  if (input.negotiationId) {
    negotiation = await getNegotiationById(input.negotiationId);
    if (negotiation?.finalTerms) {
      awardTerms = negotiation.finalTerms;
    } else {
      awardTerms = quoteToTerms(quote);
    }
  } else {
    awardTerms = quoteToTerms(quote);
  }

  // Accept the quote (rejects others)
  await acceptQuote(input.quoteId);

  // Create the award record
  const awardResult = await sql`
    INSERT INTO rfq_awards (
      rfq_id,
      quote_id,
      supplier_id,
      negotiation_id,
      award_amount,
      award_quantity,
      award_unit_price,
      award_terms,
      status,
      erp_sync_status
    ) VALUES (
      ${input.rfqId},
      ${input.quoteId},
      ${input.supplierId},
      ${input.negotiationId || null},
      ${awardTerms.totalPrice},
      ${awardTerms.quantity},
      ${awardTerms.unitPrice},
      ${JSON.stringify(awardTerms)},
      'pending',
      'pending'
    )
    RETURNING *
  `;

  const award = mapAwardRow(awardResult.rows[0]);

  // Create deal
  let dealResult: { id: string; status: string } | undefined;
  try {
    dealResult = await createDealFromAward(award, quote);
    if (dealResult) {
      await sql`
        UPDATE rfq_awards
        SET deal_id = ${dealResult.id}
        WHERE id = ${award.id}
      `;
      award.dealId = dealResult.id;
    }
  } catch (error) {
    console.error('Error creating deal:', error);
  }

  // Create escrow
  let escrowResult: { id: string; walletAddress: string } | undefined;
  if (dealResult) {
    try {
      escrowResult = await createEscrowFromAward(award, dealResult.id);
      if (escrowResult) {
        await sql`
          UPDATE rfq_awards
          SET escrow_id = ${escrowResult.id}
          WHERE id = ${award.id}
        `;
        award.escrowId = escrowResult.id;
      }
    } catch (error) {
      console.error('Error creating escrow:', error);
    }
  }

  // Trigger ERP sync (async, don't wait)
  triggerERPSync(award.id).catch(console.error);

  // Update RFQ status
  await sql`
    UPDATE rfqs
    SET status = 'awarded', updated_at = NOW()
    WHERE id = ${input.rfqId}
  `;

  // Create fulfillment record
  await sql`
    INSERT INTO rfq_fulfillment (award_id, rfq_id, status)
    VALUES (${award.id}, ${input.rfqId}, 'pending')
  `;

  return {
    award,
    deal: dealResult,
    escrow: escrowResult,
  };
}

/**
 * Create a deal from an award
 */
async function createDealFromAward(
  award: RFQAward,
  quote: RFQQuote
): Promise<{ id: string; status: string } | undefined> {
  // Get RFQ details for deal description
  const rfqResult = await sql`
    SELECT * FROM rfqs WHERE id = ${award.rfqId}
  `;
  const rfq = rfqResult.rows[0];
  if (!rfq) return undefined;

  // Get buyer info
  const buyerEmail = rfq.requestor_email;
  const buyerName = rfq.requestor_name || 'Buyer';

  // Get supplier info
  const supplierResult = await sql`
    SELECT * FROM suppliers WHERE id = ${award.supplierId}
  `;
  const supplier = supplierResult.rows[0];
  const supplierEmail = supplier?.contact_email;
  const supplierName = supplier?.company_name || 'Supplier';

  // Calculate platform fee (1% standard)
  const platformFee = award.awardAmount * 0.01;

  // Create deal
  const dealResult = await sql`
    INSERT INTO deals (
      category,
      description,
      amount,
      platform_fee,
      status,
      buyer_id,
      buyer_email,
      seller_id,
      seller_email,
      rfq_id,
      metadata
    ) VALUES (
      ${rfq.category},
      ${`RFQ Award: ${rfq.description} - ${award.awardQuantity} units from ${supplierName}`},
      ${award.awardAmount},
      ${platformFee},
      'proposed',
      ${buyerEmail},
      ${buyerEmail},
      ${supplierEmail},
      ${supplierEmail},
      ${award.rfqId},
      ${JSON.stringify({
        rfqId: award.rfqId,
        awardId: award.id,
        quoteId: award.quoteId,
        quantity: award.awardQuantity,
        unitPrice: award.awardUnitPrice,
        terms: award.awardTerms,
      })}
    )
    RETURNING id, status
  `;

  if (dealResult.rows.length === 0) return undefined;

  return {
    id: dealResult.rows[0].id,
    status: dealResult.rows[0].status,
  };
}

/**
 * Create escrow from award
 */
async function createEscrowFromAward(
  award: RFQAward,
  dealId: string
): Promise<{ id: string; walletAddress: string } | undefined> {
  // Check if escrow service is available
  try {
    // Import dynamically to avoid circular dependencies
    const { createEscrow } = await import('@/lib/escrow/escrow-service');

    const rfqResult = await sql`SELECT * FROM rfqs WHERE id = ${award.rfqId}`;
    const rfq = rfqResult.rows[0];

    const supplierResult = await sql`SELECT * FROM suppliers WHERE id = ${award.supplierId}`;
    const supplier = supplierResult.rows[0];

    const platformFee = award.awardAmount * 0.01;

    const escrow = await createEscrow({
      dealId,
      buyerId: rfq?.requestor_email || '',
      buyerEmail: rfq?.requestor_email || '',
      sellerId: supplier?.contact_email || '',
      sellerEmail: supplier?.contact_email || '',
      amount: award.awardAmount,
      platformFee,
      description: `RFQ ${award.rfqId} - ${award.awardQuantity} units`,
      metadata: {
        rfqId: award.rfqId,
        awardId: award.id,
      },
    });

    return {
      id: escrow.id,
      walletAddress: escrow.escrowWalletAddress || '',
    };
  } catch (error) {
    console.error('Escrow creation failed:', error);
    return undefined;
  }
}

// ============================================================================
// ERP SYNC
// ============================================================================

/**
 * Trigger ERP sync for an award (creates PO)
 */
async function triggerERPSync(awardId: string): Promise<void> {
  const award = await getAwardById(awardId);
  if (!award) return;

  // Get RFQ details
  const rfqResult = await sql`
    SELECT r.*, c.erp_connection_id
    FROM rfqs r
    LEFT JOIN companies c ON r.requestor_email = c.primary_email
    WHERE r.id = ${award.rfqId}
  `;
  const rfq = rfqResult.rows[0];

  // Check if buyer has ERP connection
  if (!rfq?.erp_connection_id) {
    await sql`
      UPDATE rfq_awards
      SET erp_sync_status = 'not_connected'
      WHERE id = ${awardId}
    `;
    return;
  }

  // Update status to syncing
  await sql`
    UPDATE rfq_awards
    SET erp_sync_status = 'syncing', erp_connection_id = ${rfq.erp_connection_id}
    WHERE id = ${awardId}
  `;

  try {
    // Import ERP sync dynamically
    const { syncAwardToERP } = await import('./erp-sync');
    const result = await syncAwardToERP(awardId);

    await sql`
      UPDATE rfq_awards
      SET
        erp_sync_status = 'synced',
        erp_po_id = ${result.poId || null},
        erp_po_number = ${result.poNumber || null},
        erp_po_created_at = NOW(),
        erp_vendor_id = ${result.vendorId || null}
      WHERE id = ${awardId}
    `;
  } catch (error: any) {
    await sql`
      UPDATE rfq_awards
      SET
        erp_sync_status = 'failed',
        erp_sync_error = ${error.message || 'Unknown error'}
      WHERE id = ${awardId}
    `;
  }
}

// ============================================================================
// AWARD LIFECYCLE
// ============================================================================

/**
 * Supplier acknowledges the award
 */
export async function acknowledgeAward(awardId: string): Promise<RFQAward> {
  const result = await sql`
    UPDATE rfq_awards
    SET
      status = 'acknowledged',
      supplier_acknowledged_at = NOW()
    WHERE id = ${awardId}
    RETURNING *
  `;

  return mapAwardRow(result.rows[0]);
}

/**
 * Mark payment as initiated
 */
export async function initiatePayment(awardId: string): Promise<RFQAward> {
  const result = await sql`
    UPDATE rfq_awards
    SET
      status = 'payment_pending',
      payment_initiated_at = NOW()
    WHERE id = ${awardId}
    RETURNING *
  `;

  // Update RFQ status
  const award = mapAwardRow(result.rows[0]);
  await sql`
    UPDATE rfqs
    SET status = 'payment_pending', updated_at = NOW()
    WHERE id = ${award.rfqId}
  `;

  return award;
}

/**
 * Mark payment as completed
 */
export async function completePayment(awardId: string): Promise<RFQAward> {
  const result = await sql`
    UPDATE rfq_awards
    SET
      status = 'paid',
      payment_completed_at = NOW()
    WHERE id = ${awardId}
    RETURNING *
  `;

  // Update RFQ status
  const award = mapAwardRow(result.rows[0]);
  await sql`
    UPDATE rfqs
    SET status = 'paid', updated_at = NOW()
    WHERE id = ${award.rfqId}
  `;

  return award;
}

/**
 * Mark as fulfilled (delivery complete)
 */
export async function markFulfilled(awardId: string): Promise<RFQAward> {
  const result = await sql`
    UPDATE rfq_awards
    SET status = 'fulfilled'
    WHERE id = ${awardId}
    RETURNING *
  `;

  // Update RFQ status
  const award = mapAwardRow(result.rows[0]);
  await sql`
    UPDATE rfqs
    SET status = 'delivered', updated_at = NOW()
    WHERE id = ${award.rfqId}
  `;

  return award;
}

/**
 * Complete the award (final state)
 */
export async function completeAward(awardId: string): Promise<RFQAward> {
  const result = await sql`
    UPDATE rfq_awards
    SET status = 'completed'
    WHERE id = ${awardId}
    RETURNING *
  `;

  // Update RFQ status
  const award = mapAwardRow(result.rows[0]);
  await sql`
    UPDATE rfqs
    SET status = 'completed', updated_at = NOW()
    WHERE id = ${award.rfqId}
  `;

  return award;
}

/**
 * Cancel an award
 */
export async function cancelAward(
  awardId: string,
  reason: string
): Promise<RFQAward> {
  const result = await sql`
    UPDATE rfq_awards
    SET status = 'cancelled'
    WHERE id = ${awardId}
    RETURNING *
  `;

  const award = mapAwardRow(result.rows[0]);

  // Update RFQ status back to quoted
  await sql`
    UPDATE rfqs
    SET status = 'quoted', updated_at = NOW()
    WHERE id = ${award.rfqId}
  `;

  // Re-open the quote
  await sql`
    UPDATE rfq_quotes
    SET status = 'active', updated_at = NOW()
    WHERE id = ${award.quoteId}
  `;

  return award;
}

// ============================================================================
// AWARD QUERIES
// ============================================================================

/**
 * Get award by ID
 */
export async function getAwardById(awardId: string): Promise<RFQAward | null> {
  const result = await sql`
    SELECT * FROM rfq_awards
    WHERE id = ${awardId}
  `;

  if (result.rows.length === 0) return null;
  return mapAwardRow(result.rows[0]);
}

/**
 * Get award by RFQ ID
 */
export async function getAwardByRFQ(rfqId: string): Promise<RFQAward | null> {
  const result = await sql`
    SELECT * FROM rfq_awards
    WHERE rfq_id = ${rfqId}
    AND status != 'cancelled'
    ORDER BY awarded_at DESC
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;
  return mapAwardRow(result.rows[0]);
}

/**
 * Get award by deal ID
 */
export async function getAwardByDeal(dealId: string): Promise<RFQAward | null> {
  const result = await sql`
    SELECT * FROM rfq_awards
    WHERE deal_id = ${dealId}
  `;

  if (result.rows.length === 0) return null;
  return mapAwardRow(result.rows[0]);
}

/**
 * Get all awards for a supplier
 */
export async function getAwardsBySupplier(
  supplierId: string,
  status?: AwardStatus
): Promise<RFQAward[]> {
  let result;
  if (status) {
    result = await sql`
      SELECT * FROM rfq_awards
      WHERE supplier_id = ${supplierId}
      AND status = ${status}
      ORDER BY awarded_at DESC
    `;
  } else {
    result = await sql`
      SELECT * FROM rfq_awards
      WHERE supplier_id = ${supplierId}
      ORDER BY awarded_at DESC
    `;
  }

  return result.rows.map(mapAwardRow);
}

/**
 * Get pending awards needing action
 */
export async function getPendingAwards(): Promise<RFQAward[]> {
  const result = await sql`
    SELECT * FROM rfq_awards
    WHERE status IN ('pending', 'acknowledged', 'payment_pending')
    ORDER BY awarded_at ASC
  `;

  return result.rows.map(mapAwardRow);
}

// ============================================================================
// HELPERS
// ============================================================================

function quoteToTerms(quote: RFQQuote): QuoteTerms {
  return {
    unitPrice: quote.unitPrice,
    quantity: quote.quantity,
    totalPrice: quote.totalPrice,
    leadTimeDays: quote.leadTimeDays,
    paymentTerms: quote.paymentTerms || 'Net 30',
    warrantyMonths: quote.warrantyMonths,
    shippingCost: quote.shippingCost,
  };
}

function mapAwardRow(row: any): RFQAward {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    quoteId: row.quote_id,
    supplierId: row.supplier_id,
    negotiationId: row.negotiation_id,
    awardAmount: parseFloat(row.award_amount),
    awardQuantity: row.award_quantity,
    awardUnitPrice: parseFloat(row.award_unit_price),
    awardTerms: row.award_terms,
    dealId: row.deal_id,
    escrowId: row.escrow_id,
    erpConnectionId: row.erp_connection_id,
    erpPoId: row.erp_po_id,
    erpPoNumber: row.erp_po_number,
    erpPoCreatedAt: row.erp_po_created_at ? new Date(row.erp_po_created_at) : undefined,
    erpVendorId: row.erp_vendor_id,
    erpSyncStatus: row.erp_sync_status as ERPSyncStatus,
    erpSyncError: row.erp_sync_error,
    status: row.status as AwardStatus,
    awardedAt: new Date(row.awarded_at),
    supplierAcknowledgedAt: row.supplier_acknowledged_at ? new Date(row.supplier_acknowledged_at) : undefined,
    paymentInitiatedAt: row.payment_initiated_at ? new Date(row.payment_initiated_at) : undefined,
    paymentCompletedAt: row.payment_completed_at ? new Date(row.payment_completed_at) : undefined,
  };
}
