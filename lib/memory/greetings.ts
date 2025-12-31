// @ts-nocheck
/**
 * Wells Personalized Greetings System
 *
 * "A friend loves at all times." - Proverbs 17:17
 *
 * Wells greets users based on their history, context, and current situation.
 * Like Ghost from Destiny, Wells acknowledges what has happened and sets the
 * stage for what comes next.
 */

import { WellsMemory, daysSince, hoursSince } from './schema'
import { getMemory } from './service'

// ============================================================================
// TYPES
// ============================================================================

export interface GreetingContext {
  userId: string
  memory: WellsMemory
  currentHour: number
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  hoursSinceLastSeen: number
  daysSinceFirstContact: number
  isFirstVisit: boolean
  hasRecentSuccess: boolean
  hasPendingItems: boolean
  hasUpcomingDeadline: boolean
  isLongAbsence: boolean
  specialOccasion?: SpecialOccasion
}

export interface SpecialOccasion {
  type: 'milestone' | 'first_week' | 'first_month' | 'deal_closed' | 'anniversary'
  title: string
  message: string
}

export interface GreetingResult {
  greeting: string
  subtext?: string
  mood: 'celebratory' | 'warm' | 'professional' | 'urgent' | 'casual' | 'mysterious'
  suggestedActions?: string[]
}

// ============================================================================
// MAIN GREETING GENERATOR
// ============================================================================

/**
 * Generate a personalized greeting for a user
 */
export async function generateGreeting(userId: string): Promise<GreetingResult> {
  try {
    const memory = await getMemory(userId)

    if (!memory) {
      // First-time visitor
      return generateFirstVisitGreeting()
    }

    const context = buildGreetingContext(userId, memory)

    // Priority order for greeting types
    if (context.isFirstVisit) {
      return generateFirstVisitGreeting()
    }

    if (context.specialOccasion) {
      return generateSpecialOccasionGreeting(context)
    }

    if (context.hasRecentSuccess) {
      return generateSuccessGreeting(context)
    }

    if (context.hasUpcomingDeadline) {
      return generateUrgentGreeting(context)
    }

    if (context.hasPendingItems) {
      return generatePendingItemsGreeting(context)
    }

    if (context.isLongAbsence) {
      return generateLongAbsenceGreeting(context)
    }

    // Standard contextual greeting
    return generateStandardGreeting(context)
  } catch (error) {
    console.error('[Greetings] Error generating greeting:', error)
    return {
      greeting: "I'm Wells. Ready when you are.",
      mood: 'professional',
    }
  }
}

// ============================================================================
// GREETING TYPE GENERATORS
// ============================================================================

/**
 * First visit - mysterious and intriguing
 */
function generateFirstVisitGreeting(): GreetingResult {
  const greetings = [
    {
      greeting: "I'm Wells. I've been waiting for you.",
      subtext: "Let's build something together.",
      mood: 'mysterious' as const,
    },
    {
      greeting: "Welcome. I'm Wells - your AI partner in business.",
      subtext: "The more we work together, the more I understand what you need.",
      mood: 'professional' as const,
    },
    {
      greeting: "They call me Wells. I help businesses like yours thrive.",
      subtext: "Tell me about yourself, and I'll remember everything.",
      mood: 'mysterious' as const,
    },
    {
      greeting: "Hello. I'm Wells, and I have a feeling we're going to work well together.",
      subtext: "Shall we begin?",
      mood: 'warm' as const,
    },
  ]

  return greetings[Math.floor(Math.random() * greetings.length)]
}

/**
 * Special occasion greeting (milestone, anniversary, etc.)
 */
