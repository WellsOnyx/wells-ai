import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { GrainVaultAccount, CompanyData, ERPData, TreasuryData } from '@/lib/grain-vault/types'
import { createAccount, getAccountByClerkId, createWallet } from '@/lib/treasury-db'

// Generate a wallet ID and address (in production, this would integrate with Circle SDK)
function generateWalletCredentials() {
  const chars = 'abcdef0123456789'
  const walletId = `wallet_${Date.now()}_${Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`
  const address = '0x' + Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return { walletId, address }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if account already exists
    const existingAccount = await getAccountByClerkId(userId)
    if (existingAccount) {
      return NextResponse.json({
        success: true,
        account: {
          id: existingAccount.id,
          companyName: existingAccount.companyName,
          tier: existingAccount.tier,
          status: existingAccount.status,
          walletAddress: null, // Would need to fetch from treasury_wallets
          sdkEnabled: existingAccount.sdkEnabled,
          apiKey: existingAccount.apiKey
        },
        message: 'Account already exists'
      })
    }

    const user = await currentUser()
    const body = await request.json()
    const { companyData, erpData, treasuryData } = body as {
      companyData: Partial<CompanyData>
      erpData: Partial<ERPData>
      treasuryData: Partial<TreasuryData>
    }

    // Create account in database
    const dbAccount = await createAccount({
      clerkUserId: userId,
      companyName: companyData.companyName || 'Unnamed Company',
      companySize: companyData.companySize || 'startup',
      industry: companyData.industry || 'Technology',
      country: companyData.country || 'US',
      erpSystem: erpData.erpSystem || 'none',
      erpVersion: erpData.erpVersion,
      tier: 'starter',
    })

    // Create wallet in database
    // Use provided wallet address or generate new one
    const walletCredentials = treasuryData.walletAddress
      ? { walletId: `wallet_${Date.now()}`, address: treasuryData.walletAddress }
      : generateWalletCredentials()

    const wallet = await createWallet({
      accountId: dbAccount.id,
      walletId: walletCredentials.walletId,
      address: walletCredentials.address,
      blockchain: 'BASE',
      currency: 'GRAIN'
    })

    // Map to GrainVaultAccount format
    const account: GrainVaultAccount = {
      id: dbAccount.id,
      userId: dbAccount.clerkUserId,
      companyName: dbAccount.companyName,
      companySize: dbAccount.companySize,
      industry: dbAccount.industry,
      country: dbAccount.country,
      erpSystem: dbAccount.erpSystem,
      erpVersion: dbAccount.erpVersion,
      erpConnected: dbAccount.erpConnected,
      walletAddress: wallet.address,
      grainBalance: dbAccount.grainBalance,
      creditLine: dbAccount.creditLine,
      usedCredit: dbAccount.usedCredit,
      tier: dbAccount.tier,
      status: dbAccount.status,
      apiKey: dbAccount.apiKey,
      sdkEnabled: dbAccount.sdkEnabled,
      createdAt: dbAccount.createdAt,
      updatedAt: dbAccount.updatedAt,
      onboardingCompletedAt: dbAccount.onboardingCompletedAt,
    }

    // Update Clerk metadata
    if (user) {
      await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          public_metadata: {
            grainVaultOnboarded: true,
            grainVaultAccountId: account.id,
            grainVaultTier: account.tier
          }
        })
      })
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        companyName: account.companyName,
        tier: account.tier,
        status: account.status,
        walletAddress: account.walletAddress,
        sdkEnabled: account.sdkEnabled,
        apiKey: account.apiKey
      }
    })
  } catch (error) {
    console.error('Error creating Grain & Vault account:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch account from database
    const dbAccount = await getAccountByClerkId(userId)

    if (!dbAccount) {
      return NextResponse.json(
        { error: 'Account not found', needsOnboarding: true },
        { status: 404 }
      )
    }

    // Fetch wallet from database
    const { getWallets } = await import('@/lib/treasury-db')
    const wallets = await getWallets(dbAccount.id)
    const primaryWallet = wallets[0] // Get the first (primary) wallet

    return NextResponse.json({
      account: {
        id: dbAccount.id,
        companyName: dbAccount.companyName,
        companySize: dbAccount.companySize,
        industry: dbAccount.industry,
        erpSystem: dbAccount.erpSystem,
        erpConnected: dbAccount.erpConnected,
        walletAddress: primaryWallet?.address || null,
        walletId: primaryWallet?.walletId || null,
        grainBalance: primaryWallet?.balance || dbAccount.grainBalance,
        creditLine: dbAccount.creditLine,
        usedCredit: dbAccount.usedCredit,
        tier: dbAccount.tier,
        status: dbAccount.status,
        apiKey: dbAccount.apiKey,
        sdkEnabled: dbAccount.sdkEnabled,
        createdAt: dbAccount.createdAt
      }
    })
  } catch (error) {
    console.error('Error fetching Grain & Vault account:', error)
    return NextResponse.json(
      { error: 'Failed to fetch account' },
      { status: 500 }
    )
  }
}
