// @ts-nocheck
'use client'

/**
 * Grain & Vault Admin Treasury Dashboard
 * Comprehensive treasury management view for administrators
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Wallet,
  DollarSign,
  TrendingUp,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  Loader2,
  Building2,
  Percent,
  Calendar,
  Clock,
  ChevronRight,
  Shield,
  Activity
} from 'lucide-react'

interface TreasuryData {
  treasury: {
    masterWallet: {
      usdcBalance: number
      totalUserLiabilities: number
      netPosition: number
    }
    yields: {
      apyRate: number
      apyPercentage: number
      estimatedDailyYield: number
      estimatedAnnualYield: number
    }
    stats: {
      totalAccounts: number
      totalUsdBalance: number
      totalGrainBalance: number
    }
    volume: {
      totalDeposits: number
      totalWithdrawals: number
      netFlow: number
    }
    largeTransactions: Array<{
      id: string
      accountId: string
      email: string
      fullName: string
      type: string
      usdAmount: number
      grainAmount: number | null
      grainPrice: number | null
      fee: number | null
      status: string
      description: string
      createdAt: string
      completedAt: string | null
    }>
  }
  updatedAt: string
}

export default function TreasuryDashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<TreasuryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetch('/api/grain-vault/admin/treasury')

      if (!response.ok) {
        throw new Error('Failed to load treasury data')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Unknown error')
      }

      setData(result)
      setError(null)
      setLastRefresh(new Date())
    } catch (err: any) {
      console.error('Treasury dashboard error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Format currency
  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Format large numbers compactly
  const formatCompact = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(2)}K`
    }
    return formatUSD(amount)
  }

  // Format number with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  // Format percentage
  const formatPercent = (pct: number) => {
    return `${pct.toFixed(2)}%`
  }

  // Format date/time
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  // Transaction type labels and colors
  const txTypeConfig: Record<string, { label: string; color: string; icon: any }> = {
    deposit: { label: 'Deposit', color: 'text-green-400', icon: ArrowDownLeft },
    withdraw: { label: 'Withdrawal', color: 'text-blue-400', icon: ArrowUpRight },
    buy_grain: { label: 'Buy GRAIN', color: 'text-amber-400', icon: TrendingUp },
    sell_grain: { label: 'Sell GRAIN', color: 'text-purple-400', icon: TrendingUp },
    transfer_in: { label: 'Transfer In', color: 'text-green-400', icon: ArrowDownLeft },
    transfer_out: { label: 'Transfer Out', color: 'text-blue-400', icon: ArrowUpRight }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading treasury data...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Treasury</h2>
          <p className="text-gray-400 mb-6">{error || 'Failed to load data'}</p>
          <button
            onClick={() => fetchData()}
            className="px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const { treasury } = data

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Treasury Management</h1>
                <p className="text-xs text-gray-400">Grain & Vault Admin</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {lastRefresh && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Activity className="w-4 h-4" />
                  <span>Updated {formatRelativeTime(lastRefresh)}</span>
                </div>
              )}

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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Primary Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Master Wallet Balance */}
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-amber-400" />
              </div>
              <div className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-semibold rounded-full">
                USDC
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Master Wallet Balance</p>
            <h2 className="text-3xl font-bold text-white mb-2">
              {formatUSD(treasury.masterWallet.usdcBalance)}
            </h2>
            <p className="text-xs text-gray-500">
              Circle Custodial Wallet
            </p>
          </div>

          {/* Total User Liabilities */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full">
                Liabilities
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Total User Liabilities</p>
            <h2 className="text-3xl font-bold text-white mb-2">
              {formatUSD(treasury.masterWallet.totalUserLiabilities)}
            </h2>
            <p className="text-xs text-gray-500">
              Sum of all user USD balances
            </p>
          </div>

          {/* Net Position */}
          <div className={`border rounded-2xl p-6 ${
            treasury.masterWallet.netPosition >= 0
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                treasury.masterWallet.netPosition >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                <Shield className={`w-6 h-6 ${
                  treasury.masterWallet.netPosition >= 0 ? 'text-green-400' : 'text-red-400'
                }`} />
              </div>
              <div className={`px-2 py-1 text-xs font-semibold rounded-full ${
                treasury.masterWallet.netPosition >= 0
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {treasury.masterWallet.netPosition >= 0 ? 'Surplus' : 'Deficit'}
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Net Position</p>
            <h2 className={`text-3xl font-bold mb-2 ${
              treasury.masterWallet.netPosition >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatUSD(treasury.masterWallet.netPosition)}
            </h2>
            <p className="text-xs text-gray-500">
              Master balance - liabilities
            </p>
          </div>
        </div>

        {/* Yield Estimates */}
        <div className="bg-gradient-to-r from-purple-500/10 via-purple-600/10 to-purple-500/10 border border-purple-500/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Percent className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Yield Estimates</h3>
              <p className="text-xs text-gray-400">Based on {formatPercent(treasury.yields.apyPercentage)} APY</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">APY Rate</p>
              <p className="text-2xl font-bold text-purple-400">
                {formatPercent(treasury.yields.apyPercentage)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Estimated Daily Yield</p>
              <p className="text-2xl font-bold text-white">
                {formatUSD(treasury.yields.estimatedDailyYield)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Estimated Monthly Yield</p>
              <p className="text-2xl font-bold text-white">
                {formatUSD(treasury.yields.estimatedDailyYield * 30)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Estimated Annual Yield</p>
              <p className="text-2xl font-bold text-white">
                {formatUSD(treasury.yields.estimatedAnnualYield)}
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Total Accounts */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-400">Total Accounts</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatNumber(treasury.stats.totalAccounts)}
            </p>
          </div>

          {/* Total Deposits */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownLeft className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Total Deposits</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatCompact(treasury.volume.totalDeposits)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Lifetime</p>
          </div>

          {/* Total Withdrawals */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">Total Withdrawals</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatCompact(treasury.volume.totalWithdrawals)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Lifetime</p>
          </div>

          {/* Net Flow */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className={`w-5 h-5 ${
                treasury.volume.netFlow >= 0 ? 'text-green-400' : 'text-red-400'
              }`} />
              <span className="text-sm text-gray-400">Net Flow</span>
            </div>
            <p className={`text-2xl font-bold ${
              treasury.volume.netFlow >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {treasury.volume.netFlow >= 0 ? '+' : ''}{formatCompact(treasury.volume.netFlow)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Deposits - Withdrawals</p>
          </div>
        </div>

        {/* Recent Large Transactions */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Large Transactions</h3>
                <p className="text-xs text-gray-400">Transactions over $1,000</p>
              </div>
            </div>
            <span className="text-sm text-gray-400">
              {treasury.largeTransactions.length} transactions
            </span>
          </div>

          {treasury.largeTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No large transactions yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Transactions over $1,000 will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {treasury.largeTransactions.map((tx) => {
                const config = txTypeConfig[tx.type] || {
                  label: tx.type,
                  color: 'text-gray-400',
                  icon: DollarSign
                }
                const TxIcon = config.icon

                return (
                  <div
                    key={tx.id}
                    className="px-6 py-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          tx.type.includes('deposit') || tx.type.includes('in')
                            ? 'bg-green-500/20'
                            : tx.type.includes('withdraw') || tx.type.includes('out')
                            ? 'bg-blue-500/20'
                            : 'bg-amber-500/20'
                        }`}>
                          <TxIcon className={`w-5 h-5 ${config.color}`} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${config.color}`}>
                              {config.label}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              tx.status === 'completed'
                                ? 'bg-green-500/20 text-green-400'
                                : tx.status === 'processing'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : tx.status === 'pending'
                                ? 'bg-gray-500/20 text-gray-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-400">
                              {tx.fullName || tx.email || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(tx.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-semibold text-white">
                          {formatUSD(tx.usdAmount)}
                        </p>
                        {tx.grainAmount && (
                          <p className="text-sm text-gray-400">
                            {tx.grainAmount.toFixed(4)} GRAIN
                          </p>
                        )}
                        {tx.fee && tx.fee > 0 && (
                          <p className="text-xs text-gray-500">
                            Fee: {formatUSD(tx.fee)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Treasury data is refreshed automatically every 60 seconds
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Last sync: {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'N/A'}
          </p>
        </div>
      </main>
    </div>
  )
}
