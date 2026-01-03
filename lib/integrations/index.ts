/**
 * Email Integrations Module
 *
 * Unified exports for Gmail and Outlook OAuth integrations.
 *
 * Usage:
 *
 * ```typescript
 * import {
 *   // Core OAuth manager
 *   storeTokens,
 *   getTokens,
 *   getUserConnections,
 *   encryptTokens,
 *   decryptTokens,
 *
 *   // Gmail
 *   getGmailAuthUrl,
 *   exchangeGmailCode,
 *   sendGmailEmail,
 *   getGmailInbox,
 *
 *   // Outlook
 *   getOutlookAuthUrl,
 *   exchangeOutlookCode,
 *   sendOutlookEmail,
 *   getOutlookInbox,
 * } from '@/lib/integrations';
 * ```
 */

// ============================================================================
// CORE OAUTH MANAGER
// ============================================================================

export {
  // Types
  type EmailProvider,
  type ConnectionStatus,
  type OAuthTokens,
  type EmailConnection,
  type ConnectionWithHealth,
  type OAuthState,

  // Encryption
  encryptTokens,
  decryptTokens,

  // State management
  createOAuthState,
  validateOAuthState,
  cleanupExpiredStates,

  // Token management
  storeTokens,
  getTokens,
  getTokensByEmail,
  updateTokens,
  tokensNeedRefresh,
  logTokenRefresh,

  // Connection management
  getUserConnections,
  getConnectionWithHealth,
  getConnectionsByProvider,
  getConnection,
  updateConnectionStatus,
  updateLastSync,
  disconnectEmail,
  deleteConnection,
  getConnectionsSummary,

  // Database
  ensureOAuthTables,
} from './oauth-manager';

// ============================================================================
// GMAIL
// ============================================================================

export {
  // Types
  type GmailUserProfile,
  type GmailMessage,
  type GmailLabel,
  type SendEmailParams as GmailSendEmailParams,

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
} from './gmail-oauth';

// ============================================================================
// OUTLOOK
// ============================================================================

export {
  // Types
  type OutlookUserProfile,
  type OutlookMessage,
  type OutlookFolder,
  type SendEmailParams as OutlookSendEmailParams,

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
} from './outlook-oauth';

// ============================================================================
// UNIFIED EMAIL INTERFACE
// ============================================================================

import { getValidGmailToken, sendGmailEmail, getGmailInbox } from './gmail-oauth';
import { getValidOutlookToken, sendOutlookEmail, getOutlookInbox } from './outlook-oauth';
import { getConnection, EmailProvider } from './oauth-manager';

/**
 * Send email through any connected provider
 */
export async function sendEmail(
  connectionId: string,
  params: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    body: string;
    isHtml?: boolean;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    return { success: false, error: 'Connection not found' };
  }

  if (connection.status !== 'connected') {
    return { success: false, error: `Connection status: ${connection.status}` };
  }

  if (connection.provider === 'gmail') {
    return sendGmailEmail(connectionId, params);
  } else if (connection.provider === 'outlook') {
    return sendOutlookEmail(connectionId, params);
  }

  return { success: false, error: 'Unsupported provider' };
}

/**
 * Get inbox from any connected provider
 */
export async function getInbox(
  connectionId: string,
  options: {
    maxResults?: number;
    pageToken?: string;
    query?: string;
  } = {}
): Promise<{
  messages: any[];
  nextPageToken?: string;
  error?: string;
}> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    return { messages: [], error: 'Connection not found' };
  }

  if (connection.status !== 'connected') {
    return { messages: [], error: `Connection status: ${connection.status}` };
  }

  if (connection.provider === 'gmail') {
    return getGmailInbox(connectionId, {
      maxResults: options.maxResults,
      pageToken: options.pageToken,
      query: options.query,
    });
  } else if (connection.provider === 'outlook') {
    const result = await getOutlookInbox(connectionId, {
      top: options.maxResults,
    });
    return {
      messages: result.messages,
      nextPageToken: result.nextLink,
      error: result.error,
    };
  }

  return { messages: [], error: 'Unsupported provider' };
}

/**
 * Check if a provider is configured
 */
export function isProviderConfigured(provider: EmailProvider): boolean {
  if (provider === 'gmail') {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  } else if (provider === 'outlook') {
    return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
  }
  return false;
}

/**
 * Get all configured providers
 */
export function getConfiguredProviders(): EmailProvider[] {
  const providers: EmailProvider[] = [];
  if (isProviderConfigured('gmail')) providers.push('gmail');
  if (isProviderConfigured('outlook')) providers.push('outlook');
  return providers;
}
