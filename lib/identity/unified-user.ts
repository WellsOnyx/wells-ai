// @ts-nocheck
/**
 * UNIFIED USER IDENTITY
 *
 * Merges WellsAI users (Clerk auth) with Grain & Vault treasury accounts
 * into a single identity system.
 *
 * Data sources:
 * - users table: Clerk users from WellsAI
 * - treasury_accounts table: Grain & Vault users (may have Clerk or email-only)
 *
 * Philosophy:
 * - One person = one financial identity
 * - GRAIN balance follows the person
 * - Credit line is tied to identity, not account
 */

import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// ============================================================================
// TYPES
// ============================================================================

export interface UnifiedUser {
  // Identity
  unifiedId: string // The canonical ID
  clerkUserId?: string // From WellsAI (Clerk)
  treasuryAccountId?: string // From Grain & Vault

  // Profile
  email: string
  name?: string
  company?: string

  // Financial Profile
  grainBalance: number
  usdcBalance: number
  lockedBalance: number // In escrow

  // Credit
  creditTier: 'none' | 'starter' | 'established' | 'preferred' | 'enterprise'
  creditLimit: number
  creditUsed: number
  creditAvailable: number
  creditApr: number

  // Verification
  kycLevel: 'none' | 'basic' | 'verified' | 'enhanced'

  // Limits
  dailyLimit: number
  monthlyLimit: number

  // Status
  isActive: boolean
  isFlagged: boolean

  // Timestamps
  createdAt: Date
  lastActivityAt?: Date
}

export interface CreateUserRequest {
  email: string
  clerkUserId?: string
  name?: string
  company?: string
  source: 'wellsai' | 'grainvault' | 'merge'
}

// ============================================================================
// USER LOOKUP
// ============================================================================

/**
 * Get unified user by any identifier
 * Searches Clerk ID, treasury account ID, or email
 */
export async function getUnifiedUser(identifier: string): Promise<UnifiedUser | null> {
  if (!sql) return null

  // Try to find by Clerk user ID first
  let user = await findByClerkId(identifier)
  if (user) return user

  // Try treasury account ID
  user = await findByTreasuryId(identifier)
  if (user) return user

  // Try email
  user = await findByEmail(identifier)
  if (user) return user

  return null
}

/**
 * Find user by Clerk ID
 */
async function findByClerkId(clerkId: string): Promise<UnifiedUser | null> {
  if (!sql) return null

  const [row] = await sql`
    SELECT
      u.id as clerk_user_id,
      u.email,
      u.name,
      ta.id as treasury_account_id,
      ta.company_name as company,
      COALESCE(w.balance, ta.grain_balance, 0) as grain_balance,
      COALESCE(w.locked_balance, 0) as locked_balance,
      COALESCE(ub.usdc_balance, 0) as usdc_balance,
      COALESCE(cl.tier, 'none') as credit_tier,
      COALESCE(cl.max_limit, 0) as credit_limit,
      COALESCE(cl.current_balance, 0) as credit_used,
      COALESCE(cl.apr, 0) as credit_apr,
      COALESCE(ta.verification_level, 'none') as kyc_level,
      COALESCE(ta.daily_deposit_limit, 10000) as daily_limit,
      COALESCE(ta.is_active, true) as is_active,
      COALESCE(ta.is_flagged, false) as is_flagged,
      u.created_at,
      COALESCE(u.updated_at, u.created_at) as last_activity_at
    FROM users u
    LEFT JOIN treasury_accounts ta ON ta.clerk_user_id = u.id OR ta.email = u.email
    LEFT JOIN user_wallets w ON w.user_id = u.id
    LEFT JOIN user_balances ub ON ub.user_id = u.id
    LEFT JOIN grain_credit_lines cl ON (cl.user_id = u.id OR cl.user_id = ta.id::text) AND cl.status = 'active'
    WHERE u.id = ${clerkId}
  `

  if (!row) return null

  return mapRowToUnifiedUser(row)
}

/**
 * Find user by treasury account ID
 */
