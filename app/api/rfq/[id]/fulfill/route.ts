/**
 * RFQ Fulfillment API
 * GET: Get fulfillment status
 * POST: Update fulfillment (shipping, delivery, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFulfillmentByRFQ,
  markShipped,
  updateTrackingStatus,
  confirmDelivery,
  reportIssue,
  resolveIssue,
  setInspectionRequired,
  recordInspection,
  manualPaymentRelease,
  generateTrackingUrl,
} from '@/lib/rfq/fulfillment-tracker';
import { getAwardByRFQ } from '@/lib/rfq/award-service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rfqId } = await params;

    const fulfillment = await getFulfillmentByRFQ(rfqId);

    if (!fulfillment) {
      return NextResponse.json({
        success: true,
        fulfillment: null,
        message: 'No fulfillment record found. RFQ may not be awarded yet.',
      });
    }

    return NextResponse.json({
      success: true,
      fulfillment,
    });
  } catch (error: any) {
    console.error('Error fetching fulfillment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fulfillment' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rfqId } = await params;
    const body = await req.json();
    const { action, ...data } = body;

    // Get the award to get award ID
    const award = await getAwardByRFQ(rfqId);
    if (!award) {
      return NextResponse.json(
        { error: 'No award found for this RFQ' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'ship': {
        // Mark as shipped with tracking info
        const { carrier, trackingNumber, estimatedDeliveryDate } = data;

        if (!carrier || !trackingNumber) {
          return NextResponse.json(
            { error: 'carrier and trackingNumber are required' },
            { status: 400 }
          );
        }

        const trackingUrl = data.trackingUrl || generateTrackingUrl(carrier, trackingNumber);

        const fulfillment = await markShipped(award.id, {
          carrier,
          trackingNumber,
          trackingUrl,
          estimatedDeliveryDate,
        });

        return NextResponse.json({
          success: true,
          fulfillment,
          trackingUrl,
          message: `Shipped via ${carrier}. Tracking: ${trackingNumber}`,
        });
      }

      case 'update_tracking': {
        // Update tracking status (for carrier webhook integration)
        const { trackingNumber, status } = data;

        if (!trackingNumber || !status) {
          return NextResponse.json(
            { error: 'trackingNumber and status are required' },
            { status: 400 }
          );
        }

        const fulfillment = await updateTrackingStatus(trackingNumber, status, data);

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
        const { confirmedBy, proofUrl, notes } = data;

        if (!confirmedBy) {
          return NextResponse.json(
            { error: 'confirmedBy is required' },
            { status: 400 }
          );
        }

        const fulfillment = await confirmDelivery({
          awardId: award.id,
          confirmedBy,
          proofUrl,
          notes,
        });

        return NextResponse.json({
          success: true,
          fulfillment,
          message: 'Delivery confirmed. Payment release initiated.',
        });
      }

      case 'report_issue': {
        // Report a delivery issue
        const { issueDescription } = data;

        if (!issueDescription) {
          return NextResponse.json(
            { error: 'issueDescription is required' },
            { status: 400 }
          );
        }

        const fulfillment = await reportIssue(award.id, issueDescription);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: 'Issue reported. Payment on hold.',
        });
      }

      case 'resolve_issue': {
        // Resolve a reported issue
        const { resolution } = data;

        if (!resolution) {
          return NextResponse.json(
            { error: 'resolution is required' },
            { status: 400 }
          );
        }

        const fulfillment = await resolveIssue(award.id, resolution);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: 'Issue resolved.',
        });
      }

      case 'set_inspection': {
        // Set inspection requirement
        const { required } = data;

        const fulfillment = await setInspectionRequired(award.id, required !== false);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: `Inspection ${required !== false ? 'required' : 'not required'}`,
        });
      }

      case 'record_inspection': {
        // Record inspection result
        const { passed, notes } = data;

        if (passed === undefined) {
          return NextResponse.json(
            { error: 'passed (boolean) is required' },
            { status: 400 }
          );
        }

        const fulfillment = await recordInspection(award.id, passed, notes);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: `Inspection ${passed ? 'passed' : 'failed'}`,
        });
      }

      case 'release_payment': {
        // Manual payment release
        const { releasedBy, reason } = data;

        if (!releasedBy || !reason) {
          return NextResponse.json(
            { error: 'releasedBy and reason are required' },
            { status: 400 }
          );
        }

        await manualPaymentRelease(award.id, releasedBy, reason);

        const fulfillment = await getFulfillmentByRFQ(rfqId);

        return NextResponse.json({
          success: true,
          fulfillment,
          message: 'Payment released manually.',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: ship, update_tracking, confirm_delivery, report_issue, resolve_issue, set_inspection, record_inspection, release_payment` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error in fulfillment operation:', error);
    return NextResponse.json(
      { error: error.message || 'Fulfillment operation failed' },
      { status: 500 }
    );
  }
}
