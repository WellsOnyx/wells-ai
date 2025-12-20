/**
 * Emergency Controls Admin API
 *
 * CRITICAL SECURITY ENDPOINT
 *
 * Provides admin access to emergency controls:
 * - POST: Pause operations (deposits, withdrawals, transactions, all)
 * - DELETE: Resume operations
 * - GET: Check current system status
 *
 * All actions require special admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  validateEmergencyAdmin,
  pauseDeposits,
  pauseWithdrawals,
  pauseAllTransactions,
  systemLockdown,
  resumeOperations,
  freezeAccount,
  unfreezeAccount,
  flagAccountForReview,
  getSystemStatus,
  getFrozenAccounts,
  getEmergencyAuditLog,
  initializeEmergencyTables,
  type OperationType,
} from '@/lib/security/emergency-controls'

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Validate admin access for emergency operations
 */
async function validateRequest(request: NextRequest): Promise<{
  authorized: boolean
  adminId?: string
  error?: string
}> {
  try {
    // Check for master key in Authorization header
    const authHeader = request.headers.get('Authorization')
    const masterKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null

    // Get authenticated user from Clerk
    const { userId } = await auth()

    if (!userId && !masterKey) {
      return {
        authorized: false,
        error: 'Authentication required',
      }
    }

    // Validate emergency admin access
    const adminId = userId || 'master_key_admin'
    const validation = validateEmergencyAdmin(adminId, masterKey || undefined)

    if (!validation.authorized) {
      return {
        authorized: false,
        error: validation.reason || 'Unauthorized for emergency operations',
      }
    }

    return {
      authorized: true,
      adminId,
    }
  } catch (error) {
    console.error('[EMERGENCY API] Auth error:', error)
    return {
      authorized: false,
      error: 'Authentication failed',
    }
  }
}

/**
 * Get request metadata for audit logging
 */
function getRequestMetadata(request: NextRequest): {
  ipAddress?: string
  userAgent?: string
} {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ipAddress = forwardedFor?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined

  const userAgent = request.headers.get('user-agent') || undefined

  return { ipAddress, userAgent }
}

// ============================================================================
// GET - Check System Status
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await validateRequest(request)

  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    )
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const includeAuditLog = searchParams.get('includeAuditLog') === 'true'
    const includeFrozenAccounts = searchParams.get('includeFrozenAccounts') === 'true'
    const auditLimit = parseInt(searchParams.get('auditLimit') || '50')

    // Get system status
    const status = await getSystemStatus()

    const response: Record<string, unknown> = {
      status,
      timestamp: new Date().toISOString(),
    }

    // Optionally include frozen accounts
    if (includeFrozenAccounts) {
      response.frozenAccounts = await getFrozenAccounts()
    }

    // Optionally include audit log
    if (includeAuditLog) {
      response.auditLog = await getEmergencyAuditLog(auditLimit)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[EMERGENCY API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get system status' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Pause Operations
// ============================================================================

export async function POST(request: NextRequest) {
  const authResult = await validateRequest(request)

  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const {
      action,
      operationType,
      reason,
      userId,
      reviewNotes,
    } = body as {
      action: 'pause' | 'freeze' | 'flag_review' | 'lockdown' | 'init_tables'
      operationType?: OperationType
      reason?: string
      userId?: string
      reviewNotes?: string
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    const metadata = getRequestMetadata(request)
    const adminId = authResult.adminId!

    let result

    switch (action) {
      case 'init_tables':
        // Initialize emergency tables
        await initializeEmergencyTables()
        result = { success: true, message: 'Emergency tables initialized' }
        break

      case 'pause':
        if (!reason) {
          return NextResponse.json(
            { error: 'Reason is required for pause action' },
            { status: 400 }
          )
        }

        if (!operationType) {
          return NextResponse.json(
            { error: 'Operation type is required for pause action' },
            { status: 400 }
          )
        }

        switch (operationType) {
          case 'deposits':
            result = await pauseDeposits(reason, adminId, metadata)
            break
          case 'withdrawals':
            result = await pauseWithdrawals(reason, adminId, metadata)
            break
          case 'transactions':
            result = await pauseAllTransactions(reason, adminId, metadata)
            break
          case 'all':
            result = await systemLockdown(reason, adminId, metadata)
            break
          default:
            return NextResponse.json(
              { error: 'Invalid operation type' },
              { status: 400 }
            )
        }
        break

      case 'lockdown':
        if (!reason) {
          return NextResponse.json(
            { error: 'Reason is required for lockdown' },
            { status: 400 }
          )
        }
        result = await systemLockdown(reason, adminId, metadata)
        break

      case 'freeze':
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required for freeze action' },
            { status: 400 }
          )
        }
        if (!reason) {
          return NextResponse.json(
            { error: 'Reason is required for freeze action' },
            { status: 400 }
          )
        }
        result = await freezeAccount(userId, reason, adminId, metadata)
        break

      case 'flag_review':
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required for flag action' },
            { status: 400 }
          )
        }
        if (!reason) {
          return NextResponse.json(
            { error: 'Reason is required for flag action' },
            { status: 400 }
          )
        }
        result = await flagAccountForReview(userId, reason, adminId, reviewNotes, metadata)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, code: result.error },
        { status: result.error === 'UNAUTHORIZED' ? 403 : 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      actionId: result.actionId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[EMERGENCY API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to execute emergency action' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Resume Operations / Unfreeze Accounts
// ============================================================================

export async function DELETE(request: NextRequest) {
  const authResult = await validateRequest(request)

  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const {
      action,
      operationType,
      userId,
    } = body as {
      action: 'resume' | 'unfreeze'
      operationType?: OperationType
      userId?: string
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    const metadata = getRequestMetadata(request)
    const adminId = authResult.adminId!

    let result

    switch (action) {
      case 'resume':
        result = await resumeOperations(adminId, operationType, metadata)
        break

      case 'unfreeze':
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required for unfreeze action' },
            { status: 400 }
          )
        }
        result = await unfreezeAccount(userId, adminId, metadata)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, code: result.error },
        { status: result.error === 'UNAUTHORIZED' ? 403 : 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      actionId: result.actionId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[EMERGENCY API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to execute resume action' },
      { status: 500 }
    )
  }
}

// ============================================================================
// OPTIONS - CORS preflight
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