async function findByTreasuryId(treasuryId: string): Promise<UnifiedUser | null> {
  if (!sql) return null

  const [row] = await sql`
    SELECT
      ta.clerk_user_id,
      ta.email,
      u.name,
      ta.id as treasury_account_id,
      ta.company_name as company,
      COALESCE(w.balance, ta.grain_balance, 0) as grain_balance,
      COALESCE(w.locked_balance, 0) as locked_balance,
      COALESCE(ub.usdc_balance, 0) as usdc_balance,
      COALESCE(cl.tier, 'none') as credit_tier,
      COALESCE(cl.max_limit, 0) as credit_limit,
      COALESCE(cl.current_balance, 0) as credit_used,
      COALESCE(cl.apr, 0) as credit_apr,
      ta.verification_level as kyc_level,
      ta.daily_deposit_limit as daily_limit,
      ta.is_active,
      ta.is_flagged,
      ta.created_at,
      ta.updated_at as last_activity_at
    FROM treasury_accounts ta
    LEFT JOIN users u ON u.id = ta.clerk_user_id OR u.email = ta.email
    LEFT JOIN user_wallets w ON w.user_id = ta.id::text OR w.user_id = ta.clerk_user_id
    LEFT JOIN user_balances ub ON ub.user_id = ta.id::text OR ub.user_id = ta.clerk_user_id
    LEFT JOIN grain_credit_lines cl ON (cl.user_id = ta.id::text OR cl.user_id = ta.clerk_user_id) AND cl.status = 'active'
    WHERE ta.id::text = ${treasuryId}
  `

  if (!row) return null

  return mapRowToUnifiedUser(row)
}

/**
 * Find user by email
 */
async function findByEmail(email: string): Promise<UnifiedUser | null> {
  if (!sql) return null

  const normalizedEmail = email.toLowerCase().trim()

  const [row] = await sql`
    SELECT
      u.id as clerk_user_id,
      COALESCE(u.email, ta.email) as email,
      u.name,
      ta.id as treasury_account_id,
      ta.company_name as company,
      COALESCE(w.balance, ta.grain_balance, 0) as grain_balance,
      COALESCE(w.locked_balance, 0) as locked_balance,
      COALESCE(ub.usdc_balance, 0) as usdc_balance,
      COALESCE(cl.tier, 'none') as credit_tier,
      COALESCE(cl.max_limit, 0) as credit_limit,
      COALESCE(cl.current_balance, 0) as credit_used,
      COALESCE(cl.apr, 0) as credit_apr,
      COALESCE(ta.verification_level, 'none') as kyc_level,
      COALESCE(ta.daily_deposit_limit, 10000) as daily_limit,
      COALESCE(ta.is_active, true) as is_active,
      COALESCE(ta.is_flagged, false) as is_flagged,
      COALESCE(u.created_at, ta.created_at) as created_at,
      COALESCE(u.updated_at, ta.updated_at) as last_activity_at
    FROM treasury_accounts ta
    FULL OUTER JOIN users u ON u.email = ta.email
    LEFT JOIN user_wallets w ON w.user_id = COALESCE(u.id, ta.id::text)
    LEFT JOIN user_balances ub ON ub.user_id = COALESCE(u.id, ta.id::text)
    LEFT JOIN grain_credit_lines cl ON (cl.user_id = COALESCE(u.id, ta.id::text)) AND cl.status = 'active'
    WHERE LOWER(ta.email) = ${normalizedEmail} OR LOWER(u.email) = ${normalizedEmail}
    LIMIT 1
  `

  if (!row) return null

  return mapRowToUnifiedUser(row)
}

/**
 * Map database row to UnifiedUser
 */
function mapRowToUnifiedUser(row: any): UnifiedUser {
  const unifiedId = row.clerk_user_id || row.treasury_account_id?.toString() || ''

  return {
    unifiedId,
    clerkUserId: row.clerk_user_id || undefined,
    treasuryAccountId: row.treasury_account_id?.toString() || undefined,
    email: row.email,
    name: row.name || undefined,
    company: row.company || undefined,
    grainBalance: parseFloat(row.grain_balance || '0'),
    usdcBalance: parseFloat(row.usdc_balance || '0'),
    lockedBalance: parseFloat(row.locked_balance || '0'),
    creditTier: row.credit_tier || 'none',
    creditLimit: parseFloat(row.credit_limit || '0'),
    creditUsed: parseFloat(row.credit_used || '0'),
    creditAvailable: Math.max(0, parseFloat(row.credit_limit || '0') - parseFloat(row.credit_used || '0')),
    creditApr: parseFloat(row.credit_apr || '0'),
    kycLevel: row.kyc_level || 'none',
    dailyLimit: parseFloat(row.daily_limit || '10000'),
    monthlyLimit: parseFloat(row.daily_limit || '10000') * 30,
    isActive: row.is_active !== false,
    isFlagged: row.is_flagged === true,
    createdAt: new Date(row.created_at),
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at) : undefined,
  }
}

