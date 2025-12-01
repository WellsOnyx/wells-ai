/**
 * POST /api/vault/deposit
 *
 * Deposit USDC into vault and receive GRAIN at current NAV
 * Fee: 0.33% (33 basis points)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  Vault,
  PriceOracle,
  GrainToken,
  toUSDC,
  toGRAIN,
  fromGRAIN,
  fromUSDC,
  isValidAddress,
  publicClient,
  CONTRACTS,
} from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'
import { incrementVolume24h } from '@/lib/blockchain/cache'

const DepositSchema = z.object({
  address: z.string().refine(isValidAddress, 'Invalid Ethereum address'),
  usdcAmount: z.number().positive('Amount must be positive'),
})

const FEE_PERCENTAGE = 0.0033 // 0.33%

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = DepositSchema.parse(body)

    // Get current NAV
    const navRaw = await PriceOracle.getCurrentNAV()
    const nav = fromUSDC(navRaw)

    // Calculate amounts
    const fee = data.usdcAmount * FEE_PERCENTAGE
    const netAmount = data.usdcAmount - fee
    const grainAmount = netAmount / nav

    // Verify USDC approval (user must approve vault contract first)
    const { USDC_ABI } = await import('@/lib/blockchain/contracts')
    const allowance = await publicClient.readContract({
      address: CONTRACTS.USDC_TOKEN,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [data.address as `0x${string}`, CONTRACTS.GRAIN_VAULT],
    })

    const allowanceAmount = fromUSDC(allowance as bigint)

    if (allowanceAmount < data.usdcAmount) {
      return NextResponse.json(
        {
          error: 'Insufficient USDC allowance',
          required: data.usdcAmount,
          current: allowanceAmount,
          message: 'Please approve the Vault contract to spend your USDC first',
        },
        { status: 400 }
      )
    }

    // Execute deposit transaction
    let txHash: string
    try {
      const usdcWei = toUSDC(data.usdcAmount)
      txHash = await Vault.deposit(usdcWei)
    } catch (txError) {
      console.error('[Vault] Deposit transaction failed:', txError)
      return NextResponse.json(
        {
          error: 'Transaction failed',
          message: txError instanceof Error ? txError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Store transaction in database
    await query(
      `INSERT INTO vault_transactions (
        tx_hash, user_address, type, usdc_amount, grain_amount,
        nav_price, fee, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        txHash,
        data.address.toLowerCase(),
        'deposit',
        data.usdcAmount,
        grainAmount,
        nav,
        fee,
        'pending',
      ]
    )

    // Update 24h volume
    await incrementVolume24h(data.usdcAmount)

    return NextResponse.json({
      success: true,
      transaction: {
        txHash,
        type: 'deposit',
        usdcAmount: data.usdcAmount,
        grainAmount: parseFloat(grainAmount.toFixed(6)),
        nav,
        fee,
        netAmount,
        timestamp: new Date().toISOString(),
      },
      message: 'Deposit transaction submitted. GRAIN will be credited after confirmation.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[API] Deposit error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process deposit',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
