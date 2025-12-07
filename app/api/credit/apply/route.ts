/**
 * Credit Application API
 * POST /api/credit/apply - Start credit application
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCreditApplication } from '@/lib/underwriting/decision';
import { createLinkToken } from '@/lib/underwriting/plaid';
import { createCompany, getLinkUrl } from '@/lib/underwriting/codat';

export async function POST(req: NextRequest) {
  try {
    const { userId, requestedAmount, connectAccounting } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Create Plaid Link token
    const plaidLinkToken = await createLinkToken(userId);

    // Optionally create Codat connection
    let codatLinkUrl: string | undefined;
    let codatCompanyId: string | undefined;

    if (connectAccounting) {
      codatCompanyId = await createCompany(`User ${userId}`, userId);
      codatLinkUrl = await getLinkUrl(codatCompanyId);
    }

    // Create application record
    const application = await createCreditApplication(userId, requestedAmount);

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      plaidLinkToken,
      codatLinkUrl,
      codatCompanyId,
    });
  } catch (error) {
    console.error('Error starting credit application:', error);
    return NextResponse.json(
      { error: 'Failed to start credit application' },
      { status: 500 }
    );
  }
}
