/**
 * RFQ Fulfillment Tracker
 * Tracks delivery status and triggers payment release
 */

import { sqlQuery as sql } from '@/lib/db';
import {
  RFQFulfillment,
  FulfillmentStatus,
  UpdateFulfillmentInput,
  ConfirmDeliveryInput,
} from './types';
import { markFulfilled, completeAward, getAwardById } from './award-service';
import { syncFulfillmentToERP, syncReceiptToERP } from './erp-sync';

// ============================================================================
// FULFILLMENT CRUD
// ============================================================================

/**
 * Get fulfillment by award ID
 */
export async function getFulfillmentByAward(
  awardId: string
): Promise<RFQFulfillment | null> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE award_id = ${awardId}
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;
  return mapFulfillmentRow(result.rows[0]);
}

/**
 * Get fulfillment by RFQ ID
 */
export async function getFulfillmentByRFQ(
  rfqId: string
): Promise<RFQFulfillment | null> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE rfq_id = ${rfqId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;
  return mapFulfillmentRow(result.rows[0]);
}

/**
 * Update fulfillment details
 */
export async function updateFulfillment(
  awardId: string,
  input: UpdateFulfillmentInput
): Promise<RFQFulfillment> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(input.status);
  }
  if (input.carrier !== undefined) {
    updates.push(`carrier = $${paramIndex++}`);
    values.push(input.carrier);
  }
  if (input.trackingNumber !== undefined) {
    updates.push(`tracking_number = $${paramIndex++}`);
    values.push(input.trackingNumber);
  }
  if (input.trackingUrl !== undefined) {
    updates.push(`tracking_url = $${paramIndex++}`);
    values.push(input.trackingUrl);
  }
  if (input.estimatedShipDate !== undefined) {
    updates.push(`estimated_ship_date = $${paramIndex++}`);
    values.push(new Date(input.estimatedShipDate));
  }
  if (input.actualShipDate !== undefined) {
    updates.push(`actual_ship_date = $${paramIndex++}`);
    values.push(new Date(input.actualShipDate));
  }
  if (input.estimatedDeliveryDate !== undefined) {
    updates.push(`estimated_delivery_date = $${paramIndex++}`);
    values.push(new Date(input.estimatedDeliveryDate));
  }
  if (input.actualDeliveryDate !== undefined) {
    updates.push(`actual_delivery_date = $${paramIndex++}`);
    values.push(new Date(input.actualDeliveryDate));
  }

  updates.push('updated_at = NOW()');

  const result = await sql`
    UPDATE rfq_fulfillment
    SET ${sql.unsafe(updates.join(', '))}
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  // Update RFQ status based on fulfillment status
  const fulfillment = mapFulfillmentRow(result.rows[0]);
  await updateRFQStatusFromFulfillment(fulfillment);

  return fulfillment;
}

/**
 * Mark order as shipped
 */
export async function markShipped(
  awardId: string,
  shippingDetails: {
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string;
    estimatedDeliveryDate?: string;
  }
): Promise<RFQFulfillment> {
  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      status = 'shipped',
      carrier = ${shippingDetails.carrier},
      tracking_number = ${shippingDetails.trackingNumber},
      tracking_url = ${shippingDetails.trackingUrl || null},
      actual_ship_date = NOW(),
      estimated_delivery_date = ${shippingDetails.estimatedDeliveryDate ? new Date(shippingDetails.estimatedDeliveryDate) : null},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  const fulfillment = mapFulfillmentRow(result.rows[0]);

  // Update RFQ status
  await sql`
    UPDATE rfqs
    SET status = 'fulfilling', updated_at = NOW()
    WHERE id = ${fulfillment.rfqId}
  `;

  return fulfillment;
}

/**
 * Update tracking status (e.g., from carrier webhook)
 */
export async function updateTrackingStatus(
  trackingNumber: string,
  status: FulfillmentStatus,
  details?: {
    location?: string;
    timestamp?: Date;
  }
): Promise<RFQFulfillment | null> {
  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      status = ${status},
      updated_at = NOW()
    WHERE tracking_number = ${trackingNumber}
    RETURNING *
  `;

  if (result.rows.length === 0) return null;

  const fulfillment = mapFulfillmentRow(result.rows[0]);
  await updateRFQStatusFromFulfillment(fulfillment);

  return fulfillment;
}

