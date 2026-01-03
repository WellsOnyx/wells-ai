/**
 * Outlook (Microsoft Graph) OAuth Integration
 *
 * Complete Microsoft OAuth 2.0 implementation with:
 * - Authorization URL generation with PKCE
 * - Token exchange
 * - Token refresh
 * - User profile fetching via Microsoft Graph
 * - Email operations (send, read, folders)
 *
 * Scopes:
 * - Mail.Send: Send email as user
 * - Mail.Read: Read inbox
 * - Mail.ReadWrite: Read/modify messages and folders
 * - User.Read: Get user profile
 * - offline_access: Refresh tokens
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

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';

// Use "common" for multi-tenant (personal + work accounts)
const MICROSOFT_TENANT = process.env.MICROSOFT_TENANT || 'common';

const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`;
const MICROSOFT_TOKEN_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`;
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Microsoft Graph OAuth scopes for full email functionality
export const OUTLOOK_SCOPES = [
  'Mail.Send',           // Send email as user
  'Mail.Read',           // Read inbox
  'Mail.ReadWrite',      // Read/modify messages and folders
  'MailboxSettings.Read', // Read mailbox settings
  'User.Read',           // Get user profile
  'offline_access',      // Refresh tokens
];

// ============================================================================
// TYPES
// ============================================================================

export interface OutlookUserProfile {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  officeLocation?: string;
}

export interface OutlookMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body?: {
    contentType: 'text' | 'html';
    content: string;
  };
  from?: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  isRead: boolean;
  isDraft: boolean;
  importance: 'low' | 'normal' | 'high';
  hasAttachments: boolean;
  receivedDateTime: string;
  sentDateTime?: string;
  parentFolderId: string;
}

export interface OutlookFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount: number;
  totalItemCount: number;
  unreadItemCount: number;
  isHidden: boolean;
}

export interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  importance?: 'low' | 'normal' | 'high';
  replyTo?: string;
  saveToSentItems?: boolean;
}

// ============================================================================
// PKCE UTILITIES
// ============================================================================

/**
 * Generate PKCE code verifier
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge from verifier
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ============================================================================
// OAUTH FLOW
// ============================================================================

/**
 * Generate Outlook OAuth authorization URL with PKCE
 */
