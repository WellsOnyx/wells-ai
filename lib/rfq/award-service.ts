/**
 * RFQ Award Service
 *
 * Handles the award process when a buyer accepts a quote:
 * 1. Create award record - Store award details, link quote and RFQ
 * 2. Create deal and escrow - Create a deal record and escrow for payment
 * 3. Notify supplier - Mark award as created
 * 4. Supplier acknowledgment - Supplier confirms the award
 * 5. Link to ERP - Prepare for PO creation
 * 6. Get award status - Track award lifecycle
 *
 * @module lib/rfq/award-service
 */

import { sql } from '@vercel/postgres';
import {
  RFQAward,
  RFQAwardRow,
  CreateAwardInput,
  AwardResult,
  AwardStatus,
  ERPSyncStatus,
  QuoteTerms,
  RFQQuote,
  RFQQuoteRow,
} from './types';

// ============================================================================
// LOGGING HELPER
// ============================================================================

const LOG_PREFIX = '[Award Service]';

function log(message: string, data?: Record<string, unknown>): void {
  console.log(`${LOG_PREFIX} ${message}`, data ? JSON.stringify(data) : '');
}

function logError(message: string, error: unknown): void {
  console.error(`${LOG_PREFIX} ERROR: ${message}`, error);
}

// ============================================================================
// TYPE MAPPERS
// ============================================================================

/**
 * Convert database row to RFQAward interface
 */
function mapAwardRow(row: RFQAwardRow): RFQAward {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    quoteId: row.quote_id,
    supplierId: row.supplier_id,
    negotiationId: row.negotiation_id || undefined,
    awardAmount: parseFloat(row.award_amount),
    awardQuantity: row.award_quantity,
    awardUnitPrice: parseFloat(row.award_unit_price),
    awardTerms: row.award_terms,
    dealId: row.deal_id || undefined,
    escrowId: row.escrow_id || undefined,
    erpConnectionId: row.erp_connection_id || undefined,
    erpPoId: row.erp_po_id || undefined,
    erpPoNumber: row.erp_po_number || undefined,
    erpPoCreatedAt: row.erp_po_created_at ? new Date(row.erp_po_created_at) : undefined,
    erpVendorId: row.erp_vendor_id || undefined,
    erpSyncStatus: row.erp_sync_status,
    erpSyncError: row.erp_sync_error || undefined,
    status: row.status,
    awardedAt: new Date(row.awarded_at),
    supplierAcknowledgedAt: row.supplier_acknowledged_at
      ? new Date(row.supplier_acknowledged_at)
      : undefined,
    paymentInitiatedAt: row.payment_initiated_at
      ? new Date(row.payment_initiated_at)
      : undefined,
    paymentCompletedAt: row.payment_completed_at
      ? new Date(row.payment_completed_at)
      : undefined,
  };
}

/**
 * Convert RFQQuote to QuoteTerms for award
 */
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

/**
 * Map quote row to RFQQuote interface
 */
