// @ts-nocheck
/**
 * X (Twitter) OAuth2 Authorization
 *
 * Initiates OAuth 2.0 with PKCE flow for Twitter DM access
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getAuthorizationUrl } from '@/lib/inbox/providers/twitter-dm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    // Generate redirect URI
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wellsonyx.io';
    const redirectUri = `${baseUrl}/api/inbox/twitter/callback`;

    // Get authorization URL
    const { url, state, codeVerifier } = getAuthorizationUrl(accountId, redirectUri);

    // Store state and code verifier for callback
    await sql`
      INSERT INTO oauth_states (
        state, account_id, provider, code_verifier, redirect_uri, created_at, expires_at
      ) VALUES (
        ${state}, ${accountId}, 'twitter', ${codeVerifier}, ${redirectUri},
        NOW(), NOW() + INTERVAL '10 minutes'
      )
    `;

    return NextResponse.json({
      authUrl: url,
      state,
    });
  } catch (error) {
    console.error('Twitter auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize Twitter auth' },
      { status: 500 }
    );
  }
}
