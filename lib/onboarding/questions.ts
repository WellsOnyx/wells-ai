// @ts-nocheck
/**
 * Wells AI Smart Question Generation
 *
 * Based on what's missing, generate natural follow-up questions.
 * Never ask what we already know.
 * Questions feel conversational, not interrogative.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  ProgressiveProfile,
  Journey,
  ProfileFieldDef,
  PROFILE_FIELDS,
  getMissingFields,
  getNestedValue,
  COMPLETENESS_THRESHOLDS,
  calculateCompleteness,
} from './profile-schema'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// QUESTION TYPES
// ============================================================================

export interface SmartQuestion {
  id: string
  text: string
  field: string
  priority: 'core' | 'important' | 'nice-to-have'
  context?: string
  followUp?: string
  alternatives?: string[]
}

export interface QuestionContext {
  recentTopics: string[]
  conversationMood: 'intro' | 'flowing' | 'detailed' | 'wrapping'
  userEngagement: 'low' | 'medium' | 'high'
}

// ============================================================================
// QUESTION TEMPLATES
// ============================================================================

const QUESTION_TEMPLATES: Record<string, Record<string, string[]>> = {
  // Core questions (all journeys)
  all: {
    name: [
      "What should I call you?",
      "And you are...?",
      "By the way, I didn't catch your name.",
    ],
    company: [
      "What company are you with?",
      "Where do you work?",
      "Tell me about your company.",
    ],
    location: [
      "Where are you based? This helps me find local options.",
      "What's your location? It helps me tailor recommendations.",
      "What city or region are you in?",
    ],
    industry: [
      "What industry are you in?",
      "What space do you operate in?",
      "What field is your business in?",
    ],
  },

  // Buyer-specific questions
  buyer: {
    'buyer.typicalNeeds': [
      "What kinds of products or services do you typically need?",
      "What are you looking to source?",
      "What do you usually need to buy for your business?",
    ],
    'buyer.budgetRange': [
      "What kind of budget are you working with? Ballpark is fine.",
      "Roughly what's your typical order size in dollars?",
      "What's your usual spend per order?",
    ],
    'buyer.locations': [
      "Any geographic preferences for suppliers?",
      "Do you prefer local suppliers or are you open to anywhere?",
      "Where would you ideally source from?",
    ],
    'buyer.categories': [
      "What product categories do you usually purchase?",
      "What types of supplies do you go through regularly?",
      "What are your main purchasing categories?",
    ],
    'buyer.purchaseFrequency': [
      "How often do you typically make these purchases?",
      "Is this a one-time need or ongoing?",
      "What's your buying cadence - monthly, quarterly?",
    ],
    'buyer.certificationRequirements': [
      "Any certifications you require from suppliers?",
      "Do suppliers need any specific certifications?",
      "Any compliance requirements for your vendors?",
    ],
  },

  // Seller-specific questions
  seller: {
    'seller.products': [
      "What products or services do you offer?",
      "Tell me about what you sell.",
      "What's your main offering?",
    ],
    'seller.certifications': [
      "Any certifications buyers should know about?",
      "Do you have any industry certifications?",
      "What certifications does your company hold?",
    ],
    'seller.serviceRegions': [
      "Where can you ship or deliver to?",
      "What regions do you serve?",
      "Where can you do business?",
    ],
    'seller.capabilities': [
      "What are your key capabilities?",
      "What makes you stand out from competitors?",
      "What can you do that others can't?",
    ],
    'seller.capacity': [
      "What's your current capacity?",
      "How much volume can you handle?",
      "What's your production or service capacity?",
    ],
    'seller.minimumOrder': [
      "Do you have a minimum order size?",
      "What's your minimum order value?",
      "Any minimums buyers should know about?",
    ],
  },

  // Founder-specific questions
  founder: {
    'founder.stage': [
      "What stage is your company at?",
      "Where are you in your startup journey?",
      "How far along is the company?",
    ],
    'founder.priorities': [
      "What's your #1 priority right now?",
      "What's keeping you up at night?",
      "What's the most urgent thing you need help with?",
    ],
    'founder.teamSize': [
      "How big is your team?",
      "How many people are on the team?",
      "What's your current headcount?",
    ],
    'founder.lookingFor': [
      "What are you looking to accomplish with Wells?",
      "Are you mainly hiring, sourcing, or selling right now?",
      "What's the main thing you need help with?",
    ],
    'founder.hiringPriorities': [
      "What roles are you looking to fill?",
      "Who are you trying to hire?",
      "What positions are open?",
    ],
    'founder.challenges': [
      "What's your biggest challenge right now?",
      "What's blocking your growth?",
      "Where do you need the most help?",
    ],
    'founder.fundingStage': [
      "How are you funded?",
      "Have you raised any capital?",
      "What's your funding situation?",
    ],
  },

  // Job seeker questions
  jobs: {
    'jobs.currentTitle': [
      "What's your current role?",
      "What do you do now?",
      "What's your current title?",
    ],
    'jobs.experience': [
      "How many years of experience do you have?",
      "How long have you been in your field?",
      "What's your experience level?",
    ],
    'jobs.skills': [
      "What are your key skills?",
      "What are you best at?",
      "What skills would you highlight?",
    ],
    'jobs.targetTitles': [
      "What kind of role are you looking for?",
      "What's your target position?",
      "What would your ideal next role be?",
    ],
    'jobs.preferences.remote': [
      "Are you open to remote work, or prefer being in an office?",
      "Remote, hybrid, or on-site - what works for you?",
      "Any work arrangement preferences?",
    ],
    'jobs.preferences.salaryRange': [
      "What salary range are you targeting?",
      "What are your compensation expectations?",
      "What would make sense compensation-wise?",
    ],
    'jobs.preferences.locations': [
      "Where are you looking for jobs?",
      "Any location preferences or constraints?",
      "What cities or areas are you considering?",
    ],
    'jobs.timeline': [
      "What's your timeline for making a move?",
      "Is this urgent, or do you have some time?",
      "When are you looking to make a change?",
    ],
    'jobs.reasonForLooking': [
      "What's driving the job search?",
      "What are you looking for that you don't have now?",
      "What would make a role perfect for you?",
    ],
  },
}

// ============================================================================
// TRANSITION PHRASES
// ============================================================================

const TRANSITION_PHRASES = {
  fromPrevious: [
    "Got it.",
    "Perfect.",
    "Nice.",
    "Makes sense.",
    "I see.",
    "Okay.",
  ],
  acknowledgment: [
    "I'm getting a clearer picture.",
    "That helps me understand.",
    "Good to know.",
    "Thanks for sharing that.",
  ],
  toNextQuestion: [
    "Quick question -",
    "By the way,",
    "Also,",
    "One more thing -",
    "And",
  ],
}

// ============================================================================
// PROGRESS FEEDBACK
// ============================================================================

const PROGRESS_FEEDBACK = {
  minimal: [
    "We're just getting started. A few more things and I'll be able to help you better.",
    "Tell me a bit more so I can really help.",
  ],
  usable: [
    "I'm starting to get the picture.",
    "This is helpful. A bit more and I'll really understand your needs.",
  ],
  good: [
    "Nice, I'm getting a clearer picture of what you need.",
    "This is great context. Almost there.",
  ],
  excellent: [
    "The more I know, the better I can help. We're almost there.",
    "I've got a good understanding now.",
  ],
  complete: [
    "I've got enough to really help you now.",
    "Perfect - I have everything I need to be useful.",
  ],
}

// ============================================================================
// MAIN QUESTION GENERATION
// ============================================================================

/**
 * Get the next smart question based on profile gaps
 */
