/**
 * Email Configuration Utilities
 *
 * Manages user email settings including:
 * - Resend API keys
 * - SMTP credentials
 * - OAuth tokens (Gmail, Outlook)
 * - Email validation and testing
 */

import { PrismaClient } from '@prisma/client'
import { createTransport } from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { Resend } from 'resend'
import {
  encryptCredential,
  decryptCredential,
  getUserEncryptionKey
} from './settings/credential-storage'

const prisma = new PrismaClient()

// ==========================================
// TYPES
// ==========================================

export type EmailProvider = 'RESEND' | 'SMTP' | 'GMAIL_OAUTH' | 'OUTLOOK_OAUTH'

export interface EmailConfig {
  provider: EmailProvider
  fromEmail: string
  fromName?: string
  replyTo?: string
}

export interface SMTPConfig extends EmailConfig {
  provider: 'SMTP'
  smtpHost: string
  smtpPort: number
  smtpUsername: string
  smtpPassword: string
  smtpSecure: boolean
}

export interface ResendConfig extends EmailConfig {
  provider: 'RESEND'
  resendApiKey: string
}

export interface OAuthConfig extends EmailConfig {
  provider: 'GMAIL_OAUTH' | 'OUTLOOK_OAUTH'
  oauthToken: string
  oauthRefresh: string
  oauthExpiry: Date
}

export type UserEmailConfig = SMTPConfig | ResendConfig | OAuthConfig

export interface EmailTestResult {
  success: boolean
  message: string
  error?: string
  details?: any
}

// ==========================================
// DATABASE OPERATIONS
// ==========================================

/**
 * Get user's email configuration
 */
export async function getUserEmailConfig(userId: string): Promise<UserEmailConfig | null> {
  try {
    const config = await prisma.userEmailConfig.findUnique({
      where: { userId }
    })

    if (!config) {
      return null
    }

    // Get user encryption key
    const userKey = getUserEncryptionKey(userId)

    // Decrypt sensitive fields
    const decrypted: any = {
      provider: config.provider,
      fromEmail: config.fromEmail,
      fromName: config.fromName || undefined,
      replyTo: config.replyTo || undefined
    }

    // Decrypt based on provider
    if (config.provider === 'SMTP' && config.smtpPassword) {
      decrypted.smtpHost = config.smtpHost
      decrypted.smtpPort = config.smtpPort
      decrypted.smtpUsername = config.smtpUsername
      decrypted.smtpPassword = decryptCredential(config.smtpPassword, userKey)
      decrypted.smtpSecure = config.smtpSecure
    } else if (config.provider === 'RESEND' && config.resendApiKey) {
      decrypted.resendApiKey = decryptCredential(config.resendApiKey, userKey)
    } else if ((config.provider === 'GMAIL_OAUTH' || config.provider === 'OUTLOOK_OAUTH') && config.oauthToken) {
      decrypted.oauthToken = decryptCredential(config.oauthToken, userKey)
      decrypted.oauthRefresh = config.oauthRefresh ? decryptCredential(config.oauthRefresh, userKey) : undefined
      decrypted.oauthExpiry = config.oauthExpiry
    }

    return decrypted as UserEmailConfig
  } catch (error) {
    console.error('[EMAIL-CONFIG] Failed to get user email config:', error)
    return null
  }
}

/**
 * Save user's email configuration
 */
export async function saveUserEmailConfig(
  userId: string,
  config: UserEmailConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user encryption key
    const userKey = getUserEncryptionKey(userId)

    // Prepare encrypted data
    const data: any = {
      userId,
      provider: config.provider,
      fromEmail: config.fromEmail,
      fromName: config.fromName || null,
      replyTo: config.replyTo || null
    }

    // Encrypt sensitive fields based on provider
    if (config.provider === 'SMTP') {
      const smtpConfig = config as SMTPConfig
      data.smtpHost = smtpConfig.smtpHost
      data.smtpPort = smtpConfig.smtpPort
      data.smtpUsername = smtpConfig.smtpUsername
      data.smtpPassword = encryptCredential(smtpConfig.smtpPassword, userKey)
      data.smtpSecure = smtpConfig.smtpSecure
    } else if (config.provider === 'RESEND') {
      const resendConfig = config as ResendConfig
      data.resendApiKey = encryptCredential(resendConfig.resendApiKey, userKey)
    } else if (config.provider === 'GMAIL_OAUTH' || config.provider === 'OUTLOOK_OAUTH') {
      const oauthConfig = config as OAuthConfig
      data.oauthProvider = config.provider
      data.oauthToken = encryptCredential(oauthConfig.oauthToken, userKey)
      data.oauthRefresh = encryptCredential(oauthConfig.oauthRefresh, userKey)
      data.oauthExpiry = oauthConfig.oauthExpiry
    }

    // Save to database
    await prisma.userEmailConfig.upsert({
      where: { userId },
      update: {
        ...data,
        updatedAt: new Date(),
        isVerified: false // Reset verification on update
      },
      create: data
    })

    console.log(`✅ Saved email config for user ${userId} (provider: ${config.provider})`)
    return { success: true }
  } catch (error) {
    console.error('[EMAIL-CONFIG] Failed to save email config:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save email config'
    }
  }
}

