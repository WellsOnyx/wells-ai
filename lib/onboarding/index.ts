/**
 * Wells AI - Legendary Onboarding Engine
 *
 * Main orchestration for the onboarding experience.
 * Exports all public functions for use in the chat API.
 */

export {
  // Types
  type OnboardingPhase,
  type UserJourney,
  type OnboardingState,
  type OnboardingMilestone,

  // State management
  createOnboardingState,
  updateOnboardingState,
  isOnboardingComplete,
  getOnboardingProgress,
  detectJourney,
  calculateTrustScoreIncrease,
  awardMilestone,
  getNextMilestone,
  ONBOARDING_MILESTONES
} from './stages'

export {
  // Prompts
  getOnboardingSystemPrompt,
  getCelebrationMessage,
  getSuggestedNextAction
} from './prompts'

export {
  // Parsing
  parseOnboardingMessage,
  detectIntegrationIntent,
  analyzeSentiment
} from './parser'

/**
 * Main onboarding orchestration function
 *
 * Call this after each message exchange to update onboarding state
 */
import { OnboardingState } from './stages'
import { parseOnboardingMessage } from './parser'
import { updateOnboardingState } from './stages'

export async function processOnboardingTurn(
  userMessage: string,
  assistantMessage: string,
  currentState: OnboardingState,
  conversationHistory: string[]
): Promise<OnboardingState> {
  // Parse the messages to extract information
  let newState = parseOnboardingMessage(
    userMessage,
    assistantMessage,
    currentState,
    conversationHistory
  )

  // Update state and check for phase transitions
  newState = updateOnboardingState(currentState, newState)

  return newState
}

/**
 * Get onboarding context for Claude system prompt
 */
export function getOnboardingContext(state: OnboardingState): string {
  return `
## ONBOARDING CONTEXT

You are currently in the "${state.phase}" phase of onboarding.

${state.name ? `User's name: ${state.preferredName || state.name}` : 'You haven\'t learned their name yet.'}
${state.journey ? `Journey: ${state.journey}` : 'You haven\'t identified their journey yet.'}
${state.company ? `Company: ${state.company}` : ''}
${state.role ? `Role: ${state.role}` : ''}

Progress:
- Messages: ${state.messageCount}
- Trust Score: ${state.trustScore}/100
- Conversation Depth: ${state.conversationDepth}/10
- Milestones: ${state.milestones.length}

${state.painPoint ? `Their pain point: "${state.painPoint}"` : 'You haven\'t identified their pain point yet.'}
${state.goal ? `Their goal: "${state.goal}"` : 'You haven\'t identified their goal yet.'}

## YOUR FOCUS FOR THIS PHASE

${getPhaseFocus(state)}
`
}

function getPhaseFocus(state: OnboardingState): string {
  switch (state.phase) {
    case 'introduction':
      return `Learn:
- Their name (and what they like to be called)
- What they do
- What they need help with
- Their biggest pain point

Keep it natural. Don't interrogate. Build rapport.`

    case 'first_win':
      return `Deliver immediate value:
- Take action on their need
- Show results fast
- Prove you can help
- Build excitement

Make them think: "Wow, this actually works."`

    case 'integration':
      return `Connect systems:
- Bank account (for payments)
- ERP (for automation)
- Calendar (for scheduling)

Make it feel valuable, not technical. Explain benefits, not features.`

    case 'relationship':
      return `Deepen the partnership:
- Anticipate their needs
- Remember everything
- Proactively suggest improvements
- Celebrate wins together

Become indispensable.`

    case 'complete':
      return `Maintain the relationship:
- Continue delivering value
- Deepen trust
- Be their trusted partner

You're their companion now. Act like it.`

    default:
      return 'Build trust and deliver value.'
  }
}
