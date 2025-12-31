// @ts-nocheck
/**
 * Wells AI Faith Foundation
 *
 * "The fear of the LORD is the beginning of knowledge,
 *  but fools despise wisdom and instruction." - Proverbs 1:7
 *
 * This module exports the complete faith foundation that informs Wells AI's
 * wisdom, personality, and approach. Wells is wise BECAUSE of these foundations,
 * not religious because of them.
 *
 * Key principles:
 * - Not preachy or religious-sounding
 * - Wisdom that happens to come from scripture
 * - Encouraging, not judgmental
 * - Practical application, not theological
 */

// ============================================================================
// SCRIPTURE EXPORTS
// ============================================================================

export {
  // Types
  type ScriptureBook,
  type ScriptureTheme,
  type UserJourney,
  type UserSituation,
  type Scripture,
  type ScriptureSelection,

  // Collections
  ALL_SCRIPTURES,
  PROVERBS_SCRIPTURES,
  HEBREWS_SCRIPTURES,

  // Functions
  getScripturesForContext,
  selectScripture,
  getCelebrationScripture,
  getChallengeScripture,
  getDecisionScripture,
  getNegotiationScripture,
  getPerseveranceScripture,
  getApplicationNote,
  getScripturesByTheme,
  getRelevantThemes,

  // Namespace
  Scriptures,
} from './scriptures'

// ============================================================================
// WISDOM EXPORTS
// ============================================================================

export {
  // Types
  type WisdomCategory,
  type WisdomPrinciple,
  type WisdomApplication,

  // Collections
  WISDOM_PRINCIPLES,

  // Functions
  getWisdomByCategory,
  getWisdomForJourney,
  getWisdomForSituation,
  getContextualWisdom,
  selectWisdom,
  getNegotiationWisdom,
  getPerseveranceWisdom,
  getDecisionWisdom,
  getRelationshipWisdom,
  getChallengeWisdom,
  getRandomWisdom,
  getWisdomExamples,
  getWisdomCategorySummary,

  // Namespace
  Wisdom,
} from './wisdom'

// ============================================================================
// PERSONALITY EXPORTS
// ============================================================================

export {
  // Types
  type PersonalityTrait,
  type CommunicationStyle,
  type PersonalityContext,
  type PersonalityGuidance,
  type ToneModifier,

  // Collections
  PERSONALITY_TRAITS,
  TONE_MODIFIERS,

  // Functions
  getPersonalityGuidance,
  getPersonalitySystemPrompt,
  getPersonalityReminder,
  getAllTraits,
  getTraitDescription,
  getTraitManifestations,
  getTraitPhrases,
  getTraitsForWisdomCategory,
  getJobSeekerPersonality,
  getFounderPersonality,
  getNegotiationPersonality,
  getCelebrationPersonality,
  getChallengePersonality,

  // Namespace
  FaithPersonality,
} from './personality'

// ============================================================================
// INTEGRATED HELPERS
// ============================================================================

import { Scriptures, UserJourney, UserSituation, ScriptureTheme } from './scriptures'
import { Wisdom, WisdomCategory } from './wisdom'
import { FaithPersonality, PersonalityContext, PersonalityGuidance } from './personality'

/**
 * Get comprehensive faith-informed context for a given situation
 * This combines scriptures, wisdom, and personality into a single context object
 */
export interface FaithContext {
  // Core context
  journey: UserJourney
  situation: UserSituation

  // Scripture foundation
  relevantScripture: {
    reference: string
    applicationNote: string
  } | null

  // Wisdom application
  guidingWisdom: {
    principle: string
    explanation: string
  } | null

  // Personality guidance
  personality: PersonalityGuidance

  // For system prompts
  systemPromptAddition: string
}

/**
 * Build comprehensive faith context for any situation
 */
export function buildFaithContext(
  journey: UserJourney,
  situation: UserSituation,
  options?: {
    emotionalState?: 'positive' | 'neutral' | 'struggling' | 'frustrated'
    preferredThemes?: ScriptureTheme[]
    preferredWisdomCategory?: WisdomCategory
  }
): FaithContext {
  // Get scripture
  const scriptureSelection = Scriptures.select({
    journey,
    situation,
    preferredThemes: options?.preferredThemes,
  })

  // Get wisdom
  const wisdomSelection = Wisdom.select({
    journey,
    situation,
    preferredCategory: options?.preferredWisdomCategory,
  })

  // Get personality
  const personalityContext: PersonalityContext = {
    journey,
    situation,
    emotionalState: options?.emotionalState,
  }
  const personality = FaithPersonality.getGuidance(personalityContext)

  // Build system prompt addition
  const systemPromptAddition = buildSystemPromptAddition(
    scriptureSelection,
    wisdomSelection,
    personality
  )

  return {
    journey,
    situation,
    relevantScripture: scriptureSelection
      ? {
          reference: scriptureSelection.scripture.reference,
          applicationNote: scriptureSelection.scripture.applicationNote,
        }
      : null,
    guidingWisdom: wisdomSelection
      ? {
          principle: wisdomSelection.principle.principle,
          explanation: wisdomSelection.principle.explanation,
        }
      : null,
    personality,
    systemPromptAddition,
  }
}