/**
 * Delete user's email configuration
 */
export async function deleteUserEmailConfig(userId: string): Promise<{ success: boolean }> {
  try {
    await prisma.userEmailConfig.delete({
      where: { userId }
    })

    console.log(`🗑️  Deleted email config for user ${userId}`)
    return { success: true }
  } catch (error) {
    console.error('[EMAIL-CONFIG] Failed to delete email config:', error)
    return { success: false }
  }
}

/**
 * Update test status for user's email config
 */
export async function updateEmailConfigTestStatus(
  userId: string,
  testStatus: 'SUCCESS' | 'FAILED' | 'PENDING',
  testError?: string
): Promise<void> {
  await prisma.userEmailConfig.update({
    where: { userId },
    data: {
      lastTested: new Date(),
      testStatus,
      testError: testError || null,
      isVerified: testStatus === 'SUCCESS'
    }
  })
}

// ==========================================
// EMAIL SENDING
// ==========================================

/**
 * Create email transporter based on user config
 */
export async function createEmailTransporter(config: UserEmailConfig): Promise<Transporter | Resend> {
  if (config.provider === 'SMTP') {
    const smtpConfig = config as SMTPConfig
    return createTransport({
      host: smtpConfig.smtpHost,
      port: smtpConfig.smtpPort,
      secure: smtpConfig.smtpSecure,
      auth: {
        user: smtpConfig.smtpUsername,
        pass: smtpConfig.smtpPassword
      }
    })
  } else if (config.provider === 'RESEND') {
    const resendConfig = config as ResendConfig
    return new Resend(resendConfig.resendApiKey)
  } else {
    throw new Error(`OAuth providers not yet implemented: ${config.provider}`)
  }
}

/**
 * Send email using user's configuration
 */
