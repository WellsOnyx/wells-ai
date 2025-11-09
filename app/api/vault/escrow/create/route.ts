import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'
import { calculateEscrowTotal } from '@/lib/blockchain/vault-escrow'

const prisma = new PrismaClient()

/**
 * POST /api/vault/escrow/create
 * Create a new escrow transaction
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sellerId, amount, description, metadata } = await req.json()

    if (!sellerId || !amount || !description) {
      return NextResponse.json(
        { error: 'Seller ID, amount, and description required' },
        { status: 400 }
      )
    }

    // Calculate escrow fees
    const escrowDetails = calculateEscrowTotal(parseFloat(amount))

    // Create escrow transaction (mock - will integrate with smart contract)
    const escrow = {
      id: `escrow_${Date.now()}`,
      buyerId: userId,
      sellerId,
      amount: amount.toString(),
      amountUSD: parseFloat(amount),
      description,
      status: 'created',
      createdAt: new Date(),
      metadata,
      escrowDetails,
      contractAddress: process.env.VAULT_CONTRACT_ADDRESS,
      fundingInstructions: {
        recipientAddress: process.env.VAULT_CONTRACT_ADDRESS,
        amount: escrowDetails.total.toString(),
        currency: 'USDC',
        network: 'Ethereum',
        memo: `escrow_${Date.now()}`
      }
    }

    return NextResponse.json({
      success: true,
      escrow,
      message: `Escrow created for $${amount}. Please fund the contract to activate.`
    })

  } catch (error: any) {
    console.error('[VAULT ESCROW CREATE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create escrow' },
      { status: 500 }
    )
  }
}