// ============================================================================
// USER CREATION & LINKING
// ============================================================================

/**
 * Create or link a unified user
 * If user exists in one system, creates in the other and links
 */
export async function createOrLinkUser(request: CreateUserRequest): Promise<UnifiedUser> {
  if (!sql) {
    throw new Error('Database not configured')
  }

  const normalizedEmail = request.email.toLowerCase().trim()

  // Check if user already exists
  const existing = await findByEmail(normalizedEmail)
  if (existing) {
    // If we have a Clerk ID and they don't, link them
    if (request.clerkUserId && !existing.clerkUserId) {
      await linkClerkUser(existing.treasuryAccountId!, request.clerkUserId)
    }
    return (await findByEmail(normalizedEmail))!
  }

  // Create new user
  if (request.source === 'wellsai' && request.clerkUserId) {
    // Create treasury account linked to Clerk
    const treasuryId = crypto.randomUUID()

    await sql`
      INSERT INTO treasury_accounts (
        id, email, clerk_user_id, company_name,
        grain_balance, verification_level, daily_deposit_limit,
        is_active, created_at, updated_at
      ) VALUES (
        ${treasuryId}, ${normalizedEmail}, ${request.clerkUserId},
        ${request.company || null}, 0, 'none', 10000,
        true, NOW(), NOW()
      )
    `

    // Create GRAIN wallet
    await sql`
      INSERT INTO user_wallets (user_id, balance, locked_balance, created_at, updated_at)
      VALUES (${request.clerkUserId}, 0, 0, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
    `

  } else {
    // Create treasury-first account
    const treasuryId = crypto.randomUUID()

    await sql`
      INSERT INTO treasury_accounts (
        id, email, company_name,
        grain_balance, verification_level, daily_deposit_limit,
        is_active, created_at, updated_at
      ) VALUES (
        ${treasuryId}, ${normalizedEmail}, ${request.company || null},
        0, 'none', 10000, true, NOW(), NOW()
      )
    `

    // Create GRAIN wallet
    await sql`
      INSERT INTO user_wallets (user_id, balance, locked_balance, created_at, updated_at)
      VALUES (${treasuryId}, 0, 0, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
    `
  }

  return (await findByEmail(normalizedEmail))!
}

/**
 * Link a Clerk user to a treasury account
 */
async function linkClerkUser(treasuryAccountId: string, clerkUserId: string): Promise<void> {
  if (!sql) return

  await sql`
    UPDATE treasury_accounts
    SET clerk_user_id = ${clerkUserId}, updated_at = NOW()
    WHERE id::text = ${treasuryAccountId}
  `

  // If wallet exists under treasury ID, also link to Clerk ID
  await sql`
    INSERT INTO user_wallets (user_id, balance, locked_balance, created_at, updated_at)
    SELECT ${clerkUserId}, balance, locked_balance, NOW(), NOW()
    FROM user_wallets WHERE user_id = ${treasuryAccountId}
    ON CONFLICT (user_id) DO UPDATE SET
      balance = EXCLUDED.balance,
      locked_balance = EXCLUDED.locked_balance
  `
}

/**
 * Merge two accounts (e.g., email-only treasury account with new Clerk signup)
 */
