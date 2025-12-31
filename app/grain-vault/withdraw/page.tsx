'use client'

/**
 * Grain & Vault - Withdraw Page with Credit Line Repayment
 *
 * UX PRINCIPLES:
 * 1. TRUST FIRST - Users need to feel their money is safe and accessible
 * 2. CLARITY - Show the three layers: Protected Deposit, Credit Used, Net Withdrawable
 * 3. TRANSPARENCY - If credit is used, show exactly what will be repaid
 * 4. NO SURPRISES - Calculate and display credit repayment before confirming
 *
 * THREE-LAYER MODEL:
 * 1. Protected Deposit - Always available (your principal)
 * 2. Credit Line Used - Must be repaid proportionally on withdrawal
 * 3. Net Withdrawable - Protected Deposit minus proportional credit repayment
 */

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  Wallet,
  Building2,
  Clock,
  Banknote,
  TrendingUp,
  CreditCard,
  ArrowDownRight,
  Minus
} from 'lucide-react'

// Types
interface WalletData {
  has_wallet: boolean
  approved?: boolean
  balance: {
    grain: number
    usd_value: number
  }
  grain_price: number
}

interface CreditLinePosition {
  protectedDeposit: number
  creditLineLimit: number
  creditLineUsed: number
  creditLineAvailable: number
  appreciationGrain: number
  grainPrice: number
  currentValue: number
  status: 'active' | 'credit_used' | 'frozen'
}

// Loading fallback
function WithdrawPageLoading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading your account...</p>
      </div>
    </div>
  )
}

export default function WithdrawPage() {
  return (
    <Suspense fallback={<WithdrawPageLoading />}>
      <WithdrawPageContent />
    </Suspense>
  )
}

