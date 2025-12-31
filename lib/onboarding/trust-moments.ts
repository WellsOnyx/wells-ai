/**
 * Wells AI Trust Moments Orchestration
 *
 * Trust-building moments throughout onboarding that make users think
 * "wow, this is different." These are subtle asides from Wells that
 * demonstrate capability, build trust, and create connection.
 */

// ============================================================================
// TYPES
// ============================================================================

export type TrustMomentType =
  | 'instant-understanding'
  | 'speed-demo'
  | 'privacy-promise'
  | 'ai-to-ai-explainer'
  | 'live-activity'
  | 'honesty-moment'
  | 'control-reminder'

export type TrustMomentTrigger =
  | 'user-input-complete'      // After user finishes describing need
  | 'before-sensitive-info'    // Before asking for budget/timeline
  | 'onboarding-start'         // Early in onboarding
  | 'onboarding-midpoint'      // Middle of onboarding
  | 'before-commitment'        // Before any action requiring approval
  | 'after-first-match'        // After showing first results
  | 'random-ambient'           // Can appear naturally in flow

export interface TrustMoment {
  id: TrustMomentType
  title: string
  trigger: TrustMomentTrigger[]
  priority: number // 1-10, higher = more important to show
  duration: number // ms to display minimum
  canDismiss: boolean
  showOnce: boolean // Only show once per user
  cooldown: number // ms before can show again (if showOnce=false)
}

export interface TrustMomentState {
  shownMoments: TrustMomentType[]
  lastShown: Record<TrustMomentType, number> // timestamp
  dismissedMoments: TrustMomentType[]
}

export interface UserInputSummary {
  category?: string
  quantity?: string
  material?: string
  timeline?: string
  budget?: string
  specialRequirements?: string[]
  raw: string
}

// ============================================================================
// TRUST MOMENT CONFIGURATIONS
// ============================================================================

export const TRUST_MOMENTS: Record<TrustMomentType, TrustMoment> = {
  'instant-understanding': {
    id: 'instant-understanding',
    title: 'Instant Understanding',
    trigger: ['user-input-complete'],
    priority: 10,
    duration: 5000,
    canDismiss: true,
    showOnce: false,
    cooldown: 60000, // 1 minute
  },
  'speed-demo': {
    id: 'speed-demo',
    title: 'Speed Demo',
    trigger: ['after-first-match', 'user-input-complete'],
    priority: 9,
    duration: 8000,
    canDismiss: false, // Let it complete
    showOnce: true,
    cooldown: 0,
  },
  'privacy-promise': {
    id: 'privacy-promise',
    title: 'Privacy Promise',
    trigger: ['before-sensitive-info'],
    priority: 10,
    duration: 6000,
    canDismiss: true,
    showOnce: true,
    cooldown: 0,
  },
  'ai-to-ai-explainer': {
    id: 'ai-to-ai-explainer',
    title: 'AI-to-AI Model',
    trigger: ['onboarding-midpoint', 'before-commitment'],
    priority: 8,
    duration: 10000,
    canDismiss: true,
    showOnce: true,
    cooldown: 0,
  },
  'live-activity': {
    id: 'live-activity',
    title: 'Live Activity',
    trigger: ['random-ambient', 'onboarding-start'],
    priority: 5,
    duration: 4000,
    canDismiss: true,
    showOnce: false,
    cooldown: 120000, // 2 minutes
  },
  'honesty-moment': {
    id: 'honesty-moment',
    title: 'The Guarantee',
    trigger: ['onboarding-midpoint', 'before-commitment'],
    priority: 7,
    duration: 5000,
    canDismiss: true,
    showOnce: true,
    cooldown: 0,
  },
  'control-reminder': {
    id: 'control-reminder',
    title: 'Control Reminder',
    trigger: ['before-commitment', 'onboarding-midpoint'],
    priority: 9,
    duration: 5000,
    canDismiss: true,
    showOnce: true,
    cooldown: 0,
  },
}

