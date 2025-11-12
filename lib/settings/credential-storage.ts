/**
 * Encrypted Credential Storage
 * Securely store and retrieve user API keys and credentials
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Encrypt sensitive data
 */
export function encryptCredential(plaintext: string, userSecret: string): string {
  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH)
    const iv = randomBytes(IV_LENGTH)

    // Derive key from user secret + salt
    const key = scryptSync(userSecret, salt, KEY_LENGTH)

    // Encrypt
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ])

    // Get auth tag
    const authTag = cipher.getAuthTag()

    // Combine: salt + iv + authTag + encrypted
    const combined = Buffer.concat([salt, iv, authTag, encrypted])

    // Return as base64
    return combined.toString('base64')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt credential')
  }
}

/**
 * Decrypt sensitive data
 */
export function decryptCredential(ciphertext: string, userSecret: string): string {
  try {
    // Decode from base64
    const combined = Buffer.from(ciphertext, 'base64')

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    )
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

    // Derive key
    const key = scryptSync(userSecret, salt, KEY_LENGTH)

    // Decrypt
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])

    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt credential')
  }
}

/**
 * Generate user-specific encryption key from Clerk user ID
 */
export function getUserEncryptionKey(userId: string): string {
  const masterSecret = process.env.ENCRYPTION_MASTER_SECRET
  if (!masterSecret) {
    throw new Error('ENCRYPTION_MASTER_SECRET not configured')
  }

  // Combine master secret with user ID to create user-specific key
  return scryptSync(userId, masterSecret, KEY_LENGTH).toString('hex')
}

/**
 * Store user integration credentials
 */
export interface UserIntegration {
  userId: string
  integration: string
  credentials: {
    apiKey?: string
    accountSid?: string
    authToken?: string
    email?: string
    [key: string]: string | undefined
  }
  encryptedAt: Date
  lastTested?: Date
  testStatus?: 'success' | 'failed'
  testError?: string
}

// In-memory storage (replace with database in production)
const credentialStore = new Map<string, UserIntegration>()

/**
 * Save user integration credentials
 */
export async function saveUserIntegration(
  userId: string,
  integration: string,
  credentials: UserIntegration['credentials']
): Promise<void> {
  try {
    // Get user encryption key
    const userKey = getUserEncryptionKey(userId)

    // Encrypt each credential field
    const encryptedCredentials: Record<string, string> = {}
    for (const [key, value] of Object.entries(credentials)) {
      if (value) {
        encryptedCredentials[key] = encryptCredential(value, userKey)
      }
    }

    // Store
    const storageKey = `${userId}:${integration}`
    credentialStore.set(storageKey, {
      userId,
      integration,
      credentials: encryptedCredentials as any,
      encryptedAt: new Date()
    })

    // TODO: In production, save to database (Postgres + Prisma)
    // await prisma.userIntegration.upsert({
    //   where: { userId_integration: { userId, integration } },
    //   update: { credentials: encryptedCredentials, encryptedAt: new Date() },
    //   create: { userId, integration, credentials: encryptedCredentials }
    // })

    console.log(`✅ Saved encrypted ${integration} credentials for user ${userId}`)
  } catch (error) {
    console.error('Failed to save integration:', error)
    throw error
  }
}

/**
 * Get user integration credentials
 */
export async function getUserIntegration(
  userId: string,
  integration: string
): Promise<UserIntegration['credentials'] | null> {
  try {
    // Get from storage
    const storageKey = `${userId}:${integration}`
    const stored = credentialStore.get(storageKey)

    if (!stored) {
      return null
    }

    // TODO: In production, fetch from database
    // const stored = await prisma.userIntegration.findUnique({
    //   where: { userId_integration: { userId, integration } }
    // })

    // Get user encryption key
    const userKey = getUserEncryptionKey(userId)

    // Decrypt each credential field
    const decryptedCredentials: Record<string, string> = {}
    for (const [key, value] of Object.entries(stored.credentials)) {
      if (value) {
        decryptedCredentials[key] = decryptCredential(value, userKey)
      }
    }

    return decryptedCredentials
  } catch (error) {
    console.error('Failed to get integration:', error)
    return null
  }
}

/**
 * List user integrations (without credentials)
 */
export async function listUserIntegrations(userId: string): Promise<{
  integration: string
  connected: boolean
  lastTested?: Date
  testStatus?: 'success' | 'failed'
}[]> {
  // Get all integrations for user
  const userIntegrations: any[] = []

  for (const [key, value] of credentialStore.entries()) {
    if (key.startsWith(`${userId}:`)) {
      userIntegrations.push({
        integration: value.integration,
        connected: true,
        lastTested: value.lastTested,
        testStatus: value.testStatus
      })
    }
  }

  // TODO: In production, query database
  // const integrations = await prisma.userIntegration.findMany({
  //   where: { userId },
  //   select: { integration: true, lastTested: true, testStatus: true }
  // })

  return userIntegrations
}

/**
 * Delete user integration
 */
export async function deleteUserIntegration(
  userId: string,
  integration: string
): Promise<void> {
  const storageKey = `${userId}:${integration}`
  credentialStore.delete(storageKey)

  // TODO: In production, delete from database
  // await prisma.userIntegration.delete({
  //   where: { userId_integration: { userId, integration } }
  // })

  console.log(`🗑️  Deleted ${integration} integration for user ${userId}`)
}

/**
 * Update test status for integration
 */
export async function updateIntegrationTestStatus(
  userId: string,
  integration: string,
  testStatus: 'success' | 'failed',
  testError?: string
): Promise<void> {
  const storageKey = `${userId}:${integration}`
  const stored = credentialStore.get(storageKey)

  if (stored) {
    stored.lastTested = new Date()
    stored.testStatus = testStatus
    stored.testError = testError
    credentialStore.set(storageKey, stored)
  }

  // TODO: In production, update database
  // await prisma.userIntegration.update({
  //   where: { userId_integration: { userId, integration } },
  //   data: { lastTested: new Date(), testStatus, testError }
  // })
}

/**
 * Security Notes:
 *
 * 1. Encryption:
 *    - Uses AES-256-GCM (authenticated encryption)
 *    - Unique salt and IV per credential
 *    - User-specific encryption keys (derived from Clerk user ID + master secret)
 *
 * 2. Key Management:
 *    - Master secret stored in environment variable (ENCRYPTION_MASTER_SECRET)
 *    - User keys derived using scrypt (slow, memory-hard KDF)
 *    - Each user's credentials can only be decrypted with their specific key
 *
 * 3. Storage:
 *    - Currently in-memory (for development)
 *    - Production: Move to Postgres with Prisma
 *    - Never log decrypted credentials
 *    - Credentials only decrypted when needed for API calls
 *
 * 4. Access Control:
 *    - Only decrypt for authenticated user (via Clerk)
 *    - Never expose credentials to client
 *    - Never return decrypted credentials in API responses
 */
