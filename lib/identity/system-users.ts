// @ts-nocheck
/**
 * System Users - Automated Identities for Wells Operations
 *
 * At scale, Grain & Vault will have:
 * - Multiple human team members working with Wells
 * - Automated systems that need identity (Wells itself, schedulers, etc.)
 * - Integration accounts for external services
 *
 * System users allow Wells to:
 * - Execute automated actions with proper audit trails
 * - Own resources like scheduled tasks and automated campaigns
 * - Maintain separate ledgers for platform operations
 * - Act on behalf of the company for support and operations
 */

import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// ============================================================================
// SYSTEM USER DEFINITIONS
// ============================================================================

export type SystemUserType =
  | 'wells_ai'           // The Wells AI assistant itself
  | 'wells_scheduler'    // Scheduled task executor
  | 'wells_support'      // Customer support automation
  | 'wells_treasury'     // Treasury operations
  | 'wells_compliance'   // Compliance monitoring
  | 'wells_integration'  // External integrations
  | 'wells_test'         // Test/QA system user

export interface SystemUser {
  id: string
  type: SystemUserType
  name: string
  email: string
  description: string
  permissions: string[]
  apiKeyHash?: string
  createdAt: Date
  lastActivity?: Date
  status: 'active' | 'suspended' | 'disabled'
  metadata: Record<string, any>
}

// Pre-defined system users
export const SYSTEM_USERS: Record<SystemUserType, Omit<SystemUser, 'id' | 'apiKeyHash' | 'createdAt' | 'lastActivity'>> = {
  wells_ai: {
    type: 'wells_ai',
    name: 'Wells AI',
    email: 'wells@grainandvault.com',
    description: 'The Wells AI assistant - handles conversations, negotiations, and recommendations',
    permissions: [
      'read:conversations',
      'write:conversations',
      'read:users',
      'read:transactions',
      'execute:negotiations',
      'send:notifications',
      'generate:insights',
      'manage:memory',
    ],
    status: 'active',
    metadata: {
      isCore: true,
      personality: 'helpful, professional, faith-grounded',
    },
  },
  wells_scheduler: {
    type: 'wells_scheduler',
    name: 'Wells Scheduler',
    email: 'scheduler@grainandvault.com',
    description: 'Executes scheduled tasks like payroll, recurring payments, reports',
    permissions: [
      'execute:payroll',
      'execute:payments',
      'execute:reports',
      'read:schedules',
      'write:schedules',
      'send:notifications',
    ],
    status: 'active',
    metadata: {
      cronEnabled: true,
      maxConcurrentTasks: 10,
    },
  },
  wells_support: {
    type: 'wells_support',
    name: 'Wells Support',
    email: 'support@grainandvault.com',
    description: 'Automated customer support, escalations, and issue resolution',
    permissions: [
      'read:tickets',
      'write:tickets',
      'read:users',
      'send:notifications',
      'escalate:issues',
    ],
    status: 'active',
    metadata: {
      escalationThreshold: 'high',
      autoRespondEnabled: true,
    },
  },
  wells_treasury: {
    type: 'wells_treasury',
    name: 'Wells Treasury',
    email: 'treasury@grainandvault.com',
    description: 'Treasury operations - yield distribution, GRAIN supply management',
    permissions: [
      'read:treasury',
      'write:treasury',
      'execute:yield_distribution',
      'manage:grain_supply',
      'read:transactions',
    ],
    status: 'active',
    metadata: {
      yieldFrequency: 'daily',
      requiresMultiSig: true,
    },
  },
  wells_compliance: {
    type: 'wells_compliance',
    name: 'Wells Compliance',
    email: 'compliance@grainandvault.com',
    description: 'Compliance monitoring, KYC/AML checks, suspicious activity detection',
    permissions: [
      'read:users',
      'read:transactions',
      'flag:suspicious',
      'trigger:kyc',
      'block:users',
      'generate:reports',
    ],
    status: 'active',
    metadata: {
      alertThresholds: {
        singleTransaction: 10000,
        dailyVolume: 50000,
      },
    },
  },
  wells_integration: {
    type: 'wells_integration',
    name: 'Wells Integration',
    email: 'integration@grainandvault.com',
    description: 'External service integrations - Circle, Clerk, ERPs, etc.',
    permissions: [
      'sync:external',
      'read:credentials',
      'write:logs',
      'manage:webhooks',
    ],
    status: 'active',
    metadata: {
      services: ['circle', 'clerk', 'resend', 'twilio'],
    },
  },
  wells_test: {
    type: 'wells_test',
    name: 'Wells Test',
    email: 'test@grainandvault.com',
    description: 'Test and QA system user - sandboxed permissions',
    permissions: [
      'read:*:sandbox',
      'write:*:sandbox',
    ],
    status: 'active',
    metadata: {
      environment: 'sandbox',
      maxTestTransactions: 100,
    },
  },
}