export async function sendEmailWithUserConfig(
  config: UserEmailConfig,
  params: {
    to: string
    subject: string
    text: string
    html?: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = await createEmailTransporter(config)

    if (config.provider === 'SMTP') {
      // Send via SMTP
      const result = await (transporter as Transporter).sendMail({
        from: config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html || params.text,
        replyTo: config.replyTo
      })

      return {
        success: true,
        messageId: result.messageId
      }
    } else if (config.provider === 'RESEND') {
      // Send via Resend
      const result = await (transporter as Resend).emails.send({
        from: config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html || params.text,
        replyTo: config.replyTo
      })

      return {
        success: true,
        messageId: result.data?.id
      }
    }

    return { success: false, error: 'Unsupported provider' }
  } catch (error) {
    console.error('[EMAIL-CONFIG] Failed to send email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    }
  }
}

// ==========================================
// VALIDATION & TESTING
// ==========================================

/**
 * Validate email address format
 */
export function isValidEmailAddress(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate SMTP configuration
 */
export function validateSMTPConfig(config: Partial<SMTPConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.smtpHost) errors.push('SMTP host is required')
  if (!config.smtpPort) errors.push('SMTP port is required')
  if (config.smtpPort && (config.smtpPort < 1 || config.smtpPort > 65535)) {
    errors.push('SMTP port must be between 1 and 65535')
  }
  if (!config.smtpUsername) errors.push('SMTP username is required')
  if (!config.smtpPassword) errors.push('SMTP password is required')
  if (!config.fromEmail) errors.push('From email is required')
  if (config.fromEmail && !isValidEmailAddress(config.fromEmail)) {
    errors.push('From email is invalid')
  }
  if (config.replyTo && !isValidEmailAddress(config.replyTo)) {
    errors.push('Reply-to email is invalid')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate Resend configuration
 */
export function validateResendConfig(config: Partial<ResendConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.resendApiKey) errors.push('Resend API key is required')
  if (!config.fromEmail) errors.push('From email is required')
  if (config.fromEmail && !isValidEmailAddress(config.fromEmail)) {
    errors.push('From email is invalid')
  }
  if (config.replyTo && !isValidEmailAddress(config.replyTo)) {
    errors.push('Reply-to email is invalid')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Test email configuration by sending a test email
 */
export async function testEmailConfig(
  userId: string,
  config: UserEmailConfig,
  testEmailAddress: string
): Promise<EmailTestResult> {
  try {
    // Validate test email address
    if (!isValidEmailAddress(testEmailAddress)) {
      return {
        success: false,
        message: 'Invalid test email address',
        error: 'Test email address is not valid'
      }
    }

    // Validate config
    if (config.provider === 'SMTP') {
      const validation = validateSMTPConfig(config as SMTPConfig)
      if (!validation.valid) {
        return {
          success: false,
          message: 'Invalid SMTP configuration',
          error: validation.errors.join(', ')
        }
      }
    } else if (config.provider === 'RESEND') {
      const validation = validateResendConfig(config as ResendConfig)
      if (!validation.valid) {
        return {
          success: false,
          message: 'Invalid Resend configuration',
          error: validation.errors.join(', ')
        }
      }
    }

    // Update test status to pending
    await updateEmailConfigTestStatus(userId, 'PENDING')

    // Send test email
    const result = await sendEmailWithUserConfig(config, {
      to: testEmailAddress,
      subject: 'Wells AI - Email Configuration Test',
      text: `This is a test email from Wells AI to verify your email configuration.\n\nProvider: ${config.provider}\nFrom: ${config.fromEmail}\n\nIf you received this email, your configuration is working correctly!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Wells AI - Email Configuration Test</h2>
          <p>This is a test email to verify your email configuration.</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Provider:</strong> ${config.provider}</p>
            <p style="margin: 5px 0;"><strong>From:</strong> ${config.fromEmail}</p>
          </div>
          <p>If you received this email, your configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">Sent from <a href="https://wellsonyx.com">Wells AI</a></p>
        </div>
      `
    })

    if (result.success) {
      // Update test status to success
      await updateEmailConfigTestStatus(userId, 'SUCCESS')

      return {
        success: true,
        message: 'Test email sent successfully',
        details: { messageId: result.messageId }
      }
    } else {
      // Update test status to failed
      await updateEmailConfigTestStatus(userId, 'FAILED', result.error)

      return {
        success: false,
        message: 'Failed to send test email',
        error: result.error
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update test status to failed
    await updateEmailConfigTestStatus(userId, 'FAILED', errorMessage)

    return {
      success: false,
      message: 'Test failed',
      error: errorMessage
    }
  }
}

/**
 * Test SMTP connection without sending an email
 */
export async function testSMTPConnection(config: SMTPConfig): Promise<EmailTestResult> {
  try {
    const transporter = createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUsername,
        pass: config.smtpPassword
      }
    })

    // Verify connection
    await transporter.verify()

    return {
      success: true,
      message: 'SMTP connection successful'
    }
  } catch (error) {
    return {
      success: false,
      message: 'SMTP connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Test Resend API key
 */
export async function testResendApiKey(apiKey: string): Promise<EmailTestResult> {
  try {
    const resend = new Resend(apiKey)

    // Test by attempting to list domains (lightweight operation)
    // Note: This will fail if API key is invalid
    await resend.domains.list()

    return {
      success: true,
      message: 'Resend API key is valid'
    }
  } catch (error: any) {
    return {
      success: false,
      message: 'Resend API key is invalid',
      error: error?.message || 'Invalid API key'
    }
  }
}

// ==========================================
// DEFAULT EMAIL CONFIGURATION
// ==========================================

/**
 * Get default email configuration (Wells)
 */
export function getDefaultEmailConfig(): ResendConfig {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured')
  }

  return {
    provider: 'RESEND',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'wells@grainandvault.com',
    fromName: 'Wells',
    resendApiKey: apiKey
  }
}

/**
 * Get email config for user (fallback to default if not configured)
 */
export async function getEmailConfigForUser(userId: string): Promise<UserEmailConfig> {
  const userConfig = await getUserEmailConfig(userId)

  if (userConfig && userConfig.provider) {
    return userConfig
  }

  return getDefaultEmailConfig()
}
