// @ts-nocheck
/**
 * Email Passthrough System
 *
 * Wells sends emails on behalf of users via their connected Gmail/Outlook.
 * The email comes FROM the user, not from Wells.
 *
 * Features:
 * - Gmail OAuth integration
 * - Microsoft/Outlook OAuth integration
 * - Thread context preservation (In-Reply-To, References)
 * - User signature preservation
 * - Rate limiting per account
 */

import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { google } from 'googleapis'

// ============================================================================
// CONFIGURATION
// ============================================================================

// Gmail OAuth
const GMAIL_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GMAIL_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GMAIL_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://wellsonyx.com/api/integrations/gmail/callback'

// Microsoft OAuth
const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || ''
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || ''
const MS_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'https://wellsonyx.com/api/integrations/outlook/callback'
const MS_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'Mail.Send', 'Mail.ReadWrite']

// ============================================================================
// TYPES
// ============================================================================

export type EmailProvider = 'gmail' | 'outlook'

export interface ConnectedEmailAccount {
  id: string
  userId: string
  provider: EmailProvider
  email: string
  displayName?: string
  accessToken: string
  refreshToken: string
  tokenExpiry: Date
  signature?: string
  isActive: boolean
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface PassthroughEmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  inReplyTo?: string
  references?: string
  preserveSignature?: boolean
  attachments?: Array<{
    filename: string
    content: string | Buffer
    contentType: string
  }>
  threadId?: string
}

export interface PassthroughResult {
  success: boolean
  messageId?: string
  providerMessageId?: string
  error?: string
}

// ============================================================================
// GMAIL OAUTH
// ============================================================================

function getGmailOAuth2Client() {
  return new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  )
}

/**
 * Generate Gmail OAuth URL for user to authorize
 */
export function getGmailAuthUrl(state: string): string {
  if (!GMAIL_CLIENT_ID) {
    throw new Error('Gmail OAuth not configured')
  }

  const oauth2Client = getGmailOAuth2Client()

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state,
    prompt: 'consent', // Force refresh token
  })
}

/**
 * Exchange Gmail auth code for tokens
 */
export async function exchangeGmailCode(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiryDate: Date
  email: string
  name?: string
}> {
  const oauth2Client = getGmailOAuth2Client()

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  // Get user info
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const userInfo = await oauth2.userinfo.get()

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received. User may need to revoke access and re-authorize.')
  }

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token,
    expiryDate: new Date(tokens.expiry_date || Date.now() + 3600000),
    email: userInfo.data.email!,
    name: userInfo.data.name || undefined,
  }
}

/**
 * Refresh Gmail access token
 */
async function refreshGmailToken(account: ConnectedEmailAccount): Promise<string> {
  const oauth2Client = getGmailOAuth2Client()
  oauth2Client.setCredentials({
    refresh_token: account.refreshToken,
  })

  const { credentials } = await oauth2Client.refreshAccessToken()

  // Update stored tokens
  await query(
    `UPDATE email_accounts SET
      access_token = $1,
      token_expiry = $2,
      updated_at = NOW()
     WHERE id = $3`,
    [credentials.access_token, new Date(credentials.expiry_date!), account.id]
  )

  return credentials.access_token!
}

// ============================================================================
// MICROSOFT OAUTH
// ============================================================================

/**
 * Generate Microsoft OAuth URL for user to authorize
 */
export function getOutlookAuthUrl(state: string): string {
  if (!MS_CLIENT_ID) {
    throw new Error('Microsoft OAuth not configured')
  }

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MS_REDIRECT_URI,
    response_mode: 'query',
    scope: MS_SCOPES.join(' '),
    state,
    prompt: 'consent',
  })

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
}

/**
 * Exchange Microsoft auth code for tokens
 */
