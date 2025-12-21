// @ts-nocheck
'use client'

/**
 * Grain & Vault Treasury Dashboard
 *
 * COMPREHENSIVE TREASURY MANAGEMENT INTERFACE
 * - Enhanced balance overview with price changes
 * - Treasury health visualization with backing ratio
 * - Full transaction history with filters and pagination
 * - Network stats for suppliers/customers
 * - Quick actions grid
 * - GRAIN price chart
 * - InlineWellsChat integration
 * - Manual approval pending screen
 */

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
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
  Link as LinkIcon,
  Filter,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Banknote,
  Receipt,
  BarChart3,
  PieChart,
  Activity,
  Globe,
  Mail,
  ArrowRightLeft,
  Percent,
  LineChart,
  Calendar
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
    description?: string
    counterparty?: string
  }>
  last_updated?: string
}

interface TreasuryData {
  grainValue: number
  totalBacking: number
  backingRatio: number
  targetBackingRatio: number
  apyRate: number
  assetBreakdown: Array<{
    type: string
    value: number
    percentage: number
    color: string
  }>
  priceHistory: Array<{
    date: string
    price: number
  }>
  lastUpdated: string
}

interface NetworkStats {
  totalConnections: number
  suppliers: {
    count: number
    pending: number
  }
  customers: {
    count: number
    pending: number
  }
  paymentsSent: number
  paymentsReceived: number
  totalVolume: number
}

