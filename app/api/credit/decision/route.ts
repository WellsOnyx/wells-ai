/**
 * Credit Decision API
 * POST /api/credit/decision - Get instant credit decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { processCreditApplication } from '@/lib/underwriting/decision';
import { exchangePublicToken } from '@/lib/underwriting/plaid';
import { sql } from '@vercel/postgres';

export async function POST(req: NextRequest) {
  try {
    const { applicationId, plaidPublicToken, codatCompanyId } = await req.json();

    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID required' }, { status: 400 });
    }

    // Exchange Plaid public token if provided
    let plaidAccessToken: string | undefined;
    if (plaidPublicToken) {
      const bankConnection = await exchangePublicToken(plaidPublicToken);
      plaidAccessToken = bankConnection.accessToken;

      // Update application with Plaid data
      await sql`
        UPDATE credit_applications
        SET
          plaid_access_token = ${plaidAccessToken},
          plaid_item_id = ${bankConnection.itemId}
        WHERE id = ${applicationId}
      `;
    }

    // Update Codat company ID if provided
    if (codatCompanyId) {
      await sql`
        UPDATE credit_applications
        SET codat_company_id = ${codatCompanyId}
        WHERE id = ${applicationId}
      `;
    }

    // Process application and get decision
    const decision = await processCreditApplication(applicationId);

    return NextResponse.json({
      success: true,
      decision: {
        approved: decision.approved,
        approvedAmount: decision.approvedAmount,
        apr: decision.apr,
        creditScore: decision.creditScore.score,
        grade: decision.creditScore.grade,
        riskTier: decision.creditScore.riskTier,
        breakdown: decision.creditScore.breakdown,
        positiveFactors: decision.creditScore.positiveFactors,
        negativeFactors: decision.creditScore.negativeFactors,
        rejectionReason: decision.rejectionReason,
        conditions: decision.conditions,
      },
    });
  } catch (error) {
    console.error('Error processing credit decision:', error);
    return NextResponse.json(
      { error: 'Failed to process credit decision' },
      { status: 500 }
    );
  }
}
