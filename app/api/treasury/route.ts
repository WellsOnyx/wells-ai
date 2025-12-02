/**
 * Treasury SDK API
 *
 * RESTful API for Treasury SDK operations.
 * Used by enterprise ERP integrations.
 *
 * POST /api/treasury?action=initialize - Initialize treasury wallet
 * POST /api/treasury?action=pay - Pay a vendor
 * POST /api/treasury?action=batch - Batch pay vendors
 * POST /api/treasury?action=drawCredit - Draw from credit line
 * POST /api/treasury?action=repayCredit - Repay credit line
 * GET /api/treasury?action=balance - Get treasury balance
 * GET /api/treasury?action=credit - Get credit line status
 * GET /api/treasury?action=appreciation - Get GRAIN appreciation
 * GET /api/treasury?action=dashboard - Get dashboard metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createTreasurySDK, TreasurySDKConfig } from '@/lib/treasury-sdk'

// Validate API key from header
function validateApiKey(request: NextRequest): string | null {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) return null
  // In production, validate against database
  return apiKey
}

// Get org ID from header
function getOrgId(request: NextRequest): string | null {
  return request.headers.get('x-organization-id')
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = validateApiKey(request)
    const orgId = getOrgId(request)

    if (!apiKey || !orgId) {
      return NextResponse.json(
        { error: 'Missing API key or organization ID' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, ...params } = body

    // Initialize SDK
    const config: TreasurySDKConfig = {
      apiKey: process.env.CIRCLE_API_KEY || '',
      environment: process.env.CIRCLE_ENV === 'production' ? 'production' : 'sandbox',
      organizationId: orgId,
    }

    const treasury = createTreasurySDK(config)

    switch (action) {
      case 'initialize': {
        const wallet = await treasury.initialize()
        return NextResponse.json({
          success: true,
          wallet: {
            id: wallet.id,
            walletAddress: wallet.walletAddress,
            balance: wallet.balance,
            chain: 'BASE',
            currency: 'GRAIN',
          },
        })
      }

      case 'pay': {
        await treasury.initialize()
        const transaction = await treasury.payVendor({
          vendorWallet: params.vendorWallet,
          amount: params.amount,
          reference: params.reference,
          costCenter: params.costCenter,
          glAccount: params.glAccount,
          memo: params.memo,
        })

        return NextResponse.json({
          success: true,
          transaction: {
            id: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
            reference: transaction.erpReference,
            completedAt: transaction.completedAt,
          },
        })
      }

      case 'batch': {
        await treasury.initialize()
        const transactions = await treasury.batchPay(params.payments)

        return NextResponse.json({
          success: true,
          batch: {
            count: transactions.length,
            totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
            transactions: transactions.map(t => ({
              id: t.id,
              amount: t.amount,
              status: t.status,
              reference: t.erpReference,
            })),
          },
        })
      }

      case 'requestPayment': {
        await treasury.initialize()
        const paymentRequest = await treasury.requestPayment({
          amount: params.amount,
          reference: params.reference,
          customerEmail: params.customerEmail,
          dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
          memo: params.memo,
        })

        return NextResponse.json({
          success: true,
          paymentRequest,
        })
      }

      case 'onboardVendor': {
        await treasury.initialize()
        const vendor = await treasury.onboardVendor({
          vendorId: params.vendorId,
          vendorName: params.vendorName,
          email: params.email,
          paymentTerms: params.paymentTerms,
        })

        return NextResponse.json({
          success: true,
          vendor: {
            vendorId: vendor.vendorId,
            vendorName: vendor.vendorName,
            walletAddress: vendor.walletAddress,
          },
        })
      }

      case 'inviteVendors': {
        await treasury.initialize()
        await treasury.inviteVendors(params.vendors)

        return NextResponse.json({
          success: true,
          invited: params.vendors.length,
        })
      }

      case 'drawCredit': {
        await treasury.initialize()
        const drawTx = await treasury.drawCredit(params.amount, params.reference)

        return NextResponse.json({
          success: true,
          transaction: {
            id: drawTx.id,
            type: drawTx.type,
            amount: drawTx.amount,
            status: drawTx.status,
            reference: drawTx.erpReference,
          },
        })
      }

      case 'repayCredit': {
        await treasury.initialize()
        const repayTx = await treasury.repayCredit(params.amount, params.reference)

        return NextResponse.json({
          success: true,
          transaction: {
            id: repayTx.id,
            type: repayTx.type,
            amount: repayTx.amount,
            status: repayTx.status,
            reference: repayTx.erpReference,
          },
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Treasury API error:', error)
    const message = error instanceof Error ? error.message : 'Treasury operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = validateApiKey(request)
    const orgId = getOrgId(request)

    if (!apiKey || !orgId) {
      return NextResponse.json(
        { error: 'Missing API key or organization ID' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action') || 'balance'

    const config: TreasurySDKConfig = {
      apiKey: process.env.CIRCLE_API_KEY || '',
      environment: process.env.CIRCLE_ENV === 'production' ? 'production' : 'sandbox',
      organizationId: orgId,
    }

    const treasury = createTreasurySDK(config)
    await treasury.initialize()

    switch (action) {
      case 'balance': {
        const balance = await treasury.getBalance()
        return NextResponse.json({
          success: true,
          balance,
          currency: 'GRAIN',
          chain: 'BASE',
        })
      }

      case 'credit': {
        const credit = await treasury.getCreditLine()
        return NextResponse.json({
          success: true,
          creditLine: credit.totalCreditLine,
          creditAvailable: credit.creditAvailable,
          creditUsed: credit.creditUsed,
          balance: credit.balance,
        })
      }

      case 'appreciation': {
        const appreciation = await treasury.getGrainAppreciation()
        return NextResponse.json({
          success: true,
          valueAtDeposit: appreciation.valueAtDeposit,
          currentValue: appreciation.currentValue,
          appreciationPercent: appreciation.appreciationPercent,
          appreciationAmount: appreciation.appreciationAmount,
        })
      }

      case 'dashboard': {
        const dashboard = await treasury.getDashboard()
        return NextResponse.json({
          success: true,
          dashboard,
        })
      }

      case 'report': {
        const startDate = url.searchParams.get('startDate')
        const endDate = url.searchParams.get('endDate')
        const format = (url.searchParams.get('format') || 'json') as 'pdf' | 'csv' | 'json'

        const report = await treasury.generateReport({
          startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: endDate ? new Date(endDate) : new Date(),
          format,
        })

        return NextResponse.json({
          success: true,
          report,
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Treasury API error:', error)
    const message = error instanceof Error ? error.message : 'Treasury operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
