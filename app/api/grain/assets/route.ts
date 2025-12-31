/**
 * GRAIN Real Assets API
 *
 * Manage analog/physical assets:
 * - Commercial Real Estate
 * - Precious Metals
 * - Bonds
 * - Other Investments
 *
 * All tracked on Vault's chain for transparency.
 * Asset income flows through standard revenue allocation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { RealAssets } from '@/lib/grain/real-assets'

// GET /api/grain/assets
export async function GET(request: NextRequest) {
  try {
    const view = request.nextUrl.searchParams.get('view') || 'summary'
    const assetId = request.nextUrl.searchParams.get('assetId')

    switch (view) {
      case 'summary':
        return await getSummary()

      case 'list':
        const status = request.nextUrl.searchParams.get('status') as any
        return await getList(status)

      case 'detail':
        if (!assetId) {
          return NextResponse.json(
            { success: false, error: 'assetId required' },
            { status: 400 }
          )
        }
        return await getDetail(assetId)

      case 'valuations':
        if (!assetId) {
          return NextResponse.json(
            { success: false, error: 'assetId required' },
            { status: 400 }
          )
        }
        return await getValuations(assetId)

      case 'income':
        if (!assetId) {
          return NextResponse.json(
            { success: false, error: 'assetId required' },
            { status: 400 }
          )
        }
        return await getIncomeHistory(assetId)

      case 'documents':
        if (!assetId) {
          return NextResponse.json(
            { success: false, error: 'assetId required' },
            { status: 400 }
          )
        }
        return await getDocuments(assetId)

      default:
        return NextResponse.json(
          { success: false, error: `Unknown view: ${view}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[Assets API] GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function getSummary() {
  const [summary, totalEquity, totalMonthlyIncome] = await Promise.all([
    RealAssets.getAssetSummary(),
    RealAssets.getTotalEquityContribution(),
    RealAssets.getTotalMonthlyIncome(),
  ])

  // Calculate totals
  const totals = summary.reduce(
    (acc, s) => ({
      assetCount: acc.assetCount + s.assetCount,
      totalAcquisitionCost: acc.totalAcquisitionCost + s.totalAcquisitionCost,
      totalCurrentValue: acc.totalCurrentValue + s.totalCurrentValue,
      totalUnrealizedGain: acc.totalUnrealizedGain + s.totalUnrealizedGain,
      totalMonthlyIncome: acc.totalMonthlyIncome + s.totalMonthlyIncome,
    }),
    {
      assetCount: 0,
      totalAcquisitionCost: 0,
      totalCurrentValue: 0,
      totalUnrealizedGain: 0,
      totalMonthlyIncome: 0,
    }
  )

  return NextResponse.json({
    success: true,
    summary: {
      byType: summary.map((s) => ({
        ...s,
        formatted: {
          totalAcquisitionCost: `$${s.totalAcquisitionCost.toLocaleString()}`,
          totalCurrentValue: `$${s.totalCurrentValue.toLocaleString()}`,
          totalUnrealizedGain: `$${s.totalUnrealizedGain.toLocaleString()}`,
          totalMonthlyIncome: `$${s.totalMonthlyIncome.toLocaleString()}`,
          totalEquityContribution: `$${s.totalEquityContribution.toLocaleString()}`,
        },
      })),
      totals: {
        ...totals,
        totalEquityContribution: totalEquity,
        annualizedIncome: totalMonthlyIncome * 12,
        formatted: {
          assetCount: totals.assetCount.toString(),
          totalAcquisitionCost: `$${totals.totalAcquisitionCost.toLocaleString()}`,
          totalCurrentValue: `$${totals.totalCurrentValue.toLocaleString()}`,
          totalUnrealizedGain: `$${totals.totalUnrealizedGain.toLocaleString()}`,
          totalMonthlyIncome: `$${totals.totalMonthlyIncome.toLocaleString()}`,
          totalEquityContribution: `$${totalEquity.toLocaleString()}`,
          annualizedIncome: `$${(totalMonthlyIncome * 12).toLocaleString()}`,
        },
      },
    },
  })
}

async function getList(status?: string) {
  const assets = await RealAssets.getAllAssets(status as any)

  return NextResponse.json({
    success: true,
    assets: assets.map((a) => ({
      ...a,
      formatted: {
        acquisitionCost: `$${a.acquisitionCost.toLocaleString()}`,
        currentValuation: `$${a.currentValuation.toLocaleString()}`,
        monthlyIncome: `$${a.monthlyIncome.toLocaleString()}`,
        equityContribution: `$${a.equityContribution.toLocaleString()}`,
        unrealizedGain: `$${(a.currentValuation - a.acquisitionCost).toLocaleString()}`,
      },
    })),
  })
}

async function getDetail(assetId: string) {
  const [asset, valuations, income, documents] = await Promise.all([
    RealAssets.getAsset(assetId),
    RealAssets.getValuationHistory(assetId),
    RealAssets.getIncomeHistory(assetId),
    RealAssets.getAssetDocuments(assetId),
  ])

  if (!asset) {
    return NextResponse.json(
      { success: false, error: 'Asset not found' },
      { status: 404 }
    )
  }

  const totalIncomeReceived = income.reduce((sum, i) => sum + i.amount, 0)

  return NextResponse.json({
    success: true,
    asset: {
      ...asset,
      formatted: {
        acquisitionCost: `$${asset.acquisitionCost.toLocaleString()}`,
        currentValuation: `$${asset.currentValuation.toLocaleString()}`,
        monthlyIncome: `$${asset.monthlyIncome.toLocaleString()}`,
        equityContribution: `$${asset.equityContribution.toLocaleString()}`,
        unrealizedGain: `$${(asset.currentValuation - asset.acquisitionCost).toLocaleString()}`,
        totalIncomeReceived: `$${totalIncomeReceived.toLocaleString()}`,
      },
    },
    valuations: valuations.slice(0, 10),
    income: income.slice(0, 12),
    documents,
  })
}

async function getValuations(assetId: string) {
  const valuations = await RealAssets.getValuationHistory(assetId)

  return NextResponse.json({
    success: true,
    valuations: valuations.map((v) => ({
      ...v,
      formatted: {
        previousValue: `$${v.previousValue.toLocaleString()}`,
        newValue: `$${v.newValue.toLocaleString()}`,
        changeAmount: `$${v.changeAmount.toLocaleString()}`,
        changePercent: `${((v.changeAmount / v.previousValue) * 100).toFixed(2)}%`,
      },
    })),
  })
}

async function getIncomeHistory(assetId: string) {
  const income = await RealAssets.getIncomeHistory(assetId)

  return NextResponse.json({
    success: true,
    income: income.map((i) => ({
      ...i,
      formatted: {
        amount: `$${i.amount.toLocaleString()}`,
      },
    })),
  })
}

async function getDocuments(assetId: string) {
  const documents = await RealAssets.getAssetDocuments(assetId)

  return NextResponse.json({
    success: true,
    documents,
  })
}

// POST /api/grain/assets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'register':
        return await registerAsset(body)

      case 'update_valuation':
        return await updateValuation(body)

      case 'record_income':
        return await recordIncome(body)

      case 'upload_document':
        return await uploadDocument(body)

      case 'mark_sold':
        return await markSold(body)

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[Assets API] POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function registerAsset(body: any) {
  const {
    assetType,
    name,
    description,
    legalEntity,
    externalId,
    acquisitionCost,
    acquisitionDate,
    currentValuation,
    monthlyIncome,
    incomeStartDate,
  } = body

  if (!assetType || !name || !acquisitionCost || !acquisitionDate) {
    return NextResponse.json(
      {
        success: false,
        error: 'assetType, name, acquisitionCost, and acquisitionDate required',
      },
      { status: 400 }
    )
  }

  const asset = await RealAssets.registerAsset({
    assetType,
    name,
    description,
    legalEntity,
    externalId,
    acquisitionCost,
    acquisitionDate: new Date(acquisitionDate),
    currentValuation,
    monthlyIncome,
    incomeStartDate: incomeStartDate ? new Date(incomeStartDate) : undefined,
  })

  return NextResponse.json({
    success: true,
    asset,
    message: `Registered ${asset.name}. Equity contribution: $${asset.equityContribution.toLocaleString()}`,
  })
}

async function updateValuation(body: any) {
  const { assetId, newValue, source, appraiser, notes, supportingDocumentId } =
    body

  if (!assetId || !newValue || !source) {
    return NextResponse.json(
      { success: false, error: 'assetId, newValue, and source required' },
      { status: 400 }
    )
  }

  const valuation = await RealAssets.updateValuation({
    assetId,
    newValue,
    source,
    appraiser,
    notes,
    supportingDocumentId,
  })

  return NextResponse.json({
    success: true,
    valuation,
    message: `Updated valuation: ${valuation.changeAmount >= 0 ? '+' : ''}$${valuation.changeAmount.toLocaleString()}`,
  })
}

async function recordIncome(body: any) {
  const { assetId, incomeType, amount, periodStart, periodEnd, notes } = body

  if (!assetId || !incomeType || !amount || !periodStart || !periodEnd) {
    return NextResponse.json(
      {
        success: false,
        error: 'assetId, incomeType, amount, periodStart, and periodEnd required',
      },
      { status: 400 }
    )
  }

  const income = await RealAssets.recordIncome({
    assetId,
    incomeType,
    amount,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    notes,
  })

  return NextResponse.json({
    success: true,
    income,
    message: `Recorded ${incomeType} income: $${amount.toLocaleString()}. Allocated through revenue system.`,
  })
}

async function uploadDocument(body: any) {
  const {
    assetId,
    documentType,
    fileName,
    fileUrl,
    fileHash,
    fileSizeBytes,
    description,
  } = body

  if (!assetId || !documentType || !fileName || !fileUrl) {
    return NextResponse.json(
      {
        success: false,
        error: 'assetId, documentType, fileName, and fileUrl required',
      },
      { status: 400 }
    )
  }

  const document = await RealAssets.uploadDocument({
    assetId,
    documentType,
    fileName,
    fileUrl,
    fileHash,
    fileSizeBytes,
    description,
  })

  return NextResponse.json({
    success: true,
    document,
    message: `Uploaded ${documentType}: ${fileName}`,
  })
}

async function markSold(body: any) {
  const { assetId, salePrice, notes } = body

  if (!assetId || !salePrice) {
    return NextResponse.json(
      { success: false, error: 'assetId and salePrice required' },
      { status: 400 }
    )
  }

  const asset = await RealAssets.markAsSold(assetId, salePrice, notes)

  return NextResponse.json({
    success: true,
    asset,
    message: `Marked as sold for $${salePrice.toLocaleString()}. Proceeds added to liquidity.`,
  })
}
