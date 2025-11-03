/**
 * Wells-Controlled LinkedIn Outreach Service
 *
 * Wells Onyx sends LinkedIn messages on behalf of clients.
 * - Clients never risk their personal accounts
 * - Wells manages multiple sender accounts
 * - We eat the ban risk, charge per outreach
 * - White-label: "reaching out on behalf of [Client]"
 */

import type { RoleQualification } from './sourcing-qualification'
import type { TargetCandidate } from './sourcing-engine'

/**
 * Outreach Request - Client submits prospect for Wells to contact
 */
export interface OutreachRequest {
  id: string
  clientId: string // Clerk user ID
  clientCompanyName: string // "Acme Corp"

  // Prospect info
  prospect: TargetCandidate

  // Campaign context
  qualification: RoleQualification

  // Message type
  messageType: 'connection_request' | 'message' | 'inmail'

  // Generated message (Wells creates, client approves)
  message: string
  approved: boolean // Client must approve before sending

  // Pricing
  creditsCost: number // How many credits this costs

  // Status tracking
  status: 'pending_approval' | 'approved' | 'queued' | 'sent' | 'responded' | 'failed'
  sentAt?: Date
  respondedAt?: Date
  response?: string

  // Wells sender account used
  senderAccountId?: string

  createdAt: Date
  updatedAt: Date
}

/**
 * Wells Sender Account
 *
 * Wells maintains pool of LinkedIn accounts for sending
 */
export interface WellsSenderAccount {
  id: string
  linkedInEmail: string
  accountName: string // "Wells Outreach 01"

  // Health tracking
  status: 'active' | 'restricted' | 'banned'
  dailyLimit: number // Current safe daily limit
  todaySent: number
  lastSentAt?: Date

  // Safety metrics
  acceptanceRate: number // % of connections accepted
  responseRate: number // % who respond
  restrictionCount: number // Times LinkedIn warned us

  // Account age (affects limits)
  accountAge: 'new' | 'established' | 'aged'
  createdAt: Date
}

/**
 * Pricing tiers for outreach
 */
export const OUTREACH_PRICING = {
  connection_request: {
    credits: 1, // 1 credit = $1
    description: 'LinkedIn connection request with note (300 chars)'
  },
  message: {
    credits: 2, // 2 credits = $2
    description: 'LinkedIn message to existing connection'
  },
  inmail: {
    credits: 5, // 5 credits = $5 (LinkedIn charges us for InMail)
    description: 'LinkedIn InMail (premium message)'
  }
}

/**
 * Credit packages
 */
export const CREDIT_PACKAGES = {
  starter: {
    credits: 100,
    price: 99, // $0.99/credit
    discount: 0
  },
  growth: {
    credits: 500,
    price: 450, // $0.90/credit (10% discount)
    discount: 0.1
  },
  scale: {
    credits: 1000,
    price: 800, // $0.80/credit (20% discount)
    discount: 0.2
  },
  enterprise: {
    credits: 5000,
    price: 3500, // $0.70/credit (30% discount)
    discount: 0.3
  }
}

/**
 * Generate outreach message on behalf of client
 */
export function generateWellsOutreachMessage(
  prospect: TargetCandidate,
  clientCompanyName: string,
  qualification: RoleQualification,
  messageType: 'connection_request' | 'message' | 'inmail'
): string {
  const firstName = prospect.firstName
  const expertise = prospect.expertise
  const contribution = prospect.potentialContribution

  if (messageType === 'connection_request') {
    // Connection request note (max 300 chars)
    return `Hi ${firstName}, I'm reaching out on behalf of ${clientCompanyName}. They're looking for someone with your background in ${expertise}. Worth connecting?`
  }

  if (messageType === 'message' || messageType === 'inmail') {
    // Full message (after connection or via InMail)
    return `Hi ${firstName},

I'm Wells from Wells Onyx, reaching out on behalf of ${clientCompanyName}.

They're looking for ${qualification.roleTitle}s and I found your profile both as someone knowledgeable in ${expertise} but also who could potentially contribute to ${contribution}.

I assume you're happy where you are, but if you're keeping your eyes and ears open to an opportunity, let me know and I can make an introduction.

Best,
Wells
Wells Onyx`
  }

  return ''
}

