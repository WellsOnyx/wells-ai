// Attribution Introduction API
// POST: Introduce an offer to a connection

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createIntroduction } from '@/lib/attribution/introduction-service'

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
    const { recipientId, recipientName } = body

    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId is required' }, { status: 400 })
    }

    const introducerName = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.emailAddresses?.[0]?.emailAddress

    const introduction = await createIntroduction(
      userId,
      recipientId,
      offerId,
      introducerName,
      recipientName
    )

    return NextResponse.json({
      success: true,
      introduction,
      message: 'Offer introduced successfully',
      chain: {
        level: introduction.level,
        l1: introduction.l1UserId,
        l2: introduction.l2UserId,
        l3: introduction.l3UserId,
        l4: introduction.l4UserId,
      },
    })
  } catch (error) {
    console.error('Error creating introduction:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to introduce offer' },
      { status: 400 }
    )
  }
}
