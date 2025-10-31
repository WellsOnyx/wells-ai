import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createACHPayment } from '@/lib/plaid'
import { calculateDynamicPricing } from '@/lib/pricing/dynamic-engine'
import { detectIndustryTier } from '@/lib/pricing/industry-detector'

/**
 * POST /api/payments/create-ach
 *
 * Creates an ACH payment using Plaid
 *
 * Request body:
 * {
 *   "amount": 100000, // in dollars
 *   "accountId": "plaid_account_id",
 *   "description": "50 tons of organic vegetables",
 *   "productDescription": "vegetables",
 *   "sellerEmail": "seller@example.com"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      amount,
      accountId,
      description,
      productDescription,
      sellerEmail,
      metadata = {},
    } = body

    if (!amount || !accountId || !description) {
      return NextResponse.json(
        { error: 'Amount, accountId, and description required' },
        { status: 400 }
      )
    }

    // Get Plaid access token from user metadata
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const accessToken = user.privateMetadata.plaidAccessToken as string | undefined

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No bank account connected. Please connect a bank account first.' },
        { status: 400 }
      )
    }

    // Calculate dynamic pricing
    const detection = productDescription
      ? await detectIndustryTier(productDescription)
      : { tier: 'gtm-service' as const, confidence: 0.5, reasoning: 'Default tier' }

    const pricing = await calculateDynamicPricing(
      amount,
      'ach',
      detection.tier
    )

    // Create ACH payment
    const payment = await createACHPayment({
      accessToken,
      accountId,
      amount: amount + pricing.totalFee, // Include Wells AI fee
      description,
      metadata: {
        ...metadata,
        buyerUserId: userId,
        sellerEmail: sellerEmail || '',
        industryTier: detection.tier,
        wellsAIFee: pricing.totalFee.toString(),
        wellsAIMargin: pricing.wellsAIRevenue.toString(),
        processingCost: pricing.processingCostTotal.toString(),
      },
    })

    console.log(`✅ ACH payment created: $${amount} + $${pricing.totalFee} fee`)
    console.log(`   Tier: ${detection.tier} (${(detection.confidence * 100).toFixed(0)}% confidence)`)
    console.log(`   Processing cost: $${pricing.processingCostTotal.toFixed(2)}`)
    console.log(`   Wells AI margin: $${pricing.wellsAIRevenue.toFixed(2)}`)

    return NextResponse.json({
      success: true,
      payment,
      pricing: {
        transactionAmount: pricing.transactionAmount,
        totalFee: pricing.totalFee,
        processingCost: pricing.processingCostTotal,
        wellsAIMargin: pricing.wellsAIRevenue,
        industryTier: detection.tier,
        confidence: detection.confidence,
        reasoning: detection.reasoning,
      },
      total: amount + pricing.totalFee,
    })
  } catch (error: any) {
    console.error('Error creating ACH payment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create ACH payment' },
      { status: 500 }
    )
  }
}
