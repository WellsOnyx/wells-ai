/**
 * Gmail OAuth Integration
 *
 * Complete Gmail OAuth 2.0 implementation with:
 * - Authorization URL generation
 * - Token exchange
 * - Token refresh
 * - User profile fetching
 * - Email operations (send, read, labels)
 *
 * Scopes:
 * - gmail.send: Send email as user
 * - gmail.readonly: Read inbox
 * - gmail.modify: Read/modify labels
 * - gmail.labels: Manage labels
 */

import * as crypto from 'crypto';
import {
  OAuthTokens,
  storeTokens,
  getTokens,
  updateTokens,
  tokensNeedRefresh,
  createOAuthState,
  validateOAuthState,
  updateConnectionStatus,
  logTokenRefresh,
} from './oauth-manager';

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

// Gmail OAuth scopes for full email functionality
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',       // Send email as user
  'https://www.googleapis.com/auth/gmail.readonly',   // Read inbox
  'https://www.googleapis.com/auth/gmail.modify',     // Read/modify labels
  'https://www.googleapis.com/auth/gmail.labels',     // Manage labels
  'https://www.googleapis.com/auth/userinfo.email',   // Get user email
  'https://www.googleapis.com/auth/userinfo.profile', // Get user profile
];

// ============================================================================
// TYPES
// ============================================================================

export interface GmailUserProfile {
  id: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  verified_email: boolean;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    mimeType: string;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
    }>;
  };
  internalDate: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messageListVisibility?: 'show' | 'hide';
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}

// ============================================================================
// OAUTH FLOW
// ============================================================================

/**
 * Generate Gmail OAuth authorization URL
 */
export async function getGmailAuthUrl(params: {
  userId: string;
  redirectUri: string;
  returnUrl?: string;
}): Promise<{ url: string; state: string }> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID not configured');
  }

  // Create state for CSRF protection
  const state = await createOAuthState({
    userId: params.userId,
    provider: 'gmail',
    redirectUri: params.redirectUri,
    returnUrl: params.returnUrl,
  });

  // Build authorization URL
  const authParams = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    state,
    access_type: 'offline',           // Request refresh token
    prompt: 'consent',                 // Always show consent (ensures refresh token)
    include_granted_scopes: 'true',   // Incremental authorization
  });

  return {
    url: `${GOOGLE_AUTH_URL}?${authParams.toString()}`,
    state,
  };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGmailCode(params: {
  code: string;
  state: string;
  redirectUri: string;
}): Promise<{
  success: boolean;
  connectionId?: string;
  email?: string;
  error?: string;
}> {
  // Validate state
  const stateData = await validateOAuthState(params.state);
  if (!stateData) {
    return { success: false, error: 'Invalid or expired state' };
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return { success: false, error: 'Gmail OAuth not configured' };
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: params.code,
        redirect_uri: params.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[Gmail OAuth] Token exchange error:', tokenData);
      return {
        success: false,
        error: tokenData.error_description || tokenData.error,
      };
    }

    // Get user profile
    const profile = await fetchGmailProfile(tokenData.access_token);

    // Prepare tokens
    const tokens: OAuthTokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || '',
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      token_type: tokenData.token_type || 'Bearer',
      scope: tokenData.scope || GMAIL_SCOPES.join(' '),
    };

    // Store connection with encrypted tokens
    const connection = await storeTokens({
      userId: stateData.userId,
      provider: 'gmail',
      email: profile.email,
      displayName: profile.name,
      profilePicture: profile.picture,
      providerUserId: profile.id,
      tokens,
      scopes: tokens.scope.split(' '),
    });

    console.log(`[Gmail OAuth] Successfully connected ${profile.email} for user ${stateData.userId}`);

    return {
      success: true,
      connectionId: connection.id,
      email: profile.email,
    };
  } catch (error: any) {
    console.error('[Gmail OAuth] Exchange error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Refresh Gmail access token
 */
export async function refreshGmailToken(connectionId: string): Promise<OAuthTokens | null> {
  const tokens = await getTokens(connectionId);

  if (!tokens || !tokens.refresh_token) {
    console.error('[Gmail OAuth] No refresh token available');
    await updateConnectionStatus(connectionId, 'error', 'No refresh token');
    return null;
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('[Gmail OAuth] Credentials not configured');
    return null;
  }

  try {
    await updateConnectionStatus(connectionId, 'refreshing');

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[Gmail OAuth] Refresh error:', data);
      await updateConnectionStatus(connectionId, 'expired', data.error_description || data.error);
      await logTokenRefresh({
        connectionId,
        success: false,
        errorMessage: data.error_description || data.error,
        oldExpiresAt: tokens.expires_at,
      });
      return null;
    }

    const newTokens: OAuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokens.refresh_token, // Keep old refresh if not provided
      expires_at: Date.now() + (data.expires_in * 1000),
      token_type: data.token_type || 'Bearer',
      scope: data.scope || tokens.scope,
    };

    await updateTokens(connectionId, newTokens);

    await logTokenRefresh({
      connectionId,
      success: true,
      oldExpiresAt: tokens.expires_at,
      newExpiresAt: newTokens.expires_at,
    });

    console.log(`[Gmail OAuth] Token refreshed for connection ${connectionId}`);

    return newTokens;
  } catch (error: any) {
    console.error('[Gmail OAuth] Refresh error:', error);
    await updateConnectionStatus(connectionId, 'error', error.message);
    await logTokenRefresh({
      connectionId,
      success: false,
      errorMessage: error.message,
      oldExpiresAt: tokens.expires_at,
    });
    return null;
  }
}