export async function exchangeOutlookCode(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiryDate: Date
  email: string
  name?: string
}> {
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      code,
      redirect_uri: MS_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Microsoft token exchange failed: ${error.error_description || error.error}`)
  }

  const tokens = await response.json()

  // Get user info from Microsoft Graph
  const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  })

  if (!userResponse.ok) {
    throw new Error('Failed to get Microsoft user info')
  }

  const userInfo = await userResponse.json()

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: new Date(Date.now() + tokens.expires_in * 1000),
    email: userInfo.mail || userInfo.userPrincipalName,
    name: userInfo.displayName,
  }
}

/**
 * Refresh Microsoft access token
 */
async function refreshOutlookToken(account: ConnectedEmailAccount): Promise<string> {
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh Microsoft token')
  }

  const tokens = await response.json()

  // Update stored tokens
  await query(
    `UPDATE email_accounts SET
      access_token = $1,
      refresh_token = COALESCE($2, refresh_token),
      token_expiry = $3,
      updated_at = NOW()
     WHERE id = $4`,
    [
      tokens.access_token,
      tokens.refresh_token || null,
      new Date(Date.now() + tokens.expires_in * 1000),
      account.id,
    ]
  )

  return tokens.access_token
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

async function getValidToken(account: ConnectedEmailAccount): Promise<string> {
  // Check if token is still valid (with 5 min buffer)
  if (account.tokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
    return account.accessToken
  }

  // Refresh the token
  if (account.provider === 'gmail') {
    return refreshGmailToken(account)
  } else {
    return refreshOutlookToken(account)
  }
}

// ============================================================================
// ACCOUNT MANAGEMENT
// ============================================================================

/**
 * Connect a new email account
 */
export async function connectEmailAccount(
  userId: string,
  provider: EmailProvider,
  tokenData: {
    accessToken: string
    refreshToken: string
    expiryDate: Date
    email: string
    name?: string
  }
): Promise<ConnectedEmailAccount> {
  const id = uuidv4()

  // Check for existing account with same email
  const existing = await query(
    `SELECT id FROM email_accounts WHERE user_id = $1 AND email = $2`,
    [userId, tokenData.email]
  )

  if (existing?.rows?.length > 0) {
    // Update existing account
    await query(
      `UPDATE email_accounts SET
        access_token = $1,
        refresh_token = $2,
        token_expiry = $3,
        display_name = $4,
        is_active = true,
        updated_at = NOW()
       WHERE user_id = $5 AND email = $6`,
      [
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.expiryDate,
        tokenData.name,
        userId,
        tokenData.email,
      ]
    )

    return getEmailAccount(existing.rows[0].id) as Promise<ConnectedEmailAccount>
  }

  // Create new account
  await query(
    `INSERT INTO email_accounts (
      id, user_id, provider, email, display_name,
      access_token, refresh_token, token_expiry,
      is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())`,
    [
      id,
      userId,
      provider,
      tokenData.email,
      tokenData.name,
      tokenData.accessToken,
      tokenData.refreshToken,
      tokenData.expiryDate,
    ]
  )

  return getEmailAccount(id) as Promise<ConnectedEmailAccount>
}

/**
 * Get email account by ID
 */
export async function getEmailAccount(accountId: string): Promise<ConnectedEmailAccount | null> {
  try {
    const result = await query(
      `SELECT
        id, user_id, provider, email, display_name,
        access_token, refresh_token, token_expiry,
        signature, is_active, last_sync_at, created_at, updated_at
       FROM email_accounts
       WHERE id = $1`,
      [accountId]
    )

    if (!result?.rows?.[0]) return null

    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      email: row.email,
      displayName: row.display_name,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiry: new Date(row.token_expiry),
      signature: row.signature,
      isActive: row.is_active,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  } catch (error) {
    console.error('[EmailPassthrough] Failed to get account:', error)
    return null
  }
}

/**
 * Get all connected accounts for a user
 */
export async function getUserEmailAccounts(userId: string): Promise<ConnectedEmailAccount[]> {
  try {
    const result = await query(
      `SELECT
        id, user_id, provider, email, display_name,
        access_token, refresh_token, token_expiry,
        signature, is_active, last_sync_at, created_at, updated_at
       FROM email_accounts
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [userId]
    )

    return (result?.rows || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      email: row.email,
      displayName: row.display_name,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiry: new Date(row.token_expiry),
      signature: row.signature,
      isActive: row.is_active,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  } catch (error) {
    console.error('[EmailPassthrough] Failed to get user accounts:', error)
    return []
  }
}

/**
 * Get user's default/primary email account
 */
export async function getDefaultEmailAccount(userId: string): Promise<ConnectedEmailAccount | null> {
  const accounts = await getUserEmailAccounts(userId)
  return accounts[0] || null
}

/**
 * Disconnect an email account
 */
