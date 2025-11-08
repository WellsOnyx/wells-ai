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

    // Get all RFQs for this user with quotes
    const rfqs = await prisma.rFQ.findMany({
      where: { userId },
      include: {
        quotes: {
          orderBy: { pricePerUnit: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform quotes to include sellerName (placeholder for now)
    const rfqsWithSellerNames = rfqs.map(rfq => ({
      ...rfq,
      quotes: rfq.quotes.map(quote => ({
        ...quote,
        sellerName: `Supplier ${quote.sellerId.slice(0, 8)}`
      }))
    }))

    return NextResponse.json({
      rfqs: rfqsWithSellerNames,
      total: rfqs.length
    })

  } catch (error: any) {
    console.error('[RFQS LIST] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load RFQs' },
      { status: 500 }
    )
  }
}
