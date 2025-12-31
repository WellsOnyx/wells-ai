/**
 * Quick B2B Deal API
 *
 * POST - One-shot deal creation with auto-confirm
 *
 * For trusted parties: create, confirm, and optionally fund in one call.
 * "Yes, proceed" = instant deal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  createDeal,
  confirmDeal,
  fundDealEscrow,
  checkAutoFund,
  getDeal,
} from '@/lib/deals/service'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      // Required
      counterpartyId,
      title,
      amount,

      // Optional
      description,
      currency,
      role, // 'buyer' | 'seller' - which role is the current user

      // Companies
      myCompany,
      theirCompany,

      // Auto options
      autoFund,
    } = body

    if (!counterpartyId || !title || !amount) {
      return NextResponse.json(
        { error: 'counterpartyId, title, and amount required' },
        { status: 400 }
      )
    }

    // Determine parties based on role
    const isBuyer = role !== 'seller'
    const buyerId = isBuyer ? userId : counterpartyId
    const sellerId = isBuyer ? counterpartyId : userId

    // Create deal
    const deal = await createDeal({
      buyerId,
      sellerId,
      buyerCompany: isBuyer ? myCompany : theirCompany,
      sellerCompany: isBuyer ? theirCompany : myCompany,
      title,
      description,
      amount,
      currency,
    })

    // Auto-confirm current user
    const myRole = isBuyer ? 'buyer' : 'seller'
    await confirmDeal({
      dealId: deal.id,
      userId,
      role: myRole,
      method: 'api',
      message: 'Quick deal - yes, proceed',
    })

    // Check if we can auto-fund (trusted party with auto-fund enabled)
    let funded = false
    if (isBuyer && autoFund) {
      const canAutoFund = await checkAutoFund(buyerId, sellerId, amount)
      if (canAutoFund) {
        try {
          await fundDealEscrow(deal.id)
          funded = true
        } catch (err) {
          console.error('Auto-fund failed:', err)
        }
      }
    }

    // Get updated deal
    const finalDeal = await getDeal(deal.id)

    return NextResponse.json({
      success: true,
      deal: finalDeal,
      yourRole: myRole,
      confirmed: true,
      funded,
      nextStep: funded
        ? 'Awaiting seller delivery'
        : isBuyer
        ? 'Awaiting seller confirmation, then fund escrow'
        : 'Awaiting buyer confirmation and funding',
      message: funded
        ? `Deal created and funded! $${amount.toLocaleString()} in escrow. Everyone wins when delivery confirmed.`
        : `Deal created. Awaiting ${isBuyer ? 'seller' : 'buyer'} to say "yes, proceed".`,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Quick B2B deal error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create quick deal' },
      { status: 500 }
    )
  }
}
