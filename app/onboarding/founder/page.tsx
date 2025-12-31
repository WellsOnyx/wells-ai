'use client'

/**
 * Founder Journey Onboarding
 *
 * The Promise:
 * "Building a company is chaos. I'm here to help."
 *
 * Flow:
 * 1. The Promise - Wells as the founder's AI sidekick
 * 2. Priority Detection - Let them vent, categorize the fire
 * 3. Immediate Action - Offer concrete next step based on priority
 */

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import JourneyOnboarding, {
  JourneyConfig,
  WellsMessage,
} from '@/components/onboarding/journey/JourneyOnboarding'

// ============================================================================
// FOUNDER JOURNEY CONFIGURATION
// ============================================================================

type FounderPriority = 'hiring' | 'sourcing' | 'customers' | 'fundraising' | 'general'

function detectPriority(input: string): FounderPriority {
  const lowerInput = input.toLowerCase()

  const priorityKeywords: Record<FounderPriority, string[]> = {
    hiring: ['hire', 'hiring', 'team', 'engineer', 'cto', 'cfo', 'developer', 'talent', 'recruit', 'employee', 'co-founder'],
    sourcing: ['supplier', 'manufacturer', 'source', 'production', 'units', 'inventory', 'vendor', 'parts', 'materials', 'factory'],
    customers: ['customer', 'client', 'sales', 'revenue', 'leads', 'growth', 'marketing', 'b2b', 'enterprise'],
    fundraising: ['investor', 'funding', 'raise', 'capital', 'vc', 'angel', 'series', 'pitch', 'valuation'],
    general: [],
  }

  for (const [priority, keywords] of Object.entries(priorityKeywords)) {
    if (priority !== 'general' && keywords.some(kw => lowerInput.includes(kw))) {
      return priority as FounderPriority
    }
  }

  return 'general'
}

function getPriorityResponse(priority: FounderPriority, input: string): WellsMessage[] {
  const responses: Record<FounderPriority, WellsMessage[]> = {
    hiring: [
      {
        id: 'priority-1',
        content: `**Hiring.** Got it. That's usually the hardest part.\n\n"${input}"`,
        delay: 0,
        typing: true,
      },
      {
        id: 'priority-2',
        content: `Here's how I help founders hire:\n\n- I source candidates from my network (not job boards)\n- I screen and qualify before you see them\n- I handle scheduling and initial outreach\n\n**You just do final interviews with the best ones.**`,
        delay: 2000,
        typing: true,
        highlight: true,
      },
    ],
    sourcing: [
      {
        id: 'priority-1',
        content: `**Sourcing and production.** Classic founder challenge.\n\n"${input}"`,
        delay: 0,
        typing: true,
      },
      {
        id: 'priority-2',
        content: `I've got a network of verified suppliers and manufacturers.\n\n- I find factories that can actually deliver\n- I get competitive quotes fast\n- I negotiate pricing and terms\n\n**You just approve the deal.**`,
        delay: 2000,
        typing: true,
        highlight: true,
      },
    ],
    customers: [
      {
        id: 'priority-1',
        content: `**Finding customers.** The lifeblood of any startup.\n\n"${input}"`,
        delay: 0,
        typing: true,
      },
      {
        id: 'priority-2',
        content: `Here's what I do for customer acquisition:\n\n- I identify companies that fit your ICP\n- I find the right decision makers\n- I craft personalized outreach\n- I book qualified meetings\n\n**You just close the deals.**`,
        delay: 2000,
        typing: true,
        highlight: true,
      },
    ],
    fundraising: [
      {
        id: 'priority-1',
        content: `**Fundraising.** The never-ending founder quest.\n\n"${input}"`,
        delay: 0,
        typing: true,
      },
      {
        id: 'priority-2',
        content: `I can help with investor outreach:\n\n- I identify VCs and angels who invest in your space\n- I find warm intro paths through my network\n- I help craft your pitch narrative\n\n**You just take the meetings.**`,
        delay: 2000,
        typing: true,
        highlight: true,
      },
    ],
    general: [
      {
        id: 'priority-1',
        content: `I hear you. Founder life is intense.\n\n"${input}"`,
        delay: 0,
        typing: true,
      },
      {
        id: 'priority-2',
        content: `I can help with the big ones:\n\n- **Hiring** - Find and qualify candidates\n- **Sourcing** - Find suppliers and negotiate deals\n- **Customers** - Find leads and book meetings\n- **Fundraising** - Identify and intro to investors\n\nWhich fire should we tackle first?`,
        delay: 2000,
        typing: true,
      },
    ],
  }

  return responses[priority]
}

