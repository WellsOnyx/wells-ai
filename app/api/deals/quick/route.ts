/**
 * Quick Deal API
 *
 * POST - One-shot deal creation and confirmation
 *
 * For trusted parties or simple transactions where
 * both parties are ready to proceed immediately.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  createDeal,
  confirmDeal,
  fundDealEscrow,
  checkAutoFund,
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
      message: 'Quick deal - auto confirmed',
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
    const response = {
      success: true,
      deal,
      yourRole: myRole,
      confirmed: true,
      funded,
      nextStep: funded
        ? 'Awaiting seller delivery'
        : isBuyer
        ? 'Awaiting seller confirmation, then fund escrow'
        : 'Awaiting buyer confirmation and funding',
      message: funded
        ? `Deal created and funded! $${amount.toLocaleString()} in escrow.`
        : `Deal created. Awaiting ${isBuyer ? 'seller' : 'buyer'} confirmation.`,
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error: any) {
    console.error('Quick deal error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create quick deal' },
      { status: 500 }
    )
  }
}
