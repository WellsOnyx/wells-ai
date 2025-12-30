// @ts-nocheck
/**
 * Twitter Handler for WellsAI Chat
 *
 * Conversational interface for Twitter/X operations.
 * Everything through chat - no dashboards needed.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  postTweet,
  sendDirectMessage,
  searchTweets,
  getMentions,
  monitorSignals,
  getUserByUsername,
  likeTweet,
  retweet,
  followUser,
  scheduleTweet,
  getPendingScheduledTweets,
  isTwitterConfigured,
  validateCredentials,
  SignalQuery
} from './twitter-client'
import { query } from '@/lib/db'

const anthropic = new Anthropic()

// ============================================================================
// TYPES
// ============================================================================

export interface TwitterIntent {
  intent:
    | 'post_tweet'
    | 'send_dm'
    | 'search'
    | 'monitor_signals'
    | 'get_mentions'
    | 'engage'  // like, retweet, follow
    | 'schedule_tweet'
    | 'view_scheduled'
    | 'check_status'
    | 'draft_content'
    | 'unknown'
  confidence: number
  entities: {
    tweetContent?: string
    dmRecipient?: string
    dmContent?: string
    searchQuery?: string
    signalType?: 'complaint' | 'hiring' | 'funding' | 'procurement'
    engageType?: 'like' | 'retweet' | 'follow'
    targetTweetId?: string
    targetUsername?: string
    scheduledTime?: string
    contentTopic?: string
  }
}

export interface TwitterResponse {
  message: string
  data?: any
  suggestions?: string[]
  requiresConfirmation?: boolean
  pendingAction?: any
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

async function classifyTwitterIntent(
  message: string,
  context?: any
): Promise<TwitterIntent> {
  const systemPrompt = `You are classifying user intent for a Twitter/X management system.

Available intents:
- post_tweet: User wants to post a tweet
- send_dm: User wants to send a direct message
- search: User wants to search tweets
- monitor_signals: User wants to find leads/signals (complaints, hiring, funding, procurement)
- get_mentions: User wants to see mentions/replies
- engage: User wants to like, retweet, or follow
- schedule_tweet: User wants to schedule a tweet for later
- view_scheduled: User wants to see scheduled tweets
- check_status: User wants to check Twitter connection status
- draft_content: User wants AI to draft Twitter content
- unknown: Can't determine intent

Extract relevant entities based on the message.

Respond in JSON format:
{
  "intent": "intent_name",
  "confidence": 0.0-1.0,
  "entities": {
    "tweetContent": "content to tweet if mentioned",
    "dmRecipient": "username for DM",
    "dmContent": "DM content",
    "searchQuery": "search terms",
    "signalType": "complaint|hiring|funding|procurement if monitoring",
    "engageType": "like|retweet|follow",
    "targetTweetId": "tweet ID if mentioned",
    "targetUsername": "username if mentioned",
    "scheduledTime": "time if scheduling",
    "contentTopic": "topic for drafting content"
  }
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Classify this message: "${message}"\n\nContext: ${JSON.stringify(context || {})}`
      }
    ]
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('[Twitter Handler] Failed to parse intent:', e)
  }

  return { intent: 'unknown', confidence: 0.5, entities: {} }
}

// ============================================================================
// CONTENT GENERATION
// ============================================================================

async function draftTweetContent(
  topic: string,
  context?: any
): Promise<string[]> {
  const systemPrompt = `You are the social media voice for Grain & Vault, an AI-native treasury platform.

Brand voice:
- Professional but approachable
- Confident without being arrogant
- Clear and direct
- Occasional wit, never corny

Topics we post about:
- Treasury innovation
- Stablecoin payments
- CFO/Finance team challenges
- Enterprise AI
- Payment infrastructure
- B2B fintech

Rules:
- Max 280 characters per tweet
- No hashtag spam (max 2 relevant ones)
- No emojis unless they add meaning
- Focus on value, not hype

Generate 3 tweet options for the given topic.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Draft tweets about: ${topic}\n\nAdditional context: ${JSON.stringify(context || {})}`
      }
    ]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Extract tweets from response
  const tweets = text
    .split(/\d\.|Option \d|Tweet \d/i)
    .map(t => t.trim())
    .filter(t => t.length > 10 && t.length <= 280)
    .slice(0, 3)

  return tweets.length > 0 ? tweets : [text.slice(0, 280)]
}

async function draftDMContent(
  recipient: string,
  purpose: string,
  context?: any
): Promise<string> {
  const systemPrompt = `You are drafting a Twitter DM for Grain & Vault outreach.

Guidelines:
- Personal and human
- Get to the point quickly
- Clear value proposition
- Soft CTA (never pushy)
- Under 500 characters

This is cold outreach, so be respectful of their time.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Draft a DM to ${recipient}.\n\nPurpose: ${purpose}\n\nContext: ${JSON.stringify(context || {})}`
      }
    ]
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handleTwitterMessage(
  userId: string,
  sessionId: string,
  message: string,
  context?: any
): Promise<TwitterResponse> {
  // Check configuration
  if (!isTwitterConfigured()) {
    return {
      message: "Twitter isn't fully configured yet. I have the API keys, but we still need the Access Token and Access Token Secret. These are generated when you authenticate the @GrainAndVault account through Twitter's OAuth flow.\n\nWant me to explain how to get those?",
      suggestions: [
        'How do I get access tokens?',
        'Skip Twitter for now'
      ]
    }
  }

  // Classify intent
  const intent = await classifyTwitterIntent(message, context)
  console.log(`[Twitter Handler] Intent: ${intent.intent} (${intent.confidence})`)

  // Route to appropriate handler
  switch (intent.intent) {
    case 'post_tweet':
      return handlePostTweet(intent.entities)

    case 'send_dm':
      return handleSendDM(intent.entities)

    case 'search':
      return handleSearch(intent.entities)

    case 'monitor_signals':
      return handleMonitorSignals(intent.entities)

    case 'get_mentions':
      return handleGetMentions()

    case 'engage':
      return handleEngage(intent.entities)

    case 'schedule_tweet':
      return handleScheduleTweet(intent.entities)

    case 'view_scheduled':
      return handleViewScheduled()

    case 'check_status':
      return handleCheckStatus()

    case 'draft_content':
      return handleDraftContent(intent.entities)

    default:
      return {
        message: "I can help you with Twitter! Here's what I can do:\n\n" +
          "**Post & Schedule**\n" +
          "- Post tweets\n" +
          "- Schedule tweets for later\n" +
          "- Draft content on any topic\n\n" +
          "**Outreach**\n" +
          "- Send DMs to prospects\n" +
          "- Find leads via signal monitoring\n\n" +
          "**Engage**\n" +
          "- Search tweets\n" +
          "- See mentions\n" +
          "- Like, retweet, follow\n\n" +
          "What would you like to do?",
        suggestions: [
          'Draft a tweet about treasury innovation',
          'Find procurement leads on Twitter',
          'Check who mentioned us'
        ]
      }
  }
}

// ============================================================================
// INTENT HANDLERS
// ============================================================================

async function handlePostTweet(entities: any): Promise<TwitterResponse> {
  const { tweetContent } = entities

  if (!tweetContent) {
    return {
      message: "What would you like to tweet? I can draft something if you give me a topic.",
      suggestions: [
        'Draft something about stablecoins',
        'Post: Just shipped a major update to our treasury SDK'
      ]
    }
  }

  // Confirm before posting
  return {
    message: `Ready to post:\n\n"${tweetContent}"\n\n(${tweetContent.length}/280 characters)\n\nShould I post this?`,
    requiresConfirmation: true,
    pendingAction: {
      type: 'post_tweet',
      content: tweetContent
    },
    suggestions: ['Yes, post it', 'Edit it first', 'Draft alternatives']
  }
}

async function handleSendDM(entities: any): Promise<TwitterResponse> {
  const { dmRecipient, dmContent } = entities

  if (!dmRecipient) {
    return {
      message: "Who would you like to DM? Give me their Twitter username.",
      suggestions: ['@username', 'Find leads first']
    }
  }

  // Look up user
  try {
    const user = await getUserByUsername(dmRecipient.replace('@', ''))

    if (!dmContent) {
      // Draft a DM
      const draft = await draftDMContent(
        user.name || dmRecipient,
        'introduce Grain & Vault'
      )

      return {
        message: `Found **${user.name}** (@${user.username})\n\n${user.description ? `Bio: ${user.description}\n\n` : ''}Here's a draft DM:\n\n"${draft}"\n\nSend this or edit?`,
        requiresConfirmation: true,
        pendingAction: {
          type: 'send_dm',
          recipientId: user.id,
          content: draft
        },
        suggestions: ['Send it', 'Make it shorter', 'More personal']
      }
    }

    return {
      message: `Ready to DM **${user.name}** (@${user.username}):\n\n"${dmContent}"\n\nSend?`,
      requiresConfirmation: true,
      pendingAction: {
        type: 'send_dm',
        recipientId: user.id,
        content: dmContent
      },
      suggestions: ['Yes, send', 'Edit first']
    }
  } catch (error) {
    return {
      message: `Couldn't find user @${dmRecipient}. Double-check the username?`,
      suggestions: ['Try another username', 'Search for them']
    }
  }
}

async function handleSearch(entities: any): Promise<TwitterResponse> {
  const { searchQuery } = entities

  if (!searchQuery) {
    return {
      message: "What would you like to search for?",
      suggestions: [
        'Search: treasury management',
        'Search: CFO hiring',
        'Find complaints about ERPs'
      ]
    }
  }

  try {
    const tweets = await searchTweets({ query: searchQuery, maxResults: 10 })

    if (tweets.length === 0) {
      return {
        message: `No recent tweets found for "${searchQuery}". Try different keywords?`,
        suggestions: ['Broaden search', 'Try signal monitoring']
      }
    }

    const results = tweets.map((t: any, i: number) =>
      `${i + 1}. @${t.author_id}: "${t.text.slice(0, 100)}..."`
    ).join('\n\n')

    return {
      message: `Found ${tweets.length} tweets for "${searchQuery}":\n\n${results}`,
      data: tweets,
      suggestions: [
        'Search for something else',
        'Engage with these tweets',
        'Find more like #1'
      ]
    }
  } catch (error) {
    return {
      message: "Search failed. Twitter API might be rate limited. Try again in a minute?",
      suggestions: ['Try again', 'Do something else']
    }
  }
}

async function handleMonitorSignals(entities: any): Promise<TwitterResponse> {
  const signalType = entities.signalType || 'procurement'

  try {
    const signals = await monitorSignals({ type: signalType as any })

    if (signals.tweets.length === 0) {
      return {
        message: `No ${signalType} signals found in the last 7 days. Want to try a different signal type?`,
        suggestions: [
          'Find complaints instead',
          'Look for hiring signals',
          'Search funding announcements'
        ]
      }
    }

    const results = signals.tweets.slice(0, 5).map((t: any, i: number) =>
      `${i + 1}. "${t.text.slice(0, 120)}..."\n   Engagement: ${t.public_metrics?.like_count || 0} likes`
    ).join('\n\n')

    return {
      message: `**${signalType.charAt(0).toUpperCase() + signalType.slice(1)} Signals** (${signals.tweets.length} found):\n\n${results}`,
      data: signals.tweets,
      suggestions: [
        'Draft DMs to these leads',
        'Find more signals',
        'Export to cold start'
      ]
    }
  } catch (error) {
    return {
      message: "Couldn't fetch signals. Try again?",
      suggestions: ['Try again', 'Search manually']
    }
  }
}

async function handleGetMentions(): Promise<TwitterResponse> {
  try {
    const mentions = await getMentions(10)

    if (mentions.length === 0) {
      return {
        message: "No recent mentions. Time to post something engaging!",
        suggestions: ['Draft a tweet', 'Find conversations to join']
      }
    }

    const results = mentions.map((t: any, i: number) =>
      `${i + 1}. "${t.text.slice(0, 100)}..."`
    ).join('\n\n')

    return {
      message: `**Recent Mentions** (${mentions.length}):\n\n${results}`,
      data: mentions,
      suggestions: ['Reply to #1', 'Like all mentions', 'Draft responses']
    }
  } catch (error) {
    return {
      message: "Couldn't fetch mentions. API might be rate limited.",
      suggestions: ['Try again', 'Do something else']
    }
  }
}

async function handleEngage(entities: any): Promise<TwitterResponse> {
  const { engageType, targetTweetId, targetUsername } = entities

  if (!engageType) {
    return {
      message: "How would you like to engage? I can like tweets, retweet, or follow users.",
      suggestions: ['Like a tweet', 'Follow @username', 'Retweet']
    }
  }

  if (engageType === 'follow' && targetUsername) {
    try {
      const user = await getUserByUsername(targetUsername.replace('@', ''))
      await followUser(user.id)
      return {
        message: `Now following @${user.username}!`,
        suggestions: ['Follow more', 'Send them a DM', 'Done']
      }
    } catch (error) {
      return {
        message: `Couldn't follow @${targetUsername}. They might have blocked us or the account doesn't exist.`,
        suggestions: ['Try another user']
      }
    }
  }

  if ((engageType === 'like' || engageType === 'retweet') && targetTweetId) {
    try {
      if (engageType === 'like') {
        await likeTweet(targetTweetId)
        return { message: 'Liked!', suggestions: ['Engage more', 'Done'] }
      } else {
        await retweet(targetTweetId)
        return { message: 'Retweeted!', suggestions: ['Engage more', 'Done'] }
      }
    } catch (error) {
      return {
        message: `Couldn't ${engageType} that tweet. It might have been deleted.`,
        suggestions: ['Try another tweet']
      }
    }
  }

  return {
    message: `To ${engageType}, I need ${engageType === 'follow' ? 'a username' : 'a tweet ID'}. Which one?`,
    suggestions: []
  }
}

async function handleScheduleTweet(entities: any): Promise<TwitterResponse> {
  const { tweetContent, scheduledTime } = entities

  if (!tweetContent) {
    return {
      message: "What would you like to schedule? Give me the content and when to post.",
      suggestions: [
        'Schedule "Big announcement coming" for tomorrow 9am',
        'Draft something to schedule'
      ]
    }
  }

  // Parse time (simplified - would use proper date parsing in production)
  let scheduleDate = new Date()
  if (scheduledTime?.includes('tomorrow')) {
    scheduleDate.setDate(scheduleDate.getDate() + 1)
  }
  if (scheduledTime?.includes('9am') || scheduledTime?.includes('9 am')) {
    scheduleDate.setHours(9, 0, 0, 0)
  }

  const scheduled = scheduleTweet(tweetContent, scheduleDate)

  return {
    message: `Scheduled for ${scheduleDate.toLocaleString()}:\n\n"${tweetContent}"\n\nI'll post it automatically.`,
    data: scheduled,
    suggestions: ['Schedule another', 'View all scheduled', 'Done']
  }
}

async function handleViewScheduled(): Promise<TwitterResponse> {
  const pending = getPendingScheduledTweets()

  if (pending.length === 0) {
    return {
      message: "No tweets scheduled. Want to schedule one?",
      suggestions: ['Schedule a tweet', 'Draft content first']
    }
  }

  const list = pending.map((t, i) =>
    `${i + 1}. "${t.text.slice(0, 50)}..." - ${t.scheduledFor.toLocaleString()}`
  ).join('\n')

  return {
    message: `**Scheduled Tweets** (${pending.length}):\n\n${list}`,
    data: pending,
    suggestions: ['Cancel #1', 'Schedule more', 'Done']
  }
}

async function handleCheckStatus(): Promise<TwitterResponse> {
  try {
    const valid = await validateCredentials()

    if (valid) {
      return {
        message: "Twitter is connected and working. Ready to post, DM, and monitor.",
        suggestions: ['Post a tweet', 'Find leads', 'Check mentions']
      }
    } else {
      return {
        message: "Twitter credentials aren't working. The API keys are set, but access tokens might be missing or expired.",
        suggestions: ['How do I fix this?']
      }
    }
  } catch (error) {
    return {
      message: "Couldn't connect to Twitter. Check if credentials are configured correctly.",
      suggestions: ['What credentials do I need?']
    }
  }
}

async function handleDraftContent(entities: any): Promise<TwitterResponse> {
  const { contentTopic } = entities

  if (!contentTopic) {
    return {
      message: "What topic should I draft about?",
      suggestions: [
        'Treasury automation',
        'Stablecoin payments',
        'CFO challenges',
        'B2B fintech trends'
      ]
    }
  }

  const drafts = await draftTweetContent(contentTopic)

  return {
    message: `Here are 3 options about "${contentTopic}":\n\n` +
      drafts.map((d, i) => `**Option ${i + 1}:**\n"${d}"\n(${d.length}/280)`).join('\n\n'),
    data: drafts,
    suggestions: ['Post option 1', 'Post option 2', 'Post option 3', 'Try different angle']
  }
}

// ============================================================================
// CONFIRMATION HANDLER
// ============================================================================

export async function executeTwitterAction(
  action: any
): Promise<TwitterResponse> {
  switch (action.type) {
    case 'post_tweet':
      try {
        const result = await postTweet({ text: action.content })
        return {
          message: `Posted! Tweet ID: ${result.id}\n\nhttps://twitter.com/i/status/${result.id}`,
          data: result,
          suggestions: ['Post another', 'Done']
        }
      } catch (error) {
        return {
          message: "Failed to post. Twitter might be having issues.",
          suggestions: ['Try again', 'Edit and retry']
        }
      }

    case 'send_dm':
      try {
        const result = await sendDirectMessage({
          recipientId: action.recipientId,
          text: action.content
        })
        return {
          message: "DM sent!",
          data: result,
          suggestions: ['Send more DMs', 'Done']
        }
      } catch (error) {
        return {
          message: "Couldn't send DM. They might have DMs closed or we might be rate limited.",
          suggestions: ['Try someone else', 'Done']
        }
      }

    default:
      return {
        message: "Unknown action. What would you like to do?",
        suggestions: ['Post a tweet', 'Send a DM']
      }
  }
}
