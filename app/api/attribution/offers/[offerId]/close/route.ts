// Attribution Deal Close API
// POST: Close a deal and trigger commission distribution

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import {
  createClosure,
  verifyClosure,
  payCommissions,
} from '@/lib/attribution/commission-engine'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const { offerId } = await params
    const body = await request.json()

    const {
      closerId,
      actualValue,
      introductionId,
      externalDealId,
      proofUrl,
      notes,
      autoVerify = false, // If true, immediately verify and pay
    } = body

    if (!closerId) {
      return NextResponse.json({ error: 'closerId is required' }, { status: 400 })
    }
    if (!actualValue || actualValue <= 0) {
      return NextResponse.json({ error: 'actualValue must be positive' }, { status: 400 })
    }

    const closerName = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.emailAddresses?.[0]?.emailAddress

    // Create the closure
    const { closure, commissions } = await createClosure(
      userId,
      {
        offerId,
        closerId,
        actualValue,
        introductionId,
        externalDealId,
        proofUrl,
        notes,
      },
      closerName
    )

    // If auto-verify, verify and pay immediately
    if (autoVerify) {
      await verifyClosure(closure.id, userId)
      const paidCommissions = await payCommissions(closure.id)

      return NextResponse.json({
        success: true,
        closure: { ...closure, status: 'paid' },
        commissions: paidCommissions,
        message: 'Deal closed and commissions paid',
      })
    }

    return NextResponse.json({
      success: true,
      closure,
      commissions,
      message: 'Deal closure recorded. Verify and pay commissions when ready.',
    })
  } catch (error) {
    console.error('Error closing deal:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to close deal' },
      { status: 400 }
    )
  }
}

// PATCH: Verify or pay a closure
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { closureId, action } = body

    if (!closureId) {
      return NextResponse.json({ error: 'closureId is required' }, { status: 400 })
    }
    if (!action || !['verify', 'pay'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "verify" or "pay"' },
        { status: 400 }
      )
    }

    if (action === 'verify') {
      const closure = await verifyClosure(closureId, userId)
      return NextResponse.json({
        success: true,
        closure,
        message: 'Closure verified',
      })
    }

    if (action === 'pay') {
      const commissions = await payCommissions(closureId)
      return NextResponse.json({
        success: true,
        commissions,
        message: 'Commissions paid',
      })
    }
  } catch (error) {
    console.error('Error updating closure:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update closure' },
      { status: 400 }
    )
  }
}
