// @ts-nocheck
/**
 * Identity Verification Service for Grain & Vault KYC Compliance
 *
 * Multi-provider identity verification with support for:
 * - Veriff (default, recommended for fintech)
 * - Jumio
 * - Persona
 *
 * Verification Levels:
 * - Level 1: Email verified only ($1K limit)
 * - Level 2: Phone + basic info ($10K limit)
 * - Level 3: Full ID verification + selfie ($100K limit)
 * - Level 4: Enhanced due diligence (unlimited)
 *
 * Environment Variables Required:
 * - VERIFF_API_KEY
 * - VERIFF_API_SECRET
 * - VERIFF_WEBHOOK_SECRET
 */

import { sql } from '@vercel/postgres'
import crypto from 'crypto'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum VerificationLevel {
  EMAIL_ONLY = 1,       // $1K limit
  PHONE_BASIC = 2,      // $10K limit
  FULL_KYC = 3,         // $100K limit
  ENHANCED_DD = 4,      // Unlimited
}

export enum VerificationStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  RESUBMISSION_REQUIRED = 'resubmission_required',
}

export enum VerificationProvider {
  VERIFF = 'veriff',
  JUMIO = 'jumio',
  PERSONA = 'persona',
}

export interface UserData {
  firstName: string
  lastName: string
  email: string
  dateOfBirth?: string // YYYY-MM-DD
  phone?: string
  address?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  idNumber?: string // SSN last 4 or other ID
}

export interface VerificationSession {
  sessionId: string
  provider: VerificationProvider
  userId: string
  status: VerificationStatus
  verificationUrl: string
  expiresAt: Date
  createdAt: Date
  metadata?: Record<string, any>
}

export interface VerificationResult {
  sessionId: string
  userId: string
  status: VerificationStatus
  level: VerificationLevel
  provider: VerificationProvider
  decision?: 'approved' | 'declined' | 'review'
  riskScore?: number
  checks?: {
    documentValidity: boolean
    faceMatch: boolean
    livenessCheck: boolean
    addressVerified: boolean
    amlScreening: 'clear' | 'match' | 'review'
    pepScreening: 'clear' | 'match' | 'review'
  }
  extractedData?: {
    documentType: string
    documentNumber: string
    expiryDate: string
    issuingCountry: string
    firstName: string
    lastName: string
    dateOfBirth: string
    address?: string
  }
  rejectionReasons?: string[]
  reviewRequired?: boolean
  completedAt?: Date
  metadata?: Record<string, any>
}

export interface VerificationLevelInfo {
  level: VerificationLevel
  name: string
  description: string
  dailyLimit: number
  monthlyLimit: number
  requirements: string[]
}

export interface WebhookPayload {
  id: string
  status: string
  verification?: {
    id: string
    status: string
    code?: number
    person?: {
      firstName?: string
      lastName?: string
      dateOfBirth?: string
      idNumber?: string
    }
    document?: {
      type: string
      number: string
      country: string
      validUntil: string
    }
    reason?: string
    reasonCode?: number
    decisionTime?: string
    acceptanceTime?: string
    riskLabels?: string[]
    vendorData?: string
  }
  technicalData?: {
    ip?: string
    userAgent?: string
  }
}

// ============================================================================
// ABSTRACT PROVIDER INTERFACE
// ============================================================================

export interface IIdentityVerificationProvider {
  readonly providerName: VerificationProvider

  /**
   * Create a new verification session
   */
  createSession(
    userId: string,
    userData: UserData,
    options?: {
      callbackUrl?: string
      level?: VerificationLevel
    }
  ): Promise<VerificationSession>

  /**
   * Get the status of a verification session
   */
  getSessionStatus(sessionId: string): Promise<VerificationResult>

  /**
   * Process webhook payload from provider
   */
  processWebhook(
    payload: WebhookPayload,
    signature?: string
  ): Promise<VerificationResult>

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): boolean
}

// ============================================================================
// VERIFF PROVIDER IMPLEMENTATION
// ============================================================================

export class VeriffProvider implements IIdentityVerificationProvider {
  readonly providerName = VerificationProvider.VERIFF
  private readonly apiKey: string
  private readonly apiSecret: string
  private readonly webhookSecret: string
  private readonly baseUrl = 'https://stationapi.veriff.com/v1'

