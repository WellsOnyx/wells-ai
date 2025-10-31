/**
 * Wells AI - Audit Ledger System
 * Immutable audit trail for all actions and payloads with policy versioning
 */

import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

// Notion database IDs
const AUDIT_ACTIONS_DB = process.env.NOTION_AUDIT_ACTIONS_DB || ''
const AUDIT_PAYLOADS_DB = process.env.NOTION_AUDIT_PAYLOADS_DB || ''

// ===== POLICY VERSION MANAGEMENT =====

/**
 * Policy version tracks which version of consent/approval rules
 * were in effect when an action was taken.
 *
 * Format: YYYY.MM.DD.sequence
 * Example: 2025.10.30.001
 */
export interface PolicyVersion {
  version: string
  effectiveDate: string
  description: string
  rules: {
    requiresApproval: string[]
    autoApproved: string[]
    requiredApprovers: number
    expirationDays: number
  }
}

// Current policy version
const CURRENT_POLICY_VERSION: PolicyVersion = {
  version: '2025.10.30.001',
  effectiveDate: '2025-10-30T00:00:00Z',
  description: 'Initial policy: All outbound actions require human approval',
  rules: {
    requiresApproval: ['sms', 'email', 'partner_outreach', 'rfq_notification', 'payment', 'gtm_outreach', 'hr_offer'],
    autoApproved: [],
    requiredApprovers: 1,
    expirationDays: 7
  }
}

/**
 * Get current policy version
 */
export function getCurrentPolicyVersion(): PolicyVersion {
  return CURRENT_POLICY_VERSION
}

// ===== AUDIT ACTIONS =====

export type AuditActionType =
  | 'sms'
  | 'email'
  | 'partner_outreach'
  | 'rfq_notification'
  | 'payment'
  | 'gtm_outreach'
  | 'hr_offer'
  | 'deal_registration'
  | 'supplier_notification'
  | 'candidate_outreach'
  | 'validation'

export type AuditDecision = 'approve' | 'reject' | 'timeout' | 'error'

export interface AuditAction {
  // Unique identifiers
  auditId: string
  actionId: string
  payloadId: string

  // Action details
  actionType: AuditActionType
  title: string
  description: string
  recipient?: string

  // Decision
  decision: AuditDecision
  decidedBy: string
  decidedAt: string
  reason?: string

  // Policy tracking
  policyVersion: string
  policyRules: PolicyVersion['rules']

  // Metadata
  metadata?: Record<string, any>

  // Immutability
  createdAt: string
  isImmutable: true
}

// ===== AUDIT PAYLOADS =====

export interface AuditPayload {
  // Unique identifiers
  payloadId: string
  actionId: string
  auditId?: string

  // Payload data
  actionType: AuditActionType
  payload: Record<string, any>
  payloadHash: string // SHA-256 hash for integrity verification

  // Metadata
  size: number // Bytes
  createdAt: string

  // Immutability
  isImmutable: true
}

// ===== IN-MEMORY STORAGE (until Notion is ready) =====
const auditActionsStore = new Map<string, AuditAction>()
const auditPayloadsStore = new Map<string, AuditPayload>()

// ===== CORE FUNCTIONS =====

/**
 * Write an immutable audit action record
 * Called when a consent decision is made
 */
export async function writeAuditAction(params: {
  actionId: string
  actionType: AuditActionType
  title: string
  description: string
  recipient?: string
  decision: AuditDecision
  decidedBy: string
  reason?: string
  metadata?: Record<string, any>
}): Promise<AuditAction> {
  const policyVersion = getCurrentPolicyVersion()
  const now = new Date().toISOString()

  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const payloadId = `payload_${params.actionId}`

  const auditAction: AuditAction = {
    // Identifiers
    auditId,
    actionId: params.actionId,
    payloadId,

    // Action details
    actionType: params.actionType,
    title: params.title,
    description: params.description,
    recipient: params.recipient,

    // Decision
    decision: params.decision,
    decidedBy: params.decidedBy,
    decidedAt: now,
    reason: params.reason,

    // Policy tracking
    policyVersion: policyVersion.version,
    policyRules: policyVersion.rules,

    // Metadata
    metadata: params.metadata,

    // Immutability
    createdAt: now,
    isImmutable: true
  }

  // Store in memory
  auditActionsStore.set(auditId, auditAction)

  // Write to Notion if configured
  if (AUDIT_ACTIONS_DB) {
    await writeToNotionAuditActions(auditAction)
  }

  return auditAction
}

