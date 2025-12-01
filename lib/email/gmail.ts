/**
 * Gmail API Integration
 * OAuth2-based email sending using nodemailer
 */

import { createTransport, type Transporter } from 'nodemailer'
import { google } from 'googleapis'
import { PrismaClient } from '@prisma/client'
import {
  encryptCredential,
  decryptCredential,
  getUserEncryptionKey
} from '../settings/credential-storage'

const prisma = new PrismaClient()

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/userinfo.email'
]

export interface GmailOAuthTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
  scope: string
  token_type: string
}

export interface GmailSendOptions {
  to: string | string[]
  subject: string
  text: string
  html?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

/**
 * Get Gmail OAuth2 client
 */
export function getGmailOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`

  if (!clientId || !clientSecret) {
    throw new Error('Gmail OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/**
 * Generate Gmail OAuth URL
 */
export function getGmailAuthUrl(userId: string): string {
  const oauth2Client = getGmailOAuth2Client()

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    state: userId, // Pass userId to retrieve after callback
    prompt: 'consent' // Force consent screen to get refresh token
  })
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGmailCode(code: string): Promise<GmailOAuthTokens> {
  const oauth2Client = getGmailOAuth2Client()

  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get tokens from Google')
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date || Date.now() + 3600000,
    scope: tokens.scope || GMAIL_SCOPES.join(' '),
    token_type: tokens.token_type || 'Bearer'
  }
}

/**
 * Refresh Gmail access token
 */
export async function refreshGmailToken(refreshToken: string): Promise<GmailOAuthTokens> {
  const oauth2Client = getGmailOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token')
  }

  return {
    access_token: credentials.access_token,
    refresh_token: refreshToken, // Keep same refresh token
    expiry_date: credentials.expiry_date || Date.now() + 3600000,
    scope: credentials.scope || GMAIL_SCOPES.join(' '),
    token_type: credentials.token_type || 'Bearer'
  }
}

/**
 * Get user's Gmail email address
 */
export async function getGmailUserEmail(accessToken: string): Promise<string> {
  const oauth2Client = getGmailOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data } = await oauth2.userinfo.get()

  if (!data.email) {
    throw new Error('Failed to get user email from Google')
  }

  return data.email
}

/**
 * Get valid access token for user (refresh if needed)
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  // Get user's email config from database
  const config = await prisma.userEmailConfig.findUnique({
    where: { userId }
  })

  if (!config || config.provider !== 'GMAIL_OAUTH') {
    throw new Error('Gmail not configured for this user')
  }

  if (!config.oauthToken || !config.oauthRefresh) {
    throw new Error('Gmail OAuth tokens not found')
  }

  // Decrypt tokens
  const userKey = getUserEncryptionKey(userId)
  const accessToken = decryptCredential(config.oauthToken, userKey)
  const refreshToken = decryptCredential(config.oauthRefresh, userKey)

  // Check if token is expired
  const now = Date.now()
  const expiryDate = config.oauthExpiry?.getTime() || 0

  // Refresh if expired or expiring soon (within 5 minutes)
  if (expiryDate <= now + 300000) {
    console.log('[GMAIL] Access token expired, refreshing...')

    const newTokens = await refreshGmailToken(refreshToken)

    // Update database with new access token
    await prisma.userEmailConfig.update({
      where: { userId },
      data: {
        oauthToken: encryptCredential(newTokens.access_token, userKey),
        oauthExpiry: new Date(newTokens.expiry_date),
        updatedAt: new Date()
      }
    })

    return newTokens.access_token
  }

  return accessToken
}

/**
 * Create Gmail transporter
 */
export async function createGmailTransporter(userId: string): Promise<Transporter> {
  const accessToken = await getValidAccessToken(userId)

  const config = await prisma.userEmailConfig.findUnique({
    where: { userId }
  })

  if (!config || !config.fromEmail) {
    throw new Error('Gmail email address not configured')
  }

  // Create OAuth2 client for nodemailer
  const oauth2Client = getGmailOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const transporter = createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: config.fromEmail,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: config.oauthRefresh ? decryptCredential(config.oauthRefresh, getUserEncryptionKey(userId)) : undefined,
      accessToken: accessToken
    }
  })

  return transporter
}

/**
 * Send email via Gmail
 */
export async function sendGmailEmail(
  userId: string,
  options: GmailSendOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = await createGmailTransporter(userId)

    const config = await prisma.userEmailConfig.findUnique({
      where: { userId }
    })

    if (!config) {
      throw new Error('Email configuration not found')
    }

    const from = config.fromName
      ? `${config.fromName} <${config.fromEmail}>`
      : config.fromEmail

    const result = await transporter.sendMail({
      from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      replyTo: options.replyTo || config.replyTo || undefined,
      attachments: options.attachments
    })

    console.log(`✅ Email sent via Gmail: ${result.messageId}`)

    return {
      success: true,
      messageId: result.messageId
    }
  } catch (error) {
    console.error('[GMAIL] Failed to send email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    }
  }
}

/**
 * Test Gmail configuration
 */
export async function testGmailConfig(userId: string): Promise<{
  success: boolean
  message: string
  error?: string
}> {
  try {
    const transporter = await createGmailTransporter(userId)

    // Verify transporter
    await transporter.verify()

    return {
      success: true,
      message: 'Gmail configuration is valid and ready to send'
    }
  } catch (error) {
    return {
      success: false,
      message: 'Gmail configuration test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Rate limiting for Gmail
 * Gmail allows 500 emails per day for free accounts
 */
export interface GmailRateLimit {
  userId: string
  count: number
  resetAt: Date
}

const rateLimitStore = new Map<string, GmailRateLimit>()

export async function checkGmailRateLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: Date
}> {
  const now = new Date()
  const limit = rateLimitStore.get(userId)

  // Reset if new day
  if (!limit || limit.resetAt <= now) {
    const resetAt = new Date()
    resetAt.setHours(24, 0, 0, 0) // Reset at midnight

    rateLimitStore.set(userId, {
      userId,
      count: 0,
      resetAt
    })

    return {
      allowed: true,
      remaining: 500,
      resetAt
    }
  }

  // Check if under limit
  const allowed = limit.count < 500
  const remaining = Math.max(0, 500 - limit.count)

  if (allowed) {
    // Increment count
    limit.count++
    rateLimitStore.set(userId, limit)
  }

  return {
    allowed,
    remaining,
    resetAt: limit.resetAt
  }
}

/**
 * Store sent email in Gmail's Sent folder
 * This happens automatically when using Gmail API/SMTP
 */
export async function storeSentEmail(
  userId: string,
  emailData: {
    to: string
    subject: string
    body: string
    sentAt: Date
  }
): Promise<void> {
  // Gmail automatically stores sent emails in the Sent folder
  // This function is here for compatibility and future enhancements
  console.log(`[GMAIL] Email stored in Sent folder for ${userId}`)
}
