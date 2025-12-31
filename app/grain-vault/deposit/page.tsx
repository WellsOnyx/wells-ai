'use client'

/**
 * Grain & Vault - Deposit Page
 *
 * UX PRINCIPLES:
 * 1. TRUST FIRST - Show that deposits are protected
 * 2. CLARITY - Simple flow: Deposit X -> Your account grows
 * 3. SIMPLICITY - Hide internal mechanics (GRAIN conversion, treasury, etc.)
 * 4. PREMIUM FEEL - Like a wealth management platform, not crypto
 *
 * What users see:
 * - "You're depositing $X"
 * - "Your protected amount will be $X"
 * - "Your account value may grow over time"
 *
 * What we DON'T show:
 * - GRAIN price oracle mechanics
 * - Treasury backing ratios
 * - Token conversion formulas
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
  Copy,
  Building2,
  RefreshCw,
  ExternalLink
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

interface BankInstructions {
  method: 'wire' | 'ach'
  bankName: string
  routingNumber: string
  accountNumber: string  // Virtual Account Number - unique per customer
  accountName: string
  reference: string
  swiftCode?: string     // For international wire
}

interface DepositSession {
  sessionId: string
  bankInstructions: BankInstructions
  estimatedCrediting: string
}

type DepositMethod = 'ach' | 'wire'

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

  // Data
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [priceData, setPriceData] = useState<PriceData | null>(null)
  const [depositSession, setDepositSession] = useState<DepositSession | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Form
  const initialAmount = searchParams.get('amount') || ''
  const [amount, setAmount] = useState<string>(initialAmount)
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('ach')

  // Calculate GRAIN to receive based on oracle price
  const grainToReceive = useMemo(() => {
    const numAmount = parseFloat(amount) || 0
    const price = priceData?.grain?.price_usd || walletData?.grain_price || 1
    return numAmount / price
  }, [amount, priceData, walletData])

  const currentPrice = priceData?.grain?.price_usd || walletData?.grain_price || 1

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

  // Get bank instructions for deposit
  const getDepositInstructions = async () => {
    const numAmount = parseFloat(amount)

    if (!numAmount || numAmount < 100) {
      setError('Minimum deposit is $100 for ACH/wire transfers')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/grain-vault/deposit/bank-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          method: depositMethod
        })
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to get deposit instructions')
      }

      setDepositSession(result)

    } catch (err: any) {
      console.error('Deposit error:', err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Copy to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
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

  // Show bank instructions
  if (depositSession) {
    const { bankInstructions } = depositSession
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
          <div className="mb-8 p-6 bg-green-500/10 border border-green-500/20 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Deposit Instructions Ready
                </h2>
                <p className="text-gray-400">
                  Use the bank details below to initiate your {depositMethod.toUpperCase()} transfer.
                  Your GRAIN will be credited upon receipt.
                </p>
              </div>
            </div>
          </div>

          {/* Deposit Summary - User Friendly */}
          <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400">Your Deposit</span>
              <span className="text-xl font-bold text-white">{formatUSD(parseFloat(amount))}</span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-gray-400">Protected Amount</span>
              </div>
              <span className="text-green-400 font-bold">{formatUSD(parseFloat(amount))}</span>
            </div>
          </div>

          {/* Bank Instructions Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {bankInstructions.method === 'wire' ? 'Wire Transfer' : 'ACH Transfer'} Details
                </h3>
                <p className="text-sm text-gray-400">Send funds to this account</p>
              </div>
            </div>

            <div className="space-y-4">
              <InstructionRow
                label="Bank Name"
                value={bankInstructions.bankName}
                onCopy={() => copyToClipboard(bankInstructions.bankName, 'bank')}
                copied={copied === 'bank'}
              />
              <InstructionRow
                label="Routing Number"
                value={bankInstructions.routingNumber}
                onCopy={() => copyToClipboard(bankInstructions.routingNumber, 'routing')}
                copied={copied === 'routing'}
              />
              <InstructionRow
                label="Account Number"
                value={bankInstructions.accountNumber}
                onCopy={() => copyToClipboard(bankInstructions.accountNumber, 'account')}
                copied={copied === 'account'}
                highlight
              />
              <InstructionRow
                label="Account Name"
                value={bankInstructions.accountName}
                onCopy={() => copyToClipboard(bankInstructions.accountName, 'name')}
                copied={copied === 'name'}
              />
              {bankInstructions.swiftCode && (
                <InstructionRow
                  label="SWIFT Code"
                  value={bankInstructions.swiftCode}
                  onCopy={() => copyToClipboard(bankInstructions.swiftCode!, 'swift')}
                  copied={copied === 'swift'}
                />
              )}
              <InstructionRow
                label="Reference/Memo"
                value={bankInstructions.reference}
                onCopy={() => copyToClipboard(bankInstructions.reference, 'reference')}
                copied={copied === 'reference'}
                highlight
              />
            </div>
          </div>

          {/* Important Notes */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-400 font-medium mb-2">Important</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>Include the reference code in your transfer memo</li>
                  <li>ACH transfers typically arrive in 1-3 business days</li>
                  <li>Wire transfers typically arrive same day or next business day</li>
                  <li>Your account will be credited once funds are received</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Timing Info */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-400">Estimated Credit Time</p>
                <p className="text-white font-medium">{depositSession.estimatedCrediting}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href="/grain-vault/dashboard"
              className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all text-center"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={() => {
                setDepositSession(null)
                setAmount('')
              }}
              className="flex-1 px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              New Deposit
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

        {/* Page Title with Value Messaging */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Add Funds</h1>
          <p className="text-gray-400 mb-4">Deposit securely - your money is protected and grows with the ecosystem</p>

          {/* Trust Badges */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
              <Shield className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-400 font-medium">Principal Protected</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">Value Appreciates</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 rounded-full border border-purple-500/20">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs text-purple-400 font-medium">Access Anytime</span>
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

        {/* Current Account Summary - User-Friendly */}
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Your Account</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Current Value</p>
              <h3 className="text-3xl font-bold text-white">
                {formatUSD(walletData?.balance?.usd_value || 0)}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Protected and accessible anytime
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400 mb-1">Account Status</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-400 font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Message */}
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-400 font-medium mb-1">Your Deposit is Protected</p>
              <p className="text-sm text-gray-400">
                Every dollar you deposit is fully backed and protected. Your funds are always
                accessible, and your account value may grow over time as you participate in the ecosystem.
              </p>
            </div>
          </div>
        </div>

        {/* Deposit Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Amount to Deposit (USD)
            </label>

            {/* Preset Amounts - Enterprise focused */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[1000, 5000, 10000, 25000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  className={`p-3 rounded-lg border text-center transition-all ${
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
                className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-2xl font-semibold text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">Minimum deposit: $100</p>
          </div>

          {/* Deposit Preview - Value-Focused */}
          {parseFloat(amount) >= 100 && (
            <div className="mb-6 rounded-xl overflow-hidden border border-green-500/20">
              {/* Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/10">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Your Investment Summary</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 bg-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400">Cash Available</span>
                  <span className="text-2xl font-bold text-white">
                    {formatUSD(parseFloat(amount))}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span className="text-gray-400">Protected Amount</span>
                  </div>
                  <span className="text-green-400 font-bold">
                    {formatUSD(parseFloat(amount))}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-400">Value Growth</span>
                  </div>
                  <span className="text-purple-400 font-medium">
                    Grows with ecosystem
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 bg-green-500/10 border-t border-green-500/20">
                <div className="flex items-center gap-2 text-xs text-green-400/80">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Full deposit protected. Withdraw anytime. Value appreciates over time.</span>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Method Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Transfer Method
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* ACH */}
              <button
                onClick={() => setDepositMethod('ach')}
                className={`p-4 rounded-xl border transition-all text-left ${
                  depositMethod === 'ach'
                    ? 'bg-green-500/10 border-green-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    depositMethod === 'ach' ? 'bg-green-500/20' : 'bg-purple-500/20'
                  }`}>
                    <Landmark className={`w-5 h-5 ${depositMethod === 'ach' ? 'text-green-400' : 'text-purple-400'}`} />
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    depositMethod === 'ach' ? 'border-green-500 bg-green-500' : 'border-gray-500'
                  }`}>
                    {depositMethod === 'ach' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <p className="font-semibold text-white">ACH Transfer</p>
                <p className="text-sm text-gray-400">1-3 business days</p>
                <p className="text-xs text-gray-500 mt-1">No fees</p>
              </button>

              {/* Wire */}
              <button
                onClick={() => setDepositMethod('wire')}
                className={`p-4 rounded-xl border transition-all text-left ${
                  depositMethod === 'wire'
                    ? 'bg-green-500/10 border-green-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    depositMethod === 'wire' ? 'bg-green-500/20' : 'bg-blue-500/20'
                  }`}>
                    <Building2 className={`w-5 h-5 ${depositMethod === 'wire' ? 'text-green-400' : 'text-blue-400'}`} />
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    depositMethod === 'wire' ? 'border-green-500 bg-green-500' : 'border-gray-500'
                  }`}>
                    {depositMethod === 'wire' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <p className="font-semibold text-white">Wire Transfer</p>
                <p className="text-sm text-gray-400">Same/next business day</p>
                <p className="text-xs text-gray-500 mt-1">Bank fees may apply</p>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={getDepositInstructions}
            disabled={submitting || !amount || parseFloat(amount) < 100}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Getting Instructions...
              </>
            ) : (
              <>
                <Landmark className="w-5 h-5" />
                Get Deposit Instructions
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Enterprise Features */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            Enterprise Features
          </h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="font-medium text-white mb-1">ERP Integration</p>
              <p className="text-sm text-gray-400">
                Connect SAP, NetSuite, QuickBooks for automated account sync
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="font-medium text-white mb-1">Virtual Account Numbers</p>
              <p className="text-sm text-gray-400">
                Unique account number for auto-attribution of deposits
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="font-medium text-white mb-1">No Limits</p>
              <p className="text-sm text-gray-400">
                Deposit any amount. Wire unlimited. ACH up to $1M/day.
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="font-medium text-white mb-1">Treasury Reporting</p>
              <p className="text-sm text-gray-400">
                Real-time balance tracking and audit-ready reports
              </p>
            </div>
          </div>
        </div>

        {/* Security Info */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-400 font-medium mb-1">Bank-Grade Security</p>
              <p className="text-sm text-gray-400">
                Your deposits are held securely by our regulated banking partners with
                industry-leading security. Every dollar is protected and accessible when you need it.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// Instruction Row Component
function InstructionRow({
  label,
  value,
  onCopy,
  copied,
  highlight = false
}: {
  label: string
  value: string
  onCopy: () => void
  copied: boolean
  highlight?: boolean
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`font-mono ${highlight ? 'text-green-400 font-bold' : 'text-white'}`}>
            {value}
          </p>
        </div>
        <button
          onClick={onCopy}
          className={`p-2 rounded-lg transition-colors ${
            copied ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400 hover:text-white'
          }`}
        >
          {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
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
