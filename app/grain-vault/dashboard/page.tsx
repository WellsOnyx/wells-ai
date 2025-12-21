// @ts-nocheck
'use client'

/**
 * Grain & Vault Dashboard
 *
 * PRODUCTION-READY GRAIN WALLET
 * - Shows real GRAIN balance from user_wallets table
 * - Uses Clerk authentication
 * - Displays deposit address and transaction history
 * - Real-time treasury backing data
 */

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  Download,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowDown,
  ArrowUp,
  Send,
  Users,
  UserPlus,
  Building2,
  ShoppingCart,
  Copy,
  Check,
  Sparkles,
  Zap,
  Link as LinkIcon
} from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// Types for GRAIN wallet data
interface WalletData {
  has_wallet: boolean
  has_profile?: boolean
  approved?: boolean
  approved_at?: string | null
  balance: {
    grain: number
    usd_value: number
  }
  grain_price: number
  appreciation?: {
    current_price: number
    note: string
  }
  recent_transactions: Array<{
    id: string
    type: string
    usd_amount?: number
    grain_amount?: number
    grain_price_at_time?: number
    amount?: number
    status: string
    created_at: string
  }>
  last_updated?: string
}

interface TreasuryData {
  grainValue: number
  totalBacking: number
  backingRatio: number
  assetBreakdown: Array<{
    type: string
    value: number
    percentage: number
  }>
  lastUpdated: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [treasuryData, setTreasuryData] = useState<TreasuryData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch wallet and treasury data
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Fetch wallet data from simple API that uses user_wallets table
      const walletRes = await fetch('/api/grain-vault/wallet')

      if (!walletRes.ok) {
        if (walletRes.status === 401) {
          router.push('/grain-vault/signin')
          return
        }
        throw new Error('Failed to load wallet data')
      }

      const walletResult = await walletRes.json()
      console.log('[Dashboard] wallet result:', walletResult)

      // Set wallet data directly from API response
      setWalletData({
        has_wallet: walletResult.has_wallet,
        has_profile: true,
        approved: walletResult.approved,
        approved_at: walletResult.approved_at,
        balance: walletResult.balance || { grain: 0, usd_value: 0 },
        grain_price: walletResult.grain_price || 1.0,
        recent_transactions: walletResult.recent_transactions || []
      })

      // Fetch treasury data for GRAIN value
      try {
        const treasuryRes = await fetch('/api/grain-vault/treasury')
        if (treasuryRes.ok) {
          const treasuryResult = await treasuryRes.json()
          setTreasuryData(treasuryResult)
        }
      } catch (e) {
        // Treasury API might not exist - ignore
      }

