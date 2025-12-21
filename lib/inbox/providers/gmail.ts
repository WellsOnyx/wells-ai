// @ts-nocheck
/**
 * Gmail Integration for Wells Unified Inbox
 *
 * Supports:
 * - Multiple Gmail accounts per user
 * - OAuth 2.0 authentication
 * - Real-time sync via push notifications
 * - Send/receive/reply
 * - Labels and threading
 */

import { google } from 'googleapis'
import { neon } from '@neondatabase/serverless'
import { OAuth2Client } from 'google-auth-library'
import { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1'

// Lazy initialization to prevent build-time errors
const getSql = () => {
  const dbUrl = process.env.DATABASE_URL;
  // Only initialize if DATABASE_URL is a valid postgres connection string
  if (!dbUrl || (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://'))) {
    return () => Promise.resolve([]);
  }
  return neon(dbUrl);
}

// OAuth configuration
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

export interface GmailAccount {
  id: string
  user_id: string
  email: string
  account_name?: string
  access_token: string
  refresh_token: string
  expires_at: Date
  history_id?: string // For incremental sync
  watch_expiration?: Date // For push notifications
  labels?: GmailLabel[]
  last_sync_at?: Date
  sync_status: 'active' | 'paused' | 'error'
  error_message?: string
  created_at: Date
  updated_at: Date
}

export interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  messageListVisibility?: string
  labelListVisibility?: string
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  historyId: string
  internalDate: string
  sizeEstimate: number
  payload?: gmail_v1.Schema$MessagePart
  from?: string
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body?: string
  bodyHtml?: string
  attachments?: GmailAttachment[]
  date?: Date
}

export interface GmailAttachment {
  filename: string
  mimeType: string
  size: number
  attachmentId: string
  data?: string // Base64 encoded
}

export interface SendEmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  body: string
  bodyHtml?: string
  attachments?: Array<{
    filename: string
    content: string // Base64 encoded
    mimeType: string
  }>
  threadId?: string // For replies
  inReplyTo?: string // Message-ID header
  references?: string // Message-ID references
}

// Initialize OAuth2 client
function getOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

/**
 * Get authorization URL for OAuth flow
 */
export function getAuthUrl(userId: string, redirectUri?: string, returnTo?: string): string {
  const oauth2Client = getOAuth2Client()

  // Include userId and returnTo in state for callback
  const state = Buffer.from(JSON.stringify({
    userId,
    timestamp: Date.now(),
    returnTo: returnTo || '/inbox'
  })).toString('base64')

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get refresh token
    scope: GMAIL_SCOPES,
    state,
    prompt: 'consent', // Force consent screen to always get refresh_token
    redirect_uri: redirectUri || process.env.GOOGLE_REDIRECT_URI,
  })

  return authUrl
}

/**
 * Handle OAuth callback and save tokens
 */
export async function handleOAuthCallback(
  code: string,
  userId: string,
  redirectUri?: string
): Promise<GmailAccount> {
  const oauth2Client = getOAuth2Client()

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken({
    code,
    redirect_uri: redirectUri || process.env.GOOGLE_REDIRECT_URI,
  })

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get access token or refresh token')
  }

  oauth2Client.setCredentials(tokens)

  // Get user info (email address)
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const userInfo = await oauth2.userinfo.get()
  const email = userInfo.data.email || 'unknown@gmail.com'

  // Get Gmail labels
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const labelsResponse = await gmail.users.labels.list({ userId: 'me' })
  const labels: GmailLabel[] = (labelsResponse.data.labels || []).map((label) => ({
    id: label.id || '',
    name: label.name || '',
    type: label.type === 'system' ? 'system' : 'user',
    messageListVisibility: label.messageListVisibility,
    labelListVisibility: label.labelListVisibility,
  }))

  // Calculate expiration
  const expiresAt = new Date(Date.now() + (tokens.expiry_date || 3600000))

  // Save account to database
  const account = await saveGmailAccount({
    user_id: userId,
    email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    labels,
  })

  // Start watching inbox for push notifications
  try {
    await watchInbox(account.id)
  } catch (error) {
    console.error('[Gmail] Failed to set up push notifications:', error)
    // Don't fail the whole flow if watch fails
  }

  // Trigger initial sync in background
  syncMessages(account.id, { maxResults: 100 }).catch((error) => {
    console.error('[Gmail] Initial sync failed:', error)
  })

  return account
}

