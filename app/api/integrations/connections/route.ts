/**
 * User Email Connections Management API
 *
 * Unified endpoint for managing all email connections:
 * - GET /api/integrations/connections - List all connections
 * - POST /api/integrations/connections - Bulk operations
 * - DELETE /api/integrations/connections - Disconnect specific connection
 *
 * Provides a Superhuman-like dashboard experience for email management.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserConnections,
  getConnectionWithHealth,
  getConnectionsSummary,
  disconnectEmail,
  deleteConnection,
  getConnection,
  updateLastSync,
  EmailConnection,
  ConnectionWithHealth,
} from '@/lib/integrations/oauth-manager';
import { refreshGmailToken, getGmailProfile, GMAIL_SCOPES } from '@/lib/integrations/gmail-oauth';
import { refreshOutlookToken, getOutlookProfile, OUTLOOK_SCOPES } from '@/lib/integrations/outlook-oauth';

export const dynamic = 'force-dynamic';

// ============================================================================
// HELPERS
// ============================================================================

function getUserId(request: NextRequest): string | null {
  // In production, extract from session/JWT
  const authHeader = request.headers.get('x-user-id');
  if (authHeader) return authHeader;

  const searchParams = request.nextUrl.searchParams;
  return searchParams.get('userId') || searchParams.get('user_id');
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
}

// ============================================================================
// GET - List all connections
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const includeHealth = searchParams.get('health') !== 'false';
    const provider = searchParams.get('provider');
    const format = searchParams.get('format') || 'full';

    // Get all connections
    let connections = await getUserConnections(userId);

    // Filter by provider if specified
    if (provider && (provider === 'gmail' || provider === 'outlook')) {
      connections = connections.filter((c) => c.provider === provider);
    }

    // Summary format for dashboard widgets
    if (format === 'summary') {
      const summary = await getConnectionsSummary(userId);
      return NextResponse.json({
        summary,
        isConfigured: {
          gmail: !!process.env.GOOGLE_CLIENT_ID,
          outlook: !!process.env.MICROSOFT_CLIENT_ID,
        },
      });
    }

    // Enrich with health data if requested
    let enrichedConnections: (EmailConnection | ConnectionWithHealth)[] = connections;

    if (includeHealth) {
      enrichedConnections = await Promise.all(
        connections.map(async (conn) => {
          const withHealth = await getConnectionWithHealth(conn.id);
          return withHealth || conn;
        })
      );
    }

    // Calculate overall status
    const activeConnections = enrichedConnections.filter((c) => c.status === 'connected');
    const expiredConnections = enrichedConnections.filter((c) => c.status === 'expired');
    const errorConnections = enrichedConnections.filter((c) => c.status === 'error');

    return NextResponse.json({
      connections: enrichedConnections,
      stats: {
        total: enrichedConnections.length,
        active: activeConnections.length,
        expired: expiredConnections.length,
        errors: errorConnections.length,
      },
      providers: {
        gmail: {
          configured: !!process.env.GOOGLE_CLIENT_ID,
          scopes: GMAIL_SCOPES,
          connections: enrichedConnections.filter((c) => c.provider === 'gmail').length,
        },
        outlook: {
          configured: !!process.env.MICROSOFT_CLIENT_ID,
          scopes: OUTLOOK_SCOPES,
          connections: enrichedConnections.filter((c) => c.provider === 'outlook').length,
        },
      },
      authUrls: {
        gmail: `${getBaseUrl(request)}/api/integrations/gmail/auth?userId=${userId}`,
        outlook: `${getBaseUrl(request)}/api/integrations/outlook/auth?userId=${userId}`,
      },
    });
  } catch (error: any) {
    console.error('[Connections] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections', message: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Bulk operations
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action, connectionIds, connectionId } = body;

    // Handle single connection ID or array
    const ids = connectionIds || (connectionId ? [connectionId] : []);

    if (ids.length === 0 && action !== 'refresh-all' && action !== 'verify-all') {
      return NextResponse.json(
        { error: 'connectionId or connectionIds required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'refresh': {
        // Refresh tokens for specific connections
        const results = await Promise.all(
          ids.map(async (id: string) => {
            const conn = await getConnection(id);
            if (!conn || conn.user_id !== userId) {
              return { id, success: false, error: 'Not found or not authorized' };
            }

            try {
              let tokens;
              if (conn.provider === 'gmail') {
                tokens = await refreshGmailToken(id);
              } else if (conn.provider === 'outlook') {
                tokens = await refreshOutlookToken(id);
              }

              if (tokens) {
                return {
                  id,
                  success: true,
                  expiresAt: tokens.expires_at,
                  provider: conn.provider,
                  email: conn.email,
                };
              } else {
                return { id, success: false, error: 'Refresh failed', needsReauth: true };
              }
            } catch (error: any) {
              return { id, success: false, error: error.message };
            }
          })
        );

        const successCount = results.filter((r) => r.success).length;
        return NextResponse.json({
          success: successCount === results.length,
          results,
          summary: {
            total: results.length,
            succeeded: successCount,
            failed: results.length - successCount,
          },
        });
      }

      case 'refresh-all': {
        // Refresh all connections for this user
        const connections = await getUserConnections(userId);
        const results = await Promise.all(
          connections
            .filter((c) => c.status === 'connected' || c.status === 'expired')
            .map(async (conn) => {
              try {
                let tokens;
                if (conn.provider === 'gmail') {
                  tokens = await refreshGmailToken(conn.id);
                } else if (conn.provider === 'outlook') {
                  tokens = await refreshOutlookToken(conn.id);
                }

                return {
                  id: conn.id,
                  email: conn.email,
                  provider: conn.provider,
                  success: !!tokens,
                  expiresAt: tokens?.expires_at,
                };
              } catch (error: any) {
                return {
                  id: conn.id,
                  email: conn.email,
                  provider: conn.provider,
                  success: false,
                  error: error.message,
                };
              }
            })
        );

        return NextResponse.json({
          success: results.every((r) => r.success),
          results,
        });
      }

      case 'verify': {
        // Verify connections are working
        const results = await Promise.all(
          ids.map(async (id: string) => {
            const conn = await getConnection(id);
            if (!conn || conn.user_id !== userId) {
              return { id, valid: false, error: 'Not found or not authorized' };
            }

            try {
              let profile;
              if (conn.provider === 'gmail') {
                profile = await getGmailProfile(id);
              } else if (conn.provider === 'outlook') {
                profile = await getOutlookProfile(id);
              }

              if (profile) {
                await updateLastSync(id);
                return {
                  id,
                  valid: true,
                  provider: conn.provider,
                  email: conn.email,
                  profile,
                };
              } else {
                return { id, valid: false, error: 'Profile fetch failed' };
              }
            } catch (error: any) {
              return { id, valid: false, error: error.message };
            }
          })
        );

        return NextResponse.json({
          success: results.every((r) => r.valid),
          results,
        });
      }

      case 'verify-all': {
        // Verify all active connections
        const connections = await getUserConnections(userId);
        const results = await Promise.all(
          connections
            .filter((c) => c.status === 'connected')
            .map(async (conn) => {
              try {
                let profile;
                if (conn.provider === 'gmail') {
                  profile = await getGmailProfile(conn.id);
                } else if (conn.provider === 'outlook') {
                  profile = await getOutlookProfile(conn.id);
                }

                if (profile) {
                  await updateLastSync(conn.id);
                  return { id: conn.id, email: conn.email, valid: true };
                } else {
                  return { id: conn.id, email: conn.email, valid: false };
                }
              } catch (error: any) {
                return { id: conn.id, email: conn.email, valid: false, error: error.message };
              }
            })
        );

        return NextResponse.json({
          success: results.every((r) => r.valid),
          results,
        });
      }

      case 'disconnect': {
        // Disconnect (but keep records)
        const results = await Promise.all(
          ids.map(async (id: string) => {
            const conn = await getConnection(id);
            if (!conn || conn.user_id !== userId) {
              return { id, success: false, error: 'Not found or not authorized' };
            }

            await disconnectEmail(id);
            return { id, success: true, email: conn.email };
          })
        );

        return NextResponse.json({
          success: results.every((r) => r.success),
          results,
        });
      }

      case 'delete': {
        // Permanently delete
        const results = await Promise.all(
          ids.map(async (id: string) => {
            const conn = await getConnection(id);
            if (!conn || conn.user_id !== userId) {
              return { id, success: false, error: 'Not found or not authorized' };
            }

            await deleteConnection(id);
            return { id, success: true, email: conn.email };
          })
        );

        return NextResponse.json({
          success: results.every((r) => r.success),
          results,
        });
      }

      case 'set-primary': {
        // Set primary email for a provider
        const { provider } = body;
        if (!connectionId || !provider) {
          return NextResponse.json(
            { error: 'connectionId and provider required' },
            { status: 400 }
          );
        }

        // Verify connection exists and belongs to user
        const conn = await getConnection(connectionId);
        if (!conn || conn.user_id !== userId) {
          return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
        }

        // In a real implementation, you'd store this preference
        // For now, we just acknowledge the request
        return NextResponse.json({
          success: true,
          primaryEmail: conn.email,
          provider,
        });
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            validActions: [
              'refresh',
              'refresh-all',
              'verify',
              'verify-all',
              'disconnect',
              'delete',
              'set-primary',
            ],
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Connections] POST error:', error);
    return NextResponse.json(
      { error: 'Request failed', message: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Disconnect or delete a connection
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
      await deleteConnection(connectionId);
      console.log(`[Connections] Deleted ${connectionId} for user ${userId}`);
    } else {
      await disconnectEmail(connectionId);
      console.log(`[Connections] Disconnected ${connectionId} for user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      action: permanent ? 'deleted' : 'disconnected',
      connectionId,
      email: connection.email,
      provider: connection.provider,
    });
  } catch (error: any) {
    console.error('[Connections] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect', message: error.message },
      { status: 500 }
    );
  }
}
