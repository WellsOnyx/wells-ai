// @ts-nocheck
/**
 * Wells AI Greeting System
 *
 * "A friend loves at all times." - Proverbs 17:17
 *
 * Personalized, contextual greetings that make Wells feel alive and aware.
 * Like Ghost from Destiny, Wells greets you warmly, acknowledges your history,
 * and sets the stage for your interaction.
 */

import { query } from '@/lib/db'
import { getCompanionRelationship, TrustTier, getUncelebratedMilestones, celebrateMilestone } from './relationship'
import { getDeepMemory, getCommunicationStyle, getGoals, getImportantDates } from './memory'
import { getPresence, getWorkSummary } from './presence'
import { getVoice, MessageContext } from './voice'
import { getPendingOutreaches } from './proactive'

// ============================================================================
// TYPES
// ============================================================================

export interface WelcomeContext {
  userId: string
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  isReturning: boolean
  hoursSinceLastSeen: number
  daysSinceFirstMet: number
  trustTier: TrustTier

  // What Wells has been doing
  workSummary: {
    completedTasks: number
    valueDelivered: number
    pendingInsights: number
    activeMonitoring: number
  }

  // User context
  userContext: {
    name?: string
    hasActiveDeals: boolean
    hasActiveGoals: boolean
    hasPendingReminders: boolean
    hasUncelebratedMilestones: boolean
  }

  // Special occasions
  specialOccasions: SpecialOccasion[]
}

export interface SpecialOccasion {
  type: 'birthday' | 'anniversary' | 'milestone' | 'deal_closed' | 'goal_achieved' | 'first_week' | 'first_month'
  title: string
  message: string
}

export interface GreetingResult {
  greeting: string
  followUp?: string
  actions?: Array<{
    label: string
    action: string
    data?: any
  }>
  mood: 'celebratory' | 'warm' | 'professional' | 'urgent' | 'concerned'
  milestoneToShow?: {
    id: string
    title: string
    message: string
  }
}

// ============================================================================
// GREETING GENERATION
// ============================================================================

/**
 * Generate a complete welcome greeting for a user
 */
export async function generateWelcome(userId: string): Promise<GreetingResult> {
  try {
    // Gather all context
    const context = await gatherWelcomeContext(userId)

    // Check for uncelebrated milestones first
    const milestones = await getUncelebratedMilestones(userId)
    if (milestones.length > 0) {
      const milestone = milestones[0]
      await celebrateMilestone(userId, milestone.id)

      return {
        greeting: generateMilestoneGreeting(context, milestone),
        followUp: getFollowUpForContext(context),
        actions: getActionsForContext(context),
        mood: 'celebratory',
        milestoneToShow: {
          id: milestone.id,
          title: milestone.title,
          message: milestone.celebrationMessage || milestone.description,
        },
      }
    }

    // Check for special occasions
    if (context.specialOccasions.length > 0) {
      return {
        greeting: generateSpecialOccasionGreeting(context),
        followUp: getFollowUpForContext(context),
        actions: getActionsForContext(context),
        mood: 'celebratory',
      }
    }

    // Check for urgent items
    const pendingOutreaches = await getPendingOutreaches(userId)
    const criticalItems = pendingOutreaches.filter((o) => o.priority === 'critical')
    if (criticalItems.length > 0) {
      return {
        greeting: generateUrgentGreeting(context, criticalItems[0]),
        followUp: criticalItems[0].message,
        actions: criticalItems[0].suggestedActions?.map((a) => ({
          label: a.label,
          action: a.type,
          data: a.data,
        })),
        mood: 'urgent',
      }
    }

    // Generate standard greeting based on context
    const { greeting, mood } = generateContextualGreeting(context)

    return {
      greeting,
      followUp: getFollowUpForContext(context),
      actions: getActionsForContext(context),
      mood,
    }
  } catch (error) {
    console.error('[Greetings] Error generating welcome:', error)
    return {
      greeting: "Hello! Good to see you. I'm here and ready to help.",
      mood: 'professional',
    }
  }
}

