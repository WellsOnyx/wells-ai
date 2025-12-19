/**
 * RFQ Complete API
 * POST: Complete an RFQ (final sync to ERP, close records)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sqlQuery as sql } from '@/lib/db';
import { getAwardByRFQ, completeAward } from '@/lib/rfq/award-service';
import { getFulfillmentByRFQ } from '@/lib/rfq/fulfillment-tracker';
import { getERPSyncStatus, syncFulfillmentToERP } from '@/lib/rfq/erp-sync';
import { getQuotesByRFQ } from '@/lib/rfq/quote-service';
import { getNegotiationsByRFQ } from '@/lib/rfq/negotiation-engine';
import { getConstraintsByRFQ } from '@/lib/rfq/constraint-service';
import { RFQWithFlow, CompleteRFQResponse } from '@/lib/rfq/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rfqId } = await params;

    // Get complete RFQ status
    const rfqResult = await sql`
      SELECT * FROM rfqs WHERE id = ${rfqId}
    `;

    if (rfqResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'RFQ not found' },
        { status: 404 }
      );
    }

    const rfq = rfqResult.rows[0];
    const award = await getAwardByRFQ(rfqId);
    const fulfillment = await getFulfillmentByRFQ(rfqId);
    const erpStatus = await getERPSyncStatus(rfqId);
    const quotes = await getQuotesByRFQ(rfqId);
    const negotiations = await getNegotiationsByRFQ(rfqId);
    const constraints = await getConstraintsByRFQ(rfqId);

    return NextResponse.json({
      success: true,
      rfq: {
        id: rfq.id,
        category: rfq.category,
        description: rfq.description,
        quantity: rfq.quantity,
        targetPrice: rfq.target_price,
        urgency: rfq.urgency,
        status: rfq.status,
        createdAt: rfq.created_at,
        updatedAt: rfq.updated_at,
      },
      constraints,
      quotes: quotes.map(q => ({
        id: q.id,
        supplierId: q.supplierId,
        supplierName: q.supplier?.companyName,
        unitPrice: q.unitPrice,
        totalPrice: q.totalPrice,
        leadTimeDays: q.leadTimeDays,
        paymentTerms: q.paymentTerms,
        status: q.status,
        notes: q.notes,
      })),
      negotiations: negotiations.map(n => ({
        id: n.id,
        quoteId: n.quoteId,
        status: n.status,
        outcome: n.outcome,
        currentRound: n.currentRound,
        maxRounds: n.maxRounds,
        messages: n.messages,
        finalTerms: n.finalTerms,
        savings: n.totalPriceReduction,
        savingsPercentage: n.reductionPercentage,
      })),
      award: award ? {
        id: award.id,
        quoteId: award.quoteId,
        amount: award.awardAmount,
        status: award.status,
        dealId: award.dealId,
        erpPoNumber: award.erpPoNumber,
      } : null,
      fulfillment: fulfillment ? {
        status: fulfillment.status,
        trackingNumber: fulfillment.trackingNumber,
        carrier: fulfillment.carrier,
        deliveryConfirmed: fulfillment.deliveryConfirmed,
        estimatedDeliveryDate: fulfillment.estimatedDeliveryDate,
      } : null,
      erpStatus,
      canComplete: canCompleteRFQ(rfq, award, fulfillment),
    });
  } catch (error: any) {
    console.error('Error fetching RFQ status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch RFQ status' },
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
    const { force } = body;

    // Get all related data
    const rfqResult = await sql`
      SELECT * FROM rfqs WHERE id = ${rfqId}
    `;

    if (rfqResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'RFQ not found' },
        { status: 404 }
      );
    }

    const rfq = rfqResult.rows[0];
    const award = await getAwardByRFQ(rfqId);
    const fulfillment = await getFulfillmentByRFQ(rfqId);

    // Check if can complete
    const canComplete = canCompleteRFQ(rfq, award, fulfillment);

    if (!canComplete.ready && !force) {
      return NextResponse.json({
        success: false,
        error: 'RFQ cannot be completed yet',
        reasons: canComplete.blockers,
        hint: 'Use force=true to complete anyway',
      }, { status: 400 });
    }

    // Complete the award if not already
    if (award && award.status !== 'completed') {
      await completeAward(award.id);
    }

    // Final ERP sync
    let erpSync = {
      poCreated: false,
      poNumber: undefined as string | undefined,
      invoiceCreated: false,
      invoiceNumber: undefined as string | undefined,
      receiptCreated: false,
      receiptNumber: undefined as string | undefined,
    };

    try {
      const erpStatus = await getERPSyncStatus(rfqId);
      erpSync.poCreated = erpStatus.poCreated;
      erpSync.poNumber = erpStatus.poNumber;

      // Sync invoice if fulfillment exists
      if (fulfillment && award) {
        try {
          const invoiceResult = await syncFulfillmentToERP(award.id, fulfillment);
          erpSync.invoiceCreated = true;
          erpSync.invoiceNumber = invoiceResult.invoiceNumber;
        } catch (e) {
          console.error('Invoice sync failed:', e);
        }
      }

      erpSync.receiptCreated = !!fulfillment?.erpReceiptId;
      erpSync.receiptNumber = fulfillment?.erpReceiptId;
    } catch (e) {
      console.error('ERP sync check failed:', e);
    }

    // Calculate payment info
    let payment = {
      escrowReleased: false,
      sellerPaid: false,
      feeCollected: 0,
    };

    if (award) {
      payment.feeCollected = award.awardAmount * 0.01; // 1% fee
      payment.escrowReleased = award.status === 'completed';
      payment.sellerPaid = award.status === 'completed';
    }

    // Update RFQ to completed
    await sql`
      UPDATE rfqs
      SET status = 'completed', updated_at = NOW()
      WHERE id = ${rfqId}
    `;

    // Get final state
    const updatedRfqResult = await sql`
      SELECT * FROM rfqs WHERE id = ${rfqId}
    `;
    const updatedRfq = updatedRfqResult.rows[0];
    const updatedAward = await getAwardByRFQ(rfqId);
    const updatedFulfillment = await getFulfillmentByRFQ(rfqId);

    return NextResponse.json({
      success: true,
      message: 'RFQ completed successfully',
      rfq: {
        id: updatedRfq.id,
        category: updatedRfq.category,
        description: updatedRfq.description,
        quantity: updatedRfq.quantity,
        status: updatedRfq.status,
        createdAt: updatedRfq.created_at,
        updatedAt: updatedRfq.updated_at,
      },
      award: updatedAward,
      fulfillment: updatedFulfillment,
      erpSync,
      payment,
    } as { success: true; message: string } & Partial<CompleteRFQResponse>);
  } catch (error: any) {
    console.error('Error completing RFQ:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete RFQ' },
      { status: 500 }
    );
  }
}

function canCompleteRFQ(
  rfq: any,
  award: any | null,
  fulfillment: any | null
): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];

  // Check RFQ status
  if (!['awarded', 'paid', 'fulfilling', 'delivered'].includes(rfq.status)) {
    blockers.push(`RFQ status is ${rfq.status}, must be at least 'awarded'`);
  }

  // Check award exists
  if (!award) {
    blockers.push('No award exists for this RFQ');
  } else {
    // Check award status
    if (!['paid', 'fulfilled', 'completed'].includes(award.status)) {
      blockers.push(`Award status is ${award.status}, should be 'paid' or later`);
    }
  }

  // Check fulfillment
  if (!fulfillment) {
    blockers.push('No fulfillment record exists');
  } else {
    if (!fulfillment.deliveryConfirmed) {
      blockers.push('Delivery not confirmed');
    }
    if (fulfillment.hasIssues) {
      blockers.push('Unresolved issues with fulfillment');
    }
    if (fulfillment.inspectionRequired && fulfillment.inspectionStatus !== 'passed') {
      blockers.push('Inspection required but not passed');
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}
