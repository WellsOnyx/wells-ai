import { NextRequest, NextResponse } from 'next/server';

// Admin API route for updating NAV
export async function POST(request: NextRequest) {
  try {
    const { newNav } = await request.json();

    if (!newNav || isNaN(parseFloat(newNav))) {
      return NextResponse.json(
        { error: 'Invalid NAV value' },
        { status: 400 }
      );
    }

    // In production:
    // 1. Verify admin authentication
    // 2. Call smart contract updateNAV function
    // 3. Log the update for audit trail
    // 4. Emit event for real-time updates

    console.log(`NAV updated to: $${newNav}`);

    return NextResponse.json({
      success: true,
      newNav,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating NAV:', error);
    return NextResponse.json(
      { error: 'Failed to update NAV' },
      { status: 500 }
    );
  }
}
