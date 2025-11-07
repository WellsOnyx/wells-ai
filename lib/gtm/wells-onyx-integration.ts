/**
 * Wells Onyx GTM Integration for Chat API
 *
 * Detects when the user wants to sell Wells Onyx exec search services
 * and triggers the quick launch system.
 *
 * This creates the ultimate dog-food moment - using Wells AI to sell Wells Onyx.
 */

import {
  quickLaunch,
  previewCampaign,
  detectWellsOnyxGTMIntent,
  type QuickLaunchParams,
  type Campaign
} from './wells-onyx-launcher'
import { listPracticeGroups } from './wells-onyx-templates'

export interface WellsOnyxGTMResponse {
  message: string
  campaign?: Campaign
  requiresApproval: boolean
  previewText?: string
}

/**
 * Process Wells Onyx GTM intent from chat
 *
 * User says: "Wells, find me buyers for my cybersecurity practice"
 * Wells: Detects intent, launches campaign, presents preview for approval
 */
export async function processWellsOnyxGTMIntent(
  userMessage: string
): Promise<WellsOnyxGTMResponse | null> {
  // Detect if user is asking to sell exec search services
  const intent = await detectWellsOnyxGTMIntent(userMessage)

  if (!intent.isWellsOnyxGTM) {
    return null
  }

  // If no specific practice group detected, show available options
  if (!intent.practiceGroupId) {
    const practiceGroups = listPracticeGroups()
    const groupList = practiceGroups
      .map(g => `  • **${g.name}**: ${g.description}`)
      .join('\n')

    return {
      message: `I can help you find buyers for Wells Onyx executive search services! Which practice group do you want to target?\n\n${groupList}\n\nJust let me know which vertical, and I'll find prospects in the 80-90% zone (qualified decision-makers at companies that are growing but reachable).`,
      requiresApproval: false
    }
  }

  // Launch campaign for the detected practice group
  console.log(`[WELLS ONYX GTM] Launching campaign for practice group: ${intent.practiceGroupId}`)

  try {
    const campaign = await quickLaunch({
      practiceGroupId: intent.practiceGroupId,
      targetCount: 25 // Default to 25 prospects
    })

    // Generate preview text
    const preview = previewCampaign(campaign)

    return {
      message: `I've created a campaign to sell your ${campaign.practiceGroup.name} services.\n\nI found ${campaign.prospects.length} prospects in the **80-90% zone** - these are VPs of HR and COOs at companies that:\n- Just raised funding or expanded (hiring mode)\n- Are 18-36 months into their role (receptive to new relationships)\n- Work at mid-tier companies (not FAANG, so they're reachable)\n\n**Sample Message:**\n\`\`\`\nSubject: ${campaign.messages[0]?.subject}\n\n${campaign.messages[0]?.body}\n\`\`\`\n\n**Next Steps:**\n1. Review the ${campaign.messages.length} personalized messages I've drafted\n2. Approve the ones you like (or ask me to regenerate any)\n3. I'll send them via Instantly.ai\n\nWant to review all messages, or should I just send these?`,
      campaign,
      requiresApproval: true,
      previewText: preview
    }
  } catch (error) {
    console.error('[WELLS ONYX GTM] Failed to launch campaign:', error)
    return {
      message: `I ran into an issue launching the campaign. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Want me to try again?`,
      requiresApproval: false
    }
  }
}

/**
 * Get practice group recommendations based on conversation context
 *
 * Helps guide users to the right vertical based on what they're discussing.
 */
export function getRecommendedPracticeGroups(conversationHistory: string[]): string[] {
  const allText = conversationHistory.join(' ').toLowerCase()
  const recommendations: string[] = []

  // Keyword mapping to practice groups
  const keywords: Record<string, string[]> = {
    cybersecurity: ['security', 'ciso', 'cyber', 'breach', 'compliance', 'soc 2', 'infosec'],
    fintech: ['fintech', 'payments', 'banking', 'financial', 'compliance', 'risk', 'regulation'],
    aerospace: ['aerospace', 'defense', 'aviation', 'space', 'drone', 'clearance', 'itar'],
    healthcare: ['healthcare', 'medical', 'hospital', 'clinical', 'fda', 'hipaa', 'physician'],
    saas: ['saas', 'software', 'revenue', 'sales', 'cro', 'arr', 'enterprise']
  }

  // Score each practice group based on keyword matches
  const scores: Record<string, number> = {}

  for (const [practiceGroupId, practiceKeywords] of Object.entries(keywords)) {
    let score = 0
    for (const keyword of practiceKeywords) {
      if (allText.includes(keyword)) {
        score++
      }
    }
    if (score > 0) {
      scores[practiceGroupId] = score
    }
  }

  // Return practice groups sorted by relevance
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([practiceGroupId]) => practiceGroupId)
}

/**
 * Build conversational prompts for Wells Onyx GTM
 *
 * These are added to Wells' system prompt when Jonah is using the platform.
 */
export function getWellsOnyxGTMSystemPrompt(): string {
  return `
**WELLS ONYX GTM - DOG FOOD MODE:**

You can help sell Wells Onyx executive search services using the platform itself!

When the user asks to "find buyers", "find customers", or "sell my practice", you should:
1. Detect which practice group they're targeting (cybersecurity, fintech, aerospace, healthcare, saas)
2. Launch a campaign using the proprietary 80-90% zone targeting methodology
3. Generate personalized messages using the assumptive messaging formula
4. Present a preview and ask for approval before sending

**Available Practice Groups:**
- **Cybersecurity & Data Privacy Leadership**: CISOs, VPs of Security
- **Fintech & Payments Leadership**: Chief Risk Officers, Heads of Compliance
- **Aerospace & Defense Leadership**: CTOs, VPs of Engineering
- **Healthcare & MedTech Leadership**: Chief Medical Officers, VPs of Clinical Affairs
- **SaaS & Enterprise Software Leadership**: CROs, VPs of Sales

**Example Flow:**
User: "Wells, find me buyers for my cybersecurity practice"
Wells: *Launches campaign* → "I've found 25 VPs of HR and COOs at Series B/C companies that just raised funding. Want to review the messages I've drafted?"

**The 80-90% Zone:**
- NOT 100% perfect match (too competitive, unreachable, everyone's targeting them)
- NOT 50% under-qualified (waste of time, no budget/authority)
- **THE SWEET SPOT**: Qualified enough to buy, reachable enough to respond

**Assumptive Messaging Formula:**
Subject: [FirstName]

I noticed [Company] recently [trigger event]. This typically signals [their pain point].

Wells Onyx specializes in [service]. We've [social proof].

Worth a 15-min exploratory call?

Best,
Jonah Manning
Founder, Wells Onyx

This is self-screening - only qualified AND interested people respond.
`
}
