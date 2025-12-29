/**
 * Wells AI Onboarding Types
 *
 * Complete type definitions for the onboarding system.
 */

// ============================================================================
// ONBOARDING STATE
// ============================================================================

export type OnboardingStep =
  | 'welcome'
  | 'journey'
  | 'profile-basic'
  | 'profile-extended'
  | 'integrations'
  | 'treasury'
  | 'complete'

export type UserJourney = 'founder' | 'buyer' | 'seller' | 'jobs'

export interface OnboardingState {
  userId: string
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  selectedJourney?: UserJourney
  progress: number // 0-100
  startedAt: Date
  lastUpdatedAt: Date
  completedAt?: Date
}

// ============================================================================
// USER PROFILE
// ============================================================================

export interface UserProfile {
  userId: string

  // Basic Info
  firstName: string
  lastName: string
  email: string
  phone?: string
  avatarUrl?: string

  // Extended Profile
  journey: UserJourney
  company?: string
  role?: string
  industry?: string
  location?: string
  timezone?: string

  // Journey-Specific Fields
  founderProfile?: FounderProfile
  buyerProfile?: BuyerProfile
  sellerProfile?: SellerProfile
  jobsProfile?: JobsProfile

  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// JOURNEY-SPECIFIC PROFILES
// ============================================================================

export interface FounderProfile {
  companyName: string
  companyStage: 'idea' | 'mvp' | 'early-revenue' | 'scaling' | 'series-a+'
  fundingStatus: 'bootstrapped' | 'angel' | 'seed' | 'series-a+'
  teamSize: number
  hiringNeeds: string[]
  lookingFor: ('talent' | 'suppliers' | 'customers' | 'investors')[]
  pitchDeck?: string
}

export interface BuyerProfile {
  companyName: string
  industry: string
  purchaseVolume: 'under-10k' | '10k-100k' | '100k-1m' | '1m-plus'
  categories: string[]
  preferredPaymentTerms: string[]
  erpSystem?: ERPSystemChoice
  useWellsAsErp?: boolean // True if user chooses WellsAI as their ERP
}

// ============================================================================
// ERP SYSTEM CHOICES
// ============================================================================

export type ERPSystemChoice =
  | 'wells_native'  // Use WellsAI as your ERP (AI-native, conversational)
  | 'sap'
  | 'netsuite'
  | 'oracle'
  | 'dynamics365'
  | 'quickbooks'
  | 'xero'
  | 'sage'
  | 'other'
  | 'none'

export interface ERPChoice {
  system: ERPSystemChoice
  useWellsAsErp: boolean
  willConnect: boolean // True if they plan to connect their existing ERP
}

export const ERP_OPTIONS: Record<ERPSystemChoice, {
  name: string
  description: string
  isWellsNative: boolean
  requiresConnection: boolean
}> = {
  wells_native: {
    name: 'WellsAI (Recommended)',
    description: 'Use WellsAI as your ERP. No forms, no dashboards - just talk to Wells.',
    isWellsNative: true,
    requiresConnection: false,
  },
  sap: {
    name: 'SAP',
    description: 'Connect to SAP S/4HANA or SAP Business One',
    isWellsNative: false,
    requiresConnection: true,
  },
  netsuite: {
    name: 'Oracle NetSuite',
    description: 'Connect to NetSuite ERP',
    isWellsNative: false,
    requiresConnection: true,
  },
  oracle: {
    name: 'Oracle Cloud',
    description: 'Connect to Oracle Fusion Cloud ERP',
    isWellsNative: false,
    requiresConnection: true,
  },
  dynamics365: {
    name: 'Microsoft Dynamics 365',
    description: 'Connect to Dynamics 365 Finance & Operations',
    isWellsNative: false,
    requiresConnection: true,
  },
  quickbooks: {
    name: 'QuickBooks',
    description: 'Connect to QuickBooks Online or Desktop',
    isWellsNative: false,
    requiresConnection: true,
  },
  xero: {
    name: 'Xero',
    description: 'Connect to Xero accounting',
    isWellsNative: false,
    requiresConnection: true,
  },
  sage: {
    name: 'Sage',
    description: 'Connect to Sage Intacct or Sage 50',
    isWellsNative: false,
    requiresConnection: true,
  },
  other: {
    name: 'Other ERP',
    description: 'Using a different ERP system',
    isWellsNative: false,
    requiresConnection: true,
  },
  none: {
    name: 'No ERP Yet',
    description: 'Not using an ERP system - WellsAI can be your first!',
    isWellsNative: false,
    requiresConnection: false,
  },
}

export interface SellerProfile {
  companyName: string
  productsServices: string[]
  categories: string[]
  minimumOrderValue?: number
  leadTime?: number
  certifications: string[]
  shippingRegions: string[]
  catalogUrl?: string
}

export interface JobsProfile {
  currentTitle?: string
  yearsExperience: number
  skills: string[]
  industries: string[]
  desiredRoles: string[]
  desiredLocations: string[]
  remotePreference: 'remote-only' | 'hybrid' | 'on-site' | 'flexible'
  salaryExpectation?: {
    min: number
    max: number
    currency: string
  }
  resumeUrl?: string
  linkedInUrl?: string
}

// ============================================================================
// INTEGRATIONS
// ============================================================================

export type IntegrationProvider =
  | 'google-calendar'
  | 'outlook-calendar'
  | 'slack'
  | 'linkedin'
  | 'netsuite'
  | 'quickbooks'

export interface Integration {
  id: string
  userId: string
  provider: IntegrationProvider
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  providerEmail?: string
  connectedAt: Date
  lastSyncAt?: Date
}

// ============================================================================
// TREASURY WALLET
// ============================================================================

export interface TreasuryWallet {
  userId: string
  walletId: string
  walletAddress: string
  balance: number
  currency: 'GRAIN'
  chain: 'BASE'
  status: 'pending' | 'active' | 'suspended'
  kycStatus: 'not-started' | 'pending' | 'approved' | 'rejected'
  createdAt: Date
  updatedAt: Date
}

export interface PaymentMethod {
  id: string
  type: 'bank-account' | 'debit-card' | 'credit-card'
  last4: string
  isDefault: boolean
  status: 'active' | 'expired' | 'failed'
  addedAt: Date
}

// ============================================================================
// STEP CONFIGURATION
// ============================================================================

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'journey',
  'profile-basic',
  'profile-extended',
  'integrations',
  'treasury',
  'complete'
]