function generateSpecialOccasionGreeting(context: GreetingContext): GreetingResult {
  const occasion = context.specialOccasion!
  const name = context.memory.facts.preferredName || context.memory.facts.name?.split(' ')[0]

  switch (occasion.type) {
    case 'milestone':
      return {
        greeting: name
          ? `${name}! We have something to celebrate.`
          : 'We have something to celebrate!',
        subtext: occasion.message,
        mood: 'celebratory',
        suggestedActions: ['View Achievement', 'Share Progress'],
      }

    case 'first_week':
      return {
        greeting: name
          ? `One week together, ${name}.`
          : 'One week together.',
        subtext: "I've been learning about how you work. Here's to many more.",
        mood: 'warm',
      }

    case 'first_month':
      return {
        greeting: name
          ? `Happy one month, ${name}.`
          : 'Happy one month together.',
        subtext: `We've accomplished a lot. I know your preferences, your pace, your goals.`,
        mood: 'warm',
      }

    case 'deal_closed':
      return {
        greeting: 'That deal we worked on? It came through.',
        subtext: occasion.message,
        mood: 'celebratory',
        suggestedActions: ['View Details', 'Start Next Deal'],
      }

    case 'anniversary':
      return {
        greeting: name
          ? `Another year together, ${name}.`
          : 'Another year together.',
        subtext: "Let's make this one even better.",
        mood: 'celebratory',
      }

    default:
      return {
        greeting: occasion.title,
        subtext: occasion.message,
        mood: 'celebratory',
      }
  }
}

/**
 * Recent success - celebrate!
 */
function generateSuccessGreeting(context: GreetingContext): GreetingResult {
  const name = context.memory.facts.preferredName || context.memory.facts.name?.split(' ')[0]
  const timeGreeting = getTimeOfDayGreeting(context.timeOfDay, name)

  const greetings = [
    {
      greeting: name ? `${name}! That deal we closed last week - client sent positive feedback.` : 'Good news - that deal we closed? Client sent positive feedback.',
      mood: 'celebratory' as const,
    },
    {
      greeting: `${timeGreeting} Remember that quote you approved? They signed.`,
      mood: 'celebratory' as const,
    },
    {
      greeting: name ? `${name}, the momentum is building.` : 'The momentum is building.',
      subtext: `${context.memory.history.successfulDeals} successful deals and counting.`,
      mood: 'warm' as const,
    },
  ]

  return greetings[Math.floor(Math.random() * greetings.length)]
}

/**
 * Urgent greeting - deadline approaching
 */
function generateUrgentGreeting(context: GreetingContext): GreetingResult {
  const name = context.memory.facts.preferredName || context.memory.facts.name?.split(' ')[0]
  const pendingAction = context.memory.recentContext.pendingActions.find(a => a.priority === 'critical' || a.priority === 'high')

  if (pendingAction) {
    return {
      greeting: name
        ? `${name}, I need your attention on something.`
        : 'Something needs your attention.',
      subtext: pendingAction.action,
      mood: 'urgent',
      suggestedActions: ['View Now', 'Remind Me Later'],
    }
  }

  return {
    greeting: name
      ? `${name}, you've got deadlines approaching.`
      : 'You have deadlines approaching.',
    subtext: 'Want me to walk you through them?',
    mood: 'urgent',
    suggestedActions: ['Show Deadlines', 'I Know'],
  }
}

/**
 * Has pending items - gentle reminder
 */
function generatePendingItemsGreeting(context: GreetingContext): GreetingResult {
  const name = context.memory.facts.preferredName || context.memory.facts.name?.split(' ')[0]
  const timeGreeting = getTimeOfDayGreeting(context.timeOfDay, name)
  const pendingCount = context.memory.recentContext.pendingActions.length
  const quotesWaiting = context.memory.history.quotesRequested - context.memory.history.quotesAccepted

  if (quotesWaiting > 0) {
    return {
      greeting: `${timeGreeting}`,
      subtext: `You've got ${quotesWaiting} quote${quotesWaiting > 1 ? 's' : ''} waiting for review.`,
      mood: 'professional',
      suggestedActions: ['Review Quotes', 'Later'],
    }
  }

  if (pendingCount > 0) {
    return {
      greeting: `${timeGreeting}`,
      subtext: `${pendingCount} item${pendingCount > 1 ? 's' : ''} waiting on you.`,
      mood: 'professional',
      suggestedActions: ['Show Me', 'Start Fresh'],
    }
  }

  return generateStandardGreeting(context)
}

/**
 * Long absence - missed them!
 */
