/**
 * Admin User Approval API
 *
 * Endpoints for approving/rejecting Grain & Vault user signups
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// Admin user IDs - in production, use a proper RBAC system
const ADMIN_USER_IDS = [
  'user_2qNUPVfJ5dQ27xQYZMD6uNNJqGq', // Add your admin Clerk user IDs here
  process.env.ADMIN_CLERK_USER_ID,
].filter(Boolean)

// Admin emails - fallback for admin check
const ADMIN_EMAILS = [
  'jonah@wellsonyx.com',
  'admin@grainvault.io',
  process.env.ADMIN_EMAIL,
].filter(Boolean)

async function isAdmin(userId: string): Promise<boolean> {
  // Check by user ID
  if (ADMIN_USER_IDS.includes(userId)) {
    return true
  }

  // Check by email
  const user = await currentUser()
  if (user?.emailAddresses?.some(e => ADMIN_EMAILS.includes(e.emailAddress))) {
    return true
  }

  return false
}

// =============================================================================
// GET - List pending approvals
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin access
    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending' // 'pending', 'approved', 'all'

    let query
    if (status === 'all') {
      query = sql`
        SELECT
          user_id,
          wallet_id,
          wallet_address,
          balance,
          approved,
          approved_at,
          approved_by,
          created_at,
          updated_at
        FROM user_wallets
        ORDER BY created_at DESC
        LIMIT 100
      `
    } else if (status === 'approved') {
      query = sql`
        SELECT
          user_id,
          wallet_id,
          wallet_address,
          balance,
          approved,
          approved_at,
          approved_by,
          created_at,
          updated_at
        FROM user_wallets
        WHERE approved = TRUE
        ORDER BY approved_at DESC
        LIMIT 100
      `
    } else {
      // Pending (default)
      query = sql`
        SELECT
          user_id,
          wallet_id,
          wallet_address,
          balance,
          approved,
          approved_at,
          approved_by,
          created_at,
          updated_at
        FROM user_wallets
        WHERE approved = FALSE OR approved IS NULL
        ORDER BY created_at ASC
      `
    }

    const result = await query

    // Enhance with profile data if available
    const users = await Promise.all(
      result.rows.map(async (wallet) => {
        let profile = null
        try {
          const profileResult = await sql`
            SELECT email, full_name, phone, verification_level, status
            FROM grain_user_profiles
            WHERE user_id = ${wallet.user_id}
          `
          if (profileResult.rows.length > 0) {
            profile = profileResult.rows[0]
          }
        } catch (e) {
          // Profile may not exist
        }

        return {
          user_id: wallet.user_id,
          wallet_id: wallet.wallet_id,
          balance: parseFloat(wallet.balance || '0'),
          approved: wallet.approved === true,
          approved_at: wallet.approved_at,
          approved_by: wallet.approved_by,
          created_at: wallet.created_at,
          updated_at: wallet.updated_at,
          hours_pending: wallet.approved ? null : Math.round((Date.now() - new Date(wallet.created_at).getTime()) / (1000 * 60 * 60)),
          profile: profile
            ? {
                email: profile.email,
                full_name: profile.full_name,
                phone: profile.phone,
                verification_level: profile.verification_level,
                status: profile.status,
              }
            : null,
        }
      })
    )

    return NextResponse.json({
      success: true,
      status: status,
      count: users.length,
      users,
    })
  } catch (error: any) {
    console.error('[Admin Approval] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST - Approve or reject a user
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const { userId: adminId } = await auth()
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin access
    if (!(await isAdmin(adminId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const { user_id, action, reason, notes } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    if (!action || !['approve', 'reject', 'revoke', 'reinstate'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: approve, reject, revoke, reinstate' },
        { status: 400 }
      )
    }

    // Get admin details for audit log
    const admin = await currentUser()
    const adminEmail = admin?.emailAddresses?.[0]?.emailAddress || adminId

    // Perform the action
    if (action === 'approve' || action === 'reinstate') {
      // Approve the user
      await sql`
        UPDATE user_wallets
        SET
          approved = TRUE,
          approved_at = NOW(),
          approved_by = ${adminEmail},
          approval_notes = ${notes || null}
        WHERE user_id = ${user_id}
      `

      // Log the action
      await sql`
        INSERT INTO user_approval_log (user_id, action, admin_id, admin_email, reason, notes)
        VALUES (${user_id}, ${action}, ${adminId}, ${adminEmail}, ${reason || null}, ${notes || null})
      `

      console.log(`[Admin Approval] User ${user_id} ${action}d by ${adminEmail}`)

      return NextResponse.json({
        success: true,
        action: action,
        user_id: user_id,
        approved_by: adminEmail,
        approved_at: new Date().toISOString(),
        message: `User ${action === 'approve' ? 'approved' : 'reinstated'} successfully`,
      })
    } else if (action === 'reject' || action === 'revoke') {
      // Reject/revoke the user
      await sql`
        UPDATE user_wallets
        SET
          approved = FALSE,
          approved_at = NULL,
          approved_by = NULL,
          approval_notes = ${reason || notes || 'Rejected by admin'}
        WHERE user_id = ${user_id}
      `

      // Log the action
      await sql`
        INSERT INTO user_approval_log (user_id, action, admin_id, admin_email, reason, notes)
        VALUES (${user_id}, ${action}, ${adminId}, ${adminEmail}, ${reason || null}, ${notes || null})
      `

      console.log(`[Admin Approval] User ${user_id} ${action}ed by ${adminEmail}`)

      return NextResponse.json({
        success: true,
        action: action,
        user_id: user_id,
        message: `User ${action === 'reject' ? 'rejected' : 'revoked'} successfully`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[Admin Approval] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process approval' },
      { status: 500 }
    )
  }
}

// =============================================================================
// PATCH - Bulk approve users
// =============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const { userId: adminId } = await auth()
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin access
    if (!(await isAdmin(adminId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const { user_ids, action, reason } = body

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids array is required' }, { status: 400 })
    }

    if (user_ids.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 users per batch' }, { status: 400 })
    }

    if (action !== 'approve') {
      return NextResponse.json({ error: 'Only bulk approve is supported' }, { status: 400 })
    }

    // Get admin details
    const admin = await currentUser()
    const adminEmail = admin?.emailAddresses?.[0]?.emailAddress || adminId

    // Bulk approve
    let approvedCount = 0
    for (const userId of user_ids) {
      try {
        await sql`
          UPDATE user_wallets
          SET
            approved = TRUE,
            approved_at = NOW(),
            approved_by = ${adminEmail}
          WHERE user_id = ${userId}
            AND (approved = FALSE OR approved IS NULL)
        `

        await sql`
          INSERT INTO user_approval_log (user_id, action, admin_id, admin_email, reason, notes)
          VALUES (${userId}, 'approve', ${adminId}, ${adminEmail}, ${reason || 'Bulk approval'}, 'Bulk action')
        `

        approvedCount++
      } catch (e) {
        console.warn(`[Admin Approval] Failed to approve ${userId}:`, e)
      }
    }

    console.log(`[Admin Approval] Bulk approved ${approvedCount}/${user_ids.length} users by ${adminEmail}`)

    return NextResponse.json({
      success: true,
      action: 'bulk_approve',
      requested: user_ids.length,
      approved: approvedCount,
      approved_by: adminEmail,
      message: `Successfully approved ${approvedCount} users`,
    })
  } catch (error: any) {
    console.error('[Admin Approval] PATCH error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to bulk approve' },
      { status: 500 }
    )
  }
}
