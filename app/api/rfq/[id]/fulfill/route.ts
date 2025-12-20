/**
 * RFQ Fulfillment API
 *
 * GET /api/rfq/[id]/fulfill - Get fulfillment status
 * POST /api/rfq/[id]/fulfill - Create fulfillment record or update status
 * PUT /api/rfq/[id]/fulfill - Update fulfillment (tracking, delivery confirmation, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getFulfillmentByRfqId,
  getFulfillmentSummary,
  createFulfillmentRecord,
  getOrCreateFulfillment,
  markProcessing,
  markShipped,
  addTrackingInfo,
  updateTrackingFromCarrier,
  recordDeliveryConfirmation,
  setInspectionRequired,
  recordInspectionResult,
  reportIssue,
  resolveIssue,
  handleDelay,
  handleReturn,
  manualPaymentRelease,
  generateTrackingUrl,
  type TrackingInfo,
  type DeliveryProof,
  type InspectionResult,
  type IssueReport,
  type IssueResolution,
} from '@/lib/rfq/fulfillment-service';
import type {
  RFQFulfillment,
  FulfillmentStatus,
  UpdateFulfillmentInput,
  ConfirmDeliveryInput,
} from '@/lib/rfq/types';
import { getAwardByRFQ } from '@/lib/rfq/award-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET - Get fulfillment status
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rfqId } = await params;

    // Get fulfillment record
    const fulfillment = await getFulfillmentByRfqId(rfqId);

    if (!fulfillment) {
      // Check if award exists but fulfillment not yet created
      const award = await getAwardByRFQ(rfqId);

      if (!award) {
        return NextResponse.json({
          success: true,
          fulfillment: null,
          message: 'No award found for this RFQ. Fulfillment tracking begins after award.',
        });
      }

      return NextResponse.json({
        success: true,
        fulfillment: null,
        awardId: award.id,
        awardStatus: award.status,
        message: 'Award exists but fulfillment not yet started. Supplier must acknowledge award.',
      });
    }

    // Get full summary with calculated fields
    const summary = await getFulfillmentSummary(fulfillment.awardId);

    return NextResponse.json({
      success: true,
      fulfillment: summary || fulfillment,
    });
  } catch (error: unknown) {
    console.error('Error fetching fulfillment:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch fulfillment',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create fulfillment record or update status
// ============================================================================

interface PostRequestBody {
  action:
    | 'create'
    | 'processing'
    | 'ship'
    | 'update_tracking'
    | 'confirm_delivery'
    | 'set_inspection'
    | 'record_inspection'
    | 'report_issue'
    | 'resolve_issue'
    | 'delay'
    | 'return'
    | 'release_payment';
  // For create action
  awardId?: string;
  inspectionRequired?: boolean;
  estimatedShipDate?: string;
  estimatedDeliveryDate?: string;
  // For ship action
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  // For confirm_delivery action
  confirmedBy?: string;
  proofType?: 'signature' | 'photo' | 'document' | 'other';
  proofUrl?: string;
  signedBy?: string;
  notes?: string;
  // For set_inspection action
  required?: boolean;
  // For record_inspection action
  inspectionStatus?: 'passed' | 'failed' | 'waived';
  inspectorName?: string;
  defects?: string[];
  photos?: string[];
  // For report_issue action
  issueType?: 'delay' | 'damage' | 'wrong_item' | 'missing_item' | 'quality' | 'other';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  requestedResolution?: 'replacement' | 'refund' | 'partial_refund' | 'repair' | 'other';
  // For resolve_issue action
  resolutionType?: 'replaced' | 'refunded' | 'partial_refund' | 'repaired' | 'accepted' | 'other';
  resolvedBy?: string;
  refundAmount?: number;
  // For delay action
  reason?: string;
  newEstimatedDelivery?: string;
  // For return action
  returnTrackingNumber?: string;
  // For release_payment action
  releasedBy?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rfqId } = await params;
    const body = (await request.json()) as PostRequestBody;
    const { action } = body;

    // Get award for this RFQ
    const award = await getAwardByRFQ(rfqId);

    switch (action) {
      case 'create': {
        // Create a new fulfillment record
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ. Cannot create fulfillment.' },
            { status: 404 }
          );
        }

        const fulfillment = await createFulfillmentRecord({
          awardId: award.id,
          rfqId,
          inspectionRequired: body.inspectionRequired,
          estimatedShipDate: body.estimatedShipDate,
          estimatedDeliveryDate: body.estimatedDeliveryDate,
        });

        return NextResponse.json({
          success: true,
          fulfillment,
          message: 'Fulfillment record created',
        });
      }

      case 'processing': {
        // Mark order as processing
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        // Ensure fulfillment exists
        await getOrCreateFulfillment(award.id, rfqId);

        const fulfillment = await markProcessing(award.id);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: 'Order marked as processing',
        });
      }

      case 'ship': {
        // Mark as shipped with tracking info
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        const { carrier, trackingNumber } = body;

        if (!carrier || !trackingNumber) {
          return NextResponse.json(
            { error: 'carrier and trackingNumber are required' },
            { status: 400 }
          );
        }

        // Ensure fulfillment exists
        await getOrCreateFulfillment(award.id, rfqId);

        const trackingInfo: TrackingInfo = {
          carrier,
          trackingNumber,
          trackingUrl: body.trackingUrl || generateTrackingUrl(carrier, trackingNumber),
        };

        const fulfillment = await markShipped(
          award.id,
          trackingInfo,
          body.estimatedDeliveryDate
        );

        return NextResponse.json({
          success: true,
          fulfillment,
          trackingUrl: trackingInfo.trackingUrl,
          message: `Shipped via ${carrier}. Tracking: ${trackingNumber}`,
        });
      }

      case 'update_tracking': {
        // Update tracking status (for carrier webhook integration)
        const { trackingNumber, status } = body as { trackingNumber?: string; status?: FulfillmentStatus };

        if (!trackingNumber || !status) {
          return NextResponse.json(
            { error: 'trackingNumber and status are required' },
            { status: 400 }
          );
        }

        const fulfillment = await updateTrackingFromCarrier(trackingNumber, status, {
          estimatedDelivery: body.estimatedDeliveryDate
            ? new Date(body.estimatedDeliveryDate)
            : undefined,
        });

        if (!fulfillment) {
          return NextResponse.json(
            { error: 'Tracking number not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          fulfillment,
          message: `Tracking updated to: ${status}`,
        });
      }

      case 'confirm_delivery': {
        // Confirm delivery received
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        const confirmedBy = body.confirmedBy || userId;

        let deliveryProof: DeliveryProof | undefined;
        if (body.proofUrl) {
          deliveryProof = {
            type: body.proofType || 'other',
            url: body.proofUrl,
            signedBy: body.signedBy,
            notes: body.notes,
          };
        }

        const fulfillment = await recordDeliveryConfirmation(
          award.id,
          confirmedBy,
          deliveryProof
        );

        return NextResponse.json({
          success: true,
          fulfillment,
          message: 'Delivery confirmed. Payment release initiated.',
        });
      }

      case 'set_inspection': {
        // Set inspection requirement
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        const required = body.required !== false;

        const fulfillment = await setInspectionRequired(award.id, required);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: `Inspection ${required ? 'required' : 'not required'}`,
        });
      }

      case 'record_inspection': {
        // Record inspection result
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        const { inspectionStatus } = body;

        if (!inspectionStatus) {
          return NextResponse.json(
            { error: 'inspectionStatus (passed, failed, waived) is required' },
            { status: 400 }
          );
        }

        const inspectionResult: InspectionResult = {
          status: inspectionStatus,
          inspectorName: body.inspectorName,
          notes: body.notes,
          defects: body.defects,
          photos: body.photos,
        };

        const fulfillment = await recordInspectionResult(award.id, inspectionResult);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: `Inspection ${inspectionStatus}`,
        });
      }

      case 'report_issue': {
        // Report a delivery issue
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        const { issueType, severity, description } = body;

        if (!issueType || !severity || !description) {
          return NextResponse.json(
            { error: 'issueType, severity, and description are required' },
            { status: 400 }
          );
        }

        const issueReport: IssueReport = {
          type: issueType,
          severity,
          description,
          photos: body.photos,
          requestedResolution: body.requestedResolution,
        };

        const fulfillment = await reportIssue(award.id, issueReport);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: `Issue reported: ${issueType} (${severity})`,
        });
      }

      case 'resolve_issue': {
        // Resolve a reported issue
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        const { resolutionType, description, resolvedBy } = body;

        if (!resolutionType || !description || !resolvedBy) {
          return NextResponse.json(
            { error: 'resolutionType, description, and resolvedBy are required' },
            { status: 400 }
          );
        }

        const resolution: IssueResolution = {
          resolutionType,
          description,
          resolvedBy,
          refundAmount: body.refundAmount,
        };

        const fulfillment = await resolveIssue(award.id, resolution);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: `Issue resolved: ${resolutionType}`,
        });
      }

      case 'delay': {
        // Handle delayed shipment
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        const { reason, newEstimatedDelivery } = body;

        if (!reason) {
          return NextResponse.json(
            { error: 'reason is required' },
            { status: 400 }
          );
        }

        const fulfillment = await handleDelay(award.id, reason, newEstimatedDelivery);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: 'Delay recorded',
        });
      }

      case 'return': {
        // Handle return request
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        const { reason } = body;

        if (!reason) {
          return NextResponse.json(
            { error: 'reason is required' },
            { status: 400 }
          );
        }

        const fulfillment = await handleReturn(award.id, reason, body.returnTrackingNumber);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: 'Return initiated',
        });
      }

      case 'release_payment': {
        // Manual payment release
        if (!award) {
          return NextResponse.json(
            { error: 'No award found for this RFQ' },
            { status: 404 }
          );
        }

        const { releasedBy, reason } = body;

        if (!releasedBy || !reason) {
          return NextResponse.json(
            { error: 'releasedBy and reason are required' },
            { status: 400 }
          );
        }

        const released = await manualPaymentRelease(award.id, releasedBy, reason);

        const fulfillment = await getFulfillmentByRfqId(rfqId);

        return NextResponse.json({
          success: true,
          fulfillment,
          paymentReleased: released,
          message: released ? 'Payment released manually' : 'Payment release failed',
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Valid actions: create, processing, ship, update_tracking, confirm_delivery, set_inspection, record_inspection, report_issue, resolve_issue, delay, return, release_payment`,
          },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error('Error in fulfillment operation:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Fulfillment operation failed',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update fulfillment (tracking, delivery confirmation, etc.)
// ============================================================================

interface PutRequestBody {
  // Tracking info
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  // Dates
  estimatedShipDate?: string;
  estimatedDeliveryDate?: string;
  // Delivery confirmation
  deliveryConfirmed?: boolean;
  confirmedBy?: string;
  proofUrl?: string;
  notes?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rfqId } = await params;
    const body = (await request.json()) as PutRequestBody;

    // Get award for this RFQ
    const award = await getAwardByRFQ(rfqId);

    if (!award) {
      return NextResponse.json(
        { error: 'No award found for this RFQ' },
        { status: 404 }
      );
    }

    // Check if fulfillment exists
    let fulfillment = await getFulfillmentByRfqId(rfqId);

    if (!fulfillment) {
      // Create fulfillment if it doesn't exist
      fulfillment = await getOrCreateFulfillment(award.id, rfqId);
    }

    const updates: string[] = [];

    // Update tracking info if provided
    if (body.carrier && body.trackingNumber) {
      const trackingInfo: TrackingInfo = {
        carrier: body.carrier,
        trackingNumber: body.trackingNumber,
        trackingUrl: body.trackingUrl || generateTrackingUrl(body.carrier, body.trackingNumber),
      };

      fulfillment = await addTrackingInfo(award.id, trackingInfo);
      updates.push('tracking info');
    }

    // Handle delivery confirmation if requested
    if (body.deliveryConfirmed) {
      const confirmedBy = body.confirmedBy || userId;

      let deliveryProof: DeliveryProof | undefined;
      if (body.proofUrl) {
        deliveryProof = {
          type: 'other',
          url: body.proofUrl,
          notes: body.notes,
        };
      }

      fulfillment = await recordDeliveryConfirmation(award.id, confirmedBy, deliveryProof);
      updates.push('delivery confirmation');
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      fulfillment,
      message: `Updated: ${updates.join(', ')}`,
    });
  } catch (error: unknown) {
    console.error('Error updating fulfillment:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update fulfillment',
      },
      { status: 500 }
    );
  }
}
