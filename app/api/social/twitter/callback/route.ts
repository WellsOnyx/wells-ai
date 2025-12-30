// Twitter OAuth Callback - Exchange code for tokens
import { NextRequest, NextResponse } from 'next/server';
import { TwitterClient } from '@/lib/social/twitter-client';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.json(
        { error: `OAuth error: ${error}` },
        { status: 400 }
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state parameter' },
        { status: 400 }
      );
    }

    // Get stored verifier
    const verifierResult = await sql`
      SELECT value FROM grain_system_controls
      WHERE id = ${`twitter_oauth_${state}`}
    `;

    if (verifierResult.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired state' },
        { status: 400 }
      );
    }

    const codeVerifier = verifierResult[0].value;

    // Exchange code for tokens
    const clientId = process.env.TWITTER_CLIENT_ID!;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/twitter/callback`;

    const client = new TwitterClient({ clientId, clientSecret });

    const tokens = await client.exchangeCodeForTokens(
      code,
      redirectUri,
      codeVerifier
    );

    // Store tokens securely
    await sql`
      INSERT INTO grain_system_controls (id, control_type, value, metadata)
      VALUES (
        'twitter_access_token',
        'oauth_token',
        ${tokens.accessToken},
        ${JSON.stringify({
          scope: tokens.scope,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
        })}
      )
      ON CONFLICT (id) DO UPDATE SET
        value = ${tokens.accessToken},
        metadata = ${JSON.stringify({
          scope: tokens.scope,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
        })}
    `;

    await sql`
      INSERT INTO grain_system_controls (id, control_type, value, metadata)
      VALUES (
        'twitter_refresh_token',
        'oauth_token',
        ${tokens.refreshToken},
        ${JSON.stringify({ updatedAt: Date.now() })}
      )
      ON CONFLICT (id) DO UPDATE SET
        value = ${tokens.refreshToken},
        metadata = ${JSON.stringify({ updatedAt: Date.now() })}
    `;

    // Clean up verifier
    await sql`
      DELETE FROM grain_system_controls
      WHERE id = ${`twitter_oauth_${state}`}
    `;

    // Log success
    await sql`
      INSERT INTO grain_audit_logs (id, event_type, actor_id, entity_type, entity_id, metadata)
      VALUES (
        ${`audit_${Date.now()}`},
        'twitter_oauth_complete',
        'system',
        'oauth',
        'twitter',
        ${JSON.stringify({ scope: tokens.scope })}
      )
    `;

    // Redirect to success page or dashboard
    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/social?twitter=connected`;

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('Twitter OAuth callback error:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth', details: String(error) },
      { status: 500 }
    );
  }
}