export function getNextQuestion(
  profile: ProgressiveProfile,
  context?: QuestionContext
): SmartQuestion | null {
  // If no journey yet, that's the first priority
  if (!profile.journey) {
    return {
      id: 'journey',
      text: "What brings you to Wells AI today? Are you looking to buy, sell, hire, or find a role?",
      field: 'journey',
      priority: 'core',
      alternatives: [
        "What's the main thing you're hoping to accomplish?",
        "Are you here to source products, sell to buyers, build a team, or find your next role?",
      ],
    }
  }

  // Get missing fields for their journey
  const missingFields = getMissingFields(profile)

  if (missingFields.length === 0) {
    return null // Profile is complete
  }

  // Get the highest priority missing field
  const nextField = missingFields[0]

  // Get question template
  const journeyTemplates = QUESTION_TEMPLATES[profile.journey] || {}
  const allTemplates = QUESTION_TEMPLATES.all || {}
  const templates = journeyTemplates[nextField.key] || allTemplates[nextField.key]

  if (!templates || templates.length === 0) {
    // Fallback to hint-based question
    return {
      id: nextField.key,
      text: nextField.questionHint || `Tell me about your ${nextField.label.toLowerCase()}.`,
      field: nextField.key,
      priority: nextField.priority,
    }
  }

  // Select a random template
  const questionText = templates[Math.floor(Math.random() * templates.length)]

  return {
    id: nextField.key,
    text: questionText,
    field: nextField.key,
    priority: nextField.priority,
    alternatives: templates.filter(t => t !== questionText).slice(0, 2),
  }
}

/**
 * Get multiple questions for a profile building session
 */
export function getQuestionsForSession(
  profile: ProgressiveProfile,
  limit = 3
): SmartQuestion[] {
  const questions: SmartQuestion[] = []
  const missingFields = getMissingFields(profile)

  // Always include journey if missing
  if (!profile.journey) {
    const journeyQ = getNextQuestion(profile)
    if (journeyQ) {
      questions.push(journeyQ)
      return questions // Start with just journey
    }
  }

  // Get questions for missing fields
  for (const field of missingFields.slice(0, limit)) {
    const journeyTemplates = QUESTION_TEMPLATES[profile.journey!] || {}
    const allTemplates = QUESTION_TEMPLATES.all || {}
    const templates = journeyTemplates[field.key] || allTemplates[field.key]

    const text = templates?.[0] || field.questionHint || `Tell me about ${field.label}.`

    questions.push({
      id: field.key,
      text,
      field: field.key,
      priority: field.priority,
    })
  }

  return questions
}