/**
 * Refresh expired access token
 */
export async function refreshAccessToken(accountId: string): Promise<string> {
  const account = await getGmailAccount(accountId)
  if (!account) {
    throw new Error('Gmail account not found')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    refresh_token: account.refresh_token,
  })

  try {
    const { credentials } = await oauth2Client.refreshAccessToken()

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token')
    }

    const expiresAt = new Date(Date.now() + (credentials.expiry_date || 3600000))

    // Update account with new token
    const sql = getSql();
    await sql`
      UPDATE gmail_accounts
      SET
        access_token = ${credentials.access_token},
        expires_at = ${expiresAt.toISOString()},
        sync_status = 'active',
        error_message = NULL,
        updated_at = NOW()
      WHERE id = ${accountId}
    `

    return credentials.access_token
  } catch (error: any) {
    console.error('[Gmail] Token refresh failed:', error)

    // Mark account as error
    const sql = getSql();
    await sql`
      UPDATE gmail_accounts
      SET
        sync_status = 'error',
        error_message = ${error.message},
        updated_at = NOW()
      WHERE id = ${accountId}
    `

    throw error
  }
}

/**
 * Get authenticated Gmail client for an account
 */
async function getGmailClient(accountId: string): Promise<gmail_v1.Gmail> {
  const account = await getGmailAccount(accountId)
  if (!account) {
    throw new Error('Gmail account not found')
  }

  // Check if token is expired
  if (new Date(account.expires_at) <= new Date()) {
    console.log('[Gmail] Token expired, refreshing...')
    await refreshAccessToken(accountId)
    // Re-fetch account with new token
    const refreshedAccount = await getGmailAccount(accountId)
    if (!refreshedAccount) {
      throw new Error('Failed to refresh account')
    }
    account.access_token = refreshedAccount.access_token
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

/**
 * Sync messages from Gmail
 */
export async function syncMessages(
  accountId: string,
  options: {
    maxResults?: number
    labelIds?: string[]
    query?: string
    pageToken?: string
  } = {}
): Promise<{ messages: GmailMessage[]; nextPageToken?: string; historyId?: string }> {
  const gmail = await getGmailClient(accountId)
  const account = await getGmailAccount(accountId)

  if (!account) {
    throw new Error('Gmail account not found')
  }

  const { maxResults = 50, labelIds = ['INBOX'], query, pageToken } = options

  try {
    // If we have a history_id, use incremental sync
    if (account.history_id && !pageToken && !query) {
      console.log('[Gmail] Using incremental sync from historyId:', account.history_id)
      return await syncFromHistory(accountId, account.history_id)
    }

    // Full sync
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds,
      q: query,
      pageToken,
    })

    const messageIds = response.data.messages || []
    const messages: GmailMessage[] = []

    // Fetch full message details in parallel
    const messagePromises = messageIds.map(async (msg) => {
      if (!msg.id) return null

      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      })

      return parseGmailMessage(fullMessage.data)
    })

    const fetchedMessages = await Promise.all(messagePromises)
    messages.push(...fetchedMessages.filter((m): m is GmailMessage => m !== null))

    // Save messages to inbox
    for (const message of messages) {
      await saveMessageToInbox(accountId, account.user_id, message)
    }

    // Update last sync and history_id
    if (messages.length > 0) {
      const latestHistoryId = messages[0].historyId
      const sql = getSql();
      await sql`
        UPDATE gmail_accounts
        SET
          history_id = ${latestHistoryId},
          last_sync_at = NOW(),
          sync_status = 'active',
          error_message = NULL,
          updated_at = NOW()
        WHERE id = ${accountId}
      `
    }

    return {
      messages,
      nextPageToken: response.data.nextPageToken,
      historyId: messages[0]?.historyId,
    }
  } catch (error: any) {
    console.error('[Gmail] Sync failed:', error)

    const sql = getSql();
    await sql`
      UPDATE gmail_accounts
      SET
        sync_status = 'error',
        error_message = ${error.message},
        updated_at = NOW()
      WHERE id = ${accountId}
    `

    throw error
  }
}