/**
 * Write an immutable audit payload record
 * Called when an action is queued for consent
 */
export async function writeAuditPayload(params: {
  actionId: string
  actionType: AuditActionType
  payload: Record<string, any>
}): Promise<AuditPayload> {
  const now = new Date().toISOString()
  const payloadId = `payload_${params.actionId}`

  // Calculate payload hash for integrity verification
  const payloadString = JSON.stringify(params.payload)
  const payloadHash = await hashPayload(payloadString)

  const auditPayload: AuditPayload = {
    // Identifiers
    payloadId,
    actionId: params.actionId,

    // Payload data
    actionType: params.actionType,
    payload: params.payload,
    payloadHash,

    // Metadata
    size: Buffer.byteLength(payloadString, 'utf8'),
    createdAt: now,

    // Immutability
    isImmutable: true
  }

  // Store in memory
  auditPayloadsStore.set(payloadId, auditPayload)

  // Write to Notion if configured
  if (AUDIT_PAYLOADS_DB) {
    await writeToNotionAuditPayloads(auditPayload)
  }

  return auditPayload
}

/**
 * Retrieve audit action by ID
 */
export function getAuditAction(auditId: string): AuditAction | undefined {
  return auditActionsStore.get(auditId)
}

/**
 * Retrieve audit action by action ID
 */
export function getAuditActionByActionId(actionId: string): AuditAction | undefined {
  return Array.from(auditActionsStore.values()).find(a => a.actionId === actionId)
}

/**
 * Retrieve audit payload by ID
 */
export function getAuditPayload(payloadId: string): AuditPayload | undefined {
  return auditPayloadsStore.get(payloadId)
}

/**
 * Retrieve audit payload by action ID
 */
export function getAuditPayloadByActionId(actionId: string): AuditPayload | undefined {
  const payloadId = `payload_${actionId}`
  return auditPayloadsStore.get(payloadId)
}

/**
 * Get all audit actions (for compliance reporting)
 */
export function getAllAuditActions(): AuditAction[] {
  return Array.from(auditActionsStore.values())
}

/**
 * Get all audit payloads (for compliance reporting)
 */
export function getAllAuditPayloads(): AuditPayload[] {
  return Array.from(auditPayloadsStore.values())
}

/**
 * Get audit actions by policy version
 */
export function getAuditActionsByPolicyVersion(version: string): AuditAction[] {
  return Array.from(auditActionsStore.values()).filter(a => a.policyVersion === version)
}

/**
 * Get audit actions by decision type
 */
export function getAuditActionsByDecision(decision: AuditDecision): AuditAction[] {
  return Array.from(auditActionsStore.values()).filter(a => a.decision === decision)
}

/**
 * Get audit actions by date range
 */
export function getAuditActionsByDateRange(startDate: string, endDate: string): AuditAction[] {
  return Array.from(auditActionsStore.values()).filter(a =>
    a.decidedAt >= startDate && a.decidedAt <= endDate
  )
}

/**
 * Verify payload integrity
 */
export async function verifyPayloadIntegrity(payloadId: string): Promise<boolean> {
  const auditPayload = auditPayloadsStore.get(payloadId)
  if (!auditPayload) {
    return false
  }

  const payloadString = JSON.stringify(auditPayload.payload)
  const calculatedHash = await hashPayload(payloadString)

  return calculatedHash === auditPayload.payloadHash
}

// ===== HELPER FUNCTIONS =====

/**
 * Hash payload for integrity verification
 */
