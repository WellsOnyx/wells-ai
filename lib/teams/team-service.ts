// @ts-nocheck
/**
 * Team Service
 *
 * Manages organizations, teams, and members
 * Provides core team collaboration functionality
 */

import { sql } from '@vercel/postgres'
import { randomBytes } from 'crypto'

// ============================================================================
// TYPES
// ============================================================================

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  logoUrl?: string
  website?: string
  industry?: string
  companySize?: string
  country?: string
  settings: Record<string, any>
  plan: string
  billingEmail?: string
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface OrganizationMember {
  id: string
  orgId: string
  userId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  permissions: Record<string, any>
  displayName?: string
  title?: string
  department?: string
  avatarUrl?: string
  invitedBy?: string
  invitedAt?: Date
  status: string
  joinedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface Team {
  id: string
  orgId: string
  name: string
  slug: string
  description?: string
  focusArea?: string
  settings: Record<string, any>
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: 'lead' | 'member'
  joinedAt: Date
  createdAt: Date
}

export interface Invite {
  id: string
  orgId: string
  email: string
  role: string
  token: string
  message?: string
  invitedBy: string
  status: string
  createdAt: Date
  expiresAt: Date
  acceptedAt?: Date
  revokedAt?: Date
}

// ============================================================================
// ORGANIZATION OPERATIONS
// ============================================================================

/**
 * Create a new organization
 */
export async function createOrganization(
  name: string,
  ownerId: string,
  options?: {
    slug?: string
    description?: string
    industry?: string
    companySize?: string
    country?: string
  }
): Promise<Organization> {
  try {
    // Generate slug if not provided
    const slug = options?.slug || generateSlug(name)

    const result = await sql`
      INSERT INTO organizations (
        name,
        slug,
        description,
        industry,
        company_size,
        country,
        status
      ) VALUES (
        ${name},
        ${slug},
        ${options?.description || null},
        ${options?.industry || null},
        ${options?.companySize || null},
        ${options?.country || null},
        'active'
      )
      RETURNING *
    `

    const org = mapOrganizationFromDb(result.rows[0])

    // Add owner as first member
    await addOrganizationMember(org.id, ownerId, 'owner', ownerId)

    return org
  } catch (error) {
    console.error('Error creating organization:', error)
    throw new Error('Failed to create organization')
  }
}

/**
 * Get organization by ID
 */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  try {
    const result = await sql`
      SELECT * FROM organizations WHERE id = ${orgId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapOrganizationFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching organization:', error)
    throw new Error('Failed to fetch organization')
  }
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  try {
    const result = await sql`
      SELECT * FROM organizations WHERE slug = ${slug}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapOrganizationFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching organization by slug:', error)
    throw new Error('Failed to fetch organization')
  }
}

/**
 * Get organizations for a user
 */
export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  try {
    const result = await sql`
      SELECT o.*
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.org_id
      WHERE om.user_id = ${userId}
      AND om.status = 'active'
      ORDER BY o.created_at DESC
    `

    return result.rows.map(mapOrganizationFromDb)
  } catch (error) {
    console.error('Error fetching user organizations:', error)
    throw new Error('Failed to fetch user organizations')
  }
}

/**
 * Update organization
 */
