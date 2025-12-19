/**
 * RFQ Constraints API
 * GET: Get buyer constraints for an RFQ
 * POST: Set/update constraints
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getConstraintsByRFQ,
  setConstraints,
  parseConstraintsFromText,
} from '@/lib/rfq/constraint-service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const constraints = await setConstraints({
      rfqId,
      ...body,
    });

    return NextResponse.json({
      success: true,
      constraints,
    });
  } catch (error: any) {
    console.error('Error setting constraints:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set constraints' },
      { status: 500 }
    );
  }
}
