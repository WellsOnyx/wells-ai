/**
 * RFQ Fulfillment Service
 * Comprehensive delivery tracking and completion management
 *
 * @module lib/rfq/fulfillment-service
 * @description Handles fulfillment lifecycle from award acknowledgment to payment release
 */

import { sql } from '@vercel/postgres';
import {
  RFQFulfillment,
  RFQFulfillmentRow,
  FulfillmentStatus,
  InspectionStatus,
  UpdateFulfillmentInput,
  ConfirmDeliveryInput,
  RFQAward,
} from './types';

// ============================================================================
// LOGGING
// ============================================================================

const LOG_PREFIX = '[Fulfillment]';

function log(message: string, data?: Record<string, unknown>): void {
  console.log(`${LOG_PREFIX} ${message}`, data ? JSON.stringify(data) : '');
}

function logError(message: string, error: unknown): void {
  console.error(`${LOG_PREFIX} ERROR: ${message}`, error);
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Input for creating a fulfillment record
 */
export interface CreateFulfillmentInput {
  awardId: string;
  rfqId: string;
  inspectionRequired?: boolean;
  estimatedShipDate?: string;
  estimatedDeliveryDate?: string;
}

/**
 * Tracking information input
 */
export interface TrackingInfo {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
}

/**
 * Delivery proof input
 */
export interface DeliveryProof {
  type: 'signature' | 'photo' | 'document' | 'other';
  url: string;
  signedBy?: string;
  notes?: string;
}

/**
 * Inspection result input
 */
export interface InspectionResult {
  status: 'passed' | 'failed' | 'waived';
  inspectorName?: string;
  notes?: string;
  defects?: string[];
  photos?: string[];
}

/**
 * Issue report input
 */
export interface IssueReport {
  type: 'delay' | 'damage' | 'wrong_item' | 'missing_item' | 'quality' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  photos?: string[];
  requestedResolution?: 'replacement' | 'refund' | 'partial_refund' | 'repair' | 'other';
}

/**
 * Issue resolution input
 */
export interface IssueResolution {
  resolutionType: 'replaced' | 'refunded' | 'partial_refund' | 'repaired' | 'accepted' | 'other';
  description: string;
  resolvedBy: string;
  refundAmount?: number;
}

/**
 * Fulfillment summary with related data
 */
export interface FulfillmentSummary extends RFQFulfillment {
  award?: RFQAward;
  daysInTransit?: number;
  isOverdue?: boolean;
}

// ============================================================================
// CREATE FULFILLMENT RECORD
// ============================================================================

/**
 * Create a fulfillment record when award is acknowledged
 * Called when supplier acknowledges the award
 */
export async function createFulfillmentRecord(
  input: CreateFulfillmentInput
): Promise<RFQFulfillment> {
  log('Creating fulfillment record', { awardId: input.awardId, rfqId: input.rfqId });

  const result = await sql`
    INSERT INTO rfq_fulfillment (
      award_id,
      rfq_id,
      status,
      inspection_required,
      inspection_status,
      estimated_ship_date,
      estimated_delivery_date
    ) VALUES (
      ${input.awardId},
      ${input.rfqId},
      'pending',
      ${input.inspectionRequired ?? false},
      ${input.inspectionRequired ? 'pending' : null},
      ${input.estimatedShipDate ? new Date(input.estimatedShipDate) : null},
      ${input.estimatedDeliveryDate ? new Date(input.estimatedDeliveryDate) : null}
    )
    RETURNING *
  `;

  const fulfillment = mapFulfillmentRow(result.rows[0]);
  log('Fulfillment record created', { id: fulfillment.id, status: fulfillment.status });

  return fulfillment;
}

/**
 * Get or create fulfillment record for an award
 */
export async function getOrCreateFulfillment(
  awardId: string,
  rfqId: string
): Promise<RFQFulfillment> {
  const existing = await getFulfillmentByAwardId(awardId);
  if (existing) return existing;

  return createFulfillmentRecord({ awardId, rfqId });
}

// ============================================================================
// UPDATE SHIPMENT STATUS
// ============================================================================

/**
 * Update shipment status through the fulfillment lifecycle
 */
export async function updateShipmentStatus(
  fulfillmentId: string,
  status: FulfillmentStatus,
  details?: {
    notes?: string;
    location?: string;
    timestamp?: Date;
  }
): Promise<RFQFulfillment> {
  log('Updating shipment status', { fulfillmentId, status, details });

  // Validate status transition
  const current = await getFulfillmentById(fulfillmentId);
  if (!current) {
    throw new Error(`Fulfillment not found: ${fulfillmentId}`);
  }

  validateStatusTransition(current.status, status);

  // Build update based on status
  let updateResult;

  switch (status) {
    case 'processing':
      updateResult = await sql`
        UPDATE rfq_fulfillment
        SET
          status = 'processing',
          updated_at = NOW()
        WHERE id = ${fulfillmentId}
        RETURNING *
      `;
      break;

    case 'shipped':
      updateResult = await sql`
        UPDATE rfq_fulfillment
        SET
          status = 'shipped',
          actual_ship_date = NOW(),
          updated_at = NOW()
        WHERE id = ${fulfillmentId}
        RETURNING *
      `;
      break;

    case 'in_transit':
      updateResult = await sql`
        UPDATE rfq_fulfillment
        SET
          status = 'in_transit',
          updated_at = NOW()
        WHERE id = ${fulfillmentId}
        RETURNING *
      `;
      break;

    case 'out_for_delivery':
      updateResult = await sql`
        UPDATE rfq_fulfillment
        SET
          status = 'out_for_delivery',
          updated_at = NOW()
        WHERE id = ${fulfillmentId}
        RETURNING *
      `;
      break;

    case 'delivered':
      updateResult = await sql`
        UPDATE rfq_fulfillment
        SET
          status = 'delivered',
          actual_delivery_date = NOW(),
          updated_at = NOW()
        WHERE id = ${fulfillmentId}
        RETURNING *
      `;
      break;

    case 'delayed':
      updateResult = await sql`
        UPDATE rfq_fulfillment
        SET
          status = 'delayed',
          delivery_notes = COALESCE(delivery_notes || ' | ', '') || ${details?.notes || 'Delivery delayed'},
          updated_at = NOW()
        WHERE id = ${fulfillmentId}
        RETURNING *
      `;
      break;

    default:
      updateResult = await sql`
        UPDATE rfq_fulfillment
        SET
          status = ${status},
          updated_at = NOW()
        WHERE id = ${fulfillmentId}
        RETURNING *
      `;
  }

  const fulfillment = mapFulfillmentRow(updateResult.rows[0]);

  // Update RFQ status
  await updateRFQFromFulfillment(fulfillment);

  log('Shipment status updated', { id: fulfillment.id, status: fulfillment.status });
  return fulfillment;
}

/**
 * Mark order as processing (being prepared)
 */
export async function markProcessing(awardId: string): Promise<RFQFulfillment> {
  const fulfillment = await getFulfillmentByAwardId(awardId);
  if (!fulfillment) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  return updateShipmentStatus(fulfillment.id, 'processing');
}

/**
 * Mark order as shipped
 */
export async function markShipped(
  awardId: string,
  trackingInfo: TrackingInfo,
  estimatedDeliveryDate?: string
): Promise<RFQFulfillment> {
  log('Marking order as shipped', { awardId, trackingInfo });

  const trackingUrl = trackingInfo.trackingUrl || generateTrackingUrl(
    trackingInfo.carrier,
    trackingInfo.trackingNumber
  );

  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      status = 'shipped',
      carrier = ${trackingInfo.carrier},
      tracking_number = ${trackingInfo.trackingNumber},
      tracking_url = ${trackingUrl},
      actual_ship_date = NOW(),
      estimated_delivery_date = ${estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  const fulfillment = mapFulfillmentRow(result.rows[0]);

  // Update RFQ status to fulfilling
  await sql`
    UPDATE rfqs
    SET status = 'fulfilling', updated_at = NOW()
    WHERE id = ${fulfillment.rfqId}
  `;

  log('Order marked as shipped', { id: fulfillment.id, trackingNumber: trackingInfo.trackingNumber });
  return fulfillment;
}

// ============================================================================
// ADD TRACKING INFO
// ============================================================================

/**
 * Add or update tracking information
 */
export async function addTrackingInfo(
  awardId: string,
  trackingInfo: TrackingInfo
): Promise<RFQFulfillment> {
  log('Adding tracking info', { awardId, carrier: trackingInfo.carrier });

  const trackingUrl = trackingInfo.trackingUrl || generateTrackingUrl(
    trackingInfo.carrier,
    trackingInfo.trackingNumber
  );

  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      carrier = ${trackingInfo.carrier},
      tracking_number = ${trackingInfo.trackingNumber},
      tracking_url = ${trackingUrl},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  const fulfillment = mapFulfillmentRow(result.rows[0]);
  log('Tracking info added', { id: fulfillment.id, trackingNumber: trackingInfo.trackingNumber });

  return fulfillment;
}

/**
 * Update tracking status from carrier webhook or manual update
 */
export async function updateTrackingFromCarrier(
  trackingNumber: string,
  status: FulfillmentStatus,
  details?: {
    location?: string;
    timestamp?: Date;
    estimatedDelivery?: Date;
  }
): Promise<RFQFulfillment | null> {
  log('Updating from carrier', { trackingNumber, status });

  // Find fulfillment by tracking number
  const findResult = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE tracking_number = ${trackingNumber}
  `;

  if (findResult.rows.length === 0) {
    log('No fulfillment found for tracking number', { trackingNumber });
    return null;
  }

  const current = mapFulfillmentRow(findResult.rows[0]);

  // Update with new status
  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      status = ${status},
      estimated_delivery_date = COALESCE(${details?.estimatedDelivery || null}, estimated_delivery_date),
      actual_delivery_date = CASE WHEN ${status} = 'delivered' THEN NOW() ELSE actual_delivery_date END,
      updated_at = NOW()
    WHERE tracking_number = ${trackingNumber}
    RETURNING *
  `;

  const fulfillment = mapFulfillmentRow(result.rows[0]);
  await updateRFQFromFulfillment(fulfillment);

  log('Updated from carrier', { id: fulfillment.id, status: fulfillment.status });
  return fulfillment;
}

// ============================================================================
// RECORD DELIVERY CONFIRMATION
// ============================================================================

/**
 * Record delivery confirmation with proof
 */
export async function recordDeliveryConfirmation(
  awardId: string,
  confirmedBy: string,
  proof?: DeliveryProof
): Promise<RFQFulfillment> {
  log('Recording delivery confirmation', { awardId, confirmedBy, proofType: proof?.type });

  const notes = proof ? buildProofNotes(proof) : null;
  const proofUrl = proof?.url || null;

  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      status = 'delivered',
      actual_delivery_date = COALESCE(actual_delivery_date, NOW()),
      delivery_confirmed = true,
      delivery_confirmed_by = ${confirmedBy},
      delivery_confirmed_at = NOW(),
      delivery_proof_url = ${proofUrl},
      delivery_notes = COALESCE(delivery_notes || ' | ', '') || ${notes || 'Delivery confirmed'},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  const fulfillment = mapFulfillmentRow(result.rows[0]);

  // Update RFQ status
  await sql`
    UPDATE rfqs
    SET status = 'delivered', updated_at = NOW()
    WHERE id = ${fulfillment.rfqId}
  `;

  // Update award status
  await sql`
    UPDATE rfq_awards
    SET status = 'fulfilled'
    WHERE id = ${awardId}
  `;

  log('Delivery confirmed', { id: fulfillment.id, confirmedBy });

  // Check if we can trigger payment release
  await checkAndTriggerPaymentRelease(awardId, fulfillment);

  return fulfillment;
}

/**
 * Build notes string from proof
 */
function buildProofNotes(proof: DeliveryProof): string {
  let notes = `Proof type: ${proof.type}`;
  if (proof.signedBy) {
    notes += `, signed by: ${proof.signedBy}`;
  }
  if (proof.notes) {
    notes += `, notes: ${proof.notes}`;
  }
  return notes;
}

// ============================================================================
// HANDLE QUALITY INSPECTION
// ============================================================================

/**
 * Set inspection requirement for a fulfillment
 */
export async function setInspectionRequired(
  awardId: string,
  required: boolean
): Promise<RFQFulfillment> {
  log('Setting inspection requirement', { awardId, required });

  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      inspection_required = ${required},
      inspection_status = ${required ? 'pending' : null},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  return mapFulfillmentRow(result.rows[0]);
}

/**
 * Record inspection result
 */
export async function recordInspectionResult(
  awardId: string,
  result: InspectionResult
): Promise<RFQFulfillment> {
  log('Recording inspection result', { awardId, status: result.status });

  const notes = buildInspectionNotes(result);

  const updateResult = await sql`
    UPDATE rfq_fulfillment
    SET
      inspection_status = ${result.status},
      inspection_notes = ${notes},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  if (updateResult.rows.length === 0) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  const fulfillment = mapFulfillmentRow(updateResult.rows[0]);
  log('Inspection recorded', { id: fulfillment.id, status: result.status });

  // If inspection passed/waived and delivery confirmed, check payment release
  if ((result.status === 'passed' || result.status === 'waived') && fulfillment.deliveryConfirmed) {
    await checkAndTriggerPaymentRelease(awardId, fulfillment);
  }

  // If inspection failed, report as issue
  if (result.status === 'failed') {
    await reportIssue(awardId, {
      type: 'quality',
      severity: 'high',
      description: `Inspection failed: ${result.notes || 'Quality issues detected'}`,
    });
  }

  return fulfillment;
}

/**
 * Build inspection notes string
 */
function buildInspectionNotes(result: InspectionResult): string {
  let notes = `Status: ${result.status}`;
  if (result.inspectorName) {
    notes += `, inspector: ${result.inspectorName}`;
  }
  if (result.notes) {
    notes += `, notes: ${result.notes}`;
  }
  if (result.defects && result.defects.length > 0) {
    notes += `, defects: ${result.defects.join(', ')}`;
  }
  return notes;
}

// ============================================================================
// TRIGGER PAYMENT RELEASE
// ============================================================================

/**
 * Check conditions and trigger payment release
 */
async function checkAndTriggerPaymentRelease(
  awardId: string,
  fulfillment: RFQFulfillment
): Promise<boolean> {
  log('Checking payment release conditions', { awardId });

  // Conditions for payment release:
  // 1. Delivery must be confirmed
  if (!fulfillment.deliveryConfirmed) {
    log('Payment release blocked: delivery not confirmed');
    return false;
  }

  // 2. No unresolved issues
  if (fulfillment.hasIssues) {
    log('Payment release blocked: unresolved issues');
    return false;
  }

  // 3. Inspection must pass (if required)
  if (fulfillment.inspectionRequired) {
    if (fulfillment.inspectionStatus !== 'passed' && fulfillment.inspectionStatus !== 'waived') {
      log('Payment release blocked: inspection not passed');
      return false;
    }
  }

  // All conditions met - trigger payment release
  return await triggerPaymentRelease(awardId);
}

/**
 * Trigger payment release for a fulfilled order
 */
export async function triggerPaymentRelease(awardId: string): Promise<boolean> {
  log('Triggering payment release', { awardId });

  try {
    // Get award to find escrow
    const awardResult = await sql`
      SELECT * FROM rfq_awards WHERE id = ${awardId}
    `;

    if (awardResult.rows.length === 0) {
      logError('Award not found', { awardId });
      return false;
    }

    const award = awardResult.rows[0];

    if (!award.escrow_id) {
      log('No escrow associated with award', { awardId });
      // Still mark as completed
      await completeAwardAndRFQ(awardId, award.rfq_id);
      return true;
    }

    // Try to release escrow
    try {
      const { releaseEscrow } = await import('@/lib/escrow/escrow-service');
      await releaseEscrow(award.escrow_id, {}, 'system');
      log('Escrow released successfully', { escrowId: award.escrow_id });
    } catch (escrowError) {
      logError('Failed to release escrow', escrowError);
      // Continue to mark as completed even if escrow release fails
      // (will need manual intervention)
    }

    // Mark award and RFQ as completed
    await completeAwardAndRFQ(awardId, award.rfq_id);

    // Sync to ERP
    try {
      const { syncReceiptToERP } = await import('./erp-sync');
      const fulfillment = await getFulfillmentByAwardId(awardId);
      if (fulfillment) {
        await syncReceiptToERP(awardId, fulfillment);
      }
    } catch (erpError) {
      logError('Failed to sync receipt to ERP', erpError);
    }

    log('Payment release completed', { awardId });
    return true;
  } catch (error) {
    logError('Payment release failed', error);
    return false;
  }
}

/**
 * Manual payment release (admin override)
 */
export async function manualPaymentRelease(
  awardId: string,
  releasedBy: string,
  reason: string
): Promise<boolean> {
  log('Manual payment release', { awardId, releasedBy, reason });

  // Record the manual release in fulfillment notes
  await sql`
    UPDATE rfq_fulfillment
    SET
      delivery_notes = COALESCE(delivery_notes || ' | ', '') ||
        ${'MANUAL RELEASE by ' + releasedBy + ': ' + reason},
      updated_at = NOW()
    WHERE award_id = ${awardId}
  `;

  return await triggerPaymentRelease(awardId);
}

/**
 * Complete award and RFQ status
 */
async function completeAwardAndRFQ(awardId: string, rfqId: string): Promise<void> {
  await sql`
    UPDATE rfq_awards
    SET
      status = 'completed',
      payment_completed_at = NOW()
    WHERE id = ${awardId}
  `;

  await sql`
    UPDATE rfqs
    SET status = 'completed', updated_at = NOW()
    WHERE id = ${rfqId}
  `;
}

// ============================================================================
// HANDLE ISSUES
// ============================================================================

/**
 * Report an issue with the fulfillment
 */
export async function reportIssue(
  awardId: string,
  issue: IssueReport
): Promise<RFQFulfillment> {
  log('Reporting issue', { awardId, type: issue.type, severity: issue.severity });

  const issueDescription = buildIssueDescription(issue);

  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      has_issues = true,
      issue_description = COALESCE(issue_description || ' | ', '') || ${issueDescription},
      status = CASE
        WHEN ${issue.severity} = 'critical' THEN 'delayed'
        ELSE status
      END,
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  const fulfillment = mapFulfillmentRow(result.rows[0]);
  log('Issue reported', { id: fulfillment.id, type: issue.type });

  // If critical, update award status to disputed
  if (issue.severity === 'critical') {
    await sql`
      UPDATE rfq_awards
      SET status = 'disputed'
      WHERE id = ${awardId}
    `;
  }

  return fulfillment;
}

/**
 * Build issue description string
 */
function buildIssueDescription(issue: IssueReport): string {
  const timestamp = new Date().toISOString();
  let description = `[${timestamp}] ${issue.type.toUpperCase()} (${issue.severity}): ${issue.description}`;
  if (issue.requestedResolution) {
    description += ` | Requested: ${issue.requestedResolution}`;
  }
  return description;
}

/**
 * Resolve an issue
 */
export async function resolveIssue(
  awardId: string,
  resolution: IssueResolution
): Promise<RFQFulfillment> {
  log('Resolving issue', { awardId, type: resolution.resolutionType });

  const resolutionText = buildResolutionText(resolution);

  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      has_issues = false,
      issue_resolution = COALESCE(issue_resolution || ' | ', '') || ${resolutionText},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  const fulfillment = mapFulfillmentRow(result.rows[0]);
  log('Issue resolved', { id: fulfillment.id, type: resolution.resolutionType });

  // If delivery was confirmed and inspection passed, check payment release
  if (fulfillment.deliveryConfirmed) {
    await checkAndTriggerPaymentRelease(awardId, fulfillment);
  }

  // Reset award status if it was disputed
  await sql`
    UPDATE rfq_awards
    SET status = CASE
      WHEN status = 'disputed' THEN 'fulfilled'
      ELSE status
    END
    WHERE id = ${awardId}
  `;

  return fulfillment;
}

/**
 * Build resolution text
 */
function buildResolutionText(resolution: IssueResolution): string {
  const timestamp = new Date().toISOString();
  let text = `[${timestamp}] ${resolution.resolutionType.toUpperCase()} by ${resolution.resolvedBy}: ${resolution.description}`;
  if (resolution.refundAmount) {
    text += ` | Refund: $${resolution.refundAmount.toFixed(2)}`;
  }
  return text;
}

/**
 * Handle delayed shipment
 */
export async function handleDelay(
  awardId: string,
  reason: string,
  newEstimatedDelivery?: string
): Promise<RFQFulfillment> {
  log('Handling delay', { awardId, reason });

  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      status = 'delayed',
      delivery_notes = COALESCE(delivery_notes || ' | ', '') || ${'DELAY: ' + reason},
      estimated_delivery_date = ${newEstimatedDelivery ? new Date(newEstimatedDelivery) : null},
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  return mapFulfillmentRow(result.rows[0]);
}

/**
 * Handle return request
 */
export async function handleReturn(
  awardId: string,
  reason: string,
  returnTrackingNumber?: string
): Promise<RFQFulfillment> {
  log('Handling return', { awardId, reason });

  const result = await sql`
    UPDATE rfq_fulfillment
    SET
      status = 'returned',
      has_issues = true,
      issue_description = COALESCE(issue_description || ' | ', '') || ${'RETURN: ' + reason},
      delivery_notes = CASE
        WHEN ${returnTrackingNumber} IS NOT NULL
        THEN COALESCE(delivery_notes || ' | ', '') || ${'Return tracking: ' + returnTrackingNumber}
        ELSE delivery_notes
      END,
      updated_at = NOW()
    WHERE award_id = ${awardId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error(`No fulfillment found for award: ${awardId}`);
  }

  // Update award status
  await sql`
    UPDATE rfq_awards
    SET status = 'disputed'
    WHERE id = ${awardId}
  `;

  return mapFulfillmentRow(result.rows[0]);
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get fulfillment by ID
 */
export async function getFulfillmentById(id: string): Promise<RFQFulfillment | null> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE id = ${id}
  `;

  if (result.rows.length === 0) return null;
  return mapFulfillmentRow(result.rows[0]);
}

/**
 * Get fulfillment by award ID
 */
export async function getFulfillmentByAwardId(awardId: string): Promise<RFQFulfillment | null> {
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
export async function getFulfillmentByRfqId(rfqId: string): Promise<RFQFulfillment | null> {
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
 * Get fulfillment by tracking number
 */
export async function getFulfillmentByTrackingNumber(
  trackingNumber: string
): Promise<RFQFulfillment | null> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE tracking_number = ${trackingNumber}
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;
  return mapFulfillmentRow(result.rows[0]);
}

/**
 * Get all pending fulfillments
 */
export async function getPendingFulfillments(): Promise<RFQFulfillment[]> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE status IN ('pending', 'processing')
    ORDER BY created_at ASC
  `;

  return result.rows.map(mapFulfillmentRow);
}

/**
 * Get all in-transit fulfillments
 */
export async function getInTransitFulfillments(): Promise<RFQFulfillment[]> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE status IN ('shipped', 'in_transit', 'out_for_delivery')
    ORDER BY actual_ship_date ASC
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
 * Get fulfillments awaiting inspection
 */
export async function getAwaitingInspection(): Promise<RFQFulfillment[]> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE inspection_required = true
    AND inspection_status = 'pending'
    AND delivery_confirmed = true
    ORDER BY delivery_confirmed_at ASC
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

/**
 * Get overdue fulfillments
 */
export async function getOverdueFulfillments(): Promise<RFQFulfillment[]> {
  const result = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE status NOT IN ('delivered', 'cancelled', 'returned')
    AND estimated_delivery_date < NOW()
    ORDER BY estimated_delivery_date ASC
  `;

  return result.rows.map(mapFulfillmentRow);
}

/**
 * Get fulfillment summary with calculated fields
 */
export async function getFulfillmentSummary(awardId: string): Promise<FulfillmentSummary | null> {
  const fulfillment = await getFulfillmentByAwardId(awardId);
  if (!fulfillment) return null;

  // Get award data
  const awardResult = await sql`
    SELECT * FROM rfq_awards WHERE id = ${awardId}
  `;
  const award = awardResult.rows[0];

  // Calculate days in transit
  let daysInTransit: number | undefined;
  if (fulfillment.actualShipDate) {
    const endDate = fulfillment.actualDeliveryDate || new Date();
    daysInTransit = Math.floor(
      (endDate.getTime() - fulfillment.actualShipDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Check if overdue
  let isOverdue = false;
  if (fulfillment.estimatedDeliveryDate && !fulfillment.deliveryConfirmed) {
    isOverdue = new Date() > fulfillment.estimatedDeliveryDate;
  }

  return {
    ...fulfillment,
    award: award ? mapAwardRow(award) : undefined,
    daysInTransit,
    isOverdue,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate status transition
 */
function validateStatusTransition(current: FulfillmentStatus, next: FulfillmentStatus): void {
  const validTransitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
    pending: ['processing', 'shipped', 'cancelled'],
    processing: ['shipped', 'cancelled', 'delayed'],
    shipped: ['in_transit', 'out_for_delivery', 'delivered', 'delayed', 'returned'],
    in_transit: ['out_for_delivery', 'delivered', 'delayed', 'returned'],
    out_for_delivery: ['delivered', 'delayed', 'returned'],
    delivered: ['returned'],
    delayed: ['processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    cancelled: [],
    returned: [],
  };

  const allowed = validTransitions[current];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid status transition from ${current} to ${next}`);
  }
}

