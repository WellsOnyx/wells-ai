// Attribution Connections API
// GET: List connections, POST: Create connection request

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import {
  getConnectionsResponse,
  createConnectionRequest,
} from '@/lib/attribution/connection-service'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await getConnectionsResponse(userId)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting connections:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get connections' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const body = await request.json()
    const { targetUserId, targetName, targetEmail } = body

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
    }

    const connection = await createConnectionRequest(
      userId,
      targetUserId,
      user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.emailAddresses?.[0]?.emailAddress,
      user?.emailAddresses?.[0]?.emailAddress,
      targetName,
      targetEmail
    )

    return NextResponse.json({
      success: true,
      connection,
      message: 'Connection request sent',
    })
  } catch (error) {
    console.error('Error creating connection:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create connection' },
      { status: 400 }
    )
  }
}
