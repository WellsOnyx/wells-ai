/**
 * Journey Router - Unified routing system for WellsAI
 *
 * Detects user intent from signup answers and routes to the correct journey.
 * Supports multi-journey users (a CFO might need treasury + sourcing).
 * Remembers user context across journeys.
 */

// ============================================================================
// TYPES
// ============================================================================

export type UserRole = 'cfo' | 'controller' | 'procurement' | 'founder' | 'hr' | 'sales' | 'other'

export type UserNeed =
  | 'treasury'      // Cash management, payments, GRAIN
  | 'payments'      // AP/AR, invoicing
  | 'sourcing'      // Finding suppliers, RFQs
  | 'hiring'        // Recruiting, jobs
  | 'selling'       // Finding customers, leads
  | 'all'           // Everything

export type JourneyType = 'founder' | 'buyer' | 'seller' | 'jobs' | 'treasury'

export interface UserContext {
  userId: string
  email: string
  companyName?: string
  role: UserRole
  needs: UserNeed[]
  primaryJourney: JourneyType
  activeJourneys: JourneyType[]
  erpConnected: boolean
  erpSystem?: string
  grainBalance?: number
  onboardingComplete: boolean
  createdAt: Date
  lastActiveAt: Date
}

export interface SignupData {
  email: string
  companyName?: string
  role: UserRole
  needs: UserNeed[]
  erpSystem?: string
  referralCode?: string
}

export interface JourneyRoute {
  path: string
  name: string
  description: string
  icon: string
  color: string
  gradient: string
}

// ============================================================================
// JOURNEY CONFIGURATION
// ============================================================================

export const JOURNEY_ROUTES: Record<JourneyType, JourneyRoute> = {
  founder: {
    path: '/dashboard?journey=founder',
    name: 'Founder Mode',
    description: 'Build and scale your business',
    icon: 'Rocket',
    color: 'gold',
    gradient: 'from-amber-500 to-orange-600',
  },
  buyer: {
    path: '/dashboard?journey=buyer',
    name: 'Sourcing',
    description: 'Find and manage suppliers',
    icon: 'ShoppingCart',
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-600',
  },
  seller: {
    path: '/dashboard?journey=seller',
    name: 'Sales',
    description: 'Find and close customers',
    icon: 'Store',
    color: 'green',
    gradient: 'from-green-500 to-emerald-600',
  },
  jobs: {
    path: '/dashboard?journey=jobs',
    name: 'Hiring',
    description: 'Find and recruit talent',
    icon: 'Briefcase',
    color: 'purple',
    gradient: 'from-purple-500 to-pink-600',
  },
  treasury: {
    path: '/grain-vault/dashboard',
    name: 'Treasury',
    description: 'Manage cash and payments',
    icon: 'Wallet',
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
  },
}

// ============================================================================
// ROLE TO JOURNEY MAPPING
// ============================================================================

const ROLE_PRIMARY_JOURNEYS: Record<UserRole, JourneyType> = {
  cfo: 'treasury',
  controller: 'treasury',
  procurement: 'buyer',
  founder: 'founder',
  hr: 'jobs',
  sales: 'seller',
  other: 'founder',
}

const ROLE_SECONDARY_JOURNEYS: Record<UserRole, JourneyType[]> = {
  cfo: ['buyer', 'seller'],
  controller: ['buyer'],
  procurement: ['treasury'],
  founder: ['buyer', 'seller', 'jobs', 'treasury'],
  hr: ['buyer'],
  sales: ['buyer'],
  other: [],
}

// ============================================================================
// NEED TO JOURNEY MAPPING
// ============================================================================

const NEED_TO_JOURNEYS: Record<UserNeed, JourneyType[]> = {
  treasury: ['treasury'],
  payments: ['treasury', 'buyer'],
  sourcing: ['buyer'],
  hiring: ['jobs'],
  selling: ['seller'],
  all: ['founder', 'buyer', 'seller', 'jobs', 'treasury'],
}

// ============================================================================
// JOURNEY ROUTER CLASS
// ============================================================================