/**
 * Incremental sync using history API
 */
async function syncFromHistory(accountId: string, startHistoryId: string): Promise<{ messages: GmailMessage[]; historyId?: string }> {
  const gmail = await getGmailClient(accountId)
  const account = await getGmailAccount(accountId)

  if (!account) {
    throw new Error('Gmail account not found')
  }

  try {
    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
    })

    const history = response.data.history || []
    const messages: GmailMessage[] = []
    const processedMessageIds = new Set<string>()

    // Process history changes
    for (const record of history) {
      // New messages
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          if (added.message?.id && !processedMessageIds.has(added.message.id)) {
            processedMessageIds.add(added.message.id)

            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: added.message.id,
              format: 'full',
            })

            const parsed = parseGmailMessage(fullMessage.data)
            if (parsed) {
              messages.push(parsed)
              await saveMessageToInbox(accountId, account.user_id, parsed)
            }
          }
        }
      }

      // Deleted messages
      if (record.messagesDeleted) {
        for (const deleted of record.messagesDeleted) {
          if (deleted.message?.id) {
            await deleteMessageFromInbox(deleted.message.id)
          }
        }
      }

      // Label changes (mark as read/unread, archive, etc.)
      if (record.labelsAdded || record.labelsRemoved) {
        // Handle label updates
        // TODO: Update message labels in inbox
      }
    }

    // Update history_id
    const newHistoryId = response.data.historyId
    if (newHistoryId) {
      const sql = getSql();
      await sql`
        UPDATE gmail_accounts
        SET
          history_id = ${newHistoryId},
          last_sync_at = NOW(),
          updated_at = NOW()
        WHERE id = ${accountId}
      `
    }

    return { messages, historyId: newHistoryId }
  } catch (error: any) {
    console.error('[Gmail] History sync failed:', error)
    // Fall back to full sync
    return syncMessages(accountId, { maxResults: 100 })
  }
}

/**
 * Get a single message
 */
export async function getMessage(accountId: string, messageId: string): Promise<GmailMessage | null> {
  const gmail = await getGmailClient(accountId)

  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })

    return parseGmailMessage(response.data)
  } catch (error) {
    console.error('[Gmail] Failed to get message:', error)
    return null
  }
}

/**
 * Send an email
 */
export async function sendMessage(
  accountId: string,
  options: SendEmailOptions
): Promise<GmailMessage> {
  const gmail = await getGmailClient(accountId)
  const account = await getGmailAccount(accountId)

  if (!account) {
    throw new Error('Gmail account not found')
  }

  // Build email message
  const email = buildEmailMessage(account.email, options)

  try {
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: email,
        threadId: options.threadId,
      },
    })

    const sent = parseGmailMessage(response.data)
    if (!sent) {
      throw new Error('Failed to parse sent message')
    }

    // Save to inbox as outbound message
    await saveMessageToInbox(accountId, account.user_id, sent, 'outbound')

    return sent
  } catch (error: any) {
    console.error('[Gmail] Failed to send message:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

/**
 * Reply to a message (sends in same thread)
 */
export async function replyToMessage(
  accountId: string,
  threadId: string,
  body: string,
  bodyHtml?: string
): Promise<GmailMessage> {
  const gmail = await getGmailClient(accountId)

  // Get original message to extract headers
  const thread = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
  })

  const originalMessage = thread.data.messages?.[0]
  if (!originalMessage) {
    throw new Error('Original message not found')
  }

  const headers = originalMessage.payload?.headers || []
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || ''
  const to = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || ''
  const messageId = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value || ''
  const references = headers.find((h) => h.name?.toLowerCase() === 'references')?.value || ''

  return sendMessage(accountId, {
    to,
    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
    body,
    bodyHtml,
    threadId,
    inReplyTo: messageId,
    references: references ? `${references} ${messageId}` : messageId,
  })
}

