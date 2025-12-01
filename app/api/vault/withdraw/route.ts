/**
 * POST /api/vault/withdraw
 *
 * Burn GRAIN and receive USDC at current NAV
 * - Withdrawals > $100K require 24h time-lock
 * - Fee: 0.33%
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  Vault,
  PriceOracle,
  GrainToken,
  toGRAIN,
  fromGRAIN,
  fromUSDC,
  isValidAddress,
} from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'
import { incrementVolume24h } from '@/lib/blockchain/cache'

const WithdrawSchema = z.object({
  address: z.string().refine(isValidAddress, 'Invalid Ethereum address'),
  grainAmount: z.number().positive('Amount must be positive'),
})

const FEE_PERCENTAGE = 0.0033 // 0.33%
const TIMELOCK_THRESHOLD = 100000 // $100K
const TIMELOCK_HOURS = 24

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = WithdrawSchema.parse(body)

    // Get current NAV
    const navRaw = await PriceOracle.getCurrentNAV()
    const nav = fromUSDC(navRaw)

    // Calculate USDC amount
    const usdcAmount = data.grainAmount * nav
    const fee = usdcAmount * FEE_PERCENTAGE
    const netAmount = usdcAmount - fee

    // Check if timelock required
    const requiresTimelock = usdcAmount > TIMELOCK_THRESHOLD

    // Verify GRAIN balance
    const balanceRaw = await GrainToken.balanceOf(data.address)
    const balance = fromGRAIN(balanceRaw)

    if (balance < data.grainAmount) {
      return NextResponse.json(
        {
          error: 'Insufficient GRAIN balance',
          required: data.grainAmount,
          available: balance,
        },
        { status: 400 }
      )
    }

    if (requiresTimelock) {
      // Check for existing pending withdrawal
      const existingRequest = await query(
        `SELECT * FROM withdrawal_requests
         WHERE user_address = $1 AND status = 'pending'
         ORDER BY created_at DESC LIMIT 1`,
        [data.address.toLowerCase()]
      )

      if (existingRequest.rows.length > 0) {
        const request = existingRequest.rows[0]
        const executeAt = new Date(request.execute_at)
        const now = new Date()

        if (now >= executeAt) {
          // Timelock expired, can execute
          try {
            const txHash = await Vault.executeWithdrawal(BigInt(request.request_id))

            await query(
              'UPDATE withdrawal_requests SET status = $1, tx_hash = $2, executed_at = NOW() WHERE id = $3',
              ['executed', txHash, request.id]
            )

            await incrementVolume24h(netAmount)

            return NextResponse.json({
              success: true,
              transaction: {
                txHash,
                type: 'withdrawal',
                grainAmount: data.grainAmount,
                usdcAmount,
                nav,
                fee,
                netAmount,
                timestamp: new Date().toISOString(),
              },
              message: 'Withdrawal executed. USDC will be transferred after confirmation.',
            })
          } catch (execError) {
            console.error('[Vault] Withdrawal execution failed:', execError)
            return NextResponse.json(
              {
                error: 'Withdrawal execution failed',
                message: execError instanceof Error ? execError.message : 'Unknown error',
              },
              { status: 500 }
            )
          }
        } else {
          // Still locked
          return NextResponse.json(
            {
              error: 'Withdrawal is time-locked',
              requestId: request.request_id,
              executeAt: executeAt.toISOString(),
              hoursRemaining: Math.ceil((executeAt.getTime() - now.getTime()) / (1000 * 60 * 60)),
            },
            { status: 400 }
          )
        }
      }

      // Create new timelock request
      const grainWei = toGRAIN(data.grainAmount)
      const requestIdRaw = await Vault.requestWithdrawal(grainWei)

      const executeAt = new Date()
      executeAt.setHours(executeAt.getHours() + TIMELOCK_HOURS)

      await query(
        `INSERT INTO withdrawal_requests (
          request_id, user_address, grain_amount, usdc_amount,
          nav_price, fee, execute_at, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          requestIdRaw.toString(),
          data.address.toLowerCase(),
          data.grainAmount,
          usdcAmount,
          nav,
          fee,
          executeAt,
          'pending',
        ]
      )

      return NextResponse.json({
        success: true,
        timelock: {
          requestId: requestIdRaw.toString(),
          grainAmount: data.grainAmount,
          usdcAmount,
          nav,
          fee,
          netAmount,
          executeAt: executeAt.toISOString(),
          hoursRemaining: TIMELOCK_HOURS,
        },
        message: `Withdrawal request created. Amount is over $${TIMELOCK_THRESHOLD.toLocaleString()}, so it requires a ${TIMELOCK_HOURS}h timelock. You can execute after ${executeAt.toLocaleString()}.`,
      })
    }

    // Instant withdrawal (< $100K)
    try {
      const grainWei = toGRAIN(data.grainAmount)
      const requestId = await Vault.requestWithdrawal(grainWei)
      const txHash = await Vault.executeWithdrawal(requestId)

      // Store transaction
      await query(
        `INSERT INTO vault_transactions (
          tx_hash, user_address, type, usdc_amount, grain_amount,
          nav_price, fee, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          txHash,
          data.address.toLowerCase(),
          'withdrawal',
          netAmount,
          data.grainAmount,
          nav,
          fee,
          'pending',
        ]
      )

      await incrementVolume24h(netAmount)

      return NextResponse.json({
        success: true,
        transaction: {
          txHash,
          type: 'withdrawal',
          grainAmount: data.grainAmount,
          usdcAmount,
          nav,
          fee,
          netAmount,
          timestamp: new Date().toISOString(),
        },
        message: 'Withdrawal transaction submitted. USDC will be transferred after confirmation.',
      })
    } catch (txError) {
      console.error('[Vault] Withdrawal transaction failed:', txError)
      return NextResponse.json(
        {
          error: 'Transaction failed',
          message: txError instanceof Error ? txError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[API] Withdrawal error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process withdrawal',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