function generateLongAbsenceGreeting(context: GreetingContext): GreetingResult {
  const name = context.memory.facts.preferredName || context.memory.facts.name?.split(' ')[0]
  const daysAway = Math.floor(context.hoursSinceLastSeen / 24)

  if (daysAway >= 30) {
    return {
      greeting: name
        ? `${name}. It's been a while.`
        : "It's been a while.",
      subtext: `${daysAway} days, but I've been keeping an eye on opportunities for you.`,
      mood: 'warm',
      suggestedActions: ['Show What You Found', 'Start Fresh'],
    }
  }

  if (daysAway >= 14) {
    return {
      greeting: name
        ? `${name}! Good to see you again.`
        : 'Good to see you again!',
      subtext: `Two weeks is a long time. I've learned some things while you were away.`,
      mood: 'warm',
    }
  }

  if (daysAway >= 7) {
    return {
      greeting: name
        ? `Welcome back, ${name}.`
        : 'Welcome back.',
      subtext: "A week away, but I kept things running.",
      mood: 'warm',
    }
  }

  // 2-6 days
  return {
    greeting: name
      ? `${name}! Been a few days.`
      : 'Been a few days!',
    subtext: "Ready to pick up where we left off?",
    mood: 'casual',
  }
}

/**
 * Standard greeting - based on time and relationship
 */
function generateStandardGreeting(context: GreetingContext): GreetingResult {
  const name = context.memory.facts.preferredName || context.memory.facts.name?.split(' ')[0]
  const trustTier = context.memory.history.trustTier

  // Build time-appropriate greeting
  const timeGreeting = getTimeOfDayGreeting(context.timeOfDay, name)

  // Adjust based on trust level
  switch (trustTier) {
    case 'guardian':
    case 'trusted':
      return generateTrustedGreeting(context, timeGreeting)

    case 'established':
      return generateEstablishedGreeting(context, timeGreeting)

    case 'developing':
      return generateDevelopingGreeting(context, timeGreeting)

    default:
      return generateNewUserGreeting(context, timeGreeting)
  }
}

/**
 * Trusted relationship greeting - warm and familiar
 */
function generateTrustedGreeting(context: GreetingContext, timeGreeting: string): GreetingResult {
  const lastTopic = context.memory.recentContext.lastTopic

  const greetings = [
    {
      greeting: timeGreeting,
      subtext: lastTopic
        ? `Still thinking about ${lastTopic.toLowerCase()}?`
        : "What shall we tackle today?",
      mood: 'warm' as const,
    },
    {
      greeting: timeGreeting,
      subtext: `${context.memory.history.successfulDeals} deals together. What's next?`,
      mood: 'warm' as const,
    },
    {
      greeting: timeGreeting,
      subtext: "I've got some ideas when you're ready.",
      mood: 'casual' as const,
    },
  ]

  return greetings[Math.floor(Math.random() * greetings.length)]
}

/**
 * Established relationship greeting
 */
function generateEstablishedGreeting(context: GreetingContext, timeGreeting: string): GreetingResult {
  const industry = context.memory.facts.industry
  const company = context.memory.facts.company

  const greetings = [
    {
      greeting: timeGreeting,
      subtext: 'Ready when you are.',
      mood: 'professional' as const,
    },
    {
      greeting: timeGreeting,
      subtext: company
        ? `How are things at ${company}?`
        : "What can I help you with?",
      mood: 'warm' as const,
    },
    {
      greeting: timeGreeting,
      subtext: industry
        ? `Any interesting ${industry.toLowerCase()} developments?`
        : "What's on your mind?",
      mood: 'casual' as const,
    },
  ]

  return greetings[Math.floor(Math.random() * greetings.length)]
}

/**
 * Developing relationship greeting
 */
function generateDevelopingGreeting(context: GreetingContext, timeGreeting: string): GreetingResult {
  return {
    greeting: timeGreeting,
    subtext: "I'm still learning about you. Tell me more about what you need.",
    mood: 'professional',
  }
}

/**
 * New user greeting (after first visit)
 */
