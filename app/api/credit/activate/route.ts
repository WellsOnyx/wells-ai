/**
 * Credit Line Activation API
 * POST /api/credit/activate - Activate approved credit line
 */

import { NextRequest, NextResponse } from 'next/server';
import { activateCreditLine } from '@/lib/underwriting/decision';

export async function POST(req: NextRequest) {
  try {
    const { applicationId, autoPayEnabled, autoPayAccountId } = await req.json();

    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID required' }, { status: 400 });
    }

    // Activate credit line
    const creditLine = await activateCreditLine(
      applicationId,
      autoPayEnabled || false,
      autoPayAccountId
    );

    return NextResponse.json({
      success: true,
      creditLine: {
        id: creditLine.id,
        creditLimit: creditLine.creditLimit,
        availableCredit: creditLine.availableCredit,
        apr: creditLine.apr,
        status: creditLine.status,
        riskTier: creditLine.riskTier,
        activatedAt: creditLine.activatedAt,
        autoPayEnabled: creditLine.autoPayEnabled,
      },
    });
  } catch (error) {
    console.error('Error activating credit line:', error);
    return NextResponse.json(
      { error: 'Failed to activate credit line' },
      { status: 500 }
    );
  }
}