/**
 * Create a draft
 */
export async function createDraft(
  accountId: string,
  options: SendEmailOptions
): Promise<gmail_v1.Schema$Draft> {
  const gmail = await getGmailClient(accountId)
  const account = await getGmailAccount(accountId)

  if (!account) {
    throw new Error('Gmail account not found')
  }

  const email = buildEmailMessage(account.email, options)

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: email,
        threadId: options.threadId,
      },
    },
  })

  return response.data
}

/**
 * Modify message labels
 */
export async function modifyLabels(
  accountId: string,
  messageId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[]
): Promise<void> {
  const gmail = await getGmailClient(accountId)

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds,
      removeLabelIds,
    },
  })
}

/**
 * Mark message as read
 */
export async function markAsRead(accountId: string, messageId: string): Promise<void> {
  await modifyLabels(accountId, messageId, undefined, ['UNREAD'])
}

/**
 * Mark message as unread
 */
export async function markAsUnread(accountId: string, messageId: string): Promise<void> {
  await modifyLabels(accountId, messageId, ['UNREAD'])
}

/**
 * Archive message
 */
export async function archive(accountId: string, messageId: string): Promise<void> {
  await modifyLabels(accountId, messageId, undefined, ['INBOX'])
}

/**
 * Move to trash
 */
export async function trash(accountId: string, messageId: string): Promise<void> {
  const gmail = await getGmailClient(accountId)
  await gmail.users.messages.trash({ userId: 'me', id: messageId })
}

/**
 * Move back to inbox
 */
export async function moveToInbox(accountId: string, messageId: string): Promise<void> {
  await modifyLabels(accountId, messageId, ['INBOX'])
}

/**
 * Set up push notifications for inbox
 */
export async function watchInbox(accountId: string): Promise<void> {
  const gmail = await getGmailClient(accountId)

  // Gmail push notifications require a Pub/Sub topic
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC

  if (!topicName) {
    console.warn('[Gmail] GOOGLE_PUBSUB_TOPIC not configured, skipping watch setup')
    return
  }

  try {
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX', 'SENT'],
      },
    })

    const expirationMs = parseInt(response.data.expiration || '0')
    const watchExpiration = new Date(expirationMs)

    const sql = getSql();
    await sql`
      UPDATE gmail_accounts
      SET
        watch_expiration = ${watchExpiration.toISOString()},
        updated_at = NOW()
      WHERE id = ${accountId}
    `

    console.log('[Gmail] Watch set up successfully, expires:', watchExpiration)
  } catch (error) {
    console.error('[Gmail] Failed to set up watch:', error)
    throw error
  }
}

/**
 * Stop watching inbox
 */
