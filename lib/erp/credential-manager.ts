// @ts-nocheck
/**
 * ERP Credential Manager
 *
 * Secure credential storage and management for all ERP integrations.
 * Uses AES-256-GCM encryption with key derivation per credential type.
 *
 * Supported ERPs:
 * - QuickBooks (OAuth 2.0)
 * - Xero (OAuth 2.0)
 * - NetSuite (OAuth 2.0 / Token-Based Auth)
 * - SAP (OAuth 2.0)
 * - Oracle (OAuth 2.0)
 * - Dynamics 365 (OAuth 2.0)
 * - Workday (OAuth 2.0 with ISU)
 * - Coupa (OAuth 2.0)
 * - Sage Intacct (Web Services credentials)
 * - Acumatica (OAuth 2.0)
 * - Infor (ION API OAuth 2.0)
 */

import crypto from 'crypto'
import { neon } from '@neondatabase/serverless'

// ============================================================================
// Types
// ============================================================================

export type ERPProvider =
  | 'quickbooks'
  | 'xero'
  | 'netsuite'
  | 'sap'
  | 'oracle'
  | 'dynamics365'
  | 'workday'
  | 'coupa'
  | 'sage_intacct'
  | 'acumatica'
  | 'infor'

export type CredentialType =
  | 'access_token'
  | 'refresh_token'
  | 'client_secret'
  | 'api_key'
  | 'webhook_secret'
  | 'user_password'
  | 'integration_secret'
  | 'consumer_secret'

export interface ERPCredentials {
  provider: ERPProvider
  connectionId: string

  // OAuth tokens
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: Date

  // Provider-specific identifiers
  realmId?: string // QuickBooks
  tenantId?: string // Xero, Dynamics, Workday
  companyKey?: string // Codat/Sage

  // API credentials (non-OAuth)
  clientId?: string
  clientSecret?: string
  apiKey?: string

  // Sage Intacct specific
  senderId?: string
  senderPassword?: string
  userId?: string
  userPassword?: string
  intacctCompanyId?: string

  // Workday specific
  integrationId?: string
  integrationSecret?: string
  dataCenter?: string

  // NetSuite specific
  accountId?: string
  consumerKey?: string
  consumerSecret?: string
  tokenKey?: string
  tokenSecret?: string

  // SAP/Oracle/Infor specific
  apiEndpoint?: string
  instanceUrl?: string

  // Webhook
  webhookId?: string
  webhookSecret?: string

  // Metadata
  scopes?: string[]
  lastRefreshedAt?: Date
}

export interface EncryptedCredentials {
  keyId: string
  iv: string
  ciphertext: string
  authTag: string
  provider: ERPProvider
  credentialTypes: CredentialType[]
}

export class CredentialManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: ERPProvider
  ) {
    super(message)
    this.name = 'CredentialManagerError'
  }
}

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

// Credential refresh thresholds (in seconds)
const REFRESH_THRESHOLDS: Record<ERPProvider, number> = {
  quickbooks: 600, // 10 minutes before expiry
  xero: 600,
  netsuite: 600,
  sap: 300,
  oracle: 600,
  dynamics365: 600,
  workday: 600,
  coupa: 600,
  sage_intacct: 0, // Credentials don't expire
  acumatica: 600,
  infor: 600,
}

// Token lifetimes (in seconds)
const TOKEN_LIFETIMES: Record<ERPProvider, number> = {
  quickbooks: 3600, // 1 hour
  xero: 1800, // 30 minutes
  netsuite: 7200, // 2 hours
  sap: 1800,
  oracle: 3600,
  dynamics365: 3600,
  workday: 1800,
  coupa: 3600,
  sage_intacct: Infinity, // Session-based
  acumatica: 3600,
  infor: 3600,
}

// ============================================================================
// Key Management
// ============================================================================

function getEncryptionKey(): Buffer {
  // Use ERP-specific key if available, fallback to PII key
  const keyHex = process.env.ERP_ENCRYPTION_KEY || process.env.PII_ENCRYPTION_KEY

  if (!keyHex) {
    throw new CredentialManagerError(
      'ERP_ENCRYPTION_KEY or PII_ENCRYPTION_KEY environment variable is not set',
      'KEY_NOT_CONFIGURED'
    )
  }

  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new CredentialManagerError(
      'Encryption key must be a 64-character hex string (32 bytes)',
      'INVALID_KEY_FORMAT'
    )
  }

  return Buffer.from(keyHex, 'hex')
}