function getActionPrompt(priority: FounderPriority): { placeholder: string; prompts: string[] } {
  const prompts: Record<FounderPriority, { placeholder: string; prompts: string[] }> = {
    hiring: {
      placeholder: "Describe your ideal candidate...",
      prompts: [
        "Senior backend engineer, 5+ years, knows Python",
        "VP of Sales with B2B SaaS experience",
        "Founding engineer who can wear many hats",
      ],
    },
    sourcing: {
      placeholder: "What do you need made or sourced?",
      prompts: [
        "Need 10,000 units of custom packaging",
        "Looking for electronics manufacturer in Asia",
        "Need a co-packer for food products",
      ],
    },
    customers: {
      placeholder: "Describe your ideal customer...",
      prompts: [
        "Series B+ SaaS companies, 100-500 employees",
        "E-commerce brands doing $10M+ revenue",
        "Manufacturing companies with procurement teams",
      ],
    },
    fundraising: {
      placeholder: "Tell me about your raise...",
      prompts: [
        "Raising $2M seed, B2B SaaS in logistics",
        "Pre-seed, have MVP and early traction",
        "Series A, $5M ARR, need growth capital",
      ],
    },
    general: {
      placeholder: "What's your most urgent priority?",
      prompts: [
        "I need to hire a CTO",
        "Need to find manufacturing partners",
        "Looking for enterprise customers",
      ],
    },
  }

  return prompts[priority]
}

function createFounderConfig(): JourneyConfig {
  let detectedPriority: FounderPriority = 'general'

  return {
    journey: 'founder',
    accentColor: 'from-amber-500 to-orange-500',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    bgGradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
    phases: [
      // Phase 1: The Promise
      {
        id: 'promise',
        type: 'promise',
        messages: [
          {
            id: 'promise-1',
            content: "Building a company is chaos. I'm here to help.",
            delay: 500,
            typing: true,
            highlight: true,
          },
          {
            id: 'promise-2',
            content: "**Need to hire a CTO?** I'll find candidates and handle outreach.",
            delay: 2500,
            typing: true,
          },
          {
            id: 'promise-3',
            content: "**Need suppliers for 10,000 units?** I'll source and negotiate.",
            delay: 4000,
            typing: true,
          },
          {
            id: 'promise-4',
            content: "**Need customers?** I'll find and qualify leads.",
            delay: 5500,
            typing: true,
          },
          {
            id: 'promise-5',
            content: "So, **what's your most urgent fire?**",
            delay: 7000,
            typing: true,
            action: {
              type: 'button',
              label: 'Tell Wells',
            },
          },
        ],
      },

      // Phase 2: Priority Detection
      {
        id: 'priority',
        type: 'demo',
        showInput: true,
        inputPlaceholder: "What's keeping you up at night?",
        suggestedPrompts: [
          "I desperately need to hire engineers",
          "Need to find a manufacturer for our product",
          "We need more customers, fast",
          "Trying to close our seed round",
        ],
        messages: [
          {
            id: 'priority-1',
            content: "I work best when you're specific.\n\n**What's the biggest challenge you're facing right now?**\n\nJust vent. I'll figure out how to help.",
            delay: 500,
            typing: true,
          },
        ],
        onUserInput: async (input: string): Promise<WellsMessage[]> => {
          await new Promise(resolve => setTimeout(resolve, 1500))

          detectedPriority = detectPriority(input)
          return getPriorityResponse(detectedPriority, input)
        },
      },

      // Phase 3: Immediate Action
      {
        id: 'action',
        type: 'action',
        showInput: true,
        inputPlaceholder: "Give me the details...",
        suggestedPrompts: [
          "Let me describe what I need...",
        ],
        messages: [
          {
            id: 'action-1',
            content: "Let's get started right now.\n\n**Give me the details** and I'll start working on this immediately.",
            delay: 500,
            typing: true,
          },
        ],
        onUserInput: async (input: string): Promise<WellsMessage[]> => {
          await new Promise(resolve => setTimeout(resolve, 1000))

          const priorityActions: Record<FounderPriority, string> = {
            hiring: "I'll start sourcing candidates that match this profile. You'll see the first batch in your dashboard soon.",
            sourcing: "I'll reach out to my supplier network and get you quotes. Expect updates in your inbox.",
            customers: "I'll build a target list and start identifying decision makers. You'll see qualified leads soon.",
            fundraising: "I'll map out relevant investors and look for warm intro paths. I'll share what I find.",
            general: "I'll start working on this right away. Check your dashboard for updates.",
          }

          return [
            {
              id: 'action-response',
              content: `**On it.**\n\n"${input}"\n\n${priorityActions[detectedPriority]}\n\nLet me set up your founder command center.`,
              delay: 0,
              typing: true,
            },
          ]
        },
      },

      // Phase 4: Transition
      {
        id: 'transition',
        type: 'transition',
        autoAdvanceAfter: 3000,
        messages: [
          {
            id: 'transition-1',
            content: "Taking you to your founder dashboard...\n\nThis is your command center for hiring, sourcing, sales, and everything else.",
            delay: 500,
            typing: true,
          },
        ],
      },
    ],
  }
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function FounderOnboardingPage() {
  const router = useRouter()
  const config = createFounderConfig()

  const handleComplete = useCallback((data: Record<string, any>) => {
    // Store the journey data
    if (typeof window !== 'undefined') {
      localStorage.setItem('wells_journey', 'founder')
      localStorage.setItem('wells_onboarding_data', JSON.stringify(data))
    }

    // Redirect to founder command center
    router.push('/command?journey=founder')
  }, [router])

  return <JourneyOnboarding config={config} onComplete={handleComplete} />
}