// ============================================================================
// TRUST MOMENT MANAGER
// ============================================================================

const STORAGE_KEY = 'wells-trust-moments'

export class TrustMomentManager {
  private state: TrustMomentState

  constructor() {
    this.state = this.loadState()
  }

  /**
   * Load state from localStorage
   */
  private loadState(): TrustMomentState {
    if (typeof window === 'undefined') {
      return {
        shownMoments: [],
        lastShown: {} as Record<TrustMomentType, number>,
        dismissedMoments: [],
      }
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Error loading trust moment state:', e)
    }

    return {
      shownMoments: [],
      lastShown: {} as Record<TrustMomentType, number>,
      dismissedMoments: [],
    }
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch (e) {
      console.error('Error saving trust moment state:', e)
    }
  }

  /**
   * Check if a moment can be shown based on rules
   */
  canShowMoment(momentId: TrustMomentType): boolean {
    const moment = TRUST_MOMENTS[momentId]
    if (!moment) return false

    // Check if dismissed
    if (this.state.dismissedMoments.includes(momentId)) {
      return false
    }

    // Check if showOnce and already shown
    if (moment.showOnce && this.state.shownMoments.includes(momentId)) {
      return false
    }

    // Check cooldown
    const lastShown = this.state.lastShown[momentId]
    if (lastShown && moment.cooldown > 0) {
      const elapsed = Date.now() - lastShown
      if (elapsed < moment.cooldown) {
        return false
      }
    }

    return true
  }

  /**
   * Get the best moment to show for a given trigger
   */
  getMomentForTrigger(trigger: TrustMomentTrigger): TrustMomentType | null {
    const candidates = Object.values(TRUST_MOMENTS)
      .filter((m) => m.trigger.includes(trigger))
      .filter((m) => this.canShowMoment(m.id))
      .sort((a, b) => b.priority - a.priority)

    return candidates[0]?.id || null
  }

  /**
   * Mark a moment as shown
   */
  markShown(momentId: TrustMomentType): void {
    if (!this.state.shownMoments.includes(momentId)) {
      this.state.shownMoments.push(momentId)
    }
    this.state.lastShown[momentId] = Date.now()
    this.saveState()
  }

  /**
   * Mark a moment as dismissed
   */
  markDismissed(momentId: TrustMomentType): void {
    if (!this.state.dismissedMoments.includes(momentId)) {
      this.state.dismissedMoments.push(momentId)
    }
    this.saveState()
  }

  /**
   * Reset all trust moment state (for testing)
   */
  reset(): void {
    this.state = {
      shownMoments: [],
      lastShown: {} as Record<TrustMomentType, number>,
      dismissedMoments: [],
    }
    this.saveState()
  }

  /**
   * Get progress through trust moments (for analytics)
   */
  getProgress(): {
    shown: number
    total: number
    percentage: number
  } {
    const total = Object.keys(TRUST_MOMENTS).length
    const shown = this.state.shownMoments.length
    return {
      shown,
      total,
      percentage: Math.round((shown / total) * 100),
    }
  }
}

// ============================================================================
// INSTANT UNDERSTANDING HELPERS
// ============================================================================

/**
 * Parse user input into structured summary for reflection
 */
