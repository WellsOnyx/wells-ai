/**
 * Outlook (Microsoft) OAuth API Endpoints
 *
 * Handles Outlook OAuth flow with PKCE:
 * - GET /api/integrations/outlook/auth - Initiate OAuth flow
 * - GET /api/integrations/outlook/auth?callback=true - Handle OAuth callback
 * - POST /api/integrations/outlook/auth - Refresh token
 * - DELETE /api/integrations/outlook/auth - Disconnect account
 *
 * Designed for seamless UX like Superhuman's setup flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOutlookAuthUrl,
  exchangeOutlookCode,
  refreshOutlookToken,
  getOutlookProfile,
  OUTLOOK_SCOPES,
} from '@/lib/integrations/outlook-oauth';
import {
  getConnectionsByProvider,
  getConnection,
  disconnectEmail,
  deleteConnection,
  getConnectionWithHealth,
} from '@/lib/integrations/oauth-manager';

export const dynamic = 'force-dynamic';

// ============================================================================
// HELPERS
// ============================================================================

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
}

function getUserId(request: NextRequest): string | null {
  // In production, extract from session/JWT
  // For now, check header or query param
  const authHeader = request.headers.get('x-user-id');
  if (authHeader) return authHeader;

  const searchParams = request.nextUrl.searchParams;
  return searchParams.get('userId') || searchParams.get('user_id');
}

// ============================================================================
// GET - Initiate OAuth or Handle Callback
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = getBaseUrl(request);

  // Check if this is an OAuth callback
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (code && state) {
    // This is the OAuth callback
    return handleCallback(request, baseUrl, code, state);
  }

  if (error) {
    // OAuth error from Microsoft
    const errorDescription = searchParams.get('error_description') || error;
    console.error('[Outlook OAuth] Error from Microsoft:', error, errorDescription);

    const returnUrl = searchParams.get('return_url') || '/settings/integrations';
    return NextResponse.redirect(
      `${baseUrl}${returnUrl}?error=${encodeURIComponent(errorDescription)}&provider=outlook`
    );
  }

  // Initiate OAuth flow
  return initiateAuth(request, baseUrl);
}

/**
 * Initiate Outlook OAuth flow with PKCE
 */
async function initiateAuth(request: NextRequest, baseUrl: string) {
  try {
    const userId = getUserId(request);
    const searchParams = request.nextUrl.searchParams;
    const returnUrl = searchParams.get('return_url') || searchParams.get('returnUrl');

    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to connect your Outlook account',
        },
        { status: 401 }
      );
    }

    // Check if Microsoft OAuth is configured
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      return NextResponse.json(
        {
          error: 'Outlook OAuth not configured',
          message: 'Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables',
        },
        { status: 503 }
      );
    }

    const redirectUri = `${baseUrl}/api/integrations/outlook/auth`;

    // Generate authorization URL with PKCE
    const { url, state } = await getOutlookAuthUrl({
      userId,
      redirectUri,
      returnUrl: returnUrl || undefined,
    });

    // For API calls, return the URL. For browser navigation, redirect.
    const acceptHeader = request.headers.get('accept') || '';
    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({
        authUrl: url,
        state,
        provider: 'outlook',
        scopes: OUTLOOK_SCOPES,
      });
    }

    // Redirect to Microsoft
    return NextResponse.redirect(url);
  } catch (error: any) {
    console.error('[Outlook OAuth] Initiate error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Outlook OAuth', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle OAuth callback from Microsoft
 */
async function handleCallback(
  request: NextRequest,
  baseUrl: string,
  code: string,
  state: string
) {
  try {
    const redirectUri = `${baseUrl}/api/integrations/outlook/auth`;

    // Exchange code for tokens (includes PKCE verification)
    const result = await exchangeOutlookCode({
      code,
      state,
      redirectUri,
    });

    // Determine return URL
    const searchParams = request.nextUrl.searchParams;
    let returnUrl = searchParams.get('return_url') || '/settings/integrations';

    if (result.success) {
      console.log(`[Outlook OAuth] Successfully connected: ${result.email}`);

      // Success redirect with connection info
      const successParams = new URLSearchParams({
        success: 'true',
        provider: 'outlook',
        email: result.email || '',
        connectionId: result.connectionId || '',
      });

      return NextResponse.redirect(
        `${baseUrl}${returnUrl}?${successParams.toString()}`
      );
    } else {
      console.error('[Outlook OAuth] Exchange failed:', result.error);

      // Error redirect
      return NextResponse.redirect(
        `${baseUrl}${returnUrl}?error=${encodeURIComponent(result.error || 'Unknown error')}&provider=outlook`
      );
    }
  } catch (error: any) {
    console.error('[Outlook OAuth] Callback error:', error);

    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?error=${encodeURIComponent('OAuth callback failed')}&provider=outlook`
    );
  }
}

// ============================================================================
// POST - Refresh Token or Get Status
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, connectionId, email } = body;

    switch (action) {
      case 'refresh': {
        // Refresh a specific connection's token
        if (!connectionId) {
          return NextResponse.json(
            { error: 'connectionId required for refresh' },
            { status: 400 }
          );
        }

        const tokens = await refreshOutlookToken(connectionId);
        if (!tokens) {
          return NextResponse.json(
            { error: 'Failed to refresh token', needsReauth: true },
            { status: 401 }
          );
        }

        return NextResponse.json({
          success: true,
          expiresAt: tokens.expires_at,
        });
      }

      case 'status': {
        // Get status of Outlook connections
        const connections = await getConnectionsByProvider(userId, 'outlook');

        // Enrich with health info
        const enrichedConnections = await Promise.all(
          connections.map(async (conn) => {
            const health = await getConnectionWithHealth(conn.id);
            return {
              ...conn,
              health: health?.health,
            };
          })
        );

        return NextResponse.json({
          provider: 'outlook',
          connections: enrichedConnections,
          scopes: OUTLOOK_SCOPES,
        });
      }

      case 'verify': {
        // Verify a connection is working
        if (!connectionId) {
          return NextResponse.json(
            { error: 'connectionId required for verify' },
            { status: 400 }
          );
        }

        const profile = await getOutlookProfile(connectionId);
        if (!profile) {
          return NextResponse.json(
            { valid: false, error: 'Failed to fetch profile' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          valid: true,
          profile: {
            email: profile.mail || profile.userPrincipalName,
            name: profile.displayName,
            jobTitle: profile.jobTitle,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: refresh, status, or verify' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Outlook OAuth] POST error:', error);
    return NextResponse.json(
      { error: 'Request failed', message: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Disconnect Account
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId') || searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      );
    }

    // Verify user owns this connection
    const connection = await getConnection(connectionId);
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (connection.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (permanent) {
      // Permanently delete the connection
      await deleteConnection(connectionId);
      console.log(`[Outlook OAuth] Deleted connection ${connectionId} for user ${userId}`);
    } else {
      // Just disconnect (keep record for easy reconnect)
      await disconnectEmail(connectionId);
      console.log(`[Outlook OAuth] Disconnected ${connectionId} for user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      action: permanent ? 'deleted' : 'disconnected',
      connectionId,
    });
  } catch (error: any) {
    console.error('[Outlook OAuth] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect', message: error.message },
      { status: 500 }
    );
  }
}
