import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { calculateDynamicPricing } from '@/lib/pricing/dynamic-engine'
import { detectIndustryTier } from '@/lib/pricing/industry-detector'

/**
 * POST /api/pricing/calculate
 *
 * Calculate dynamic pricing for a transaction based on:
 * - Transaction amount
 * - Payment method
 * - Product/service description (auto-detects industry tier)
 *
 * Request body:
 * {
 *   "amount": 100000,
 *   "paymentMethod": "ach" | "stripe" | "wire" | "grain",
 *   "productDescription": "50 tons of organic vegetables",
 *   "conversationHistory": [] // Optional: for better context
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "pricing": {
 *     "transactionAmount": 100000,
 *     "paymentMethod": "ach",
 *     "industryTier": "commodities",
 *     "processingCostTotal": 0.25,
 *     "marginApplied": 500,
 *     "totalFee": 500.25,
 *     "sellerReceives": 99499.75,
 *     "wellsAIRevenue": 500
 *   },
 *   "detection": {
 *     "tier": "commodities",
 *     "confidence": 0.95,
 *     "reasoning": "Detected commodity-related keywords: vegetables, organic"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { amount, paymentMethod, productDescription, conversationHistory } = body

    // Validation
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      )
    }

    if (!paymentMethod || !['ach', 'stripe', 'wire', 'grain'].includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment method' },
        { status: 400 }
      )
    }

    if (!productDescription || productDescription.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product description required' },
        { status: 400 }
      )
    }

    // Step 1: Detect industry tier from description
    const detection = await detectIndustryTier(productDescription, conversationHistory)

    // Step 2: Calculate dynamic pricing
    const pricing = await calculateDynamicPricing(
      amount,
      paymentMethod,
      detection.tier
    )

    // Step 3: Return results
    return NextResponse.json({
      success: true,
      pricing: {
        transactionAmount: pricing.transactionAmount,
        paymentMethod: pricing.paymentMethod,
        industryTier: pricing.industryTier,
        processingCostTotal: pricing.processingCostTotal,
        marginApplied: pricing.marginApplied,
        totalFee: pricing.totalFee,
        sellerReceives: pricing.sellerReceives,
        wellsAIRevenue: pricing.wellsAIRevenue,
        calculatedAt: pricing.calculatedAt,
      },
      detection: {
        tier: detection.tier,
        confidence: detection.confidence,
        reasoning: detection.reasoning,
        keywords: detection.keywords,
        suggestedMargin: detection.suggestedMargin,
      },
    })
  } catch (error: any) {
    console.error('Error calculating pricing:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to calculate pricing' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/pricing/calculate?amount=100000&paymentMethod=ach&product=vegetables
 *
 * Quick pricing lookup (for testing)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const amount = parseFloat(searchParams.get('amount') || '0')
    const paymentMethod = searchParams.get('paymentMethod') || 'ach'
    const product = searchParams.get('product') || ''

    if (!amount || !product) {
      return NextResponse.json(
        { success: false, error: 'Missing amount or product' },
        { status: 400 }
      )
    }

    // Detect tier
    const detection = await detectIndustryTier(product)

    // Calculate pricing
    const pricing = await calculateDynamicPricing(
      amount,
      paymentMethod as any,
      detection.tier
    )

    return NextResponse.json({
      success: true,
      pricing,
      detection,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
