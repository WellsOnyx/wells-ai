import { NextRequest, NextResponse } from 'next/server';

// Sample API route for fetching escrow details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const escrowId = params.id;

    // In production: Fetch from blockchain via RPC
    // For now, return mock data
    const escrowData = {
      creator: '0x1234567890123456789012345678901234567890',
      counterparty: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      amount: '1000000000000000000000', // 1000 GRAIN in wei
      released: '250000000000000000000', // 250 GRAIN released
      status: 0, // ACTIVE
      resolver: '0x9876543210987654321098765432109876543210',
    };

    return NextResponse.json(escrowData);
  } catch (error) {
    console.error('Error fetching escrow:', error);
    return NextResponse.json(
      { error: 'Failed to fetch escrow' },
      { status: 500 }
    );
  }
}