// ============================================================================
// SYSTEM USER MANAGEMENT
// ============================================================================

export const systemUsers = {
  /**
   * Initialize all system users in database
   */
  async initialize(): Promise<void> {
    if (!sql) throw new Error('Database not configured')

    for (const [type, config] of Object.entries(SYSTEM_USERS)) {
      const existing = await sql`
        SELECT id FROM system_users WHERE type = ${type}
      `

      if (existing.length === 0) {
        const id = `sys_${type}_${crypto.randomBytes(8).toString('hex')}`
        await sql`
          INSERT INTO system_users (
            id, type, name, email, description, permissions, status, metadata
          ) VALUES (
            ${id}, ${type}, ${config.name}, ${config.email},
            ${config.description}, ${JSON.stringify(config.permissions)},
            ${config.status}, ${JSON.stringify(config.metadata)}
          )
        `
        console.log(`[SystemUsers] Created: ${config.name} (${id})`)
      }
    }
  },

  /**
   * Get system user by type
   */
  async get(type: SystemUserType): Promise<SystemUser | null> {
    if (!sql) return null

    const [user] = await sql`
      SELECT * FROM system_users WHERE type = ${type} AND status = 'active'
    `

    if (!user) return null

    return {
      id: user.id,
      type: user.type,
      name: user.name,
      email: user.email,
      description: user.description,
      permissions: JSON.parse(user.permissions || '[]'),
      apiKeyHash: user.api_key_hash,
      createdAt: user.created_at,
      lastActivity: user.last_activity,
      status: user.status,
      metadata: JSON.parse(user.metadata || '{}'),
    }
  },

  /**
   * Get Wells AI system user
   */
  async getWells(): Promise<SystemUser | null> {
    return this.get('wells_ai')
  },

  /**
   * Check if a user ID is a system user
   */
  isSystemUser(userId: string): boolean {
    return userId.startsWith('sys_')
  },

  /**
   * Log activity for system user
   */
  async logActivity(
    type: SystemUserType,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    if (!sql) return

    const user = await this.get(type)
    if (!user) return

    await sql`
      INSERT INTO system_user_activity (
        system_user_id, action, details
      ) VALUES (
        ${user.id}, ${action}, ${JSON.stringify(details)}
      )
    `

    await sql`
      UPDATE system_users SET last_activity = NOW() WHERE id = ${user.id}
    `
  },

  /**
   * Check if system user has permission
   */
  async hasPermission(type: SystemUserType, permission: string): Promise<boolean> {
    const user = await this.get(type)
    if (!user) return false

    // Check exact match
    if (user.permissions.includes(permission)) return true

    // Check wildcard permissions
    const parts = permission.split(':')
    for (let i = parts.length - 1; i >= 0; i--) {
      const wildcard = [...parts.slice(0, i), '*'].join(':')
      if (user.permissions.includes(wildcard)) return true
    }

    return false
  },

  /**
   * Generate API key for system user
   */
  async generateApiKey(type: SystemUserType): Promise<string | null> {
    if (!sql) return null

    const user = await this.get(type)
    if (!user) return null

    const apiKey = `wells_${type}_${crypto.randomBytes(24).toString('hex')}`
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    await sql`
      UPDATE system_users SET api_key_hash = ${apiKeyHash} WHERE id = ${user.id}
    `

    return apiKey
  },

  /**
   * Validate API key
   */
  async validateApiKey(apiKey: string): Promise<SystemUser | null> {
    if (!sql || !apiKey.startsWith('wells_')) return null

    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    const [user] = await sql`
      SELECT * FROM system_users WHERE api_key_hash = ${apiKeyHash} AND status = 'active'
    `

    if (!user) return null

    return {
      id: user.id,
      type: user.type,
      name: user.name,
      email: user.email,
      description: user.description,
      permissions: JSON.parse(user.permissions || '[]'),
      createdAt: user.created_at,
      lastActivity: user.last_activity,
      status: user.status,
      metadata: JSON.parse(user.metadata || '{}'),
    }
  },
}

export default systemUsers
