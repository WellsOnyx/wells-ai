// @ts-nocheck
'use client'

/**
 * User-Facing Collateral Protection View
 *
 * Shows users exactly what backs their deposit:
 * - "Your deposit is backed by..."
 * - Collateral breakdown by type
 * - Protection guarantee explanation
 * - 100% coverage visualization
 *
 * This is critical for the "100% protected" claim.
 */

import { useEffect, useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  Shield,
  ShieldCheck,
  Building2,
  Landmark,
  PiggyBank,
  Home,
  Coins,
  DollarSign,
  CheckCircle,
  Info,
  RefreshCw,
  Loader2,
  AlertCircle,
  Lock,
  TrendingUp,
  FileText,
  ExternalLink,
} from 'lucide-react'

// Type icons mapping
const typeIcons: Record<string, any> = {
  fdic_deposit: Building2,
  treasury_bill: Landmark,
  treasury_bond: Landmark,
  treasury_note: Landmark,
  money_market: PiggyBank,
  real_estate: Home,
  precious_metals: Coins,
  other: DollarSign,
}

const typeLabels: Record<string, string> = {
  fdic_deposit: 'FDIC-Insured Deposits',
  treasury_bill: 'US Treasury Bills',
  treasury_bond: 'US Treasury Bonds',
  treasury_note: 'US Treasury Notes',
  money_market: 'Money Market Funds',
  real_estate: 'Real Estate Holdings',
  precious_metals: 'Precious Metals',
  other: 'Other Qualifying Assets',
}

const typeDescriptions: Record<string, string> = {
  fdic_deposit: 'Bank deposits insured by the Federal Deposit Insurance Corporation up to $250,000 per depositor.',
  treasury_bill: 'Short-term US government securities backed by the full faith and credit of the United States.',
  treasury_bond: 'Long-term US government securities backed by the full faith and credit of the United States.',
  treasury_note: 'Medium-term US government securities backed by the full faith and credit of the United States.',
  money_market: 'Highly liquid, low-risk investment funds that invest in short-term debt securities.',
  real_estate: 'Commercial and residential real estate holdings with title insurance.',
  precious_metals: 'Physical gold, silver, and other precious metals held in secure vault storage.',
  other: 'Other qualifying collateral assets meeting our protection standards.',
}

interface CollateralBacking {
  assetId: string
  assetName: string
  assetType: string
  allocatedAmount: number
  custodian: string
  protection: string
}

interface DepositCollateral {
  depositAmount: number
  collateralBackings: CollateralBacking[]
  totalBacking: number
  coverageRatio: number
  protectionExplanation: string
  formatted: {
    depositAmount: string
    totalBacking: string
    coverageRatio: string
  }
}

