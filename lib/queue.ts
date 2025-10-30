/**
 * Wells AI - Action Queue
 * In-memory queue for playbook actions (upgradeable to Redis/DB)
 */

import { PlaybookAction, ActionStatus } from './playbooks/types'

// ===== IN-MEMORY QUEUE =====

const actionQueue = new Map<string, PlaybookAction>()
const actionHistory = new Map<string, PlaybookAction>()

// ===== QUEUE OPERATIONS =====

/**
 * Add action to queue
 */
export function enqueueAction(action: PlaybookAction): void {
  actionQueue.set(action.actionId, action)
  console.log(`✅ Action queued: ${action.actionId} (${action.playbookType})`)
}

/**
 * Get action from queue
 */
export function getAction(actionId: string): PlaybookAction | undefined {
  return actionQueue.get(actionId) || actionHistory.get(actionId)
}

/**
 * Get all queued actions
 */
export function getQueuedActions(supplierId?: string): PlaybookAction[] {
  const actions = Array.from(actionQueue.values())

  if (supplierId) {
    return actions.filter(a => a.supplierId === supplierId)
  }

  return actions
}

/**
 * Update action status
 */
export function updateActionStatus(
  actionId: string,
  status: ActionStatus,
  result?: PlaybookAction['result']
): PlaybookAction | null {
  const action = actionQueue.get(actionId)

  if (!action) {
    console.error(`Action not found: ${actionId}`)
    return null
  }

  action.status = status
  action.updatedAt = new Date().toISOString()

  if (status === ActionStatus.Submitted) {
    action.submittedAt = action.updatedAt
  }

  if (status === ActionStatus.Completed || status === ActionStatus.Failed) {
    action.completedAt = action.updatedAt
    action.result = result

    // Move to history
    actionHistory.set(actionId, action)
    actionQueue.delete(actionId)
  }

  console.log(`📝 Action updated: ${actionId} → ${status}`)

  return action
}

/**
 * Remove action from queue
 */
export function dequeueAction(actionId: string): PlaybookAction | null {
  const action = actionQueue.get(actionId)

  if (!action) {
    return null
  }

  actionQueue.delete(actionId)
  actionHistory.set(actionId, action)

  return action
}

/**
 * Get actions by status
 */
export function getActionsByStatus(status: ActionStatus, supplierId?: string): PlaybookAction[] {
  const actions = Array.from(actionQueue.values()).filter(a => a.status === status)

  if (supplierId) {
    return actions.filter(a => a.supplierId === supplierId)
  }

  return actions
}

/**
 * Get actions for opportunity
 */
export function getActionsForOpportunity(opportunityId: string): PlaybookAction[] {
  return Array.from(actionQueue.values()).filter(a => a.opportunityId === opportunityId)
}

/**
 * Get action history
 */
export function getActionHistory(supplierId?: string, limit: number = 100): PlaybookAction[] {
  let actions = Array.from(actionHistory.values())

  if (supplierId) {
    actions = actions.filter(a => a.supplierId === supplierId)
  }

  // Sort by most recent first
  actions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return actions.slice(0, limit)
}

/**
 * Clear queue (for testing)
 */
export function clearQueue(): void {
  actionQueue.clear()
  actionHistory.clear()
  console.log('🗑️  Queue cleared')
}

/**
 * Get queue stats
 */
export function getQueueStats() {
  return {
    queued: actionQueue.size,
    historical: actionHistory.size,
    byStatus: {
      suggested: getActionsByStatus(ActionStatus.Suggested).length,
      pending: getActionsByStatus(ActionStatus.Pending).length,
      approved: getActionsByStatus(ActionStatus.Approved).length,
      submitted: getActionsByStatus(ActionStatus.Submitted).length,
      inProgress: getActionsByStatus(ActionStatus.InProgress).length
    }
  }
}