/**
 * Build system prompt addition from faith context components
 */
function buildSystemPromptAddition(
  scripture: { scripture: { reference: string; applicationNote: string } } | null,
  wisdom: { principle: { principle: string; explanation: string } } | null,
  personality: PersonalityGuidance
): string {
  const parts: string[] = []

  // Faith-informed approach (not religious language)
  parts.push('## Wells AI Wisdom Foundation')
  parts.push('')
  parts.push('Wells communicates with deep wisdom, applying timeless principles practically.')
  parts.push('Express wisdom through action and tone, not religious language.')
  parts.push('')

  // Guiding wisdom
  if (wisdom) {
    parts.push('### Guiding Principle')
    parts.push(`"${wisdom.principle.principle}"`)
    parts.push(`${wisdom.principle.explanation}`)
    parts.push('')
  }

  // How to apply (from scripture, without quoting)
  if (scripture) {
    parts.push('### Application Note')
    parts.push(scripture.scripture.applicationNote)
    parts.push('')
  }

  // Personality traits
  parts.push('### Communication Style')
  parts.push(`Primary traits: ${personality.primaryTraits.join(', ')}`)
  parts.push(`Style: ${personality.communicationStyle.replace('_', ' ')}`)
  parts.push('')

  // Tone guidelines
  parts.push('### Tone Guidelines')
  personality.toneGuidelines.forEach((g) => parts.push(`- ${g}`))
  parts.push('')

  // Key avoidances
  parts.push('### Avoidances')
  personality.avoidances.forEach((a) => parts.push(`- ${a}`))

  return parts.join('\n')
}

/**
 * Get quick faith context for a simple situation
 * Returns just the essential elements for brief integration
 */
export function getQuickFaithContext(
  journey: UserJourney,
  situation: UserSituation
): {
  wisdomPrinciple: string
  personalityReminder: string
} {
  const wisdom = Wisdom.select({ journey, situation })
  const personalityReminder = FaithPersonality.getReminder({ journey, situation })

  return {
    wisdomPrinciple: wisdom?.principle.principle || 'Act with wisdom and integrity.',
    personalityReminder,
  }
}

/**
 * Get encouragement for difficult moments
 * Combines Hebrews perseverance themes with encouraging personality
 */
export function getEncouragement(journey: UserJourney): {
  message: string
  source: string
} {
  const scripture = Scriptures.getForPerseverance(journey)
  const personality = FaithPersonality.forChallenge(journey)

  if (!scripture) {
    return {
      message: 'Keep going. Your persistence will pay off.',
      source: 'Wells encouragement',
    }
  }

  // Generate encouraging message based on scripture application
  const applicationNote = scripture.scripture.applicationNote
  const phrases = personality.samplePhrases

  return {
    message: phrases[Math.floor(Math.random() * phrases.length)] || applicationNote,
    source: `Inspired by ${scripture.scripture.reference}`,
  }
}

/**
 * Get celebration message for wins
 * Combines encouragement with appropriate humility
 */
export function getCelebration(journey: UserJourney): {
  message: string
  nextStepEncouragement: string
} {
  const personality = FaithPersonality.forCelebration(journey)
  const phrases = personality.samplePhrases

  const celebrationMessages = [
    'This is a meaningful milestone. Well done.',
    'You earned this. Take a moment to appreciate it.',
    'Success like this comes from consistent effort.',
    'This is exactly what persistence looks like.',
  ]

  const nextStepMessages = [
    'When you\'re ready, let\'s talk about what\'s next.',
    'Enjoy this win. The next opportunity is waiting.',
    'This success opens new doors.',
    'Build on this momentum.',
  ]

  return {
    message:
      celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)],
    nextStepEncouragement:
      nextStepMessages[Math.floor(Math.random() * nextStepMessages.length)],
  }
}

/**
 * Get negotiation guidance
 * Fair dealing principles from Proverbs
 */
export function getNegotiationGuidance(): {
  principles: string[]
  toneGuidance: string
  avoidances: string[]
} {
  const wisdom = Wisdom.forNegotiation()
  const personality = FaithPersonality.forNegotiation()

  return {
    principles: wisdom.map((w) => w.principle),
    toneGuidance: `Be ${personality.primaryTraits.join(', ')}. Advocate confidently while ensuring fair outcomes.`,
    avoidances: [
      'Don\'t exploit information asymmetry',
      'Don\'t prioritize short-term wins over long-term relationships',
      'Don\'t be manipulative or deceptive',
      'Don\'t sacrifice the user\'s reputation for a deal',
    ],
  }
}

// ============================================================================
// MASTER FAITH FOUNDATION OBJECT
// ============================================================================

export const FaithFoundation = {
  // Sub-modules
  Scriptures,
  Wisdom,
  Personality: FaithPersonality,

  // Integrated functions
  buildContext: buildFaithContext,
  getQuickContext: getQuickFaithContext,
  getEncouragement,
  getCelebration,
  getNegotiationGuidance,
}

export default FaithFoundation
