/**
 * Partner SDK - Core Types
 * Defines interfaces for partner ecosystem automation
 */

// Partner platforms
export type PartnerPlatform =
  | 'ibm'
  | 'cisco'
  | 'snowflake'
  | 'freshworks'
  | 'salesforce'
  | 'microsoft'
  | 'aws'
  | 'google'
  | 'oracle'
  | 'sap'
  | 'custom'

// Auth methods
export type AuthMethod =
  | 'oauth'
  | 'session'
  | 'api_key'
  | 'saml'

// SDK modes
export type SDKMode =
  | 'observe'      // Learn-only, no actions
  | 'suggest'      // Suggest actions, wait for approval
  | 'autopilot'    // Execute with approval
  | 'autonomous'   // Full autonomy (requires explicit consent)

// Opportunity types
export interface PartnerOpportunity {
  id: string
  externalId?: string
  partner: PartnerPlatform

  name: string
  description: string
  customer: {
    name: string
    industry?: string
    region?: string
    size?: string
  }

  value: {
    amount: number
    currency: string
    type: 'acv' | 'tcv' | 'one_time'
  }

  stage: string
  probability?: number
  closeDate?: Date

  products?: string[]
  solutions?: string[]

  dealType: 'new' | 'expansion' | 'renewal'
  sourceType: 'partner_sourced' | 'vendor_sourced' | 'co_sell'

  metadata: {
    discoveredAt: Date
    lastSeen: Date
    confidence: number
    tags: string[]
  }
}

// Suggested actions
export interface SuggestedAction {
  id: string
  type: 'deal_reg' | 'co_sell' | 'mdf' | 'lead_share' | 'custom'
  opportunity: PartnerOpportunity

  confidence: number
  reasoning: string[]

  action: {
    playbook: string
    params: Record<string, any>
    estimated_time: number
  }

  rules: {
    compliant: boolean
    violations: string[]
    requirements: string[]
  }

  outcome: {
    estimated_value: number
    probability: number
    timeframe: string
  }

  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed'

  human: {
    approvedBy?: string
    approvedAt?: Date
    rejectedReason?: string
  }

  execution: {
    startedAt?: Date
    completedAt?: Date
    result?: any
    error?: string
  }
}

// Partner rules and policies
export interface PartnerRules {
  partner: PartnerPlatform
  dealRegistration: {
    required: boolean
    timeframe?: string
    geography?: string[]
    industries?: string[]
    minDealSize?: number
    maxDealSize?: number
    exclusions?: string[]
  }
  coSell: {
    enabled: boolean
    requirements?: string[]
    process?: string
  }
  mdf: {
    available: boolean
    maxRequest?: number
    approvalTime?: string
    eligibleActivities?: string[]
  }
  branding: {
    voice: string
    tone: string
    doNot: string[]
  }
  compliance: {
    mustRead: string[]
    certifications?: string[]
    approvals?: string[]
  }
}

// Learning data
export interface LearningRecord {
  id: string
  partner: PartnerPlatform

  action: SuggestedAction

  outcome: {
    approved: boolean
    executed: boolean
    result?: 'success' | 'failure' | 'pending'
    value?: number
    timeToClose?: number
  }

  feedback: {
    quality: number // 1-10
    accuracy: number // 1-10
    notes?: string
  }

  patterns: {
    customer_profile: Record<string, any>
    timing: Record<string, any>
    success_factors: string[]
  }

  timestamp: Date
}

// Attribution for 33bps tracking
export interface PartnerAttribution {
  id: string
  partner: PartnerPlatform

  opportunity: PartnerOpportunity
  actions: SuggestedAction[]

  contribution: {
    discovery: number // % attributed to partner discovery
    qualification: number
    progression: number
    close: number
  }

  revenue: {
    total: number
    influenced: number // Amount attributed to partner
    wellsFee: number // 33bps of influenced
    tithe: number // 10% of wellsFee
    net: number // wellsFee - tithe
  }

  closeDate?: Date

  audit: {
    createdAt: Date
    updatedAt: Date
    policyVersion: string
    consentRef: string
  }
}

// SDK Configuration
export interface PartnerSDKConfig {
  partner: PartnerPlatform

  auth: {
    method: AuthMethod
    credentials?: {
      clientId?: string
      clientSecret?: string
      apiKey?: string
      sessionToken?: string
    }
    scopes?: string[]
  }

  mode: SDKMode

  playbooks: string[]

  consent: {
    required: boolean
    type: 'action' | 'session' | 'permanent'
    expiresAt?: Date
  }

  learning: {
    enabled: boolean
    storage?: 'local' | 'remote'
    retention?: number // days
  }

  rateLimit: {
    actionsPerDay: number
    actionsPerHour: number
    cooldownMinutes: number
  }

  notifications: {
    channels: ('ui' | 'email' | 'slack')[]
    threshold: number // Confidence threshold to notify
  }
}

// Playbook execution context
export interface PlaybookContext {
  partner: PartnerPlatform
  opportunity: PartnerOpportunity
  action: SuggestedAction
  rules: PartnerRules
  user: {
    id: string
    name: string
    email: string
  }
  session: {
    startedAt: Date
    authenticated: boolean
    permissions: string[]
  }
}

// Playbook result
export interface PlaybookResult {
  success: boolean
  action: string
  data?: any
  error?: string
  logs: string[]
  duration: number
  nextSteps?: string[]
}

// Observer events
export type ObserverEvent =
  | { type: 'opportunity_discovered'; data: PartnerOpportunity }
  | { type: 'opportunity_updated'; data: PartnerOpportunity }
  | { type: 'action_suggested'; data: SuggestedAction }
  | { type: 'rule_learned'; data: Partial<PartnerRules> }
  | { type: 'pattern_detected'; data: { pattern: string; confidence: number } }
  | { type: 'error'; data: { message: string; code: string } }

// SDK Events
export type SDKEvent =
  | ObserverEvent
  | { type: 'auth_success'; data: { partner: PartnerPlatform } }
  | { type: 'auth_failure'; data: { partner: PartnerPlatform; error: string } }
  | { type: 'playbook_started'; data: { playbook: string; context: PlaybookContext } }
  | { type: 'playbook_completed'; data: { playbook: string; result: PlaybookResult } }
  | { type: 'approval_requested'; data: SuggestedAction }
  | { type: 'approval_received'; data: { actionId: string; approved: boolean } }
  | { type: 'learning_updated'; data: LearningRecord }
