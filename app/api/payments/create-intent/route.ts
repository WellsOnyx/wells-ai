import { NextResponse } from 'next/server'
import { createDeal } from '@/lib/notion'

/**
 * POST /api/payments/create-intent
 * Create Stripe payment intent and record deal in Notion
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rfqId, quoteId, amount, wellsAIFee, tithe, paymentMethod } = body

    if (!rfqId || !quoteId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_YOUR_STRIPE_SECRET_KEY_HERE') {
      console.warn('Stripe not configured, simulating payment')

      // Create deal in Notion (simulation mode)
      const dealValue = (amount - wellsAIFee) / 100 // Convert back from cents
      const deal = await createDeal({
        rfqId,
        quoteId,
        buyerCompany: 'Simulation Company',
        sellerCompany: 'Simulation Supplier',
        productName: 'Simulation Product',
        category: 'Simulation',
        dealValue,
        status: 'Completed',
        closeDate: new Date().toISOString()
      })

      return NextResponse.json({
        success: true,
        dealId: deal?.id || 'sim_' + Date.now(),
        simulation: true,
        message: 'Payment simulated (Stripe not configured)'
      })
    }

    // Initialize Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // Amount in cents
      currency: 'usd',
      payment_method_types: paymentMethod === 'card' ? ['card'] : ['us_bank_account'],
      metadata: {
        rfqId,
        quoteId,
        wellsAIFee: wellsAIFee.toString(),
        tithe: tithe.toString(),
        platform: 'Wells AI'
      },
      description: 'Wells AI Transaction'
    })

    // Create deal record in Notion
    const dealValue = (amount - wellsAIFee) / 100 // Convert back from cents to dollars
    const deal = await createDeal({
      rfqId,
      quoteId,
      buyerCompany: 'TBD', // Will be populated from RFQ
      sellerCompany: 'TBD', // Will be populated from quote
      productName: 'TBD',
      category: 'TBD',
      dealValue,
      status: 'Payment Processing',
      closeDate: new Date().toISOString(),
      paymentIntentId: paymentIntent.id
    })

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      dealId: deal?.id,
      paymentIntentId: paymentIntent.id
    })

  } catch (error: any) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