export default function UserCollateralPage() {
  const { user, isLoaded } = useUser()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [collateral, setCollateral] = useState<DepositCollateral | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedType, setExpandedType] = useState<string | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetch('/api/grain/collateral?view=user')

      if (!response.ok) {
        throw new Error('Failed to load collateral data')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Unknown error')
      }

      setCollateral(data.collateral)
      setError(null)
    } catch (err: any) {
      console.error('User collateral error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && user) {
      fetchData()
    }
  }, [isLoaded, user, fetchData])

  // Group backings by type
  const groupedBackings = collateral?.collateralBackings.reduce((acc, backing) => {
    if (!acc[backing.assetType]) {
      acc[backing.assetType] = {
        type: backing.assetType,
        backings: [],
        totalAmount: 0,
      }
    }
    acc[backing.assetType].backings.push(backing)
    acc[backing.assetType].totalAmount += backing.allocatedAmount
    return acc
  }, {} as Record<string, { type: string; backings: CollateralBacking[]; totalAmount: number }>)

  // Calculate percentages
  const totalBacking = collateral?.totalBacking || 0
  const groupedWithPercentages = Object.values(groupedBackings || {}).map((group) => ({
    ...group,
    percentage: totalBacking > 0 ? (group.totalAmount / totalBacking) * 100 : 0,
  }))

  // Sort by amount descending
  groupedWithPercentages.sort((a, b) => b.totalAmount - a.totalAmount)

  // Format currency
  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Loading state
  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your protection details...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-gray-400 mb-6">
            Please sign in to view your deposit protection details.
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-6 py-3 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // No deposit yet
  if (!collateral || collateral.depositAmount === 0) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-black" />
            </div>
            <h1 className="text-3xl font-bold mb-4">100% Deposit Protection</h1>
            <p className="text-gray-400 max-w-xl mx-auto">
              Every dollar you deposit is backed by real collateral. Make your first
              deposit to see exactly what protects your money.
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <Building2 className="w-10 h-10 text-blue-400 mb-4" />
              <h3 className="font-semibold text-white mb-2">FDIC-Insured</h3>
              <p className="text-sm text-gray-400">
                A portion of your deposit is held in FDIC-insured bank accounts,
                protected up to $250,000.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <Landmark className="w-10 h-10 text-emerald-400 mb-4" />
              <h3 className="font-semibold text-white mb-2">US Treasuries</h3>
              <p className="text-sm text-gray-400">
                Backed by US Treasury securities - the safest investments in the
                world.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <ShieldCheck className="w-10 h-10 text-purple-400 mb-4" />
              <h3 className="font-semibold text-white mb-2">Always 100%+</h3>
              <p className="text-sm text-gray-400">
                We maintain at least 100% collateralization. Your full deposit is
                always withdrawable.
              </p>
            </div>
          </div>

          <div className="text-center">
            <a
              href="/grain-vault/deposit"
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-black rounded-xl font-semibold hover:bg-emerald-400 transition-all"
            >
              Make Your First Deposit
              <TrendingUp className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Shield className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Your Deposit Protection</h1>
                <p className="text-xs text-gray-400">100% Backed & Protected</p>
              </div>
            </div>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Protection Status Banner */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-600/10 to-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Your Deposit is Protected</h2>
              <p className="text-emerald-400 font-medium">
                {collateral.formatted.coverageRatio} Collateral Coverage
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">Your Deposit</p>
              <p className="text-3xl font-bold text-white">{collateral.formatted.depositAmount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Collateral Backing</p>
              <p className="text-3xl font-bold text-emerald-400">{collateral.formatted.totalBacking}</p>
            </div>
          </div>

          {/* Protection Explanation */}
          <div className="mt-6 p-4 bg-white/5 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-300">{collateral.protectionExplanation}</p>
            </div>
          </div>
        </div>

        {/* What Backs Your Deposit */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            What Backs Your Deposit
          </h3>

          <div className="space-y-4">
            {groupedWithPercentages.map((group) => {
              const Icon = typeIcons[group.type] || DollarSign
              const isExpanded = expandedType === group.type

              return (
                <div
                  key={group.type}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedType(isExpanded ? null : group.type)}
                    className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-semibold text-white">
                          {typeLabels[group.type] || group.type}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {group.backings.length} asset{group.backings.length !== 1 ? 's' : ''} -{' '}
                          {group.percentage.toFixed(1)}% of your collateral
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold text-white">{formatUSD(group.totalAmount)}</p>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-white/5 p-6 bg-white/2.5">
                      <p className="text-sm text-gray-400 mb-4">
                        {typeDescriptions[group.type]}
                      </p>

                      <div className="space-y-3">
                        {group.backings.map((backing, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                          >
                            <div>
                              <p className="text-sm font-medium text-white">{backing.assetName}</p>
                              <p className="text-xs text-gray-400">
                                Custodian: {backing.custodian}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-white">
                                {formatUSD(backing.allocatedAmount)}
                              </p>
                              <p className="text-xs text-emerald-400">{backing.protection}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="h-1 bg-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.min(group.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Protection Guarantees */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Your Protection Guarantees
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">100% Withdrawable</h4>
                <p className="text-sm text-gray-400">
                  Your full deposit is always available to withdraw at any time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Verified Custody</h4>
                <p className="text-sm text-gray-400">
                  All collateral is held with regulated custodians and verified regularly.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Government Backing</h4>
                <p className="text-sm text-gray-400">
                  Treasury securities are backed by the full faith of the US government.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">FDIC Insurance</h4>
                <p className="text-sm text-gray-400">
                  Bank deposits are insured by FDIC up to $250,000 per depositor.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Learn More / FAQ */}
        <div className="bg-gradient-to-br from-white/5 to-white/2.5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            How Collateral Protection Works
          </h3>

          <div className="space-y-4 text-sm text-gray-400">
            <p>
              When you deposit funds into Grain & Vault, we immediately allocate equivalent
              collateral to back your deposit. This means for every dollar you deposit,
              at least one dollar in verified assets is set aside specifically for you.
            </p>

            <p>
              Our collateral consists of the safest asset classes available: FDIC-insured
              bank deposits, US Treasury securities, money market funds, and other
              qualifying assets. These are held with regulated custodians and verified
              regularly.
            </p>

            <p>
              This is fundamentally different from traditional banking where your deposits
              can be loaned out. With Grain & Vault, your money is always backed 1:1 (or
              more) by real collateral, giving you the security of knowing your full
              deposit is always withdrawable.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <a
              href="/grain-vault/how-it-works"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-all"
            >
              <FileText className="w-4 h-4" />
              Learn More
            </a>
            <a
              href="/grain-vault/withdraw"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-all"
            >
              Withdraw Funds
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
