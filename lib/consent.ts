/**
 * Wells AI - Consent Gate System
 * Global consent system: No outbound actions without human approval
 */

import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

// Audit Actions database ID (will be created in Notion)
const AUDIT_ACTIONS_DB = process.env.NOTION_AUDIT_ACTIONS_DB || ''

// ===== TYPES =====

export type ConsentActionType =
  | 'sms'
  | 'email'
  | 'partner_outreach'
  | 'rfq_notification'
  | 'payment'
  | 'gtm_outreach'
  | 'hr_offer'

export interface ConsentAction {
  actionId: string
  actionType: ConsentActionType
  title: string
  description: string
  recipient?: string
  messagePreview?: string
  metadata?: Record<string, any>
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  decidedAt?: string
  decidedBy?: string
}

export interface ConsentDecision {
  actionId: string
  decision: 'approve' | 'reject'
  decidedBy: string
  decidedAt: string
  reason?: string
}

export interface AuditLog {
  id: string
  actionId: string
  actionType: ConsentActionType
  title: string
  recipient?: string
  decision: 'approve' | 'reject'
  decidedBy: string
  decidedAt: string
  metadata?: Record<string, any>
}

// ===== IN-MEMORY QUEUE (until Notion DB is ready) =====
// In production, this would be stored in Notion or a database
const pendingActions = new Map<string, ConsentAction>()

// ===== CORE FUNCTIONS =====

/**
 * Queue an action for consent approval
 * Returns actionId to track the decision
 */
export function queueAction(params: {
  actionType: ConsentActionType
  title: string
  description: string
  recipient?: string
  messagePreview?: string
  metadata?: Record<string, any>
}): ConsentAction {
  const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const action: ConsentAction = {
    actionId,
    actionType: params.actionType,
    title: params.title,
    description: params.description,
    recipient: params.recipient,
    messagePreview: params.messagePreview,
    metadata: params.metadata,
    status: 'pending',
    createdAt: new Date().toISOString()
  }

  // Store in pending queue
  pendingActions.set(actionId, action)

  return action
}

/**
 * Make a decision on a pending action
 * Logs to Notion audit_actions database
 */
export async function decide(
  actionId: string,
  decision: 'approve' | 'reject',
  decidedBy: string = 'user',
  reason?: string
): Promise<ConsentDecision> {
  // Get action from pending queue
  const action = pendingActions.get(actionId)

  if (!action) {
    throw new Error(`Action ${actionId} not found in pending queue`)
  }

  // Update action status
  action.status = decision === 'approve' ? 'approved' : 'rejected'
  action.decidedAt = new Date().toISOString()
  action.decidedBy = decidedBy

  // Create decision record
  const decisionRecord: ConsentDecision = {
    actionId,
    decision,
    decidedBy,
    decidedAt: action.decidedAt,
    reason
  }

  // Log to Notion audit database
  await logToAudit(action, decision, decidedBy, reason)

  // Remove from pending queue
  pendingActions.delete(actionId)

  return decisionRecord
}

/**
 * Get all pending actions awaiting consent
 */
export function getPendingActions(): ConsentAction[] {
  return Array.from(pendingActions.values())
}

/**
 * Get specific action by ID
 */
export function getAction(actionId: string): ConsentAction | undefined {
  return pendingActions.get(actionId)
}

/**
 * Log decision to Notion audit_actions database
 */
async function logToAudit(
  action: ConsentAction,
  decision: 'approve' | 'reject',
  decidedBy: string,
  reason?: string
): Promise<void> {
  if (!AUDIT_ACTIONS_DB) {
    console.warn('NOTION_AUDIT_ACTIONS_DB not configured - audit log not saved to Notion')
    return
  }

  try {
    await notion.pages.create({
      parent: { database_id: AUDIT_ACTIONS_DB },
      properties: {
        // Action ID (Title field)
        'Action ID': {
          title: [
            {
              text: {
                content: action.actionId
              }
            }
          ]
        },
        // Action Type (Select)
        'Action Type': {
          select: {
            name: action.actionType
          }
        },
        // Title (Rich Text)
        'Title': {
          rich_text: [
            {
              text: {
                content: action.title
              }
            }
          ]
        },
        // Recipient (Email or Rich Text)
        'Recipient': {
          rich_text: [
            {
              text: {
                content: action.recipient || 'N/A'
              }
            }
          ]
        },
        // Decision (Select)
        'Decision': {
          select: {
            name: decision
          }
        },
        // Decided By (Rich Text)
        'Decided By': {
          rich_text: [
            {
              text: {
                content: decidedBy
              }
            }
          ]
        },
        // Decided At (Date)
        'Decided At': {
          date: {
            start: action.decidedAt || new Date().toISOString()
          }
        },
        // Reason (Rich Text - optional)
        'Reason': {
          rich_text: reason ? [
            {
              text: {
                content: reason
              }
            }
          ] : []
        },
        // Message Preview (Rich Text)
        'Message Preview': {
          rich_text: action.messagePreview ? [
            {
              text: {
                content: action.messagePreview.substring(0, 2000) // Notion limit
              }
            }
          ] : []
        }
      }
    })

    console.log(`✅ Audit log saved: ${action.actionId} - ${decision}`)
  } catch (error) {
    console.error('Failed to log to Notion audit:', error)
    // Don't throw - audit logging should not block action execution
  }
}

/**
 * Retrieve audit logs from Notion
 * For compliance and review purposes
 */
export async function getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
  if (!AUDIT_ACTIONS_DB) {
    console.warn('NOTION_AUDIT_ACTIONS_DB not configured')
    return []
  }

  try {
    const response = await notion.databases.query({
      database_id: AUDIT_ACTIONS_DB,
      page_size: limit,
      sorts: [
        {
          property: 'Decided At',
          direction: 'descending'
        }
      ]
    })

    return response.results.map((page: any) => ({
      id: page.id,
      actionId: page.properties['Action ID']?.title?.[0]?.text?.content || '',
      actionType: page.properties['Action Type']?.select?.name || 'email',
      title: page.properties['Title']?.rich_text?.[0]?.text?.content || '',
      recipient: page.properties['Recipient']?.rich_text?.[0]?.text?.content || undefined,
      decision: page.properties['Decision']?.select?.name as 'approve' | 'reject',
      decidedBy: page.properties['Decided By']?.rich_text?.[0]?.text?.content || 'unknown',
      decidedAt: page.properties['Decided At']?.date?.start || '',
      metadata: {
        messagePreview: page.properties['Message Preview']?.rich_text?.[0]?.text?.content,
        reason: page.properties['Reason']?.rich_text?.[0]?.text?.content
      }
    }))
  } catch (error) {
    console.error('Failed to retrieve audit logs:', error)
    return []
  }
}

/**
 * Helper: Check if action requires consent
 * Can be configured per action type
 */
export function requiresConsent(actionType: ConsentActionType): boolean {
  // For now, ALL outbound actions require consent
  // In future, could whitelist certain action types or users
  return true
}
