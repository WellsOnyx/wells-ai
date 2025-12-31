'use client'

/**
 * Job Seeker Journey Onboarding
 *
 * The Promise:
 * "Forget job boards. They're broken."
 *
 * Flow:
 * 1. The Promise - Direct intros, not listings
 * 2. Quick Profile - What they do and want
 * 3. First Matches - Show opportunity matches
 * 4. Faith Foundation - Your skills are gifts
 *
 * "For I know the plans I have for you," declares the LORD,
 * "plans to prosper you and not to harm you, plans to give
 * you hope and a future." - Jeremiah 29:11
 */

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import JourneyOnboarding, {
  JourneyConfig,
  WellsMessage,
} from '@/components/onboarding/journey/JourneyOnboarding'

// ============================================================================
// JOB SEEKER JOURNEY CONFIGURATION
// ============================================================================

interface JobProfile {
  role: string
  experience: string
  preferences: string[]
}

function parseJobProfile(input: string): Partial<JobProfile> {
  const lowerInput = input.toLowerCase()
  const profile: Partial<JobProfile> = {}

  // Extract role
  const rolePatterns = [
    /i(?:'m| am) (?:a |an )?(.+?)(?:\.|,|with|and|$)/i,
    /(.+?) (?:engineer|developer|manager|designer|lead|director)/i,
  ]

  for (const pattern of rolePatterns) {
    const match = input.match(pattern)
    if (match) {
      profile.role = match[0].trim()
      break
    }
  }

  if (!profile.role) {
    profile.role = input.split('.')[0].trim()
  }

  // Extract experience level
  const expPatterns = [
    /(\d+)\+?\s*(?:years?|yrs?)/i,
    /(senior|junior|mid|lead|staff|principal)/i,
  ]

  for (const pattern of expPatterns) {
    const match = lowerInput.match(pattern)
    if (match) {
      profile.experience = match[0]
      break
    }
  }

  return profile
}

function generateOpportunityMatches(profile: Partial<JobProfile>): any[] {
  const companies = [
    { name: 'Series B Fintech', stage: 'Growth', match: 95 },
    { name: 'AI Startup', stage: 'Series A', match: 88 },
    { name: 'Enterprise SaaS', stage: 'Public', match: 82 },
  ]

  return companies
}

function createJobsConfig(): JourneyConfig {
  let collectedProfile: Partial<JobProfile> = {}

  return {
    journey: 'jobs',
    accentColor: 'from-purple-500 to-pink-500',
    glowColor: 'rgba(168, 85, 247, 0.3)',
    bgGradient: 'from-purple-500/10 via-pink-500/5 to-transparent',
    phases: [
      // Phase 1: The Promise
      {
        id: 'promise',
        type: 'promise',
        messages: [
          {
            id: 'promise-1',
            content: "Forget job boards. They're broken.",
            delay: 500,
            typing: true,
            highlight: true,
          },
          {
            id: 'promise-2',
            content: "**I don't show you listings.** I get you intros.",
            delay: 2500,
            typing: true,
          },
          {
            id: 'promise-3',
            content: "Direct access to hiring managers at companies that are **actually hiring** for roles you'd love.",
            delay: 4500,
            typing: true,
          },
          {
            id: 'promise-4',
            content: "Tell me about yourself, and I'll find your opportunities.",
            delay: 6500,
            typing: true,
            action: {
              type: 'button',
              label: 'Find My Opportunities',
            },
          },
        ],
      },

      // Phase 2: Quick Profile - What They Do
      {
        id: 'profile-role',
        type: 'demo',
        showInput: true,
        inputPlaceholder: "What do you do? What are you great at?",
        suggestedPrompts: [
          "I'm a senior product manager with 8 years experience",
          "Full-stack engineer, Python and React",
          "VP of Marketing at B2B SaaS companies",
          "Operations leader in logistics and supply chain",
        ],
        messages: [
          {
            id: 'profile-1',
            content: "Let's start simple.\n\n**What do you do?** What are you great at?",
            delay: 500,
            typing: true,
          },
        ],
        onUserInput: async (input: string): Promise<WellsMessage[]> => {
          await new Promise(resolve => setTimeout(resolve, 1000))

          collectedProfile = parseJobProfile(input)

          return [
            {
              id: 'profile-response',
              content: `**${collectedProfile.role || 'Got it'}.**\n\nThat's a hot skill set right now. Companies are actively looking.\n\nNow tell me - **what kind of role would be perfect for you?**`,
              delay: 0,
              typing: true,
            },
          ]
        },
      },

      // Phase 3: Ideal Role
      {
        id: 'profile-ideal',
        type: 'demo',
        showInput: true,
        inputPlaceholder: "Describe your ideal role...",
        suggestedPrompts: [
          "Remote-first, high-growth startup",
          "Technical leadership at enterprise company",
          "Hands-on IC role, not management",
          "Early-stage with equity upside",
        ],
        messages: [
          {
            id: 'ideal-1',
            content: "What does the **perfect role** look like?\n\nCompany stage? Remote vs. on-site? Type of work? Any must-haves?",
            delay: 500,
            typing: true,
          },
        ],
        onUserInput: async (input: string): Promise<WellsMessage[]> => {
          await new Promise(resolve => setTimeout(resolve, 1500))

          const opportunities = generateOpportunityMatches(collectedProfile)

          return [
            {
              id: 'ideal-response-1',
              content: `Perfect. Let me scan my network...\n\n"${input}"`,
              delay: 0,
              typing: true,
            },
            {
              id: 'ideal-response-2',
              content: "I found opportunities you'd be a strong match for:",
              delay: 2000,
              typing: true,
              action: {
                type: 'match-preview',
                data: {
                  buyers: opportunities.map(o => ({
                    industry: o.name,
                    size: o.stage,
                    urgency: o.match > 90 ? 'High' : 'Medium',
                  })),
                },
              },
            },
          ]
        },
      },

      // Phase 4: Ready to Reach Out
      {
        id: 'action',
        type: 'action',
        showInput: true,
        inputPlaceholder: "Anything else I should know?",
        suggestedPrompts: [
          "Looking for $200K+ base",
          "Open to relocation for the right role",
          "Currently employed, need discretion",
        ],
        messages: [
          {
            id: 'action-1',
            content: "These companies are actively hiring.\n\n**Want me to reach out on your behalf?**\n\nI'll craft personalized intros to hiring managers - not recruiters, the actual decision makers.\n\nAnything else I should know before I start?",
            delay: 500,
            typing: true,
          },
        ],
        onUserInput: async (input: string): Promise<WellsMessage[]> => {
          await new Promise(resolve => setTimeout(resolve, 1000))

          return [
            {
              id: 'action-response',
              content: `**Got it.**\n\nHere's what happens next:\n\n1. I'll finalize your profile\n2. Identify companies with open roles that match\n3. Find warm intro paths where possible\n4. Craft personalized outreach\n\n**You'll get notified when there's interest.**\n\nNo spam. No cold applications. Just real opportunities.`,
              delay: 0,
              typing: true,
            },
          ]
        },
      },

      // Phase 5: Transition
      {
        id: 'transition',
        type: 'transition',
        autoAdvanceAfter: 3000,
        messages: [
          {
            id: 'transition-1',
            content: "Taking you to your opportunities dashboard...\n\nThis is where you'll track intros, conversations, and opportunities.",
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

export default function JobsOnboardingPage() {
  const router = useRouter()
  const config = createJobsConfig()

  const handleComplete = useCallback((data: Record<string, any>) => {
    // Store the journey data
    if (typeof window !== 'undefined') {
      localStorage.setItem('wells_journey', 'jobs')
      localStorage.setItem('wells_onboarding_data', JSON.stringify(data))
    }

    // Redirect to jobs dashboard
    router.push('/jobs/dashboard')
  }, [router])

  return <JourneyOnboarding config={config} onComplete={handleComplete} />
}