export function parseUserInput(input: string): UserInputSummary {
  const summary: UserInputSummary = { raw: input }

  // Extract category/product type
  const categoryPatterns = [
    /need(?:ing)?\s+(.+?)(?:\s+for|\s+about|\s*,|\s*\.)/i,
    /looking for\s+(.+?)(?:\s+for|\s+about|\s*,|\s*\.)/i,
    /want(?:ing)?\s+(.+?)(?:\s+for|\s+about|\s*,|\s*\.)/i,
    /buy(?:ing)?\s+(.+?)(?:\s+for|\s+about|\s*,|\s*\.)/i,
    /(packaging|boxes|labels|bottles|containers|supplies)/i,
  ]

  for (const pattern of categoryPatterns) {
    const match = input.match(pattern)
    if (match) {
      summary.category = match[1].trim()
      break
    }
  }

  // Extract quantity
  const quantityPatterns = [
    /(\d+[,\d]*)\s*(?:units?|pcs?|pieces?|items?|boxes?)/i,
    /about\s*(\d+[,\d]*)\s*(?:units?|pcs?|pieces?|items?|boxes?)?/i,
    /(?:roughly|around|approximately)\s*(\d+[,\d]*)/i,
    /(\d+[kK])\s*(?:units?)?/i,
  ]

  for (const pattern of quantityPatterns) {
    const match = input.match(pattern)
    if (match) {
      summary.quantity = match[1].replace(/,/g, '')
      // Convert 10K to 10000
      if (summary.quantity.toLowerCase().endsWith('k')) {
        summary.quantity =
          String(parseInt(summary.quantity) * 1000)
      }
      break
    }
  }

  // Extract material preferences
  const materialPatterns = [
    /(eco-friendly|sustainable|recycled|biodegradable|green|organic)/i,
    /(plastic|glass|cardboard|paper|metal|aluminum|kraft)/i,
    /(premium|luxury|custom|branded)/i,
  ]

  for (const pattern of materialPatterns) {
    const match = input.match(pattern)
    if (match) {
      summary.material = match[1].toLowerCase()
      break
    }
  }

  // Extract timeline
  const timelinePatterns = [
    /(?:within|in)\s*(\d+)\s*(days?|weeks?|months?)/i,
    /(?:by|before)\s+(next week|end of month|next month|asap)/i,
    /(urgent|rush|asap|quickly)/i,
  ]

  for (const pattern of timelinePatterns) {
    const match = input.match(pattern)
    if (match) {
      if (match[2]) {
        summary.timeline = `${match[1]} ${match[2]}`
      } else {
        summary.timeline = match[1]
      }
      break
    }
  }

  // Extract budget hints
  const budgetPatterns = [
    /budget(?:\s+of)?\s*\$?(\d+[,\d]*(?:\.\d{2})?)/i,
    /(?:under|below|less than)\s*\$?(\d+[,\d]*)/i,
    /\$(\d+[,\d]*(?:\.\d{2})?)\s*(?:per|each|unit)?/i,
  ]

  for (const pattern of budgetPatterns) {
    const match = input.match(pattern)
    if (match) {
      summary.budget = match[1].replace(/,/g, '')
      break
    }
  }

  return summary
}

/**
 * Generate a reflection statement from parsed input
 */
export function generateReflection(summary: UserInputSummary): string {
  const parts: string[] = []

  if (summary.category) {
    parts.push(`you need ${summary.category}`)
  }

  if (summary.quantity) {
    const qty = parseInt(summary.quantity)
    const formatted =
      qty >= 1000 ? `${(qty / 1000).toFixed(0)}K` : qty.toString()
    parts.push(`roughly ${formatted} units`)
  }

  if (summary.material) {
    parts.push(`${summary.material} materials`)
  }

  if (summary.timeline) {
    parts.push(`within ${summary.timeline}`)
  }

  if (parts.length === 0) {
    return "I understood your requirements. Let me make sure I've got this right..."
  }

  const joined = parts.join(', ')
  return `So ${joined}. Did I get that right?`
}

// ============================================================================
// LIVE ACTIVITY DATA
// ============================================================================

export interface LiveActivityItem {
  type: 'deals_closed' | 'negotiations_active' | 'savings' | 'matches_made'
  metric: string
  timeframe: string
}

/**
 * Generate realistic-feeling live activity data
 */
export function generateLiveActivity(): LiveActivityItem[] {
  const baseDeals = 40 + Math.floor(Math.random() * 20)
  const baseSavings = 15 + Math.floor(Math.random() * 8)
  const activeNegotiations = 8 + Math.floor(Math.random() * 8)
  const recentClosed = 2 + Math.floor(Math.random() * 4)

  return [
    {
      type: 'deals_closed',
      metric: `${baseDeals} buyers`,
      timeframe: 'Last week',
    },
    {
      type: 'savings',
      metric: `${baseSavings}%`,
      timeframe: 'Average savings',
    },
    {
      type: 'negotiations_active',
      metric: `${activeNegotiations} deals`,
      timeframe: 'Negotiating right now',
    },
    {
      type: 'matches_made',
      metric: `${recentClosed} deals`,
      timeframe: 'Closed in the last hour',
    },
  ]
}