function mapQuoteRow(row: RFQQuoteRow): RFQQuote {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    supplierId: row.supplier_id,
    unitPrice: parseFloat(row.unit_price),
    quantity: row.quantity,
    totalPrice: parseFloat(row.total_price),
    currency: row.currency,
    leadTimeDays: row.lead_time_days,
    paymentTerms: row.payment_terms || undefined,
    warrantyMonths: row.warranty_months || undefined,
    shippingCost: parseFloat(row.shipping_cost),
    shippingMethod: row.shipping_method || undefined,
    validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
    notes: row.notes || undefined,
    lineItems: row.line_items || [],
    aiGenerated: row.ai_generated,
    aiConfidenceScore: row.ai_confidence_score
      ? parseFloat(row.ai_confidence_score)
      : undefined,
    sourceCatalogId: row.source_catalog_id || undefined,
    isInitialQuote: row.is_initial_quote,
    parentQuoteId: row.parent_quote_id || undefined,
    negotiationRound: row.negotiation_round,
    status: row.status,
    supplierConfirmed: row.supplier_confirmed,
    supplierConfirmedAt: row.supplier_confirmed_at
      ? new Date(row.supplier_confirmed_at)
      : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================================
// QUOTE HELPERS
// ============================================================================

/**
 * Get quote by ID
 */
async function getQuoteById(quoteId: string): Promise<RFQQuote | null> {
  try {
    const result = await sql`
      SELECT * FROM rfq_quotes WHERE id = ${quoteId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapQuoteRow(result.rows[0] as RFQQuoteRow);
  } catch (error) {
    logError(`Failed to get quote ${quoteId}`, error);
    throw error;
  }
}

/**
 * Accept a quote (mark as accepted, reject others for same RFQ)
 */
async function acceptQuote(quoteId: string): Promise<void> {
  try {
    // Get the quote to find RFQ ID
    const quoteResult = await sql`
      SELECT rfq_id FROM rfq_quotes WHERE id = ${quoteId}
    `;

    if (quoteResult.rows.length === 0) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    const rfqId = quoteResult.rows[0].rfq_id;

    // Accept this quote
    await sql`
      UPDATE rfq_quotes
      SET status = 'accepted', updated_at = NOW()
      WHERE id = ${quoteId}
    `;

    // Reject other quotes for same RFQ
    await sql`
      UPDATE rfq_quotes
      SET status = 'rejected', updated_at = NOW()
      WHERE rfq_id = ${rfqId}
      AND id != ${quoteId}
      AND status NOT IN ('rejected', 'expired', 'withdrawn')
    `;

    log(`Quote ${quoteId} accepted, others rejected for RFQ ${rfqId}`);
  } catch (error) {
    logError(`Failed to accept quote ${quoteId}`, error);
    throw error;
  }
}

/**
 * Get negotiation by ID
 */
async function getNegotiationById(negotiationId: string): Promise<{ finalTerms?: QuoteTerms } | null> {
  try {
    const result = await sql`
      SELECT final_terms FROM rfq_negotiations WHERE id = ${negotiationId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return {
      finalTerms: result.rows[0].final_terms || undefined,
    };
  } catch (error) {
    logError(`Failed to get negotiation ${negotiationId}`, error);
    return null;
  }
}

// ============================================================================
// 1. CREATE AWARD RECORD
// ============================================================================

/**
 * Award a quote to a supplier
 * Creates the award record, deal, escrow, and triggers ERP sync
 */
export async function awardQuote(input: CreateAwardInput): Promise<AwardResult> {
  log('Creating award', { rfqId: input.rfqId, quoteId: input.quoteId });

  try {
    // Get the quote
    const quote = await getQuoteById(input.quoteId);
    if (!quote) {
      throw new Error(`Quote ${input.quoteId} not found`);
    }

    // Determine award terms (from negotiation if exists, otherwise from quote)
    let awardTerms: QuoteTerms;

    if (input.negotiationId) {
      const negotiation = await getNegotiationById(input.negotiationId);
      if (negotiation?.finalTerms) {
        awardTerms = negotiation.finalTerms;
        log('Using negotiated terms', { negotiationId: input.negotiationId });
      } else {
        awardTerms = quoteToTerms(quote);
        log('Negotiation found but no final terms, using quote terms');
      }
    } else {
      awardTerms = quoteToTerms(quote);
      log('Using original quote terms');
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

    const award = mapAwardRow(awardResult.rows[0] as RFQAwardRow);
    log('Award record created', { awardId: award.id });

    // Create deal and escrow
    let dealResult: { id: string; status: string } | undefined;
    let escrowResult: { id: string; walletAddress: string } | undefined;

    try {
      dealResult = await createDealFromAward(award, quote);
      if (dealResult) {
        await sql`
          UPDATE rfq_awards
          SET deal_id = ${dealResult.id}
          WHERE id = ${award.id}
        `;
        award.dealId = dealResult.id;
        log('Deal created and linked', { dealId: dealResult.id });
      }
    } catch (error) {
      logError('Failed to create deal', error);
    }

    // Create escrow if deal was created
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
          log('Escrow created and linked', { escrowId: escrowResult.id });
        }
      } catch (error) {
        logError('Failed to create escrow', error);
      }
    }

    // Update RFQ status to awarded
    await sql`
      UPDATE rfqs
      SET status = 'awarded', updated_at = NOW()
      WHERE id = ${input.rfqId}
    `;
    log('RFQ status updated to awarded', { rfqId: input.rfqId });

    // Create fulfillment record for tracking
    await sql`
      INSERT INTO rfq_fulfillment (award_id, rfq_id, status)
      VALUES (${award.id}, ${input.rfqId}, 'pending')
    `;
    log('Fulfillment record created');

    // Trigger ERP sync asynchronously
    triggerERPSync(award.id).catch((error) => {
      logError('Background ERP sync failed', error);
    });

    return {
      award,
      deal: dealResult,
      escrow: escrowResult,
    };
  } catch (error) {
    logError('Failed to create award', error);
    throw error;
  }
}

