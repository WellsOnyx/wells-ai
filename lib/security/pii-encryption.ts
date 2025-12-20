/**
 * PII Encryption Service for Grain & Vault
 *
 * Provides AES-256-GCM encryption for sensitive personal information
 * with key versioning, integrity verification, and searchable hashing.
 */

import crypto from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type PIIFieldType =
  | 'ssn'
  | 'tax_id'
  | 'bank_account'
  | 'date_of_birth'
  | 'address'
  | 'phone'
  | 'id_document';

export interface EncryptedValue {
  keyId: string;
  iv: string;
  ciphertext: string;
  authTag: string;
}

export interface UserProfile {
  id?: string;
  email?: string;
  name?: string;
  ssn?: string;
  taxId?: string;
  bankAccountNumber?: string;
  dateOfBirth?: string;
  address?: string;
  phone?: string;
  idDocumentNumber?: string;
  [key: string]: unknown;
}

export interface EncryptedUserProfile {
  id?: string;
  email?: string;
  name?: string;
  ssn?: string;
  taxId?: string;
  bankAccountNumber?: string;
  dateOfBirth?: string;
  address?: string;
  phone?: string;
  idDocumentNumber?: string;
  _piiEncrypted?: boolean;
  _encryptedFields?: string[];
  [key: string]: unknown;
}

export class PIIEncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly fieldType?: PIIFieldType
  ) {
    super(message);
    this.name = 'PIIEncryptionError';
  }
}

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16;
const HASH_ITERATIONS = 100000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = 'sha256';

// Field mapping for profile encryption
const PII_FIELD_MAPPING: Record<string, PIIFieldType> = {
  ssn: 'ssn',
  taxId: 'tax_id',
  bankAccountNumber: 'bank_account',
  dateOfBirth: 'date_of_birth',
  address: 'address',
  phone: 'phone',
  idDocumentNumber: 'id_document',
};

// ============================================================================
// Key Management
// ============================================================================

/**
 * Get the current encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.PII_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new PIIEncryptionError(
      'PII_ENCRYPTION_KEY environment variable is not set',
      'KEY_NOT_CONFIGURED'
    );
  }

  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new PIIEncryptionError(
      'PII_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
      'INVALID_KEY_FORMAT'
    );
  }

  return Buffer.from(keyHex, 'hex');
}

/**
 * Get the current key ID for versioning
 */
function getKeyId(): string {
  const keyId = process.env.PII_ENCRYPTION_KEY_ID;

  if (!keyId) {
    throw new PIIEncryptionError(
      'PII_ENCRYPTION_KEY_ID environment variable is not set',
      'KEY_ID_NOT_CONFIGURED'
    );
  }

  return keyId;
}

/**
 * Derive a field-specific key from the master key
 * This provides additional isolation between different field types
 */
function deriveFieldKey(masterKey: Buffer, fieldType: PIIFieldType): Buffer {
  const salt = Buffer.from(`grain-vault:pii:${fieldType}`, 'utf8');
  return crypto.pbkdf2Sync(masterKey, salt, 10000, KEY_LENGTH, 'sha256');
}

// ============================================================================
// Core Encryption Functions
// ============================================================================

/**
 * Encrypt a PII value
 *
 * @param plaintext - The sensitive value to encrypt
 * @param fieldType - The type of PII field (for key derivation)
 * @returns Formatted encrypted string: {keyId}:{iv}:{ciphertext}:{authTag}
 */
export function encryptPII(plaintext: string, fieldType: PIIFieldType): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new PIIEncryptionError(
      'Plaintext must be a non-empty string',
      'INVALID_INPUT',
      fieldType
    );
  }

  try {
    const masterKey = getEncryptionKey();
    const keyId = getKeyId();
    const fieldKey = deriveFieldKey(masterKey, fieldType);

    // Generate unique IV for each encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, fieldKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Format: keyId:iv:ciphertext:authTag (all hex encoded)
    return [
      keyId,
      iv.toString('hex'),
      encrypted.toString('hex'),
      authTag.toString('hex'),
    ].join(':');
  } catch (error) {
    if (error instanceof PIIEncryptionError) {
      throw error;
    }
    throw new PIIEncryptionError(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ENCRYPTION_FAILED',
      fieldType
    );
  }
}