// ============================================================================
// SPEED DEMO STAGES
// ============================================================================

export interface SpeedDemoStage {
  id: string
  text: string
  duration: number // ms
  icon: 'search' | 'filter' | 'analyze' | 'check'
  count?: number
}

export function generateSpeedDemoStages(category?: string): SpeedDemoStage[] {
  const supplierCount = 2000 + Math.floor(Math.random() * 1500)
  const matchCount = 15 + Math.floor(Math.random() * 20)
  const topCount = 3

  return [
    {
      id: 'searching',
      text: `Searching ${supplierCount.toLocaleString()} suppliers...`,
      duration: 1500,
      icon: 'search',
      count: supplierCount,
    },
    {
      id: 'found',
      text: `Found ${matchCount} matches`,
      duration: 1200,
      icon: 'filter',
      count: matchCount,
    },
    {
      id: 'analyzing',
      text: 'Analyzing pricing and reliability...',
      duration: 1800,
      icon: 'analyze',
    },
    {
      id: 'ready',
      text: `Top ${topCount} ready for you`,
      duration: 1000,
      icon: 'check',
      count: topCount,
    },
  ]
}

// ============================================================================
// ANIMATION TIMING HELPERS
// ============================================================================

export const TRUST_MOMENT_ANIMATIONS = {
  enter: {
    duration: 400,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)', // ease-out-expo
  },
  exit: {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  glow: {
    duration: 2000,
    easing: 'ease-in-out',
  },
} as const

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'

export function useTrustMoments() {
  const managerRef = useRef<TrustMomentManager | null>(null)
  const [activeMoment, setActiveMoment] = useState<TrustMomentType | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Initialize manager on client side
  useEffect(() => {
    managerRef.current = new TrustMomentManager()
  }, [])

  const showMoment = useCallback((momentId: TrustMomentType) => {
    if (!managerRef.current) return false
    if (!managerRef.current.canShowMoment(momentId)) return false

    setActiveMoment(momentId)
    setIsVisible(true)
    managerRef.current.markShown(momentId)

    return true
  }, [])

  const triggerMoment = useCallback((trigger: TrustMomentTrigger) => {
    if (!managerRef.current) return null

    const momentId = managerRef.current.getMomentForTrigger(trigger)
    if (momentId) {
      showMoment(momentId)
      return momentId
    }
    return null
  }, [showMoment])

  const dismissMoment = useCallback(() => {
    if (activeMoment && managerRef.current) {
      const moment = TRUST_MOMENTS[activeMoment]
      if (moment.canDismiss) {
        managerRef.current.markDismissed(activeMoment)
      }
    }
    setIsVisible(false)
    setTimeout(() => setActiveMoment(null), TRUST_MOMENT_ANIMATIONS.exit.duration)
  }, [activeMoment])

  const hideMoment = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => setActiveMoment(null), TRUST_MOMENT_ANIMATIONS.exit.duration)
  }, [])

  const canShow = useCallback((momentId: TrustMomentType) => {
    if (!managerRef.current) return false
    return managerRef.current.canShowMoment(momentId)
  }, [])

  const getProgress = useCallback(() => {
    if (!managerRef.current) return { shown: 0, total: 7, percentage: 0 }
    return managerRef.current.getProgress()
  }, [])

  const reset = useCallback(() => {
    managerRef.current?.reset()
    setActiveMoment(null)
    setIsVisible(false)
  }, [])

  return {
    activeMoment,
    isVisible,
    showMoment,
    triggerMoment,
    dismissMoment,
    hideMoment,
    canShow,
    getProgress,
    reset,
  }
}