/**
 * Confirm delivery received
 */
export async function confirmDelivery(
  input: ConfirmDeliveryInput
): Promise<RFQFulfillment> {
  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      status = 'delivered',
      actual_delivery_date = NOW(),
      delivery_confirmed = true,
      delivery_confirmed_by = ${input.confirmedBy},
      delivery_confirmed_at = NOW(),
      delivery_proof_url = ${input.proofUrl || null},
      delivery_notes = ${input.notes || null},
      updated_at = NOW()
    WHERE award_id = ${input.awardId}
    RETURNING *
  `;

  const fulfillment = mapFulfillmentRow(result.rows[0]);

  // Update award status
  await markFulfilled(input.awardId);

  // Sync receipt to ERP
  try {
    await syncReceiptToERP(input.awardId, fulfillment);
  } catch (error) {
    console.error('Error syncing receipt to ERP:', error);
  }

  // Trigger payment release if auto-release is enabled
  await triggerPaymentRelease(input.awardId, fulfillment);

  return fulfillment;
}

/**
 * Report an issue with delivery
 */
export async function reportIssue(
  awardId: string,
  issueDescription: string
): Promise<RFQFulfillment> {
  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      has_issues = true,
      issue_description = ${issueDescription},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  return mapFulfillmentRow(result.rows[0]);
}

/**
 * Resolve an issue
 */
export async function resolveIssue(
  awardId: string,
  resolution: string
): Promise<RFQFulfillment> {
  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      has_issues = false,
      issue_resolution = ${resolution},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  return mapFulfillmentRow(result.rows[0]);
}

// ============================================================================
// PAYMENT RELEASE
// ============================================================================

/**
 * Trigger payment release after delivery confirmation
 */
async function triggerPaymentRelease(
  awardId: string,
  fulfillment: RFQFulfillment
): Promise<void> {
  // Only release if:
  // 1. Delivery is confirmed
  // 2. No unresolved issues
  // 3. Inspection passed (if required)
  if (!fulfillment.deliveryConfirmed) return;
  if (fulfillment.hasIssues) return;
  if (fulfillment.inspectionRequired && fulfillment.inspectionStatus !== 'passed') return;

  const award = await getAwardById(awardId);
  if (!award || !award.escrowId) return;

  try {
    // Import escrow service dynamically
    const { releaseEscrow } = await import('@/lib/escrow/escrow-service');

    await releaseEscrow(award.escrowId, {}, fulfillment.deliveryConfirmedBy || 'system');

    // Mark award as completed
    await completeAward(awardId);

    // Sync invoice to ERP
    await syncFulfillmentToERP(awardId, fulfillment);

    console.log(`Payment released for award ${awardId}`);
  } catch (error) {
    console.error('Error releasing payment:', error);
    // Don't throw - payment release failure shouldn't break fulfillment
  }
}

/**
 * Manual payment release (bypasses normal checks)
 */
export async function manualPaymentRelease(
  awardId: string,
  releasedBy: string,
  reason: string
): Promise<void> {
  const award = await getAwardById(awardId);
  if (!award || !award.escrowId) {
    throw new Error('Award or escrow not found');
  }

  const fulfillment = await getFulfillmentByAward(awardId);

  try {
    const { releaseEscrow } = await import('@/lib/escrow/escrow-service');

    await releaseEscrow(award.escrowId, {}, releasedBy);

    // Mark award as completed
    await completeAward(awardId);

    // Add note to fulfillment
    await sql`
      UPDATE rfq_fulfillment
      SET
        delivery_notes = CONCAT(COALESCE(delivery_notes, ''), ' | Manual release by ', ${releasedBy}, ': ', ${reason}),
        updated_at = NOW()
      WHERE award_id = ${awardId}
    `;

    // Sync to ERP
    if (fulfillment) {
      await syncFulfillmentToERP(awardId, fulfillment);
    }
  } catch (error) {
    console.error('Error in manual payment release:', error);
    throw error;
  }
}

// ============================================================================
// INSPECTION
// ============================================================================

/**
 * Set inspection requirement
 */
export async function setInspectionRequired(
  awardId: string,
  required: boolean
): Promise<RFQFulfillment> {
  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      inspection_required = ${required},
      inspection_status = ${required ? 'pending' : null},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  return mapFulfillmentRow(result.rows[0]);
}

/**
 * Record inspection result
 */
export async function recordInspection(
  awardId: string,
  passed: boolean,
  notes?: string
): Promise<RFQFulfillment> {
  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      inspection_status = ${passed ? 'passed' : 'failed'},
      inspection_notes = ${notes || null},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  const fulfillment = mapFulfillmentRow(result.rows[0]);

  // If inspection passed and delivery confirmed, trigger payment
  if (passed && fulfillment.deliveryConfirmed && !fulfillment.hasIssues) {
    await triggerPaymentRelease(awardId, fulfillment);
  }

  return fulfillment;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all pending fulfillments
 */
export async function getPendingFulfillments(): Promise<RFQFulfillment[]> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE status NOT IN ('delivered', 'cancelled', 'returned')
    ORDER BY created_at ASC
  `;

  return result.rows.map(mapFulfillmentRow);
}