/**
 * Get valid access token, refreshing if needed
 */
export async function getValidGmailToken(connectionId: string): Promise<string | null> {
  let tokens = await getTokens(connectionId);

  if (!tokens) {
    console.error('[Gmail OAuth] No tokens found');
    return null;
  }

  // Check if tokens need refresh
  if (tokensNeedRefresh(tokens)) {
    console.log('[Gmail OAuth] Tokens expiring soon, refreshing...');
    tokens = await refreshGmailToken(connectionId);
    if (!tokens) return null;
  }

  return tokens.access_token;
}

// ============================================================================
// PROFILE
// ============================================================================

/**
 * Fetch Gmail user profile
 */
async function fetchGmailProfile(accessToken: string): Promise<GmailUserProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.status}`);
  }

  return response.json();
}

/**
 * Get Gmail profile for a connection
 */
export async function getGmailProfile(connectionId: string): Promise<GmailUserProfile | null> {
  const accessToken = await getValidGmailToken(connectionId);
  if (!accessToken) return null;

  try {
    return await fetchGmailProfile(accessToken);
  } catch (error) {
    console.error('[Gmail OAuth] Error fetching profile:', error);
    return null;
  }
}

// ============================================================================
// EMAIL OPERATIONS
// ============================================================================

/**
 * Send email via Gmail API
 */
export async function sendGmailEmail(
  connectionId: string,
  params: SendEmailParams
): Promise<{ success: boolean; messageId?: string; threadId?: string; error?: string }> {
  const accessToken = await getValidGmailToken(connectionId);
  if (!accessToken) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Build email in RFC 2822 format
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;
    const cc = params.cc
      ? Array.isArray(params.cc) ? params.cc.join(', ') : params.cc
      : undefined;
    const bcc = params.bcc
      ? Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc
      : undefined;

    const headers = [
      `To: ${to}`,
      `Subject: ${params.subject}`,
      `Content-Type: ${params.isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
    ];

    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);
    if (params.replyTo) headers.push(`Reply-To: ${params.replyTo}`);
    if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
    if (params.references) headers.push(`References: ${params.references}`);

    headers.push(`Date: ${new Date().toUTCString()}`);

    const email = `${headers.join('\r\n')}\r\n\r\n${params.body}`;

    // Base64url encode the email
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API
    const response = await fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
        threadId: params.inReplyTo ? undefined : undefined, // Let Gmail handle threading
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error('[Gmail] Send error:', result.error);
      return {
        success: false,
        error: result.error.message || result.error.code,
      };
    }

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
    };
  } catch (error: any) {
    console.error('[Gmail] Send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get inbox messages
 */
export async function getGmailInbox(
  connectionId: string,
  options: {
    maxResults?: number;
    pageToken?: string;
    labelIds?: string[];
    query?: string;
  } = {}
): Promise<{
  messages: GmailMessage[];
  nextPageToken?: string;
  error?: string;
}> {
  const accessToken = await getValidGmailToken(connectionId);
  if (!accessToken) {
    return { messages: [], error: 'Not authenticated' };
  }

  try {
    const params = new URLSearchParams({
      maxResults: (options.maxResults || 25).toString(),
    });

    if (options.pageToken) params.append('pageToken', options.pageToken);
    if (options.labelIds) params.append('labelIds', options.labelIds.join(','));
    if (options.query) params.append('q', options.query);

    // Get message list
    const listResponse = await fetch(
      `${GMAIL_API_BASE}/users/me/messages?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const listData = await listResponse.json();

    if (listData.error) {
      return { messages: [], error: listData.error.message };
    }

    if (!listData.messages || listData.messages.length === 0) {
      return { messages: [], nextPageToken: listData.nextPageToken };
    }

    // Fetch full message details in parallel (batch)
    const messages = await Promise.all(
      listData.messages.slice(0, 10).map(async (msg: { id: string }) => {
        const msgResponse = await fetch(
          `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        return msgResponse.json();
      })
    );

    return {
      messages: messages.filter((m) => !m.error),
      nextPageToken: listData.nextPageToken,
    };
  } catch (error: any) {
    console.error('[Gmail] Inbox error:', error);
    return { messages: [], error: error.message };
  }
}

