'use client'

/**
 * Grain & Vault - Deposit Page (Credit Line Model)
 *
 * THE CREDIT LINE MODEL:
 * 1. Protected Deposit - 100% of USD deposit is always withdrawable
 * 2. Credit Line - 1:1 credit line in GRAIN at current GRAIN price
 * 3. 0% Interest - No interest on the credit line
 * 4. 0% Transaction Fees - Free transactions inside the network
 *
 * THREE LAYERS:
 * Layer 1: Protected Deposit (your USD, always safe)
 * Layer 2: Credit Line (GRAIN to spend, 0% interest)
 * Layer 3: Appreciation (bonus GRAIN from ecosystem growth)
 */

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Landmark,
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  TrendingUp,
  Clock,
  Sparkles,
  Percent,
  CreditCard,
  Wallet,
  Lock,
  Zap
} from 'lucide-react'

// Types
interface WalletData {
  has_wallet: boolean
  has_profile?: boolean
  approved?: boolean
  balance: {
    grain: number
    usd_value: number
  }
  grain_price: number
}

interface PriceData {
  grain: {
    price_usd: number
    change_24h: number
    treasury_value: number
    total_supply: number
  }
}

interface DepositResult {
  success: boolean
  position: {
    protectedDeposit: number
    creditLineAvailable: number
    creditLineUsed: number
    appreciationGrain: number
  }
  transaction: {
    id: string
    amount: number
    grainCredited: number
    grainPrice: number
  }
}

// Loading fallback
function DepositPageLoading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading deposit page...</p>
      </div>
    </div>
  )
}

export default function DepositPage() {
  return (
    <Suspense fallback={<DepositPageLoading />}>
      <DepositPageContent />
    </Suspense>
  )
}

function DepositPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded, isSignedIn } = useUser()

  // State
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<DepositResult | null>(null)

  // Data
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [priceData, setPriceData] = useState<PriceData | null>(null)

  // Form
  const initialAmount = searchParams.get('amount') || ''
  const [amount, setAmount] = useState<string>(initialAmount)

  // Calculate GRAIN credit line based on oracle price
  const currentPrice = priceData?.grain?.price_usd || walletData?.grain_price || 1
  const grainCreditLine = useMemo(() => {
    const numAmount = parseFloat(amount) || 0
    return numAmount / currentPrice
  }, [amount, currentPrice])

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!isSignedIn) return

    setLoading(true)
    setError(null)

    try {
      const [walletRes, priceRes] = await Promise.all([
        fetch('/api/grain-vault/wallet'),
        fetch('/api/grain-vault/price')
      ])

      if (!walletRes.ok) {
        if (walletRes.status === 401) {
          router.push('/grain-vault/signin')
          return
        }
        throw new Error('Failed to load wallet data')
      }

      const walletResult = await walletRes.json()

      if (!walletResult.has_wallet && !walletResult.has_profile && !walletResult.success) {
        router.push('/grain-vault/onboard')
        return
      }

      if (walletResult.approved === false) {
        router.push('/grain-vault/dashboard')
        return
      }

      setWalletData(walletResult)

      if (priceRes.ok) {
        const priceResult = await priceRes.json()
        setPriceData(priceResult)
      }

    } catch (err: any) {
      console.error('Deposit page error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, router])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchData()
    } else if (isLoaded && !isSignedIn) {
      router.push('/grain-vault/signin')
    }
  }, [isLoaded, isSignedIn, fetchData, router])

  // Submit deposit to credit-line API
  const handleDeposit = async () => {
    const numAmount = parseFloat(amount)

    if (!numAmount || numAmount < 100) {
      setError('Minimum deposit is $100')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/grain/credit-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deposit',
          userId: user?.id,
          amount: numAmount
        })
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to process deposit')
      }

      setSuccess(result)

    } catch (err: any) {
      console.error('Deposit error:', err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Format helpers
  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const formatGRAIN = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount)
  }

  // Loading state
  if (!isLoaded || loading) {
    return <DepositPageLoading />
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header user={user} />

        <main className="max-w-2xl mx-auto px-6 py-8">
          <Link
            href="/grain-vault/dashboard"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          {/* Success Banner */}
          <div className="mb-8 p-8 bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 rounded-3xl backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Deposit Successful!
                </h2>
                <p className="text-gray-400">
                  Your funds are protected and your credit line is ready to use.
                </p>
              </div>
            </div>
          </div>

          {/* What You Got */}
          <div className="space-y-4 mb-8">
            {/* Protected Deposit */}
            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Protected Deposit</p>
                    <p className="text-xs text-green-400">100% Withdrawable</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">
                  {formatUSD(success.position.protectedDeposit)}
                </p>
              </div>
            </div>

            {/* Credit Line */}
            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Credit Line</p>
                    <p className="text-xs text-purple-400">@ {formatUSD(success.transaction.grainPrice)}/GRAIN</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">
                  {formatGRAIN(success.position.creditLineAvailable)} <span className="text-lg text-gray-400">GRAIN</span>
                </p>
              </div>
            </div>

            {/* Zero Fees Card */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-blue-400" />
                  <p className="text-sm text-gray-400">Interest Rate</p>
                </div>
                <p className="text-xl font-bold text-green-400">0%</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <p className="text-sm text-gray-400">Network Fees</p>
                </div>
                <p className="text-xl font-bold text-green-400">0%</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href="/grain-vault/dashboard"
              className="flex-1 px-6 py-4 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all text-center backdrop-blur-xl"
            >
              View Dashboard
            </Link>
            <button
              onClick={() => {
                setSuccess(null)
                setAmount('')
              }}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all"
            >
              Make Another Deposit
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header user={user} />

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/grain-vault/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Deposit Funds</h1>
          <p className="text-gray-400">
            Get instant credit in GRAIN with zero interest and zero fees
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 backdrop-blur-xl">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* The Three Layers Explanation */}
        <div className="mb-8 p-6 bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            How It Works
          </h3>

          <div className="space-y-4">
            {/* Layer 1 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Layer 1: Protected Deposit</p>
                <p className="text-sm text-gray-400">
                  Your USD is 100% protected and always withdrawable. No lockups.
                </p>
              </div>
            </div>

            {/* Layer 2 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Layer 2: Credit Line</p>
                <p className="text-sm text-gray-400">
                  Get a 1:1 credit line in GRAIN at current price. 0% interest forever.
                </p>
              </div>
            </div>

            {/* Layer 3 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Layer 3: Appreciation</p>
                <p className="text-sm text-gray-400">
                  Earn bonus GRAIN as the ecosystem grows. Your value increases over time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Deposit Form */}
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-xl">
          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Deposit Amount (USD)
            </label>

            {/* Preset Amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[1000, 5000, 10000, 25000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    amount === preset.toString()
                      ? 'bg-green-500/20 border-green-500/50 text-green-400'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  ${(preset / 1000).toFixed(0)}K
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                min="100"
                step="1"
                className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-2xl font-semibold text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all backdrop-blur-xl"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">Minimum deposit: $100</p>
          </div>

          {/* What You'll Get Preview */}
          {parseFloat(amount) >= 100 && (
            <div className="mb-6 rounded-2xl overflow-hidden border border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/5 backdrop-blur-xl">
              {/* Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-green-500/20 to-emerald-500/10 border-b border-green-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-white">What You'll Get</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Protected Deposit */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-white font-medium">Protected Deposit</p>
                      <p className="text-xs text-green-400">100% withdrawable anytime</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-white">{formatUSD(parseFloat(amount))}</p>
                </div>

                <div className="h-px bg-white/10" />

                {/* Credit Line */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-white font-medium">Credit Line</p>
                      <p className="text-xs text-purple-400">at {formatUSD(currentPrice)}/GRAIN</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-white">
                    {formatGRAIN(grainCreditLine)} <span className="text-sm text-gray-400">GRAIN</span>
                  </p>
                </div>

                <div className="h-px bg-white/10" />

                {/* Zero Interest */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Percent className="w-5 h-5 text-blue-400" />
                    <p className="text-white font-medium">Interest Rate</p>
                  </div>
                  <p className="text-xl font-bold text-green-400">0%</p>
                </div>

                <div className="h-px bg-white/10" />

                {/* Zero Fees */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    <p className="text-white font-medium">Transaction Fees</p>
                  </div>
                  <p className="text-xl font-bold text-green-400">0%</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-green-500/10 border-t border-green-500/20">
                <div className="flex items-center gap-2 text-sm text-green-400/90">
                  <Sparkles className="w-4 h-4" />
                  <span>Plus appreciation rewards as the ecosystem grows</span>
                </div>
              </div>
            </div>
          )}

          {/* Deposit Button */}
          <button
            onClick={handleDeposit}
            disabled={submitting || !amount || parseFloat(amount) < 100}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-green-500/25"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing Deposit...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Deposit {amount ? formatUSD(parseFloat(amount) || 0) : 'Now'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Key Benefits */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl text-center">
            <Lock className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">100% Safe</p>
            <p className="text-xs text-gray-400">Always protected</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl text-center">
            <Percent className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">0% Interest</p>
            <p className="text-xs text-gray-400">Forever</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl text-center">
            <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">0% Payment Fees</p>
            <p className="text-xs text-gray-400">No transaction costs</p>
          </div>
        </div>

        {/* Trust & Security */}
        <div className="p-5 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-400 font-medium mb-1">Bank-Grade Security</p>
              <p className="text-sm text-gray-400">
                Your deposits are held securely by regulated banking partners. Every dollar
                is protected, and you can withdraw your full deposit at any time with no penalties.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// Header Component
function Header({ user }: { user: any }) {
  return (
    <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/grain-vault" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <div className="w-3 h-3 bg-black rounded-sm" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Grain & Vault</h1>
              <p className="text-xs text-gray-400">{user?.firstName || 'Account'}</p>
            </div>
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href="/grain-vault/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
