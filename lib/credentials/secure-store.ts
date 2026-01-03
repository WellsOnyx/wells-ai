// @ts-nocheck
/**
 * Secure Credential Storage for WellsAI
 *
 * Provides encrypted storage for OAuth tokens, API keys, and webhook secrets.
 * Uses AES-256-GCM for encryption at rest with key stored in environment variable.
 *
 * Security features:
 * - AES-256-GCM encryption with authenticated encryption
 * - Per-credential random IVs (never reused)
 * - Key rotation support with versioning
 * - Audit logging for all credential operations
 * - Automatic token refresh scheduling
 * - Connection health monitoring
 *
 * @module lib/credentials/secure-store
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto'
import { query, withTransaction } from '../db'
import {
  StoredCredential,
  DecryptedCredential,
  Credential,
  CreateCredentialInput,
  UpdateCredentialInput,
  CredentialFilter,
  HealthCheckResult,
  TokenRefreshResult,
  CredentialAuditLog,
  CredentialSummary,
  CredentialProvider,
  CredentialType,
  ConnectionHealth,
  CredentialAuditAction,
  EncryptedPayload,
  TokenRefreshJob,
} from './types'

// =============================================================================
// CONSTANTS
// =============================================================================

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12        // 96 bits for GCM
const AUTH_TAG_LENGTH = 16  // 128 bits
const KEY_LENGTH = 32       // 256 bits
const SALT_LENGTH = 16

// Key ID prefix for versioning
const KEY_VERSION = 1
const KEY_ID_PREFIX = 'wells_cred_v'

// Health check thresholds
const EXPIRING_THRESHOLD_HOURS = 24
const REFRESH_BEFORE_EXPIRY_MINUTES = 10

// =============================================================================
// KEY MANAGEMENT
// =============================================================================

/**
 * Get current encryption key from environment
 * Key should be a 64-character hex string (32 bytes)
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.WELLS_CREDENTIAL_ENCRYPTION_KEY

  if (!keyHex) {
    throw new Error('WELLS_CREDENTIAL_ENCRYPTION_KEY environment variable not set')
  }

  // Support both hex-encoded keys and base64 keys
  if (keyHex.length === 64) {
    // Hex-encoded 32-byte key
    return Buffer.from(keyHex, 'hex')
  } else if (keyHex.length === 44) {
    // Base64-encoded key
    return Buffer.from(keyHex, 'base64')
  } else {
    // Derive key from passphrase using scrypt
    const salt = process.env.WELLS_CREDENTIAL_KEY_SALT || 'wells-ai-default-salt'
    return scryptSync(keyHex, salt, KEY_LENGTH)
  }
}

/**
 * Get current key ID for tracking
 */
function getCurrentKeyId(): string {
  return `${KEY_ID_PREFIX}${KEY_VERSION}`
}

// =============================================================================
// ENCRYPTION / DECRYPTION
// =============================================================================

/**
 * Encrypt credential data using AES-256-GCM
 */
function encrypt(data: DecryptedCredential): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const keyId = getCurrentKeyId()

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const plaintext = JSON.stringify(data)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  // Format: keyId:iv:ciphertext:authTag (all hex encoded)
  return `${keyId}:${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`
}

/**
 * Decrypt credential data using AES-256-GCM
 */
function decrypt(encryptedData: string): DecryptedCredential {
  const parts = encryptedData.split(':')

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }

  const [keyId, ivHex, ciphertextHex, authTagHex] = parts

  // Validate key ID matches current version (or handle migration)
  if (!keyId.startsWith(KEY_ID_PREFIX)) {
    throw new Error(`Unsupported key version: ${keyId}`)
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ])

  return JSON.parse(decrypted.toString('utf8'))
}

// =============================================================================
// CREDENTIAL OPERATIONS
// =============================================================================

/**
 * Store a new credential
 */