  constructor() {
    this.apiKey = process.env.VERIFF_API_KEY || ''
    this.apiSecret = process.env.VERIFF_API_SECRET || ''
    this.webhookSecret = process.env.VERIFF_WEBHOOK_SECRET || ''

    if (!this.apiKey || !this.apiSecret) {
      console.warn('[IdentityVerification] Veriff credentials not configured')
    }
  }

  /**
   * Create a Veriff verification session
   */
  async createSession(
    userId: string,
    userData: UserData,
    options?: {
      callbackUrl?: string
      level?: VerificationLevel
    }
  ): Promise<VerificationSession> {
    const timestamp = new Date().toISOString()

    const payload = {
      verification: {
        callback: options?.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/veriff`,
        person: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          dateOfBirth: userData.dateOfBirth,
          idNumber: userData.idNumber,
        },
        vendorData: userId,
        timestamp,
      },
    }

    try {
      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-CLIENT': this.apiKey,
          'X-HMAC-SIGNATURE': this.generateSignature(JSON.stringify(payload)),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('[Veriff] Session creation failed:', errorData)
        throw new Error(`Veriff API error: ${response.status}`)
      }

      const data = await response.json()

      const session: VerificationSession = {
        sessionId: data.verification.id,
        provider: VerificationProvider.VERIFF,
        userId,
        status: VerificationStatus.PENDING,
        verificationUrl: data.verification.url,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date(),
        metadata: {
          vendorData: userId,
          host: data.verification.host,
        },
      }

      // Store session in database
      await this.storeSession(session)

      console.log(`[Veriff] Created session ${session.sessionId} for user ${userId}`)
      return session
    } catch (error: any) {
      console.error('[Veriff] Create session error:', error)
      throw new Error(`Failed to create verification session: ${error.message}`)
    }
  }

  /**
   * Get verification session status from Veriff
   */
  async getSessionStatus(sessionId: string): Promise<VerificationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/decision`, {
        method: 'GET',
        headers: {
          'X-AUTH-CLIENT': this.apiKey,
          'X-HMAC-SIGNATURE': this.generateSignature(sessionId),
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Session not found or not yet completed
          return {
            sessionId,
            userId: '',
            status: VerificationStatus.PENDING,
            level: VerificationLevel.EMAIL_ONLY,
            provider: VerificationProvider.VERIFF,
          }
        }
        throw new Error(`Veriff API error: ${response.status}`)
      }

      const data = await response.json()
      return this.mapVeriffDecisionToResult(data, sessionId)
    } catch (error: any) {
      console.error('[Veriff] Get session status error:', error)
      throw new Error(`Failed to get verification status: ${error.message}`)
    }
  }

  /**
   * Process incoming webhook from Veriff
   */
  async processWebhook(
    payload: WebhookPayload,
    signature?: string
  ): Promise<VerificationResult> {
    const sessionId = payload.verification?.id || payload.id
    const status = payload.verification?.status || payload.status

    console.log(`[Veriff Webhook] Processing session ${sessionId}, status: ${status}`)

    // Map Veriff status to our status
    let verificationStatus: VerificationStatus
    let decision: 'approved' | 'declined' | 'review' | undefined
    let level = VerificationLevel.EMAIL_ONLY

    switch (status.toLowerCase()) {
      case 'approved':
        verificationStatus = VerificationStatus.APPROVED
        decision = 'approved'
        level = VerificationLevel.FULL_KYC
        break
      case 'declined':
      case 'negative':
        verificationStatus = VerificationStatus.REJECTED
        decision = 'declined'
        break
      case 'resubmission_requested':
        verificationStatus = VerificationStatus.RESUBMISSION_REQUIRED
        break
      case 'review':
        verificationStatus = VerificationStatus.IN_REVIEW
        decision = 'review'
        break
      case 'expired':
        verificationStatus = VerificationStatus.EXPIRED
        break
      default:
        verificationStatus = VerificationStatus.PENDING
    }

    // Extract data from verification
    const extractedData = payload.verification?.person || payload.verification?.document
      ? {
          documentType: payload.verification?.document?.type || '',
          documentNumber: payload.verification?.document?.number || '',
          expiryDate: payload.verification?.document?.validUntil || '',
          issuingCountry: payload.verification?.document?.country || '',
          firstName: payload.verification?.person?.firstName || '',
          lastName: payload.verification?.person?.lastName || '',
          dateOfBirth: payload.verification?.person?.dateOfBirth || '',
        }
      : undefined

    // Get user ID from stored session
    const storedSession = await this.getStoredSession(sessionId)
    const userId = storedSession?.userId || payload.verification?.vendorData || ''

    const result: VerificationResult = {
      sessionId,
      userId,
      status: verificationStatus,
      level,
      provider: VerificationProvider.VERIFF,
      decision,
      riskScore: payload.verification?.reasonCode,
      checks: {
        documentValidity: status.toLowerCase() === 'approved',
        faceMatch: status.toLowerCase() === 'approved',
        livenessCheck: status.toLowerCase() === 'approved',
        addressVerified: false, // Veriff doesn't verify address by default
        amlScreening: 'clear',
        pepScreening: 'clear',
      },
      extractedData,
      rejectionReasons: payload.verification?.reason
        ? [payload.verification.reason]
        : undefined,
      reviewRequired: status.toLowerCase() === 'review',
      completedAt: payload.verification?.decisionTime
        ? new Date(payload.verification.decisionTime)
        : new Date(),
      metadata: {
        reasonCode: payload.verification?.reasonCode,
        riskLabels: payload.verification?.riskLabels,
        technicalData: payload.technicalData,
      },
    }

    // Update database with result
    await this.updateVerificationResult(result)

    return result
  }

  /**
   * Verify Veriff webhook signature using HMAC
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('[Veriff] Webhook secret not configured')
      return false
    }

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret)
      hmac.update(payload)
      const expectedSignature = hmac.digest('hex')

      return crypto.timingSafeEqual(
        Buffer.from(signature.toLowerCase()),
        Buffer.from(expectedSignature.toLowerCase())
      )
    } catch (error) {
      console.error('[Veriff] Signature verification error:', error)
      return false
    }
  }

  /**
   * Generate HMAC signature for Veriff API requests
   */
  private generateSignature(payload: string): string {
    const hmac = crypto.createHmac('sha256', this.apiSecret)
    hmac.update(payload)
    return hmac.digest('hex')
  }

  /**
   * Map Veriff decision response to our result format
   */
  private mapVeriffDecisionToResult(
    data: any,
    sessionId: string
  ): VerificationResult {
    const verification = data.verification || {}
    const status = verification.status?.toLowerCase()

    let verificationStatus: VerificationStatus
    let level = VerificationLevel.EMAIL_ONLY

    switch (status) {
      case 'approved':
        verificationStatus = VerificationStatus.APPROVED
        level = VerificationLevel.FULL_KYC
        break
      case 'declined':
        verificationStatus = VerificationStatus.REJECTED
        break
      case 'resubmission_requested':
        verificationStatus = VerificationStatus.RESUBMISSION_REQUIRED
        break
      case 'expired':
        verificationStatus = VerificationStatus.EXPIRED
        break
      default:
        verificationStatus = VerificationStatus.PENDING
    }

    return {
      sessionId,
      userId: verification.vendorData || '',
      status: verificationStatus,
      level,
      provider: VerificationProvider.VERIFF,
      decision: status === 'approved' ? 'approved' : status === 'declined' ? 'declined' : undefined,
      extractedData: verification.person
        ? {
            documentType: verification.document?.type || '',
            documentNumber: verification.document?.number || '',
            expiryDate: verification.document?.validUntil || '',
            issuingCountry: verification.document?.country || '',
            firstName: verification.person?.firstName || '',
            lastName: verification.person?.lastName || '',
            dateOfBirth: verification.person?.dateOfBirth || '',
          }
        : undefined,
      completedAt: verification.decisionTime
        ? new Date(verification.decisionTime)
        : undefined,
    }
  }

  /**
   * Store verification session in database
   */
  private async storeSession(session: VerificationSession): Promise<void> {
    try {
      await sql`
        INSERT INTO grain_verification_sessions (
          session_id,
          provider,
          user_id,
          status,
          verification_url,
          expires_at,
          created_at,
          metadata
        ) VALUES (
          ${session.sessionId},
          ${session.provider},
          ${session.userId},
          ${session.status},
          ${session.verificationUrl},
          ${session.expiresAt.toISOString()},
          ${session.createdAt.toISOString()},
          ${JSON.stringify(session.metadata || {})}
        )
        ON CONFLICT (session_id) DO UPDATE SET
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata
      `
    } catch (error) {
      console.error('[Veriff] Store session error:', error)
      // Don't throw - session storage is not critical for flow
    }
  }

  /**
   * Get stored session from database
   */
  private async getStoredSession(sessionId: string): Promise<VerificationSession | null> {
    try {
      const result = await sql`
        SELECT * FROM grain_verification_sessions
        WHERE session_id = ${sessionId}
      `

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]
      return {
        sessionId: row.session_id,
        provider: row.provider,
        userId: row.user_id,
        status: row.status,
        verificationUrl: row.verification_url,
        expiresAt: new Date(row.expires_at),
        createdAt: new Date(row.created_at),
        metadata: row.metadata,
      }
    } catch (error) {
      console.error('[Veriff] Get session error:', error)
      return null
    }
  }

