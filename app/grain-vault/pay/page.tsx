'use client'

/**
 * Grain & Vault - Pay Page
 *
 * Spend GRAIN from your credit line to pay others in the network.
 *
 * Spending Priority:
 * 1. First spends from Appreciation (bonus GRAIN)
 * 2. Then spends from Credit Line
 * 3. Protected deposit stays unchanged
 *
 * 1% flat fee for payments (vs 2.9% for cards)
 */

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2,
  Sparkles,
  CreditCard,
  Wallet,
  User,
  Mail,
  Hash,
  Zap,
  TrendingUp,
  Info,
  Receipt,
  ArrowUpRight
} from 'lucide-react'

// Types
interface CreditLinePosition {
  protectedDeposit: number
  creditLineLimit: number
  creditLineUsed: number
  creditLineAvailable: number
  appreciationGrain: number
  grainPrice: number
  currentValue: number
  totalGrain: number
  status: string
  summary: {
    protectedDepositFormatted: string
    creditLineAvailableFormatted: string
    creditLineUsedFormatted: string
    appreciationFormatted: string
    currentValueFormatted: string
    grainPriceFormatted: string
  }
}

interface SpendBreakdown {
  total: number
  fromAppreciation: number
  fromCreditLine: number
  fee: number
  feePercent: number
}

// Loading fallback
function PayPageLoading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading payment page...</p>
      </div>
    </div>
  )
}

export default function PayPage() {
  return (
    <Suspense fallback={<PayPageLoading />}>
      <PayPageContent />
    </Suspense>
  )
}

function PayPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded, isSignedIn } = useUser()

  // State
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ message: string; txId?: string } | null>(null)

  // Data
  const [position, setPosition] = useState<CreditLinePosition | null>(null)

  // Form
  const [recipient, setRecipient] = useState(searchParams.get('to') || '')
  const [amount, setAmount] = useState(searchParams.get('amount') || '')
  const [description, setDescription] = useState(searchParams.get('memo') || '')
  const [recipientType, setRecipientType] = useState<'email' | 'wallet' | 'grainId'>('email')

  // Calculate spend breakdown
  const spendBreakdown = useMemo<SpendBreakdown | null>(() => {
    const numAmount = parseFloat(amount) || 0
    if (numAmount <= 0 || !position) return null

    const availableAppreciation = position.appreciationGrain
    const availableCredit = position.creditLineAvailable
    const totalAvailable = availableAppreciation + availableCredit

    if (numAmount > totalAvailable) return null

    // Spend from appreciation first
    let remaining = numAmount
    let fromAppreciation = 0
    let fromCreditLine = 0

    if (remaining > 0 && availableAppreciation > 0) {
      fromAppreciation = Math.min(remaining, availableAppreciation)
      remaining -= fromAppreciation
    }

    if (remaining > 0) {
      fromCreditLine = remaining
    }

    return {
      total: numAmount,
      fromAppreciation,
      fromCreditLine,
      fee: 0, // 0% fee for network payments
      feePercent: 0
    }
  }, [amount, position])

  // Detect recipient type
  useEffect(() => {
    if (recipient.includes('@')) {
      setRecipientType('email')
    } else if (recipient.startsWith('0x') || recipient.length === 42) {
      setRecipientType('wallet')
    } else if (recipient.startsWith('GRAIN-') || recipient.match(/^[A-Z0-9]{8,}$/)) {
      setRecipientType('grainId')
    }
  }, [recipient])

  // Fetch credit line position
  const fetchPosition = useCallback(async () => {
    if (!isSignedIn || !user) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/grain/credit-line?userId=${user.id}`)

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/grain-vault/signin')
          return
        }
        throw new Error('Failed to load position data')
      }

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load position')
      }

      if (!data.position) {
        // No position yet - redirect to deposit
        router.push('/grain-vault/deposit')
        return
      }

      setPosition(data.position)
    } catch (err: any) {
      console.error('Pay page error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, user, router])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchPosition()
    } else if (isLoaded && !isSignedIn) {
      router.push('/grain-vault/signin')
    }
  }, [isLoaded, isSignedIn, fetchPosition, router])

  // Send payment
  const handleSendPayment = async () => {
    if (!user || !spendBreakdown || !recipient) return

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/grain/credit-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'spend',
          userId: user.id,
          grainAmount: spendBreakdown.total,
          counterpartyId: recipient,
          description: description || `Payment to ${recipient}`
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Payment failed')
      }

      setSuccess({
        message: `Successfully sent ${formatGRAIN(spendBreakdown.total)} GRAIN to ${recipient}`,
        txId: data.transaction?.id
      })

      // Refresh position
      await fetchPosition()

      // Clear form
      setAmount('')
      setDescription('')

    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Format helpers
  const formatUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val)
  }

  const formatGRAIN = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(val)
  }

  // Check if can send
  const canSend = useMemo(() => {
    return (
      recipient.trim().length > 0 &&
      spendBreakdown !== null &&
      spendBreakdown.total > 0 &&
      !submitting
    )
  }, [recipient, spendBreakdown, submitting])

  const totalAvailable = position
    ? position.appreciationGrain + position.creditLineAvailable
    : 0

  // Loading state
  if (!isLoaded || loading) {
    return <PayPageLoading />
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
          <div className="mb-8 p-8 bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 rounded-3xl text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Payment Sent!
            </h2>
            <p className="text-gray-400 mb-6">
              {success.message}
            </p>
            {success.txId && (
              <p className="text-xs text-gray-500 font-mono mb-6">
                Transaction ID: {success.txId}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setSuccess(null)}
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
              >
                Send Another
              </button>
              <Link
                href="/grain-vault/dashboard"
                className="px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all flex items-center gap-2"
              >
                View Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
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
          <h1 className="text-3xl font-bold text-white mb-2">Send Payment</h1>
          <p className="text-gray-400">Pay anyone in the GRAIN network instantly with 1% flat fee</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-sm text-red-400/70 hover:text-red-400 mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Current Position Card */}
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-green-400" />
            <span className="text-sm text-gray-400 font-medium">Available to Spend</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Appreciation */}
            <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-purple-400 font-medium">Appreciation</span>
              </div>
              <p className="text-xl font-bold text-white">
                {formatGRAIN(position?.appreciationGrain || 0)} <span className="text-sm text-gray-400">GRAIN</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">Bonus GRAIN (spent first)</p>
            </div>

            {/* Credit Line */}
            <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">Credit Line</span>
              </div>
              <p className="text-xl font-bold text-white">
                {formatGRAIN(position?.creditLineAvailable || 0)} <span className="text-sm text-gray-400">GRAIN</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">0% interest</p>
            </div>
          </div>

          {/* Total Available */}
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-gray-400">Total Available</span>
            <span className="text-2xl font-bold text-green-400">
              {formatGRAIN(totalAvailable)} <span className="text-sm text-gray-400">GRAIN</span>
            </span>
          </div>

          {/* Protected Deposit Notice */}
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <Shield className="w-3.5 h-3.5 text-green-400" />
            <span>
              Protected deposit of {position?.summary.protectedDepositFormatted || '$0'} remains untouched
            </span>
          </div>
        </div>

        {/* Payment Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl mb-6">
          {/* Recipient Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Recipient
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                {recipientType === 'email' && <Mail className="w-5 h-5" />}
                {recipientType === 'wallet' && <Wallet className="w-5 h-5" />}
                {recipientType === 'grainId' && <Hash className="w-5 h-5" />}
              </div>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Email, wallet address, or GRAIN ID"
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
              />
            </div>
            <div className="mt-2 flex items-center gap-4">
              <button
                onClick={() => setRecipientType('email')}
                className={`text-xs px-3 py-1 rounded-full transition-all ${
                  recipientType === 'email'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setRecipientType('wallet')}
                className={`text-xs px-3 py-1 rounded-full transition-all ${
                  recipientType === 'wallet'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Wallet
              </button>
              <button
                onClick={() => setRecipientType('grainId')}
                className={`text-xs px-3 py-1 rounded-full transition-all ${
                  recipientType === 'grainId'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                GRAIN ID
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Amount (GRAIN)
            </label>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[100, 500, 1000, 5000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  disabled={preset > totalAvailable}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    amount === preset.toString()
                      ? 'bg-green-500/20 border-green-500/50 text-green-400'
                      : preset > totalAvailable
                        ? 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                max={totalAvailable}
                step="0.01"
                className="w-full pr-20 pl-4 py-4 bg-white/5 border border-white/10 rounded-xl text-2xl font-semibold text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                GRAIN
              </span>
            </div>

            {/* Max Button */}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                ~{formatUSD((parseFloat(amount) || 0) * (position?.grainPrice || 1))} USD
              </p>
              <button
                onClick={() => setAmount(totalAvailable.toString())}
                className="text-xs text-green-400 hover:text-green-300 font-medium"
              >
                Use Max ({formatGRAIN(totalAvailable)})
              </button>
            </div>
          </div>

          {/* Description Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Memo (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this payment for?"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
            />
          </div>
        </div>

        {/* Payment Preview */}
        {spendBreakdown && (
          <div className="mb-6 rounded-2xl overflow-hidden border border-green-500/20 backdrop-blur-xl">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-green-500/20 to-emerald-500/10">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-400" />
                <span className="font-medium text-green-400">Payment Preview</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 bg-white/5">
              {/* Amount */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <span className="text-gray-400">Amount</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white">
                    {formatGRAIN(spendBreakdown.total)} GRAIN
                  </span>
                  <p className="text-sm text-gray-500">
                    ~{formatUSD(spendBreakdown.total * (position?.grainPrice || 1))}
                  </p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-3 mb-4 pb-4 border-b border-white/10">
                {spendBreakdown.fromAppreciation > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-400">From Appreciation</span>
                    </div>
                    <span className="text-purple-400 font-medium">
                      {formatGRAIN(spendBreakdown.fromAppreciation)} GRAIN
                    </span>
                  </div>
                )}

                {spendBreakdown.fromCreditLine > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-400">From Credit Line</span>
                    </div>
                    <span className="text-blue-400 font-medium">
                      {formatGRAIN(spendBreakdown.fromCreditLine)} GRAIN
                    </span>
                  </div>
                )}
              </div>

              {/* Fee */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-400" />
                  <span className="text-gray-400">Network Fee</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-bold">$0</span>
                  <span className="text-xs text-green-400/70 px-2 py-0.5 bg-green-500/10 rounded-full">
                    0%
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-green-500/10 border-t border-green-500/20">
              <div className="flex items-center gap-2 text-xs text-green-400/80">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>0% fee for all payments within the GRAIN network</span>
              </div>
            </div>
          </div>
        )}

        {/* Insufficient Balance Warning */}
        {amount && parseFloat(amount) > totalAvailable && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Insufficient Balance</p>
              <p className="text-sm text-red-400/70 mt-1">
                You have {formatGRAIN(totalAvailable)} GRAIN available.
                <Link href="/grain-vault/deposit" className="underline ml-1">Add funds</Link>
              </p>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSendPayment}
          disabled={!canSend}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-green-500/20"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending Payment...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send {amount ? `${formatGRAIN(parseFloat(amount))} GRAIN` : 'Payment'}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {/* Info Card */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-400 font-medium mb-1">How Spending Works</p>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>1. Appreciation (bonus GRAIN) is spent first</li>
                <li>2. Then your credit line is used</li>
                <li>3. Your protected deposit stays untouched</li>
                <li>4. All network payments are instant with 1% flat fee</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/grain-vault/deposit"
            className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-white">Add Funds</p>
              <p className="text-xs text-gray-500">Deposit more</p>
            </div>
          </Link>
          <Link
            href="/grain-vault/dashboard"
            className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-white">Dashboard</p>
              <p className="text-xs text-gray-500">View activity</p>
            </div>
          </Link>
        </div>
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
            <Link
              href="/grain-vault/deposit"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Deposit
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
