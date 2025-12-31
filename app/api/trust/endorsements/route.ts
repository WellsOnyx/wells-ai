/**
 * Trust Endorsements API
 *
 * GET /api/trust/endorsements - Get endorsements for a user
 * POST /api/trust/endorsements - Create a new endorsement
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createEndorsement, getUserEndorsements, EndorsementRelationship } from '@/lib/reputation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const asEndorsee = searchParams.get('asEndorsee') !== 'false'
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const endorsements = await getUserEndorsements(userId, asEndorsee, limit)

    return NextResponse.json({ endorsements })
  } catch (error) {
    console.error('Endorsements error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get endorsements' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      endorseeId,
      relationship,
      skills,
      message,
    } = body

    if (!endorseeId || !relationship) {
      return NextResponse.json(
        { error: 'endorseeId and relationship are required' },
        { status: 400 }
      )
    }

    if (endorseeId === userId) {
      return NextResponse.json(
        { error: 'Cannot endorse yourself' },
        { status: 400 }
      )
    }

    const validRelationships: EndorsementRelationship[] = [
      'worked_together',
      'transacted',
      'collaborated',
      'knows_personally',
    ]

    if (!validRelationships.includes(relationship)) {
      return NextResponse.json(
        { error: 'Invalid relationship type' },
        { status: 400 }
      )
    }

    const endorsement = await createEndorsement({
      endorserId: userId,
      endorseeId,
      relationship,
      skills,
      message,
      isActive: true,
    })

    return NextResponse.json({ endorsement })
  } catch (error) {
    console.error('Endorsement error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create endorsement' },
      { status: 500 }
    )
  }
}