function getKeyId(): string {
  const keyId = process.env.ERP_ENCRYPTION_KEY_ID || process.env.PII_ENCRYPTION_KEY_ID

  if (!keyId) {
    throw new CredentialManagerError(
      'ERP_ENCRYPTION_KEY_ID or PII_ENCRYPTION_KEY_ID environment variable is not set',
      'KEY_ID_NOT_CONFIGURED'
    )
  }

  return keyId
}

/**
 * Derive a provider-specific key from the master key
 */
function deriveProviderKey(masterKey: Buffer, provider: ERPProvider): Buffer {
  const salt = Buffer.from(`wells-ai:erp:${provider}`, 'utf8')
  return crypto.pbkdf2Sync(masterKey, salt, 10000, KEY_LENGTH, 'sha256')
}

// ============================================================================
// Encryption Functions
// ============================================================================

/**
 * Encrypt credentials for storage
 */
export function encryptCredentials(
  credentials: ERPCredentials
): string {
  const { provider } = credentials

  if (!provider) {
    throw new CredentialManagerError(
      'Provider is required',
      'INVALID_INPUT'
    )
  }

  try {
    const masterKey = getEncryptionKey()
    const keyId = getKeyId()
    const providerKey = deriveProviderKey(masterKey, provider)

    // Serialize credentials (excluding non-sensitive metadata)
    const sensitiveFields = extractSensitiveFields(credentials)
    const plaintext = JSON.stringify(sensitiveFields)

    // Generate IV
    const iv = crypto.randomBytes(IV_LENGTH)

    // Encrypt
    const cipher = crypto.createCipheriv(ALGORITHM, providerKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])

    const authTag = cipher.getAuthTag()

    // Format: keyId:iv:ciphertext:authTag
    return [
      keyId,
      iv.toString('hex'),
      encrypted.toString('hex'),
      authTag.toString('hex'),
    ].join(':')
  } catch (error) {
    if (error instanceof CredentialManagerError) {
      throw error
    }
    throw new CredentialManagerError(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ENCRYPTION_FAILED',
      provider
    )
  }
}

/**
 * Decrypt stored credentials
 */
export function decryptCredentials(
  encryptedValue: string,
  provider: ERPProvider
): Partial<ERPCredentials> {
  if (!encryptedValue || typeof encryptedValue !== 'string') {
    throw new CredentialManagerError(
      'Encrypted value must be a non-empty string',
      'INVALID_INPUT',
      provider
    )
  }

  const parts = encryptedValue.split(':')

  if (parts.length !== 4) {
    throw new CredentialManagerError(
      'Invalid encrypted value format',
      'INVALID_FORMAT',
      provider
    )
  }

  const [storedKeyId, ivHex, ciphertextHex, authTagHex] = parts

  try {
    const masterKey = getEncryptionKey()
    const providerKey = deriveProviderKey(masterKey, provider)

    const iv = Buffer.from(ivHex, 'hex')
    const ciphertext = Buffer.from(ciphertextHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, providerKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return JSON.parse(decrypted.toString('utf8'))
  } catch (error) {
    if (error instanceof CredentialManagerError) {
      throw error
    }
    throw new CredentialManagerError(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'DECRYPTION_FAILED',
      provider
    )
  }
}

/**
 * Extract sensitive fields that need encryption
 */
function extractSensitiveFields(credentials: ERPCredentials): Partial<ERPCredentials> {
  const {
    provider,
    connectionId,
    accessToken,
    refreshToken,
    clientSecret,
    apiKey,
    senderPassword,
    userPassword,
    integrationSecret,
    consumerSecret,
    tokenSecret,
    webhookSecret,
  } = credentials

  return {
    provider,
    connectionId,
    accessToken,
    refreshToken,
    clientSecret,
    apiKey,
    senderPassword,
    userPassword,
    integrationSecret,
    consumerSecret,
    tokenSecret,
    webhookSecret,
  }
}

// ============================================================================
// Database Operations
// ============================================================================

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

/**
 * Store encrypted credentials in the database
 */
export async function storeCredentials(
  connectionId: string,
  credentials: ERPCredentials
): Promise<void> {
  if (!sql) {
    throw new CredentialManagerError(
      'Database not configured',
      'DB_NOT_CONFIGURED',
      credentials.provider
    )
  }

  const encryptedCreds = encryptCredentials(credentials)

  // Update the connection with encrypted credentials
  await sql`
    UPDATE erp_connections
    SET
      access_token = ${credentials.accessToken ? encryptedCreds : null},
      refresh_token = ${credentials.refreshToken ? encryptCredential(credentials.refreshToken, credentials.provider) : null},
      token_expires_at = ${credentials.tokenExpiresAt || null},
      realm_id = ${credentials.realmId || null},
      tenant_id = ${credentials.tenantId || null},
      company_key = ${credentials.companyKey || null},
      webhook_secret = ${credentials.webhookSecret ? encryptCredential(credentials.webhookSecret, credentials.provider) : null},
      updated_at = NOW()
    WHERE id = ${connectionId}
  `
}

/**
 * Encrypt a single credential value
 */
export function encryptCredential(value: string, provider: ERPProvider): string {
  if (!value) return ''

  try {
    const masterKey = getEncryptionKey()
    const keyId = getKeyId()
    const providerKey = deriveProviderKey(masterKey, provider)

    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, providerKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })

    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ])

    const authTag = cipher.getAuthTag()

    return [
      keyId,
      iv.toString('hex'),
      encrypted.toString('hex'),
      authTag.toString('hex'),
    ].join(':')
  } catch (error) {
    console.error(`[Credential Manager] Encrypt error:`, error)
    throw new CredentialManagerError(
      'Failed to encrypt credential',
      'ENCRYPTION_FAILED',
      provider
    )
  }
}

