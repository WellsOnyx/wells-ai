'use client'

/**
 * Seller Journey Onboarding
 *
 * The Promise:
 * "I'm going to bring buyers to you."
 *
 * Flow:
 * 1. The Promise - Wells explains no more cold outreach
 * 2. Quick Profile - What do you sell?
 * 3. First Match Preview - Show anonymized buyer matches
 */

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import JourneyOnboarding, {
  JourneyConfig,
  WellsMessage,
} from '@/components/onboarding/journey/JourneyOnboarding'

// ============================================================================
// SELLER JOURNEY CONFIGURATION
// ============================================================================

function createSellerConfig(): JourneyConfig {
  return {
    journey: 'seller',
    accentColor: 'from-emerald-500 to-green-500',
    glowColor: 'rgba(16, 185, 129, 0.3)',
    bgGradient: 'from-emerald-500/10 via-green-500/5 to-transparent',
    phases: [
      // Phase 1: The Promise
      {
        id: 'promise',
        type: 'promise',
        messages: [
          {
            id: 'promise-1',
            content: "I'm going to bring buyers to you.",
            delay: 500,
            typing: true,
            highlight: true,
          },
          {
            id: 'promise-2',
            content: "**No more cold outreach.** No more trade shows. No more waiting.",
            delay: 2000,
            typing: true,
          },
          {
            id: 'promise-3',
            content: "Qualified buyers are already looking for what you sell.\n\nI match you. I introduce you. I help close deals.",
            delay: 4000,
            typing: true,
          },
          {
            id: 'promise-4',
            content: "Let me show you who's already looking.",
            delay: 6500,
            typing: true,
            action: {
              type: 'button',
              label: 'Find My Buyers',
            },
          },
        ],
      },

      // Phase 2: Quick Profile
      {
        id: 'profile',
        type: 'demo',
        showInput: true,
        inputPlaceholder: "What do you sell? Just the highlights...",
        suggestedPrompts: [
          "We manufacture custom metal parts",
          "Industrial packaging solutions",
          "Logistics and fulfillment services",
        ],
        messages: [
          {
            id: 'profile-1',
            content: "**What do you sell?** Just the highlights.\n\nProducts, services, your specialty - whatever you're great at.",
            delay: 500,
            typing: true,
          },
        ],
        onUserInput: async (input: string): Promise<WellsMessage[]> => {
          await new Promise(resolve => setTimeout(resolve, 1500))

          // Extract categories from input for matching
          const categories = extractCategories(input)

          return [
            {
              id: 'profile-response-1',
              content: `Got it. "${input}"\n\nLet me scan my buyer network for matches...`,
              delay: 0,
              typing: true,
            },
            {
              id: 'profile-response-2',
              content: `**Perfect.** I already see active buyers who might need this.`,
              delay: 2500,
              typing: true,
              action: {
                type: 'match-preview',
                data: {
                  buyers: generateBuyerMatches(categories),
                },
              },
            },
          ]
        },
      },

      // Phase 3: First Match Preview
      {
        id: 'match',
        type: 'action',
        showInput: true,
        inputPlaceholder: "What regions or industries are you strongest in?",
        suggestedPrompts: [
          "We ship nationwide",
          "Focus on automotive industry",
          "Healthcare and pharma is our specialty",
        ],
        messages: [
          {
            id: 'match-1',
            content: "These buyers are actively sourcing right now.\n\n**Want me to introduce you?**\n\nFirst, tell me a bit more so I can make the best matches:\n\n- What regions do you serve?\n- Any industries you specialize in?",
            delay: 500,
            typing: true,
          },
        ],
        onUserInput: async (input: string): Promise<WellsMessage[]> => {
          await new Promise(resolve => setTimeout(resolve, 1000))

          return [
            {
              id: 'match-response',
              content: `Perfect. Here's what happens next:\n\n1. I'll complete your seller profile\n2. Match you with buyers looking for exactly what you offer\n3. Handle the introductions\n\n**You just close the deals.**\n\nLet's finish setting you up.`,
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
            content: "Taking you to your seller dashboard...\n\nThis is where you'll see buyer requests, manage your catalog, and track deals.",
            delay: 500,
            typing: true,
          },
        ],
      },
    ],
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractCategories(input: string): string[] {
  const categories: string[] = []
  const lowerInput = input.toLowerCase()

  const categoryKeywords: Record<string, string[]> = {
    'Manufacturing': ['manufacture', 'make', 'produce', 'fabricate', 'metal', 'plastic', 'parts'],
    'Packaging': ['package', 'packaging', 'box', 'container', 'wrap'],
    'Logistics': ['logistics', 'shipping', 'fulfillment', 'warehouse', 'distribution'],
    'Technology': ['software', 'tech', 'saas', 'platform', 'app'],
    'Services': ['service', 'consulting', 'support', 'maintenance'],
  }

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => lowerInput.includes(kw))) {
      categories.push(category)
    }
  }

  return categories.length > 0 ? categories : ['General']
}

function generateBuyerMatches(categories: string[]): any[] {
  const industries = ['Manufacturing', 'Healthcare', 'Retail', 'Technology', 'Automotive']
  const sizes = ['Enterprise', 'Mid-Market', 'SMB']
  const urgencies = ['High', 'Medium', 'High']

  return [
    {
      industry: industries[Math.floor(Math.random() * industries.length)],
      size: sizes[0],
      urgency: urgencies[0],
    },
    {
      industry: industries[Math.floor(Math.random() * industries.length)],
      size: sizes[1],
      urgency: urgencies[1],
    },
    {
      industry: industries[Math.floor(Math.random() * industries.length)],
      size: sizes[0],
      urgency: urgencies[2],
    },
  ]
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function SellerOnboardingPage() {
  const router = useRouter()
  const config = createSellerConfig()

  const handleComplete = useCallback((data: Record<string, any>) => {
    // Store the journey data
    if (typeof window !== 'undefined') {
      localStorage.setItem('wells_journey', 'seller')
      localStorage.setItem('wells_onboarding_data', JSON.stringify(data))
    }

    // Redirect to seller dashboard
    router.push('/command?journey=seller')
  }, [router])

  return <JourneyOnboarding config={config} onComplete={handleComplete} />
}
