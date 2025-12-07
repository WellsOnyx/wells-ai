// @ts-nocheck
/**
 * Rate Quote API
 * POST /api/lending/rates - Get personalized rate quote (soft pull)
 */

import { NextResponse } from 'next/server';
import { getRateQuote } from '@/lib/lending/rates';
import { preQualify } from '@/lib/lending/underwriting';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      productCode,
      loanAmount,
      creditScoreRange, // { min: 650, max: 699 }
      grainStaked,
      points,
      propertyValue,
      vehicleValue,
      annualIncome,
      monthlyDebts,
    } = body;

    // Validation
    if (!productCode || !loanAmount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product code and loan amount are required',
        },
        { status: 400 }
      );
    }

    // If credit score range provided, do pre-qualification first
    let preQualification;
    if (creditScoreRange && annualIncome && monthlyDebts) {
      preQualification = preQualify(
        creditScoreRange,
        annualIncome,
        monthlyDebts,
        loanAmount,
        productCode
      );
    }

    // Get rate quote using average credit score if range provided
    const creditScore = creditScoreRange
      ? (creditScoreRange.min + creditScoreRange.max) / 2
      : undefined;

    const quote = getRateQuote({
      productCode,
      loanAmount,
      creditScore,
      grainStaked,
      points,
      propertyValue,
      vehicleValue,
    });

    return NextResponse.json({
      success: true,
      quote,
      preQualification,
      disclaimer:
        'Rate quote is an estimate only. Actual rate may vary based on full application review. This is not a credit inquiry and does not affect your credit score.',
    });
  } catch (error) {
    console.error('Error generating rate quote:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate rate quote',
      },
      { status: 500 }
    );
  }
}