export async function updateOrganization(
  orgId: string,
  updates: {
    name?: string
    description?: string
    logoUrl?: string
    website?: string
    industry?: string
    companySize?: string
    settings?: Record<string, any>
  }
): Promise<Organization> {
  try {
    const setClauses: string[] = []
    const params: any[] = []

    if (updates.name !== undefined) {
      setClauses.push(`name = $${params.length + 1}`)
      params.push(updates.name)
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${params.length + 1}`)
      params.push(updates.description)
    }
    if (updates.logoUrl !== undefined) {
      setClauses.push(`logo_url = $${params.length + 1}`)
      params.push(updates.logoUrl)
    }
    if (updates.website !== undefined) {
      setClauses.push(`website = $${params.length + 1}`)
      params.push(updates.website)
    }
    if (updates.industry !== undefined) {
      setClauses.push(`industry = $${params.length + 1}`)
      params.push(updates.industry)
    }
    if (updates.companySize !== undefined) {
      setClauses.push(`company_size = $${params.length + 1}`)
      params.push(updates.companySize)
    }
    if (updates.settings !== undefined) {
      setClauses.push(`settings = $${params.length + 1}`)
      params.push(JSON.stringify(updates.settings))
    }

    setClauses.push('updated_at = NOW()')

    const updateQuery = `
      UPDATE organizations
      SET ${setClauses.join(', ')}
      WHERE id = $${params.length + 1}
      RETURNING *
    `

    const result = await sql.query(updateQuery, [...params, orgId])

    if (result.rows.length === 0) {
      throw new Error('Organization not found')
    }

    return mapOrganizationFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating organization:', error)
    throw new Error('Failed to update organization')
  }
}

// ============================================================================
// ORGANIZATION MEMBER OPERATIONS
// ============================================================================

/**
 * Add a member to an organization
 */
export async function addOrganizationMember(
  orgId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member' | 'viewer',
  invitedBy?: string
): Promise<OrganizationMember> {
  try {
    const result = await sql`
      INSERT INTO organization_members (
        org_id,
        user_id,
        role,
        invited_by,
        status
      ) VALUES (
        ${orgId},
        ${userId},
        ${role},
        ${invitedBy || null},
        'active'
      )
      RETURNING *
    `

    return mapOrganizationMemberFromDb(result.rows[0])
  } catch (error) {
    console.error('Error adding organization member:', error)
    throw new Error('Failed to add organization member')
  }
}

/**
 * Get organization members
 */
export async function getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  try {
    const result = await sql`
      SELECT * FROM organization_members
      WHERE org_id = ${orgId}
      AND status = 'active'
      ORDER BY created_at ASC
    `

    return result.rows.map(mapOrganizationMemberFromDb)
  } catch (error) {
    console.error('Error fetching organization members:', error)
    throw new Error('Failed to fetch organization members')
  }
}

/**
 * Get a specific member
 */
export async function getOrganizationMember(
  orgId: string,
  userId: string
): Promise<OrganizationMember | null> {
  try {
    const result = await sql`
      SELECT * FROM organization_members
      WHERE org_id = ${orgId}
      AND user_id = ${userId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapOrganizationMemberFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching organization member:', error)
    throw new Error('Failed to fetch organization member')
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(
  orgId: string,
  userId: string,
  newRole: 'owner' | 'admin' | 'member' | 'viewer'
): Promise<OrganizationMember> {
  try {
    const result = await sql`
      UPDATE organization_members
      SET role = ${newRole}, updated_at = NOW()
      WHERE org_id = ${orgId}
      AND user_id = ${userId}
      RETURNING *
    `

    if (result.rows.length === 0) {
      throw new Error('Member not found')
    }

    return mapOrganizationMemberFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating member role:', error)
    throw new Error('Failed to update member role')
  }
}

/**
 * Remove member from organization
 */
export async function removeFromOrganization(
  orgId: string,
  userId: string
): Promise<void> {
  try {
    await sql`
      UPDATE organization_members
      SET status = 'removed', updated_at = NOW()
      WHERE org_id = ${orgId}
      AND user_id = ${userId}
    `
  } catch (error) {
    console.error('Error removing member:', error)
    throw new Error('Failed to remove member')
  }
}

// ============================================================================
// INVITE OPERATIONS
// ============================================================================

/**
 * Invite user to organization
 */
export async function inviteToOrganization(
  orgId: string,
  email: string,
  role: 'admin' | 'member' | 'viewer',
  invitedBy: string,
  message?: string
): Promise<Invite> {
  try {
    // Generate secure token
    const token = randomBytes(32).toString('hex')

    // Set expiration (7 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const result = await sql`
      INSERT INTO invites (
        org_id,
        email,
        role,
        token,
        message,
        invited_by,
        status,
        expires_at
      ) VALUES (
        ${orgId},
        ${email},
        ${role},
        ${token},
        ${message || null},
        ${invitedBy},
        'pending',
        ${expiresAt}
      )
      RETURNING *
    `

    return mapInviteFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating invite:', error)
    throw new Error('Failed to create invite')
  }
}

/**
 * Accept invite
 */
export async function acceptInvite(token: string, userId: string): Promise<{
  organization: Organization
  member: OrganizationMember
}> {
  try {
    // Get invite
    const inviteResult = await sql`
      SELECT * FROM invites
      WHERE token = ${token}
      AND status = 'pending'
      AND expires_at > NOW()
    `

    if (inviteResult.rows.length === 0) {
      throw new Error('Invalid or expired invite')
    }

    const invite = mapInviteFromDb(inviteResult.rows[0])

    // Mark invite as accepted
    await sql`
      UPDATE invites
      SET status = 'accepted', accepted_at = NOW()
      WHERE id = ${invite.id}
    `

    // Add user to organization
    const member = await addOrganizationMember(
      invite.orgId,
      userId,
      invite.role as any,
      invite.invitedBy
    )

    // Get organization
    const organization = await getOrganization(invite.orgId)

    if (!organization) {
      throw new Error('Organization not found')
    }

    return { organization, member }
  } catch (error) {
    console.error('Error accepting invite:', error)
    throw new Error('Failed to accept invite')
  }
}

/**
 * Get pending invites for an organization
 */
export async function getPendingInvites(orgId: string): Promise<Invite[]> {
  try {
    const result = await sql`
      SELECT * FROM invites
      WHERE org_id = ${orgId}
      AND status = 'pending'
      AND expires_at > NOW()
      ORDER BY created_at DESC
    `

    return result.rows.map(mapInviteFromDb)
  } catch (error) {
    console.error('Error fetching invites:', error)
    throw new Error('Failed to fetch invites')
  }
}

/**
 * Revoke invite
 */
export async function revokeInvite(inviteId: string): Promise<void> {
  try {
    await sql`
      UPDATE invites
      SET status = 'revoked', revoked_at = NOW()
      WHERE id = ${inviteId}
    `
  } catch (error) {
    console.error('Error revoking invite:', error)
    throw new Error('Failed to revoke invite')
  }
}

// ============================================================================
// TEAM OPERATIONS
// ============================================================================

/**
 * Create a team
 */
export async function createTeam(
  orgId: string,
  name: string,
  createdBy: string,
  options?: {
    slug?: string
    description?: string
    focusArea?: string
  }
): Promise<Team> {
  try {
    const slug = options?.slug || generateSlug(name)

    const result = await sql`
      INSERT INTO teams (
        org_id,
        name,
        slug,
        description,
        focus_area,
        status
      ) VALUES (
        ${orgId},
        ${name},
        ${slug},
        ${options?.description || null},
        ${options?.focusArea || null},
        'active'
      )
      RETURNING *
    `

    const team = mapTeamFromDb(result.rows[0])

    // Add creator as team lead
    await addTeamMember(team.id, createdBy, 'lead')

    return team
  } catch (error) {
    console.error('Error creating team:', error)
    throw new Error('Failed to create team')
  }
}

/**
 * Get teams for an organization
 */
export async function getTeams(orgId: string): Promise<Team[]> {
  try {
    const result = await sql`
      SELECT * FROM teams
      WHERE org_id = ${orgId}
      AND status = 'active'
      ORDER BY created_at ASC
    `

    return result.rows.map(mapTeamFromDb)
  } catch (error) {
    console.error('Error fetching teams:', error)
    throw new Error('Failed to fetch teams')
  }
}

/**
 * Get a specific team
 */
export async function getTeam(teamId: string): Promise<Team | null> {
  try {
    const result = await sql`
      SELECT * FROM teams WHERE id = ${teamId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapTeamFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching team:', error)
    throw new Error('Failed to fetch team')
  }
}

/**
 * Add member to team
 */
export async function addTeamMember(
  teamId: string,
  userId: string,
  role: 'lead' | 'member'
): Promise<TeamMember> {
  try {
    const result = await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${teamId}, ${userId}, ${role})
      RETURNING *
    `

    return mapTeamMemberFromDb(result.rows[0])
  } catch (error) {
    console.error('Error adding team member:', error)
    throw new Error('Failed to add team member')
  }
}

/**
 * Get team members
 */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  try {
    const result = await sql`
      SELECT * FROM team_members
      WHERE team_id = ${teamId}
      ORDER BY created_at ASC
    `

    return result.rows.map(mapTeamMemberFromDb)
  } catch (error) {
    console.error('Error fetching team members:', error)
    throw new Error('Failed to fetch team members')
  }
}

/**
 * Remove member from team
 */
export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  try {
    await sql`
      DELETE FROM team_members
      WHERE team_id = ${teamId}
      AND user_id = ${userId}
    `
  } catch (error) {
    console.error('Error removing team member:', error)
    throw new Error('Failed to remove team member')
  }
}

/**
 * Get teams for a user
 */
export async function getUserTeams(orgId: string, userId: string): Promise<Team[]> {
  try {
    const result = await sql`
      SELECT t.*
      FROM teams t
      INNER JOIN team_members tm ON t.id = tm.team_id
      WHERE t.org_id = ${orgId}
      AND tm.user_id = ${userId}
      AND t.status = 'active'
      ORDER BY t.created_at ASC
    `

    return result.rows.map(mapTeamFromDb)
  } catch (error) {
    console.error('Error fetching user teams:', error)
    throw new Error('Failed to fetch user teams')
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function mapOrganizationFromDb(row: any): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    logoUrl: row.logo_url,
    website: row.website,
    industry: row.industry,
    companySize: row.company_size,
    country: row.country,
    settings: row.settings || {},
    plan: row.plan,
    billingEmail: row.billing_email,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapOrganizationMemberFromDb(row: any): OrganizationMember {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    role: row.role,
    permissions: row.permissions || {},
    displayName: row.display_name,
    title: row.title,
    department: row.department,
    avatarUrl: row.avatar_url,
    invitedBy: row.invited_by,
    invitedAt: row.invited_at,
    status: row.status,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTeamFromDb(row: any): Team {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    focusArea: row.focus_area,
    settings: row.settings || {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTeamMemberFromDb(row: any): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
  }
}

function mapInviteFromDb(row: any): Invite {
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    role: row.role,
    token: row.token,
    message: row.message,
    invitedBy: row.invited_by,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  }
}
