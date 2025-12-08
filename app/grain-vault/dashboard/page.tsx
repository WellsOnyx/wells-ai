// @ts-nocheck
'use client'

/**
 * Grain & Vault Dashboard
 * Shows real data from database with proper GRAIN appreciation tracking
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Loader2
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

interface AccountData {
  account: {
    id: string
    email: string
    full_name: string
    wallet_address: string
    status: string
    verification_level: string
  }
  balances: {
    usd: number
    grain: {
      quantity: number
      current_price: number
      current_value: number
      avg_purchase_price: number
      cost_basis: number
      unrealized_gain: number
      unrealized_gain_pct: number
    }
    portfolio: {
      total_value: number
      allocation: {
        usd_pct: number
        grain_pct: number
      }
    }
  }
  limits: {
    daily_deposit: number
    daily_withdraw: number
  }
  recent_transactions: any[]
}

interface GrainPrice {
  grain: {
    price_usd: number
    change_24h: number
    change_7d: number
    change_30d: number
    circulating_supply: number
  }
  treasury: {
    total_usd: number
    backing_ratio: number
    assets: Array<{
      type: string
      name: string
      amount: number
      percentage: number
      apy: number
    }>
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [accountData, setAccountData] = useState<AccountData | null>(null)
  const [priceData, setPriceData] = useState<GrainPrice | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch data
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Get email from URL or localStorage
      const urlParams = new URLSearchParams(window.location.search)
      let email = urlParams.get('email')

      // Check localStorage for saved email
      if (!email && typeof window !== 'undefined') {
        email = localStorage.getItem('grainvault_email')
      }

      // If still no email, redirect to onboarding
      if (!email) {
        router.push('/grain-vault/onboard')
        return
      }

      // Save email to localStorage for future visits
      if (typeof window !== 'undefined') {
        localStorage.setItem('grainvault_email', email)
      }

      // Fetch account data from treasury_accounts and price data
      const [accountRes, priceRes] = await Promise.all([
        fetch(`/api/grain-vault/onboard?email=${encodeURIComponent(email)}`),
        fetch('/api/grain-vault/price')
      ])

      if (!accountRes.ok) {
        // Account doesn't exist, redirect to onboarding
        router.push('/grain-vault/onboard')
        return
      }

      if (!priceRes.ok) {
        throw new Error('Failed to load GRAIN price')
      }

      const onboardResult = await accountRes.json()
      const priceResult = await priceRes.json()

      // Check if account exists
      if (!onboardResult.completed || !onboardResult.account) {
        router.push('/grain-vault/onboard')
        return
      }

      // Fetch full account details from treasury_accounts directly
      const fullAccountRes = await fetch(`/api/grain-vault/treasury-account?email=${encodeURIComponent(email)}`)

      if (!fullAccountRes.ok) {
        throw new Error('Failed to load account details')
      }

      const fullAccountResult = await fullAccountRes.json()

      setAccountData(fullAccountResult)
      setPriceData(priceResult)
      setError(null)
    } catch (err: any) {
      console.error('Dashboard error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !accountData || !priceData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Dashboard</h2>
          <p className="text-gray-400 mb-6">{error || 'Account not found'}</p>
          <button
            onClick={() => router.push('/grain-vault/onboard')}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all"
          >
            Complete Onboarding
          </button>
        </div>
      </div>
    )
  }

  const { account, balances, limits, recent_transactions } = accountData
  const { grain: grainPrice, treasury } = priceData

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

  const formatPercent = (pct: number) => {
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${pct.toFixed(2)}%`
  }

  // Transaction type labels
  const txTypeLabels: Record<string, string> = {
    deposit: 'Deposit',
    withdraw: 'Withdrawal',
    buy_grain: 'Buy GRAIN',
    sell_grain: 'Sell GRAIN',
    transfer_in: 'Transfer In',
    transfer_out: 'Transfer Out'
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <div className="w-3 h-3 bg-black rounded-sm" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Grain & Vault</h1>
                <p className="text-xs text-gray-400">{account.full_name}</p>
              </div>
            </div>

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
        {/* Portfolio Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Portfolio Value */}
          <div className="lg:col-span-2 bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-gray-400 mb-2">Total Portfolio Value</p>
                <h2 className="text-4xl font-bold text-white mb-2">
                  {formatUSD(balances.portfolio.total_value)}
                </h2>
                <div className="flex items-center gap-2 text-sm">
                  {balances.grain.unrealized_gain_pct >= 0 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-semibold">
                        {formatPercent(balances.grain.unrealized_gain_pct)}
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 font-semibold">
                        {formatPercent(balances.grain.unrealized_gain_pct)}
                      </span>
                    </>
                  )}
                  <span className="text-gray-400">All-time</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all text-sm">
                  Deposit
                </button>
                <button className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-semibold hover:bg-white/10 transition-all text-sm">
                  Withdraw
                </button>
              </div>
            </div>

            {/* Allocation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-gray-400">USD Balance</span>
                </div>
                <p className="text-2xl font-bold text-white">{formatUSD(balances.usd)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {balances.portfolio.allocation.usd_pct.toFixed(1)}% of portfolio
                </p>
              </div>

              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-gray-400">GRAIN Value</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {formatUSD(balances.grain.current_value)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {balances.portfolio.allocation.grain_pct.toFixed(1)}% of portfolio
                </p>
              </div>
            </div>
          </div>

          {/* GRAIN Price */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">GRAIN Price</p>
                <p className="text-xs text-gray-500">Live</p>
              </div>
            </div>

            <h3 className="text-3xl font-bold text-white mb-4">
              {formatUSD(grainPrice.price_usd)}
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">24h</span>
                <span
                  className={`font-semibold ${
                    grainPrice.change_24h >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {formatPercent(grainPrice.change_24h)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">7d</span>
                <span
                  className={`font-semibold ${
                    grainPrice.change_7d >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {formatPercent(grainPrice.change_7d)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">30d</span>
                <span
                  className={`font-semibold ${
                    grainPrice.change_30d >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {formatPercent(grainPrice.change_30d)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Holdings & Treasury */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* GRAIN Holdings */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">GRAIN Holdings</h3>

            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-400 mb-1">Balance</p>
                <p className="text-2xl font-bold text-white">
                  {formatGRAIN(balances.grain.quantity)} GRAIN
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Current Value</p>
                  <p className="text-lg font-semibold text-white">
                    {formatUSD(balances.grain.current_value)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Cost Basis</p>
                  <p className="text-lg font-semibold text-white">
                    {formatUSD(balances.grain.cost_basis)}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Unrealized Gain/Loss</p>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        balances.grain.unrealized_gain >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {formatUSD(balances.grain.unrealized_gain)}
                    </p>
                    <p
                      className={`text-sm ${
                        balances.grain.unrealized_gain_pct >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {formatPercent(balances.grain.unrealized_gain_pct)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <p className="text-xs text-green-400 font-medium mb-2">
                  How GRAIN Appreciates
                </p>
                <p className="text-xs text-gray-400">
                  GRAIN is backed 1:1 by real assets. As the treasury grows through fees
                  and yield, the backing per GRAIN increases, causing appreciation. All
                  holders benefit equally.
                </p>
              </div>
            </div>
          </div>

          {/* Treasury Info */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Treasury Backing</h3>
              <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">
                100% Backed
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-1">Total Treasury Value</p>
              <p className="text-2xl font-bold text-white">
                {formatUSD(treasury.total_usd)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Circulating Supply: {formatGRAIN(grainPrice.circulating_supply)} GRAIN
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-400 mb-3">Asset Breakdown</p>
              {treasury.assets.map((asset, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{asset.name}</p>
                    <p className="text-xs text-gray-500">{asset.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">
                      {formatUSD(asset.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {asset.percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <button className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                <Shield className="w-4 h-4" />
                View Proof of Reserves
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            <button className="text-sm text-gray-400 hover:text-white transition-colors">
              View All
            </button>
          </div>

          {recent_transactions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No transactions yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Make your first deposit to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recent_transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        tx.type.includes('deposit') || tx.type.includes('buy')
                          ? 'bg-green-500/20'
                          : 'bg-blue-500/20'
                      }`}
                    >
                      {tx.type.includes('deposit') || tx.type.includes('buy') ? (
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
                    {tx.usd_amount && (
                      <p className="font-semibold text-white">
                        {formatUSD(tx.usd_amount)}
                      </p>
                    )}
                    {tx.grain_amount && (
                      <p className="text-sm text-gray-400">
                        {formatGRAIN(tx.grain_amount)} GRAIN
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {tx.status === 'completed' ? (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      ) : tx.status === 'processing' ? (
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

        {/* Account Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Wallet Address</p>
            <p className="text-sm font-mono text-white truncate">
              {account.wallet_address}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Verification Level</p>
            <p className="text-sm font-semibold text-white capitalize">
              {account.verification_level}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Daily Limits</p>
            <p className="text-sm text-white">
              Deposit: {formatUSD(limits.daily_deposit)} • Withdraw:{' '}
              {formatUSD(limits.daily_withdraw)}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