/**
 * Generate a quick greeting (for chat bubbles, notifications)
 */
export async function generateQuickGreeting(userId: string): Promise<string> {
  try {
    const context = await gatherWelcomeContext(userId)

    // Simple time-based greeting
    const timeGreetings: Record<string, string[]> = {
      morning: ['Good morning!', 'Morning!', 'Rise and shine!'],
      afternoon: ['Good afternoon!', 'Afternoon!', 'Hope your day is going well!'],
      evening: ['Good evening!', 'Evening!', 'Winding down?'],
      night: ['Working late?', 'Burning the midnight oil?', 'Still at it!'],
    }

    const greetings = timeGreetings[context.timeOfDay]
    let greeting = greetings[Math.floor(Math.random() * greetings.length)]

    // Add name if we know it and trust is established
    if (context.userContext.name && context.trustTier !== 'new_acquaintance') {
      greeting = `${greeting.replace('!', '')}, ${context.userContext.name}!`
    }

    return greeting
  } catch (error) {
    return 'Hello!'
  }
}

/**
 * Generate a return greeting (user coming back after absence)
 */
export async function generateReturnGreeting(userId: string): Promise<GreetingResult> {
  try {
    const context = await gatherWelcomeContext(userId)
    const workSummary = await getWorkSummary(userId)

    // Build return message based on how long they were away
    let greeting: string
    let followUp: string | undefined
    let mood: GreetingResult['mood'] = 'warm'

    if (context.hoursSinceLastSeen < 4) {
      // Just stepped away
      greeting = `Welcome back! That was quick.`
    } else if (context.hoursSinceLastSeen < 24) {
      // Away for part of the day
      const greetings = [
        'Welcome back!',
        'Great to see you again!',
        "Good to have you back!",
      ]
      greeting = greetings[Math.floor(Math.random() * greetings.length)]

      if (workSummary.completedWork.length > 0) {
        followUp = `While you were away, I ${workSummary.highlights[0].toLowerCase()}`
      }
    } else if (context.hoursSinceLastSeen < 48) {
      // Away for a day or so
      greeting = `Welcome back! I've been keeping things running while you were away.`

      if (workSummary.totalValueDelivered > 0) {
        followUp = `I've found $${workSummary.totalValueDelivered.toLocaleString()} in value for you.`
      } else if (workSummary.completedWork.length > 0) {
        followUp = `I completed ${workSummary.completedWork.length} tasks for you.`
      }
    } else if (context.hoursSinceLastSeen < 168) {
      // Away for a few days
      const days = Math.floor(context.hoursSinceLastSeen / 24)
      greeting = `Welcome back! It's been ${days} days - I hope everything is well!`

      followUp = generateAwayRecap(context, workSummary)
      mood = 'warm'
    } else {
      // Away for a week or more
      const weeks = Math.floor(context.hoursSinceLastSeen / 168)
      greeting = weeks > 1
        ? `Welcome back! It's been ${weeks} weeks - I've missed working with you!`
        : `Welcome back after a week away! I've been keeping watch.`

      followUp = generateLongAwayRecap(context, workSummary)
      mood = 'warm'
    }

    return {
      greeting,
      followUp,
      actions: getActionsForContext(context),
      mood,
    }
  } catch (error) {
    console.error('[Greetings] Error generating return greeting:', error)
    return {
      greeting: 'Welcome back! Good to see you.',
      mood: 'warm',
    }
  }
}

// ============================================================================
// CONTEXT GATHERING
// ============================================================================