  /**
   * Update verification result in database
   */
  private async updateVerificationResult(result: VerificationResult): Promise<void> {
    try {
      // Update session status
      await sql`
        UPDATE grain_verification_sessions
        SET
          status = ${result.status},
          completed_at = ${result.completedAt?.toISOString() || null},
          result_data = ${JSON.stringify(result)}
        WHERE session_id = ${result.sessionId}
      `

      // Update user profile if approved
      if (result.status === VerificationStatus.APPROVED && result.userId) {
        await sql`
          UPDATE grain_user_profiles
          SET
            verification_level = ${result.level},
            verification_status = 'approved',
            government_id_verified = TRUE,
            updated_at = NOW()
          WHERE user_id = ${result.userId}
        `

        // Record verification request
        await sql`
          INSERT INTO grain_verification_requests (
            user_id,
            verification_type,
            status,
            documents,
            reviewed_at
          ) VALUES (
            ${result.userId},
            'identity',
            'approved',
            ${JSON.stringify({ provider: result.provider, sessionId: result.sessionId })},
            NOW()
          )
        `

        console.log(`[Veriff] Updated user ${result.userId} to verification level ${result.level}`)
      } else if (result.status === VerificationStatus.REJECTED && result.userId) {
        await sql`
          UPDATE grain_user_profiles
          SET
            verification_status = 'rejected',
            verification_notes = ${result.rejectionReasons?.join(', ') || 'Verification failed'},
            updated_at = NOW()
          WHERE user_id = ${result.userId}
        `
      }
    } catch (error) {
      console.error('[Veriff] Update result error:', error)
      throw error
    }
  }
}

