import { NextRequest, NextResponse } from 'next/server';

// Sample API route for fetching escrow milestones
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const escrowId = params.id;

    // In production: Fetch from blockchain via RPC
    // For now, return mock data
    const milestonesData = {
      names: [
        'Initial Delivery',
        'Quality Review',
        'Integration Complete',
        'Final Acceptance',
      ],
      percentages: [2500, 2500, 2500, 2500], // 25% each, in basis points
      completed: [true, false, false, false],
    };

    return NextResponse.json(milestonesData);
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
      { status: 500 }
    );
  }
}
