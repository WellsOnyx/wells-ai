/**
 * CCTP Bridge Complete API
 *
 * Called after the mint transaction is confirmed on the destination chain.
 * Credits GRAIN to the user's account.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { creditGrainFromDeposit } from '@/lib/circle'
import { CCTP_CHAINS, type ChainIdentifier } from '@/lib/circle/bridge'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { transferId, mintTxHash } = body

    if (!transferId || !mintTxHash) {
      return NextResponse.json(
        { error: 'Missing transferId or mintTxHash' },
        { status: 400 }
      )
    }

    // Get transfer record
    const result = await sql`
      SELECT * FROM grain_bridge_transfers
      WHERE id = ${transferId} AND user_id = ${userId}
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      )
    }

    const transfer = result.rows[0]

    if (transfer.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Transfer already completed',
        transfer,
      })
    }

    // Credit GRAIN to user
    const amount = parseFloat(transfer.amount)
    const creditResult = await creditGrainFromDeposit(
      userId,
      amount,
      `cctp_${transferId}`,
      'usdc'
    )

    if (!creditResult.success) {
      // Update status to failed
      await sql`
        UPDATE grain_bridge_transfers
        SET
          status = 'failed',
          error = ${creditResult.error || 'Failed to credit GRAIN'}
        WHERE id = ${transferId}
      `

      return NextResponse.json(
        { error: creditResult.error || 'Failed to credit GRAIN' },
        { status: 500 }
      )
    }

    // Update transfer as completed
    await sql`
      UPDATE grain_bridge_transfers
      SET
        status = 'completed',
        mint_tx_hash = ${mintTxHash},
        completed_at = NOW()
      WHERE id = ${transferId}
    `

    const destConfig = CCTP_CHAINS[transfer.destination_chain as ChainIdentifier]

    return NextResponse.json({
      success: true,
      transfer: {
        id: transferId,
        status: 'completed',
        amount: transfer.amount,
        grainCredited: creditResult.grainAmount,
        mintTxHash,
        mintExplorerUrl: `${destConfig?.explorerUrl}/tx/${mintTxHash}`,
      },
    })
  } catch (error: any) {
    console.error('[Bridge Complete] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to complete bridge' },
      { status: 500 }
    )
  }
}