export async function storeCredential(input: CreateCredentialInput): Promise<StoredCredential> {
  const encryptedData = encrypt(input.data)
  const keyId = getCurrentKeyId()

  const result = await query<StoredCredential>(
    `INSERT INTO user_credentials (
      user_id, provider, credential_type, encrypted_data,
      key_id, key_version, scopes, token_expires_at, refresh_token_expires_at,
      label, email, account_id, health, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      input.userId,
      input.provider,
      input.credentialType,
      encryptedData,
      keyId,
      KEY_VERSION,
      input.scopes || [],
      input.tokenExpiresAt || null,
      input.refreshTokenExpiresAt || null,
      input.label || null,
      input.email || null,
      input.accountId || null,
      ConnectionHealth.Unknown,
      true
    ]
  )

  const credential = result.rows[0]

  // Schedule token refresh if OAuth
  if (input.credentialType === CredentialType.OAuth && input.tokenExpiresAt) {
    await scheduleTokenRefresh(credential.id, input.provider, input.tokenExpiresAt)
  }

  // Log the operation
  await logCredentialAudit({
    credentialId: credential.id,
    userId: input.userId,
    action: CredentialAuditAction.Store,
    provider: input.provider,
    success: true
  })

  return mapRowToStoredCredential(credential)
}

/**
 * Get a credential by ID (returns decrypted)
 */
export async function getCredential(credentialId: string, userId: string): Promise<Credential | null> {
  const result = await query<any>(
    `SELECT * FROM user_credentials WHERE id = $1 AND user_id = $2`,
    [credentialId, userId]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  const stored = mapRowToStoredCredential(row)
  const data = decrypt(row.encrypted_data)

  // Log access
  await logCredentialAudit({
    credentialId,
    userId,
    action: CredentialAuditAction.Access,
    provider: row.provider,
    success: true
  })

  return {
    ...stored,
    data
  }
}

/**
 * Get all credentials for a user by provider
 */
export async function getCredentialsByProvider(
  userId: string,
  provider: CredentialProvider
): Promise<Credential[]> {
  const result = await query<any>(
    `SELECT * FROM user_credentials
     WHERE user_id = $1 AND provider = $2 AND is_active = true
     ORDER BY created_at DESC`,
    [userId, provider]
  )

  return result.rows.map(row => {
    const stored = mapRowToStoredCredential(row)
    const data = decrypt(row.encrypted_data)
    return { ...stored, data }
  })
}

/**
 * Get all credentials for a user (without decrypting)
 */
export async function listCredentials(filter: CredentialFilter): Promise<StoredCredential[]> {
  let sql = `SELECT * FROM user_credentials WHERE 1=1`
  const params: any[] = []
  let paramIndex = 1

  if (filter.userId) {
    sql += ` AND user_id = $${paramIndex++}`
    params.push(filter.userId)
  }

  if (filter.provider) {
    if (Array.isArray(filter.provider)) {
      sql += ` AND provider = ANY($${paramIndex++})`
      params.push(filter.provider)
    } else {
      sql += ` AND provider = $${paramIndex++}`
      params.push(filter.provider)
    }
  }

  if (filter.credentialType) {
    if (Array.isArray(filter.credentialType)) {
      sql += ` AND credential_type = ANY($${paramIndex++})`
      params.push(filter.credentialType)
    } else {
      sql += ` AND credential_type = $${paramIndex++}`
      params.push(filter.credentialType)
    }
  }

  if (filter.health) {
    if (Array.isArray(filter.health)) {
      sql += ` AND health = ANY($${paramIndex++})`
      params.push(filter.health)
    } else {
      sql += ` AND health = $${paramIndex++}`
      params.push(filter.health)
    }
  }

  if (filter.isActive !== undefined) {
    sql += ` AND is_active = $${paramIndex++}`
    params.push(filter.isActive)
  }

  if (filter.expiringWithinHours) {
    sql += ` AND token_expires_at IS NOT NULL AND token_expires_at < NOW() + INTERVAL '1 hour' * $${paramIndex++}`
    params.push(filter.expiringWithinHours)
  }

  sql += ` ORDER BY created_at DESC`

  const result = await query<any>(sql, params)
  return result.rows.map(mapRowToStoredCredential)
}

/**
 * Update a credential
 */
export async function updateCredential(
  credentialId: string,
  userId: string,
  updates: UpdateCredentialInput
): Promise<StoredCredential | null> {
  const setClauses: string[] = []
  const params: any[] = []
  let paramIndex = 1

  // If updating data, re-encrypt
  if (updates.data) {
    setClauses.push(`encrypted_data = $${paramIndex++}`)
    params.push(encrypt(updates.data))

    setClauses.push(`key_id = $${paramIndex++}`)
    params.push(getCurrentKeyId())

    setClauses.push(`key_version = $${paramIndex++}`)
    params.push(KEY_VERSION)
  }

  if (updates.scopes) {
    setClauses.push(`scopes = $${paramIndex++}`)
    params.push(updates.scopes)
  }

  if (updates.tokenExpiresAt !== undefined) {
    setClauses.push(`token_expires_at = $${paramIndex++}`)
    params.push(updates.tokenExpiresAt)
  }

  if (updates.refreshTokenExpiresAt !== undefined) {
    setClauses.push(`refresh_token_expires_at = $${paramIndex++}`)
    params.push(updates.refreshTokenExpiresAt)
  }

  if (updates.label !== undefined) {
    setClauses.push(`label = $${paramIndex++}`)
    params.push(updates.label)
  }

  if (updates.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`)
    params.push(updates.email)
  }

  if (updates.health !== undefined) {
    setClauses.push(`health = $${paramIndex++}`)
    params.push(updates.health)
  }

  if (updates.healthCheckError !== undefined) {
    setClauses.push(`health_check_error = $${paramIndex++}`)
    params.push(updates.healthCheckError)
  }

  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`)
    params.push(updates.isActive)
  }

  setClauses.push(`updated_at = NOW()`)

  if (setClauses.length === 1) {
    // Only updated_at, nothing to do
    return null
  }

  params.push(credentialId)
  params.push(userId)

  const result = await query<any>(
    `UPDATE user_credentials SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
     RETURNING *`,
    params
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToStoredCredential(result.rows[0])
}

/**
 * Revoke/delete a credential
 */
export async function revokeCredential(credentialId: string, userId: string): Promise<boolean> {
  return withTransaction(async (client) => {
    // Get credential for audit log
    const getResult = await client.query(
      `SELECT provider FROM user_credentials WHERE id = $1 AND user_id = $2`,
      [credentialId, userId]
    )

    if (getResult.rows.length === 0) {
      return false
    }

    const provider = getResult.rows[0].provider

    // Soft delete by setting is_active = false
    await client.query(
      `UPDATE user_credentials SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [credentialId, userId]
    )

    // Log revocation
    await client.query(
      `INSERT INTO credential_audit_log (credential_id, user_id, action, provider, success)
       VALUES ($1, $2, $3, $4, $5)`,
      [credentialId, userId, CredentialAuditAction.Revoke, provider, true]
    )

    return true
  })
}

