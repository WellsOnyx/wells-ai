// User Channel Integrations Library
// Allows each user to connect their own communication channels

import { sql } from '@vercel/postgres'
import { Channel, CHANNEL_INFO } from './inbox'

export interface ChannelIntegration {
  id: string
  user_id: string
  channel: Channel
  status: 'connected' | 'pending' | 'error' | 'disconnected'
  credentials: Record<string, string> // Encrypted credentials
  account_name?: string // e.g., "john@gmail.com" or "@johndoe"
  account_id?: string // Provider's user/account ID
  webhook_url?: string // For incoming webhooks
  scopes?: string[] // OAuth scopes granted
  expires_at?: Date // For tokens that expire
  last_sync_at?: Date
  error_message?: string
  created_at: Date
  updated_at: Date
}

// Integration configuration for each channel
export const INTEGRATION_CONFIG: Record<Channel, {
  authType: 'oauth' | 'api_key' | 'webhook' | 'phone'
  oauthUrl?: string
  requiredFields: string[]
  scopes?: string[]
  setupInstructions: string
}> = {
  sms: {
    authType: 'phone',
    requiredFields: ['phone_number'],
    setupInstructions: 'Enter your phone number to receive and send SMS messages via Twilio.'
  },
  imessage: {
    authType: 'api_key',
    requiredFields: ['api_key', 'api_key_id'],
    setupInstructions: 'Connect your Sendblue account to send/receive iMessages. Get your API keys from sendblue.co'
  },
  gmail: {
    authType: 'oauth',
    oauthUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    requiredFields: [],
    scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
    setupInstructions: 'Connect your Gmail account to send and receive emails.'
  },
  outlook: {
    authType: 'oauth',
    oauthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    requiredFields: [],
    scopes: ['Mail.Send', 'Mail.Read'],
    setupInstructions: 'Connect your Microsoft account to send and receive Outlook emails.'
  },
  email: {
    authType: 'api_key',
    requiredFields: ['api_key', 'from_email'],
    setupInstructions: 'Connect your Resend account for custom email sending. Get your API key from resend.com'
  },
  slack: {
    authType: 'oauth',
    oauthUrl: 'https://slack.com/oauth/v2/authorize',
    requiredFields: [],
    scopes: ['chat:write', 'channels:read', 'im:read', 'im:write'],
    setupInstructions: 'Connect your Slack workspace to send and receive messages.'
  },
  discord: {
    authType: 'webhook',
    requiredFields: ['webhook_url'],
    setupInstructions: 'Create a Discord webhook in your server settings and paste the URL here.'
  },
  twitter: {
    authType: 'oauth',
    oauthUrl: 'https://twitter.com/i/oauth2/authorize',
    requiredFields: [],
    scopes: ['dm.read', 'dm.write', 'tweet.read', 'users.read'],
    setupInstructions: 'Connect your X (Twitter) account to send and receive DMs.'
  },
  instagram: {
    authType: 'oauth',
    oauthUrl: 'https://api.instagram.com/oauth/authorize',
    requiredFields: [],
    scopes: ['instagram_business_basic', 'instagram_business_manage_messages'],
    setupInstructions: 'Connect your Instagram Business account to manage DMs.'
  },
  linkedin: {
    authType: 'oauth',
    oauthUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    requiredFields: [],
    scopes: ['r_liteprofile', 'w_member_social'],
    setupInstructions: 'Connect your LinkedIn account to send messages.'
  },
  whatsapp: {
    authType: 'phone',
    requiredFields: ['phone_number', 'business_account_id'],
    setupInstructions: 'Connect your WhatsApp Business account via Twilio.'
  },
  chat: {
    authType: 'webhook',
    requiredFields: [],
    setupInstructions: 'Website chat is automatically enabled. Embed the chat widget on your site.'
  },
  teams: {
    authType: 'webhook',
    requiredFields: ['webhook_url'],
    setupInstructions: 'Create an incoming webhook connector in your Teams channel.'
  },
  telegram: {
    authType: 'api_key',
    requiredFields: ['bot_token'],
    setupInstructions: 'Create a Telegram bot via @BotFather and paste your bot token here.'
  },
}

// Auto-migrate flag
let integrationsTableInitialized = false

