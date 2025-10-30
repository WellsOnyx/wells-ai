/**
 * @wells/gtm-sdk - Outreach Engine
 * AI-powered outreach generation (100 InMails/day)
 */

import Anthropic from '@anthropic-ai/sdk'
import { OutreachConfig, Prospect, OutreachMessage } from './types'

export class OutreachEngine {
  private config: OutreachConfig
  private anthropic: Anthropic

  constructor(config: OutreachConfig, anthropic: Anthropic) {
    this.config = config
    this.anthropic = anthropic
  }

  /**
   * Generate personalized outreach message using AI
   */
  async generateMessage(prospect: Prospect): Promise<OutreachMessage> {
    console.log(`[Outreach] Generating message for ${prospect.name}...`)

    const systemPrompt = `You are Wells AI, an expert at writing B2B outreach messages that convert.

Your mission: Craft a personalized, consultative message that:
1. References something specific about their company (recent news, hiring, product launch)
2. Identifies a clear pain point they likely have
3. Offers genuine value (not selling)
4. Ends with a soft CTA (ask a question, offer insight)

Tone: ${this.config.tone}
Personalization: ${this.config.personalization}

Key principles:
- No generic templates
- No "reaching out" or "just checking in"
- No feature dumps
- No hard selling
- Focus on their world, not yours

Keep it under 100 words.`

    const userPrompt = `Prospect: ${prospect.name}
Role: ${prospect.role}
Company: ${prospect.company.name} (${prospect.company.size} employees, ${prospect.company.industry})
Location: ${prospect.company.location}
${prospect.company.recentNews ? `Recent: ${prospect.company.recentNews.map(n => n.title).join(', ')}` : ''}

Generate a personalized LinkedIn InMail or email.`

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0]
    const messageBody = content.type === 'text' ? content.text : ''

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      prospectId: prospect.id,
      channel: 'linkedin',
      subject: `Quick question about ${prospect.company.name}'s ${this.config.tone === 'consultative' ? 'growth' : 'operations'}`,
      body: messageBody,
      status: 'draft',
    }
  }

  /**
   * Send batch of messages (respecting rate limits)
   */
  async sendBatch(messages: OutreachMessage[]): Promise<number> {
    console.log(`[Outreach] Sending ${messages.length} messages...`)

    // In production, integrate with:
    // - LinkedIn API
    // - Email service (SendGrid, AWS SES)
    // - Twitter DMs
    // - Phone (Twilio)

    // For demo, mark as sent
    let sent = 0
    for (const message of messages.slice(0, this.config.dailyLimit)) {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100))

      message.status = 'sent'
      message.sentAt = new Date()
      sent++
    }

    console.log(`[Outreach] Sent ${sent} messages`)

    return sent
  }
}
