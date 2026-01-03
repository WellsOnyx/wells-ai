/**
 * OAuth Manager - Core OAuth management with encryption
 *
 * Provides secure token storage, encryption, refresh logic,
 * and connection management for email integrations.
 *
 * Designed for delight - seamless like Superhuman's setup flow.
 */

import { query } from '@/lib/db';
import * as crypto from 'crypto';

// Helper to run SQL with template literals converted to parameterized query
async function sql(strings: TemplateStringsArray, ...values: any[]) {
  const queryText = strings.reduce((acc, str, i) => {
    return acc + str + (i < values.length ? `$${i + 1}` : '');
  }, '');
  return query(queryText, values);
}

// ============================================================================
// TYPES
// ============================================================================

export type EmailProvider = 'gmail' | 'outlook';

export type ConnectionStatus =
  | 'connected'
  | 'pending'
  | 'expired'
  | 'error'
  | 'disconnected'
  | 'refreshing';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
  token_type: string;
  scope: string;
}

export interface EmailConnection {
  id: string;
  user_id: string;
  provider: EmailProvider;
  email: string;
  display_name?: string;
  profile_picture?: string;
  status: ConnectionStatus;
  scopes: string[];
  last_sync_at?: Date;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConnectionWithHealth extends EmailConnection {
  health: {
    token_valid: boolean;
    token_expires_in_hours: number;
    needs_refresh: boolean;
    last_successful_sync?: Date;
  };
}

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment (32 bytes for AES-256)
 * Generates a deterministic key from the secret if not exactly 32 bytes
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'wells-ai-default-key-change-me';

  // Use SHA-256 to generate a consistent 32-byte key
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt sensitive token data
 */
export function encryptTokens(tokens: OAuthTokens): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  const plaintext = JSON.stringify(tokens);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData (all hex encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt token data
 */
export function decryptTokens(encryptedData: string): OAuthTokens | null {
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      console.error('[OAuth] Invalid encrypted data format');
      return null;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[OAuth] Decryption error:', error);
    return null;
  }
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let tablesInitialized = false;

/**
 * Ensure OAuth tables exist with proper schema
 */
export async function ensureOAuthTables(): Promise<void> {
  if (tablesInitialized) {
    console.log('[OAuth] ensureOAuthTables: Already initialized');
    return;
  }

  try {
    console.log('[OAuth] ensureOAuthTables: Checking if table exists...');
    // Check if table exists
    const check = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'email_connections'
      ) as exists
    `;
    console.log('[OAuth] ensureOAuthTables: Check complete, exists=', check.rows[0]?.exists);

    if (check.rows[0].exists) {
      tablesInitialized = true;
      return;
    }

    console.log('[OAuth] Creating email_connections table...');

    // Create email connections table
    await sql`
      CREATE TABLE IF NOT EXISTS email_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
        email TEXT NOT NULL,
        display_name TEXT,
        profile_picture TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('connected', 'pending', 'expired', 'error', 'disconnected', 'refreshing')),
        encrypted_tokens TEXT,
        scopes JSONB DEFAULT '[]',
        provider_user_id TEXT,
        last_sync_at TIMESTAMP,
        error_message TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, provider, email)
      )
    `;

    // Create indexes for fast lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_email_connections_user ON email_connections(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_email_connections_provider ON email_connections(provider)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_email_connections_status ON email_connections(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_email_connections_email ON email_connections(email)`;

    // Create OAuth states table for CSRF protection
    await sql`
      CREATE TABLE IF NOT EXISTS oauth_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        state TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        code_verifier TEXT,
        redirect_uri TEXT,
        return_url TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at)`;

    // Create token refresh log for debugging
    await sql`
      CREATE TABLE IF NOT EXISTS oauth_refresh_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        connection_id UUID REFERENCES email_connections(id) ON DELETE CASCADE,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        old_expires_at TIMESTAMP,
        new_expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    console.log('[OAuth] Tables created successfully');
    tablesInitialized = true;
  } catch (error) {
    console.error('[OAuth] Error creating tables:', error);
    tablesInitialized = true; // Prevent retry loops
    throw error;
  }
}

// ============================================================================
// STATE MANAGEMENT (CSRF Protection)
// ============================================================================

export interface OAuthState {
  state: string;
  userId: string;
  provider: EmailProvider;
  codeVerifier?: string;
  redirectUri: string;
  returnUrl?: string;
}

/**
 * Create OAuth state for authorization flow
 */
export async function createOAuthState(params: {
  userId: string;
  provider: EmailProvider;
  codeVerifier?: string;
  redirectUri: string;
  returnUrl?: string;
}): Promise<string> {
  console.log('[OAuth] createOAuthState: Step 1 - calling ensureOAuthTables');
  await ensureOAuthTables();
  console.log('[OAuth] createOAuthState: Step 2 - tables ensured');

  const state = crypto.randomBytes(32).toString('hex');
  console.log('[OAuth] createOAuthState: Step 3 - generated state');

  console.log('[OAuth] createOAuthState: Step 4 - inserting to DB');
  await sql`
    INSERT INTO oauth_states (
      state, user_id, provider, code_verifier, redirect_uri, return_url
    ) VALUES (
      ${state}, ${params.userId}, ${params.provider},
      ${params.codeVerifier || null}, ${params.redirectUri},
      ${params.returnUrl || null}
    )
  `;
  console.log('[OAuth] createOAuthState: Step 5 - insert complete');

  return state;
}

/**
 * Validate and consume OAuth state
 */
export async function validateOAuthState(state: string): Promise<OAuthState | null> {
  await ensureOAuthTables();

  // Find and delete state in one transaction (consume it)
  const result = await sql`
    DELETE FROM oauth_states
    WHERE state = ${state}
      AND expires_at > NOW()
    RETURNING state, user_id, provider, code_verifier, redirect_uri, return_url
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    state: row.state,
    userId: row.user_id,
    provider: row.provider as EmailProvider,
    codeVerifier: row.code_verifier,
    redirectUri: row.redirect_uri,
    returnUrl: row.return_url,
  };
}