/**
 * Decrypt a single credential value
 */
export function decryptCredential(encryptedValue: string, provider: ERPProvider): string {
  if (!encryptedValue) return ''

  const parts = encryptedValue.split(':')
  if (parts.length !== 4) {
    // Not encrypted or invalid format
    return encryptedValue
  }

  try {
    const [, ivHex, ciphertextHex, authTagHex] = parts

    const masterKey = getEncryptionKey()
    const providerKey = deriveProviderKey(masterKey, provider)

    const iv = Buffer.from(ivHex, 'hex')
    const ciphertext = Buffer.from(ciphertextHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, providerKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch (error) {
    console.error(`[Credential Manager] Decrypt error:`, error)
    throw new CredentialManagerError(
      'Failed to decrypt credential',
      'DECRYPTION_FAILED',
      provider
    )
  }
}

/**
 * Retrieve and decrypt credentials from the database
 */
export async function getCredentials(
  connectionId: string
): Promise<ERPCredentials | null> {
  if (!sql) {
    throw new CredentialManagerError(
      'Database not configured',
      'DB_NOT_CONFIGURED'
    )
  }

  const [connection] = await sql`
    SELECT
      id,
      provider,
      access_token,
      refresh_token,
      token_expires_at,
      realm_id,
      tenant_id,
      company_key,
      webhook_secret
    FROM erp_connections
    WHERE id = ${connectionId}
  `

  if (!connection) {
    return null
  }

  const provider = connection.provider as ERPProvider

  return {
    provider,
    connectionId: connection.id,
    accessToken: connection.access_token
      ? decryptCredential(connection.access_token, provider)
      : undefined,
    refreshToken: connection.refresh_token
      ? decryptCredential(connection.refresh_token, provider)
      : undefined,
    tokenExpiresAt: connection.token_expires_at
      ? new Date(connection.token_expires_at)
      : undefined,
    realmId: connection.realm_id,
    tenantId: connection.tenant_id,
    companyKey: connection.company_key,
    webhookSecret: connection.webhook_secret
      ? decryptCredential(connection.webhook_secret, provider)
      : undefined,
  }
}

/**
 * Update access token after refresh
 */
export async function updateAccessToken(
  connectionId: string,
  provider: ERPProvider,
  accessToken: string,
  expiresIn: number,
  refreshToken?: string
): Promise<void> {
  if (!sql) {
    throw new CredentialManagerError(
      'Database not configured',
      'DB_NOT_CONFIGURED',
      provider
    )
  }

  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000)
  const encryptedAccessToken = encryptCredential(accessToken, provider)
  const encryptedRefreshToken = refreshToken
    ? encryptCredential(refreshToken, provider)
    : null

  if (encryptedRefreshToken) {
    await sql`
      UPDATE erp_connections
      SET
        access_token = ${encryptedAccessToken},
        refresh_token = ${encryptedRefreshToken},
        token_expires_at = ${tokenExpiresAt},
        updated_at = NOW()
      WHERE id = ${connectionId}
    `
  } else {
    await sql`
      UPDATE erp_connections
      SET
        access_token = ${encryptedAccessToken},
        token_expires_at = ${tokenExpiresAt},
        updated_at = NOW()
      WHERE id = ${connectionId}
    `
  }
}

// ============================================================================
// Token Refresh Logic
// ============================================================================

/**
 * Check if token needs refresh
 */
export function needsRefresh(
  provider: ERPProvider,
  tokenExpiresAt?: Date
): boolean {
  if (!tokenExpiresAt) {
    return provider !== 'sage_intacct' // Sage uses session-based auth
  }

  const threshold = REFRESH_THRESHOLDS[provider] || 600
  const expiresIn = Math.floor((tokenExpiresAt.getTime() - Date.now()) / 1000)

  return expiresIn <= threshold
}

/**
 * Get token lifetime for a provider
 */
export function getTokenLifetime(provider: ERPProvider): number {
  return TOKEN_LIFETIMES[provider] || 3600
}

/**
 * Refresh OAuth tokens for a connection
 */
export async function refreshTokens(
  connectionId: string
): Promise<ERPCredentials | null> {
  const credentials = await getCredentials(connectionId)

  if (!credentials || !credentials.refreshToken) {
    return null
  }

  const { provider } = credentials

  // Import the appropriate adapter
  let newTokens: { accessToken: string; refreshToken?: string; expiresIn: number } | null = null

  switch (provider) {
    case 'quickbooks': {
      const { quickbooks } = await import('./quickbooks')
      newTokens = await quickbooks.refreshTokens(credentials.refreshToken)
      break
    }
    case 'xero': {
      const { xero } = await import('./xero')
      newTokens = await xero.refreshTokens(credentials.refreshToken)
      break
    }
    case 'netsuite': {
      const { netsuite } = await import('./netsuite')
      newTokens = await netsuite.refreshTokens(credentials.refreshToken)
      break
    }
    case 'sap': {
      const { sap } = await import('./sap')
      newTokens = await sap.refreshTokens(credentials.refreshToken)
      break
    }
    case 'oracle': {
      const { oracle } = await import('./oracle')
      newTokens = await oracle.refreshTokens(credentials.refreshToken)
      break
    }
    case 'dynamics365': {
      const { dynamics365 } = await import('./dynamics365')
      newTokens = await dynamics365.refreshTokens(
        credentials.refreshToken,
        credentials.tenantId || ''
      )
      break
    }
    case 'workday': {
      const { workday } = await import('./workday')
      newTokens = await workday.refreshTokens(credentials.refreshToken)
      break
    }
    case 'coupa': {
      const { coupa } = await import('./coupa')
      newTokens = await coupa.refreshTokens(credentials.refreshToken)
      break
    }
    case 'acumatica': {
      const { acumatica } = await import('./acumatica')
      newTokens = await acumatica.refreshTokens(credentials.refreshToken)
      break
    }
    case 'infor': {
      const { infor } = await import('./infor')
      newTokens = await infor.refreshTokens(credentials.refreshToken)
      break
    }
    case 'sage_intacct':
      // Sage Intacct uses session-based auth, no refresh needed
      return credentials
    default:
      throw new CredentialManagerError(
        `Unknown provider: ${provider}`,
        'UNKNOWN_PROVIDER',
        provider
      )
  }

  if (newTokens) {
    await updateAccessToken(
      connectionId,
      provider,
      newTokens.accessToken,
      newTokens.expiresIn,
      newTokens.refreshToken
    )

    return {
      ...credentials,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken || credentials.refreshToken,
      tokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
    }
  }

  return null
}

/**
 * Get valid credentials (refresh if needed)
 */
export async function getValidCredentials(
  connectionId: string
): Promise<ERPCredentials | null> {
  const credentials = await getCredentials(connectionId)

  if (!credentials) {
    return null
  }

  if (needsRefresh(credentials.provider, credentials.tokenExpiresAt)) {
    const refreshed = await refreshTokens(connectionId)
    if (refreshed) {
      return refreshed
    }
  }

  return credentials
}

// ============================================================================
// Extended Provider Credentials
// ============================================================================

/**
 * Store Sage Intacct web services credentials
 */
export async function storeSageIntacctCredentials(
  connectionId: string,
  credentials: {
    senderId: string
    senderPassword: string
    userId: string
    userPassword: string
    companyId: string
  }
): Promise<void> {
  if (!sql) {
    throw new CredentialManagerError(
      'Database not configured',
      'DB_NOT_CONFIGURED',
      'sage_intacct'
    )
  }

  // Encrypt all sensitive credentials
  const encryptedSenderPassword = encryptCredential(credentials.senderPassword, 'sage_intacct')
  const encryptedUserPassword = encryptCredential(credentials.userPassword, 'sage_intacct')

  await sql`
    UPDATE erp_connections
    SET
      intacct_sender_id = ${credentials.senderId},
      intacct_sender_password = ${encryptedSenderPassword},
      intacct_user_id = ${credentials.userId},
      intacct_user_password = ${encryptedUserPassword},
      intacct_company_id = ${credentials.companyId},
      connection_status = 'active',
      updated_at = NOW()
    WHERE id = ${connectionId}
  `
}

/**
 * Store Workday integration credentials
 */
export async function storeWorkdayCredentials(
  connectionId: string,
  credentials: {
    tenant: string
    integrationId: string
    integrationSecret: string
    refreshToken: string
    dataCenter?: string
  }
): Promise<void> {
  if (!sql) {
    throw new CredentialManagerError(
      'Database not configured',
      'DB_NOT_CONFIGURED',
      'workday'
    )
  }

  const encryptedSecret = encryptCredential(credentials.integrationSecret, 'workday')
  const encryptedRefreshToken = encryptCredential(credentials.refreshToken, 'workday')

  await sql`
    UPDATE erp_connections
    SET
      tenant_id = ${credentials.tenant},
      workday_integration_id = ${credentials.integrationId},
      workday_integration_secret = ${encryptedSecret},
      refresh_token = ${encryptedRefreshToken},
      workday_data_center = ${credentials.dataCenter || 'us'},
      connection_status = 'active',
      updated_at = NOW()
    WHERE id = ${connectionId}
  `
}

/**
 * Store NetSuite token-based auth credentials
 */
export async function storeNetSuiteCredentials(
  connectionId: string,
  credentials: {
    accountId: string
    consumerKey: string
    consumerSecret: string
    tokenKey: string
    tokenSecret: string
  }
): Promise<void> {
  if (!sql) {
    throw new CredentialManagerError(
      'Database not configured',
      'DB_NOT_CONFIGURED',
      'netsuite'
    )
  }

  const encryptedConsumerSecret = encryptCredential(credentials.consumerSecret, 'netsuite')
  const encryptedTokenSecret = encryptCredential(credentials.tokenSecret, 'netsuite')

  await sql`
    UPDATE erp_connections
    SET
      netsuite_account_id = ${credentials.accountId},
      netsuite_consumer_key = ${credentials.consumerKey},
      netsuite_consumer_secret = ${encryptedConsumerSecret},
      netsuite_token_key = ${credentials.tokenKey},
      netsuite_token_secret = ${encryptedTokenSecret},
      connection_status = 'active',
      updated_at = NOW()
    WHERE id = ${connectionId}
  `
}

// ============================================================================
// Credential Validation
// ============================================================================

/**
 * Validate that required credentials are present for a provider
 */
export function validateCredentials(
  provider: ERPProvider,
  credentials: Partial<ERPCredentials>
): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  switch (provider) {
    case 'quickbooks':
    case 'xero':
    case 'oracle':
    case 'dynamics365':
    case 'coupa':
    case 'acumatica':
    case 'infor':
      if (!credentials.accessToken) missing.push('accessToken')
      if (!credentials.refreshToken) missing.push('refreshToken')
      break

    case 'netsuite':
      if (credentials.accessToken) {
        // OAuth mode
        if (!credentials.refreshToken) missing.push('refreshToken')
      } else {
        // Token-based auth mode
        if (!credentials.consumerKey) missing.push('consumerKey')
        if (!credentials.consumerSecret) missing.push('consumerSecret')
        if (!credentials.tokenKey) missing.push('tokenKey')
        if (!credentials.tokenSecret) missing.push('tokenSecret')
      }
      break

    case 'sap':
      if (!credentials.accessToken) missing.push('accessToken')
      if (!credentials.apiEndpoint) missing.push('apiEndpoint')
      break

    case 'workday':
      if (!credentials.tenantId) missing.push('tenantId')
      if (!credentials.integrationId) missing.push('integrationId')
      if (!credentials.integrationSecret) missing.push('integrationSecret')
      break

    case 'sage_intacct':
      if (!credentials.senderId) missing.push('senderId')
      if (!credentials.senderPassword) missing.push('senderPassword')
      if (!credentials.userId) missing.push('userId')
      if (!credentials.userPassword) missing.push('userPassword')
      break
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

// ============================================================================
// Key Rotation
// ============================================================================

/**
 * Rotate encryption key for a connection
 */
export async function rotateConnectionKey(
  connectionId: string,
  oldKey: string,
  newKey: string,
  newKeyId: string
): Promise<void> {
  if (!sql) {
    throw new CredentialManagerError(
      'Database not configured',
      'DB_NOT_CONFIGURED'
    )
  }

  // Get current credentials
  const [connection] = await sql`
    SELECT provider, access_token, refresh_token, webhook_secret
    FROM erp_connections
    WHERE id = ${connectionId}
  `

  if (!connection) {
    throw new CredentialManagerError(
      'Connection not found',
      'NOT_FOUND'
    )
  }

  const provider = connection.provider as ERPProvider

  // Re-encrypt each credential with the new key
  const oldKeyBuffer = Buffer.from(oldKey, 'hex')
  const newKeyBuffer = Buffer.from(newKey, 'hex')

  const reencrypt = (encryptedValue: string | null): string | null => {
    if (!encryptedValue) return null

    // Decrypt with old key
    const parts = encryptedValue.split(':')
    if (parts.length !== 4) return encryptedValue

    const [, ivHex, ciphertextHex, authTagHex] = parts
    const oldProviderKey = deriveProviderKey(oldKeyBuffer, provider)

    const iv = Buffer.from(ivHex, 'hex')
    const ciphertext = Buffer.from(ciphertextHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, oldProviderKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')

    // Re-encrypt with new key
    const newProviderKey = deriveProviderKey(newKeyBuffer, provider)
    const newIv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, newProviderKey, newIv, {
      authTagLength: AUTH_TAG_LENGTH,
    })

    const encrypted = Buffer.concat([
      cipher.update(decrypted, 'utf8'),
      cipher.final(),
    ])

    const newAuthTag = cipher.getAuthTag()

    return [
      newKeyId,
      newIv.toString('hex'),
      encrypted.toString('hex'),
      newAuthTag.toString('hex'),
    ].join(':')
  }

  const newAccessToken = reencrypt(connection.access_token)
  const newRefreshToken = reencrypt(connection.refresh_token)
  const newWebhookSecret = reencrypt(connection.webhook_secret)

  await sql`
    UPDATE erp_connections
    SET
      access_token = ${newAccessToken},
      refresh_token = ${newRefreshToken},
      webhook_secret = ${newWebhookSecret},
      updated_at = NOW()
    WHERE id = ${connectionId}
  `
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a new encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Generate a new key ID
 */
export function generateKeyId(): string {
  const timestamp = Date.now().toString(36)
  const random = crypto.randomBytes(4).toString('hex')
  return `erp_${timestamp}_${random}`
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false

  const parts = value.split(':')
  if (parts.length !== 4) return false

  const [keyId, iv, ciphertext, authTag] = parts

  return (
    keyId.length > 0 &&
    /^[a-fA-F0-9]+$/.test(iv) &&
    /^[a-fA-F0-9]+$/.test(ciphertext) &&
    /^[a-fA-F0-9]+$/.test(authTag) &&
    Buffer.from(iv, 'hex').length === IV_LENGTH &&
    Buffer.from(authTag, 'hex').length === AUTH_TAG_LENGTH
  )
}

// ============================================================================
// Export
// ============================================================================

export const credentialManager = {
  // Encryption
  encryptCredentials,
  decryptCredentials,
  encryptCredential,
  decryptCredential,
  isEncrypted,

  // Database operations
  storeCredentials,
  getCredentials,
  getValidCredentials,
  updateAccessToken,

  // Provider-specific storage
  storeSageIntacctCredentials,
  storeWorkdayCredentials,
  storeNetSuiteCredentials,

  // Token management
  needsRefresh,
  getTokenLifetime,
  refreshTokens,

  // Validation
  validateCredentials,

  // Key rotation
  rotateConnectionKey,
  generateEncryptionKey,
  generateKeyId,
}

export default credentialManager
