/**
 * CCTP Bridge Estimate API
 *
 * Returns cost estimates for cross-chain USDC transfers
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  estimateBridgeTransfer,
  isRoutSupported,
  type ChainIdentifier,
  type TransferSpeed,
} from '@/lib/circle/bridge'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sourceChain = searchParams.get('sourceChain') as ChainIdentifier
    const destinationChain = searchParams.get('destinationChain') as ChainIdentifier
    const amount = searchParams.get('amount')
    const speed = (searchParams.get('speed') || 'FAST') as TransferSpeed

    if (!sourceChain || !destinationChain || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: sourceChain, destinationChain, amount' },
        { status: 400 }
      )
    }

    if (!isRoutSupported(sourceChain, destinationChain)) {
      return NextResponse.json(
        { error: 'Unsupported chain pair' },
        { status: 400 }
      )
    }

    const estimate = await estimateBridgeTransfer(
      sourceChain,
      destinationChain,
      amount,
      speed
    )

    if (!estimate) {
      return NextResponse.json(
        { error: 'Failed to estimate transfer' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      estimate,
    })
  } catch (error: any) {
    console.error('[Bridge Estimate] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to estimate' },
      { status: 500 }
    )
  }
}