/**
 * Clean up expired OAuth states
 */
export async function cleanupExpiredStates(): Promise<number> {
  await ensureOAuthTables();

  const result = await sql`
    DELETE FROM oauth_states
    WHERE expires_at < NOW()
  `;

  return result.rowCount || 0;
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Store OAuth tokens securely
 */
export async function storeTokens(params: {
  userId: string;
  provider: EmailProvider;
  email: string;
  displayName?: string;
  profilePicture?: string;
  providerUserId?: string;
  tokens: OAuthTokens;
  scopes: string[];
}): Promise<EmailConnection> {
  await ensureOAuthTables();

  const encryptedTokens = encryptTokens(params.tokens);

  const result = await sql`
    INSERT INTO email_connections (
      user_id, provider, email, display_name, profile_picture,
      provider_user_id, encrypted_tokens, scopes, status, last_sync_at
    ) VALUES (
      ${params.userId}, ${params.provider}, ${params.email},
      ${params.displayName || null}, ${params.profilePicture || null},
      ${params.providerUserId || null}, ${encryptedTokens},
      ${JSON.stringify(params.scopes)}, 'connected', NOW()
    )
    ON CONFLICT (user_id, provider, email)
    DO UPDATE SET
      display_name = COALESCE(${params.displayName}, email_connections.display_name),
      profile_picture = COALESCE(${params.profilePicture}, email_connections.profile_picture),
      provider_user_id = COALESCE(${params.providerUserId}, email_connections.provider_user_id),
      encrypted_tokens = ${encryptedTokens},
      scopes = ${JSON.stringify(params.scopes)},
      status = 'connected',
      error_message = NULL,
      updated_at = NOW()
    RETURNING *
  `;

  return mapConnectionFromDb(result.rows[0]);
}

/**
 * Get decrypted tokens for a connection
 */
export async function getTokens(connectionId: string): Promise<OAuthTokens | null> {
  await ensureOAuthTables();

  const result = await sql`
    SELECT encrypted_tokens, status
    FROM email_connections
    WHERE id = ${connectionId}
  `;

  if (result.rows.length === 0 || !result.rows[0].encrypted_tokens) {
    return null;
  }

  return decryptTokens(result.rows[0].encrypted_tokens);
}

/**
 * Get tokens by user and email
 */
export async function getTokensByEmail(
  userId: string,
  provider: EmailProvider,
  email: string
): Promise<{ connectionId: string; tokens: OAuthTokens } | null> {
  await ensureOAuthTables();

  const result = await sql`
    SELECT id, encrypted_tokens
    FROM email_connections
    WHERE user_id = ${userId}
      AND provider = ${provider}
      AND email = ${email}
      AND status = 'connected'
  `;

  if (result.rows.length === 0 || !result.rows[0].encrypted_tokens) {
    return null;
  }

  const tokens = decryptTokens(result.rows[0].encrypted_tokens);
  if (!tokens) return null;

  return {
    connectionId: result.rows[0].id,
    tokens,
  };
}

/**
 * Update tokens after refresh
 */
export async function updateTokens(
  connectionId: string,
  tokens: OAuthTokens
): Promise<void> {
  await ensureOAuthTables();

  const encryptedTokens = encryptTokens(tokens);

  await sql`
    UPDATE email_connections
    SET encrypted_tokens = ${encryptedTokens},
        status = 'connected',
        error_message = NULL,
        updated_at = NOW()
    WHERE id = ${connectionId}
  `;
}

/**
 * Check if tokens need refresh (within 5 minutes of expiry)
 */
export function tokensNeedRefresh(tokens: OAuthTokens): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return Date.now() > tokens.expires_at - bufferMs;
}

/**
 * Log token refresh attempt
 */
