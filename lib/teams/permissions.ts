// @ts-nocheck
/**
 * Permissions Service
 *
 * Role-based access control (RBAC) for team collaboration
 * Manages permissions and authorization
 */

import { sql } from '@vercel/postgres'
import { getOrganizationMember } from './team-service'

// ============================================================================
// TYPES
// ============================================================================

export interface Permission {
  id: string
  role: string
  resource: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canApprove: boolean
  constraints: Record<string, any>
}

export type Role = 'owner' | 'admin' | 'member' | 'viewer'

export type Resource =
  | 'deals'
  | 'leads'
  | 'suppliers'
  | 'payments'
  | 'treasury'
  | 'settings'
  | 'members'
  | 'teams'

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve'

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Check if a user has permission to perform an action
 */
export async function hasPermission(
  userId: string,
  orgId: string,
  resource: Resource,
  action: Action
): Promise<boolean> {
  try {
    // Get user's role in organization
    const member = await getOrganizationMember(orgId, userId)

    if (!member) {
      return false
    }

    // Get permissions for this role and resource
    const permission = await getPermissionForRole(member.role, resource)

    if (!permission) {
      return false
    }

    // Check the specific action
    switch (action) {
      case 'view':
        return permission.canView
      case 'create':
        return permission.canCreate
      case 'edit':
        return permission.canEdit
      case 'delete':
        return permission.canDelete
      case 'approve':
        return permission.canApprove
      default:
        return false
    }
  } catch (error) {
    console.error('Error checking permission:', error)
    return false
  }
}

/**
 * Get permission for a specific role and resource
 */