export const STEP_CONFIG: Record<OnboardingStep, {
  title: string
  description: string
  required: boolean
}> = {
  'welcome': {
    title: 'Welcome',
    description: 'Meet Wells AI',
    required: true
  },
  'journey': {
    title: 'Your Journey',
    description: 'Choose your path',
    required: true
  },
  'profile-basic': {
    title: 'About You',
    description: 'Basic information',
    required: true
  },
  'profile-extended': {
    title: 'Your Goals',
    description: 'Tell us more',
    required: true
  },
  'integrations': {
    title: 'Connect Apps',
    description: 'Speed up your workflow',
    required: false
  },
  'treasury': {
    title: 'Treasury Setup',
    description: 'Powered by Grain & Vault',
    required: false
  },
  'complete': {
    title: 'Ready!',
    description: 'See Wells in action',
    required: true
  }
}

// ============================================================================
// JOURNEY CONFIGURATION
// ============================================================================

export const JOURNEY_CONFIG: Record<UserJourney, {
  title: string
  tagline: string
  icon: string
  color: string
  questions: string[]
}> = {
  founder: {
    title: 'Founder',
    tagline: 'Build and scale your startup',
    icon: 'Rocket',
    color: 'from-amber-500 to-orange-600',
    questions: ['companyName', 'companyStage', 'fundingStatus', 'lookingFor']
  },
  buyer: {
    title: 'Buyer',
    tagline: 'Source products from verified suppliers',
    icon: 'ShoppingCart',
    color: 'from-blue-500 to-cyan-600',
    questions: ['companyName', 'industry', 'purchaseVolume', 'categories']
  },
  seller: {
    title: 'Seller',
    tagline: 'Sell to qualified buyers',
    icon: 'Store',
    color: 'from-green-500 to-emerald-600',
    questions: ['companyName', 'productsServices', 'categories', 'shippingRegions']
  },
  jobs: {
    title: 'Jobs',
    tagline: 'Find your next role',
    icon: 'Briefcase',
    color: 'from-purple-500 to-pink-600',
    questions: ['desiredRoles', 'skills', 'remotePreference', 'salaryExpectation']
  }
}
