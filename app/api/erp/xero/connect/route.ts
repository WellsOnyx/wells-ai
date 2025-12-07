// Xero OAuth Initiation
import { NextRequest, NextResponse } from 'next/server';
import { xero } from '@/lib/erp/xero';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const state = searchParams.get('state');

    if (!state) {
      return NextResponse.json({ error: 'State parameter required' }, { status: 400 });
    }

    // Generate authorization URL
    const authUrl = xero.getAuthorizationUrl(state);

    // Redirect to Xero OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Xero connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