export async function getOutlookAuthUrl(params: {
  userId: string;
  redirectUri: string;
  returnUrl?: string;
}): Promise<{ url: string; state: string }> {
  if (!MICROSOFT_CLIENT_ID) {
    throw new Error('MICROSOFT_CLIENT_ID not configured');
  }

  // Generate PKCE code verifier
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Create state with code verifier for CSRF protection
  const state = await createOAuthState({
    userId: params.userId,
    provider: 'outlook',
    codeVerifier,
    redirectUri: params.redirectUri,
    returnUrl: params.returnUrl,
  });

  // Build authorization URL
  const authParams = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: params.redirectUri,
    scope: OUTLOOK_SCOPES.join(' '),
    state,
    response_mode: 'query',
    prompt: 'consent',                // Ensure refresh token
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return {
    url: `${MICROSOFT_AUTH_URL}?${authParams.toString()}`,
    state,
  };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeOutlookCode(params: {
  code: string;
  state: string;
  redirectUri: string;
}): Promise<{
  success: boolean;
  connectionId?: string;
  email?: string;
  error?: string;
}> {
  // Validate state and get code verifier
  const stateData = await validateOAuthState(params.state);
  if (!stateData) {
    return { success: false, error: 'Invalid or expired state' };
  }

  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    return { success: false, error: 'Outlook OAuth not configured' };
  }

  try {
    // Build token request with PKCE
    const tokenParams = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code: params.code,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    });

    // Add code verifier for PKCE
    if (stateData.codeVerifier) {
      tokenParams.append('code_verifier', stateData.codeVerifier);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[Outlook OAuth] Token exchange error:', tokenData);
      return {
        success: false,
        error: tokenData.error_description || tokenData.error,
      };
    }

    // Get user profile
    const profile = await fetchOutlookProfile(tokenData.access_token);

    // Prepare tokens
    const tokens: OAuthTokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || '',
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      token_type: tokenData.token_type || 'Bearer',
      scope: tokenData.scope || OUTLOOK_SCOPES.join(' '),
    };

    // Store connection with encrypted tokens
    const email = profile.mail || profile.userPrincipalName;
    const connection = await storeTokens({
      userId: stateData.userId,
      provider: 'outlook',
      email,
      displayName: profile.displayName,
      providerUserId: profile.id,
      tokens,
      scopes: tokens.scope.split(' '),
    });

    console.log(`[Outlook OAuth] Successfully connected ${email} for user ${stateData.userId}`);

    return {
      success: true,
      connectionId: connection.id,
      email,
    };
  } catch (error: any) {
    console.error('[Outlook OAuth] Exchange error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Refresh Outlook access token
 */
export async function refreshOutlookToken(connectionId: string): Promise<OAuthTokens | null> {
  const tokens = await getTokens(connectionId);

  if (!tokens || !tokens.refresh_token) {
    console.error('[Outlook OAuth] No refresh token available');
    await updateConnectionStatus(connectionId, 'error', 'No refresh token');
    return null;
  }

  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    console.error('[Outlook OAuth] Credentials not configured');
    return null;
  }

  try {
    await updateConnectionStatus(connectionId, 'refreshing');

    const response = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
        scope: OUTLOOK_SCOPES.join(' '),
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[Outlook OAuth] Refresh error:', data);
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
      refresh_token: data.refresh_token || tokens.refresh_token, // Keep old if not provided
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

    console.log(`[Outlook OAuth] Token refreshed for connection ${connectionId}`);

    return newTokens;
  } catch (error: any) {
    console.error('[Outlook OAuth] Refresh error:', error);
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
export async function getValidOutlookToken(connectionId: string): Promise<string | null> {
  let tokens = await getTokens(connectionId);

  if (!tokens) {
    console.error('[Outlook OAuth] No tokens found');
    return null;
  }

  // Check if tokens need refresh
  if (tokensNeedRefresh(tokens)) {
    console.log('[Outlook OAuth] Tokens expiring soon, refreshing...');
    tokens = await refreshOutlookToken(connectionId);
    if (!tokens) return null;
  }

  return tokens.access_token;
}

// ============================================================================
// PROFILE
// ============================================================================

/**
 * Fetch Outlook user profile via Microsoft Graph
 */
async function fetchOutlookProfile(accessToken: string): Promise<OutlookUserProfile> {
  const response = await fetch(`${GRAPH_API_BASE}/me`, {
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
 * Get Outlook profile for a connection
 */
export async function getOutlookProfile(connectionId: string): Promise<OutlookUserProfile | null> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) return null;

  try {
    return await fetchOutlookProfile(accessToken);
  } catch (error) {
    console.error('[Outlook OAuth] Error fetching profile:', error);
    return null;
  }
}

// ============================================================================
// EMAIL OPERATIONS
// ============================================================================

/**
 * Send email via Microsoft Graph
 */
export async function sendOutlookEmail(
  connectionId: string,
  params: SendEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Build recipient arrays
    const toRecipients = (Array.isArray(params.to) ? params.to : [params.to]).map(email => ({
      emailAddress: { address: email },
    }));

    const ccRecipients = params.cc
      ? (Array.isArray(params.cc) ? params.cc : [params.cc]).map(email => ({
          emailAddress: { address: email },
        }))
      : undefined;

    const bccRecipients = params.bcc
      ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]).map(email => ({
          emailAddress: { address: email },
        }))
      : undefined;

    // Build message payload
    const message: any = {
      subject: params.subject,
      body: {
        contentType: params.isHtml ? 'HTML' : 'Text',
        content: params.body,
      },
      toRecipients,
      importance: params.importance || 'normal',
    };

    if (ccRecipients) message.ccRecipients = ccRecipients;
    if (bccRecipients) message.bccRecipients = bccRecipients;
    if (params.replyTo) {
      message.replyTo = [{ emailAddress: { address: params.replyTo } }];
    }

    // Send via Microsoft Graph
    const response = await fetch(`${GRAPH_API_BASE}/me/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        saveToSentItems: params.saveToSentItems !== false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Outlook] Send error:', errorData);
      return {
        success: false,
        error: errorData.error?.message || `HTTP ${response.status}`,
      };
    }

    // Microsoft Graph sendMail returns 202 Accepted with no body
    return { success: true };
  } catch (error: any) {
    console.error('[Outlook] Send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get inbox messages
 */
export async function getOutlookInbox(
  connectionId: string,
  options: {
    top?: number;
    skip?: number;
    filter?: string;
    orderBy?: string;
    folderId?: string;
    select?: string[];
  } = {}
): Promise<{
  messages: OutlookMessage[];
  nextLink?: string;
  error?: string;
}> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) {
    return { messages: [], error: 'Not authenticated' };
  }

  try {
    const params = new URLSearchParams();

    params.append('$top', (options.top || 25).toString());
    if (options.skip) params.append('$skip', options.skip.toString());
    if (options.filter) params.append('$filter', options.filter);
    params.append('$orderby', options.orderBy || 'receivedDateTime desc');

    if (options.select && options.select.length > 0) {
      params.append('$select', options.select.join(','));
    } else {
      params.append('$select', 'id,subject,bodyPreview,from,toRecipients,isRead,isDraft,importance,hasAttachments,receivedDateTime,parentFolderId,conversationId');
    }

    const folder = options.folderId || 'inbox';
    const response = await fetch(
      `${GRAPH_API_BASE}/me/mailFolders/${folder}/messages?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data = await response.json();

    if (data.error) {
      return { messages: [], error: data.error.message };
    }

    return {
      messages: data.value || [],
      nextLink: data['@odata.nextLink'],
    };
  } catch (error: any) {
    console.error('[Outlook] Inbox error:', error);
    return { messages: [], error: error.message };
  }
}

/**
 * Get a specific message
 */
export async function getOutlookMessage(
  connectionId: string,
  messageId: string,
  options: { includeBody?: boolean } = {}
): Promise<OutlookMessage | null> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) return null;

  try {
    const params = new URLSearchParams();
    if (options.includeBody) {
      params.append('$select', 'id,subject,body,bodyPreview,from,toRecipients,ccRecipients,isRead,isDraft,importance,hasAttachments,receivedDateTime,sentDateTime,parentFolderId,conversationId');
    }

    const url = `${GRAPH_API_BASE}/me/messages/${messageId}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    if (data.error) return null;

    return data;
  } catch (error) {
    console.error('[Outlook] Get message error:', error);
    return null;
  }
}

// ============================================================================
// FOLDERS (Labels equivalent)
// ============================================================================

/**
 * Get all mail folders
 */
export async function getOutlookFolders(connectionId: string): Promise<OutlookFolder[]> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) return [];

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/mailFolders?$top=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error('[Outlook] Folders error:', error);
    return [];
  }
}

/**
 * Create a folder
 */
export async function createOutlookFolder(
  connectionId: string,
  displayName: string,
  parentFolderId?: string
): Promise<OutlookFolder | null> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) return null;

  try {
    const endpoint = parentFolderId
      ? `${GRAPH_API_BASE}/me/mailFolders/${parentFolderId}/childFolders`
      : `${GRAPH_API_BASE}/me/mailFolders`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('[Outlook] Create folder error:', data.error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Outlook] Create folder error:', error);
    return null;
  }
}

/**
 * Move message to folder
 */
export async function moveOutlookMessage(
  connectionId: string,
  messageId: string,
  destinationFolderId: string
): Promise<boolean> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/messages/${messageId}/move`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ destinationId: destinationFolderId }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[Outlook] Move message error:', error);
    return false;
  }
}