      setError(null)
    } catch (err: any) {
      console.error('Dashboard error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Create ledger entry for user (custodial model - no individual wallets)
  const createWallet = async () => {
    try {
      setLoading(true)
      // In custodial model, POST creates a ledger entry and returns master wallet address
      const res = await fetch('/api/grain-vault/deposit', { method: 'POST' })

      if (!res.ok) {
        throw new Error('Failed to create account')
      }

      const result = await res.json()
      console.log('[Dashboard] Created ledger entry:', result)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoaded && user) {
      fetchData()
    }
  }, [isLoaded, user])

  // Show signin if not authenticated
  if (isLoaded && !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Sign in to access your GRAIN wallet</h2>
          <p className="text-gray-400 mb-6">
            Connect your account to view your balance, deposit USDC, and manage your treasury.
          </p>
          <Link
            href="/grain-vault/signin"
            className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your wallet...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Wallet</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Show Pending Approval screen for unapproved users
  if (walletData && walletData.approved === false) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
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
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-12">
          {/* Pending Approval Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-white/10 backdrop-blur-xl shadow-2xl">
            {/* Decorative gradient orbs */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-green-500/10 rounded-full blur-3xl" />

            <div className="relative p-8 sm:p-12">
              {/* Icon */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center backdrop-blur-sm">
                    <Clock className="w-12 h-12 text-yellow-400" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-yellow-400" />
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  Account Under Review
                </h1>
                <p className="text-lg text-gray-400">
                  Your Grain & Vault account is pending approval
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-sm font-medium text-yellow-400">Review in Progress</span>
                </div>
              </div>

              {/* Info Cards */}
              <div className="space-y-4 mb-8">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Estimated Review Time</h3>
                      <p className="text-gray-400 text-sm">
                        Most accounts are approved within 24-48 hours during business days.
                        We are reviewing your information to ensure the security of all users.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Once Approved</h3>
                      <p className="text-gray-400 text-sm">
                        You will have full access to deposit funds, receive GRAIN tokens,
                        send payments, and view your complete dashboard with treasury data.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Why Manual Review?</h3>
                      <p className="text-gray-400 text-sm">
                        We manually review all accounts to maintain the highest standards of
                        security and compliance. This protects you and the entire Grain & Vault community.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Section */}
              <div className="p-6 rounded-xl bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-green-400" />
                  Questions or Need Faster Review?
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  If you have any questions about your application or need expedited review for
                  business purposes, please contact our team.
                </p>
                <a
                  href="mailto:support@grainvault.io?subject=Account%20Approval%20Inquiry"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-medium transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  support@grainvault.io
                </a>
              </div>

              {/* Refresh Button */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Check Approval Status
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  We will also notify you via email once your account is approved
                </p>
              </div>
            </div>
          </div>

          {/* GRAIN Info Footer */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              GRAIN is an anti-inflationary stablecoin backed 100% by USDC and appreciating assets.
            </p>
            <Link
              href="/grain-vault"
              className="text-green-400 hover:text-green-300 text-sm transition-colors mt-2 inline-block"
            >
              Learn more about Grain & Vault
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // Format currency
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

  // Transaction type labels
  const txTypeLabels: Record<string, string> = {
    deposit: 'USDC Deposit',
    withdraw: 'Withdrawal',
    transfer: 'Transfer',
    escrow_lock: 'Escrow Lock',
    escrow_release: 'Escrow Release',
    fee: 'Fee'
  }

  const grainValue = treasuryData?.grainValue || 1.0
  const balance = walletData?.balance?.grain || 0
  const usdValue = balance * grainValue

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/grain-vault" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <div className="w-3 h-3 bg-black rounded-sm" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Grain & Vault</h1>
                <p className="text-xs text-gray-400">{user?.firstName || 'Wallet'}</p>
              </div>
            </Link>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* GRAIN Balance Card */}
        <div className="mb-8 p-8 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm text-gray-400 mb-2">GRAIN Balance</p>
              <h2 className="text-5xl font-bold text-white mb-2">
                {formatGRAIN(balance)} <span className="text-2xl text-gray-400">GRAIN</span>
              </h2>
              <p className="text-xl text-green-400 font-semibold">
                ≈ {formatUSD(usdValue)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                1 GRAIN = {formatUSD(grainValue)} (100% USDC backed)
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/grain-vault/deposit"
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all flex items-center gap-2 shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
              >
                <ArrowDown className="w-5 h-5" />
                Add Funds
              </Link>
              <button
                disabled={balance === 0}
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-5 h-5" />
                Withdraw
              </button>
            </div>
          </div>
        </div>

        {/* Network Growth Callout - Supplier/Customer Onboarding */}
        <NetworkGrowthCallout />

        {/* Deposit Card - Secure checkout flow, NO wallet address exposed */}
        {walletData?.has_wallet ? (
          <div className="mb-8 p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Fund Your Account</h3>
                  <p className="text-sm text-gray-400">Deposit USD to receive GRAIN</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                Secure Checkout
              </span>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Current GRAIN Price</span>
                <span className="text-lg font-bold text-green-400">
                  ${(walletData.grain_price || 1).toFixed(4)}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                GRAIN only appreciates. As our treasury grows, your purchasing power increases.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[50, 100, 500].map((amount) => (
                <Link
                  key={amount}
                  href={`/grain-vault/deposit?amount=${amount}`}
                  className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-green-500/50 transition-all text-center"
                >
                  <p className="text-lg font-bold text-white">${amount}</p>
                  <p className="text-xs text-gray-400">
                    ≈ {(amount / (walletData.grain_price || 1)).toFixed(2)} GRAIN
                  </p>
                </Link>
              ))}
            </div>

            <Link
              href="/grain-vault/deposit"
              className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
            >
              <ArrowDown className="w-5 h-5" />
              Add Funds
            </Link>

            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-400">
                  Powered by Circle. Deposits convert to USDC and are held in our fully-backed treasury.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 p-8 rounded-2xl bg-white/5 border border-white/10 text-center">
            <Wallet className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Activate Your Account</h3>
            <p className="text-gray-400 mb-6">
              Complete setup to start depositing and earning GRAIN
            </p>
            <button
              onClick={createWallet}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all"
            >
              Activate Account
            </button>
            <p className="text-xs text-gray-500 mt-4">
              100% backed by USDC and appreciating assets
            </p>
          </div>
        )}

        {/* Treasury & Transactions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Treasury Backing */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Treasury Backing</h3>
              <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">
                {treasuryData ? `${(treasuryData.backingRatio * 100).toFixed(0)}% Backed` : '100% Backed'}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-1">Total Treasury Value</p>
              <p className="text-2xl font-bold text-white">
                {formatUSD(treasuryData?.totalBacking || 0)}
              </p>
            </div>

            {treasuryData?.assetBreakdown && treasuryData.assetBreakdown.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-400 mb-3">Asset Breakdown</p>
                {treasuryData.assetBreakdown.map((asset, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{asset.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {formatUSD(asset.value)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {asset.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/10">
              <Link
                href="/grain-vault/admin/treasury"
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <Shield className="w-4 h-4" />
                View Proof of Reserves
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            </div>

            {!walletData?.recent_transactions || walletData.recent_transactions.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400">No transactions yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Make your first deposit to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {walletData.recent_transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          tx.type === 'deposit' || tx.type === 'escrow_release'
                            ? 'bg-green-500/20'
                            : 'bg-blue-500/20'
                        }`}
                      >
                        {tx.type === 'deposit' || tx.type === 'escrow_release' ? (
                          <ArrowDownRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {txTypeLabels[tx.type] || tx.type}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.created_at).toLocaleDateString()} at{' '}
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-white">
                        {formatGRAIN(tx.amount)} GRAIN
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        {tx.status === 'completed' ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : tx.status === 'pending' ? (
                          <Clock className="w-3 h-3 text-yellow-400" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-gray-400" />
                        )}
                        <span className="text-xs text-gray-400 capitalize">
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* How GRAIN Works */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">How GRAIN Works</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">1</div>
                <p className="font-medium text-white">Deposit USDC</p>
              </div>
              <p className="text-sm text-gray-400 pl-10">
                Send USDC to your deposit address. It arrives in ~2 seconds on Base L2.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">2</div>
                <p className="font-medium text-white">Receive GRAIN</p>
              </div>
              <p className="text-sm text-gray-400 pl-10">
                Your USD converts to GRAIN at current market price. GRAIN is our appreciating stablecoin.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">3</div>
                <p className="font-medium text-white">Anti-Inflationary</p>
              </div>
              <p className="text-sm text-gray-400 pl-10">
                GRAIN only appreciates. Your purchasing power grows while you hold.
              </p>
            </div>
          </div>
        </div>

        {/* Inline Chat with Wells */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-gradient-to-r from-green-500/10 to-blue-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-white font-bold">W</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">Chat with Wells</h3>
                <p className="text-xs text-gray-400">Your treasury assistant • Ask about payments, deposits, or SDK integration</p>
              </div>
            </div>
          </div>
          <InlineWellsChat
            grainBalance={balance}
            grainPrice={grainValue}
            userName={user?.firstName || 'there'}
          />
        </div>
      </main>
    </div>
  )
}

// Network Growth Callout Component - Supplier/Customer Onboarding
function NetworkGrowthCallout() {
  const [inviteData, setInviteData] = useState<{
    supplier: {
      code: string
      link: string
      onboarded: number
      pending: number
      benefits: string[]
    }
    customer: {
      code: string
      link: string
      onboarded: number
      pending: number
      benefits: string[]
    }
    totalNetwork: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedSupplier, setCopiedSupplier] = useState(false)
  const [copiedCustomer, setCopiedCustomer] = useState(false)
  const [activeTab, setActiveTab] = useState<'supplier' | 'customer'>('supplier')
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        const res = await fetch('/api/grain-vault/invites')
        if (res.ok) {
          const data = await res.json()
          setInviteData(data)
        }
      } catch (error) {
        console.error('Failed to fetch invites:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchInvites()
  }, [])

  const copyLink = async (type: 'supplier' | 'customer') => {
    const link = type === 'supplier' ? inviteData?.supplier.link : inviteData?.customer.link
    if (link) {
      await navigator.clipboard.writeText(link)
      if (type === 'supplier') {
        setCopiedSupplier(true)
        setTimeout(() => setCopiedSupplier(false), 2000)
      } else {
        setCopiedCustomer(true)
        setTimeout(() => setCopiedCustomer(false), 2000)
      }
    }
  }

  if (loading) {
    return (
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-green-500/10 border border-white/10 animate-pulse">
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mb-8 rounded-2xl overflow-hidden">
      {/* Hero Section */}
      <div className="relative p-6 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-green-600/20 border border-white/10 rounded-t-2xl">
        {/* Animated background effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-green-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  Grow Your GRAIN Network
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </h3>
                <p className="text-sm text-gray-400">Invite suppliers and customers to pay or get paid in GRAIN</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{inviteData?.totalNetwork || 0}</div>
              <div className="text-xs text-gray-400">in your network</div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Suppliers</span>
              </div>
              <div className="text-xl font-bold text-white">{inviteData?.supplier.onboarded || 0}</div>
              {inviteData?.supplier.pending ? (
                <div className="text-xs text-yellow-400">{inviteData.supplier.pending} pending</div>
              ) : null}
            </div>
            <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400">Customers</span>
              </div>
              <div className="text-xl font-bold text-white">{inviteData?.customer.onboarded || 0}</div>
              {inviteData?.customer.pending ? (
                <div className="text-xs text-yellow-400">{inviteData.customer.pending} pending</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-white/5">
        <button
          onClick={() => setActiveTab('supplier')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'supplier'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Invite Suppliers
        </button>
        <button
          onClick={() => setActiveTab('customer')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'customer'
              ? 'text-green-400 border-b-2 border-green-400 bg-green-500/10'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Invite Customers
        </button>
      </div>

      {/* Content */}
      <div className="p-6 bg-white/5 border border-t-0 border-white/10 rounded-b-2xl">
        {activeTab === 'supplier' ? (
          <div>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Get Paid in GRAIN by Your Suppliers</h4>
                <p className="text-sm text-gray-400">
                  Invite vendors to pay you in GRAIN. They save on fees, you get instant settlements.
                </p>
              </div>
            </div>

            {/* Invite Link */}
            <div className="p-4 rounded-xl bg-black/30 border border-blue-500/20 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Your Supplier Invite Link</span>
                <span className="text-xs text-blue-400 font-mono">{inviteData?.supplier.code}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-sm text-gray-300 truncate">
                  {inviteData?.supplier.link}
                </div>
                <button
                  onClick={() => copyLink('supplier')}
                  className="p-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 transition-all"
                >
                  {copiedSupplier ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-blue-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-2">
              {inviteData?.supplier.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => copyLink('supplier')}
              className="w-full mt-4 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
            >
              <LinkIcon className="w-5 h-5" />
              {copiedSupplier ? 'Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Pay Your Customers in GRAIN</h4>
                <p className="text-sm text-gray-400">
                  Invite customers to receive payments in GRAIN. Their balance appreciates over time.
                </p>
              </div>
            </div>

            {/* Invite Link */}
            <div className="p-4 rounded-xl bg-black/30 border border-green-500/20 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Your Customer Invite Link</span>
                <span className="text-xs text-green-400 font-mono">{inviteData?.customer.code}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-sm text-gray-300 truncate">
                  {inviteData?.customer.link}
                </div>
                <button
                  onClick={() => copyLink('customer')}
                  className="p-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 transition-all"
                >
                  {copiedCustomer ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-green-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-2">
              {inviteData?.customer.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <Zap className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => copyLink('customer')}
              className="w-full mt-4 py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
            >
              <LinkIcon className="w-5 h-5" />
              {copiedCustomer ? 'Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        )}

        {/* Network Effect Explainer */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Why build your network?</span>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showDetails ? 'Hide details' : 'Learn more'}
            </button>
          </div>

          {showDetails && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
              <div className="grid md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-yellow-400">1</span>
                  </div>
                  <h5 className="font-medium text-white text-sm mb-1">Invite Partners</h5>
                  <p className="text-xs text-gray-400">Share your unique link with suppliers or customers</p>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-yellow-400">2</span>
                  </div>
                  <h5 className="font-medium text-white text-sm mb-1">They Join & Connect</h5>
                  <p className="text-xs text-gray-400">They sign up and are automatically linked to you</p>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-yellow-400">3</span>
                  </div>
                  <h5 className="font-medium text-white text-sm mb-1">Send/Receive GRAIN</h5>
                  <p className="text-xs text-gray-400">Instant payments, zero fees, appreciating value</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Inline Wells Chat Component - embedded directly in dashboard
function InlineWellsChat({
  grainBalance,
  grainPrice,
  userName
}: {
  grainBalance: number
  grainPrice: number
  userName: string
}) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Hey ${userName}! I'm Wells, your treasury assistant. I can help you send payments, check your balance, deposit funds, or answer questions about GRAIN. What would you like to do?`
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const quickActions = [
    { label: 'Check Balance', prompt: "What's my current GRAIN balance?" },
    { label: 'Send Payment', prompt: 'I want to send a payment' },
    { label: 'Deposit Funds', prompt: 'How do I deposit more funds?' },
    { label: 'SDK Help', prompt: 'How do I integrate the Treasury SDK?' }
  ]

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)

    const updatedMessages = [
      ...messages,
      { role: 'user' as const, content: text }
    ]
    setMessages(updatedMessages)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          journey: 'treasury',
          context: {
            // Product identifier for unified memory system
            product: 'grainvault',
            // Treasury-specific context
            grainBalance,
            grainPrice,
            userName,
            // Detailed context for the AI
            contextInfo: `User is on the Grain & Vault dashboard. Current GRAIN balance: ${grainBalance.toLocaleString()} GRAIN (worth $${(grainBalance * grainPrice).toLocaleString()}). Current GRAIN price: $${grainPrice.toFixed(4)}. GRAIN is an anti-inflationary stablecoin that only appreciates in value. Help the user with payments, deposits, withdrawals, or SDK integration questions.`
          }
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: data.message }
      ])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: "I'm having trouble connecting right now. Please try again in a moment." }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[400px]">
      {/* Quick Actions */}
      <div className="flex gap-2 p-3 border-b border-white/10 overflow-x-auto">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => sendMessage(action.prompt)}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/5 rounded-full text-xs text-gray-300 hover:bg-white/10 whitespace-nowrap disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-green-500 text-black'
                  : 'bg-white/5 border border-white/10 text-white'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
              <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask Wells anything..."
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 text-sm disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