/**
 * Get a specific message
 */
export async function getGmailMessage(
  connectionId: string,
  messageId: string,
  format: 'full' | 'metadata' | 'minimal' | 'raw' = 'full'
): Promise<GmailMessage | null> {
  const accessToken = await getValidGmailToken(connectionId);
  if (!accessToken) return null;

  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=${format}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data = await response.json();
    if (data.error) return null;

    return data;
  } catch (error) {
    console.error('[Gmail] Get message error:', error);
    return null;
  }
}

// ============================================================================
// LABELS
// ============================================================================

/**
 * Get all labels
 */
export async function getGmailLabels(connectionId: string): Promise<GmailLabel[]> {
  const accessToken = await getValidGmailToken(connectionId);
  if (!accessToken) return [];

  try {
    const response = await fetch(`${GMAIL_API_BASE}/users/me/labels`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    return data.labels || [];
  } catch (error) {
    console.error('[Gmail] Labels error:', error);
    return [];
  }
}

/**
 * Create a label
 */
export async function createGmailLabel(
  connectionId: string,
  name: string,
  options: {
    messageListVisibility?: 'show' | 'hide';
    labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
  } = {}
): Promise<GmailLabel | null> {
  const accessToken = await getValidGmailToken(connectionId);
  if (!accessToken) return null;

  try {
    const response = await fetch(`${GMAIL_API_BASE}/users/me/labels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        messageListVisibility: options.messageListVisibility || 'show',
        labelListVisibility: options.labelListVisibility || 'labelShow',
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('[Gmail] Create label error:', data.error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Gmail] Create label error:', error);
    return null;
  }
}

/**
 * Modify message labels
 */
export async function modifyGmailLabels(
  connectionId: string,
  messageId: string,
  options: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  }
): Promise<boolean> {
  const accessToken = await getValidGmailToken(connectionId);
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: options.addLabelIds || [],
          removeLabelIds: options.removeLabelIds || [],
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[Gmail] Modify labels error:', error);
    return false;
  }
}

/**
 * Mark message as read/unread
 */
export async function markGmailRead(
  connectionId: string,
  messageId: string,
  read: boolean
): Promise<boolean> {
  return modifyGmailLabels(connectionId, messageId, {
    addLabelIds: read ? [] : ['UNREAD'],
    removeLabelIds: read ? ['UNREAD'] : [],
  });
}

/**
 * Archive message (remove from inbox)
 */
export async function archiveGmailMessage(
  connectionId: string,
  messageId: string
): Promise<boolean> {
  return modifyGmailLabels(connectionId, messageId, {
    removeLabelIds: ['INBOX'],
  });
}

/**
 * Move message to trash
 */
export async function trashGmailMessage(
  connectionId: string,
  messageId: string
): Promise<boolean> {
  const accessToken = await getValidGmailToken(connectionId);
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages/${messageId}/trash`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[Gmail] Trash error:', error);
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // OAuth
  getGmailAuthUrl,
  exchangeGmailCode,
  refreshGmailToken,
  getValidGmailToken,

  // Profile
  getGmailProfile,

  // Email operations
  sendGmailEmail,
  getGmailInbox,
  getGmailMessage,

  // Labels
  getGmailLabels,
  createGmailLabel,
  modifyGmailLabels,
  markGmailRead,
  archiveGmailMessage,
  trashGmailMessage,

  // Constants
  GMAIL_SCOPES,
};
