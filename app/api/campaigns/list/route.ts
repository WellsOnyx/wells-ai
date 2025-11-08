import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all campaigns for this user
    const campaigns = await prisma.wellsOnyxCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      campaigns,
      total: campaigns.length
    })

  } catch (error: any) {
    console.error('[CAMPAIGNS LIST] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load campaigns' },
      { status: 500 }
    )
  }
}
