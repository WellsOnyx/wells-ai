// QuickBooks OAuth Initiation
import { NextRequest, NextResponse } from 'next/server';
import { quickbooks } from '@/lib/erp/quickbooks';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const state = searchParams.get('state');

    if (!state) {
      return NextResponse.json({ error: 'State parameter required' }, { status: 400 });
    }

    // Generate authorization URL
    const authUrl = quickbooks.getAuthorizationUrl(state);

    // Redirect to QuickBooks OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('QuickBooks connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
