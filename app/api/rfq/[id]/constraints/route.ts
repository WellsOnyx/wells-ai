/**
 * RFQ Constraints API
 * GET: Get buyer constraints for an RFQ
 * POST: Set new constraints
 * PUT: Update existing constraints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getConstraintsByRFQ,
  setConstraints,
  updateConstraints,
  parseConstraintsFromText,
} from '@/lib/rfq/constraint-service';
import { CreateConstraintsInput } from '@/lib/rfq/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: rfqId } = await params;

    const constraints = await getConstraintsByRFQ(rfqId);

    if (!constraints) {
      return NextResponse.json({
        success: true,
        constraints: null,
        message: 'No constraints set for this RFQ',
      });
    }

    return NextResponse.json({
      success: true,
      constraints,
    });
  } catch (error: any) {
    console.error('Error fetching constraints:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch constraints' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: rfqId } = await params;
    const body = await req.json();

    // Check if this is natural language input
    if (body.naturalLanguage) {
      const parsed = parseConstraintsFromText(body.naturalLanguage);
      const constraints = await setConstraints({
        rfqId,
        ...parsed,
        ...body, // Allow explicit overrides
      });

      return NextResponse.json({
        success: true,
        constraints,
        parsed,
        message: 'Constraints set from natural language input',
      });
    }

    // Direct constraint setting
    const constraintInput: CreateConstraintsInput = {
      rfqId,
      maxTotalBudget: body.maxTotalBudget,
      maxUnitPrice: body.maxUnitPrice,
      targetTotalPrice: body.targetTotalPrice,
      targetUnitPrice: body.targetUnitPrice,
      requiredDeliveryDate: body.requiredDeliveryDate,
      maxLeadTimeDays: body.maxLeadTimeDays,
      preferredLeadTimeDays: body.preferredLeadTimeDays,
      acceptablePaymentTerms: body.acceptablePaymentTerms,
      preferredPaymentTerms: body.preferredPaymentTerms,
      minimumWarrantyMonths: body.minimumWarrantyMonths,
      requiredCertifications: body.requiredCertifications,
      autoNegotiate: body.autoNegotiate,
      negotiationAggression: body.negotiationAggression,
      allowCounterOffers: body.allowCounterOffers,
      maxNegotiationRounds: body.maxNegotiationRounds,
    };

    const constraints = await setConstraints(constraintInput);

    return NextResponse.json({
      success: true,
      constraints,
      message: 'Constraints set successfully',
    });
  } catch (error: any) {
    console.error('Error setting constraints:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set constraints' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: rfqId } = await params;
    const body = await req.json();

    // Check if constraints exist
    const existingConstraints = await getConstraintsByRFQ(rfqId);

    if (!existingConstraints) {
      return NextResponse.json(
        { error: 'No constraints found for this RFQ. Use POST to create new constraints.' },
        { status: 404 }
      );
    }

    // Check if this is natural language input
    if (body.naturalLanguage) {
      const parsed = parseConstraintsFromText(body.naturalLanguage);
      const constraints = await updateConstraints(rfqId, {
        ...parsed,
        ...body, // Allow explicit overrides
      });

      return NextResponse.json({
        success: true,
        constraints,
        parsed,
        message: 'Constraints updated from natural language input',
      });
    }

    // Direct constraint update
    const updateInput: Partial<CreateConstraintsInput> = {};

    // Only include fields that are explicitly provided
    if (body.maxTotalBudget !== undefined) updateInput.maxTotalBudget = body.maxTotalBudget;
    if (body.maxUnitPrice !== undefined) updateInput.maxUnitPrice = body.maxUnitPrice;
    if (body.targetTotalPrice !== undefined) updateInput.targetTotalPrice = body.targetTotalPrice;
    if (body.targetUnitPrice !== undefined) updateInput.targetUnitPrice = body.targetUnitPrice;
    if (body.requiredDeliveryDate !== undefined) updateInput.requiredDeliveryDate = body.requiredDeliveryDate;
    if (body.maxLeadTimeDays !== undefined) updateInput.maxLeadTimeDays = body.maxLeadTimeDays;
    if (body.preferredLeadTimeDays !== undefined) updateInput.preferredLeadTimeDays = body.preferredLeadTimeDays;
    if (body.acceptablePaymentTerms !== undefined) updateInput.acceptablePaymentTerms = body.acceptablePaymentTerms;
    if (body.preferredPaymentTerms !== undefined) updateInput.preferredPaymentTerms = body.preferredPaymentTerms;
    if (body.minimumWarrantyMonths !== undefined) updateInput.minimumWarrantyMonths = body.minimumWarrantyMonths;
    if (body.requiredCertifications !== undefined) updateInput.requiredCertifications = body.requiredCertifications;
    if (body.autoNegotiate !== undefined) updateInput.autoNegotiate = body.autoNegotiate;
    if (body.negotiationAggression !== undefined) updateInput.negotiationAggression = body.negotiationAggression;
    if (body.allowCounterOffers !== undefined) updateInput.allowCounterOffers = body.allowCounterOffers;
    if (body.maxNegotiationRounds !== undefined) updateInput.maxNegotiationRounds = body.maxNegotiationRounds;

    const constraints = await updateConstraints(rfqId, updateInput);

    return NextResponse.json({
      success: true,
      constraints,
      message: 'Constraints updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating constraints:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update constraints' },
      { status: 500 }
    );
  }
}