// Ensure integrations table exists
async function ensureIntegrationsTable(): Promise<void> {
  if (integrationsTableInitialized) return

  try {
    const check = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'channel_integrations'
      ) as exists
    `

    if (check.rows[0].exists) {
      integrationsTableInitialized = true
      return
    }

    console.log('[Integrations] Creating tables...')

    await sql`
      CREATE TABLE IF NOT EXISTS channel_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        credentials JSONB DEFAULT '{}',
        account_name TEXT,
        account_id TEXT,
        webhook_url TEXT,
        scopes JSONB DEFAULT '[]',
        expires_at TIMESTAMP,
        last_sync_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, channel)
      )
    `

    await sql`CREATE INDEX IF NOT EXISTS idx_channel_integrations_user ON channel_integrations(user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_channel_integrations_channel ON channel_integrations(channel)`

    console.log('[Integrations] Tables created successfully')
    integrationsTableInitialized = true
  } catch (error) {
    console.error('[Integrations] Error creating tables:', error)
    integrationsTableInitialized = true
    throw error
  }
}

// Get all integrations for a user
export async function getUserIntegrations(userId: string): Promise<ChannelIntegration[]> {
  await ensureIntegrationsTable()

  const result = await sql`
    SELECT * FROM channel_integrations
    WHERE user_id = ${userId}
    ORDER BY channel
  `

  return result.rows as ChannelIntegration[]
}

// Get a specific integration
export async function getIntegration(userId: string, channel: Channel): Promise<ChannelIntegration | null> {
  await ensureIntegrationsTable()

  const result = await sql`
    SELECT * FROM channel_integrations
    WHERE user_id = ${userId} AND channel = ${channel}
  `

  return result.rows[0] as ChannelIntegration || null
}

// Connect a channel (create or update integration)
export async function connectChannel(
  userId: string,
  channel: Channel,
  credentials: Record<string, string>,
  accountName?: string,
  accountId?: string
): Promise<ChannelIntegration> {
  await ensureIntegrationsTable()

  const result = await sql`
    INSERT INTO channel_integrations (
      user_id, channel, status, credentials, account_name, account_id
    ) VALUES (
      ${userId},
      ${channel},
      'connected',
      ${JSON.stringify(credentials)},
      ${accountName || null},
      ${accountId || null}
    )
    ON CONFLICT (user_id, channel)
    DO UPDATE SET
      status = 'connected',
      credentials = ${JSON.stringify(credentials)},
      account_name = ${accountName || null},
      account_id = ${accountId || null},
      error_message = NULL,
      updated_at = NOW()
    RETURNING *
  `

  return result.rows[0] as ChannelIntegration
}

// Store OAuth tokens
export async function storeOAuthTokens(
  userId: string,
  channel: Channel,
  tokens: {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  },
  accountInfo?: {
    name?: string
    id?: string
  }
): Promise<ChannelIntegration> {
  await ensureIntegrationsTable()

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  const credentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || '',
  }

  const result = await sql`
    INSERT INTO channel_integrations (
      user_id, channel, status, credentials, account_name, account_id,
      scopes, expires_at
    ) VALUES (
      ${userId},
      ${channel},
      'connected',
      ${JSON.stringify(credentials)},
      ${accountInfo?.name || null},
      ${accountInfo?.id || null},
      ${JSON.stringify(tokens.scope?.split(' ') || [])},
      ${expiresAt}
    )
    ON CONFLICT (user_id, channel)
    DO UPDATE SET
      status = 'connected',
      credentials = ${JSON.stringify(credentials)},
      account_name = ${accountInfo?.name || null},
      account_id = ${accountInfo?.id || null},
      scopes = ${JSON.stringify(tokens.scope?.split(' ') || [])},
      expires_at = ${expiresAt},
      error_message = NULL,
      updated_at = NOW()
    RETURNING *
  `

  return result.rows[0] as ChannelIntegration
}

// Disconnect a channel
export async function disconnectChannel(userId: string, channel: Channel): Promise<void> {
  await ensureIntegrationsTable()

  await sql`
    UPDATE channel_integrations
    SET status = 'disconnected', credentials = '{}', updated_at = NOW()
    WHERE user_id = ${userId} AND channel = ${channel}
  `
}

// Update integration status/error
export async function updateIntegrationStatus(
  userId: string,
  channel: Channel,
  status: 'connected' | 'pending' | 'error' | 'disconnected',
  errorMessage?: string
): Promise<void> {
  await ensureIntegrationsTable()

  await sql`
    UPDATE channel_integrations
    SET status = ${status}, error_message = ${errorMessage || null}, updated_at = NOW()
    WHERE user_id = ${userId} AND channel = ${channel}
  `
}

// Get credentials for sending (used by inbox)
export async function getChannelCredentials(
  userId: string,
  channel: Channel
): Promise<Record<string, string> | null> {
  const integration = await getIntegration(userId, channel)

  if (!integration || integration.status !== 'connected') {
    return null
  }

  // Check if token is expired and needs refresh
  if (integration.expires_at && new Date(integration.expires_at) < new Date()) {
    // TODO: Implement token refresh
    console.log(`[Integrations] Token expired for ${channel}, needs refresh`)
    return null
  }

  return integration.credentials
}

// Generate OAuth URL for a channel
export function generateOAuthUrl(
  channel: Channel,
  userId: string,
  redirectUri: string
): string | null {
  const config = INTEGRATION_CONFIG[channel]

  if (config.authType !== 'oauth' || !config.oauthUrl) {
    return null
  }

  const state = Buffer.from(JSON.stringify({ userId, channel })).toString('base64')

  const params = new URLSearchParams({
    client_id: getClientId(channel),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: (config.scopes || []).join(' '),
    state,
  })

  // Channel-specific params
  if (channel === 'slack') {
    params.set('user_scope', (config.scopes || []).join(','))
  }

  return `${config.oauthUrl}?${params.toString()}`
}

// Get client ID from environment (these are app-level, not user-level)
function getClientId(channel: Channel): string {
  const envMap: Record<string, string> = {
    gmail: process.env.GOOGLE_CLIENT_ID || '',
    outlook: process.env.MICROSOFT_CLIENT_ID || '',
    slack: process.env.SLACK_CLIENT_ID || '',
    twitter: process.env.TWITTER_CLIENT_ID || '',
    instagram: process.env.INSTAGRAM_CLIENT_ID || '',
    linkedin: process.env.LINKEDIN_CLIENT_ID || '',
  }

  return envMap[channel] || ''
}

// Get connected channels summary for dashboard
export async function getIntegrationsSummary(userId: string): Promise<{
  connected: Channel[]
  pending: Channel[]
  available: Channel[]
}> {
  const integrations = await getUserIntegrations(userId)

  const connected: Channel[] = []
  const pending: Channel[] = []

  for (const int of integrations) {
    if (int.status === 'connected') {
      connected.push(int.channel as Channel)
    } else if (int.status === 'pending') {
      pending.push(int.channel as Channel)
    }
  }

  const allChannels = Object.keys(CHANNEL_INFO) as Channel[]
  const available = allChannels.filter(c => !connected.includes(c) && !pending.includes(c))

  return { connected, pending, available }
}