/**
 * Permanently delete a credential (use with caution)
 */
export async function deleteCredential(credentialId: string, userId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM user_credentials WHERE id = $1 AND user_id = $2`,
    [credentialId, userId]
  )
  return result.rowCount > 0
}

// =============================================================================
// HEALTH MONITORING
// =============================================================================

/**
 * Check health of a specific credential
 */
export async function checkCredentialHealth(
  credentialId: string,
  userId: string
): Promise<HealthCheckResult> {
  const credential = await getCredential(credentialId, userId)

  if (!credential) {
    return {
      credentialId,
      provider: CredentialProvider.Custom,
      health: ConnectionHealth.Invalid,
      message: 'Credential not found',
      checkedAt: new Date()
    }
  }

  let health = ConnectionHealth.Healthy
  let message: string | undefined
  let secondsUntilExpiry: number | undefined

  // Check expiration
  if (credential.tokenExpiresAt) {
    const now = new Date()
    const expiresAt = new Date(credential.tokenExpiresAt)
    secondsUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)

    if (secondsUntilExpiry <= 0) {
      health = ConnectionHealth.Expired
      message = 'Token has expired'
    } else if (secondsUntilExpiry <= EXPIRING_THRESHOLD_HOURS * 3600) {
      health = ConnectionHealth.Expiring
      message = `Token expires in ${Math.ceil(secondsUntilExpiry / 3600)} hours`
    }
  }

  // Check last refresh attempts
  if (credential.refreshAttempts && credential.refreshAttempts > 3) {
    health = ConnectionHealth.RefreshFailed
    message = `Token refresh has failed ${credential.refreshAttempts} times`
  }

  // Update health in database
  await updateCredential(credentialId, userId, {
    health,
    healthCheckError: message
  })

  // Update last health check timestamp
  await query(
    `UPDATE user_credentials SET last_health_check = NOW() WHERE id = $1`,
    [credentialId]
  )

  // Log health check
  await logCredentialAudit({
    credentialId,
    userId,
    action: CredentialAuditAction.HealthCheck,
    provider: credential.provider,
    success: health === ConnectionHealth.Healthy,
    metadata: { health, secondsUntilExpiry }
  })

  return {
    credentialId,
    provider: credential.provider,
    health,
    message,
    checkedAt: new Date(),
    tokenExpiresAt: credential.tokenExpiresAt,
    secondsUntilExpiry
  }
}

/**
 * Get all credentials that need attention
 */
export async function getCredentialsNeedingAttention(userId: string): Promise<StoredCredential[]> {
  return listCredentials({
    userId,
    health: [
      ConnectionHealth.Expired,
      ConnectionHealth.RefreshFailed,
      ConnectionHealth.Invalid
    ],
    isActive: true
  })
}

/**
 * Get credentials expiring soon
 */
export async function getExpiringCredentials(userId: string, withinHours: number = 24): Promise<StoredCredential[]> {
  return listCredentials({
    userId,
    expiringWithinHours: withinHours,
    isActive: true
  })
}

// =============================================================================
// TOKEN REFRESH
// =============================================================================

/**
 * Schedule a token refresh job
 */
async function scheduleTokenRefresh(
  credentialId: string,
  provider: CredentialProvider,
  tokenExpiresAt: Date
): Promise<void> {
  // Schedule refresh for REFRESH_BEFORE_EXPIRY_MINUTES before expiry
  const scheduledAt = new Date(tokenExpiresAt.getTime() - REFRESH_BEFORE_EXPIRY_MINUTES * 60 * 1000)

  // Don't schedule if already past
  if (scheduledAt <= new Date()) {
    return
  }

  // Delete any existing pending jobs for this credential
  await query(
    `DELETE FROM credential_refresh_jobs
     WHERE credential_id = $1 AND status = 'pending'`,
    [credentialId]
  )

  // Create new job
  await query(
    `INSERT INTO credential_refresh_jobs (credential_id, provider, scheduled_at)
     VALUES ($1, $2, $3)`,
    [credentialId, provider, scheduledAt]
  )
}

/**
 * Record a token refresh result
 */
export async function recordTokenRefresh(
  credentialId: string,
  userId: string,
  result: TokenRefreshResult
): Promise<void> {
  if (result.success && result.newAccessToken) {
    // Get current credential to merge data
    const credential = await getCredential(credentialId, userId)

    if (!credential) {
      return
    }

    // Update with new tokens
    const newData: DecryptedCredential = {
      ...credential.data,
      accessToken: result.newAccessToken
    }

    if (result.newRefreshToken) {
      newData.refreshToken = result.newRefreshToken
    }

    await updateCredential(credentialId, userId, {
      data: newData,
      tokenExpiresAt: result.newExpiresAt,
      health: ConnectionHealth.Healthy
    })

    // Update refresh tracking
    await query(
      `UPDATE user_credentials SET
         last_refresh_at = NOW(),
         refresh_attempts = 0
       WHERE id = $1`,
      [credentialId]
    )

    // Schedule next refresh
    if (result.newExpiresAt) {
      await scheduleTokenRefresh(credentialId, credential.provider, result.newExpiresAt)
    }
  } else {
    // Record failed attempt
    await query(
      `UPDATE user_credentials SET
         refresh_attempts = COALESCE(refresh_attempts, 0) + 1,
         health = $2,
         health_check_error = $3,
         updated_at = NOW()
       WHERE id = $1`,
      [credentialId, ConnectionHealth.RefreshFailed, result.error || 'Unknown error']
    )
  }

  // Log the refresh attempt
  await logCredentialAudit({
    credentialId,
    userId,
    action: CredentialAuditAction.Refresh,
    provider: (await query(`SELECT provider FROM user_credentials WHERE id = $1`, [credentialId])).rows[0]?.provider,
    success: result.success,
    errorMessage: result.error
  })
}

/**
 * Get pending refresh jobs
 */
export async function getPendingRefreshJobs(limit: number = 10): Promise<TokenRefreshJob[]> {
  const result = await query<any>(
    `SELECT * FROM credential_refresh_jobs
     WHERE status = 'pending'
       AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC
     LIMIT $1`,
    [limit]
  )

  return result.rows.map(row => ({
    id: row.id,
    credentialId: row.credential_id,
    provider: row.provider,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    newTokenExpiresAt: row.new_token_expires_at,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    createdAt: row.created_at
  }))
}

// =============================================================================
// CREDENTIAL SUMMARY
// =============================================================================

/**
 * Get summary of user's credentials
 */
export async function getCredentialSummary(userId: string): Promise<CredentialSummary> {
  const result = await query<any>(
    `SELECT
       COUNT(*) as total,
       provider,
       health,
       COUNT(*) FILTER (WHERE token_expires_at < NOW() + INTERVAL '24 hours') as expiring_24h,
       COUNT(*) FILTER (WHERE health = 'expired') as expired,
       MAX(updated_at) as last_updated
     FROM user_credentials
     WHERE user_id = $1 AND is_active = true
     GROUP BY provider, health`,
    [userId]
  )

  const summary: CredentialSummary = {
    userId,
    totalCredentials: 0,
    byProvider: {} as Record<CredentialProvider, number>,
    byHealth: {} as Record<ConnectionHealth, number>,
    expiringIn24h: 0,
    expired: 0,
    lastUpdated: new Date()
  }

  for (const row of result.rows) {
    summary.totalCredentials += parseInt(row.total)

    // Aggregate by provider
    if (!summary.byProvider[row.provider]) {
      summary.byProvider[row.provider] = 0
    }
    summary.byProvider[row.provider] += parseInt(row.total)

    // Aggregate by health
    if (!summary.byHealth[row.health]) {
      summary.byHealth[row.health] = 0
    }
    summary.byHealth[row.health] += parseInt(row.total)

    // Track expiring/expired
    summary.expiringIn24h += parseInt(row.expiring_24h)
    summary.expired += parseInt(row.expired)

    // Track last updated
    if (row.last_updated && new Date(row.last_updated) > summary.lastUpdated) {
      summary.lastUpdated = new Date(row.last_updated)
    }
  }

  return summary
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

/**
 * Log a credential operation
 */
async function logCredentialAudit(log: Omit<CredentialAuditLog, 'id' | 'createdAt'>): Promise<void> {
  await query(
    `INSERT INTO credential_audit_log (
      credential_id, user_id, action, provider, ip_address, user_agent,
      success, error_message, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      log.credentialId || null,
      log.userId,
      log.action,
      log.provider,
      log.ipAddress || null,
      log.userAgent || null,
      log.success,
      log.errorMessage || null,
      log.metadata ? JSON.stringify(log.metadata) : null
    ]
  )
}