function generateNewUserGreeting(context: GreetingContext, timeGreeting: string): GreetingResult {
  return {
    greeting: timeGreeting,
    subtext: "We're just getting started. What brings you here today?",
    mood: 'professional',
  }
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

function buildGreetingContext(userId: string, memory: WellsMemory): GreetingContext {
  const now = new Date()
  const hour = now.getHours()

  let timeOfDay: GreetingContext['timeOfDay']
  if (hour >= 5 && hour < 12) timeOfDay = 'morning'
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon'
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening'
  else timeOfDay = 'night'

  const hoursSinceLastSeen = hoursSince(memory.history.lastInteraction)
  const daysSinceFirstContact = daysSince(memory.history.firstContact)

  // Check for special occasions
  let specialOccasion: SpecialOccasion | undefined

  if (daysSinceFirstContact === 7) {
    specialOccasion = {
      type: 'first_week',
      title: 'One Week Together',
      message: "It's been a week since we started working together.",
    }
  } else if (daysSinceFirstContact === 30) {
    specialOccasion = {
      type: 'first_month',
      title: 'One Month Together',
      message: "A month of partnership!",
    }
  } else if (daysSinceFirstContact % 365 === 0 && daysSinceFirstContact > 0) {
    const years = daysSinceFirstContact / 365
    specialOccasion = {
      type: 'anniversary',
      title: `${years} Year${years > 1 ? 's' : ''} Together`,
      message: `${years} year${years > 1 ? 's' : ''} of partnership.`,
    }
  }

  // Check for uncelebrated milestones
  const uncelebratedMilestone = memory.history.milestones.find(m => !m.celebrated)
  if (uncelebratedMilestone) {
    specialOccasion = {
      type: 'milestone',
      title: uncelebratedMilestone.title,
      message: uncelebratedMilestone.description,
    }
  }

  return {
    userId,
    memory,
    currentHour: hour,
    timeOfDay,
    hoursSinceLastSeen,
    daysSinceFirstContact,
    isFirstVisit: memory.history.totalInteractions === 0,
    hasRecentSuccess: memory.history.successfulDeals > 0 && hoursSinceLastSeen < 48,
    hasPendingItems: memory.recentContext.pendingActions.length > 0 ||
      memory.recentContext.openQuestions.length > 0,
    hasUpcomingDeadline: memory.recentContext.pendingActions.some(
      a => a.priority === 'critical' || a.priority === 'high'
    ),
    isLongAbsence: hoursSinceLastSeen > 48,
    specialOccasion,
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getTimeOfDayGreeting(timeOfDay: string, name?: string): string {
  const greetings: Record<string, string[]> = {
    morning: [
      'Good morning',
      'Morning',
      'Rise and shine',
    ],
    afternoon: [
      'Good afternoon',
      'Afternoon',
      'Hey there',
    ],
    evening: [
      'Good evening',
      'Evening',
      'Hey',
    ],
    night: [
      'Working late',
      'Burning the midnight oil',
      'Night owl mode',
    ],
  }

  const options = greetings[timeOfDay] || greetings.afternoon
  const base = options[Math.floor(Math.random() * options.length)]

  if (name) {
    if (base.endsWith('late') || base.endsWith('oil') || base.endsWith('mode')) {
      return `${base}, ${name}?`
    }
    return `${base}, ${name}.`
  }

  if (base.endsWith('late') || base.endsWith('oil') || base.endsWith('mode')) {
    return `${base}?`
  }

  return `${base}.`
}

/**
 * Generate a quick one-liner greeting
 */
export async function generateQuickGreeting(userId: string): Promise<string> {
  try {
    const memory = await getMemory(userId)
    if (!memory) return "Hey there!"

    const name = memory.facts.preferredName || memory.facts.name?.split(' ')[0]
    const hour = new Date().getHours()

    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
    if (hour >= 5 && hour < 12) timeOfDay = 'morning'
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon'
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening'
    else timeOfDay = 'night'

    return getTimeOfDayGreeting(timeOfDay, name)
  } catch {
    return "Hello!"
  }
}

/**
 * Generate a return greeting after absence
 */
export async function generateReturnGreeting(userId: string): Promise<GreetingResult> {
  const memory = await getMemory(userId)
  if (!memory) return generateFirstVisitGreeting()

  const context = buildGreetingContext(userId, memory)
  return generateLongAbsenceGreeting(context)
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GreetingService = {
  generateGreeting,
  generateQuickGreeting,
  generateReturnGreeting,
}

export default GreetingService