async function hashPayload(payload: string): Promise<string> {
  // Use Web Crypto API if available, otherwise fallback to simple hash
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(payload)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Fallback: simple hash for Node.js environment
  // In production, use crypto.createHash('sha256')
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

/**
 * Write audit action to Notion
 */
async function writeToNotionAuditActions(auditAction: AuditAction): Promise<void> {
  try {
    await notion.pages.create({
      parent: { database_id: AUDIT_ACTIONS_DB },
      properties: {
        // Audit ID (Title)
        'Audit ID': {
          title: [
            {
              text: {
                content: auditAction.auditId
              }
            }
          ]
        },
        // Action ID (Rich Text)
        'Action ID': {
          rich_text: [
            {
              text: {
                content: auditAction.actionId
              }
            }
          ]
        },
        // Action Type (Select)
        'Action Type': {
          select: {
            name: auditAction.actionType
          }
        },
        // Title (Rich Text)
        'Title': {
          rich_text: [
            {
              text: {
                content: auditAction.title
              }
            }
          ]
        },
        // Decision (Select)
        'Decision': {
          select: {
            name: auditAction.decision
          }
        },
        // Decided By (Rich Text)
        'Decided By': {
          rich_text: [
            {
              text: {
                content: auditAction.decidedBy
              }
            }
          ]
        },
        // Decided At (Date)
        'Decided At': {
          date: {
            start: auditAction.decidedAt
          }
        },
        // Policy Version (Rich Text)
        'Policy Version': {
          rich_text: [
            {
              text: {
                content: auditAction.policyVersion
              }
            }
          ]
        },
        // Recipient (Rich Text)
        'Recipient': {
          rich_text: auditAction.recipient ? [
            {
              text: {
                content: auditAction.recipient
              }
            }
          ] : []
        },
        // Reason (Rich Text)
        'Reason': {
          rich_text: auditAction.reason ? [
            {
              text: {
                content: auditAction.reason
              }
            }
          ] : []
        }
      }
    })

    console.log(`✅ Audit action logged: ${auditAction.auditId} - ${auditAction.decision}`)
  } catch (error) {
    console.error('Failed to write to Notion audit_actions:', error)
    // Don't throw - audit logging should not block action execution
  }
}

/**
 * Write audit payload to Notion
 */
async function writeToNotionAuditPayloads(auditPayload: AuditPayload): Promise<void> {
  try {
    await notion.pages.create({
      parent: { database_id: AUDIT_PAYLOADS_DB },
      properties: {
        // Payload ID (Title)
        'Payload ID': {
          title: [
            {
              text: {
                content: auditPayload.payloadId
              }
            }
          ]
        },
        // Action ID (Rich Text)
        'Action ID': {
          rich_text: [
            {
              text: {
                content: auditPayload.actionId
              }
            }
          ]
        },
        // Action Type (Select)
        'Action Type': {
          select: {
            name: auditPayload.actionType
          }
        },
        // Payload Hash (Rich Text)
        'Payload Hash': {
          rich_text: [
            {
              text: {
                content: auditPayload.payloadHash
              }
            }
          ]
        },
        // Size (Number)
        'Size': {
          number: auditPayload.size
        },
        // Created At (Date)
        'Created At': {
          date: {
            start: auditPayload.createdAt
          }
        },
        // Payload (Rich Text - truncated)
        'Payload': {
          rich_text: [
            {
              text: {
                content: JSON.stringify(auditPayload.payload).substring(0, 2000) // Notion limit
              }
            }
          ]
        }
      }
    })

    console.log(`✅ Audit payload logged: ${auditPayload.payloadId}`)
  } catch (error) {
    console.error('Failed to write to Notion audit_payloads:', error)
    // Don't throw - audit logging should not block action execution
  }
}

// ===== ANALYTICS =====

export interface AuditStats {
  totalActions: number
  byDecision: Record<AuditDecision, number>
  byActionType: Record<string, number>
  byPolicyVersion: Record<string, number>
  currentPolicyVersion: string
  totalPayloads: number
  totalPayloadSize: number
}

/**
 * Get audit statistics
 */
export function getAuditStats(): AuditStats {
  const actions = getAllAuditActions()
  const payloads = getAllAuditPayloads()

  const stats: AuditStats = {
    totalActions: actions.length,
    byDecision: {
      approve: 0,
      reject: 0,
      timeout: 0,
      error: 0
    },
    byActionType: {},
    byPolicyVersion: {},
    currentPolicyVersion: getCurrentPolicyVersion().version,
    totalPayloads: payloads.length,
    totalPayloadSize: payloads.reduce((sum, p) => sum + p.size, 0)
  }

  actions.forEach(action => {
    stats.byDecision[action.decision]++
    stats.byActionType[action.actionType] = (stats.byActionType[action.actionType] || 0) + 1
    stats.byPolicyVersion[action.policyVersion] = (stats.byPolicyVersion[action.policyVersion] || 0) + 1
  })

  return stats
}

// ===== EXPORTS =====

export default {
  writeAuditAction,
  writeAuditPayload,
  getAuditAction,
  getAuditActionByActionId,
  getAuditPayload,
  getAuditPayloadByActionId,
  getAllAuditActions,
  getAllAuditPayloads,
  getAuditActionsByPolicyVersion,
  getAuditActionsByDecision,
  getAuditActionsByDateRange,
  verifyPayloadIntegrity,
  getCurrentPolicyVersion,
  getAuditStats
}
