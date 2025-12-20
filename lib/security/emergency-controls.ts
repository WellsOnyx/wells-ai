/**
 * Emergency Controls for Grain & Vault
 *
 * CRITICAL SECURITY MODULE
 *
 * Provides system-wide pause/kill switch capabilities:
 * - Pause all deposits
 * - Pause all withdrawals
 * - Pause all transactions
 * - Full system lockdown
 * - Freeze individual accounts
 *
 * All actions are logged to audit trail and trigger admin notifications.
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Operation types that can be paused
 */
export type OperationType = 'deposits' | 'withdrawals' | 'transactions' | 'all'

/**
 * System control record from database
 */
export interface SystemControl {
  id: string
  operationType: OperationType
  isPaused: boolean
  pauseReason: string | null
  pausedBy: string | null
  pausedAt: Date | null
  resumedAt: Date | null
  resumedBy: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Frozen account record
 */
export interface FrozenAccount {
  id: string
  userId: string
  freezeReason: string
  frozenBy: string
  frozenAt: Date
  unfrozenAt: Date | null
  unfrozenBy: string | null
  reviewNotes: string | null
  status: 'frozen' | 'under_review' | 'unfrozen'
}

/**
 * Emergency action audit log entry
 */
export interface EmergencyAuditLog {
  id: string
  actionType: 'pause' | 'resume' | 'freeze' | 'unfreeze' | 'flag_review'
  operationType: OperationType | null
  userId: string | null
  adminId: string
  reason: string
  metadata: Record<string, unknown>
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

/**
 * System status response
 */
export interface SystemStatus {
  depositsEnabled: boolean
  withdrawalsEnabled: boolean
  transactionsEnabled: boolean
  systemOperational: boolean
  pausedOperations: Array<{
    type: OperationType
    reason: string
    pausedAt: Date
    pausedBy: string
  }>
  frozenAccountsCount: number
  lastStatusCheck: Date
}

/**
 * Result of an emergency action
 */
export interface EmergencyActionResult {
  success: boolean
  message: string
  actionId?: string
  error?: string
}

// ============================================================================
// ADMIN AUTHENTICATION
// ============================================================================

/**
 * List of admin user IDs authorized for emergency actions
 * In production, this should be fetched from a secure configuration
 */
const EMERGENCY_ADMIN_IDS = new Set([
  process.env.EMERGENCY_ADMIN_1,
  process.env.EMERGENCY_ADMIN_2,
  process.env.EMERGENCY_ADMIN_3,
].filter(Boolean))

/**
 * Master emergency key for critical actions
 */
const EMERGENCY_MASTER_KEY = process.env.EMERGENCY_MASTER_KEY

/**
 * Validate admin authorization for emergency actions
 */
export function validateEmergencyAdmin(
  adminId: string,
  masterKey?: string
): { authorized: boolean; reason?: string } {
  // Check master key first (highest priority)
  if (masterKey && masterKey === EMERGENCY_MASTER_KEY) {
    return { authorized: true }
  }

  // Check if admin is in authorized list
  if (EMERGENCY_ADMIN_IDS.has(adminId)) {
    return { authorized: true }
  }

  return {
    authorized: false,
    reason: 'Unauthorized: Admin not authorized for emergency actions',
  }
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

/**
 * Initialize emergency control tables if they don't exist
 * Should be called during app startup or migration
 */
export async function initializeEmergencyTables(): Promise<void> {
  // Create system controls table
  await sql`
    CREATE TABLE IF NOT EXISTS grain_system_controls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_type VARCHAR(50) NOT NULL UNIQUE,
      is_paused BOOLEAN NOT NULL DEFAULT false,
      pause_reason TEXT,
      paused_by VARCHAR(255),
      paused_at TIMESTAMP WITH TIME ZONE,
      resumed_at TIMESTAMP WITH TIME ZONE,
      resumed_by VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `

  // Create frozen accounts table
  await sql`
    CREATE TABLE IF NOT EXISTS grain_frozen_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      freeze_reason TEXT NOT NULL,
      frozen_by VARCHAR(255) NOT NULL,
      frozen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      unfrozen_at TIMESTAMP WITH TIME ZONE,
      unfrozen_by VARCHAR(255),
      review_notes TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'frozen',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `

  // Create index on user_id for frozen accounts
  await sql`
    CREATE INDEX IF NOT EXISTS idx_frozen_accounts_user_id
    ON grain_frozen_accounts(user_id)
  `

  // Create index on status for frozen accounts
  await sql`
    CREATE INDEX IF NOT EXISTS idx_frozen_accounts_status
    ON grain_frozen_accounts(status)
  `

  // Create emergency audit log table
  await sql`
    CREATE TABLE IF NOT EXISTS grain_emergency_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action_type VARCHAR(50) NOT NULL,
      operation_type VARCHAR(50),
      user_id VARCHAR(255),
      admin_id VARCHAR(255) NOT NULL,
      reason TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `

  // Create index on created_at for audit log
  await sql`
    CREATE INDEX IF NOT EXISTS idx_emergency_audit_created
    ON grain_emergency_audit_log(created_at DESC)
  `

  // Initialize default control rows if they don't exist
  const operationTypes: OperationType[] = ['deposits', 'withdrawals', 'transactions', 'all']
  for (const opType of operationTypes) {
    await sql`
      INSERT INTO grain_system_controls (operation_type, is_paused)
      VALUES (${opType}, false)
      ON CONFLICT (operation_type) DO NOTHING
    `
  }
}

// ============================================================================
// SYSTEM-WIDE PAUSE FUNCTIONS
// ============================================================================

/**
 * Pause deposit functionality
 */
export async function pauseDeposits(
  reason: string,
  adminId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<EmergencyActionResult> {
  return pauseOperation('deposits', reason, adminId, metadata)
}

/**
 * Pause withdrawal functionality
 */
export async function pauseWithdrawals(
  reason: string,
  adminId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<EmergencyActionResult> {
  return pauseOperation('withdrawals', reason, adminId, metadata)
}

/**
 * Pause all transactions (full transaction pause)
 */
export async function pauseAllTransactions(
  reason: string,
  adminId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<EmergencyActionResult> {
  return pauseOperation('transactions', reason, adminId, metadata)
}

/**
 * Full system lockdown - pauses everything
 */
export async function systemLockdown(
  reason: string,
  adminId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<EmergencyActionResult> {
  const auth = validateEmergencyAdmin(adminId)
  if (!auth.authorized) {
    return { success: false, message: auth.reason || 'Unauthorized', error: 'UNAUTHORIZED' }
  }

  try {
    // Pause all operation types
    const operations: OperationType[] = ['deposits', 'withdrawals', 'transactions', 'all']
    const now = new Date().toISOString()

    for (const opType of operations) {
      await sql`
        UPDATE grain_system_controls
        SET
          is_paused = true,
          pause_reason = ${reason},
          paused_by = ${adminId},
          paused_at = ${now},
          resumed_at = NULL,
          resumed_by = NULL,
          updated_at = NOW()
        WHERE operation_type = ${opType}
      `
    }

    // Log the lockdown action
    const auditResult = await sql`
      INSERT INTO grain_emergency_audit_log (
        action_type, operation_type, admin_id, reason, metadata, ip_address, user_agent
      ) VALUES (
        'pause', 'all', ${adminId}, ${reason},
        ${JSON.stringify({ lockdown: true, operations })}::jsonb,
        ${metadata?.ipAddress || null}, ${metadata?.userAgent || null}
      )
      RETURNING id
    `

    // Send admin notification
    await notifyAdmins('SYSTEM LOCKDOWN', reason, adminId)

    console.warn(`[EMERGENCY] System lockdown initiated by ${adminId}: ${reason}`)

    return {
      success: true,
      message: 'System lockdown activated. All operations paused.',
      actionId: auditResult.rows[0]?.id,
    }
  } catch (error) {
    console.error('[EMERGENCY] Lockdown failed:', error)
    return {
      success: false,
      message: 'Failed to activate system lockdown',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generic pause operation function
 */
async function pauseOperation(
  operationType: OperationType,
  reason: string,
  adminId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<EmergencyActionResult> {
  const auth = validateEmergencyAdmin(adminId)
  if (!auth.authorized) {
    return { success: false, message: auth.reason || 'Unauthorized', error: 'UNAUTHORIZED' }
  }

  try {
    const now = new Date().toISOString()

    // Update the control record
    await sql`
      UPDATE grain_system_controls
      SET
        is_paused = true,
        pause_reason = ${reason},
        paused_by = ${adminId},
        paused_at = ${now},
        resumed_at = NULL,
        resumed_by = NULL,
        updated_at = NOW()
      WHERE operation_type = ${operationType}
    `

    // Log the action
    const auditResult = await sql`
      INSERT INTO grain_emergency_audit_log (
        action_type, operation_type, admin_id, reason, metadata, ip_address, user_agent
      ) VALUES (
        'pause', ${operationType}, ${adminId}, ${reason},
        ${JSON.stringify({})}::jsonb,
        ${metadata?.ipAddress || null}, ${metadata?.userAgent || null}
      )
      RETURNING id
    `

    // Send admin notification
    await notifyAdmins(`${operationType.toUpperCase()} PAUSED`, reason, adminId)

    console.warn(`[EMERGENCY] ${operationType} paused by ${adminId}: ${reason}`)

    return {
      success: true,
      message: `${operationType} paused successfully`,
      actionId: auditResult.rows[0]?.id,
    }
  } catch (error) {
    console.error(`[EMERGENCY] Failed to pause ${operationType}:`, error)
    return {
      success: false,
      message: `Failed to pause ${operationType}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Resume normal operations
 */
export async function resumeOperations(
  adminId: string,
  operationType?: OperationType,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<EmergencyActionResult> {
  const auth = validateEmergencyAdmin(adminId)
  if (!auth.authorized) {
    return { success: false, message: auth.reason || 'Unauthorized', error: 'UNAUTHORIZED' }
  }

  try {
    const now = new Date().toISOString()

    if (operationType) {
      // Resume specific operation type
      await sql`
        UPDATE grain_system_controls
        SET
          is_paused = false,
          resumed_at = ${now},
          resumed_by = ${adminId},
          updated_at = NOW()
        WHERE operation_type = ${operationType}
      `
    } else {
      // Resume all operations
      await sql`
        UPDATE grain_system_controls
        SET
          is_paused = false,
          resumed_at = ${now},
          resumed_by = ${adminId},
          updated_at = NOW()
        WHERE is_paused = true
      `
    }

    // Log the action
    const auditResult = await sql`
      INSERT INTO grain_emergency_audit_log (
        action_type, operation_type, admin_id, reason, metadata, ip_address, user_agent
      ) VALUES (
        'resume', ${operationType || 'all'}, ${adminId}, 'Operations resumed',
        ${JSON.stringify({ specificOperation: !!operationType })}::jsonb,
        ${metadata?.ipAddress || null}, ${metadata?.userAgent || null}
      )
      RETURNING id
    `

    // Send admin notification
    await notifyAdmins(
      `${operationType?.toUpperCase() || 'ALL'} OPERATIONS RESUMED`,
      'Normal operations restored',
      adminId
    )

    console.info(`[EMERGENCY] Operations resumed by ${adminId}`)

    return {
      success: true,
      message: operationType
        ? `${operationType} resumed successfully`
        : 'All operations resumed successfully',
      actionId: auditResult.rows[0]?.id,
    }
  } catch (error) {
    console.error('[EMERGENCY] Failed to resume operations:', error)
    return {
      success: false,
      message: 'Failed to resume operations',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// USER-LEVEL CONTROLS
// ============================================================================

/**
 * Freeze a specific user account
 */
export async function freezeAccount(
  userId: string,
  reason: string,
  adminId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<EmergencyActionResult> {
  const auth = validateEmergencyAdmin(adminId)
  if (!auth.authorized) {
    return { success: false, message: auth.reason || 'Unauthorized', error: 'UNAUTHORIZED' }
  }

  try {
    // Check if account is already frozen
    const existing = await sql`
      SELECT id FROM grain_frozen_accounts
      WHERE user_id = ${userId} AND status = 'frozen'
    `

    if (existing.rows.length > 0) {
      return {
        success: false,
        message: 'Account is already frozen',
        error: 'ALREADY_FROZEN',
      }
    }

    // Create freeze record
    const freezeResult = await sql`
      INSERT INTO grain_frozen_accounts (
        user_id, freeze_reason, frozen_by, status
      ) VALUES (
        ${userId}, ${reason}, ${adminId}, 'frozen'
      )
      RETURNING id
    `

    // Log the action
    await sql`
      INSERT INTO grain_emergency_audit_log (
        action_type, user_id, admin_id, reason, metadata, ip_address, user_agent
      ) VALUES (
        'freeze', ${userId}, ${adminId}, ${reason},
        ${JSON.stringify({})}::jsonb,
        ${metadata?.ipAddress || null}, ${metadata?.userAgent || null}
      )
    `

    console.warn(`[EMERGENCY] Account ${userId} frozen by ${adminId}: ${reason}`)

    return {
      success: true,
      message: `Account ${userId} has been frozen`,
      actionId: freezeResult.rows[0]?.id,
    }
  } catch (error) {
    console.error('[EMERGENCY] Failed to freeze account:', error)
    return {
      success: false,
      message: 'Failed to freeze account',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Unfreeze a user account
 */
export async function unfreezeAccount(
  userId: string,
  adminId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<EmergencyActionResult> {
  const auth = validateEmergencyAdmin(adminId)
  if (!auth.authorized) {
    return { success: false, message: auth.reason || 'Unauthorized', error: 'UNAUTHORIZED' }
  }

  try {
    const now = new Date().toISOString()

    // Update freeze record
    const updateResult = await sql`
      UPDATE grain_frozen_accounts
      SET
        status = 'unfrozen',
        unfrozen_at = ${now},
        unfrozen_by = ${adminId},
        updated_at = NOW()
      WHERE user_id = ${userId} AND status IN ('frozen', 'under_review')
      RETURNING id
    `

    if (updateResult.rows.length === 0) {
      return {
        success: false,
        message: 'No frozen record found for this account',
        error: 'NOT_FOUND',
      }
    }

    // Log the action
    await sql`
      INSERT INTO grain_emergency_audit_log (
        action_type, user_id, admin_id, reason, metadata, ip_address, user_agent
      ) VALUES (
        'unfreeze', ${userId}, ${adminId}, 'Account unfrozen',
        ${JSON.stringify({})}::jsonb,
        ${metadata?.ipAddress || null}, ${metadata?.userAgent || null}
      )
    `

    console.info(`[EMERGENCY] Account ${userId} unfrozen by ${adminId}`)

    return {
      success: true,
      message: `Account ${userId} has been unfrozen`,
      actionId: updateResult.rows[0]?.id,
    }
  } catch (error) {
    console.error('[EMERGENCY] Failed to unfreeze account:', error)
    return {
      success: false,
      message: 'Failed to unfreeze account',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Flag an account for review
 */
export async function flagAccountForReview(
  userId: string,
  reason: string,
  adminId: string,
  reviewNotes?: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<EmergencyActionResult> {
  const auth = validateEmergencyAdmin(adminId)
  if (!auth.authorized) {
    return { success: false, message: auth.reason || 'Unauthorized', error: 'UNAUTHORIZED' }
  }

  try {
    // Check if already flagged or frozen
    const existing = await sql`
      SELECT id, status FROM grain_frozen_accounts
      WHERE user_id = ${userId} AND status IN ('frozen', 'under_review')
    `

    if (existing.rows.length > 0) {
      // Update existing record
      await sql`
        UPDATE grain_frozen_accounts
        SET
          status = 'under_review',
          review_notes = COALESCE(review_notes, '') || E'\n' || ${reviewNotes || reason},
          updated_at = NOW()
        WHERE user_id = ${userId} AND status IN ('frozen', 'under_review')
      `
    } else {
      // Create new review record
      await sql`
        INSERT INTO grain_frozen_accounts (
          user_id, freeze_reason, frozen_by, status, review_notes
        ) VALUES (
          ${userId}, ${reason}, ${adminId}, 'under_review', ${reviewNotes || null}
        )
      `
    }

    // Log the action
    await sql`
      INSERT INTO grain_emergency_audit_log (
        action_type, user_id, admin_id, reason, metadata, ip_address, user_agent
      ) VALUES (
        'flag_review', ${userId}, ${adminId}, ${reason},
        ${JSON.stringify({ reviewNotes })}::jsonb,
        ${metadata?.ipAddress || null}, ${metadata?.userAgent || null}
      )
    `

    console.info(`[EMERGENCY] Account ${userId} flagged for review by ${adminId}`)

    return {
      success: true,
      message: `Account ${userId} has been flagged for review`,
    }
  } catch (error) {
    console.error('[EMERGENCY] Failed to flag account:', error)
    return {
      success: false,
      message: 'Failed to flag account for review',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// STATUS CHECK FUNCTIONS
// ============================================================================

/**
 * Get current system status
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  try {
    // Get all control records
    const controls = await sql`
      SELECT operation_type, is_paused, pause_reason, paused_at, paused_by
      FROM grain_system_controls
    `

    // Parse control records
    let depositsEnabled = true
    let withdrawalsEnabled = true
    let transactionsEnabled = true
    let systemOperational = true
    const pausedOperations: SystemStatus['pausedOperations'] = []

    for (const row of controls.rows) {
      const isPaused = row.is_paused
      const opType = row.operation_type as OperationType

      if (isPaused) {
        pausedOperations.push({
          type: opType,
          reason: row.pause_reason || 'No reason provided',
          pausedAt: new Date(row.paused_at),
          pausedBy: row.paused_by,
        })

        switch (opType) {
          case 'deposits':
            depositsEnabled = false
            break
          case 'withdrawals':
            withdrawalsEnabled = false
            break
          case 'transactions':
            transactionsEnabled = false
            depositsEnabled = false
            withdrawalsEnabled = false
            break
          case 'all':
            systemOperational = false
            depositsEnabled = false
            withdrawalsEnabled = false
            transactionsEnabled = false
            break
        }
      }
    }

    // Get frozen accounts count
    const frozenResult = await sql`
      SELECT COUNT(*) as count FROM grain_frozen_accounts
      WHERE status IN ('frozen', 'under_review')
    `
    const frozenAccountsCount = parseInt(frozenResult.rows[0]?.count || '0')

    return {
      depositsEnabled,
      withdrawalsEnabled,
      transactionsEnabled,
      systemOperational,
      pausedOperations,
      frozenAccountsCount,
      lastStatusCheck: new Date(),
    }
  } catch (error) {
    console.error('[EMERGENCY] Failed to get system status:', error)
    // Return conservative status on error (assume system is down)
    return {
      depositsEnabled: false,
      withdrawalsEnabled: false,
      transactionsEnabled: false,
      systemOperational: false,
      pausedOperations: [],
      frozenAccountsCount: 0,
      lastStatusCheck: new Date(),
    }
  }
}

/**
 * Check if a specific operation is allowed for a user
 */
export async function isOperationAllowed(
  operationType: 'deposit' | 'withdrawal' | 'transaction' | 'transfer',
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // First check if user account is frozen
    const frozenCheck = await sql`
      SELECT id, freeze_reason FROM grain_frozen_accounts
      WHERE user_id = ${userId} AND status IN ('frozen', 'under_review')
      LIMIT 1
    `

    if (frozenCheck.rows.length > 0) {
      return {
        allowed: false,
        reason: `Account is frozen: ${frozenCheck.rows[0].freeze_reason}`,
      }
    }

    // Get system status
    const status = await getSystemStatus()

    // Check if system is operational
    if (!status.systemOperational) {
      return {
        allowed: false,
        reason: 'System is currently in lockdown mode',
      }
    }

    // Check specific operation type
    switch (operationType) {
      case 'deposit':
        if (!status.depositsEnabled) {
          return {
            allowed: false,
            reason: 'Deposits are currently paused',
          }
        }
        break
      case 'withdrawal':
        if (!status.withdrawalsEnabled) {
          return {
            allowed: false,
            reason: 'Withdrawals are currently paused',
          }
        }
        break
      case 'transaction':
      case 'transfer':
        if (!status.transactionsEnabled) {
          return {
            allowed: false,
            reason: 'Transactions are currently paused',
          }
        }
        break
    }

    return { allowed: true }
  } catch (error) {
    console.error('[EMERGENCY] Failed to check operation:', error)
    // Fail closed - deny operation on error
    return {
      allowed: false,
      reason: 'Unable to verify operation status. Please try again.',
    }
  }
}

/**
 * Check if a user account is frozen
 */
export async function isAccountFrozen(userId: string): Promise<{
  frozen: boolean
  reason?: string
  status?: 'frozen' | 'under_review'
}> {
  try {
    const result = await sql`
      SELECT freeze_reason, status FROM grain_frozen_accounts
      WHERE user_id = ${userId} AND status IN ('frozen', 'under_review')
      LIMIT 1
    `

    if (result.rows.length > 0) {
      return {
        frozen: true,
        reason: result.rows[0].freeze_reason,
        status: result.rows[0].status,
      }
    }

    return { frozen: false }
  } catch (error) {
    console.error('[EMERGENCY] Failed to check frozen status:', error)
    return { frozen: false }
  }
}

/**
 * Get list of frozen accounts
 */
export async function getFrozenAccounts(): Promise<FrozenAccount[]> {
  try {
    const result = await sql`
      SELECT
        id, user_id, freeze_reason, frozen_by, frozen_at,
        unfrozen_at, unfrozen_by, review_notes, status
      FROM grain_frozen_accounts
      WHERE status IN ('frozen', 'under_review')
      ORDER BY frozen_at DESC
    `

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      freezeReason: row.freeze_reason,
      frozenBy: row.frozen_by,
      frozenAt: new Date(row.frozen_at),
      unfrozenAt: row.unfrozen_at ? new Date(row.unfrozen_at) : null,
      unfrozenBy: row.unfrozen_by,
      reviewNotes: row.review_notes,
      status: row.status,
    }))
  } catch (error) {
    console.error('[EMERGENCY] Failed to get frozen accounts:', error)
    return []
  }
}

/**
 * Get emergency audit log
 */
export async function getEmergencyAuditLog(
  limit: number = 100,
  offset: number = 0
): Promise<EmergencyAuditLog[]> {
  try {
    const result = await sql`
      SELECT
        id, action_type, operation_type, user_id, admin_id,
        reason, metadata, ip_address, user_agent, created_at
      FROM grain_emergency_audit_log
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    return result.rows.map(row => ({
      id: row.id,
      actionType: row.action_type,
      operationType: row.operation_type,
      userId: row.user_id,
      adminId: row.admin_id,
      reason: row.reason,
      metadata: row.metadata || {},
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: new Date(row.created_at),
    }))
  } catch (error) {
    console.error('[EMERGENCY] Failed to get audit log:', error)
    return []
  }
}

// ============================================================================
// ADMIN NOTIFICATIONS
// ============================================================================

/**
 * Send notification to admins about emergency action
 */
async function notifyAdmins(
  subject: string,
  message: string,
  triggeredBy: string
): Promise<void> {
  const adminEmail = process.env.EMERGENCY_ADMIN_EMAIL
  const slackWebhook = process.env.EMERGENCY_SLACK_WEBHOOK

  const timestamp = new Date().toISOString()
  const fullMessage = `
[EMERGENCY ALERT]
Action: ${subject}
Message: ${message}
Triggered By: ${triggeredBy}
Timestamp: ${timestamp}
  `.trim()

  // Log to console (always)
  console.warn(`[EMERGENCY NOTIFICATION] ${fullMessage}`)

  // Send email notification
  if (adminEmail) {
    try {
      // Use your email service (e.g., SendGrid, Resend, etc.)
      // This is a placeholder - implement based on your email provider
      const response = await fetch(process.env.EMAIL_API_URL || '', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
        },
        body: JSON.stringify({
          to: adminEmail,
          subject: `[GRAIN EMERGENCY] ${subject}`,
          text: fullMessage,
          priority: 'high',
        }),
      }).catch(() => null)

      if (!response?.ok) {
        console.error('[EMERGENCY] Failed to send email notification')
      }
    } catch (error) {
      console.error('[EMERGENCY] Email notification error:', error)
    }
  }

  // Send Slack notification
  if (slackWebhook) {
    try {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*[GRAIN EMERGENCY]*\n*Action:* ${subject}\n*Message:* ${message}\n*Triggered By:* ${triggeredBy}\n*Time:* ${timestamp}`,
          attachments: [
            {
              color: 'danger',
              title: 'Emergency Control Action',
              fields: [
                { title: 'Action', value: subject, short: true },
                { title: 'Admin', value: triggeredBy, short: true },
              ],
            },
          ],
        }),
      }).catch(() => null)
    } catch (error) {
      console.error('[EMERGENCY] Slack notification error:', error)
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Admin validation
  validateEmergencyAdmin,

  // System-wide controls
  pauseDeposits,
  pauseWithdrawals,
  pauseAllTransactions,
  systemLockdown,
  resumeOperations,

  // User-level controls
  freezeAccount,
  unfreezeAccount,
  flagAccountForReview,

  // Status checks
  getSystemStatus,
  isOperationAllowed,
  isAccountFrozen,
  getFrozenAccounts,
  getEmergencyAuditLog,

  // Initialization
  initializeEmergencyTables,
}