// ============================================================================
// 2. CREATE DEAL AND ESCROW
// ============================================================================

/**
 * Create a deal from an award
 */
async function createDealFromAward(
  award: RFQAward,
  quote: RFQQuote
): Promise<{ id: string; status: string } | undefined> {
  log('Creating deal from award', { awardId: award.id });

  try {
    // Get RFQ details for deal description
    const rfqResult = await sql`
      SELECT * FROM rfqs WHERE id = ${award.rfqId}
    `;
    const rfq = rfqResult.rows[0];
    if (!rfq) {
      log('RFQ not found, skipping deal creation');
      return undefined;
    }

    const buyerEmail = rfq.requestor_email || '';
    const buyerName = rfq.requestor_name || 'Buyer';

    // Get supplier info
    const supplierResult = await sql`
      SELECT * FROM suppliers WHERE id = ${award.supplierId}
    `;
    const supplier = supplierResult.rows[0];
    const supplierEmail = supplier?.contact_email || '';
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
        ${rfq.category || 'general'},
        ${`RFQ Award: ${rfq.description || 'Purchase'} - ${award.awardQuantity} units from ${supplierName}`},
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

    if (dealResult.rows.length === 0) {
      return undefined;
    }

    return {
      id: dealResult.rows[0].id,
      status: dealResult.rows[0].status,
    };
  } catch (error) {
    logError('Failed to create deal from award', error);
    throw error;
  }
}

/**
 * Create escrow from award
 */
async function createEscrowFromAward(
  award: RFQAward,
  dealId: string
): Promise<{ id: string; walletAddress: string } | undefined> {
  log('Creating escrow from award', { awardId: award.id, dealId });

  try {
    // Import escrow service dynamically to avoid circular dependencies
    const { createEscrow } = await import('@/lib/escrow/escrow-service');

    // Get RFQ and supplier details
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

    log('Escrow created successfully', { escrowId: escrow.id });

    return {
      id: escrow.id,
      walletAddress: escrow.escrowWalletAddress || '',
    };
  } catch (error) {
    logError('Escrow creation failed', error);
    return undefined;
  }
}

// ============================================================================
// 3. NOTIFY SUPPLIER (Mark award as created)
// ============================================================================

/**
 * Notify supplier of award (updates status to indicate notification sent)
 * In production, this would also send email/SMS notifications
 */
export async function notifySupplierOfAward(awardId: string): Promise<RFQAward> {
  log('Notifying supplier of award', { awardId });

  try {
    const award = await getAwardById(awardId);
    if (!award) {
      throw new Error(`Award ${awardId} not found`);
    }

    // In production, send notifications here (email, SMS, webhook)
    // For now, we just log that notification was triggered
    log('Supplier notification triggered', {
      awardId,
      supplierId: award.supplierId,
      amount: award.awardAmount,
    });

    return award;
  } catch (error) {
    logError('Failed to notify supplier', error);
    throw error;
  }
}