export async function stopWatch(accountId: string): Promise<void> {
  const gmail = await getGmailClient(accountId)

  try {
    await gmail.users.stop({ userId: 'me' })

    const sql = getSql();
    await sql`
      UPDATE gmail_accounts
      SET watch_expiration = NULL, updated_at = NOW()
      WHERE id = ${accountId}
    `
  } catch (error) {
    console.error('[Gmail] Failed to stop watch:', error)
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse Gmail message into our format
 */
function parseGmailMessage(message: gmail_v1.Schema$Message): GmailMessage | null {
  if (!message.id || !message.threadId) {
    return null
  }

  const headers = message.payload?.headers || []
  const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value

  const from = getHeader('From') || ''
  const to = getHeader('To') || ''
  const cc = getHeader('Cc') || ''
  const bcc = getHeader('Bcc') || ''
  const subject = getHeader('Subject') || '(No subject)'
  const dateStr = getHeader('Date') || message.internalDate

  // Extract body
  const { body, bodyHtml, attachments } = extractBody(message.payload)

  return {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds || [],
    snippet: message.snippet || '',
    historyId: message.historyId || '',
    internalDate: message.internalDate || '',
    sizeEstimate: message.sizeEstimate || 0,
    payload: message.payload,
    from,
    to,
    cc,
    bcc,
    subject,
    body,
    bodyHtml,
    attachments,
    date: dateStr ? new Date(parseInt(dateStr)) : undefined,
  }
}

/**
 * Extract email body and attachments from message payload
 */
function extractBody(payload?: gmail_v1.Schema$MessagePart): {
  body: string
  bodyHtml: string
  attachments: GmailAttachment[]
} {
  let body = ''
  let bodyHtml = ''
  const attachments: GmailAttachment[] = []

  if (!payload) {
    return { body, bodyHtml, attachments }
  }

  // Check for multipart
  if (payload.parts) {
    for (const part of payload.parts) {
      const mimeType = part.mimeType || ''

      if (mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType,
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        })
      }

      // Recurse for nested parts
      if (part.parts) {
        const nested = extractBody(part)
        if (!body) body = nested.body
        if (!bodyHtml) bodyHtml = nested.bodyHtml
        attachments.push(...nested.attachments)
      }
    }
  } else if (payload.body?.data) {
    // Single part
    const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8')
    if (payload.mimeType === 'text/html') {
      bodyHtml = decoded
    } else {
      body = decoded
    }
  }

  return { body, bodyHtml, attachments }
}

/**
 * Build RFC 2822 email message
 */