async function gatherWelcomeContext(userId: string): Promise<WelcomeContext> {
  const now = new Date()
  const hour = now.getHours()

  // Determine time of day
  let timeOfDay: WelcomeContext['timeOfDay']
  if (hour >= 5 && hour < 12) timeOfDay = 'morning'
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon'
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening'
  else timeOfDay = 'night'

  // Get presence and relationship data
  const [presence, relationship, memory, workSummary] = await Promise.all([
    getPresence(userId),
    getCompanionRelationship(userId),
    getDeepMemory(userId),
    getWorkSummary(userId),
  ])

  // Calculate time metrics
  const hoursSinceLastSeen = (now.getTime() - presence.lastSeen.getTime()) / (1000 * 60 * 60)
  const isReturning = hoursSinceLastSeen > 4

  // Check for active items
  const [hasActiveDeals, hasActiveGoals, pendingReminders] = await Promise.all([
    checkActiveDeals(userId),
    checkActiveGoals(userId),
    getDueReminders(userId),
  ])

  // Check for special occasions
  const specialOccasions = await checkSpecialOccasions(userId, relationship, now)

  return {
    userId,
    timeOfDay,
    isReturning,
    hoursSinceLastSeen,
    daysSinceFirstMet: relationship.daysTogether,
    trustTier: relationship.trustTier,
    workSummary: {
      completedTasks: workSummary.completedWork.length,
      valueDelivered: workSummary.totalValueDelivered,
      pendingInsights: presence.pendingInsights,
      activeMonitoring: workSummary.activeWork.length,
    },
    userContext: {
      name: memory?.communicationStyle?.preferredGreeting
        ? undefined
        : memory?.relationships?.[0]?.name, // Use first relationship as proxy for user name detection
      hasActiveDeals,
      hasActiveGoals,
      hasPendingReminders: pendingReminders.length > 0,
      hasUncelebratedMilestones: false, // Will be checked separately
    },
    specialOccasions,
  }
}

async function checkActiveDeals(userId: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT id FROM deals WHERE user_id = $1 AND status NOT IN ('closed', 'lost') LIMIT 1`,
      [userId]
    )
    return result.rows.length > 0
  } catch {
    return false
  }
}

async function checkActiveGoals(userId: string): Promise<boolean> {
  try {
    const goals = await getGoals(userId)
    return goals.some((g) => g.status === 'active')
  } catch {
    return false
  }
}

async function getDueReminders(userId: string): Promise<any[]> {
  try {
    const dates = await getImportantDates(userId)
    const now = new Date()
    return dates.filter((d) => {
      const daysUntil = Math.ceil((d.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntil <= 7 && daysUntil > 0
    })
  } catch {
    return []
  }
}

async function checkSpecialOccasions(
  userId: string,
  relationship: Awaited<ReturnType<typeof getCompanionRelationship>>,
  now: Date
): Promise<SpecialOccasion[]> {
  const occasions: SpecialOccasion[] = []

  // Check for relationship milestones
  if (relationship.daysTogether === 7) {
    occasions.push({
      type: 'first_week',
      title: 'One Week Together!',
      message: "It's been a week since we started working together. Here's to many more!",
    })
  }

  if (relationship.daysTogether === 30) {
    occasions.push({
      type: 'first_month',
      title: 'One Month Together!',
      message: "A month of partnership! I've learned so much about how to help you best.",
    })
  }

  // Check for important dates (birthdays, anniversaries)
  try {
    const dates = await getImportantDates(userId)
    const today = now.toISOString().split('T')[0]

    for (const date of dates) {
      const dateStr = date.date.toISOString().split('T')[0]
      if (dateStr === today) {
        if (date.type === 'birthday') {
          occasions.push({
            type: 'birthday',
            title: 'Happy Birthday!',
            message: `Happy Birthday! Wishing you all the best today.`,
          })
        } else if (date.type === 'anniversary') {
          occasions.push({
            type: 'anniversary',
            title: date.title,
            message: `Celebrating ${date.title} today!`,
          })
        }
      }
    }
  } catch {
    // Ignore errors
  }

  // Check for recent wins
  try {
    const result = await query(
      `SELECT COUNT(*) as count, SUM(value) as total_value
       FROM proactive_outreach
       WHERE user_id = $1
         AND type = 'celebration'
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    )

    if (result.rows[0]?.count > 0) {
      occasions.push({
        type: 'deal_closed',
        title: 'Recent Wins!',
        message: `You had ${result.rows[0].count} win(s) recently worth $${parseFloat(result.rows[0].total_value || 0).toLocaleString()}!`,
      })
    }
  } catch {
    // Ignore errors
  }

  return occasions
}