// ============================================================================
// IDENTITY VERIFICATION SERVICE (Main Entry Point)
// ============================================================================

export class IdentityVerificationService {
  private provider: IIdentityVerificationProvider

  constructor(providerType: VerificationProvider = VerificationProvider.VERIFF) {
    switch (providerType) {
      case VerificationProvider.VERIFF:
        this.provider = new VeriffProvider()
        break
      case VerificationProvider.JUMIO:
        // TODO: Implement JumioProvider
        throw new Error('Jumio provider not yet implemented')
      case VerificationProvider.PERSONA:
        // TODO: Implement PersonaProvider
        throw new Error('Persona provider not yet implemented')
      default:
        this.provider = new VeriffProvider()
    }
  }

  /**
   * Create a new verification session for a user
   */
  async createVerificationSession(
    userId: string,
    userData: UserData,
    options?: {
      callbackUrl?: string
      level?: VerificationLevel
    }
  ): Promise<VerificationSession> {
    console.log(`[IdentityVerification] Creating session for user ${userId}`)

    // Validate required user data
    if (!userData.firstName || !userData.lastName || !userData.email) {
      throw new Error('First name, last name, and email are required')
    }

    // Check if user already has pending verification
    const existingSession = await this.getActiveSession(userId)
    if (existingSession && existingSession.status === VerificationStatus.PENDING) {
      console.log(`[IdentityVerification] Returning existing session for user ${userId}`)
      return existingSession
    }

    return this.provider.createSession(userId, userData, options)
  }

  /**
   * Get the current verification status for a session
   */
  async getVerificationStatus(sessionId: string): Promise<VerificationResult> {
    console.log(`[IdentityVerification] Getting status for session ${sessionId}`)
    return this.provider.getSessionStatus(sessionId)
  }

