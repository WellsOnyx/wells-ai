// Attribution Connection Actions API
// PATCH: Accept/decline connection, DELETE: Remove connection

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  acceptConnection,
  declineConnection,
  removeConnection,
} from '@/lib/attribution/connection-service'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId } = await params
    const body = await request.json()
    const { action } = body

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "accept" or "decline"' },
        { status: 400 }
      )
    }

    let connection
    let message

    if (action === 'accept') {
      connection = await acceptConnection(connectionId, userId)
      message = 'Connection accepted'
    } else {
      connection = await declineConnection(connectionId, userId)
      message = 'Connection declined'
    }

    return NextResponse.json({
      success: true,
      connection,
      message,
    })
  } catch (error) {
    console.error('Error updating connection:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update connection' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId } = await params
    const connection = await removeConnection(connectionId, userId)

    return NextResponse.json({
      success: true,
      connection,
      message: 'Connection removed',
    })
  } catch (error) {
    console.error('Error removing connection:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove connection' },
      { status: 400 }
    )
  }
}