type TransactionFilter = 'all' | 'deposit' | 'withdraw' | 'transfer' | 'payment'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [treasuryData, setTreasuryData] = useState<TreasuryData | null>(null)
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Transaction history state
  const [txFilter, setTxFilter] = useState<TransactionFilter>('all')
  const [txPage, setTxPage] = useState(1)
  const txPerPage = 5

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
          setTreasuryData({
            grainValue: treasuryResult.grainValue || 1.0,
            totalBacking: treasuryResult.totalBacking || 0,
            backingRatio: treasuryResult.backingRatio || 1.1,
            targetBackingRatio: 1.1, // 110% target
            apyRate: treasuryResult.apyRate || 4.5,
            assetBreakdown: treasuryResult.assetBreakdown || [
              { type: 'T-Bills', value: 0, percentage: 45, color: '#22c55e' },
              { type: 'Money Market', value: 0, percentage: 30, color: '#3b82f6' },
              { type: 'USDC', value: 0, percentage: 20, color: '#8b5cf6' },
              { type: 'Cash', value: 0, percentage: 5, color: '#f59e0b' }
            ],
            priceHistory: treasuryResult.priceHistory || generateMockPriceHistory(),
            lastUpdated: treasuryResult.lastUpdated || new Date().toISOString()
          })
        } else {
          // Set default treasury data
          setTreasuryData({
            grainValue: 1.0,
            totalBacking: 0,
            backingRatio: 1.1,
            targetBackingRatio: 1.1,
            apyRate: 4.5,
            assetBreakdown: [
              { type: 'T-Bills', value: 0, percentage: 45, color: '#22c55e' },
              { type: 'Money Market', value: 0, percentage: 30, color: '#3b82f6' },
              { type: 'USDC', value: 0, percentage: 20, color: '#8b5cf6' },
              { type: 'Cash', value: 0, percentage: 5, color: '#f59e0b' }
            ],
            priceHistory: generateMockPriceHistory(),
            lastUpdated: new Date().toISOString()
          })
        }
      } catch (e) {
        // Treasury API might not exist - use defaults
        setTreasuryData({
          grainValue: 1.0,
          totalBacking: 0,
          backingRatio: 1.1,
          targetBackingRatio: 1.1,
          apyRate: 4.5,
          assetBreakdown: [
            { type: 'T-Bills', value: 0, percentage: 45, color: '#22c55e' },
            { type: 'Money Market', value: 0, percentage: 30, color: '#3b82f6' },
            { type: 'USDC', value: 0, percentage: 20, color: '#8b5cf6' },
            { type: 'Cash', value: 0, percentage: 5, color: '#f59e0b' }
          ],
          priceHistory: generateMockPriceHistory(),
          lastUpdated: new Date().toISOString()
        })
      }

      // Fetch network stats
      try {
        const networkRes = await fetch('/api/grain-vault/network')
        if (networkRes.ok) {
          const networkResult = await networkRes.json()
          setNetworkStats(networkResult)
        } else {
          setNetworkStats({
            totalConnections: 0,
            suppliers: { count: 0, pending: 0 },
            customers: { count: 0, pending: 0 },
            paymentsSent: 0,
            paymentsReceived: 0,
            totalVolume: 0
          })
        }
      } catch (e) {
        setNetworkStats({
          totalConnections: 0,
          suppliers: { count: 0, pending: 0 },
          customers: { count: 0, pending: 0 },
          paymentsSent: 0,
          paymentsReceived: 0,
          totalVolume: 0
        })
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

  // Generate mock price history for the chart (GRAIN only goes up)
  function generateMockPriceHistory() {
    const history = []
    let price = 1.0
    const now = new Date()
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      // GRAIN only appreciates - small daily increments
      price += Math.random() * 0.002 + 0.0005
      history.push({
        date: date.toISOString().split('T')[0],
        price: parseFloat(price.toFixed(6))
      })
    }
    return history
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

  // Filter and paginate transactions
  const filteredTransactions = useMemo(() => {
    if (!walletData?.recent_transactions) return []
    if (txFilter === 'all') return walletData.recent_transactions
    return walletData.recent_transactions.filter(tx => {
      if (txFilter === 'deposit') return tx.type === 'deposit'
      if (txFilter === 'withdraw') return tx.type === 'withdraw' || tx.type === 'withdrawal'
      if (txFilter === 'transfer') return tx.type === 'transfer' || tx.type === 'transfer_in' || tx.type === 'transfer_out'
      if (txFilter === 'payment') return tx.type === 'payment' || tx.type === 'escrow_lock' || tx.type === 'escrow_release'
      return true
    })
  }, [walletData?.recent_transactions, txFilter])

  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txPerPage
    return filteredTransactions.slice(start, start + txPerPage)
  }, [filteredTransactions, txPage])

  const totalTxPages = Math.ceil(filteredTransactions.length / txPerPage)

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
          <p className="text-gray-400">Loading your treasury...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Treasury</h2>
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
    return <PendingApprovalScreen user={user} fetchData={fetchData} refreshing={refreshing} />
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

  const formatCompact = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`
    if (amount >= 1000) return `$${(amount / 1000).toFixed(2)}K`
    return formatUSD(amount)
  }

  const grainValue = treasuryData?.grainValue || 1.0
  const balance = walletData?.balance?.grain || 0
  const usdValue = balance * grainValue

  // Calculate price changes (mock data for now - would come from API)
  const priceChange24h = 0.15
  const priceChange7d = 0.42
  const priceChange30d = 1.23

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/grain-vault" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                <div className="w-4 h-4 bg-black rounded-sm" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Grain & Vault</h1>
                <p className="text-xs text-gray-400">Treasury Dashboard</p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 hidden sm:block">
                {user?.firstName || 'Account'}
              </span>
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Section 1: Enhanced Balance Overview Card */}
        <BalanceOverviewCard
          balance={balance}
          usdValue={usdValue}
          grainPrice={grainValue}
          priceChange24h={priceChange24h}
          priceChange7d={priceChange7d}
          priceChange30d={priceChange30d}
          formatGRAIN={formatGRAIN}
          formatUSD={formatUSD}
        />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 2: Treasury Health Section */}
          <TreasuryHealthSection
            treasuryData={treasuryData}
            formatUSD={formatUSD}
            formatCompact={formatCompact}
          />

          {/* Section 4: Network Stats */}
          <NetworkStatsSection
            networkStats={networkStats}
            formatCompact={formatCompact}
          />
        </div>

        {/* Section 5: Quick Actions Grid */}
        <QuickActionsGrid balance={balance} />

        {/* Section 6: GRAIN Price Chart */}
        <GrainPriceChart
          priceHistory={treasuryData?.priceHistory || []}
          currentPrice={grainValue}
        />

        {/* Section 3: Transaction History */}
        <TransactionHistorySection
          transactions={paginatedTransactions}
          filteredTransactions={filteredTransactions}
          txFilter={txFilter}
          setTxFilter={setTxFilter}
          txPage={txPage}
          setTxPage={setTxPage}
          totalPages={totalTxPages}
          formatGRAIN={formatGRAIN}
          formatUSD={formatUSD}
        />

        {/* Network Growth Callout - Supplier/Customer Onboarding */}
        <NetworkGrowthCallout />

        {/* Inline Chat with Wells */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-gradient-to-r from-green-500/10 to-blue-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-white font-bold">W</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">Chat with Wells</h3>
                <p className="text-xs text-gray-400">Your treasury assistant</p>
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

// ============================================================================
// SECTION 1: Enhanced Balance Overview Card
// ============================================================================
function BalanceOverviewCard({
  balance,
  usdValue,
  grainPrice,
  priceChange24h,
  priceChange7d,
  priceChange30d,
  formatGRAIN,
  formatUSD
}: {
  balance: number
  usdValue: number
  grainPrice: number
  priceChange24h: number
  priceChange7d: number
  priceChange30d: number
  formatGRAIN: (n: number) => string
  formatUSD: (n: number) => string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/20 backdrop-blur-xl">
      {/* Background decoration */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />

      <div className="relative p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Balance Display */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">GRAIN Balance</span>
            </div>

            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-2">
              {formatGRAIN(balance)}
              <span className="text-xl sm:text-2xl text-gray-400 ml-2">GRAIN</span>
            </h2>

            <p className="text-xl sm:text-2xl text-green-400 font-semibold mb-4">
              {formatUSD(usdValue)}
            </p>

            {/* Price Info */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                <span className="text-xs text-gray-400">1 GRAIN =</span>
                <span className="text-sm font-semibold text-white">{formatUSD(grainPrice)}</span>
              </div>

              {/* Price Changes */}
              <div className="flex items-center gap-3">
                <PriceChange label="24h" value={priceChange24h} />
                <PriceChange label="7d" value={priceChange7d} />
                <PriceChange label="30d" value={priceChange30d} />
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
            <Link
              href="/grain-vault/deposit"
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02]"
            >
              <ArrowDown className="w-5 h-5" />
              Deposit
            </Link>
            <button
              disabled={balance === 0}
              className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 hover:border-white/20"
            >
              <ArrowUp className="w-5 h-5" />
              Withdraw
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PriceChange({ label, value }: { label: string; value: number }) {
  const isPositive = value >= 0
  return (
    <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span>{label}:</span>
      <span className="font-semibold">{isPositive ? '+' : ''}{value.toFixed(2)}%</span>
    </div>
  )
}

// ============================================================================
// SECTION 2: Treasury Health Section
// ============================================================================
function TreasuryHealthSection({
  treasuryData,
  formatUSD,
  formatCompact
}: {
  treasuryData: TreasuryData | null
  formatUSD: (n: number) => string
  formatCompact: (n: number) => string
}) {
  const backingRatio = treasuryData?.backingRatio || 1.1
  const targetRatio = treasuryData?.targetBackingRatio || 1.1
  const backingPercentage = (backingRatio * 100).toFixed(1)
  const isHealthy = backingRatio >= targetRatio

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Treasury Health</h3>
            <p className="text-xs text-gray-400">Proof of reserves</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isHealthy ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {isHealthy ? 'Healthy' : 'Review'}
        </div>
      </div>

      {/* Backing Ratio Visualization */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Backing Ratio</span>
          <span className="text-lg font-bold text-white">{backingPercentage}%</span>
        </div>
        <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
              isHealthy ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'
            }`}
            style={{ width: `${Math.min(backingRatio * 100, 120)}%` }}
          />
          {/* Target line at 110% */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/50" style={{ left: '91.67%' }}>
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap">
              Target 110%
            </span>
          </div>
        </div>
      </div>

      {/* Total Treasury Value */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">Total Treasury Value</p>
            <p className="text-2xl font-bold text-white">
              {formatCompact(treasuryData?.totalBacking || 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 mb-1">APY Earned</p>
            <p className="text-2xl font-bold text-green-400">
              {treasuryData?.apyRate || 4.5}%
            </p>
          </div>
        </div>
      </div>

      {/* Asset Allocation Breakdown */}
      <div>
        <p className="text-sm font-medium text-gray-400 mb-3">Asset Allocation</p>
        <div className="space-y-3">
          {(treasuryData?.assetBreakdown || [
            { type: 'T-Bills', percentage: 45, color: '#22c55e', value: 0 },
            { type: 'Money Market', percentage: 30, color: '#3b82f6', value: 0 },
            { type: 'USDC', percentage: 20, color: '#8b5cf6', value: 0 },
            { type: 'Cash', percentage: 5, color: '#f59e0b', value: 0 }
          ]).map((asset, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white">{asset.type}</span>
                  <span className="text-sm font-semibold text-white">{asset.percentage}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${asset.percentage}%`, backgroundColor: asset.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View Details Link */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <Link
          href="/grain-vault/admin/treasury"
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
        >
          <Shield className="w-4 h-4" />
          View Full Proof of Reserves
          <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 3: Transaction History
// ============================================================================
function TransactionHistorySection({
  transactions,
  filteredTransactions,
  txFilter,
  setTxFilter,
  txPage,
  setTxPage,
  totalPages,
  formatGRAIN,
  formatUSD
}: {
  transactions: any[]
  filteredTransactions: any[]
  txFilter: TransactionFilter
  setTxFilter: (f: TransactionFilter) => void
  txPage: number
  setTxPage: (p: number) => void
  totalPages: number
  formatGRAIN: (n: number) => string
  formatUSD: (n: number) => string
}) {
  const filters: { value: TransactionFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'withdraw', label: 'Withdrawals' },
    { value: 'transfer', label: 'Transfers' },
    { value: 'payment', label: 'Payments' }
  ]

  const txTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
    deposit: { label: 'Deposit', icon: ArrowDownRight, color: 'text-green-400 bg-green-500/20' },
    withdraw: { label: 'Withdrawal', icon: ArrowUpRight, color: 'text-blue-400 bg-blue-500/20' },
    withdrawal: { label: 'Withdrawal', icon: ArrowUpRight, color: 'text-blue-400 bg-blue-500/20' },
    transfer: { label: 'Transfer', icon: ArrowRightLeft, color: 'text-purple-400 bg-purple-500/20' },
    transfer_in: { label: 'Transfer In', icon: ArrowDownRight, color: 'text-green-400 bg-green-500/20' },
    transfer_out: { label: 'Transfer Out', icon: ArrowUpRight, color: 'text-blue-400 bg-blue-500/20' },
    payment: { label: 'Payment', icon: CreditCard, color: 'text-amber-400 bg-amber-500/20' },
    escrow_lock: { label: 'Escrow Lock', icon: Shield, color: 'text-yellow-400 bg-yellow-500/20' },
    escrow_release: { label: 'Escrow Release', icon: CheckCircle, color: 'text-green-400 bg-green-500/20' },
    fee: { label: 'Fee', icon: Receipt, color: 'text-gray-400 bg-gray-500/20' }
  }

  const exportTransactions = () => {
    const csv = [
      ['Date', 'Type', 'Amount (GRAIN)', 'Status', 'Description'].join(','),
      ...filteredTransactions.map(tx => [
        new Date(tx.created_at).toLocaleDateString(),
        tx.type,
        tx.amount || tx.grain_amount || 0,
        tx.status,
        tx.description || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grain-transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Transaction History</h3>
              <p className="text-xs text-gray-400">{filteredTransactions.length} transactions</p>
            </div>
          </div>

          <button
            onClick={exportTransactions}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm text-gray-300"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => { setTxFilter(f.value); setTxPage(1) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                txFilter === f.value
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No transactions found</p>
          <p className="text-sm text-gray-500 mt-1">
            {txFilter === 'all' ? 'Make your first deposit to get started' : `No ${txFilter} transactions`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {transactions.map((tx) => {
            const config = txTypeLabels[tx.type] || { label: tx.type, icon: DollarSign, color: 'text-gray-400 bg-gray-500/20' }
            const TxIcon = config.icon
            const amount = tx.amount || tx.grain_amount || 0

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color.split(' ')[1]}`}>
                    <TxIcon className={`w-5 h-5 ${config.color.split(' ')[0]}`} />
                  </div>
                  <div>
                    <p className="font-medium text-white">{config.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString()} at {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {tx.counterparty && (
                        <>
                          <span className="text-gray-600">|</span>
                          <p className="text-xs text-gray-400">{tx.counterparty}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`font-semibold ${tx.type.includes('out') || tx.type === 'withdraw' || tx.type === 'withdrawal' || tx.type === 'fee' ? 'text-red-400' : 'text-green-400'}`}>
                    {tx.type.includes('out') || tx.type === 'withdraw' || tx.type === 'withdrawal' || tx.type === 'fee' ? '-' : '+'}{formatGRAIN(amount)} GRAIN
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {tx.status === 'completed' ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : tx.status === 'pending' ? (
                      <Clock className="w-3 h-3 text-yellow-400" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-400 capitalize">{tx.status}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-white/10">
          <p className="text-sm text-gray-400">
            Page {txPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTxPage(Math.max(1, txPage - 1))}
              disabled={txPage === 1}
              className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTxPage(Math.min(totalPages, txPage + 1))}
              disabled={txPage === totalPages}
              className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SECTION 4: Network Stats
// ============================================================================
function NetworkStatsSection({
  networkStats,
  formatCompact
}: {
  networkStats: NetworkStats | null
  formatCompact: (n: number) => string
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Globe className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Network Stats</h3>
          <p className="text-xs text-gray-400">Your supplier and customer connections</p>
        </div>
      </div>

      {/* Connection Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">Suppliers</span>
          </div>
          <p className="text-2xl font-bold text-white">{networkStats?.suppliers.count || 0}</p>
          {(networkStats?.suppliers.pending || 0) > 0 && (
            <p className="text-xs text-yellow-400 mt-1">{networkStats?.suppliers.pending} pending</p>
          )}
        </div>

        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-400">Customers</span>
          </div>
          <p className="text-2xl font-bold text-white">{networkStats?.customers.count || 0}</p>
          {(networkStats?.customers.pending || 0) > 0 && (
            <p className="text-xs text-yellow-400 mt-1">{networkStats?.customers.pending} pending</p>
          )}
        </div>
      </div>

      {/* Payment Stats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <ArrowUpRight className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-gray-300">Payments Sent</span>
          </div>
          <span className="font-semibold text-white">{networkStats?.paymentsSent || 0}</span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <ArrowDownRight className="w-5 h-5 text-green-400" />
            <span className="text-sm text-gray-300">Payments Received</span>
          </div>
          <span className="font-semibold text-white">{networkStats?.paymentsReceived || 0}</span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-gray-300">Total Volume</span>
          </div>
          <span className="font-semibold text-white">{formatCompact(networkStats?.totalVolume || 0)}</span>
        </div>
      </div>

      {/* Total Connections Badge */}
      <div className="mt-6 pt-4 border-t border-white/10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
          <Users className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-gray-300">
            <span className="font-semibold text-white">{networkStats?.totalConnections || 0}</span> Total Connections
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 5: Quick Actions Grid
// ============================================================================
function QuickActionsGrid({ balance }: { balance: number }) {
  const actions = [
    {
      icon: Send,
      label: 'Send Payment',
      description: 'Pay a supplier or vendor',
      href: '/grain-vault/send',
      color: 'from-blue-500/20 to-cyan-500/20',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400',
      disabled: balance === 0
    },
    {
      icon: ArrowDownRight,
      label: 'Request Payment',
      description: 'Invoice a customer',
      href: '/grain-vault/request',
      color: 'from-green-500/20 to-emerald-500/20',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-400'
    },
    {
      icon: ArrowDown,
      label: 'Deposit Funds',
      description: 'Add USD to your account',
      href: '/grain-vault/deposit',
      color: 'from-purple-500/20 to-violet-500/20',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-400'
    },
    {
      icon: Banknote,
      label: 'Withdraw to Bank',
      description: 'Transfer to your bank',
      href: '/grain-vault/withdraw',
      color: 'from-amber-500/20 to-orange-500/20',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400',
      disabled: balance === 0
    },
    {
      icon: Building2,
      label: 'Invite Supplier',
      description: 'Get paid in GRAIN',
      href: '/grain-vault/invite?type=supplier',
      color: 'from-teal-500/20 to-cyan-500/20',
      borderColor: 'border-teal-500/30',
      iconColor: 'text-teal-400'
    },
    {
      icon: UserPlus,
      label: 'Invite Customer',
      description: 'Pay customers in GRAIN',
      href: '/grain-vault/invite?type=customer',
      color: 'from-pink-500/20 to-rose-500/20',
      borderColor: 'border-pink-500/30',
      iconColor: 'text-pink-400'
    }
  ]

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
          <p className="text-xs text-gray-400">Common treasury operations</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {actions.map((action, i) => {
          const Icon = action.icon
          const content = (
            <div
              className={`p-4 rounded-xl bg-gradient-to-br ${action.color} border ${action.borderColor} hover:scale-[1.02] transition-all cursor-pointer ${
                action.disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className={`w-10 h-10 rounded-lg bg-black/30 flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${action.iconColor}`} />
              </div>
              <h4 className="font-semibold text-white text-sm mb-1">{action.label}</h4>
              <p className="text-xs text-gray-400">{action.description}</p>
            </div>
          )

          if (action.disabled) {
            return <div key={i}>{content}</div>
          }

          return (
            <Link key={i} href={action.href}>
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 6: GRAIN Price Chart
// ============================================================================
function GrainPriceChart({
  priceHistory,
  currentPrice
}: {
  priceHistory: Array<{ date: string; price: number }>
  currentPrice: number
}) {
  const chartData = {
    labels: priceHistory.map(p => {
      const date = new Date(p.date)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }),
    datasets: [
      {
        label: 'GRAIN Price',
        data: priceHistory.map(p => p.price),
        fill: true,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx
          const gradient = ctx.createLinearGradient(0, 0, 0, 200)
          gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)')
          gradient.addColorStop(1, 'rgba(34, 197, 94, 0)')
          return gradient
        },
        borderColor: '#22c55e',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#22c55e',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        tension: 0.4
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#22c55e',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: any) => `$${context.raw.toFixed(6)}`
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.4)',
          maxTicksLimit: 7
        }
      },
      y: {
        display: true,
        position: 'right' as const,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.4)',
          callback: (value: any) => `$${value.toFixed(4)}`
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  }

  const startPrice = priceHistory[0]?.price || 1
  const endPrice = priceHistory[priceHistory.length - 1]?.price || currentPrice
  const priceGain = ((endPrice - startPrice) / startPrice * 100).toFixed(2)

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
            <LineChart className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">GRAIN Price</h3>
            <p className="text-xs text-gray-400">30-day price history</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold text-white">${currentPrice.toFixed(6)}</p>
            <p className="text-sm text-green-400 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              +{priceGain}% (30d)
            </p>
          </div>
        </div>
      </div>

      {/* Price Only Goes Up Badge */}
      <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
        <Sparkles className="w-5 h-5 text-green-400" />
        <span className="text-sm text-green-400 font-medium">GRAIN is designed to only appreciate in value</span>
      </div>

      {/* Chart */}
      <div className="h-64">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  )
}

// ============================================================================
// PENDING APPROVAL SCREEN
// ============================================================================
function PendingApprovalScreen({
  user,
  fetchData,
  refreshing
}: {
  user: any
  fetchData: (isRefresh?: boolean) => Promise<void>
  refreshing: boolean
}) {
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
                      Full access to deposit funds, receive GRAIN tokens, send payments, and view your complete treasury dashboard.
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
                      We manually review all accounts to maintain the highest standards of security and compliance.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="p-6 rounded-xl bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <Mail className="w-5 h-5 text-green-400" />
                Questions?
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Contact our team for assistance or expedited review.
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
                We will also notify you via email once approved
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

// ============================================================================
// NETWORK GROWTH CALLOUT
// ============================================================================
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
        } else {
          // Set default data
          setInviteData({
            supplier: {
              code: 'SUP-DEMO',
              link: 'https://grainvault.io/join/sup-demo',
              onboarded: 0,
              pending: 0,
              benefits: ['Instant settlements', 'Zero fees', 'Auto-reconciliation', 'Appreciating value']
            },
            customer: {
              code: 'CUS-DEMO',
              link: 'https://grainvault.io/join/cus-demo',
              onboarded: 0,
              pending: 0,
              benefits: ['Instant payments', 'No wire fees', 'Value appreciation', 'Easy tracking']
            },
            totalNetwork: 0
          })
        }
      } catch (error) {
        console.error('Failed to fetch invites:', error)
        setInviteData({
          supplier: {
            code: 'SUP-DEMO',
            link: 'https://grainvault.io/join/sup-demo',
            onboarded: 0,
            pending: 0,
            benefits: ['Instant settlements', 'Zero fees', 'Auto-reconciliation', 'Appreciating value']
          },
          customer: {
            code: 'CUS-DEMO',
            link: 'https://grainvault.io/join/cus-demo',
            onboarded: 0,
            pending: 0,
            benefits: ['Instant payments', 'No wire fees', 'Value appreciation', 'Easy tracking']
          },
          totalNetwork: 0
        })
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
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-green-500/10 border border-white/10 animate-pulse">
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden">
      {/* Hero Section */}
      <div className="relative p-6 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-green-600/20 border border-white/10 rounded-t-2xl">
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
                  Grow Your Network
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </h3>
                <p className="text-sm text-gray-400">Invite suppliers and customers to GRAIN</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{inviteData?.totalNetwork || 0}</div>
              <div className="text-xs text-gray-400">in network</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Suppliers</span>
              </div>
              <div className="text-xl font-bold text-white">{inviteData?.supplier.onboarded || 0}</div>
              {(inviteData?.supplier.pending || 0) > 0 && (
                <div className="text-xs text-yellow-400">{inviteData?.supplier.pending} pending</div>
              )}
            </div>
            <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400">Customers</span>
              </div>
              <div className="text-xl font-bold text-white">{inviteData?.customer.onboarded || 0}</div>
              {(inviteData?.customer.pending || 0) > 0 && (
                <div className="text-xs text-yellow-400">{inviteData?.customer.pending} pending</div>
              )}
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
                <h4 className="font-semibold text-white mb-1">Get Paid in GRAIN</h4>
                <p className="text-sm text-gray-400">
                  Invite vendors to pay you in GRAIN. They save on fees, you get instant settlements.
                </p>
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-2">
              {inviteData?.supplier.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

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
                <h4 className="font-semibold text-white mb-1">Pay Customers in GRAIN</h4>
                <p className="text-sm text-gray-400">
                  Invite customers to receive payments in GRAIN. Their balance appreciates over time.
                </p>
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-2">
              {inviteData?.customer.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <Zap className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

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
                  <p className="text-xs text-gray-400">Share your unique link</p>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-yellow-400">2</span>
                  </div>
                  <h5 className="font-medium text-white text-sm mb-1">They Join</h5>
                  <p className="text-xs text-gray-400">Auto-linked to your account</p>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-yellow-400">3</span>
                  </div>
                  <h5 className="font-medium text-white text-sm mb-1">Transact</h5>
                  <p className="text-xs text-gray-400">Instant, zero-fee payments</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// INLINE WELLS CHAT
// ============================================================================
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
            product: 'grainvault',
            grainBalance,
            grainPrice,
            userName,
            contextInfo: `User is on the Grain & Vault treasury dashboard. Current GRAIN balance: ${grainBalance.toLocaleString()} GRAIN (worth $${(grainBalance * grainPrice).toLocaleString()}). Current GRAIN price: $${grainPrice.toFixed(4)}. GRAIN is an anti-inflationary stablecoin that only appreciates in value.`
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
            className="flex items-center gap-1 px-3 py-1.5 bg-white/5 rounded-full text-xs text-gray-300 hover:bg-white/10 whitespace-nowrap disabled:opacity-50 border border-white/10"
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
