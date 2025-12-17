'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowLeft,
  DollarSign,
  Coins,
  TrendingUp,
  Loader2,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { AttrCommission, formatUsd, formatGrain } from '@/lib/attribution/types'

interface EarningsData {
  commissions: AttrCommission[]
  earnings: {
    total: number
    totalGrain: number
    byLevel: { l1: number; l2: number; l3: number; l4: number }
    pending: number
    credited: number
  }
}

export default function EarningsPage() {
  const { isLoaded, isSignedIn } = useUser()
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchEarnings = useCallback(async () => {
    try {
      const res = await fetch('/api/attribution/commissions')
      const json = await res.json()
      setData(json)
    } catch (error) {
      console.error('Failed to fetch earnings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchEarnings()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, fetchEarnings])

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  const earnings = data?.earnings
  const commissions = data?.commissions || []

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href="/attribution"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Earnings</h1>
          <p className="text-gray-400 mt-1">Your commission history and payouts</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-2xl p-6 border border-green-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-400 text-sm">Total Earned</span>
            </div>
            <div className="text-3xl font-bold">{formatUsd(earnings?.total || 0)}</div>
          </div>

          <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-2xl p-6 border border-purple-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Coins className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-gray-400 text-sm">Total GRAIN</span>
            </div>
            <div className="text-3xl font-bold">{formatGrain(earnings?.totalGrain || 0)}</div>
          </div>

          <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 rounded-2xl p-6 border border-yellow-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-gray-400 text-sm">Pending</span>
            </div>
            <div className="text-3xl font-bold">{formatUsd(earnings?.pending || 0)}</div>
          </div>
        </div>

        {/* Earnings by Level */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Earnings by Level
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { level: 'L1', amount: earnings?.byLevel.l1 || 0, color: 'purple' },
              { level: 'L2', amount: earnings?.byLevel.l2 || 0, color: 'blue' },
              { level: 'L3', amount: earnings?.byLevel.l3 || 0, color: 'green' },
              { level: 'L4', amount: earnings?.byLevel.l4 || 0, color: 'orange' },
            ].map((item) => (
              <div
                key={item.level}
                className={`text-center p-4 rounded-xl bg-${item.color}-500/10 border border-${item.color}-500/20`}
              >
                <div className="text-2xl font-bold">{formatUsd(item.amount)}</div>
                <div className={`text-sm text-${item.color}-400`}>{item.level}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Commission History */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold mb-4">Commission History</h2>

          {commissions.length === 0 ? (
            <div className="text-center py-12">
              <Coins className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No commissions yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Earn commissions by introducing offers through your network
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {commissions.map((comm) => (
                <div
                  key={comm.id}
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    comm.status === 'credited'
                      ? 'bg-green-500/10 border border-green-500/20'
                      : 'bg-yellow-500/10 border border-yellow-500/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      comm.status === 'credited' ? 'bg-green-500/20' : 'bg-yellow-500/20'
                    }`}>
                      {comm.status === 'credited' ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatUsd(comm.commissionUsd)}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          comm.level === 1 ? 'bg-purple-500/20 text-purple-400' :
                          comm.level === 2 ? 'bg-blue-500/20 text-blue-400' :
                          comm.level === 3 ? 'bg-green-500/20 text-green-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>
                          L{comm.level}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {comm.commissionPct}% of {formatUsd(comm.dealValue)} deal
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-purple-400">
                      {formatGrain(comm.grainAmount)} GRAIN
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(comm.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