function WithdrawPageContent() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()

  // State
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Data
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [creditPosition, setCreditPosition] = useState<CreditLinePosition | null>(null)

  // Form
  const [amount, setAmount] = useState<string>('')
  const [withdrawMethod, setWithdrawMethod] = useState<'ach' | 'wire'>('ach')

  // Computed values from credit position
  const protectedDeposit = creditPosition?.protectedDeposit || 0
  const creditLineUsed = creditPosition?.creditLineUsed || 0
  const grainPrice = creditPosition?.grainPrice || 1
  const creditValueUsed = creditLineUsed * grainPrice

  // Net withdrawable = Protected Deposit (credit repayment happens proportionally)
  const netWithdrawable = protectedDeposit

  // Calculate withdrawal impact
  const withdrawalCalculation = useMemo(() => {
    const withdrawAmount = parseFloat(amount) || 0
    if (withdrawAmount <= 0 || protectedDeposit <= 0) {
      return {
        amountToWithdraw: 0,
        creditToRepay: 0,
        creditToRepayUsd: 0,
        remainingDeposit: protectedDeposit,
        remainingCreditUsed: creditLineUsed,
        withdrawalRatio: 0
      }
    }

    // Calculate proportional repayment
    const withdrawalRatio = Math.min(withdrawAmount / protectedDeposit, 1)
    const creditToRepay = creditLineUsed * withdrawalRatio
    const creditToRepayUsd = creditToRepay * grainPrice

    return {
      amountToWithdraw: Math.min(withdrawAmount, protectedDeposit),
      creditToRepay,
      creditToRepayUsd,
      remainingDeposit: protectedDeposit - Math.min(withdrawAmount, protectedDeposit),
      remainingCreditUsed: creditLineUsed - creditToRepay,
      withdrawalRatio
    }
  }, [amount, protectedDeposit, creditLineUsed, grainPrice])

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!isSignedIn || !user?.id) return

    setLoading(true)
    setError(null)

    try {
      // Fetch wallet data and credit position in parallel
      const [walletRes, creditRes] = await Promise.all([
        fetch('/api/grain-vault/wallet'),
        fetch(`/api/grain/credit-line?userId=${user.id}`)
      ])

      if (!walletRes.ok) {
        if (walletRes.status === 401) {
          router.push('/grain-vault/signin')
          return
        }
        throw new Error('Failed to load account data')
      }

      const walletResult = await walletRes.json()

      if (!walletResult.has_wallet) {
        router.push('/grain-vault/onboard')
        return
      }

      if (walletResult.approved === false) {
        router.push('/grain-vault/dashboard')
        return
      }

      setWalletData(walletResult)

      // Parse credit position
      if (creditRes.ok) {
        const creditResult = await creditRes.json()
        if (creditResult.success && creditResult.position) {
          setCreditPosition({
            protectedDeposit: creditResult.position.protectedDeposit || 0,
            creditLineLimit: creditResult.position.creditLineLimit || 0,
            creditLineUsed: creditResult.position.creditLineUsed || 0,
            creditLineAvailable: creditResult.position.creditLineAvailable || 0,
            appreciationGrain: creditResult.position.appreciationGrain || 0,
            grainPrice: creditResult.position.grainPrice || 1,
            currentValue: creditResult.position.currentValue || 0,
            status: creditResult.position.status || 'active'
          })
        } else {
          // No credit position - use wallet data as fallback
          setCreditPosition({
            protectedDeposit: walletResult.balance?.usd_value || 0,
            creditLineLimit: 0,
            creditLineUsed: 0,
            creditLineAvailable: 0,
            appreciationGrain: 0,
            grainPrice: walletResult.grain_price || 1,
            currentValue: walletResult.balance?.usd_value || 0,
            status: 'active'
          })
        }
      }
    } catch (err: any) {
      console.error('Withdraw page error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, user?.id, router])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchData()
    } else if (isLoaded && !isSignedIn) {
      router.push('/grain-vault/signin')
    }
  }, [isLoaded, isSignedIn, fetchData, router])

  // Handle withdrawal
  const handleWithdraw = async () => {
    const numAmount = parseFloat(amount)

    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (numAmount > protectedDeposit) {
      setError(`You can withdraw up to ${formatUSD(protectedDeposit)}`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Call the credit-line API with withdraw action
      const res = await fetch('/api/grain/credit-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw',
          userId: user?.id,
          amount: numAmount
        })
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Withdrawal failed')
      }

      setSuccess(true)
    } catch (err: any) {
      console.error('Withdrawal error:', err)
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
      maximumFractionDigits: 4
    }).format(amount)
  }

  // Loading state
  if (!isLoaded || loading) {
    return <WithdrawPageLoading />
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header user={user} />

        <main className="max-w-2xl mx-auto px-6 py-8">
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Withdrawal Initiated</h1>
            <p className="text-gray-400 mb-2">
              {formatUSD(parseFloat(amount))} is on its way to your bank account.
            </p>
            {withdrawalCalculation.creditToRepay > 0 && (
              <p className="text-sm text-amber-400 mb-2">
                Credit line reduced by {formatGRAIN(withdrawalCalculation.creditToRepay)} GRAIN
              </p>
            )}
            <p className="text-sm text-gray-500 mb-8">
              {withdrawMethod === 'ach' ? 'Expected arrival: 1-3 business days' : 'Expected arrival: Same or next business day'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/grain-vault/dashboard"
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => {
                  setSuccess(false)
                  setAmount('')
                  fetchData()
                }}
                className="px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all"
              >
                Make Another Withdrawal
              </button>
            </div>
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
          <h1 className="text-3xl font-bold text-white mb-2">Withdraw Funds</h1>
          <p className="text-gray-400 mb-4">
            {creditLineUsed > 0
              ? 'Your protected deposit is always available. Credit used will be repaid proportionally.'
              : 'Your cash is available anytime - no lock-ups, no restrictions'}
          </p>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
              <Shield className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-400 font-medium">Principal Protected</span>
            </div>
            {creditLineUsed > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Credit Line Active</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">Backed by Real Assets</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Three Layer Position Display */}
        <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-xl bg-white/5">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-green-500/20 via-emerald-500/10 to-transparent border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-400 font-medium">Your Position</span>
              </div>
              <div className="text-xs text-gray-500">
                GRAIN @ {formatUSD(grainPrice)}
              </div>
            </div>
          </div>

          {/* Three Layers */}
          <div className="p-6 space-y-4">
            {/* Layer 1: Protected Deposit */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-300">Protected Deposit</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 rounded-full">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-green-400">Always Available</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{formatUSD(protectedDeposit)}</p>
              <p className="text-xs text-gray-500 mt-1">Your principal - fully protected and withdrawable</p>
            </div>

            {/* Layer 2: Credit Line Used */}
            <div className={`p-4 rounded-xl border ${
              creditLineUsed > 0
                ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20'
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className={`w-4 h-4 ${creditLineUsed > 0 ? 'text-amber-400' : 'text-gray-500'}`} />
                  <span className={`text-sm ${creditLineUsed > 0 ? 'text-amber-300' : 'text-gray-400'}`}>
                    Credit Line Used
                  </span>
                </div>
                {creditLineUsed > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 rounded-full">
                    <Info className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-amber-400">Repay on Withdraw</span>
                  </div>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-2xl font-bold ${creditLineUsed > 0 ? 'text-white' : 'text-gray-600'}`}>
                  {formatGRAIN(creditLineUsed)} GRAIN
                </p>
                {creditLineUsed > 0 && (
                  <span className="text-sm text-gray-500">({formatUSD(creditValueUsed)})</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {creditLineUsed > 0
                  ? '0% interest - repaid proportionally when you withdraw'
                  : 'No credit used - withdraw your full deposit'}
              </p>
            </div>

            {/* Layer 3: Net Withdrawable Summary */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/5 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-300">Net Withdrawable</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{formatUSD(netWithdrawable)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {creditLineUsed > 0
                  ? 'Full deposit available - credit repaid proportionally from withdrawal'
                  : 'Full amount available for immediate withdrawal'}
              </p>
            </div>
          </div>
        </div>

        {/* Credit Line Info Banner (if credit is used) */}
        {creditLineUsed > 0 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-400 font-medium mb-1">Credit Line Repayment</p>
                <p className="text-sm text-gray-400">
                  You have {formatGRAIN(creditLineUsed)} GRAIN credit used. When you withdraw,
                  credit is repaid proportionally. For example, withdrawing 50% of your deposit
                  repays 50% of your credit used.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Balance State */}
        {protectedDeposit <= 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Funds Available</h3>
            <p className="text-gray-400 mb-6">
              Add funds to your account to get started.
            </p>
            <Link
              href="/grain-vault/deposit"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all"
            >
              Deposit Funds
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* Withdrawal Form */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-xl">
              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Amount to Withdraw
                </label>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: '25%', value: protectedDeposit * 0.25 },
                    { label: '50%', value: protectedDeposit * 0.5 },
                    { label: '75%', value: protectedDeposit * 0.75 },
                    { label: 'Max', value: protectedDeposit }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setAmount(preset.value.toFixed(2))}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        Math.abs(parseFloat(amount) - preset.value) < 0.01
                          ? 'bg-green-500/20 border-green-500/50 text-green-400'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {preset.label}
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
                    placeholder="0.00"
                    min="0"
                    max={protectedDeposit}
                    step="0.01"
                    className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-2xl font-semibold text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Maximum: {formatUSD(protectedDeposit)}
                </p>
              </div>

              {/* Withdrawal Impact Calculation */}
              {parseFloat(amount) > 0 && (
                <div className="mb-6 rounded-xl overflow-hidden border border-white/10">
                  {/* Header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/10 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-green-400">Withdrawal Summary</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 bg-white/5 space-y-3">
                    {/* Amount to Withdraw */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <ArrowDownRight className="w-4 h-4" />
                        Amount to Withdraw
                      </span>
                      <span className="text-white font-semibold">
                        {formatUSD(withdrawalCalculation.amountToWithdraw)}
                      </span>
                    </div>

                    {/* Credit Line to Repay (if applicable) */}
                    {creditLineUsed > 0 && (
                      <div className="flex items-center justify-between py-2 border-t border-white/10">
                        <span className="text-amber-400 flex items-center gap-2">
                          <Minus className="w-4 h-4" />
                          Credit Line to Repay
                        </span>
                        <div className="text-right">
                          <span className="text-amber-400 font-semibold">
                            {formatGRAIN(withdrawalCalculation.creditToRepay)} GRAIN
                          </span>
                          <span className="text-xs text-gray-500 block">
                            ({formatUSD(withdrawalCalculation.creditToRepayUsd)})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-white/10 pt-3 space-y-2">
                      {/* Remaining Protected Deposit */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-400" />
                          Remaining Protected Deposit
                        </span>
                        <span className="text-green-400 font-semibold">
                          {formatUSD(withdrawalCalculation.remainingDeposit)}
                        </span>
                      </div>

                      {/* Remaining Credit Line (if applicable) */}
                      {creditLineUsed > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-amber-400" />
                            Remaining Credit Used
                          </span>
                          <span className="text-amber-400 font-semibold">
                            {formatGRAIN(withdrawalCalculation.remainingCreditUsed)} GRAIN
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Transfer Method Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Transfer to Bank via
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {/* ACH */}
                  <button
                    onClick={() => setWithdrawMethod('ach')}
                    className={`p-4 rounded-xl border transition-all text-left ${
                      withdrawMethod === 'ach'
                        ? 'bg-green-500/10 border-green-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        withdrawMethod === 'ach' ? 'bg-green-500/20' : 'bg-purple-500/20'
                      }`}>
                        <Building2 className={`w-5 h-5 ${withdrawMethod === 'ach' ? 'text-green-400' : 'text-purple-400'}`} />
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        withdrawMethod === 'ach' ? 'border-green-500 bg-green-500' : 'border-gray-500'
                      }`}>
                        {withdrawMethod === 'ach' && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <p className="font-semibold text-white">ACH Transfer</p>
                    <p className="text-sm text-gray-400">1-3 business days</p>
                    <p className="text-xs text-green-400 mt-1">Free</p>
                  </button>

                  {/* Wire */}
                  <button
                    onClick={() => setWithdrawMethod('wire')}
                    className={`p-4 rounded-xl border transition-all text-left ${
                      withdrawMethod === 'wire'
                        ? 'bg-green-500/10 border-green-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        withdrawMethod === 'wire' ? 'bg-green-500/20' : 'bg-blue-500/20'
                      }`}>
                        <Banknote className={`w-5 h-5 ${withdrawMethod === 'wire' ? 'text-green-400' : 'text-blue-400'}`} />
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        withdrawMethod === 'wire' ? 'border-green-500 bg-green-500' : 'border-gray-500'
                      }`}>
                        {withdrawMethod === 'wire' && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <p className="font-semibold text-white">Wire Transfer</p>
                    <p className="text-sm text-gray-400">Same/next business day</p>
                    <p className="text-xs text-gray-500 mt-1">$25 fee</p>
                  </button>
                </div>
              </div>

              {/* Final Summary */}
              {parseFloat(amount) > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400">Withdrawal Amount</span>
                    <span className="text-white font-semibold">{formatUSD(parseFloat(amount))}</span>
                  </div>
                  {withdrawMethod === 'wire' && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400">Wire Fee</span>
                      <span className="text-white">-$25.00</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-gray-400">You'll Receive</span>
                    <span className="text-green-400 font-bold text-lg">
                      {formatUSD(parseFloat(amount) - (withdrawMethod === 'wire' ? 25 : 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleWithdraw}
                disabled={submitting || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > protectedDeposit}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Banknote className="w-5 h-5" />
                    Withdraw {amount ? formatUSD(parseFloat(amount)) : 'Funds'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            {/* Timing Info */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Estimated Arrival</p>
                  <p className="text-white font-medium">
                    {withdrawMethod === 'ach' ? '1-3 business days' : 'Same or next business day'}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// Header Component
function Header({ user }: { user: any }) {
  return (
    <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/grain-vault" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
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
