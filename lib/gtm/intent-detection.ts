/**
 * GTM Intent Detection - NLP to understand user needs
 *
 * Analyzes chat messages to detect when user wants GTM help:
 * - "I need customers"
 * - "Help me find buyers for vegetables"
 * - "Generate leads for my SaaS"
 * - "I want to sell more"
 * etc.
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface GTMIntent {
  isGTMRequest: boolean
  confidence: number // 0-1
  whatTheySell?: string
  whoTheyTarget?: string
  goal?: string // 'find_customers' | 'generate_leads' | 'close_deals' | 'other'
  userRequest: string // Original request cleaned up
}

/**
 * Detect if user wants GTM help from their message
 */
export async function detectGTMIntent(
  userMessage: string,
  conversationHistory?: string[]
): Promise<GTMIntent> {
  const prompt = `Analyze if this user wants help with GTM (go-to-market), sales, or finding customers.

User message: "${userMessage}"

${conversationHistory ? `Conversation context:\n${conversationHistory.slice(-3).join('\n')}\n` : ''}

Determine:
1. Is this a GTM/sales request? (finding customers, generating leads, closing deals, etc.)
2. What do they sell? (product/service)
3. Who do they target? (industry, title, company size)
4. What's their goal?

Common GTM phrases:
- "I need customers"
- "Help me find buyers"
- "Generate leads"
- "I want to sell more"
- "Who should I sell to"
- "Find prospects for my product"
- "Grow my business"

NOT GTM phrases:
- "What is [general question]?"
- "How do I [technical question]?"
- "Tell me about [topic]"
- "Help me understand [concept]"

Respond in JSON:
{
  "isGTMRequest": true/false,
  "confidence": 0.95,
  "whatTheySell": "vegetables" or null,
  "whoTheyTarget": "restaurants and grocery stores" or null,
  "goal": "find_customers",
  "userRequest": "Find me buyers for my vegetable distribution business"
}`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response')
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // Default to not a GTM request if can't parse
    return {
      isGTMRequest: false,
      confidence: 0,
      userRequest: userMessage,
    }
  }

  const intent = JSON.parse(jsonMatch[0])

  return {
    isGTMRequest: intent.isGTMRequest || false,
    confidence: intent.confidence || 0,
    whatTheySell: intent.whatTheySell || undefined,
    whoTheyTarget: intent.whoTheyTarget || undefined,
    goal: intent.goal || undefined,
    userRequest: intent.userRequest || userMessage,
  }
}

/**
 * Extract product/service description from conversation
 */
export async function extractProductDescription(
  conversationHistory: string[]
): Promise<string> {
  const prompt = `Based on this conversation, what does the user sell?

Conversation:
${conversationHistory.join('\n')}

Extract:
- What product/service do they sell?
- What value does it provide?
- Who is it for?

Respond with a 1-2 sentence description, or "Unknown" if not clear.`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    return 'AI-powered B2B solution'
  }

  return content.text.trim()
}

export default {
  detectGTMIntent,
  extractProductDescription,
}
