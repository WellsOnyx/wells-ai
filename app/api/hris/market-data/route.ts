/**
 * HRIS Market Data API
 *
 * Get salary market data for job roles and locations
 *
 * POST - Get market data for a role/location combination
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMarketData } from '@/lib/jobs/offer-negotiation';

// Get market data for a role
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, location, experienceYears } = body;

    if (!role) {
      return NextResponse.json({
        success: false,
        message: "I need a job role to research salary data.",
      }, { status: 400 });
    }

    const marketData = await getMarketData(
      role,
      location || 'remote',
      experienceYears || 5
    );

    // Format the response conversationally
    const message = `Market data for ${role} in ${location || 'remote locations'}:

**Salary Range** (based on ${marketData.experienceLevel} level):
- 25th percentile: $${marketData.percentile25.toLocaleString()}
- 50th percentile (median): $${marketData.percentile50.toLocaleString()}
- 75th percentile: $${marketData.percentile75.toLocaleString()}
- 90th percentile: $${marketData.percentile90.toLocaleString()}

**Typical Signing Bonus**: $${marketData.averageSigningBonus?.toLocaleString() || 'Varies'}
**Equity Range**: ${marketData.equityRange?.min || 0}% - ${marketData.equityRange?.max || 0}%

Based on ${experienceYears || 'your'} years of experience, I'd target the ${marketData.percentile50.toLocaleString()} - $${marketData.percentile75.toLocaleString()} range.`;

    return NextResponse.json({
      success: true,
      message,
      marketData,
    });
  } catch (error) {
    console.error('Error in HRIS market-data POST:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble fetching market data.",
    }, { status: 500 });
  }
}

// Allow GET with query params for convenience
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const location = searchParams.get('location');
    const experienceYears = searchParams.get('experienceYears');

    if (!role) {
      return NextResponse.json({
        success: false,
        message: "I need a job role to research salary data.",
      }, { status: 400 });
    }

    const marketData = await getMarketData(
      role,
      location || 'remote',
      experienceYears ? parseInt(experienceYears) : 5
    );

    return NextResponse.json({
      success: true,
      message: `Market data for ${role}: $${marketData.percentile25.toLocaleString()} - $${marketData.percentile90.toLocaleString()} (25th-90th percentile).`,
      marketData,
    });
  } catch (error) {
    console.error('Error in HRIS market-data GET:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble fetching market data.",
    }, { status: 500 });
  }
}