  /**
   * Process a webhook callback from the verification provider
   */
  async handleVerificationWebhook(
    payload: WebhookPayload,
    signature?: string
  ): Promise<VerificationResult> {
    console.log(`[IdentityVerification] Processing webhook`)

    // Verify signature if provided
    if (signature) {
      const rawPayload = JSON.stringify(payload)
      if (!this.provider.verifyWebhookSignature(rawPayload, signature)) {
        throw new Error('Invalid webhook signature')
      }
    }

    return this.provider.processWebhook(payload, signature)
  }

  /**
   * Get the current verification level for a user
   */
  async getVerificationLevel(userId: string): Promise<VerificationLevelInfo> {
    console.log(`[IdentityVerification] Getting level for user ${userId}`)

    try {
      const result = await sql`
        SELECT
          verification_level,
          verification_status,
          email_verified,
          phone_verified,
          government_id_verified,
          address_verified
        FROM grain_user_profiles
        WHERE user_id = ${userId}
      `

      if (result.rows.length === 0) {
        return this.getLevelInfo(VerificationLevel.EMAIL_ONLY)
      }

      const profile = result.rows[0]
      const level = profile.verification_level || VerificationLevel.EMAIL_ONLY

      return this.getLevelInfo(level)
    } catch (error) {
      console.error('[IdentityVerification] Get level error:', error)
      return this.getLevelInfo(VerificationLevel.EMAIL_ONLY)
    }
  }

  /**
   * Get information about a verification level
   */
  getLevelInfo(level: VerificationLevel): VerificationLevelInfo {
    const levels: Record<VerificationLevel, VerificationLevelInfo> = {
      [VerificationLevel.EMAIL_ONLY]: {
        level: VerificationLevel.EMAIL_ONLY,
        name: 'Basic',
        description: 'Email verified only',
        dailyLimit: 1000,
        monthlyLimit: 10000,
        requirements: ['Verified email address'],
      },
      [VerificationLevel.PHONE_BASIC]: {
        level: VerificationLevel.PHONE_BASIC,
        name: 'Standard',
        description: 'Phone + basic information verified',
        dailyLimit: 10000,
        monthlyLimit: 100000,
        requirements: [
          'Verified email address',
          'Verified phone number',
          'Basic personal information',
          'Address information',
        ],
      },
      [VerificationLevel.FULL_KYC]: {
        level: VerificationLevel.FULL_KYC,
        name: 'Verified',
        description: 'Full ID verification with selfie',
        dailyLimit: 100000,
        monthlyLimit: 1000000,
        requirements: [
          'Verified email address',
          'Verified phone number',
          'Government-issued photo ID',
          'Selfie verification',
          'Address verification',
        ],
      },
      [VerificationLevel.ENHANCED_DD]: {
        level: VerificationLevel.ENHANCED_DD,
        name: 'Enhanced',
        description: 'Enhanced due diligence completed',
        dailyLimit: -1, // Unlimited
        monthlyLimit: -1, // Unlimited
        requirements: [
          'All Level 3 requirements',
          'Source of funds verification',
          'Enhanced background check',
          'Manual compliance review',
        ],
      },
    }

    return levels[level]
  }

  /**
   * Check if a user can perform a transaction of given amount
   */
  async canTransact(userId: string, amount: number): Promise<{
    allowed: boolean
    reason?: string
    requiredLevel?: VerificationLevel
  }> {
    const levelInfo = await this.getVerificationLevel(userId)

    if (levelInfo.dailyLimit === -1) {
      return { allowed: true }
    }

    if (amount > levelInfo.dailyLimit) {
      // Find the required level
      let requiredLevel = VerificationLevel.ENHANCED_DD
      if (amount <= 1000) requiredLevel = VerificationLevel.EMAIL_ONLY
      else if (amount <= 10000) requiredLevel = VerificationLevel.PHONE_BASIC
      else if (amount <= 100000) requiredLevel = VerificationLevel.FULL_KYC

      return {
        allowed: false,
        reason: `Transaction amount $${amount} exceeds your daily limit of $${levelInfo.dailyLimit}`,
        requiredLevel,
      }
    }

    return { allowed: true }
  }

