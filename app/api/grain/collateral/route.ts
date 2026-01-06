/**
 * GRAIN Collateral Management API
 *
 * Manages collateral assets that back user deposits for 100% protection.
 *
 * GET - List collateral assets and summary
 * POST - Register new collateral or update allocations
 * PATCH - Update asset valuations
 *
 * SECURITY: Admin-only for write operations; read operations may be public.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { CollateralEngine } from '@/lib/grain/collateral'

// Treasury admins who can manage collateral
const TREASURY_ADMINS = ['user_2vQlKmAB8sOCkwxw0T0cSWQxqhT'] // Add admin user IDs

/**
 * GET /api/grain/collateral
 *
 * Query params:
 * - view: 'summary' | 'list' | 'detail' | 'user' | 'health' | 'alerts' | 'valuations'
 * - assetId: Required for 'detail' and 'valuations' views
 * - userId: Required for 'user' view
 * - status: Filter by status for 'list' view
 */
export async function GET(request: NextRequest) {
  try {
    const view = request.nextUrl.searchParams.get('view') || 'summary'
    const assetId = request.nextUrl.searchParams.get('assetId')
    const userId = request.nextUrl.searchParams.get('userId')
    const status = request.nextUrl.searchParams.get('status') as any

    switch (view) {
      case 'summary':
        return await getSummary()

      case 'list':
        return await getList(status)

      case 'detail':
        if (!assetId) {
          return NextResponse.json(
            { success: false, error: 'assetId required for detail view' },
            { status: 400 }
          )
        }
        return await getDetail(assetId)

      case 'user':
        // For user view, get from auth if not provided
        let targetUserId = userId
        if (!targetUserId) {
          const { userId: authUserId } = await auth()
          targetUserId = authUserId
        }
        if (!targetUserId) {
          return NextResponse.json(
            { success: false, error: 'userId required or must be authenticated' },
            { status: 400 }
          )
        }
        return await getUserCollateral(targetUserId)

      case 'health':
        return await getHealthDashboard()

      case 'alerts':
        return await getAlerts()

      case 'valuations':
        if (!assetId) {
          return NextResponse.json(
            { success: false, error: 'assetId required for valuations view' },
            { status: 400 }
          )
        }
        return await getValuationHistory(assetId)

      default:
        return NextResponse.json(
          { success: false, error: `Unknown view: ${view}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[Collateral API] GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function getSummary() {
  const summary = await CollateralEngine.getCollateralSummary()

  return NextResponse.json({
    success: true,
    summary: {
      ...summary,
      formatted: {
        totalCollateral: `$${summary.totalCollateral.toLocaleString()}`,
        totalAllocated: `$${summary.totalAllocated.toLocaleString()}`,
        totalAvailable: `$${summary.totalAvailable.toLocaleString()}`,
        totalDeposits: `$${summary.totalDeposits.toLocaleString()}`,
        excessCollateral: `$${summary.excessCollateral.toLocaleString()}`,
        collateralGap: summary.collateralGap > 0 ? `$${summary.collateralGap.toLocaleString()}` : '$0',
      },
    },
  })
}

async function getList(status?: string) {
  const assets = await CollateralEngine.getAllCollateral(status as any)

  return NextResponse.json({
    success: true,
    assets: assets.map((asset) => ({
      ...asset,
      formatted: {
        faceValue: `$${asset.faceValue.toLocaleString()}`,
        currentValue: `$${asset.currentValue.toLocaleString()}`,
        allocatedAmount: `$${asset.allocatedAmount.toLocaleString()}`,
        availableAmount: `$${asset.availableAmount.toLocaleString()}`,
        interestRate: asset.interestRate ? `${(asset.interestRate * 100).toFixed(2)}%` : null,
        insuranceLimit: asset.insuranceLimit ? `$${asset.insuranceLimit.toLocaleString()}` : null,
      },
    })),
  })
}

async function getDetail(assetId: string) {
  const [asset, valuations] = await Promise.all([
    CollateralEngine.getCollateralAsset(assetId),
    CollateralEngine.getValuationHistory(assetId),
  ])

  if (!asset) {
    return NextResponse.json(
      { success: false, error: 'Asset not found' },
      { status: 404 }
    )
  }

  const utilizationRate = asset.currentValue > 0
    ? (asset.allocatedAmount / asset.currentValue) * 100
    : 0

  return NextResponse.json({
    success: true,
    asset: {
      ...asset,
      utilizationRate,
      formatted: {
        faceValue: `$${asset.faceValue.toLocaleString()}`,
        currentValue: `$${asset.currentValue.toLocaleString()}`,
        allocatedAmount: `$${asset.allocatedAmount.toLocaleString()}`,
        availableAmount: `$${asset.availableAmount.toLocaleString()}`,
        interestRate: asset.interestRate ? `${(asset.interestRate * 100).toFixed(2)}%` : null,
        insuranceLimit: asset.insuranceLimit ? `$${asset.insuranceLimit.toLocaleString()}` : null,
        utilizationRate: `${utilizationRate.toFixed(1)}%`,
        unrealizedGain: `$${(asset.currentValue - asset.faceValue).toLocaleString()}`,
      },
    },
    valuations: valuations.slice(0, 20).map((v) => ({
      ...v,
      formatted: {
        previousValue: `$${v.previousValue.toLocaleString()}`,
        newValue: `$${v.newValue.toLocaleString()}`,
        changeAmount: `${v.changeAmount >= 0 ? '+' : ''}$${v.changeAmount.toLocaleString()}`,
        changePercent: `${v.changePercent >= 0 ? '+' : ''}${v.changePercent.toFixed(2)}%`,
      },
    })),
  })
}

async function getUserCollateral(userId: string) {
  const depositCollateral = await CollateralEngine.getDepositCollateral(userId)

  return NextResponse.json({
    success: true,
    collateral: {
      ...depositCollateral,
      formatted: {
        depositAmount: `$${depositCollateral.depositAmount.toLocaleString()}`,
        totalBacking: `$${depositCollateral.totalBacking.toLocaleString()}`,
        coverageRatio: `${(depositCollateral.coverageRatio * 100).toFixed(1)}%`,
      },
    },
  })
}

async function getHealthDashboard() {
  const summary = await CollateralEngine.getCollateralSummary()
  const maturingAssets = await CollateralEngine.getMaturityAlerts(30)
  const staleAssets = await CollateralEngine.getStaleValuations(7)

  return NextResponse.json({
    success: true,
    health: {
      isFullyCollateralized: summary.isFullyCollateralized,
      collateralizationRatio: summary.collateralizationRatio,
      collateralizationPercent: summary.collateralizationPercent,
      totalCollateral: summary.totalCollateral,
      totalDeposits: summary.totalDeposits,
      excessCollateral: summary.excessCollateral,
      collateralGap: summary.collateralGap,
      assetBreakdown: summary.byType,
      alertCount: summary.alerts.length,
      maturingAssetsCount: maturingAssets.length,
      staleValuationsCount: staleAssets.length,
      formatted: {
        totalCollateral: `$${summary.totalCollateral.toLocaleString()}`,
        totalDeposits: `$${summary.totalDeposits.toLocaleString()}`,
        excessCollateral: `$${summary.excessCollateral.toLocaleString()}`,
        collateralGap: summary.collateralGap > 0 ? `$${summary.collateralGap.toLocaleString()}` : '$0',
      },
    },
    alerts: summary.alerts,
  })
}

async function getAlerts() {
  const summary = await CollateralEngine.getCollateralSummary()

  return NextResponse.json({
    success: true,
    alerts: summary.alerts,
    counts: {
      critical: summary.alerts.filter((a) => a.severity === 'critical').length,
      warning: summary.alerts.filter((a) => a.severity === 'warning').length,
      info: summary.alerts.filter((a) => a.severity === 'info').length,
    },
  })
}

async function getValuationHistory(assetId: string) {
  const valuations = await CollateralEngine.getValuationHistory(assetId)

  return NextResponse.json({
    success: true,
    valuations: valuations.map((v) => ({
      ...v,
      formatted: {
        previousValue: `$${v.previousValue.toLocaleString()}`,
        newValue: `$${v.newValue.toLocaleString()}`,
        changeAmount: `${v.changeAmount >= 0 ? '+' : ''}$${v.changeAmount.toLocaleString()}`,
        changePercent: `${v.changePercent >= 0 ? '+' : ''}${v.changePercent.toFixed(2)}%`,
      },
    })),
  })
}

/**
 * POST /api/grain/collateral
 *
 * Actions:
 * - register: Register a new collateral asset
 * - allocate: Allocate collateral to a deposit
 * - release: Release collateral from a withdrawal
 * - auto_allocate: Auto-allocate collateral to a new deposit
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and admin access for write operations
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!TREASURY_ADMINS.includes(userId)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'register':
        return await registerCollateral(body)

      case 'allocate':
        return await allocateCollateral(body)

      case 'release':
        return await releaseCollateral(body)

      case 'auto_allocate':
        return await autoAllocateCollateral(body)

      case 'update_status':
        return await updateStatus(body)

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[Collateral API] POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function registerCollateral(body: any) {
  const {
    type,
    name,
    description,
    custodian,
    custodianAccountId,
    custodianContactEmail,
    faceValue,
    currentValue,
    interestRate,
    maturityDate,
    insuranceProvider,
    insuranceLimit,
  } = body

  if (!type || !name || !custodian || !faceValue) {
    return NextResponse.json(
      { success: false, error: 'type, name, custodian, and faceValue are required' },
      { status: 400 }
    )
  }

  const asset = await CollateralEngine.registerCollateral({
    type,
    name,
    description,
    custodian,
    custodianAccountId,
    custodianContactEmail,
    faceValue,
    currentValue,
    interestRate,
    maturityDate: maturityDate ? new Date(maturityDate) : undefined,
    insuranceProvider,
    insuranceLimit,
  })

  return NextResponse.json({
    success: true,
    asset,
    message: `Registered collateral: ${asset.name} ($${asset.currentValue.toLocaleString()})`,
  })
}

async function allocateCollateral(body: any) {
  const { assetId, depositId, userId, amount } = body

  if (!assetId || !depositId || !userId || !amount) {
    return NextResponse.json(
      { success: false, error: 'assetId, depositId, userId, and amount are required' },
      { status: 400 }
    )
  }

  const allocation = await CollateralEngine.allocateCollateral({
    assetId,
    depositId,
    userId,
    amount,
  })

  return NextResponse.json({
    success: true,
    allocation,
    message: `Allocated $${amount.toLocaleString()} collateral to deposit`,
  })
}

async function releaseCollateral(body: any) {
  const { depositId, amount } = body

  if (!depositId || !amount) {
    return NextResponse.json(
      { success: false, error: 'depositId and amount are required' },
      { status: 400 }
    )
  }

  const result = await CollateralEngine.releaseCollateral({ depositId, amount })

  return NextResponse.json({
    success: true,
    released: result.released,
    allocations: result.allocations,
    message: `Released $${result.released.toLocaleString()} collateral from deposit`,
  })
}

async function autoAllocateCollateral(body: any) {
  const { depositId, userId, amount } = body

  if (!depositId || !userId || !amount) {
    return NextResponse.json(
      { success: false, error: 'depositId, userId, and amount are required' },
      { status: 400 }
    )
  }

  const allocations = await CollateralEngine.autoAllocateCollateral({
    depositId,
    userId,
    amount,
  })

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0)

  return NextResponse.json({
    success: true,
    allocations,
    totalAllocated,
    message: `Auto-allocated $${totalAllocated.toLocaleString()} collateral across ${allocations.length} assets`,
  })
}

async function updateStatus(body: any) {
  const { assetId, status, reason } = body

  if (!assetId || !status) {
    return NextResponse.json(
      { success: false, error: 'assetId and status are required' },
      { status: 400 }
    )
  }

  const asset = await CollateralEngine.updateAssetStatus(assetId, status, reason)

  return NextResponse.json({
    success: true,
    asset,
    message: `Updated ${asset.name} status to ${status}`,
  })
}

/**
 * PATCH /api/grain/collateral
 *
 * Update asset valuations
 */
export async function PATCH(request: NextRequest) {
  try {
    // SECURITY: Require authentication and admin access
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!TREASURY_ADMINS.includes(userId)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { assetId, newValue, source, appraiser, notes } = body

    if (!assetId || newValue === undefined || !source) {
      return NextResponse.json(
        { success: false, error: 'assetId, newValue, and source are required' },
        { status: 400 }
      )
    }

    const valuation = await CollateralEngine.updateValuation({
      assetId,
      newValue,
      source,
      appraiser,
      notes,
    })

    return NextResponse.json({
      success: true,
      valuation,
      message: `Updated valuation: ${valuation.changeAmount >= 0 ? '+' : ''}$${valuation.changeAmount.toLocaleString()} (${valuation.changePercent >= 0 ? '+' : ''}${valuation.changePercent.toFixed(2)}%)`,
    })
  } catch (error: any) {
    console.error('[Collateral API] PATCH error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
