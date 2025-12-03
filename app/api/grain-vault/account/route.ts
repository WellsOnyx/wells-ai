import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { GrainVaultAccount, CompanyData, ERPData, TreasuryData } from '@/lib/grain-vault/types'

// In-memory storage (replace with database in production)
const accounts = new Map<string, GrainVaultAccount>()

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await currentUser()
    const body = await request.json()
    const { companyData, erpData, treasuryData } = body as {
      companyData: Partial<CompanyData>
      erpData: Partial<ERPData>
      treasuryData: Partial<TreasuryData>
    }

    // Generate API key
    const apiKey = `gv_live_${Array.from({ length: 32 }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
    ).join('')}`

    // Create account
    const account: GrainVaultAccount = {
      id: `gv_${Date.now()}`,
      userId,
      companyName: companyData.companyName || 'Unnamed Company',
      companySize: companyData.companySize || 'startup',
      industry: companyData.industry || 'Technology',
      country: companyData.country || 'US',
      erpSystem: erpData.erpSystem || 'none',
      erpVersion: erpData.erpVersion,
      erpConnected: false,
      walletAddress: treasuryData.walletAddress,
      grainBalance: 0,
      creditLine: 0,
      usedCredit: 0,
      tier: 'starter',
      status: 'active',
      apiKey,
      sdkEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      onboardingCompletedAt: new Date()
    }

    // Store account
    accounts.set(userId, account)

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
        sdkEnabled: account.sdkEnabled
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

    const account = accounts.get(userId)

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found', needsOnboarding: true },
        { status: 404 }
      )
    }

    return NextResponse.json({
      account: {
        id: account.id,
        companyName: account.companyName,
        companySize: account.companySize,
        industry: account.industry,
        erpSystem: account.erpSystem,
        erpConnected: account.erpConnected,
        walletAddress: account.walletAddress,
        grainBalance: account.grainBalance,
        creditLine: account.creditLine,
        usedCredit: account.usedCredit,
        tier: account.tier,
        status: account.status,
        apiKey: account.apiKey,
        sdkEnabled: account.sdkEnabled,
        createdAt: account.createdAt
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