  /**
   * Upgrade user verification level based on completed verifications
   */
  async upgradeVerificationLevel(
    userId: string,
    completedChecks: {
      emailVerified?: boolean
      phoneVerified?: boolean
      idVerified?: boolean
      selfieVerified?: boolean
      addressVerified?: boolean
      enhancedDueDiligence?: boolean
    }
  ): Promise<VerificationLevel> {
    let newLevel = VerificationLevel.EMAIL_ONLY

    if (completedChecks.enhancedDueDiligence) {
      newLevel = VerificationLevel.ENHANCED_DD
    } else if (completedChecks.idVerified && completedChecks.selfieVerified) {
      newLevel = VerificationLevel.FULL_KYC
    } else if (completedChecks.phoneVerified && completedChecks.emailVerified) {
      newLevel = VerificationLevel.PHONE_BASIC
    } else if (completedChecks.emailVerified) {
      newLevel = VerificationLevel.EMAIL_ONLY
    }

    try {
      await sql`
        UPDATE grain_user_profiles
        SET
          verification_level = ${newLevel},
          email_verified = ${completedChecks.emailVerified || false},
          phone_verified = ${completedChecks.phoneVerified || false},
          government_id_verified = ${completedChecks.idVerified || false},
          address_verified = ${completedChecks.addressVerified || false},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `

      console.log(`[IdentityVerification] Upgraded user ${userId} to level ${newLevel}`)
    } catch (error) {
      console.error('[IdentityVerification] Upgrade level error:', error)
    }

    return newLevel
  }

  /**
   * Get active verification session for a user
   */
  private async getActiveSession(userId: string): Promise<VerificationSession | null> {
    try {
      const result = await sql`
        SELECT * FROM grain_verification_sessions
        WHERE user_id = ${userId}
          AND status = 'pending'
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]
      return {
        sessionId: row.session_id,
        provider: row.provider,
        userId: row.user_id,
        status: row.status,
        verificationUrl: row.verification_url,
        expiresAt: new Date(row.expires_at),
        createdAt: new Date(row.created_at),
        metadata: row.metadata,
      }
    } catch (error) {
      console.error('[IdentityVerification] Get active session error:', error)
      return null
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.provider.verifyWebhookSignature(payload, signature)
  }
}

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

/**
 * SQL to create the verification sessions table
 * Run this in your database to support the service:
 *
 * CREATE TABLE IF NOT EXISTS grain_verification_sessions (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   session_id TEXT NOT NULL UNIQUE,
 *   provider TEXT NOT NULL,
 *   user_id TEXT NOT NULL,
 *   status TEXT NOT NULL DEFAULT 'pending',
 *   verification_url TEXT,
 *   expires_at TIMESTAMP,
 *   completed_at TIMESTAMP,
 *   result_data JSONB,
 *   metadata JSONB DEFAULT '{}',
 *   created_at TIMESTAMP DEFAULT NOW(),
 *   updated_at TIMESTAMP DEFAULT NOW()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_verification_sessions_user ON grain_verification_sessions(user_id);
 * CREATE INDEX IF NOT EXISTS idx_verification_sessions_status ON grain_verification_sessions(status);
 * CREATE INDEX IF NOT EXISTS idx_verification_sessions_session_id ON grain_verification_sessions(session_id);
 */

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

// Default instance using Veriff
let defaultService: IdentityVerificationService | null = null

export function getIdentityVerificationService(
  provider: VerificationProvider = VerificationProvider.VERIFF
): IdentityVerificationService {
  if (!defaultService || defaultService['provider'].providerName !== provider) {
    defaultService = new IdentityVerificationService(provider)
  }
  return defaultService
}

// Convenience exports
export const createVerificationSession = (
  userId: string,
  userData: UserData,
  options?: { callbackUrl?: string; level?: VerificationLevel }
) => getIdentityVerificationService().createVerificationSession(userId, userData, options)

export const getVerificationStatus = (sessionId: string) =>
  getIdentityVerificationService().getVerificationStatus(sessionId)

export const handleVerificationWebhook = (
  payload: WebhookPayload,
  signature?: string
) => getIdentityVerificationService().handleVerificationWebhook(payload, signature)

export const getVerificationLevel = (userId: string) =>
  getIdentityVerificationService().getVerificationLevel(userId)

export default IdentityVerificationService