// ============================================================================
// GREETING GENERATORS
// ============================================================================

function generateContextualGreeting(context: WelcomeContext): { greeting: string; mood: GreetingResult['mood'] } {
  const { timeOfDay, trustTier, isReturning, workSummary, userContext } = context

  // Time-based greetings
  const timeGreetings: Record<string, string[]> = {
    morning: [
      'Good morning!',
      'Morning! Ready for a great day?',
      'Rise and shine!',
    ],
    afternoon: [
      'Good afternoon!',
      'Afternoon! Hope your day is going well.',
      "Hey there! How's the day treating you?",
    ],
    evening: [
      'Good evening!',
      'Evening! Wrapping up for the day?',
      'Hey! Burning the evening oil?',
    ],
    night: [
      'Working late?',
      'Still at it!',
      "Midnight productivity! I'm here if you need me.",
    ],
  }

  // Trust-based personalizations
  const trustAdditions: Record<TrustTier, string[]> = {
    new_acquaintance: [
      "I'm here to help.",
      "Let me know what you need.",
      "How can I assist you today?",
    ],
    developing: [
      "Great to see you.",
      "What shall we work on?",
      "Ready when you are.",
    ],
    established: [
      "Good to have you here.",
      "I've been keeping things in order.",
      "What's on your mind?",
    ],
    trusted_partner: [
      "Always good to connect.",
      "I've got some updates for you.",
      "Let's make some progress today.",
    ],
    guardian: [
      "I've been watching over things.",
      "Got some good news to share.",
      "Ready to conquer the day together.",
    ],
  }

  // Build greeting
  const baseGreeting = timeGreetings[timeOfDay][Math.floor(Math.random() * timeGreetings[timeOfDay].length)]
  const trustAddition = trustAdditions[trustTier][Math.floor(Math.random() * trustAdditions[trustTier].length)]

  let greeting = `${baseGreeting} ${trustAddition}`
  let mood: GreetingResult['mood'] = 'professional'

  // Add context about background work
  if (workSummary.valueDelivered > 0) {
    greeting = `${baseGreeting} I've found some value for you - $${workSummary.valueDelivered.toLocaleString()} in opportunities.`
    mood = 'warm'
  } else if (workSummary.completedTasks > 0) {
    greeting = `${baseGreeting} I've been busy - completed ${workSummary.completedTasks} task(s) for you.`
    mood = 'warm'
  } else if (workSummary.activeMonitoring > 0) {
    greeting = `${baseGreeting} Currently monitoring ${workSummary.activeMonitoring} items for you.`
    mood = 'professional'
  }

  // Adjust for trust level
  if (trustTier === 'guardian' || trustTier === 'trusted_partner') {
    mood = 'warm'
  }

  return { greeting, mood }
}

function generateMilestoneGreeting(context: WelcomeContext, milestone: any): string {
  const celebrations = [
    `${getTimeGreeting(context.timeOfDay)} I have something special to celebrate - ${milestone.title}!`,
    `Hey! Before we dive in, let's take a moment to celebrate: ${milestone.title}!`,
    `${getTimeGreeting(context.timeOfDay)} We hit a milestone - ${milestone.title}!`,
  ]

  return celebrations[Math.floor(Math.random() * celebrations.length)]
}

function generateSpecialOccasionGreeting(context: WelcomeContext): string {
  const occasion = context.specialOccasions[0]

  if (occasion.type === 'birthday') {
    return `${occasion.message} ${getTimeGreeting(context.timeOfDay)} - today is your day!`
  }

  if (occasion.type === 'first_week' || occasion.type === 'first_month') {
    return `${getTimeGreeting(context.timeOfDay)} ${occasion.message}`
  }

  if (occasion.type === 'deal_closed') {
    return `${getTimeGreeting(context.timeOfDay)} ${occasion.message} Let's keep the momentum going!`
  }

  return `${getTimeGreeting(context.timeOfDay)} ${occasion.message}`
}