/**
 * Create outreach request
 */
export async function createOutreachRequest(
  clientId: string,
  clientCompanyName: string,
  prospect: TargetCandidate,
  qualification: RoleQualification,
  messageType: 'connection_request' | 'message' | 'inmail'
): Promise<OutreachRequest> {
  const message = generateWellsOutreachMessage(
    prospect,
    clientCompanyName,
    qualification,
    messageType
  )

  const request: OutreachRequest = {
    id: `outreach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    clientId,
    clientCompanyName,
    prospect,
    qualification,
    messageType,
    message,
    approved: false, // Client must approve
    creditsCost: OUTREACH_PRICING[messageType].credits,
    status: 'pending_approval',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  return request
}

/**
 * Approve outreach request
 */
export async function approveOutreachRequest(
  requestId: string,
  clientId: string
): Promise<OutreachRequest | null> {
  // TODO: Fetch from database
  // TODO: Verify client has enough credits
  // TODO: Update status to 'approved'
  // TODO: Add to send queue

  return null
}

/**
 * Get next sender account to use
 *
 * Round-robin through healthy accounts
 */
export async function getNextSenderAccount(): Promise<WellsSenderAccount | null> {
  // TODO: Fetch active accounts from database
  // TODO: Filter by health (not restricted/banned)
  // TODO: Check daily limits
  // TODO: Return account with lowest todaySent

  return null
}

/**
 * Send outreach via Wells account
 */
export async function sendOutreach(
  request: OutreachRequest
): Promise<{ success: boolean; error?: string }> {
  // Get available sender account
  const senderAccount = await getNextSenderAccount()

  if (!senderAccount) {
    return {
      success: false,
      error: 'No sender accounts available'
    }
  }

  // Check daily limit
  if (senderAccount.todaySent >= senderAccount.dailyLimit) {
    return {
      success: false,
      error: 'Daily limit reached for all sender accounts'
    }
  }

  // TODO: Send via Phantombuster using senderAccount credentials
  // TODO: Track send in database
  // TODO: Update senderAccount.todaySent
  // TODO: Deduct credits from client

  return { success: true }
}

/**
 * Client credit balance
 */
export interface CreditBalance {
  clientId: string
  credits: number
  lifetimeSpent: number
  lifetimeEarned: number
  lastPurchaseAt?: Date
}

/**
 * Purchase credits
 */
export async function purchaseCredits(
  clientId: string,
  packageKey: keyof typeof CREDIT_PACKAGES,
  paymentIntentId: string // Stripe payment
): Promise<CreditBalance> {
  const pkg = CREDIT_PACKAGES[packageKey]

  // TODO: Verify payment with Stripe
  // TODO: Add credits to client balance
  // TODO: Record transaction

  return {
    clientId,
    credits: pkg.credits,
    lifetimeSpent: pkg.price,
    lifetimeEarned: pkg.credits,
    lastPurchaseAt: new Date()
  }
}

/**
 * Get campaign analytics for client
 */
export interface CampaignAnalytics {
  totalOutreachSent: number
  connectionAcceptanceRate: number
  messageResponseRate: number
  meetingsBooked: number
  creditsSpent: number
  avgCostPerResponse: number
  avgCostPerMeeting: number
}

export async function getCampaignAnalytics(
  clientId: string,
  dateRange?: { start: Date; end: Date }
): Promise<CampaignAnalytics> {
  // TODO: Query outreach requests for client
  // TODO: Calculate metrics

  return {
    totalOutreachSent: 0,
    connectionAcceptanceRate: 0,
    messageResponseRate: 0,
    meetingsBooked: 0,
    creditsSpent: 0,
    avgCostPerResponse: 0,
    avgCostPerMeeting: 0
  }
}

export default {
  createOutreachRequest,
  approveOutreachRequest,
  sendOutreach,
  purchaseCredits,
  getCampaignAnalytics,
  OUTREACH_PRICING,
  CREDIT_PACKAGES
}