function buildEmailMessage(from: string, options: SendEmailOptions): string {
  const lines: string[] = []

  // Headers
  const toList = Array.isArray(options.to) ? options.to.join(', ') : options.to
  lines.push(`From: ${from}`)
  lines.push(`To: ${toList}`)

  if (options.cc) {
    const ccList = Array.isArray(options.cc) ? options.cc.join(', ') : options.cc
    lines.push(`Cc: ${ccList}`)
  }

  if (options.bcc) {
    const bccList = Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc
    lines.push(`Bcc: ${bccList}`)
  }

  lines.push(`Subject: ${options.subject}`)

  if (options.inReplyTo) {
    lines.push(`In-Reply-To: ${options.inReplyTo}`)
  }

  if (options.references) {
    lines.push(`References: ${options.references}`)
  }

  lines.push('MIME-Version: 1.0')

  // Body
  if (options.attachments && options.attachments.length > 0) {
    // Multipart with attachments
    const boundary = `----=_Part_${Date.now()}`
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push('')

    // Text part
    lines.push(`--${boundary}`)
    if (options.bodyHtml) {
      lines.push('Content-Type: text/html; charset=UTF-8')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(options.bodyHtml).toString('base64'))
    } else {
      lines.push('Content-Type: text/plain; charset=UTF-8')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(options.body).toString('base64'))
    }

    // Attachments
    for (const attachment of options.attachments) {
      lines.push(`--${boundary}`)
      lines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`)
      lines.push('')
      lines.push(attachment.content)
    }

    lines.push(`--${boundary}--`)
  } else if (options.bodyHtml) {
    // HTML only
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(options.bodyHtml).toString('base64'))
  } else {
    // Plain text only
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(options.body).toString('base64'))
  }

  const email = lines.join('\r\n')
  return Buffer.from(email).toString('base64url')
}

// ============================================================================
// Database Functions
// ============================================================================

/**
 * Save Gmail account to database
 */
async function saveGmailAccount(data: {
  user_id: string
  email: string
  access_token: string
  refresh_token: string
  expires_at: Date
  labels?: GmailLabel[]
}): Promise<GmailAccount> {
  const sql = getSql();
  const result = await sql`
    INSERT INTO gmail_accounts (
      user_id, email, access_token, refresh_token, expires_at, labels, sync_status
    ) VALUES (
      ${data.user_id},
      ${data.email},
      ${data.access_token},
      ${data.refresh_token},
      ${data.expires_at.toISOString()},
      ${JSON.stringify(data.labels || [])},
      'active'
    )
    ON CONFLICT (user_id, email)
    DO UPDATE SET
      access_token = ${data.access_token},
      refresh_token = ${data.refresh_token},
      expires_at = ${data.expires_at.toISOString()},
      labels = ${JSON.stringify(data.labels || [])},
      sync_status = 'active',
      error_message = NULL,
      updated_at = NOW()
    RETURNING *
  `

  return result.rows[0] as GmailAccount
}

/**
 * Get Gmail account by ID
 */
async function getGmailAccount(accountId: string): Promise<GmailAccount | null> {
  const sql = getSql();
  const result = await sql`
    SELECT * FROM gmail_accounts WHERE id = ${accountId}
  `

  return result.rows[0] as GmailAccount || null
}

/**
 * Get all Gmail accounts for a user
 */
export async function getUserGmailAccounts(userId: string): Promise<GmailAccount[]> {
  const sql = getSql();
  const result = await sql`
    SELECT * FROM gmail_accounts WHERE user_id = ${userId} ORDER BY email
  `

  return result.rows as GmailAccount[]
}

/**
 * Delete Gmail account
 */
export async function deleteGmailAccount(accountId: string): Promise<void> {
  // Stop watching first
  try {
    await stopWatch(accountId)
  } catch (error) {
    console.error('[Gmail] Failed to stop watch during deletion:', error)
  }

  const sql = getSql();
  await sql`
    DELETE FROM gmail_accounts WHERE id = ${accountId}
  `
}

/**
 * Save message to unified inbox
 */
async function saveMessageToInbox(
  accountId: string,
  userId: string,
  message: GmailMessage,
  direction: 'inbound' | 'outbound' = 'inbound'
): Promise<void> {
  const account = await getGmailAccount(accountId)
  if (!account) return

  // Extract sender email from "Name <email@domain.com>" format
  const fromMatch = message.from?.match(/<(.+?)>/) || message.from?.match(/([^\s<>]+@[^\s<>]+)/)
  const senderEmail = fromMatch ? fromMatch[1] : message.from || ''

  // Find or create conversation
  const { findOrCreateConversation, addMessage } = await import('@/lib/inbox')

  const conversation = await findOrCreateConversation({
    id: `gmail:${message.threadId}`,
    name: message.from || 'Unknown',
    email: senderEmail,
    channel: 'gmail',
  })

  // Check if message already exists
  const sql = getSql();
  const existing = await sql`
    SELECT id FROM inbox_messages_v2
    WHERE channel_message_id = ${message.id}
  `

  if (existing.rows.length > 0) {
    console.log('[Gmail] Message already exists, skipping:', message.id)
    return
  }

  // Add message to conversation
  await addMessage({
    conversation_id: conversation.id,
    content: message.body || message.snippet,
    content_html: message.bodyHtml,
    direction,
    sender_type: direction === 'inbound' ? 'contact' : 'user',
    sender_name: message.from,
    channel: 'gmail',
    channel_message_id: message.id,
  })

  // Update conversation subject if it doesn't have one
  if (message.subject && !conversation.subject) {
    const sql2 = getSql();
    await sql2`
      UPDATE inbox_conversations
      SET subject = ${message.subject}, updated_at = NOW()
      WHERE id = ${conversation.id}
    `
  }
}

/**
 * Delete message from inbox
 */
async function deleteMessageFromInbox(messageId: string): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM inbox_messages_v2 WHERE channel_message_id = ${messageId}
  `
}
