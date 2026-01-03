/**
 * WellsAI Credential Management Module
 *
 * Secure storage and management for OAuth tokens, API keys, and webhook secrets.
 *
 * @example
 * ```typescript
 * import { credentialStore, CredentialProvider, CredentialType } from '@/lib/credentials'
 *
 * // Store OAuth credentials
 * await credentialStore.storeCredential({
 *   userId: 'user_123',
 *   provider: CredentialProvider.Gmail,
 *   credentialType: CredentialType.OAuth,
 *   data: {
 *     accessToken: 'ya29...',
 *     refreshToken: '1//...',
 *   },
 *   scopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/gmail.send'],
 *   tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
 *   email: 'user@gmail.com',
 *   label: 'Personal Gmail'
 * })
 *
 * // Get access token for a provider
 * const token = await credentialStore.getAccessToken('user_123', CredentialProvider.Gmail)
 *
 * // Check connection health
 * const health = await credentialStore.checkCredentialHealth(credentialId, userId)
 *
 * // List all user credentials (encrypted)
 * const creds = await credentialStore.listCredentials({ userId: 'user_123' })
 * ```
 *
 * @module lib/credentials
 */

// Re-export types
export * from './types'

// Re-export store functions
export {
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
  hasValidCredentials,

  // Default export as credentialStore
  default as credentialStore
} from './secure-store'