/**
 * Decrypt a PII value
 *
 * @param encryptedValue - The encrypted string in format {keyId}:{iv}:{ciphertext}:{authTag}
 * @param fieldType - The type of PII field (for key derivation)
 * @param customKey - Optional custom key for key rotation scenarios
 * @returns The decrypted plaintext value
 */
export function decryptPII(
  encryptedValue: string,
  fieldType: PIIFieldType,
  customKey?: Buffer
): string {
  if (!encryptedValue || typeof encryptedValue !== 'string') {
    throw new PIIEncryptionError(
      'Encrypted value must be a non-empty string',
      'INVALID_INPUT',
      fieldType
    );
  }

  const parts = encryptedValue.split(':');

  if (parts.length !== 4) {
    throw new PIIEncryptionError(
      'Invalid encrypted value format. Expected {keyId}:{iv}:{ciphertext}:{authTag}',
      'INVALID_FORMAT',
      fieldType
    );
  }

  const [storedKeyId, ivHex, ciphertextHex, authTagHex] = parts;

  try {
    // Validate hex strings
    if (!/^[a-fA-F0-9]+$/.test(ivHex) ||
        !/^[a-fA-F0-9]+$/.test(ciphertextHex) ||
        !/^[a-fA-F0-9]+$/.test(authTagHex)) {
      throw new PIIEncryptionError(
        'Invalid hex encoding in encrypted value',
        'INVALID_FORMAT',
        fieldType
      );
    }

    const masterKey = customKey || getEncryptionKey();
    const currentKeyId = customKey ? storedKeyId : getKeyId();

    // Warn if key ID doesn't match (might need rotation)
    if (!customKey && storedKeyId !== currentKeyId) {
      console.warn(
        `PII encrypted with key ${storedKeyId} but current key is ${currentKeyId}. Consider key rotation.`
      );
    }

    const fieldKey = deriveFieldKey(masterKey, fieldType);
    const iv = Buffer.from(ivHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Validate IV length
    if (iv.length !== IV_LENGTH) {
      throw new PIIEncryptionError(
        `Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`,
        'INVALID_FORMAT',
        fieldType
      );
    }

    // Validate auth tag length
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new PIIEncryptionError(
        `Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`,
        'INVALID_FORMAT',
        fieldType
      );
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, fieldKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    if (error instanceof PIIEncryptionError) {
      throw error;
    }

    // Check for authentication failure
    if (error instanceof Error && error.message.includes('Unsupported state')) {
      throw new PIIEncryptionError(
        'Authentication failed: data may have been tampered with',
        'AUTH_FAILED',
        fieldType
      );
    }

    throw new PIIEncryptionError(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'DECRYPTION_FAILED',
      fieldType
    );
  }
}

// ============================================================================
// Profile Encryption Functions
// ============================================================================

/**
 * Encrypt all PII fields in a user profile object
 *
 * @param profile - The user profile with plaintext PII
 * @returns Profile with encrypted PII fields
 */
export function encryptUserProfile(profile: UserProfile): EncryptedUserProfile {
  if (!profile || typeof profile !== 'object') {
    throw new PIIEncryptionError(
      'Profile must be a valid object',
      'INVALID_INPUT'
    );
  }

  const encryptedProfile: EncryptedUserProfile = { ...profile };
  const encryptedFields: string[] = [];

  for (const [fieldName, fieldType] of Object.entries(PII_FIELD_MAPPING)) {
    const value = profile[fieldName];

    if (value !== undefined && value !== null && typeof value === 'string' && value.length > 0) {
      // Skip if already encrypted (contains our format pattern)
      if (value.includes(':') && value.split(':').length === 4) {
        continue;
      }

      encryptedProfile[fieldName] = encryptPII(value, fieldType);
      encryptedFields.push(fieldName);
    }
  }

  // Mark profile as encrypted with metadata
  encryptedProfile._piiEncrypted = true;
  encryptedProfile._encryptedFields = encryptedFields;

  return encryptedProfile;
}

/**
 * Decrypt all PII fields in an encrypted user profile
 *
 * @param encryptedProfile - The profile with encrypted PII fields
 * @returns Profile with decrypted PII fields
 */
export function decryptUserProfile(encryptedProfile: EncryptedUserProfile): UserProfile {
  if (!encryptedProfile || typeof encryptedProfile !== 'object') {
    throw new PIIEncryptionError(
      'Encrypted profile must be a valid object',
      'INVALID_INPUT'
    );
  }

  const profile: UserProfile = { ...encryptedProfile };

  // Remove encryption metadata from result
  delete profile._piiEncrypted;
  delete profile._encryptedFields;

  // Determine which fields to decrypt
  const fieldsToDecrypt = encryptedProfile._encryptedFields || Object.keys(PII_FIELD_MAPPING);

  for (const fieldName of fieldsToDecrypt) {
    const fieldType = PII_FIELD_MAPPING[fieldName];
    const value = encryptedProfile[fieldName];

    if (fieldType && value !== undefined && value !== null && typeof value === 'string') {
      // Only decrypt if it matches our format
      const parts = value.split(':');
      if (parts.length === 4) {
        try {
          profile[fieldName] = decryptPII(value, fieldType);
        } catch (error) {
          // Log but don't fail the entire profile decryption
          console.error(`Failed to decrypt field ${fieldName}:`, error);
          // Keep the encrypted value
          profile[fieldName] = value;
        }
      }
    }
  }

  return profile;
}

// ============================================================================
// Searchable Hash Functions
// ============================================================================

/**
 * Create a searchable hash for a PII value
 *
 * This allows lookups without decrypting all values, while maintaining
 * security through a keyed hash (HMAC with derived key).
 *
 * @param value - The plaintext value to hash
 * @param fieldType - The type of PII field (optional, for additional isolation)
 * @returns A hex-encoded searchable hash
 */
export function hashForSearch(value: string, fieldType?: PIIFieldType): string {
  if (!value || typeof value !== 'string') {
    throw new PIIEncryptionError(
      'Value must be a non-empty string',
      'INVALID_INPUT',
      fieldType
    );
  }

  try {
    const masterKey = getEncryptionKey();

    // Create a consistent salt for searchable hashing
    const hashSalt = Buffer.from(
      `grain-vault:search:${fieldType || 'general'}`,
      'utf8'
    );

    // Derive a key specifically for hashing
    const hashKey = crypto.pbkdf2Sync(
      masterKey,
      hashSalt,
      HASH_ITERATIONS,
      HASH_KEY_LENGTH,
      HASH_DIGEST
    );

    // Normalize the value (lowercase, trim whitespace)
    const normalizedValue = value.toLowerCase().trim();

    // Create HMAC
    const hmac = crypto.createHmac('sha256', hashKey);
    hmac.update(normalizedValue);

    return hmac.digest('hex');
  } catch (error) {
    if (error instanceof PIIEncryptionError) {
      throw error;
    }
    throw new PIIEncryptionError(
      `Hash creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'HASH_FAILED',
      fieldType
    );
  }
}

// ============================================================================
// Key Rotation Functions
// ============================================================================

/**
 * Re-encrypt a value with a new key
 *
 * @param encryptedValue - The value encrypted with the old key
 * @param fieldType - The type of PII field
 * @param oldKey - The old encryption key (hex string)
 * @param newKey - The new encryption key (hex string)
 * @param newKeyId - The new key ID
 * @returns The value re-encrypted with the new key
 */
export function rotateEncryptionKey(
  encryptedValue: string,
  fieldType: PIIFieldType,
  oldKey: string,
  newKey: string,
  newKeyId: string
): string {
  // Validate old key
  if (!/^[a-fA-F0-9]{64}$/.test(oldKey)) {
    throw new PIIEncryptionError(
      'Old key must be a 64-character hex string',
      'INVALID_KEY_FORMAT',
      fieldType
    );
  }

  // Validate new key
  if (!/^[a-fA-F0-9]{64}$/.test(newKey)) {
    throw new PIIEncryptionError(
      'New key must be a 64-character hex string',
      'INVALID_KEY_FORMAT',
      fieldType
    );
  }

  if (!newKeyId || typeof newKeyId !== 'string') {
    throw new PIIEncryptionError(
      'New key ID must be provided',
      'INVALID_KEY_ID',
      fieldType
    );
  }

  try {
    const oldKeyBuffer = Buffer.from(oldKey, 'hex');

    // Decrypt with old key
    const plaintext = decryptPII(encryptedValue, fieldType, oldKeyBuffer);

    // Temporarily set the new key in process.env for encryption
    const originalKey = process.env.PII_ENCRYPTION_KEY;
    const originalKeyId = process.env.PII_ENCRYPTION_KEY_ID;

    try {
      process.env.PII_ENCRYPTION_KEY = newKey;
      process.env.PII_ENCRYPTION_KEY_ID = newKeyId;

      // Re-encrypt with new key
      return encryptPII(plaintext, fieldType);
    } finally {
      // Restore original environment
      if (originalKey !== undefined) {
        process.env.PII_ENCRYPTION_KEY = originalKey;
      } else {
        delete process.env.PII_ENCRYPTION_KEY;
      }
      if (originalKeyId !== undefined) {
        process.env.PII_ENCRYPTION_KEY_ID = originalKeyId;
      } else {
        delete process.env.PII_ENCRYPTION_KEY_ID;
      }
    }
  } catch (error) {
    if (error instanceof PIIEncryptionError) {
      throw error;
    }
    throw new PIIEncryptionError(
      `Key rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ROTATION_FAILED',
      fieldType
    );
  }
}

/**
 * Rotate encryption keys for an entire user profile
 *
 * @param encryptedProfile - The profile with values encrypted using the old key
 * @param oldKey - The old encryption key (hex string)
 * @param newKey - The new encryption key (hex string)
 * @param newKeyId - The new key ID
 * @returns The profile with all PII re-encrypted using the new key
 */
export function rotateProfileEncryptionKey(
  encryptedProfile: EncryptedUserProfile,
  oldKey: string,
  newKey: string,
  newKeyId: string
): EncryptedUserProfile {
  if (!encryptedProfile || typeof encryptedProfile !== 'object') {
    throw new PIIEncryptionError(
      'Encrypted profile must be a valid object',
      'INVALID_INPUT'
    );
  }

  const rotatedProfile: EncryptedUserProfile = { ...encryptedProfile };
  const fieldsToRotate = encryptedProfile._encryptedFields || Object.keys(PII_FIELD_MAPPING);

  for (const fieldName of fieldsToRotate) {
    const fieldType = PII_FIELD_MAPPING[fieldName];
    const value = encryptedProfile[fieldName];

    if (fieldType && value !== undefined && value !== null && typeof value === 'string') {
      const parts = value.split(':');
      if (parts.length === 4) {
        rotatedProfile[fieldName] = rotateEncryptionKey(
          value,
          fieldType,
          oldKey,
          newKey,
          newKeyId
        );
      }
    }
  }

  return rotatedProfile;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a new encryption key
 *
 * @returns A 64-character hex string suitable for PII_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Generate a new key ID
 *
 * @returns A unique key ID with timestamp
 */
export function generateKeyId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `k_${timestamp}_${random}`;
}

/**
 * Check if a value appears to be encrypted
 *
 * @param value - The value to check
 * @returns true if the value matches the encrypted format
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const parts = value.split(':');
  if (parts.length !== 4) {
    return false;
  }

  const [keyId, iv, ciphertext, authTag] = parts;

  return (
    keyId.length > 0 &&
    /^[a-fA-F0-9]+$/.test(iv) &&
    /^[a-fA-F0-9]+$/.test(ciphertext) &&
    /^[a-fA-F0-9]+$/.test(authTag) &&
    Buffer.from(iv, 'hex').length === IV_LENGTH &&
    Buffer.from(authTag, 'hex').length === AUTH_TAG_LENGTH
  );
}

/**
 * Mask a PII value for display (shows only last 4 characters)
 *
 * @param value - The plaintext value to mask
 * @param visibleChars - Number of characters to show at the end (default: 4)
 * @returns Masked value (e.g., "***1234")
 */
export function maskPII(value: string, visibleChars: number = 4): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  if (value.length <= visibleChars) {
    return '*'.repeat(value.length);
  }

  const masked = '*'.repeat(value.length - visibleChars);
  const visible = value.slice(-visibleChars);

  return masked + visible;
}

// ============================================================================
// Exports for testing
// ============================================================================

export const __testing__ = {
  deriveFieldKey,
  getEncryptionKey,
  getKeyId,
  PII_FIELD_MAPPING,
  ALGORITHM,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  KEY_LENGTH,
};
