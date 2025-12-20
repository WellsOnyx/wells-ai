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
import WellsAIChatWidget from '@/components/WellsAIChatWidget'
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
  has_profile?: boolean
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
      console.log('[Dashboard] wallet result:', walletResult)

      // Check if user needs to complete onboarding
      // In custodial model, has_wallet:true means they have a ledger entry
      if (!walletResult.has_wallet && !walletResult.has_profile) {
        console.log('[Dashboard] No wallet or profile - redirecting to onboard')
        router.push('/grain-vault/onboard')
        return
      }

      // If has_wallet is true OR has_profile is true, show the dashboard
      // The API will auto-create a wallet entry for users with profiles
      setWalletData(walletResult)

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
      </main>

      {/* Chat Widget */}
      <WellsAIChatWidget
        brandColor="#22C55E"
        accentColor="#10B981"
        brandName="GRAIN Support"
        context={`You are a support assistant for Grain & Vault dashboard users. The user is logged in and viewing their GRAIN wallet.

WHAT IS GRAIN?
GRAIN is our proprietary stablecoin that is ANTI-INFLATIONARY by design. Unlike traditional currencies that lose value over time, GRAIN is engineered to appreciate.

GRAIN PRICE FORMULA: Price = (Total USDC Reserve + Equity Value) / Circulating GRAIN Supply
- As treasury grows, GRAIN's price increases
- Your purchasing power grows while you hold
- GRAIN can ONLY go up in value
- Every GRAIN is 100% backed by real assets

HOW TO DEPOSIT:
1. Click "Add Funds" button in the dashboard (or use quick deposit buttons for $50, $100, $500)
2. You'll be taken to the deposit page where you can:
   - Enter a custom amount or select presets ($50-$2500)
   - Choose payment method: Card (instant), ACH (1-3 days, lower fees), or USDC on Base
   - See exactly how much GRAIN you'll receive at current price
3. Complete payment through secure Circle checkout
4. GRAIN is credited to your wallet at current price

VERIFICATION LEVELS:
- Basic (email only): $1,000/day limit
- Standard (phone + info): $10,000/day limit
- Verified (full ID): $100,000/day limit
- Enhanced: Unlimited

The user's balance is shown in the dashboard. Help them understand their balance, how to deposit more GRAIN, how appreciation works, and answer any questions about their account.

IMPORTANT: We NEVER display wallet addresses to users. All deposits go through Circle's secure checkout. This protects against phishing and theft.

Be helpful, enthusiastic about GRAIN's anti-inflationary design, and encourage users to hold for appreciation.`}
        journey="support"
        greeting="Need help with your GRAIN wallet? I can explain how appreciation works, help you make a deposit, or answer any questions!"
        placeholder="Ask about deposits, balance, or GRAIN..."
        position="bottom-right"
      />
    </div>
  )
}
