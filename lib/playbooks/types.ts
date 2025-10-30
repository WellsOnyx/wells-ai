/**
 * Wells AI - Playbook Types
 * Define all playbook types and actions
 */

import { Opportunity } from '../opportunity'

// ===== PLAYBOOK TYPES =====

export enum PlaybookType {
  DealRegistration = 'deal_reg',
  CoSellRequest = 'co_sell',
  PartnerIntro = 'partner_intro',
  QuoteRequest = 'quote_request',
  TechnicalReview = 'tech_review'
}

export enum ActionStatus {
  Suggested = 'suggested',      // Playbook suggested by AI
  Pending = 'pending',           // Awaiting user consent
  Approved = 'approved',         // User approved, queued for execution
  Submitted = 'submitted',       // Submitted to partner
  InProgress = 'in_progress',    // Partner is processing
  Completed = 'completed',       // Successfully completed
  Failed = 'failed',             // Failed to execute
  Rejected = 'rejected'          // User rejected the suggestion
}

// ===== PLAYBOOK PARAMETERS =====

export interface DealRegistrationParams {
  opportunityId: string
  partnerId: string
  dealValue: number
  expectedCloseDate: string
  competitorInfo?: string[]
  partnerManagerEmail?: string
}

export interface CoSellRequestParams {
  opportunityId: string
  partnerId: string
  customerName: string
  useCase: string
  requestedSupport: 'overlay' | 'technical' | 'executive' | 'full'
}

export interface PartnerIntroParams {
  opportunityId: string
  partnerId: string
  customerName: string
  introMessage: string
  requestedMeeting: boolean
}

export interface QuoteRequestParams {
  opportunityId: string
  supplierId: string
  productSpecs: string
  quantity: number
  targetPrice?: number
  deadline: string
}

export interface TechnicalReviewParams {
  opportunityId: string
  partnerId: string
  technicalRequirements: string
  architectureDiagram?: string
  reviewDeadline: string
}

export type PlaybookParams =
  | DealRegistrationParams
  | CoSellRequestParams
  | PartnerIntroParams
  | QuoteRequestParams
  | TechnicalReviewParams

// ===== PLAYBOOK ACTION =====

export interface PlaybookAction {
  // Identity
  actionId: string
  playbookType: PlaybookType
  supplierId: string

  // Related entities
  opportunityId: string
  partnerId: string

  // Parameters
  params: PlaybookParams

  // Status tracking
  status: ActionStatus
  createdAt: string
  updatedAt: string
  submittedAt?: string
  completedAt?: string

  // Consent tracking
  consentActionId?: string
  consentDecision?: 'approve' | 'reject'
  consentDecidedBy?: string
  consentDecidedAt?: string

  // Result tracking
  result?: {
    success: boolean
    message: string
    data?: Record<string, any>
    error?: string
  }
}

// ===== PLAYBOOK SUGGESTION =====

export interface PlaybookSuggestion {
  playbookType: PlaybookType
  title: string
  description: string
  reasoning: string
  estimatedImpact: {
    revenue?: number
    probability?: number
    timeToClose?: string
  }
  params: PlaybookParams
}

// ===== PLAYBOOK RUNNER =====

export interface PlaybookRunner {
  type: PlaybookType
  suggest(opportunity: Opportunity): PlaybookSuggestion | null
  execute(action: PlaybookAction): Promise<void>
}