// ============================================================================
// 4. SUPPLIER ACKNOWLEDGMENT
// ============================================================================

/**
 * Supplier acknowledges the award
 */
export async function acknowledgeAward(awardId: string): Promise<RFQAward> {
  log('Supplier acknowledging award', { awardId });

  try {
    const result = await sql`
      UPDATE rfq_awards
      SET
        status = 'acknowledged',
        supplier_acknowledged_at = NOW()
      WHERE id = ${awardId}
      AND status = 'pending'
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new Error(`Award ${awardId} not found or not in pending status`);
    }

    const award = mapAwardRow(result.rows[0] as RFQAwardRow);
    log('Award acknowledged', { awardId, acknowledgedAt: award.supplierAcknowledgedAt });

    return award;
  } catch (error) {
    logError('Failed to acknowledge award', error);
    throw error;
  }
}

// ============================================================================
// 5. LINK TO ERP (Prepare for PO creation)
// ============================================================================

/**
 * Trigger ERP sync for an award (creates PO in connected ERP system)
 */
async function triggerERPSync(awardId: string): Promise<void> {
  log('Triggering ERP sync', { awardId });

  try {
    const award = await getAwardById(awardId);
    if (!award) {
      log('Award not found, skipping ERP sync', { awardId });
      return;
    }

    // Get RFQ details and check for ERP connection
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
      log('No ERP connection, skipping sync', { awardId });
      return;
    }

    // Update status to syncing
    await sql`
      UPDATE rfq_awards
      SET erp_sync_status = 'syncing', erp_connection_id = ${rfq.erp_connection_id}
      WHERE id = ${awardId}
    `;
    log('ERP sync started', { awardId, connectionId: rfq.erp_connection_id });

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
      log('ERP sync completed', { awardId, poNumber: result.poNumber });
    } catch (syncError: unknown) {
      const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown error';
      await sql`
        UPDATE rfq_awards
        SET
          erp_sync_status = 'failed',
          erp_sync_error = ${errorMessage}
        WHERE id = ${awardId}
      `;
      logError('ERP sync failed', syncError);
    }
  } catch (error) {
    logError('Failed to trigger ERP sync', error);
  }
}

/**
 * Manually retry ERP sync for a failed award
 */
export async function retryERPSync(awardId: string): Promise<RFQAward> {
  log('Retrying ERP sync', { awardId });

  await triggerERPSync(awardId);
  const award = await getAwardById(awardId);

  if (!award) {
    throw new Error(`Award ${awardId} not found`);
  }

  return award;
}

/**
 * Link award to an ERP PO manually
 */
export async function linkAwardToERP(
  awardId: string,
  erpData: {
    poId: string;
    poNumber: string;
    vendorId?: string;
  }
): Promise<RFQAward> {
  log('Manually linking award to ERP', { awardId, ...erpData });

  try {
    const result = await sql`
      UPDATE rfq_awards
      SET
        erp_sync_status = 'synced',
        erp_po_id = ${erpData.poId},
        erp_po_number = ${erpData.poNumber},
        erp_vendor_id = ${erpData.vendorId || null},
        erp_po_created_at = NOW()
      WHERE id = ${awardId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new Error(`Award ${awardId} not found`);
    }

    const award = mapAwardRow(result.rows[0] as RFQAwardRow);
    log('Award linked to ERP', { awardId, poNumber: erpData.poNumber });

    return award;
  } catch (error) {
    logError('Failed to link award to ERP', error);
    throw error;
  }
}

// ============================================================================
// 6. GET AWARD STATUS (Track award lifecycle)
// ============================================================================

/**
 * Get award by ID
 */