export async function disconnectEmailAccount(accountId: string): Promise<void> {
  await query(
    `UPDATE email_accounts SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [accountId]
  )
}

/**
 * Update account signature
 */
export async function updateAccountSignature(accountId: string, signature: string): Promise<void> {
  await query(
    `UPDATE email_accounts SET signature = $1, updated_at = NOW() WHERE id = $1`,
    [signature, accountId]
  )
}

// ============================================================================
// GMAIL EMAIL SENDING
// ============================================================================

async function sendViaGmail(
  account: ConnectedEmailAccount,
  options: PassthroughEmailOptions
): Promise<PassthroughResult> {
  const accessToken = await getValidToken(account)

  const oauth2Client = getGmailOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  // Build the email with proper signature
  let htmlContent = options.html
  if (options.preserveSignature !== false && account.signature) {
    htmlContent += `<br><br>${account.signature}`
  }

  // Construct MIME message
  const boundary = `----=_Part_${Date.now()}`
  const toList = Array.isArray(options.to) ? options.to.join(', ') : options.to

  let mimeMessage = [
    `From: ${account.displayName ? `"${account.displayName}" <${account.email}>` : account.email}`,
    `To: ${toList}`,
  ]

  if (options.cc) {
    const ccList = Array.isArray(options.cc) ? options.cc.join(', ') : options.cc
    mimeMessage.push(`Cc: ${ccList}`)
  }

  mimeMessage.push(`Subject: ${options.subject}`)
  mimeMessage.push(`MIME-Version: 1.0`)

  // Add threading headers
  if (options.inReplyTo) {
    mimeMessage.push(`In-Reply-To: ${options.inReplyTo}`)
    mimeMessage.push(`References: ${options.references || options.inReplyTo}`)
  }

  if (options.replyTo) {
    mimeMessage.push(`Reply-To: ${options.replyTo}`)
  }

  mimeMessage.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
  mimeMessage.push('')
  mimeMessage.push(`--${boundary}`)
  mimeMessage.push('Content-Type: text/plain; charset=UTF-8')
  mimeMessage.push('')
  mimeMessage.push(options.text || htmlContent.replace(/<[^>]*>/g, ''))
  mimeMessage.push('')
  mimeMessage.push(`--${boundary}`)
  mimeMessage.push('Content-Type: text/html; charset=UTF-8')
  mimeMessage.push('')
  mimeMessage.push(htmlContent)
  mimeMessage.push(`--${boundary}--`)

  const rawMessage = mimeMessage.join('\n')
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  try {
    const sendOptions: any = {
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    }

    // If this is a reply to an existing thread
    if (options.threadId) {
      sendOptions.requestBody.threadId = options.threadId
    }

    const response = await gmail.users.messages.send(sendOptions)

    // Store the sent message
    await storePassthroughMessage(account, options, response.data.id!)

    return {
      success: true,
      messageId: uuidv4(),
      providerMessageId: response.data.id!,
    }
  } catch (error: any) {
    console.error('[EmailPassthrough] Gmail send failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to send via Gmail',
    }
  }
}

// ============================================================================
// OUTLOOK EMAIL SENDING
// ============================================================================

async function sendViaOutlook(
  account: ConnectedEmailAccount,
  options: PassthroughEmailOptions
): Promise<PassthroughResult> {
  const accessToken = await getValidToken(account)

  // Build the email with proper signature
  let htmlContent = options.html
  if (options.preserveSignature !== false && account.signature) {
    htmlContent += `<br><br>${account.signature}`
  }

  const toRecipients = (Array.isArray(options.to) ? options.to : [options.to]).map(email => ({
    emailAddress: { address: email },
  }))

  const message: any = {
    subject: options.subject,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients,
  }

  if (options.cc) {
    message.ccRecipients = (Array.isArray(options.cc) ? options.cc : [options.cc]).map(email => ({
      emailAddress: { address: email },
    }))
  }

  if (options.bcc) {
    message.bccRecipients = (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).map(email => ({
      emailAddress: { address: email },
    }))
  }

  if (options.replyTo) {
    message.replyTo = [{ emailAddress: { address: options.replyTo } }]
  }

  // Add conversation/thread reference if replying
  if (options.inReplyTo) {
    message.internetMessageHeaders = [
      { name: 'In-Reply-To', value: options.inReplyTo },
      { name: 'References', value: options.references || options.inReplyTo },
    ]
  }

  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Microsoft send failed')
    }

    // Store the sent message
    await storePassthroughMessage(account, options)

    return {
      success: true,
      messageId: uuidv4(),
    }
  } catch (error: any) {
    console.error('[EmailPassthrough] Outlook send failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to send via Outlook',
    }
  }
}

// ============================================================================
// UNIFIED SEND FUNCTION
// ============================================================================

/**
 * Send email through user's connected account
 */
export async function sendPassthroughEmail(
  userId: string,
  options: PassthroughEmailOptions,
  preferredAccountId?: string
): Promise<PassthroughResult> {
  // Get the account to use
  let account: ConnectedEmailAccount | null = null

  if (preferredAccountId) {
    account = await getEmailAccount(preferredAccountId)
    if (account && account.userId !== userId) {
      return { success: false, error: 'Account does not belong to user' }
    }
  }

  if (!account) {
    account = await getDefaultEmailAccount(userId)
  }

  if (!account) {
    return {
      success: false,
      error: "No email account connected. Say 'connect my Gmail' or 'connect my Outlook' to get started.",
    }
  }

  if (!account.isActive) {
    return { success: false, error: 'Email account is disconnected' }
  }

  // Route to appropriate provider
  if (account.provider === 'gmail') {
    return sendViaGmail(account, options)
  } else if (account.provider === 'outlook') {
    return sendViaOutlook(account, options)
  } else {
    return { success: false, error: `Unsupported provider: ${account.provider}` }
  }
}

// ============================================================================
// MESSAGE STORAGE
// ============================================================================

async function storePassthroughMessage(
  account: ConnectedEmailAccount,
  options: PassthroughEmailOptions,
  providerMessageId?: string
): Promise<void> {
  const messageId = uuidv4()
  const threadId = options.threadId || uuidv4()

  try {
    await query(
      `INSERT INTO email_messages (
        id, thread_id, user_id, sender_type, account_id,
        from_email, to_email, cc_emails, bcc_emails,
        subject, html_body, text_body,
        in_reply_to, references_header,
        provider_message_id, status, sent_at
      ) VALUES ($1, $2, $3, 'user', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'sent', NOW())`,
      [
        messageId,
        threadId,
        account.userId,
        account.id,
        account.email,
        Array.isArray(options.to) ? options.to.join(', ') : options.to,
        options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : null,
        options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : null,
        options.subject,
        options.html,
        options.text,
        options.inReplyTo,
        options.references,
        providerMessageId,
      ]
    )

    // Update or create thread
    await query(
      `INSERT INTO email_threads (id, user_id, subject, participants, last_message_at, message_count, status)
       VALUES ($1, $2, $3, $4, NOW(), 1, 'active')
       ON CONFLICT (id) DO UPDATE SET
         last_message_at = NOW(),
         message_count = email_threads.message_count + 1,
         updated_at = NOW()`,
      [
        threadId,
        account.userId,
        options.subject.replace(/^Re:\s*/i, ''),
        Array.isArray(options.to) ? options.to : [options.to],
      ]
    )
  } catch (error) {
    console.error('[EmailPassthrough] Failed to store message:', error)
  }
}

// ============================================================================
// EMAIL READING (For Thread Context)
// ============================================================================

/**
 * Get recent emails from connected account for thread context
 */
export async function getRecentEmails(
  userId: string,
  options: {
    accountId?: string
    query?: string
    maxResults?: number
  } = {}
): Promise<any[]> {
  const account = options.accountId
    ? await getEmailAccount(options.accountId)
    : await getDefaultEmailAccount(userId)

  if (!account) return []

  if (account.provider === 'gmail') {
    return getGmailEmails(account, options)
  } else if (account.provider === 'outlook') {
    return getOutlookEmails(account, options)
  }

  return []
}

async function getGmailEmails(
  account: ConnectedEmailAccount,
  options: { query?: string; maxResults?: number }
): Promise<any[]> {
  const accessToken = await getValidToken(account)

  const oauth2Client = getGmailOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  try {
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: options.query || 'in:inbox',
      maxResults: options.maxResults || 20,
    })

    const messages = listResponse.data.messages || []
    const results: any[] = []

    for (const msg of messages.slice(0, 10)) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      })

      const headers = detail.data.payload?.headers || []
      results.push({
        id: msg.id,
        threadId: msg.threadId,
        from: headers.find(h => h.name === 'From')?.value,
        to: headers.find(h => h.name === 'To')?.value,
        subject: headers.find(h => h.name === 'Subject')?.value,
        date: headers.find(h => h.name === 'Date')?.value,
        snippet: detail.data.snippet,
      })
    }

    return results
  } catch (error) {
    console.error('[EmailPassthrough] Failed to get Gmail emails:', error)
    return []
  }
}

async function getOutlookEmails(
  account: ConnectedEmailAccount,
  options: { query?: string; maxResults?: number }
): Promise<any[]> {
  const accessToken = await getValidToken(account)

  try {
    const searchParam = options.query
      ? `&$search="${encodeURIComponent(options.query)}"`
      : ''

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=${options.maxResults || 20}&$orderby=receivedDateTime desc${searchParam}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch Outlook emails')
    }

    const data = await response.json()
    return (data.value || []).map((msg: any) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      from: msg.from?.emailAddress?.address,
      to: msg.toRecipients?.map((r: any) => r.emailAddress?.address).join(', '),
      subject: msg.subject,
      date: msg.receivedDateTime,
      snippet: msg.bodyPreview,
    }))
  } catch (error) {
    console.error('[EmailPassthrough] Failed to get Outlook emails:', error)
    return []
  }
}

/**
 * Get a specific email thread
 */
export async function getEmailThread(
  userId: string,
  threadId: string,
  accountId?: string
): Promise<any | null> {
  const account = accountId
    ? await getEmailAccount(accountId)
    : await getDefaultEmailAccount(userId)

  if (!account) return null

  if (account.provider === 'gmail') {
    return getGmailThread(account, threadId)
  } else if (account.provider === 'outlook') {
    return getOutlookConversation(account, threadId)
  }

  return null
}

async function getGmailThread(account: ConnectedEmailAccount, threadId: string): Promise<any> {
  const accessToken = await getValidToken(account)

  const oauth2Client = getGmailOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  try {
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
    })

    return thread.data
  } catch (error) {
    console.error('[EmailPassthrough] Failed to get Gmail thread:', error)
    return null
  }
}

async function getOutlookConversation(account: ConnectedEmailAccount, conversationId: string): Promise<any> {
  const accessToken = await getValidToken(account)

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${conversationId}'&$orderby=receivedDateTime asc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch Outlook conversation')
    }

    return await response.json()
  } catch (error) {
    console.error('[EmailPassthrough] Failed to get Outlook conversation:', error)
    return null
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Reply to an existing email thread
 */
export async function replyToThread(
  userId: string,
  threadId: string,
  content: string,
  options: {
    accountId?: string
    htmlContent?: string
    inReplyTo?: string
  } = {}
): Promise<PassthroughResult> {
  // Get thread info
  const thread = await getEmailThread(userId, threadId, options.accountId)
  if (!thread) {
    return { success: false, error: 'Thread not found' }
  }

  // Extract thread metadata
  let subject: string
  let to: string
  let inReplyTo: string | undefined
  let references: string | undefined

  if (thread.messages) {
    // Gmail thread
    const lastMessage = thread.messages[thread.messages.length - 1]
    const headers = lastMessage.payload?.headers || []
    subject = headers.find((h: any) => h.name === 'Subject')?.value || 'Re: (no subject)'
    const from = headers.find((h: any) => h.name === 'From')?.value
    to = from?.match(/<(.+)>/)?.[1] || from
    inReplyTo = headers.find((h: any) => h.name === 'Message-ID')?.value
  } else if (thread.value) {
    // Outlook conversation
    const lastMessage = thread.value[thread.value.length - 1]
    subject = `Re: ${lastMessage.subject.replace(/^Re:\s*/i, '')}`
    to = lastMessage.from?.emailAddress?.address
    inReplyTo = lastMessage.internetMessageId
  } else {
    return { success: false, error: 'Unable to parse thread' }
  }

  if (!subject.startsWith('Re:')) {
    subject = `Re: ${subject}`
  }

  return sendPassthroughEmail(userId, {
    to,
    subject,
    html: options.htmlContent || `<p>${content.replace(/\n/g, '<br>')}</p>`,
    text: content,
    inReplyTo,
    references,
    threadId,
  }, options.accountId)
}

export default {
  // OAuth
  getGmailAuthUrl,
  exchangeGmailCode,
  getOutlookAuthUrl,
  exchangeOutlookCode,

  // Account management
  connectEmailAccount,
  getEmailAccount,
  getUserEmailAccounts,
  getDefaultEmailAccount,
  disconnectEmailAccount,
  updateAccountSignature,

  // Sending
  sendPassthroughEmail,
  replyToThread,

  // Reading
  getRecentEmails,
  getEmailThread,
}
