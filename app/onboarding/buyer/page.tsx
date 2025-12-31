'use client'

/**
 * Buyer Journey Onboarding
 *
 * The Promise:
 * "I'm going to change how you source products."
 *
 * Flow:
 * 1. The Promise - Wells explains the value
 * 2. Quick Wins Demo - Show power with ONE example
 * 3. First Real Request - Transition to actual sourcing
 */

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import JourneyOnboarding, {
  JourneyConfig,
  WellsMessage,
} from '@/components/onboarding/journey/JourneyOnboarding'

// ============================================================================
// BUYER JOURNEY CONFIGURATION
// ============================================================================

function createBuyerConfig(): JourneyConfig {
  return {
    journey: 'buyer',
    accentColor: 'from-blue-500 to-cyan-500',
    glowColor: 'rgba(6, 182, 212, 0.3)',
    bgGradient: 'from-cyan-500/10 via-blue-500/5 to-transparent',
    phases: [
      // Phase 1: The Promise
      {
        id: 'promise',
        type: 'promise',
        messages: [
          {
            id: 'promise-1',
            content: "I'm going to change how you source products.",
            delay: 500,
            typing: true,
            highlight: true,
          },
          {
            id: 'promise-2',
            content: "**No more cold calls.** No more bid sheets. No more vendor management headaches.",
            delay: 2000,
            typing: true,
          },
          {
            id: 'promise-3',
            content: "Tell me what you need. I find suppliers. I get quotes. I negotiate.",
            delay: 4000,
            typing: true,
          },
          {
            id: 'promise-4',
            content: "**You just approve the deal.**",
            delay: 5500,
            typing: true,
            highlight: true,
          },
          {
            id: 'promise-5',
            content: "Let me show you how fast this can be.",
            delay: 7000,
            typing: true,
            action: {
              type: 'button',
              label: 'Show Me',
            },
          },
        ],
      },

      // Phase 2: Quick Wins Demo
      {
        id: 'demo',
        type: 'demo',
        showInput: true,
        inputPlaceholder: "What's something you need to source? (e.g., 1000 cardboard boxes)",
        suggestedPrompts: [
          "500 custom packaging boxes",
          "Industrial LED lighting",
          "Office furniture for 50 people",
        ],
        messages: [
          {
            id: 'demo-1',
            content: "Give me ONE thing you need to source. Anything.\n\nI'll show you what I can do in seconds.",
            delay: 500,
            typing: true,
          },
        ],
        onUserInput: async (input: string): Promise<WellsMessage[]> => {
          // Simulate processing
          await new Promise(resolve => setTimeout(resolve, 1500))

          return [
            {
              id: 'demo-response-1',
              content: `Got it. "${input}"\n\nLet me search my verified supplier network...`,
              delay: 0,
              typing: true,
            },
            {
              id: 'demo-response-2',
              content: "Done.",
              delay: 2000,
              typing: true,
              action: {
                type: 'demo-result',
                data: {
                  suppliers: 12,
                  bestQuote: '$4,200',
                  savings: '23% vs market avg',
                },
              },
            },
            {
              id: 'demo-response-3',
              content: "**That took 2.3 seconds.** Usually this takes days of emails and phone calls.\n\nWant me to negotiate even better pricing?",
              delay: 4000,
              typing: true,
              highlight: true,
            },
          ]
        },
      },

      // Phase 3: First Real Request
      {
        id: 'action',
        type: 'action',
        showInput: true,
        inputPlaceholder: "What do you actually need to source right now?",
        suggestedPrompts: [
          "I need packaging materials",
          "Looking for a manufacturer",
          "Need equipment quotes",
        ],
        messages: [
          {
            id: 'action-1',
            content: "Now let's do this for real.\n\n**What do you actually need to source?**\n\nBe specific - quantities, specs, timeline. I'll start working on it right now.",
            delay: 500,
            typing: true,
          },
        ],
        onUserInput: async (input: string): Promise<WellsMessage[]> => {
          await new Promise(resolve => setTimeout(resolve, 1000))

          return [
            {
              id: 'action-response',
              content: `Perfect. I'm on it.\n\n"${input}"\n\nI'll start searching for suppliers immediately. You'll get quotes in your inbox soon.\n\nLet's get you set up so I can keep you updated.`,
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
            content: "Taking you to your buyer dashboard...\n\nThis is where you'll see all your active sourcing requests, quotes, and deals.",
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

export default function BuyerOnboardingPage() {
  const router = useRouter()
  const config = createBuyerConfig()

  const handleComplete = useCallback((data: Record<string, any>) => {
    // Store the journey data
    if (typeof window !== 'undefined') {
      localStorage.setItem('wells_journey', 'buyer')
      localStorage.setItem('wells_onboarding_data', JSON.stringify(data))
    }

    // Redirect to buyer chat/dashboard
    router.push('/command?journey=buyer')
  }, [router])

  return <JourneyOnboarding config={config} onComplete={handleComplete} />
}