/**
 * Get fulfillments awaiting confirmation
 */
export async function getAwaitingConfirmation(): Promise<RFQFulfillment[]> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE status = 'delivered'
    AND delivery_confirmed = false
    ORDER BY actual_delivery_date ASC
  `;

  return result.rows.map(mapFulfillmentRow);
}

/**
 * Get fulfillments with issues
 */
export async function getFulfillmentsWithIssues(): Promise<RFQFulfillment[]> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE has_issues = true
    ORDER BY updated_at DESC
  `;

  return result.rows.map(mapFulfillmentRow);
}

// ============================================================================
// HELPERS
// ============================================================================

async function updateRFQStatusFromFulfillment(
  fulfillment: RFQFulfillment
): Promise<void> {
  let rfqStatus: string;

  switch (fulfillment.status) {
    case 'shipped':
    case 'in_transit':
    case 'out_for_delivery':
      rfqStatus = 'fulfilling';
      break;
    case 'delivered':
      rfqStatus = 'delivered';
      break;
    case 'cancelled':
    case 'returned':
      rfqStatus = 'cancelled';
      break;
    default:
      return; // Don't update for pending/processing
  }

  await sql`
    UPDATE rfqs
    SET status = ${rfqStatus}, updated_at = NOW()
    WHERE id = ${fulfillment.rfqId}
  `;
}

function mapFulfillmentRow(row: any): RFQFulfillment {
  return {
    id: row.id,
    awardId: row.award_id,
    rfqId: row.rfq_id,
    status: row.status as FulfillmentStatus,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    estimatedShipDate: row.estimated_ship_date ? new Date(row.estimated_ship_date) : undefined,
    actualShipDate: row.actual_ship_date ? new Date(row.actual_ship_date) : undefined,
    estimatedDeliveryDate: row.estimated_delivery_date ? new Date(row.estimated_delivery_date) : undefined,
    actualDeliveryDate: row.actual_delivery_date ? new Date(row.actual_delivery_date) : undefined,
    deliveryConfirmed: row.delivery_confirmed,
    deliveryConfirmedBy: row.delivery_confirmed_by,
    deliveryConfirmedAt: row.delivery_confirmed_at ? new Date(row.delivery_confirmed_at) : undefined,
    deliveryProofUrl: row.delivery_proof_url,
    deliveryNotes: row.delivery_notes,
    inspectionRequired: row.inspection_required,
    inspectionStatus: row.inspection_status,
    inspectionNotes: row.inspection_notes,
    erpReceiptId: row.erp_receipt_id,
    erpReceiptCreatedAt: row.erp_receipt_created_at ? new Date(row.erp_receipt_created_at) : undefined,
    hasIssues: row.has_issues,
    issueDescription: row.issue_description,
    issueResolution: row.issue_resolution,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Generate tracking URL for common carriers
 */
export function generateTrackingUrl(
  carrier: string,
  trackingNumber: string
): string {
  const carrierLower = carrier.toLowerCase();

  if (carrierLower.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  }
  if (carrierLower.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  }
  if (carrierLower.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
  }
  if (carrierLower.includes('dhl')) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
  }

  // Generic fallback
  return `https://www.google.com/search?q=${carrier}+tracking+${trackingNumber}`;
}