export async function getAwardById(awardId: string): Promise<RFQAward | null> {
  try {
    const result = await sql`
      SELECT * FROM rfq_awards WHERE id = ${awardId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapAwardRow(result.rows[0] as RFQAwardRow);
  } catch (error) {
    logError(`Failed to get award ${awardId}`, error);
    throw error;
  }
}

/**
 * Get award by RFQ ID
 */
export async function getAwardByRFQ(rfqId: string): Promise<RFQAward | null> {
  try {
    const result = await sql`
      SELECT * FROM rfq_awards
      WHERE rfq_id = ${rfqId}
      AND status != 'cancelled'
      ORDER BY awarded_at DESC
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapAwardRow(result.rows[0] as RFQAwardRow);
  } catch (error) {
    logError(`Failed to get award for RFQ ${rfqId}`, error);
    throw error;
  }
}

/**
 * Get award by deal ID
 */
export async function getAwardByDeal(dealId: string): Promise<RFQAward | null> {
  try {
    const result = await sql`
      SELECT * FROM rfq_awards WHERE deal_id = ${dealId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapAwardRow(result.rows[0] as RFQAwardRow);
  } catch (error) {
    logError(`Failed to get award for deal ${dealId}`, error);
    throw error;
  }
}

/**
 * Get all awards for a supplier
 */
export async function getAwardsBySupplier(
  supplierId: string,
  status?: AwardStatus
): Promise<RFQAward[]> {
  try {
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

    return result.rows.map((row) => mapAwardRow(row as RFQAwardRow));
  } catch (error) {
    logError(`Failed to get awards for supplier ${supplierId}`, error);
    throw error;
  }
}

/**
 * Get pending awards needing action
 */
export async function getPendingAwards(): Promise<RFQAward[]> {
  try {
    const result = await sql`
      SELECT * FROM rfq_awards
      WHERE status IN ('pending', 'acknowledged', 'payment_pending')
      ORDER BY awarded_at ASC
    `;

    return result.rows.map((row) => mapAwardRow(row as RFQAwardRow));
  } catch (error) {
    logError('Failed to get pending awards', error);
    throw error;
  }
}

/**
 * Get complete award status with related data
 */
export async function getAwardStatus(awardId: string): Promise<{
  award: RFQAward;
  rfq: { id: string; status: string; description: string } | null;
  fulfillment: { id: string; status: string } | null;
  deal: { id: string; status: string } | null;
  escrow: { id: string; status: string } | null;
}> {
  log('Getting complete award status', { awardId });

  try {
    const award = await getAwardById(awardId);
    if (!award) {
      throw new Error(`Award ${awardId} not found`);
    }

    // Get RFQ status
    const rfqResult = await sql`
      SELECT id, status, description FROM rfqs WHERE id = ${award.rfqId}
    `;
    const rfq = rfqResult.rows[0] || null;

    // Get fulfillment status
    const fulfillmentResult = await sql`
      SELECT id, status FROM rfq_fulfillment WHERE award_id = ${awardId}
    `;
    const fulfillment = fulfillmentResult.rows[0] || null;

    // Get deal status if linked
    let deal = null;
    if (award.dealId) {
      const dealResult = await sql`
        SELECT id, status FROM deals WHERE id = ${award.dealId}
      `;
      deal = dealResult.rows[0] || null;
    }

    // Get escrow status if linked
    let escrow = null;
    if (award.escrowId) {
      const escrowResult = await sql`
        SELECT id, status FROM escrow_deals WHERE id = ${award.escrowId}
      `;
      escrow = escrowResult.rows[0] || null;
    }

    return {
      award,
      rfq,
      fulfillment,
      deal,
      escrow,
    };
  } catch (error) {
    logError('Failed to get award status', error);
    throw error;
  }
}

// ============================================================================
// AWARD LIFECYCLE MANAGEMENT
// ============================================================================

/**
 * Mark payment as initiated
 */
export async function initiatePayment(awardId: string): Promise<RFQAward> {
  log('Initiating payment for award', { awardId });

  try {
    const result = await sql`
      UPDATE rfq_awards
      SET
        status = 'payment_pending',
        payment_initiated_at = NOW()
      WHERE id = ${awardId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new Error(`Award ${awardId} not found`);
    }

    const award = mapAwardRow(result.rows[0] as RFQAwardRow);

    // Update RFQ status
    await sql`
      UPDATE rfqs
      SET status = 'payment_pending', updated_at = NOW()
      WHERE id = ${award.rfqId}
    `;

    log('Payment initiated', { awardId });
    return award;
  } catch (error) {
    logError('Failed to initiate payment', error);
    throw error;
  }
}