/**
 * Mark message as read/unread
 */
export async function markOutlookRead(
  connectionId: string,
  messageId: string,
  isRead: boolean
): Promise<boolean> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[Outlook] Mark read error:', error);
    return false;
  }
}

/**
 * Delete message (move to trash)
 */
export async function deleteOutlookMessage(
  connectionId: string,
  messageId: string
): Promise<boolean> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/messages/${messageId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[Outlook] Delete message error:', error);
    return false;
  }
}

/**
 * Archive message (move to Archive folder)
 */
export async function archiveOutlookMessage(
  connectionId: string,
  messageId: string
): Promise<boolean> {
  const accessToken = await getValidOutlookToken(connectionId);
  if (!accessToken) return false;

  try {
    // Find archive folder
    const folders = await getOutlookFolders(connectionId);
    const archiveFolder = folders.find(f =>
      f.displayName.toLowerCase() === 'archive' ||
      f.displayName.toLowerCase() === 'archiver'
    );

    if (!archiveFolder) {
      console.warn('[Outlook] No archive folder found');
      return false;
    }

    return moveOutlookMessage(connectionId, messageId, archiveFolder.id);
  } catch (error) {
    console.error('[Outlook] Archive error:', error);
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // OAuth
  getOutlookAuthUrl,
  exchangeOutlookCode,
  refreshOutlookToken,
  getValidOutlookToken,

  // Profile
  getOutlookProfile,

  // Email operations
  sendOutlookEmail,
  getOutlookInbox,
  getOutlookMessage,

  // Folders
  getOutlookFolders,
  createOutlookFolder,
  moveOutlookMessage,
  markOutlookRead,
  deleteOutlookMessage,
  archiveOutlookMessage,

  // Constants
  OUTLOOK_SCOPES,
};