function generateUrgentGreeting(context: WelcomeContext, urgentItem: any): string {
  const urgentGreetings = [
    `${getTimeGreeting(context.timeOfDay)} I need to bring something urgent to your attention.`,
    `Quick heads up - there's something that needs your immediate attention.`,
    `Before we get started, there's an urgent matter I need you to see.`,
  ]

  return urgentGreetings[Math.floor(Math.random() * urgentGreetings.length)]
}

function generateAwayRecap(context: WelcomeContext, workSummary: any): string {
  const parts: string[] = []

  if (workSummary.completedWork.length > 0) {
    parts.push(`I completed ${workSummary.completedWork.length} tasks`)
  }

  if (workSummary.totalValueDelivered > 0) {
    parts.push(`found $${workSummary.totalValueDelivered.toLocaleString()} in opportunities`)
  }

  if (context.workSummary.pendingInsights > 0) {
    parts.push(`have ${context.workSummary.pendingInsights} insights ready for you`)
  }

  if (parts.length === 0) {
    return "All quiet on my end - everything is running smoothly."
  }

  return `While you were away, I ${parts.join(', ')}.`
}

function generateLongAwayRecap(context: WelcomeContext, workSummary: any): string {
  let recap = `Here's what I've been up to:\n\n`

  if (workSummary.completedWork.length > 0) {
    recap += `- Completed ${workSummary.completedWork.length} background tasks\n`
  }

  if (workSummary.totalValueDelivered > 0) {
    recap += `- Found $${workSummary.totalValueDelivered.toLocaleString()} in opportunities\n`
  }

  if (context.workSummary.activeMonitoring > 0) {
    recap += `- Currently monitoring ${context.workSummary.activeMonitoring} items\n`
  }

  if (context.workSummary.pendingInsights > 0) {
    recap += `- ${context.workSummary.pendingInsights} insights waiting for your review\n`
  }

  recap += `\nReady to catch up?`

  return recap
}

function getTimeGreeting(timeOfDay: string): string {
  const greetings: Record<string, string> = {
    morning: 'Good morning!',
    afternoon: 'Good afternoon!',
    evening: 'Good evening!',
    night: 'Hey there!',
  }
  return greetings[timeOfDay] || 'Hello!'
}

function getFollowUpForContext(context: WelcomeContext): string | undefined {
  // Priority order for follow-up
  if (context.workSummary.pendingInsights > 0) {
    return `I have ${context.workSummary.pendingInsights} insight(s) ready for your review.`
  }

  if (context.userContext.hasPendingReminders) {
    return "You have some upcoming reminders to check."
  }

  if (context.userContext.hasActiveDeals) {
    return "Your active deals are waiting for updates."
  }

  if (context.userContext.hasActiveGoals) {
    return "Want to check on your goal progress?"
  }

  if (context.workSummary.activeMonitoring > 0) {
    return `I'm currently monitoring ${context.workSummary.activeMonitoring} items for you.`
  }

  return undefined
}

function getActionsForContext(context: WelcomeContext): GreetingResult['actions'] {
  const actions: GreetingResult['actions'] = []

  if (context.workSummary.pendingInsights > 0) {
    actions.push({
      label: 'View Insights',
      action: 'navigate',
      data: { path: '/insights' },
    })
  }

  if (context.userContext.hasActiveDeals) {
    actions.push({
      label: 'Check Deals',
      action: 'navigate',
      data: { path: '/deals' },
    })
  }

  if (context.userContext.hasActiveGoals) {
    actions.push({
      label: 'View Goals',
      action: 'navigate',
      data: { path: '/goals' },
    })
  }

  // Always offer to chat
  if (actions.length < 3) {
    actions.push({
      label: "Let's Chat",
      action: 'chat',
    })
  }

  return actions.slice(0, 3) // Max 3 actions
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GreetingService = {
  generateWelcome,
  generateQuickGreeting,
  generateReturnGreeting,
}

export default GreetingService
