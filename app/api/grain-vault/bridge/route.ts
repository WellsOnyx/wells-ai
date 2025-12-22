/**
 * CCTP Bridge Transfer API
 *
 * Initiates cross-chain USDC transfers using Circle's CCTP
 *
 * Flow:
 * 1. User approves USDC spend on source chain
 * 2. Call depositForBurn on TokenMessengerV2
 * 3. Wait for attestation from Circle's Iris API
 * 4. Call receiveMessage on destination chain
 * 5. Credit GRAIN to user account
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import {
  CCTP_CHAINS,
  getAttestation,
  isRoutSupported,
  type ChainIdentifier,
  type TransferSpeed,
  type BridgeTransfer,
} from '@/lib/circle/bridge'
import { CIRCLE_CONFIG } from '@/lib/circle/config'

// =============================================================================
// POST - Initiate Bridge Transfer
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const body = await req.json()

    const {
      sourceChain,
      destinationChain,
      amount,
      burnTxHash,
      transferSpeed = 'FAST',
    } = body as {
      sourceChain: ChainIdentifier
      destinationChain: ChainIdentifier
      amount: string
      burnTxHash: string
      transferSpeed?: TransferSpeed
    }

    // Validate inputs
    if (!sourceChain || !destinationChain || !amount || !burnTxHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!isRoutSupported(sourceChain, destinationChain)) {
      return NextResponse.json(
        { error: 'Unsupported chain pair' },
        { status: 400 }
      )
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Create bridge transfer record
    const transferId = crypto.randomUUID()

    try {
      await sql`
        INSERT INTO grain_bridge_transfers (
          id,
          user_id,
          source_chain,
          destination_chain,
          amount,
          transfer_speed,
          status,
          burn_tx_hash,
          created_at
        ) VALUES (
          ${transferId},
          ${userId},
          ${sourceChain},
          ${destinationChain},
          ${amountNum},
          ${transferSpeed},
          'burning',
          ${burnTxHash},
          NOW()
        )
      `
    } catch (dbError: any) {
      // Table might not exist - create it
      if (dbError.message?.includes('does not exist')) {
        await createBridgeTransfersTable()
        await sql`
          INSERT INTO grain_bridge_transfers (
            id,
            user_id,
            source_chain,
            destination_chain,
            amount,
            transfer_speed,
            status,
            burn_tx_hash,
            created_at
          ) VALUES (
            ${transferId},
            ${userId},
            ${sourceChain},
            ${destinationChain},
            ${amountNum},
            ${transferSpeed},
            'burning',
            ${burnTxHash},
            NOW()
          )
        `
      } else {
        throw dbError
      }
    }

    const sourceConfig = CCTP_CHAINS[sourceChain]

    return NextResponse.json({
      success: true,
      transfer: {
        id: transferId,
        sourceChain,
        destinationChain,
        amount,
        transferSpeed,
        status: 'burning',
        burnTxHash,
        explorerUrl: `${sourceConfig.explorerUrl}/tx/${burnTxHash}`,
      },
      nextStep: 'Poll /api/grain-vault/bridge/status for attestation',
    })
  } catch (error: any) {
    console.error('[Bridge] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to initiate bridge' },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET - Get Bridge Transfer Status
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const transferId = searchParams.get('id')

    if (!transferId) {
      // Return list of user's transfers
      const transfers = await sql`
        SELECT * FROM grain_bridge_transfers
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 20
      `

      return NextResponse.json({
        success: true,
        transfers: transfers.rows,
      })
    }

    // Get specific transfer
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

    // If still waiting for attestation, check Iris API
    if (transfer.status === 'burning' || transfer.status === 'attesting') {
      if (transfer.message_hash) {
        const attestationResult = await getAttestation(transfer.message_hash)

        if (attestationResult.attestation) {
          // Update with attestation
          await sql`
            UPDATE grain_bridge_transfers
            SET
              attestation = ${attestationResult.attestation},
              status = 'attesting'
            WHERE id = ${transferId}
          `
          transfer.attestation = attestationResult.attestation
          transfer.status = 'attesting'
        }
      }
    }

    const sourceConfig = CCTP_CHAINS[transfer.source_chain as ChainIdentifier]
    const destConfig = CCTP_CHAINS[transfer.destination_chain as ChainIdentifier]

    return NextResponse.json({
      success: true,
      transfer: {
        ...transfer,
        burnExplorerUrl: transfer.burn_tx_hash
          ? `${sourceConfig?.explorerUrl}/tx/${transfer.burn_tx_hash}`
          : null,
        mintExplorerUrl: transfer.mint_tx_hash
          ? `${destConfig?.explorerUrl}/tx/${transfer.mint_tx_hash}`
          : null,
      },
    })
  } catch (error: any) {
    console.error('[Bridge Status] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    )
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function createBridgeTransfersTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS grain_bridge_transfers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      source_chain TEXT NOT NULL,
      destination_chain TEXT NOT NULL,
      amount DECIMAL(20, 6) NOT NULL,
      transfer_speed TEXT DEFAULT 'FAST',
      status TEXT DEFAULT 'pending',
      burn_tx_hash TEXT,
      mint_tx_hash TEXT,
      message_hash TEXT,
      attestation TEXT,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_bridge_transfers_user
    ON grain_bridge_transfers(user_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_bridge_transfers_status
    ON grain_bridge_transfers(status)
  `
}