export class JourneyRouter {
  /**
   * Determine the primary journey based on signup data
   */
  static detectPrimaryJourney(data: SignupData): JourneyType {
    // If they selected "all", they're likely a founder
    if (data.needs.includes('all')) {
      return 'founder'
    }

    // If they selected treasury first, that's their priority
    if (data.needs[0] === 'treasury' || data.needs[0] === 'payments') {
      return 'treasury'
    }

    // Check their role for the default
    const roleBased = ROLE_PRIMARY_JOURNEYS[data.role]

    // If their first need aligns with something else, use that
    if (data.needs.length > 0) {
      const firstNeedJourneys = NEED_TO_JOURNEYS[data.needs[0]]
      if (firstNeedJourneys && firstNeedJourneys.length > 0) {
        return firstNeedJourneys[0]
      }
    }

    return roleBased
  }

  /**
   * Determine all active journeys based on signup data
   */
  static detectActiveJourneys(data: SignupData): JourneyType[] {
    const journeys = new Set<JourneyType>()

    // Add primary journey
    journeys.add(this.detectPrimaryJourney(data))

    // Add journeys from needs
    for (const need of data.needs) {
      const needJourneys = NEED_TO_JOURNEYS[need]
      if (needJourneys) {
        needJourneys.forEach(j => journeys.add(j))
      }
    }

    // Add secondary journeys from role
    const roleSecondary = ROLE_SECONDARY_JOURNEYS[data.role]
    if (roleSecondary) {
      roleSecondary.forEach(j => journeys.add(j))
    }

    return Array.from(journeys)
  }

  /**
   * Create initial user context from signup data
   */
  static createUserContext(userId: string, data: SignupData): UserContext {
    const primaryJourney = this.detectPrimaryJourney(data)
    const activeJourneys = this.detectActiveJourneys(data)

    return {
      userId,
      email: data.email,
      companyName: data.companyName,
      role: data.role,
      needs: data.needs,
      primaryJourney,
      activeJourneys,
      erpConnected: !!data.erpSystem && data.erpSystem !== 'none',
      erpSystem: data.erpSystem,
      onboardingComplete: false,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    }
  }

  /**
   * Get the initial route after signup
   */
  static getPostSignupRoute(context: UserContext): string {
    // If they need treasury and don't have ERP connected, prompt for it
    if (
      context.activeJourneys.includes('treasury') &&
      !context.erpConnected
    ) {
      return '/onboarding?step=erp'
    }

    // Route to primary journey
    const journeyRoute = JOURNEY_ROUTES[context.primaryJourney]
    return journeyRoute?.path || '/dashboard'
  }

  /**
   * Get the dashboard route for a journey
   */
  static getJourneyDashboard(journey: JourneyType): string {
    const route = JOURNEY_ROUTES[journey]
    return route?.path || '/dashboard'
  }

  /**
   * Get all available journeys for a user
   */
  static getAvailableJourneys(context: UserContext): JourneyRoute[] {
    return context.activeJourneys.map(j => JOURNEY_ROUTES[j])
  }

  /**
   * Check if user has access to a specific journey
   */
  static hasJourneyAccess(context: UserContext, journey: JourneyType): boolean {
    return context.activeJourneys.includes(journey)
  }

  /**
   * Add a journey to user's active journeys
   */
  static addJourney(context: UserContext, journey: JourneyType): UserContext {
    if (!context.activeJourneys.includes(journey)) {
      return {
        ...context,
        activeJourneys: [...context.activeJourneys, journey],
        lastActiveAt: new Date(),
      }
    }
    return context
  }

  /**
   * Switch primary journey
   */
  static switchPrimaryJourney(context: UserContext, journey: JourneyType): UserContext {
    // Ensure the journey is in active journeys
    const activeJourneys = context.activeJourneys.includes(journey)
      ? context.activeJourneys
      : [...context.activeJourneys, journey]

    return {
      ...context,
      primaryJourney: journey,
      activeJourneys,
      lastActiveAt: new Date(),
    }
  }