// ============================================================================
// CONVERSATIONAL QUESTION GENERATION
// ============================================================================

/**
 * Generate a natural conversational question using Claude
 */
export async function generateConversationalQuestion(
  profile: ProgressiveProfile,
  recentMessages?: string[],
  targetField?: string
): Promise<SmartQuestion> {
  const completeness = calculateCompleteness(profile)
  const missingFields = getMissingFields(profile)

  if (missingFields.length === 0) {
    return {
      id: 'complete',
      text: getProgressFeedback(completeness),
      field: 'none',
      priority: 'nice-to-have',
    }
  }

  const fieldToAsk = targetField
    ? missingFields.find(f => f.key === targetField) || missingFields[0]
    : missingFields[0]

  // Try to generate with Claude for natural flow
  if (recentMessages && recentMessages.length > 0) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: `You are Wells AI, having a friendly onboarding conversation. Generate a natural, conversational question to learn about the user.

CONTEXT:
- User journey: ${profile.journey || 'unknown'}
- Profile completeness: ${completeness}%
- You need to learn: ${fieldToAsk.label} (${fieldToAsk.key})
- Field type: ${fieldToAsk.type}

RULES:
1. Keep it casual and conversational
2. One question only
3. Don't be robotic or form-like
4. Reference previous context if relevant
5. Maximum 2 sentences

Return ONLY the question, nothing else.`,
        messages: [
          {
            role: 'user',
            content: `Recent conversation:\n${recentMessages.slice(-3).join('\n')}\n\nGenerate the next question.`,
          },
        ],
      })

      const textBlock = response.content.find(block => block.type === 'text')
      const question = textBlock?.type === 'text' ? textBlock.text.trim() : null

      if (question) {
        return {
          id: fieldToAsk.key,
          text: question,
          field: fieldToAsk.key,
          priority: fieldToAsk.priority,
        }
      }
    } catch (error) {
      console.error('[Questions] Error generating conversational question:', error)
    }
  }

  // Fallback to templates
  return getNextQuestion(profile) || {
    id: 'fallback',
    text: "Tell me more about what you're looking for.",
    field: 'general',
    priority: 'nice-to-have',
  }
}

// ============================================================================
// PROGRESS FEEDBACK
// ============================================================================

export function getProgressFeedback(completeness: number): string {
  let category: keyof typeof PROGRESS_FEEDBACK

  if (completeness >= COMPLETENESS_THRESHOLDS.complete) {
    category = 'complete'
  } else if (completeness >= COMPLETENESS_THRESHOLDS.excellent) {
    category = 'excellent'
  } else if (completeness >= COMPLETENESS_THRESHOLDS.good) {
    category = 'good'
  } else if (completeness >= COMPLETENESS_THRESHOLDS.usable) {
    category = 'usable'
  } else {
    category = 'minimal'
  }

  const messages = PROGRESS_FEEDBACK[category]
  return messages[Math.floor(Math.random() * messages.length)]
}

/**
 * Get an acknowledgment for newly extracted data
 */
export function getExtractionAcknowledgment(
  extractedFields: string[],
  completeness: number
): string {
  if (extractedFields.length === 0) return ''

  const transition = TRANSITION_PHRASES.fromPrevious[
    Math.floor(Math.random() * TRANSITION_PHRASES.fromPrevious.length)
  ]

  // Add progress feedback at certain milestones
  if (completeness >= COMPLETENESS_THRESHOLDS.excellent) {
    return `${transition} ${getProgressFeedback(completeness)}`
  }

  if (completeness >= COMPLETENESS_THRESHOLDS.good) {
    const ack = TRANSITION_PHRASES.acknowledgment[
      Math.floor(Math.random() * TRANSITION_PHRASES.acknowledgment.length)
    ]
    return `${transition} ${ack}`
  }

  return transition
}

// ============================================================================
// QUESTION SEQUENCING
// ============================================================================

/**
 * Build a natural question with context and transition
 */
export function buildNaturalQuestion(
  question: SmartQuestion,
  previouslyExtracted: string[],
  completeness: number
): string {
  const parts: string[] = []

  // Add acknowledgment if we just learned something
  if (previouslyExtracted.length > 0) {
    const ack = getExtractionAcknowledgment(previouslyExtracted, completeness)
    if (ack) parts.push(ack)
  }

  // Add transition to question
  if (parts.length > 0 && Math.random() > 0.5) {
    const transition = TRANSITION_PHRASES.toNextQuestion[
      Math.floor(Math.random() * TRANSITION_PHRASES.toNextQuestion.length)
    ]
    parts.push(transition.toLowerCase())
  }

  // Add the question
  parts.push(question.text)

  return parts.join(' ')
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Questions = {
  getNextQuestion,
  getQuestionsForSession,
  generateConversationalQuestion,
  getProgressFeedback,
  getExtractionAcknowledgment,
  buildNaturalQuestion,
}

export default Questions