/**
 * Mark payment as completed
 */
export async function completePayment(awardId: string): Promise<RFQAward> {
  log('Completing payment for award', { awardId });

  try {
    const result = await sql`
      UPDATE rfq_awards
      SET
        status = 'paid',
        payment_completed_at = NOW()
      WHERE id = ${awardId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new Error(`Award ${awardId} not found`);
    }

    const award = mapAwardRow(result.rows[0] as RFQAwardRow);

    // Update RFQ status
    await sql`
      UPDATE rfqs
      SET status = 'paid', updated_at = NOW()
      WHERE id = ${award.rfqId}
    `;

    log('Payment completed', { awardId });
    return award;
  } catch (error) {
    logError('Failed to complete payment', error);
    throw error;
  }
}

/**
 * Mark as fulfilled (delivery complete)
 */
export async function markFulfilled(awardId: string): Promise<RFQAward> {
  log('Marking award as fulfilled', { awardId });

  try {
    const result = await sql`
      UPDATE rfq_awards
      SET status = 'fulfilled'
      WHERE id = ${awardId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new Error(`Award ${awardId} not found`);
    }

    const award = mapAwardRow(result.rows[0] as RFQAwardRow);

    // Update RFQ status
    await sql`
      UPDATE rfqs
      SET status = 'delivered', updated_at = NOW()
      WHERE id = ${award.rfqId}
    `;

    log('Award marked as fulfilled', { awardId });
    return award;
  } catch (error) {
    logError('Failed to mark award as fulfilled', error);
    throw error;
  }
}

/**
 * Complete the award (final state)
 */
export async function completeAward(awardId: string): Promise<RFQAward> {
  log('Completing award', { awardId });

  try {
    const result = await sql`
      UPDATE rfq_awards
      SET status = 'completed'
      WHERE id = ${awardId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new Error(`Award ${awardId} not found`);
    }

    const award = mapAwardRow(result.rows[0] as RFQAwardRow);

    // Update RFQ status
    await sql`
      UPDATE rfqs
      SET status = 'completed', updated_at = NOW()
      WHERE id = ${award.rfqId}
    `;

    log('Award completed', { awardId });
    return award;
  } catch (error) {
    logError('Failed to complete award', error);
    throw error;
  }
}

/**
 * Cancel an award
 */
export async function cancelAward(
  awardId: string,
  reason: string
): Promise<RFQAward> {
  log('Cancelling award', { awardId, reason });

  try {
    const result = await sql`
      UPDATE rfq_awards
      SET status = 'cancelled'
      WHERE id = ${awardId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new Error(`Award ${awardId} not found`);
    }

    const award = mapAwardRow(result.rows[0] as RFQAwardRow);

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

    log('Award cancelled', { awardId, reason });
    return award;
  } catch (error) {
    logError('Failed to cancel award', error);
    throw error;
  }
}

/**
 * Mark award as disputed
 */
export async function disputeAward(
  awardId: string,
  reason: string
): Promise<RFQAward> {
  log('Disputing award', { awardId, reason });

  try {
    const result = await sql`
      UPDATE rfq_awards
      SET status = 'disputed'
      WHERE id = ${awardId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new Error(`Award ${awardId} not found`);
    }

    const award = mapAwardRow(result.rows[0] as RFQAwardRow);
    log('Award disputed', { awardId, reason });

    return award;
  } catch (error) {
    logError('Failed to dispute award', error);
    throw error;
  }
}