  /**
   * Get quick actions based on user role and journeys
   */
  static getQuickActions(context: UserContext): QuickAction[] {
    const actions: QuickAction[] = []

    // Treasury actions for CFO/Controller
    if (context.activeJourneys.includes('treasury')) {
      actions.push(
        { id: 'check-balance', label: 'Check GRAIN Balance', journey: 'treasury', prompt: 'What\'s my GRAIN balance?' },
        { id: 'make-payment', label: 'Make a Payment', journey: 'treasury', prompt: 'I need to pay an invoice' },
      )
    }

    // Sourcing actions for Procurement/Buyers
    if (context.activeJourneys.includes('buyer')) {
      actions.push(
        { id: 'find-suppliers', label: 'Find Suppliers', journey: 'buyer', prompt: 'I need to find suppliers for' },
        { id: 'create-rfq', label: 'Create RFQ', journey: 'buyer', prompt: 'I need to create a request for quote' },
      )
    }

    // Sales actions
    if (context.activeJourneys.includes('seller')) {
      actions.push(
        { id: 'find-leads', label: 'Find Leads', journey: 'seller', prompt: 'Find me qualified buyers for' },
        { id: 'view-rfqs', label: 'View Open RFQs', journey: 'seller', prompt: 'Show me RFQs I can respond to' },
      )
    }

    // Hiring actions
    if (context.activeJourneys.includes('jobs')) {
      actions.push(
        { id: 'post-job', label: 'Post a Job', journey: 'jobs', prompt: 'I need to hire a' },
        { id: 'find-candidates', label: 'Find Candidates', journey: 'jobs', prompt: 'Find candidates for my open roles' },
      )
    }

    // Founder actions
    if (context.activeJourneys.includes('founder')) {
      actions.push(
        { id: 'weekly-brief', label: 'Weekly Brief', journey: 'founder', prompt: 'Give me my weekly business brief' },
        { id: 'startup-help', label: 'Startup Help', journey: 'founder', prompt: 'I need help with my startup' },
      )
    }

    return actions.slice(0, 6) // Max 6 quick actions
  }
}

// ============================================================================
// QUICK ACTION TYPE
// ============================================================================

export interface QuickAction {
  id: string
  label: string
  journey: JourneyType
  prompt: string
  icon?: string
}

// ============================================================================
// USER CONTEXT PERSISTENCE (Client-side)
// ============================================================================

const CONTEXT_STORAGE_KEY = 'wells_user_context'

export function saveUserContext(context: UserContext): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context))
  } catch (e) {
    console.error('Failed to save user context:', e)
  }
}

export function loadUserContext(): UserContext | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(CONTEXT_STORAGE_KEY)
    if (!stored) return null
    const context = JSON.parse(stored)
    // Restore dates
    context.createdAt = new Date(context.createdAt)
    context.lastActiveAt = new Date(context.lastActiveAt)
    return context
  } catch (e) {
    console.error('Failed to load user context:', e)
    return null
  }
}

export function clearUserContext(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CONTEXT_STORAGE_KEY)
  } catch (e) {
    console.error('Failed to clear user context:', e)
  }
}

// ============================================================================
// HOOKS (for React components)
// ============================================================================

/**
 * Hook to get journey route info
 */
export function getJourneyInfo(journey: JourneyType): JourneyRoute {
  return JOURNEY_ROUTES[journey]
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    cfo: 'CFO',
    controller: 'Controller',
    procurement: 'Procurement',
    founder: 'Founder/CEO',
    hr: 'HR/People',
    sales: 'Sales',
    other: 'Other',
  }
  return names[role]
}

/**
 * Get need display name
 */
export function getNeedDisplayName(need: UserNeed): string {
  const names: Record<UserNeed, string> = {
    treasury: 'Treasury & Cash Management',
    payments: 'Payments & Invoicing',
    sourcing: 'Sourcing & Procurement',
    hiring: 'Hiring & Recruiting',
    selling: 'Sales & Lead Generation',
    all: 'All of the Above',
  }
  return names[need]
}
