// @ts-nocheck
/**
 * X (Twitter) OAuth2 Callback
 *
 * Handles the OAuth callback and exchanges code for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { exchangeCodeForTokens } from '@/lib/inbox/providers/twitter-dm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('Twitter OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/inbox?error=twitter_auth_failed`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/inbox?error=missing_params`
      );
    }

    // Retrieve and validate state
    const stateResult = await sql`
      SELECT * FROM oauth_states
      WHERE state = ${state}
        AND provider = 'twitter'
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (stateResult.rows.length === 0) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/inbox?error=invalid_state`
      );
    }

    const { account_id: accountId, code_verifier: codeVerifier, redirect_uri: redirectUri } = stateResult.rows[0];

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

    // Store tokens
    await sql`
      INSERT INTO twitter_tokens (
        account_id, twitter_user_id, access_token, refresh_token, expires_at, created_at
      ) VALUES (
        ${accountId}, ${tokens.twitter_user_id}, ${tokens.access_token},
        ${tokens.refresh_token}, ${tokens.expires_at}, NOW()
      )
      ON CONFLICT (account_id) DO UPDATE SET
        twitter_user_id = ${tokens.twitter_user_id},
        access_token = ${tokens.access_token},
        refresh_token = ${tokens.refresh_token},
        expires_at = ${tokens.expires_at},
        updated_at = NOW()
    `;

    // Clean up state
    await sql`DELETE FROM oauth_states WHERE state = ${state}`;

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/inbox?connected=twitter`
    );
  } catch (error) {
    console.error('Twitter callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/inbox?error=token_exchange_failed`
    );
  }
}
