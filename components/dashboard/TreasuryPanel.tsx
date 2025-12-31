'use client'

/**
 * Treasury Panel - Unified GRAIN dashboard within the main dashboard
 * Shows balance, price, transactions, and quick actions when treasury journey is active
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Download,
  RefreshCw,
  Loader2,
  CreditCard,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react'

interface GrainProfile {
  grainBalance: number
  usdcBalance: number
  grainPrice: number
  grainValueUsd: number
  creditAvailable: number
  creditUsed: number
  creditLimit: number
  totalLiquidity: number
}

interface Transaction {
  id: string
  type: string
  amount: number
  currency: string
  status: string
  direction: 'sent' | 'received'
  counterparty: string
  date: string
}

interface TreasuryPanelProps {
  userId: string
  onAction: (prompt: string) => void
  compact?: boolean
}

export default function TreasuryPanel({ userId, onAction, compact = false }: TreasuryPanelProps) {
  const [profile, setProfile] = useState<GrainProfile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch profile
      const profileRes = await fetch('/api/grain/profile')
      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfile(data)
      }

      // Fetch transactions
      const txRes = await fetch('/api/grain/transactions?limit=5')
      if (txRes.ok) {
        const data = await txRes.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('Failed to fetch treasury data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const copyAddress = () => {
    navigator.clipboard.writeText(userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="text-center py-8">
          <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <h3 className="font-semibold text-gray-600 mb-2">Set Up Your Treasury</h3>
          <p className="text-sm text-gray-400 mb-4">Get started with GRAIN to unlock treasury features</p>
          <button
            onClick={() => onAction("What is GRAIN and how do I get started?")}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            Get Started
          </button>
        </div>
      </div>
    )
  }

  const priceChange = profile.grainPrice > 1 ? ((profile.grainPrice - 1) / 1 * 100) : 0

  if (compact) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <span className="font-semibold">GRAIN Balance</span>
          </div>
          <button onClick={fetchData} className="p-1 hover:bg-white/20 rounded transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="text-3xl font-bold mb-1">
          {profile.grainBalance.toLocaleString()}
        </div>
        <div className="text-white/70 text-sm flex items-center gap-2">
          ${profile.grainValueUsd.toLocaleString()}
          {priceChange > 0 && (
            <span className="flex items-center gap-0.5 text-green-200">
              <TrendingUp className="w-3 h-3" />
              +{priceChange.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => onAction("Send GRAIN to...")}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all"
          >
            <Send className="w-4 h-4" /> Send
          </button>
          <button
            onClick={() => onAction("Check my GRAIN transactions")}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all"
          >
            <BarChart3 className="w-4 h-4" /> Activity
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">GRAIN Treasury</h2>
              <p className="text-white/70 text-sm">Your digital treasury</p>
            </div>
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-white/20 rounded-lg transition-all">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Balance */}
          <div>
            <p className="text-white/70 text-sm mb-1">Available Balance</p>
            <div className="text-4xl font-bold">{profile.grainBalance.toLocaleString()} <span className="text-lg font-normal">GRAIN</span></div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/70">${profile.grainValueUsd.toLocaleString()}</span>
              {priceChange > 0 && (
                <span className="flex items-center gap-0.5 px-2 py-0.5 bg-green-400/30 rounded-full text-xs">
                  <TrendingUp className="w-3 h-3" />
                  +{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          </div>

          {/* Price */}
          <div>
            <p className="text-white/70 text-sm mb-1">GRAIN Price</p>
            <div className="text-3xl font-bold">${profile.grainPrice.toFixed(4)}</div>
            <p className="text-white/70 text-sm mt-1">$1.00 floor guaranteed</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button
            onClick={() => onAction("Send GRAIN to...")}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-all"
          >
            <Send className="w-4 h-4" /> Send
          </button>
          <button
            onClick={() => onAction("I need to deposit funds")}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-all"
          >
            <Download className="w-4 h-4" /> Deposit
          </button>
          <button
            onClick={() => onAction("Check my credit line")}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-all"
          >
            <CreditCard className="w-4 h-4" /> Credit
          </button>
        </div>
      </div>

      {/* Credit Line */}
      {profile.creditLimit > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-900">Credit Line</h3>
            </div>
            <span className="text-sm text-gray-500">
              ${profile.creditUsed.toLocaleString()} / ${profile.creditLimit.toLocaleString()} used
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all"
              style={{ width: `${(profile.creditUsed / profile.creditLimit) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-gray-500">Available: ${profile.creditAvailable.toLocaleString()}</span>
            {profile.creditAvailable > 0 && (
              <button
                onClick={() => onAction("Draw from my credit line")}
                className="text-emerald-600 hover:underline font-medium"
              >
                Draw Credit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <button
            onClick={() => onAction("Show all my transactions")}
            className="text-sm text-blue-600 hover:underline"
          >
            View All
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No transactions yet</p>
            <button
              onClick={() => onAction("How do I get GRAIN?")}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Get started
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    tx.direction === 'received' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {tx.direction === 'received' ? (
                      <ArrowDownRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{tx.type}</p>
                    <p className="text-xs text-gray-500">{tx.counterparty || 'System'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${tx.direction === 'received' ? 'text-green-600' : 'text-gray-900'}`}>
                    {tx.direction === 'received' ? '+' : '-'}{tx.amount.toLocaleString()} {tx.currency}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Treasury Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">Total Liquidity</p>
          <p className="text-2xl font-bold text-gray-900">${profile.totalLiquidity.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Balance + Credit</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">USDC Reserve</p>
          <p className="text-2xl font-bold text-gray-900">${profile.usdcBalance.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Instant withdrawal</p>
        </div>
      </div>

      {/* Help */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-gray-900">Need help with treasury?</p>
            <p className="text-sm text-gray-600 mt-1">
              Ask me anything about GRAIN, payments, credit, or escrow.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => onAction("What is GRAIN?")}
                className="px-3 py-1 bg-white text-sm text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
              >
                What is GRAIN?
              </button>
              <button
                onClick={() => onAction("How does credit work?")}
                className="px-3 py-1 bg-white text-sm text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
              >
                How does credit work?
              </button>
              <button
                onClick={() => onAction("Run payroll in GRAIN")}
                className="px-3 py-1 bg-white text-sm text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Run payroll
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