export async function logTokenRefresh(params: {
  connectionId: string;
  success: boolean;
  errorMessage?: string;
  oldExpiresAt?: number;
  newExpiresAt?: number;
}): Promise<void> {
  await ensureOAuthTables();

  await sql`
    INSERT INTO oauth_refresh_log (
      connection_id, success, error_message, old_expires_at, new_expires_at
    ) VALUES (
      ${params.connectionId}, ${params.success}, ${params.errorMessage || null},
      ${params.oldExpiresAt ? new Date(params.oldExpiresAt).toISOString() : null},
      ${params.newExpiresAt ? new Date(params.newExpiresAt).toISOString() : null}
    )
  `;
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Get all email connections for a user
 */
export async function getUserConnections(userId: string): Promise<EmailConnection[]> {
  await ensureOAuthTables();

  const result = await sql`
    SELECT * FROM email_connections
    WHERE user_id = ${userId}
    ORDER BY provider, email
  `;

  return result.rows.map(mapConnectionFromDb);
}

/**
 * Get connection with health status
 */
export async function getConnectionWithHealth(connectionId: string): Promise<ConnectionWithHealth | null> {
  await ensureOAuthTables();

  const result = await sql`
    SELECT * FROM email_connections
    WHERE id = ${connectionId}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const connection = mapConnectionFromDb(result.rows[0]);
  const tokens = result.rows[0].encrypted_tokens
    ? decryptTokens(result.rows[0].encrypted_tokens)
    : null;

  const now = Date.now();
  const expiresAt = tokens?.expires_at || 0;
  const expiresInHours = Math.max(0, (expiresAt - now) / (1000 * 60 * 60));

  return {
    ...connection,
    health: {
      token_valid: connection.status === 'connected' && tokens !== null,
      token_expires_in_hours: Math.round(expiresInHours * 10) / 10,
      needs_refresh: tokens ? tokensNeedRefresh(tokens) : true,
      last_successful_sync: connection.last_sync_at,
    },
  };
}

/**
 * Get connections by provider
 */
export async function getConnectionsByProvider(
  userId: string,
  provider: EmailProvider
): Promise<EmailConnection[]> {
  await ensureOAuthTables();

  const result = await sql`
    SELECT * FROM email_connections
    WHERE user_id = ${userId}
      AND provider = ${provider}
    ORDER BY email
  `;

  return result.rows.map(mapConnectionFromDb);
}

/**
 * Get a specific connection
 */
export async function getConnection(connectionId: string): Promise<EmailConnection | null> {
  await ensureOAuthTables();

  const result = await sql`
    SELECT * FROM email_connections
    WHERE id = ${connectionId}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return mapConnectionFromDb(result.rows[0]);
}

/**
 * Update connection status
 */
export async function updateConnectionStatus(
  connectionId: string,
  status: ConnectionStatus,
  errorMessage?: string
): Promise<void> {
  await ensureOAuthTables();

  await sql`
    UPDATE email_connections
    SET status = ${status},
        error_message = ${errorMessage || null},
        updated_at = NOW()
    WHERE id = ${connectionId}
  `;
}

/**
 * Update last sync timestamp
 */
export async function updateLastSync(connectionId: string): Promise<void> {
  await ensureOAuthTables();

  await sql`
    UPDATE email_connections
    SET last_sync_at = NOW(),
        updated_at = NOW()
    WHERE id = ${connectionId}
  `;
}

/**
 * Disconnect an email account
 */
export async function disconnectEmail(connectionId: string): Promise<void> {
  await ensureOAuthTables();

  await sql`
    UPDATE email_connections
    SET status = 'disconnected',
        encrypted_tokens = NULL,
        updated_at = NOW()
    WHERE id = ${connectionId}
  `;
}

/**
 * Delete a connection completely
 */
export async function deleteConnection(connectionId: string): Promise<void> {
  await ensureOAuthTables();

  await sql`
    DELETE FROM email_connections
    WHERE id = ${connectionId}
  `;
}

/**
 * Get connections summary for dashboard
 */
export async function getConnectionsSummary(userId: string): Promise<{
  gmail: { connected: number; emails: string[] };
  outlook: { connected: number; emails: string[] };
  total: number;
}> {
  await ensureOAuthTables();

  const result = await sql`
    SELECT provider, email, status
    FROM email_connections
    WHERE user_id = ${userId}
      AND status = 'connected'
    ORDER BY provider, email
  `;

  const summary = {
    gmail: { connected: 0, emails: [] as string[] },
    outlook: { connected: 0, emails: [] as string[] },
    total: 0,
  };

  for (const row of result.rows) {
    if (row.provider === 'gmail') {
      summary.gmail.connected++;
      summary.gmail.emails.push(row.email);
    } else if (row.provider === 'outlook') {
      summary.outlook.connected++;
      summary.outlook.emails.push(row.email);
    }
    summary.total++;
  }

  return summary;
}

// ============================================================================
// HELPERS
// ============================================================================

function mapConnectionFromDb(row: any): EmailConnection {
  return {
    id: row.id,
    user_id: row.user_id,
    provider: row.provider as EmailProvider,
    email: row.email,
    display_name: row.display_name,
    profile_picture: row.profile_picture,
    status: row.status as ConnectionStatus,
    scopes: row.scopes || [],
    last_sync_at: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
    error_message: row.error_message,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
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

  // Tables
  ensureOAuthTables,
};
