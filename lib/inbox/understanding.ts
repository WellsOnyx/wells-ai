/**
 * Message Understanding Engine
 * Uses Claude to analyze and understand incoming messages
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  MessageIntent,
  MessageUrgency,
  MessageSentiment,
  MessageUnderstanding,
  ActionItem,
} from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function understandMessage(params: {
  body: string
  subject?: string
  senderName?: string
  senderEmail?: string
  channel: string
  threadContext?: string[]
}): Promise<MessageUnderstanding> {
  const { body, subject, senderName, senderEmail, channel, threadContext } = params

  const prompt = buildUnderstandingPrompt({
    body,
    subject,
    senderName,
    senderEmail,
    channel,
    threadContext,
  })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for consistent analysis
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Parse Claude's JSON response
    const analysis = JSON.parse(content.text)

    return {
      intent: analysis.intent as MessageIntent,
      urgency: analysis.urgency as MessageUrgency,
      sentiment: analysis.sentiment as MessageSentiment,
      entities: analysis.entities || {},
      actionItems: analysis.actionItems || [],
      requiresResponse: analysis.requiresResponse || false,
      suggestedResponse: analysis.suggestedResponse,
      summary: analysis.summary || '',
      keyTopics: analysis.keyTopics || [],
    }
  } catch (error) {
    console.error('[MESSAGE UNDERSTANDING] Error:', error)

    // Return safe defaults on error
    return {
      intent: 'unknown',
      urgency: 'normal',
      sentiment: 'neutral',
      entities: {},
      actionItems: [],
      requiresResponse: false,
      summary: body.substring(0, 200),
      keyTopics: [],
    }
  }
}

function buildUnderstandingPrompt(params: {
  body: string
  subject?: string
  senderName?: string
  senderEmail?: string
  channel: string
  threadContext?: string[]
}): string {
  const { body, subject, senderName, senderEmail, channel, threadContext } = params

  let prompt = `Analyze this incoming message and extract structured information.

**Message Details:**
- Channel: ${channel}
- From: ${senderName || 'Unknown'} ${senderEmail ? `(${senderEmail})` : ''}
${subject ? `- Subject: ${subject}` : ''}

**Message Body:**
${body}
`

  if (threadContext && threadContext.length > 0) {
    prompt += `\n**Thread Context (previous messages):**\n${threadContext.join('\n\n')}\n`
  }

  prompt += `
**Your Task:**
Analyze this message and return a JSON object with the following fields:

1. **intent** (string): Primary intent of the message. Choose from:
   - "ask_question": Sender is asking a question
   - "request_meeting": Wants to schedule a meeting/call
   - "provide_info": Sharing information or updates
   - "negotiate": Negotiating terms, pricing, or deals
   - "follow_up": Following up on previous conversation
   - "introduction": Introducing themselves or making first contact
   - "thank_you": Expressing gratitude
   - "complaint": Expressing dissatisfaction or problem
   - "urgent_request": Time-sensitive request
   - "auto_reply": Automated out-of-office or auto-response
   - "spam": Unsolicited or promotional content
   - "unknown": Cannot determine intent

2. **urgency** (string): How urgent is this message?
   - "critical": Requires immediate attention (system down, major issue)
   - "high": Should respond within hours (important question, meeting request)
   - "normal": Can respond within 1-2 days (general inquiry)
   - "low": No rush (FYI, casual conversation)

3. **sentiment** (string): Overall tone
   - "positive": Friendly, enthusiastic, grateful
   - "neutral": Professional, matter-of-fact
   - "negative": Frustrated, angry, disappointed

4. **entities** (object): Extract key information:
   - names: Array of person names mentioned
   - companies: Array of company names
   - dates: Array of dates mentioned (ISO format when possible)
   - amounts: Array of monetary amounts or quantities
   - locations: Array of places mentioned
   - products: Array of products/services discussed

5. **actionItems** (array): List of concrete action items. Each item:
   - type: "task" | "deadline" | "question" | "decision"
   - description: Clear description
   - priority: "low" | "medium" | "high"
   - dueDate: ISO date if deadline mentioned

6. **requiresResponse** (boolean): Does this message expect a reply?

7. **suggestedResponse** (string): Draft a professional, helpful response (2-3 sentences). Use Wells AI's voice: precise, confident, helpful. Only if requiresResponse is true.

8. **summary** (string): One sentence summary of the message

9. **keyTopics** (array of strings): Main topics discussed (max 5)

**Important:**
- Be accurate and objective
- Extract ALL entities mentioned
- Consider thread context when analyzing
- For auto-replies/out-of-office, set intent to "auto_reply" and requiresResponse to false
- For spam, set intent to "spam" and requiresResponse to false

Return ONLY valid JSON, no markdown formatting or explanation.
`

  return prompt
}

export async function generateThreadSummary(messages: Array<{
  role: 'sender' | 'recipient'
  name?: string
  body: string
  createdAt: Date
}>): Promise<string> {
  const threadText = messages
    .map((msg) => {
      const timestamp = msg.createdAt.toISOString()
      const sender = msg.role === 'sender' ? msg.name || 'Sender' : 'Wells'
      return `[${timestamp}] ${sender}: ${msg.body}`
    })
    .join('\n\n')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Summarize this email/message thread in 2-3 sentences. Focus on the main topic, key decisions, and current status.\n\nThread:\n${threadText}`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text
    }

    return 'Thread summary not available'
  } catch (error) {
    console.error('[THREAD SUMMARY] Error:', error)
    return 'Thread summary not available'
  }
}

export async function draftResponse(params: {
  incomingMessage: string
  intent: MessageIntent
  senderName?: string
  threadContext?: string[]
  userContext?: string
}): Promise<string> {
  const { incomingMessage, intent, senderName, threadContext, userContext } = params

  let prompt = `Draft a professional response to this message.

**Incoming Message:**
${incomingMessage}

**Context:**
- Intent: ${intent}
- Sender: ${senderName || 'Unknown'}
`

  if (threadContext && threadContext.length > 0) {
    prompt += `- Previous conversation:\n${threadContext.slice(-3).join('\n\n')}\n`
  }

  if (userContext) {
    prompt += `- Additional context: ${userContext}\n`
  }

  prompt += `
**Your Task:**
Write a response that:
1. Addresses the sender's intent directly
2. Is professional but warm
3. Uses Wells AI's voice: precise, confident, helpful
4. Is concise (2-4 sentences unless more detail needed)
5. Includes a clear next step or call-to-action if appropriate

Return ONLY the response text, no explanation or formatting.
`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text
    }

    return 'Thank you for your message. I will review this and get back to you shortly.'
  } catch (error) {
    console.error('[DRAFT RESPONSE] Error:', error)
    return 'Thank you for your message. I will review this and get back to you shortly.'
  }
}