/**
 * Update RFQ status based on fulfillment
 */
async function updateRFQFromFulfillment(fulfillment: RFQFulfillment): Promise<void> {
  let rfqStatus: string;

  switch (fulfillment.status) {
    case 'shipped':
    case 'in_transit':
    case 'out_for_delivery':
    case 'processing':
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
      return;
  }

  await sql`
    UPDATE rfqs
    SET status = ${rfqStatus}, updated_at = NOW()
    WHERE id = ${fulfillment.rfqId}
  `;
}

/**
 * Generate tracking URL for common carriers
 */
export function generateTrackingUrl(carrier: string, trackingNumber: string): string {
  const carrierLower = carrier.toLowerCase();

  if (carrierLower.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('dhl')) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('ontrac')) {
    return `https://www.ontrac.com/tracking/?number=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('lasership') || carrierLower.includes('laser ship')) {
    return `https://www.lasership.com/track/${encodeURIComponent(trackingNumber)}`;
  }

  // Generic Google search fallback
  return `https://www.google.com/search?q=${encodeURIComponent(carrier)}+tracking+${encodeURIComponent(trackingNumber)}`;
}

/**
 * Map database row to RFQFulfillment
 */
function mapFulfillmentRow(row: RFQFulfillmentRow): RFQFulfillment {
  return {
    id: row.id,
    awardId: row.award_id,
    rfqId: row.rfq_id,
    status: row.status,
    carrier: row.carrier || undefined,
    trackingNumber: row.tracking_number || undefined,
    trackingUrl: row.tracking_url || undefined,
    estimatedShipDate: row.estimated_ship_date ? new Date(row.estimated_ship_date) : undefined,
    actualShipDate: row.actual_ship_date ? new Date(row.actual_ship_date) : undefined,
    estimatedDeliveryDate: row.estimated_delivery_date ? new Date(row.estimated_delivery_date) : undefined,
    actualDeliveryDate: row.actual_delivery_date ? new Date(row.actual_delivery_date) : undefined,
    deliveryConfirmed: row.delivery_confirmed,
    deliveryConfirmedBy: row.delivery_confirmed_by || undefined,
    deliveryConfirmedAt: row.delivery_confirmed_at ? new Date(row.delivery_confirmed_at) : undefined,
    deliveryProofUrl: row.delivery_proof_url || undefined,
    deliveryNotes: row.delivery_notes || undefined,
    inspectionRequired: row.inspection_required,
    inspectionStatus: row.inspection_status || undefined,
    inspectionNotes: row.inspection_notes || undefined,
    erpReceiptId: row.erp_receipt_id || undefined,
    erpReceiptCreatedAt: row.erp_receipt_created_at ? new Date(row.erp_receipt_created_at) : undefined,
    hasIssues: row.has_issues,
    issueDescription: row.issue_description || undefined,
    issueResolution: row.issue_resolution || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Map database row to RFQAward (minimal for summary)
 */
function mapAwardRow(row: any): RFQAward {
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
    supplierAcknowledgedAt: row.supplier_acknowledged_at ? new Date(row.supplier_acknowledged_at) : undefined,
    paymentInitiatedAt: row.payment_initiated_at ? new Date(row.payment_initiated_at) : undefined,
    paymentCompletedAt: row.payment_completed_at ? new Date(row.payment_completed_at) : undefined,
  };
}