export async function getPermissionForRole(
  role: Role,
  resource: Resource
): Promise<Permission | null> {
  try {
    const result = await sql`
      SELECT * FROM permissions
      WHERE role = ${role}
      AND resource = ${resource}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapPermissionFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching permission:', error)
    return null
  }
}

/**
 * Get all permissions for a role
 */
export async function getRolePermissions(role: Role): Promise<Permission[]> {
  try {
    const result = await sql`
      SELECT * FROM permissions
      WHERE role = ${role}
      ORDER BY resource
    `

    return result.rows.map(mapPermissionFromDb)
  } catch (error) {
    console.error('Error fetching role permissions:', error)
    return []
  }
}

// ============================================================================
// SPECIALIZED PERMISSION CHECKS
// ============================================================================

/**
 * Check if user can view a specific deal
 * Members can only view deals assigned to them
 */
export async function canViewDeal(
  userId: string,
  orgId: string,
  dealId: string
): Promise<boolean> {
  try {
    const member = await getOrganizationMember(orgId, userId)

    if (!member) {
      return false
    }

    // Owners and admins can view all deals
    if (member.role === 'owner' || member.role === 'admin') {
      return true
    }

    // Members can only view assigned deals
    if (member.role === 'member') {
      const assignment = await sql`
        SELECT * FROM assignments
        WHERE entity_type = 'deal'
        AND entity_id = ${dealId}
        AND assigned_to = ${userId}
        AND status = 'active'
      `

      return assignment.rows.length > 0
    }

    // Viewers can't view deals
    return false
  } catch (error) {
    console.error('Error checking deal view permission:', error)
    return false
  }
}

/**
 * Check if user can approve treasury operations
 * Only owners and admins can approve, with amount limits
 */
export async function canApproveTreasury(
  userId: string,
  orgId: string,
  amount: number
): Promise<{ canApprove: boolean; reason?: string }> {
  try {
    const member = await getOrganizationMember(orgId, userId)

    if (!member) {
      return { canApprove: false, reason: 'User not in organization' }
    }

    // Owners can approve any amount
    if (member.role === 'owner') {
      return { canApprove: true }
    }

    // Admins have approval limits
    if (member.role === 'admin') {
      const ADMIN_APPROVAL_LIMIT = 100000 // $100k in GRAIN

      if (amount > ADMIN_APPROVAL_LIMIT) {
        return {
          canApprove: false,
          reason: `Amount exceeds admin limit of ${ADMIN_APPROVAL_LIMIT.toLocaleString()} GRAIN`,
        }
      }

      return { canApprove: true }
    }

    // Members and viewers cannot approve
    return {
      canApprove: false,
      reason: 'Insufficient permissions',
    }
  } catch (error) {
    console.error('Error checking treasury approval permission:', error)
    return { canApprove: false, reason: 'Error checking permissions' }
  }
}

/**
 * Check if user can approve a payment
 */
export async function canApprovePayment(
  userId: string,
  orgId: string,
  amount: number
): Promise<boolean> {
  try {
    const member = await getOrganizationMember(orgId, userId)

    if (!member) {
      return false
    }

    // Only owners and admins can approve payments
    if (member.role !== 'owner' && member.role !== 'admin') {
      return false
    }

    // Admins have payment approval limits
    if (member.role === 'admin') {
      const ADMIN_PAYMENT_LIMIT = 50000 // $50k

      return amount <= ADMIN_PAYMENT_LIMIT
    }

    // Owners can approve any amount
    return true
  } catch (error) {
    console.error('Error checking payment approval permission:', error)
    return false
  }
}

/**
 * Get all deals accessible to a user
 */
export async function getAccessibleDeals(
  userId: string,
  orgId: string
): Promise<string[]> {
  try {
    const member = await getOrganizationMember(orgId, userId)

    if (!member) {
      return []
    }

    // Owners and admins can access all deals
    if (member.role === 'owner' || member.role === 'admin') {
      const result = await sql`
        SELECT id FROM deals
        WHERE org_id = ${orgId}
      `

      return result.rows.map(row => row.id)
    }

    // Members can only access assigned deals
    if (member.role === 'member') {
      const result = await sql`
        SELECT entity_id FROM assignments
        WHERE entity_type = 'deal'
        AND assigned_to = ${userId}
        AND status = 'active'
      `

      return result.rows.map(row => row.entity_id)
    }

    // Viewers can't access deals
    return []
  } catch (error) {
    console.error('Error getting accessible deals:', error)
    return []
  }
}

/**
 * Check if user can manage organization settings
 */
export async function canManageSettings(
  userId: string,
  orgId: string
): Promise<boolean> {
  try {
    const member = await getOrganizationMember(orgId, userId)

    if (!member) {
      return false
    }

    // Only owners and admins can manage settings
    return member.role === 'owner' || member.role === 'admin'
  } catch (error) {
    console.error('Error checking settings permission:', error)
    return false
  }
}

/**
 * Check if user can invite members
 */
export async function canInviteMembers(
  userId: string,
  orgId: string
): Promise<boolean> {
  try {
    const member = await getOrganizationMember(orgId, userId)

    if (!member) {
      return false
    }

    // Only owners and admins can invite
    return member.role === 'owner' || member.role === 'admin'
  } catch (error) {
    console.error('Error checking invite permission:', error)
    return false
  }
}

/**
 * Check if user can remove members
 */
export async function canRemoveMembers(
  userId: string,
  orgId: string,
  targetUserId: string
): Promise<{ canRemove: boolean; reason?: string }> {
  try {
    const member = await getOrganizationMember(orgId, userId)
    const targetMember = await getOrganizationMember(orgId, targetUserId)

    if (!member || !targetMember) {
      return { canRemove: false, reason: 'User not found' }
    }

    // Can't remove yourself (use leave organization instead)
    if (userId === targetUserId) {
      return { canRemove: false, reason: 'Cannot remove yourself' }
    }

    // Owners can remove anyone except other owners
    if (member.role === 'owner') {
      if (targetMember.role === 'owner') {
        return { canRemove: false, reason: 'Cannot remove other owners' }
      }
      return { canRemove: true }
    }

    // Admins can remove members and viewers, not other admins or owners
    if (member.role === 'admin') {
      if (targetMember.role === 'owner' || targetMember.role === 'admin') {
        return { canRemove: false, reason: 'Cannot remove admins or owners' }
      }
      return { canRemove: true }
    }

    // Members and viewers cannot remove anyone
    return { canRemove: false, reason: 'Insufficient permissions' }
  } catch (error) {
    console.error('Error checking remove permission:', error)
    return { canRemove: false, reason: 'Error checking permissions' }
  }
}

/**
 * Check if user is organization owner
 */
export async function isOrganizationOwner(
  userId: string,
  orgId: string
): Promise<boolean> {
  try {
    const member = await getOrganizationMember(orgId, userId)

    if (!member) {
      return false
    }

    return member.role === 'owner'
  } catch (error) {
    console.error('Error checking owner status:', error)
    return false
  }
}

/**
 * Get user's role in organization
 */
export async function getUserRole(
  userId: string,
  orgId: string
): Promise<Role | null> {
  try {
    const member = await getOrganizationMember(orgId, userId)

    if (!member) {
      return null
    }

    return member.role
  } catch (error) {
    console.error('Error fetching user role:', error)
    return null
  }
}

// ============================================================================
// PERMISSION CONSTANTS
// ============================================================================

/**
 * Complete permission matrix for all roles
 */
export const ROLE_PERMISSIONS: Record<Role, Record<Resource, Record<Action, boolean>>> = {
  owner: {
    deals: { view: true, create: true, edit: true, delete: true, approve: true },
    leads: { view: true, create: true, edit: true, delete: true, approve: false },
    suppliers: { view: true, create: true, edit: true, delete: true, approve: false },
    payments: { view: true, create: true, edit: true, delete: true, approve: true },
    treasury: { view: true, create: true, edit: true, delete: true, approve: true },
    settings: { view: true, create: true, edit: true, delete: true, approve: false },
    members: { view: true, create: true, edit: true, delete: true, approve: false },
    teams: { view: true, create: true, edit: true, delete: true, approve: false },
  },
  admin: {
    deals: { view: true, create: true, edit: true, delete: true, approve: true },
    leads: { view: true, create: true, edit: true, delete: true, approve: false },
    suppliers: { view: true, create: true, edit: true, delete: true, approve: false },
    payments: { view: true, create: true, edit: true, delete: false, approve: true },
    treasury: { view: true, create: false, edit: false, delete: false, approve: false },
    settings: { view: true, create: true, edit: true, delete: false, approve: false },
    members: { view: true, create: true, edit: true, delete: true, approve: false },
    teams: { view: true, create: true, edit: true, delete: true, approve: false },
  },
  member: {
    deals: { view: true, create: true, edit: true, delete: false, approve: false },
    leads: { view: true, create: true, edit: true, delete: false, approve: false },
    suppliers: { view: true, create: false, edit: false, delete: false, approve: false },
    payments: { view: true, create: true, edit: false, delete: false, approve: false },
    treasury: { view: false, create: false, edit: false, delete: false, approve: false },
    settings: { view: false, create: false, edit: false, delete: false, approve: false },
    members: { view: true, create: false, edit: false, delete: false, approve: false },
    teams: { view: true, create: false, edit: false, delete: false, approve: false },
  },
  viewer: {
    deals: { view: false, create: false, edit: false, delete: false, approve: false },
    leads: { view: false, create: false, edit: false, delete: false, approve: false },
    suppliers: { view: false, create: false, edit: false, delete: false, approve: false },
    payments: { view: false, create: false, edit: false, delete: false, approve: false },
    treasury: { view: false, create: false, edit: false, delete: false, approve: false },
    settings: { view: false, create: false, edit: false, delete: false, approve: false },
    members: { view: true, create: false, edit: false, delete: false, approve: false },
    teams: { view: true, create: false, edit: false, delete: false, approve: false },
  },
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mapPermissionFromDb(row: any): Permission {
  return {
    id: row.id,
    role: row.role,
    resource: row.resource,
    canView: row.can_view,
    canCreate: row.can_create,
    canEdit: row.can_edit,
    canDelete: row.can_delete,
    canApprove: row.can_approve,
    constraints: row.constraints || {},
  }
}
