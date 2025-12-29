/**
 * HRIS Offer API
 *
 * Handle job offers and negotiations
 *
 * GET - Get offer details and analysis
 * POST - Record a new offer
 * PUT - Submit counter offer or negotiate
 * PATCH - Accept or reject offer
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  recordOffer,
  submitCounterOffer,
  acceptOffer,
  rejectOffer,
} from '@/lib/hris/merge-hris-client';
import {
  analyzeOffer,
  autoNegotiate,
  getNegotiationHistory,
  getMarketData,
  generateNegotiationResponse,
} from '@/lib/jobs/offer-negotiation';
import {
  createPlacementFee,
  calculatePlacementFee,
} from '@/lib/jobs/placement-fee-service';

// Get offer details with analysis
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offerId = searchParams.get('offerId');
    const userId = searchParams.get('userId');
    const includeHistory = searchParams.get('includeHistory') === 'true';

    if (!offerId) {
      return NextResponse.json({
        success: false,
        message: "I need an offer ID to look it up.",
      }, { status: 400 });
    }

    // Get candidate constraints
    const { getCandidateProfile } = await import('@/lib/jobs/candidate-agent');
    const profile = userId ? await getCandidateProfile(userId) : null;

    // Get offer analysis
    const constraints = profile?.profile?.constraints || {
      minSalary: 100000,
      targetSalary: 150000,
    };

    const analysisResult = await analyzeOffer(offerId, constraints);

    // Get negotiation history if requested
    let history;
    if (includeHistory) {
      const historyResult = await getNegotiationHistory(offerId);
      history = historyResult.history;
    }

    return NextResponse.json({
      success: analysisResult.success,
      message: analysisResult.message,
      analysis: analysisResult.analysis,
      history,
    });
  } catch (error) {
    console.error('Error in HRIS offer GET:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble analyzing that offer.",
    }, { status: 500 });
  }
}

// Record a new offer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId, offer, userId, autoAnalyze } = body;

    if (!applicationId || !offer || !offer.baseSalary) {
      return NextResponse.json({
        success: false,
        message: "I need the application ID and offer details (at least base salary).",
      }, { status: 400 });
    }

    // Record the offer
    const result = await recordOffer(applicationId, {
      baseSalary: offer.baseSalary,
      currency: offer.currency,
      salaryPeriod: offer.salaryPeriod,
      signingBonus: offer.signingBonus,
      equity: offer.equity,
      bonusTarget: offer.bonusTarget,
      relocationBonus: offer.relocationBonus,
      startDate: offer.startDate ? new Date(offer.startDate) : undefined,
      expiresAt: offer.expiresAt ? new Date(offer.expiresAt) : undefined,
      title: offer.title,
      department: offer.department,
      location: offer.location,
    });

    // Auto-analyze if requested
    if (autoAnalyze && result.success && result.offerId && userId) {
      const { getCandidateProfile } = await import('@/lib/jobs/candidate-agent');
      const profile = await getCandidateProfile(userId);

      if (profile.profile?.constraints) {
        const analysis = await analyzeOffer(result.offerId, profile.profile.constraints);
        return NextResponse.json({
          ...result,
          analysis: analysis.analysis,
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS offer POST:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble recording that offer.",
    }, { status: 500 });
  }
}

// Submit counter offer or auto-negotiate
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { offerId, userId, action, counterOffer, strategy } = body;

    if (!offerId) {
      return NextResponse.json({
        success: false,
        message: "I need an offer ID.",
      }, { status: 400 });
    }

    // Auto-negotiate
    if (action === 'auto_negotiate') {
      const { getCandidateProfile } = await import('@/lib/jobs/candidate-agent');
      const profile = userId ? await getCandidateProfile(userId) : null;

      const constraints = profile?.profile?.constraints || {
        minSalary: 100000,
        targetSalary: 150000,
      };

      const result = await autoNegotiate(offerId, constraints, strategy || 'moderate');

      return NextResponse.json(result);
    }

    // Manual counter offer
    if (action === 'counter' && counterOffer) {
      const result = await submitCounterOffer(offerId, {
        baseSalary: counterOffer.baseSalary,
        signingBonus: counterOffer.signingBonus,
        equity: counterOffer.equity,
        startDate: counterOffer.startDate ? new Date(counterOffer.startDate) : undefined,
        otherTerms: counterOffer.otherTerms,
        rationale: counterOffer.rationale || 'Based on my experience and market rates.',
      });

      return NextResponse.json(result);
    }

    // Get advice
    if (action === 'advice') {
      const { getCandidateProfile } = await import('@/lib/jobs/candidate-agent');
      const profile = userId ? await getCandidateProfile(userId) : null;

      const constraints = profile?.profile?.constraints || {
        minSalary: 100000,
        targetSalary: 150000,
      };

      const analysisResult = await analyzeOffer(offerId, constraints);
      const advice = generateNegotiationResponse(analysisResult.analysis, 'ask_advice');

      return NextResponse.json({
        success: true,
        message: advice,
        analysis: analysisResult.analysis,
      });
    }

    return NextResponse.json({
      success: false,
      message: "I need an action: 'auto_negotiate', 'counter', or 'advice'.",
    }, { status: 400 });
  } catch (error) {
    console.error('Error in HRIS offer PUT:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble with that negotiation action.",
    }, { status: 500 });
  }
}

// Accept or reject offer
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { offerId, action, reason, userId } = body;

    if (!offerId || !action) {
      return NextResponse.json({
        success: false,
        message: "I need an offer ID and action (accept/reject).",
      }, { status: 400 });
    }

    if (action === 'accept') {
      const result = await acceptOffer(offerId);

      // Create placement fee if successful
      if (result.success && result.placement) {
        const { query } = await import('@/lib/db');

        // Get candidate details
        const candidateResult = await query(
          `SELECT c.user_id, c.first_name, c.last_name, o.application_id,
                  j.employer_id, j.employer_name, j.title
           FROM hris_offers o
           JOIN hris_applications a ON o.application_id = a.id
           JOIN hris_candidates c ON a.candidate_id = c.id
           JOIN hris_job_postings j ON a.job_posting_id = j.id
           WHERE o.id = $1`,
          [offerId]
        );

        if (candidateResult.rows.length > 0) {
          const data = candidateResult.rows[0];

          await createPlacementFee({
            id: result.placement.id,
            candidateUserId: data.user_id,
            candidateName: `${data.first_name} ${data.last_name}`,
            employerId: data.employer_id,
            employerName: data.employer_name,
            jobTitle: data.title,
            annualSalary: result.placement.salary,
            startDate: result.placement.startDate,
          });

          // Calculate and show fee info
          const feeCalc = calculatePlacementFee(result.placement.salary);

          return NextResponse.json({
            ...result,
            placementFee: {
              total: feeCalc.totalFeeAmount,
              candidatePortion: feeCalc.candidateFeeAmount,
              employerPortion: feeCalc.employerFeeAmount,
              breakdown: feeCalc.breakdown,
            },
            message: result.message + ` A placement fee of $${feeCalc.candidateFeeAmount.toLocaleString()} (0.5% of your salary) will be due 30 days after you start.`,
          });
        }
      }

      return NextResponse.json(result);
    }

    if (action === 'reject') {
      const result = await rejectOffer(offerId, reason);

      return NextResponse.json(result);
    }

    return NextResponse.json({
      success: false,
      message: "Action must be 'accept' or 'reject'.",
    }, { status: 400 });
  } catch (error) {
    console.error('Error in HRIS offer PATCH:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble processing that offer decision.",
    }, { status: 500 });
  }
}
