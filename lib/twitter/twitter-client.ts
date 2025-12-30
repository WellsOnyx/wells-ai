// @ts-nocheck
/**
 * Twitter/X API Client for Grain & Vault
 *
 * Handles authentication, posting, DMs, and monitoring
 * Uses Twitter API v2 with OAuth 1.0a (User Context)
 */

import crypto from 'crypto'

// ============================================================================
// CONFIGURATION
// ============================================================================

const TWITTER_API_KEY = process.env.TWITTER_API_KEY || ''
const TWITTER_API_KEY_SECRET = process.env.TWITTER_API_KEY_SECRET || ''
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || ''
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || ''
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || ''

const API_BASE = 'https://api.twitter.com/2'

// ============================================================================
// OAUTH 1.0a SIGNATURE GENERATION
// ============================================================================

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')

  // Create signature base string
  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url.split('?')[0]),
    encodeURIComponent(sortedParams)
  ].join('&')

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`

  // Generate HMAC-SHA1 signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64')

  return signature
}

function generateOAuthHeader(
  method: string,
  url: string,
  additionalParams: Record<string, string> = {}
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0',
    ...additionalParams
  }

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    TWITTER_API_KEY_SECRET,
    TWITTER_ACCESS_TOKEN_SECRET
  )

  oauthParams.oauth_signature = signature

  // Build OAuth header
  const headerParams = Object.keys(oauthParams)
    .filter(key => key.startsWith('oauth_'))
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ')

  return `OAuth ${headerParams}`
}

// ============================================================================
// API REQUEST HELPERS
// ============================================================================

async function makeRequest(
  method: string,
  endpoint: string,
  body?: any,
  useBearer: boolean = false
): Promise<any> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (useBearer && TWITTER_BEARER_TOKEN) {
    headers['Authorization'] = `Bearer ${TWITTER_BEARER_TOKEN}`
  } else {
    headers['Authorization'] = generateOAuthHeader(method, url)
  }

  const options: RequestInit = {
    method,
    headers,
  }

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Twitter API] Error ${response.status}:`, errorText)
    throw new Error(`Twitter API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// ============================================================================
// TWEET FUNCTIONS
// ============================================================================

export interface TweetOptions {
  text: string
  replyTo?: string  // Tweet ID to reply to
  quoteTweetId?: string  // Tweet ID to quote
  mediaIds?: string[]  // Media IDs to attach
}

/**
 * Post a tweet
 */
export async function postTweet(options: TweetOptions): Promise<{
  id: string
  text: string
}> {
  const body: any = {
    text: options.text
  }

  if (options.replyTo) {
    body.reply = { in_reply_to_tweet_id: options.replyTo }
  }

  if (options.quoteTweetId) {
    body.quote_tweet_id = options.quoteTweetId
  }

  if (options.mediaIds?.length) {
    body.media = { media_ids: options.mediaIds }
  }

  const response = await makeRequest('POST', '/tweets', body)

  console.log(`[Twitter] Posted tweet: ${response.data.id}`)

  return {
    id: response.data.id,
    text: response.data.text
  }
}

/**
 * Delete a tweet
 */
export async function deleteTweet(tweetId: string): Promise<boolean> {
  const response = await makeRequest('DELETE', `/tweets/${tweetId}`)
  return response.data.deleted
}

/**
 * Get a tweet by ID
 */
export async function getTweet(tweetId: string): Promise<any> {
  const response = await makeRequest(
    'GET',
    `/tweets/${tweetId}?tweet.fields=created_at,public_metrics,author_id&expansions=author_id`,
    null,
    true // Use bearer token for read
  )
  return response.data
}

// ============================================================================
// USER FUNCTIONS
// ============================================================================

/**
 * Get authenticated user info
 */
export async function getMe(): Promise<{
  id: string
  name: string
  username: string
}> {
  const response = await makeRequest('GET', '/users/me')
  return response.data
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<any> {
  const response = await makeRequest(
    'GET',
    `/users/by/username/${username}?user.fields=description,public_metrics,created_at`,
    null,
    true
  )
  return response.data
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<any> {
  const response = await makeRequest(
    'GET',
    `/users/${userId}?user.fields=description,public_metrics,created_at`,
    null,
    true
  )
  return response.data
}

// ============================================================================
// DIRECT MESSAGE FUNCTIONS
// ============================================================================

export interface DMOptions {
  recipientId: string
  text: string
  attachmentUrl?: string
}

/**
 * Send a direct message
 */
export async function sendDirectMessage(options: DMOptions): Promise<{
  eventId: string
  conversationId: string
}> {
  // DM endpoint (v2)
  const body = {
    text: options.text,
    ...(options.attachmentUrl && {
      attachments: [{ media_id: options.attachmentUrl }]
    })
  }

  const response = await makeRequest(
    'POST',
    `/dm_conversations/with/${options.recipientId}/messages`,
    body
  )

  console.log(`[Twitter] Sent DM to ${options.recipientId}`)

  return {
    eventId: response.data.dm_event_id,
    conversationId: response.data.dm_conversation_id
  }
}

/**
 * Get DM conversations
 */
export async function getDMConversations(): Promise<any[]> {
  const response = await makeRequest('GET', '/dm_conversations')
  return response.data || []
}

/**
 * Get messages in a DM conversation
 */
export async function getDMMessages(conversationId: string): Promise<any[]> {
  const response = await makeRequest(
    'GET',
    `/dm_conversations/${conversationId}/dm_events`
  )
  return response.data || []
}

// ============================================================================
// SEARCH & MONITORING
// ============================================================================

export interface SearchOptions {
  query: string
  maxResults?: number
  startTime?: string  // ISO 8601 date
  endTime?: string
}

/**
 * Search recent tweets (last 7 days)
 */
export async function searchTweets(options: SearchOptions): Promise<any[]> {
  const params = new URLSearchParams({
    query: options.query,
    max_results: (options.maxResults || 10).toString(),
    'tweet.fields': 'created_at,public_metrics,author_id',
    'expansions': 'author_id',
    'user.fields': 'name,username,description'
  })

  if (options.startTime) {
    params.append('start_time', options.startTime)
  }

  if (options.endTime) {
    params.append('end_time', options.endTime)
  }

  const response = await makeRequest(
    'GET',
    `/tweets/search/recent?${params.toString()}`,
    null,
    true
  )

  return response.data || []
}

/**
 * Get mentions of the authenticated user
 */
export async function getMentions(maxResults: number = 10): Promise<any[]> {
  const me = await getMe()
  const response = await makeRequest(
    'GET',
    `/users/${me.id}/mentions?max_results=${maxResults}&tweet.fields=created_at,public_metrics,author_id`,
    null,
    true
  )
  return response.data || []
}

/**
 * Get timeline (tweets from followed users)
 */
export async function getTimeline(maxResults: number = 10): Promise<any[]> {
  const me = await getMe()
  const response = await makeRequest(
    'GET',
    `/users/${me.id}/timelines/reverse_chronological?max_results=${maxResults}&tweet.fields=created_at,public_metrics`,
    null,
    true
  )
  return response.data || []
}

// ============================================================================
// ENGAGEMENT FUNCTIONS
// ============================================================================

/**
 * Like a tweet
 */
export async function likeTweet(tweetId: string): Promise<boolean> {
  const me = await getMe()
  const response = await makeRequest('POST', `/users/${me.id}/likes`, {
    tweet_id: tweetId
  })
  return response.data.liked
}

/**
 * Retweet
 */
export async function retweet(tweetId: string): Promise<boolean> {
  const me = await getMe()
  const response = await makeRequest('POST', `/users/${me.id}/retweets`, {
    tweet_id: tweetId
  })
  return response.data.retweeted
}

/**
 * Follow a user
 */
export async function followUser(targetUserId: string): Promise<boolean> {
  const me = await getMe()
  const response = await makeRequest('POST', `/users/${me.id}/following`, {
    target_user_id: targetUserId
  })
  return response.data.following
}

// ============================================================================
// SIGNAL MONITORING (for cold start)
// ============================================================================

export interface SignalQuery {
  type: 'complaint' | 'hiring' | 'funding' | 'procurement' | 'custom'
  keywords?: string[]
  accounts?: string[]  // Accounts to monitor
}

const SIGNAL_QUERIES: Record<string, string> = {
  complaint: '("hate my ERP" OR "procurement nightmare" OR "payment failed" OR "treasury hell" OR "invoice chaos") -is:retweet',
  hiring: '("hiring" OR "we\'re looking for" OR "join our team") ("procurement" OR "treasury" OR "CFO" OR "finance") -is:retweet',
  funding: '("raised" OR "announcing" OR "series") ("funding" OR "million" OR "$M") -is:retweet',
  procurement: '("RFQ" OR "RFP" OR "vendor" OR "supplier" OR "sourcing") ("looking for" OR "need" OR "seeking") -is:retweet'
}

/**
 * Monitor Twitter for buying signals
 */
export async function monitorSignals(signal: SignalQuery): Promise<{
  tweets: any[]
  signalType: string
}> {
  let query = SIGNAL_QUERIES[signal.type] || signal.keywords?.join(' OR ') || ''

  if (signal.accounts?.length) {
    const fromAccounts = signal.accounts.map(a => `from:${a}`).join(' OR ')
    query = `(${fromAccounts}) ${query}`
  }

  const tweets = await searchTweets({ query, maxResults: 20 })

  console.log(`[Twitter] Found ${tweets.length} signals for ${signal.type}`)

  return {
    tweets,
    signalType: signal.type
  }
}

// ============================================================================
// SCHEDULED CONTENT
// ============================================================================

export interface ScheduledTweet {
  id: string
  text: string
  scheduledFor: Date
  status: 'pending' | 'posted' | 'failed'
  tweetId?: string  // Populated after posting
}

// In-memory store (would be DB in production)
const scheduledTweets: Map<string, ScheduledTweet> = new Map()

/**
 * Schedule a tweet for later
 */
export function scheduleTweet(text: string, scheduledFor: Date): ScheduledTweet {
  const id = crypto.randomUUID()
  const tweet: ScheduledTweet = {
    id,
    text,
    scheduledFor,
    status: 'pending'
  }
  scheduledTweets.set(id, tweet)
  return tweet
}

/**
 * Get pending scheduled tweets
 */
export function getPendingScheduledTweets(): ScheduledTweet[] {
  return Array.from(scheduledTweets.values())
    .filter(t => t.status === 'pending')
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
}

/**
 * Process due scheduled tweets
 */
export async function processScheduledTweets(): Promise<number> {
  const now = new Date()
  let posted = 0

  for (const tweet of scheduledTweets.values()) {
    if (tweet.status === 'pending' && tweet.scheduledFor <= now) {
      try {
        const result = await postTweet({ text: tweet.text })
        tweet.status = 'posted'
        tweet.tweetId = result.id
        posted++
      } catch (error) {
        console.error(`[Twitter] Failed to post scheduled tweet:`, error)
        tweet.status = 'failed'
      }
    }
  }

  return posted
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if Twitter is configured
 */
export function isTwitterConfigured(): boolean {
  return !!(
    TWITTER_API_KEY &&
    TWITTER_API_KEY_SECRET &&
    TWITTER_ACCESS_TOKEN &&
    TWITTER_ACCESS_TOKEN_SECRET
  )
}

/**
 * Validate credentials by fetching authenticated user
 */
export async function validateCredentials(): Promise<boolean> {
  try {
    await getMe()
    return true
  } catch {
    return false
  }
}
