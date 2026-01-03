/**
 * Credential Types for WellsAI
 *
 * Defines all credential-related types for secure storage of
 * OAuth tokens, API keys, and webhook secrets per user.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Supported OAuth/API providers
 */
export enum CredentialProvider {
  // Email
  Gmail = 'gmail',
  Outlook = 'outlook',

  // Social
  LinkedIn = 'linkedin',
  Twitter = 'twitter',
  Instagram = 'instagram',

  // Communication
  Slack = 'slack',
  Discord = 'discord',
  Teams = 'teams',
  Twilio = 'twilio',

  // Financial/Payments
  Stripe = 'stripe',
  Plaid = 'plaid',
  Circle = 'circle',

  // ERP/Accounting
  QuickBooks = 'quickbooks',
  Xero = 'xero',
  NetSuite = 'netsuite',

  // CRM
  Salesforce = 'salesforce',
  HubSpot = 'hubspot',

  // Productivity
  Notion = 'notion',
  Airtable = 'airtable',
  Google = 'google',

  // AI/Data
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Apollo = 'apollo',

  // Calendar
  GoogleCalendar = 'google_calendar',
  OutlookCalendar = 'outlook_calendar',
  Calendly = 'calendly',

  // Custom/Other
  Custom = 'custom',
}

/**
 * Types of credentials we store
 */
export enum CredentialType {
  OAuth = 'oauth',           // OAuth 2.0 tokens (access + refresh)
  ApiKey = 'api_key',        // Simple API keys
  WebhookSecret = 'webhook_secret', // Webhook verification secrets
  SessionToken = 'session_token',   // Session-based auth (e.g., LinkedIn cookie)
  Certificate = 'certificate',      // Client certificates
  ServiceAccount = 'service_account', // Service account JSON
}

/**
 * Connection health status
 */
export enum ConnectionHealth {
  Healthy = 'healthy',
  Expiring = 'expiring',     // Token expires within 24 hours
  Expired = 'expired',       // Token is expired
  RefreshFailed = 'refresh_failed', // Last refresh attempt failed
  Invalid = 'invalid',       // Credentials are invalid
  Unknown = 'unknown',       // Health check not performed yet
}

/**
 * Credential audit action types
 */
export enum CredentialAuditAction {
  Store = 'store',
  Refresh = 'refresh',
  Rotate = 'rotate',
  Revoke = 'revoke',
  Access = 'access',
  HealthCheck = 'health_check',
  Decrypt = 'decrypt',
}

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Base credential interface (stored in DB)
 */
export interface StoredCredential {
  id: string;
  userId: string;
  provider: CredentialProvider;
  credentialType: CredentialType;

  // Encrypted credential data (AES-256-GCM)
  encryptedData: string;

  // Key management
  keyId: string;              // ID of the encryption key used
  keyVersion: number;         // Key version for rotation

  // OAuth-specific
  scopes?: string[];
  tokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
  lastRefreshAt?: Date;
  refreshAttempts?: number;

  // Health monitoring
  health: ConnectionHealth;
  lastHealthCheck?: Date;
  healthCheckError?: string;

  // Metadata
  label?: string;             // User-friendly name (e.g., "Work Gmail")
  email?: string;             // Associated email/account
  accountId?: string;         // Provider's account ID
  isActive: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Decrypted credential data (never stored directly)
 */
export interface DecryptedCredential {
  // OAuth tokens
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;

  // API keys
  apiKey?: string;
  apiSecret?: string;

  // Webhook secrets
  webhookSecret?: string;
  signingSecret?: string;

  // Session tokens
  sessionToken?: string;
  sessionCookie?: string;

  // Service account
  serviceAccountJson?: string;
  clientId?: string;
  clientSecret?: string;

  // Additional provider-specific data
  metadata?: Record<string, any>;
}

/**
 * Full credential (with decrypted data) - for internal use only
 */
export interface Credential extends Omit<StoredCredential, 'encryptedData'> {
  data: DecryptedCredential;
}

/**
 * Input for creating a new credential
 */
export interface CreateCredentialInput {
  userId: string;
  provider: CredentialProvider;
  credentialType: CredentialType;
  data: DecryptedCredential;

  // Optional metadata
  scopes?: string[];
  tokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
  label?: string;
  email?: string;
  accountId?: string;
}

/**
 * Input for updating an existing credential
 */
export interface UpdateCredentialInput {
  data?: DecryptedCredential;
  scopes?: string[];
  tokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
  label?: string;
  email?: string;
  health?: ConnectionHealth;
  healthCheckError?: string;
  isActive?: boolean;
}

/**
 * Credential health check result
 */
export interface HealthCheckResult {
  credentialId: string;
  provider: CredentialProvider;
  health: ConnectionHealth;
  message?: string;
  checkedAt: Date;
  tokenExpiresAt?: Date;
  secondsUntilExpiry?: number;
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  credentialId: string;
  newAccessToken?: string;
  newRefreshToken?: string;
  newExpiresAt?: Date;
  error?: string;
}

/**
 * Credential audit log entry
 */
export interface CredentialAuditLog {
  id: string;
  credentialId?: string;
  userId: string;
  action: CredentialAuditAction;
  provider: CredentialProvider;

  // Request context
  ipAddress?: string;
  userAgent?: string;

  // Result
  success: boolean;
  errorMessage?: string;

  // Metadata
  metadata?: Record<string, any>;

  createdAt: Date;
}

/**
 * Key rotation tracking
 */
export interface KeyRotation {
  id: string;
  oldKeyId: string;
  newKeyId: string;
  rotatedBy: string;
  credentialsRotated: number;
  credentialsFailed: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * Scheduled token refresh job
 */
export interface TokenRefreshJob {
  id: string;
  credentialId: string;
  provider: CredentialProvider;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'success' | 'failed';
  newTokenExpiresAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}

// =============================================================================
// QUERY/FILTER TYPES
// =============================================================================

/**
 * Filter options for credential queries
 */
export interface CredentialFilter {
  userId?: string;
  provider?: CredentialProvider | CredentialProvider[];
  credentialType?: CredentialType | CredentialType[];
  health?: ConnectionHealth | ConnectionHealth[];
  isActive?: boolean;
  expiringWithinHours?: number;
}

/**
 * Summary of user's credentials
 */
export interface CredentialSummary {
  userId: string;
  totalCredentials: number;
  byProvider: Record<CredentialProvider, number>;
  byHealth: Record<ConnectionHealth, number>;
  expiringIn24h: number;
  expired: number;
  lastUpdated: Date;
}

/**
 * Provider-specific OAuth configuration
 */
export interface OAuthProviderConfig {
  provider: CredentialProvider;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  refreshEnabled: boolean;
  tokenLifetimeSeconds: number;
}

// =============================================================================
// ENCRYPTION TYPES
// =============================================================================

/**
 * Encrypted data format
 * Format: keyId:iv:ciphertext:authTag (all hex encoded)
 */
export interface EncryptedPayload {
  keyId: string;
  iv: string;          // 12 bytes, hex encoded (24 chars)
  ciphertext: string;  // Variable length, hex encoded
  authTag: string;     // 16 bytes, hex encoded (32 chars)
}

/**
 * Encryption key metadata (never store actual key here)
 */
export interface EncryptionKeyMeta {
  keyId: string;
  version: number;
  algorithm: 'aes-256-gcm';
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}