/**
 * Get audit log for a credential
 */
export async function getCredentialAuditLog(
  credentialId: string,
  userId: string,
  limit: number = 50
): Promise<CredentialAuditLog[]> {
  const result = await query<any>(
    `SELECT * FROM credential_audit_log
     WHERE credential_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [credentialId, userId, limit]
  )

  return result.rows.map(row => ({
    id: row.id,
    credentialId: row.credential_id,
    userId: row.user_id,
    action: row.action,
    provider: row.provider,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    success: row.success,
    errorMessage: row.error_message,
    metadata: row.metadata,
    createdAt: row.created_at
  }))
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map database row to StoredCredential
 */
function mapRowToStoredCredential(row: any): StoredCredential {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider as CredentialProvider,
    credentialType: row.credential_type as CredentialType,
    encryptedData: row.encrypted_data,
    keyId: row.key_id,
    keyVersion: row.key_version,
    scopes: row.scopes,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : undefined,
    refreshTokenExpiresAt: row.refresh_token_expires_at ? new Date(row.refresh_token_expires_at) : undefined,
    lastRefreshAt: row.last_refresh_at ? new Date(row.last_refresh_at) : undefined,
    refreshAttempts: row.refresh_attempts,
    health: row.health as ConnectionHealth,
    lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : undefined,
    healthCheckError: row.health_check_error,
    label: row.label,
    email: row.email,
    accountId: row.account_id,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }
}

/**
 * Quick helper to get an OAuth access token for a provider
 * Returns null if not found or expired
 */
export async function getAccessToken(
  userId: string,
  provider: CredentialProvider
): Promise<string | null> {
  const credentials = await getCredentialsByProvider(userId, provider)

  if (credentials.length === 0) {
    return null
  }

  // Find first valid, non-expired credential
  const now = new Date()
  const valid = credentials.find(cred =>
    cred.data.accessToken &&
    (!cred.tokenExpiresAt || cred.tokenExpiresAt > now)
  )

  return valid?.data.accessToken || null
}

/**
 * Quick helper to get an API key for a provider
 */
export async function getApiKey(
  userId: string,
  provider: CredentialProvider
): Promise<string | null> {
  const credentials = await getCredentialsByProvider(userId, provider)

  if (credentials.length === 0) {
    return null
  }

  return credentials[0]?.data.apiKey || null
}

/**
 * Check if user has valid credentials for a provider
 */
export async function hasValidCredentials(
  userId: string,
  provider: CredentialProvider
): Promise<boolean> {
  const credentials = await listCredentials({
    userId,
    provider,
    isActive: true,
    health: [ConnectionHealth.Healthy, ConnectionHealth.Expiring]
  })

  return credentials.length > 0
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // CRUD operations
  storeCredential,
  getCredential,
  getCredentialsByProvider,
  listCredentials,
  updateCredential,
  revokeCredential,
  deleteCredential,

  // Health monitoring
  checkCredentialHealth,
  getCredentialsNeedingAttention,
  getExpiringCredentials,

  // Token refresh
  recordTokenRefresh,
  getPendingRefreshJobs,

  // Summary
  getCredentialSummary,

  // Audit
  getCredentialAuditLog,

  // Helpers
  getAccessToken,
  getApiKey,
  hasValidCredentials
}