export async function mergeAccounts(
  primaryId: string,
  secondaryId: string
): Promise<UnifiedUser> {
  if (!sql) {
    throw new Error('Database not configured')
  }

  // Get both accounts
  const primary = await getUnifiedUser(primaryId)
  const secondary = await getUnifiedUser(secondaryId)

  if (!primary || !secondary) {
    throw new Error('One or both accounts not found')
  }

  // Merge balances to primary
  const mergedGrainBalance = primary.grainBalance + secondary.grainBalance
  const mergedUsdcBalance = primary.usdcBalance + secondary.usdcBalance
  const mergedLockedBalance = primary.lockedBalance + secondary.lockedBalance

  // Update primary wallet
  await sql`
    UPDATE user_wallets
    SET
      balance = ${mergedGrainBalance},
      locked_balance = ${mergedLockedBalance},
      updated_at = NOW()
    WHERE user_id = ${primary.unifiedId}
  `

  // Update primary USDC balance
  await sql`
    INSERT INTO user_balances (user_id, usdc_balance, created_at, updated_at)
    VALUES (${primary.unifiedId}, ${mergedUsdcBalance}, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      usdc_balance = ${mergedUsdcBalance},
      updated_at = NOW()
  `

  // Transfer transactions
  await sql`
    UPDATE unified_transactions
    SET user_id = ${primary.unifiedId}
    WHERE user_id = ${secondary.unifiedId}
  `

  // Transfer escrows
  await sql`
    UPDATE grain_escrows
    SET from_user_id = ${primary.unifiedId}
    WHERE from_user_id = ${secondary.unifiedId}
  `

  await sql`
    UPDATE grain_escrows
    SET to_user_id = ${primary.unifiedId}
    WHERE to_user_id = ${secondary.unifiedId}
  `

  // Deactivate secondary
  if (secondary.treasuryAccountId) {
    await sql`
      UPDATE treasury_accounts
      SET is_active = false, updated_at = NOW()
      WHERE id::text = ${secondary.treasuryAccountId}
    `
  }

  // Delete secondary wallet
  await sql`
    DELETE FROM user_wallets WHERE user_id = ${secondary.unifiedId}
  `

  return (await getUnifiedUser(primary.unifiedId))!
}

// ============================================================================
// CREDIT LINE MANAGEMENT
// ============================================================================

export interface CreditLineRequest {
  userId: string
  tier: 'starter' | 'established' | 'preferred' | 'enterprise'
  limit: number
  apr: number
}

/**
 * Create or update credit line for user
 */
export async function setCreditLine(request: CreditLineRequest): Promise<void> {
  if (!sql) return

  await sql`
    INSERT INTO grain_credit_lines (
      id, user_id, tier, max_limit, current_balance, apr, status, created_at, updated_at
    ) VALUES (
      ${crypto.randomUUID()}, ${request.userId}, ${request.tier},
      ${request.limit}, 0, ${request.apr}, 'active', NOW(), NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      tier = ${request.tier},
      max_limit = ${request.limit},
      apr = ${request.apr},
      status = 'active',
      updated_at = NOW()
  `
}

/**
 * Auto-calculate credit line based on user activity
 */
export async function calculateCreditTier(userId: string): Promise<{
  tier: 'none' | 'starter' | 'established' | 'preferred' | 'enterprise'
  limit: number
  apr: number
}> {
  if (!sql) {
    return { tier: 'none', limit: 0, apr: 0 }
  }

  // Get user's transaction history (last 90 days)
  const [stats] = await sql`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as total_volume,
      COUNT(DISTINCT DATE(created_at)) as active_days
    FROM unified_transactions
    WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '90 days'
      AND status = 'completed'
  `

  const txCount = parseInt(stats?.transaction_count || '0')
  const volume = parseFloat(stats?.total_volume || '0')
  const activeDays = parseInt(stats?.active_days || '0')

  // Credit tiers based on activity
  // Enterprise: $100K+ monthly volume
  if (volume >= 100000) {
    return { tier: 'enterprise', limit: volume * 0.5, apr: 0 }
  }

  // Preferred: $50K+ monthly volume, 30+ transactions
  if (volume >= 50000 && txCount >= 30) {
    return { tier: 'preferred', limit: volume * 0.3, apr: 1.0 }
  }

  // Established: $10K+ volume, 10+ transactions, 7+ active days
  if (volume >= 10000 && txCount >= 10 && activeDays >= 7) {
    return { tier: 'established', limit: volume * 0.2, apr: 2.0 }
  }

  // Starter: Any completed transactions
  if (txCount >= 3) {
    return { tier: 'starter', limit: Math.min(1000, volume * 0.1), apr: 3.0 }
  }

  return { tier: 'none', limit: 0, apr: 0 }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const unifiedUser = {
  get: getUnifiedUser,
  findByEmail,
  findByClerkId,
  findByTreasuryId,
  createOrLink: createOrLinkUser,
  merge: mergeAccounts,
  setCreditLine,
  calculateCreditTier,
}
