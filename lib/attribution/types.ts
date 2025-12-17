// Attribution Network Types
// Enterprise affiliate network for peer-to-peer introductions

export const MAX_CONNECTIONS = 30
export const MAX_LEVELS = 4
export const GRAIN_RATE = 0.001 // 1 GRAIN = $0.001 USD

// ============================================================================
// CONNECTION TYPES
// ============================================================================

export type ConnectionStatus = 'pending' | 'active' | 'declined' | 'removed'

export interface AttrConnection {
  id: string
  requesterId: string
  accepterId: string
  requesterName?: string
  requesterEmail?: string
  accepterName?: string
  accepterEmail?: string
  status: ConnectionStatus
  createdAt: Date
  acceptedAt?: Date
  updatedAt: Date
}

export interface ConnectionWithUser {
  connectionId: string
  userId: string
  displayName?: string
  email?: string
  direction: 'sent' | 'received'
  status: ConnectionStatus
  connectedAt?: Date
}

export interface ConnectionsResponse {
  connections: ConnectionWithUser[]
  count: number
  maxConnections: number
  remaining: number
  pendingRequests: {
    sent: ConnectionWithUser[]
    received: ConnectionWithUser[]
  }
}

// ============================================================================
// OFFER TYPES
// ============================================================================

export type OfferStatus = 'draft' | 'active' | 'closed' | 'cancelled'

export interface CommissionStructure {
  l1: number // percentage (e.g., 10.00 for 10%)
  l2: number
  l3: number
  l4: number
}

export interface AttrOffer {
  id: string
  ownerId: string
  ownerName?: string
  title: string
  description?: string
  value: number
  currency: string
  commissions: CommissionStructure
  status: OfferStatus
  category?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateOfferInput {
  title: string
  description?: string
  value: number
  currency?: string
  commissions: CommissionStructure
  category?: string
  tags?: string[]
  expiresAt?: Date
}

export interface UpdateOfferInput {
  title?: string
  description?: string
  value?: number
  commissions?: Partial<CommissionStructure>
  status?: OfferStatus
  category?: string
  tags?: string[]
  expiresAt?: Date
}

// ============================================================================
// INTRODUCTION TYPES
// ============================================================================

export type IntroductionStatus = 'pending' | 'viewed' | 'interested' | 'passed' | 'converted'

export interface AttrIntroduction {
  id: string
  offerId: string
  introducerId: string
  recipientId: string
  introducerName?: string
  recipientName?: string
  level: 1 | 2 | 3 | 4
  parentIntroductionId?: string
  l1UserId?: string
  l2UserId?: string
  l3UserId?: string
  l4UserId?: string
  status: IntroductionStatus
  createdAt: Date
  viewedAt?: Date
  updatedAt: Date
}

export interface IntroductionChain {
  l1?: { userId: string; name?: string }
  l2?: { userId: string; name?: string }
  l3?: { userId: string; name?: string }
  l4?: { userId: string; name?: string }
}

export interface CreateIntroductionInput {
  offerId: string
  recipientId: string
}

// ============================================================================
// CLOSURE TYPES
// ============================================================================

export type ClosureStatus = 'pending' | 'verified' | 'paid' | 'disputed' | 'cancelled'

export interface AttrClosure {
  id: string
  offerId: string
  introductionId?: string
  closerId: string
  closerName?: string
  actualValue: number
  currency: string
  l1UserId?: string
  l2UserId?: string
  l3UserId?: string
  l4UserId?: string
  l1Pct?: number
  l2Pct?: number
  l3Pct?: number
  l4Pct?: number
  status: ClosureStatus
  externalDealId?: string
  proofUrl?: string
  notes?: string
  createdAt: Date
  verifiedAt?: Date
  paidAt?: Date
  updatedAt: Date
}

export interface CreateClosureInput {
  offerId: string
  closerId: string
  actualValue: number
  introductionId?: string
  externalDealId?: string
  proofUrl?: string
  notes?: string
}

// ============================================================================
// COMMISSION TYPES
// ============================================================================

export type CommissionStatus = 'pending' | 'credited' | 'failed'

export interface AttrCommission {
  id: string
  closureId: string
  offerId: string
  recipientId: string
  recipientName?: string
  level: 1 | 2 | 3 | 4
  dealValue: number
  commissionPct: number
  commissionUsd: number
  grainAmount: number
  grainRate: number
  status: CommissionStatus
  grainTxId?: string
  createdAt: Date
  creditedAt?: Date
}

export interface CommissionCalculation {
  recipientId: string
  recipientName?: string
  level: 1 | 2 | 3 | 4
  commissionPct: number
  commissionUsd: number
  grainAmount: number
}

// ============================================================================
// NETWORK STATS TYPES
// ============================================================================

export interface AttrNetworkStats {
  userId: string
  directConnections: number
  l1NetworkSize: number
  l2NetworkSize: number
  l3NetworkSize: number
  l4NetworkSize: number
  totalNetworkSize: number
  totalOffersCreated: number
  totalOffersClosed: number
  totalIntroductionsMade: number
  totalIntroductionsReceived: number
  l1TotalEarned: number
  l2TotalEarned: number
  l3TotalEarned: number
  l4TotalEarned: number
  totalEarned: number
  totalGrainEarned: number
  monthlyEarned: number
  monthlyGrainEarned: number
  createdAt: Date
  updatedAt: Date
}

export interface NetworkStatsResponse {
  connections: {
    direct: number
    l2: number
    l3: number
    l4: number
    total: number
    remaining: number
  }
  earnings: {
    byLevel: {
      l1: number
      l2: number
      l3: number
      l4: number
    }
    total: number
    monthly: number
  }
  grain: {
    total: number
    monthly: number
  }
  offers: {
    created: number
    closed: number
    active: number
  }
  introductions: {
    made: number
    received: number
    converted: number
  }
}

// ============================================================================
// NETWORK TREE TYPES
// ============================================================================

export interface NetworkTreeNode {
  userId: string
  displayName?: string
  email?: string
  networkSize: number
  earnings: number
  children?: NetworkTreeNode[]
}

export interface NetworkTreeResponse {
  tree: {
    self: {
      userId: string
      displayName?: string
    }
    level1: NetworkTreeNode[]
  }
  stats: {
    totalReach: number
    byLevel: {
      l1: number
      l2: number
      l3: number
      l4: number
    }
  }
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface UserInfo {
  id: string
  displayName?: string
  email?: string
  imageUrl?: string
}

export function usdToGrain(usd: number, rate: number = GRAIN_RATE): number {
  return Math.floor(usd / rate)
}

export function grainToUsd(grain: number, rate: number = GRAIN_RATE): number {
  return grain * rate
}

export function formatGrain(grain: number): string {
  if (grain >= 1_000_000_000) {
    return `${(grain / 1_000_000_000).toFixed(2)}B`
  }
  if (grain >= 1_000_000) {
    return `${(grain / 1_000_000).toFixed(2)}M`
  }
  if (grain >= 1_000) {
    return `${(grain / 1_000).toFixed(2)}K`
  }
  return grain.toLocaleString()
}

export function formatUsd(usd: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(usd)
}

export function totalCommissionPct(commissions: CommissionStructure): number {
  return commissions.l1 + commissions.l2 + commissions.l3 + commissions.l4
}
