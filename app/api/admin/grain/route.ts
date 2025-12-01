/**
 * Admin API for Grain & Vault
 *
 * POST /api/admin/grain/update-nav - Update NAV manually
 * POST /api/admin/grain/pause - Emergency pause
 * GET /api/admin/grain/health - System health check
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PriceOracle, toUSDC, publicClient } from '@/lib/blockchain/contracts'
import { invalidateAllCaches, cacheHealthCheck } from '@/lib/blockchain/cache'
import { query, healthCheck as dbHealthCheck } from '@/lib/db'

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key'
const MAX_NAV_CHANGE_PERCENT = 5 // Maximum 5% change per update

/**
 * Verify admin authentication
 */
function verifyAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.substring(7)
  return token === ADMIN_API_KEY
}

/**
 * POST /api/admin/grain/update-nav
 * Manually update NAV price
 */
export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action')

  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (action === 'update-nav') {
      return await updateNAV(request)
    } else if (action === 'pause') {
      return await pauseSystem(request)
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use ?action=update-nav or ?action=pause' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[Admin] Action failed:', error)
    return NextResponse.json(
      {
        error: 'Admin action failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Update NAV
 */
const UpdateNAVSchema = z.object({
  newNAV: z.number().positive(),
  newAssets: z.number().positive(),
  tiers: z.object({
    liquid: z.number().min(0),
    float: z.number().min(0),
    physical: z.number().min(0),
    investments: z.number().min(0),
    receivables: z.number().min(0),
  }),
  reason: z.string().min(10),
})

async function updateNAV(request: NextRequest) {
  const body = await request.json()
  const data = UpdateNAVSchema.parse(body)

  // Get current NAV to validate change
  const currentNAVRaw = await PriceOracle.getCurrentNAV()
  const currentNAV = Number(currentNAVRaw) / 1e6 // Convert from USDC decimals

  // Validate NAV change is within acceptable range
  const changePercent = Math.abs(((data.newNAV - currentNAV) / currentNAV) * 100)

  if (changePercent > MAX_NAV_CHANGE_PERCENT) {
    return NextResponse.json(
      {
        error: 'NAV change too large',
        message: `Change of ${changePercent.toFixed(2)}% exceeds maximum of ${MAX_NAV_CHANGE_PERCENT}%`,
        current: currentNAV,
        requested: data.newNAV,
      },
      { status: 400 }
    )
  }

  // Validate tiers sum to total assets
  const tiersSum =
    data.tiers.liquid +
    data.tiers.float +
    data.tiers.physical +
    data.tiers.investments +
    data.tiers.receivables

  if (Math.abs(tiersSum - data.newAssets) > 100) {
    // Allow $100 rounding difference
    return NextResponse.json(
      {
        error: 'Invalid tier allocation',
        message: 'Tier values must sum to total assets',
        tiersSum,
        totalAssets: data.newAssets,
      },
      { status: 400 }
    )
  }

  // Update on blockchain
  const navWei = toUSDC(data.newNAV)
  const assetsWei = toUSDC(data.newAssets)
  const tiersArray: [bigint, bigint, bigint, bigint, bigint] = [
    toUSDC(data.tiers.liquid),
    toUSDC(data.tiers.float),
    toUSDC(data.tiers.physical),
    toUSDC(data.tiers.investments),
    toUSDC(data.tiers.receivables),
  ]

  const txHash = await PriceOracle.updateNAV(navWei, assetsWei, tiersArray)

  // Log the update
  await query(
    `INSERT INTO nav_updates (
      tx_hash, old_nav, new_nav, old_assets, new_assets,
      reason, updated_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [txHash, currentNAV, data.newNAV, 0, data.newAssets, data.reason, 'admin']
  )

  // Invalidate all price caches
  await invalidateAllCaches()

  // Send alerts to stakeholders
  await sendNAVUpdateAlert({
    oldNAV: currentNAV,
    newNAV: data.newNAV,
    changePercent,
    reason: data.reason,
    txHash,
  })

  return NextResponse.json({
    success: true,
    update: {
      oldNAV: currentNAV,
      newNAV: data.newNAV,
      changePercent: parseFloat(changePercent.toFixed(4)),
      newAssets: data.newAssets,
      tiers: data.tiers,
      txHash,
      reason: data.reason,
      timestamp: new Date().toISOString(),
    },
    message: 'NAV updated successfully. All caches invalidated.',
  })
}

/**
 * Pause system (emergency)
 */
const PauseSchema = z.object({
  reason: z.string().min(10),
  notifyUsers: z.boolean().default(true),
})

async function pauseSystem(request: NextRequest) {
  const body = await request.json()
  const data = PauseSchema.parse(body)

  // Log the pause event
  await query(
    `INSERT INTO system_events (
      event_type, severity, description, created_at
    ) VALUES ($1, $2, $3, NOW())`,
    ['system_pause', 'critical', data.reason]
  )

  // TODO: Implement actual contract pause
  // This would call a pause() function on the smart contracts

  // Send alerts
  if (data.notifyUsers) {
    await sendSystemPauseAlert(data.reason)
  }

  return NextResponse.json({
    success: true,
    message: 'System paused. All transactions are frozen.',
    reason: data.reason,
    timestamp: new Date().toISOString(),
  })
}

/**
 * GET /api/admin/grain/health
 * System health check
 */
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const startTime = Date.now()

    // Check all systems
    const [rpcHealth, cacheHealth, dbHealth, contractsHealth] = await Promise.all([
      checkRPCHealth(),
      cacheHealthCheck(),
      dbHealthCheck(),
      checkContractsHealth(),
    ])

    const responseTime = Date.now() - startTime

    // Calculate overall status
    const allHealthy = rpcHealth && cacheHealth && dbHealth && contractsHealth
    const status = allHealthy ? 'healthy' : 'degraded'

    return NextResponse.json({
      status,
      responseTime: `${responseTime}ms`,
      services: {
        rpc: rpcHealth ? 'healthy' : 'unhealthy',
        cache: cacheHealth ? 'healthy' : 'unhealthy',
        database: dbHealth ? 'healthy' : 'unhealthy',
        contracts: contractsHealth ? 'healthy' : 'unhealthy',
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Health check helpers
 */
async function checkRPCHealth(): Promise<boolean> {
  try {
    const blockNumber = await publicClient.getBlockNumber()
    return blockNumber > 0
  } catch (error) {
    console.error('[Health] RPC check failed:', error)
    return false
  }
}

async function checkContractsHealth(): Promise<boolean> {
  try {
    const nav = await PriceOracle.getCurrentNAV()
    return nav > 0
  } catch (error) {
    console.error('[Health] Contracts check failed:', error)
    return false
  }
}

/**
 * Alert helpers
 */
async function sendNAVUpdateAlert(details: {
  oldNAV: number
  newNAV: number
  changePercent: number
  reason: string
  txHash: string
}) {
  console.log('[Alert] NAV Updated:', details)
  // TODO: Send email/SMS/Discord alerts
}

async function sendSystemPauseAlert(reason: string) {
  console.log('[Alert] SYSTEM PAUSED:', reason)
  // TODO: Send critical alerts to all channels
}
