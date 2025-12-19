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

import { useEffect, useState } from 'react'
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
  Copy,
  Check,
  QrCode,
  ArrowDown,
  ArrowUp
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
  wallet?: {
    address: string
    network: string
  }
  balance: {
    grain: number
    usd_value: number
  }
  recent_transactions: Array<{
    id: string
    type: string
    amount: number
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
  const [copied, setCopied] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)

  // Fetch wallet and treasury data
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Fetch wallet data (uses Clerk auth via API)
      const walletRes = await fetch('/api/grain-vault/deposit')

      if (!walletRes.ok) {
        if (walletRes.status === 401) {
          router.push('/grain-vault/signin')
          return
        }
        throw new Error('Failed to load wallet data')
      }

      const walletResult = await walletRes.json()
      setWalletData(walletResult)

      // Fetch treasury data for GRAIN value
      const treasuryRes = await fetch('/api/grain-vault/treasury')
      if (treasuryRes.ok) {
        const treasuryResult = await treasuryRes.json()
        setTreasuryData(treasuryResult)
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

  // Create wallet if user doesn't have one
  const createWallet = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/grain-vault/deposit', { method: 'POST' })

      if (!res.ok) {
        throw new Error('Failed to create wallet')
      }

      const result = await res.json()
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyAddress = async () => {
    if (walletData?.wallet?.address) {
      await navigator.clipboard.writeText(walletData.wallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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
              <button
                onClick={() => setShowDepositModal(true)}
                className="px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all flex items-center gap-2"
              >
                <ArrowDown className="w-5 h-5" />
                Deposit USDC
              </button>
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

        {/* Deposit Address Card */}
        {walletData?.wallet?.address ? (
          <div className="mb-8 p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Deposit Address</h3>
                  <p className="text-sm text-gray-400">Send USDC on Base network</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
                Base L2
              </span>
            </div>

            <div className="p-4 rounded-xl bg-black/30 flex items-center justify-between mb-4">
              <p className="text-sm text-gray-300 font-mono break-all">
                {walletData.wallet.address}
              </p>
              <button
                onClick={copyAddress}
                className="ml-4 p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-green-400 font-medium mb-2">Deposit Instructions</p>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Send USDC on Base network to the address above</li>
                <li>• Minimum deposit: $10 USDC</li>
                <li>• GRAIN credited 1:1 after 1 confirmation (~2 seconds)</li>
                <li>• Do NOT send from an exchange - use a self-custody wallet</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="mb-8 p-8 rounded-2xl bg-white/5 border border-white/10 text-center">
            <Wallet className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Create Your Wallet</h3>
            <p className="text-gray-400 mb-6">
              Generate a deposit address to start receiving USDC and earning GRAIN
            </p>
            <button
              onClick={createWallet}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all"
            >
              Create Wallet
            </button>
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
                <p className="font-medium text-white">Get GRAIN 1:1</p>
              </div>
              <p className="text-sm text-gray-400 pl-10">
                Receive GRAIN credited instantly to your balance. 1 USDC = 1 GRAIN.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">3</div>
                <p className="font-medium text-white">Appreciate</p>
              </div>
              <p className="text-sm text-gray-400 pl-10">
                GRAIN value grows as treasury earns yield. All holders benefit equally.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Deposit Modal */}
      {showDepositModal && walletData?.wallet?.address && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Deposit USDC</h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400"
              >
                ✕
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-3">Send USDC to this address on Base L2:</p>
              <div className="p-4 rounded-xl bg-black/30 border border-white/10">
                <p className="text-sm text-green-400 font-mono break-all">
                  {walletData.wallet.address}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                copyAddress()
                setShowDepositModal(false)
              }}
              className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all flex items-center justify-center gap-2"
            >
              <Copy className="w-5 h-5" />
              Copy Address
            </button>

            <p className="text-xs text-gray-500 mt-4 text-center">
              GRAIN will be credited 1:1 after 1 confirmation (~2 seconds)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
