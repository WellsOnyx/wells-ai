'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Users,
  TrendingUp,
  DollarSign,
  Gift,
  Plus,
  Network,
  Briefcase,
  ChevronRight,
  Loader2,
  Coins,
  Target,
  Zap,
  Sparkles,
} from 'lucide-react'
import { NetworkStatsResponse, formatUsd, formatGrain } from '@/lib/attribution/types'

interface DashboardData {
  stats: NetworkStatsResponse
  leaderboard?: Array<{
    userId: string
    displayName?: string
    totalEarned: number
    totalGrain: number
    networkSize: number
  }>
}

export default function AttributionDashboard() {
  const { isLoaded, isSignedIn } = useUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/attribution/network/stats?leaderboard=true')
      const json = await res.json()
      setData(json)
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchDashboard()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, fetchDashboard])

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header Skeleton */}
        <div className="border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-9 w-64 bg-white/5 rounded-lg animate-pulse mb-2" />
                <div className="h-4 w-96 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="flex gap-3">
                <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
                <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-white/10 rounded-lg animate-pulse" />
                  <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                </div>
                <div className="h-9 w-32 bg-white/10 rounded animate-pulse mb-2" />
                <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-6 border border-white/10 h-64">
                <div className="h-6 w-48 bg-white/10 rounded animate-pulse mb-6" />
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-12 bg-white/10 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6"
          >
            <Network className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">Attribution Network</h1>
          <p className="text-gray-400 mb-8 max-w-md">
            Sign in to build your network, earn commissions, and track your attribution success
          </p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all hover:scale-105"
          >
            <Sparkles className="w-4 h-4" />
            Sign In to Get Started
          </Link>
        </motion.div>
      </div>
    )
  }

  const stats = data?.stats

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                Attribution Network
              </h1>
              <p className="text-gray-400 mt-2">
                Earn commissions by introducing high-value deals to your network
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/attribution/offers/create"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                Create Offer
              </Link>
              <Link
                href="/attribution/connections"
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
              >
                <Users className="w-4 h-4" />
                Connections
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Earnings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-colors cursor-default">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-gray-400 text-sm">Total Earnings</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {formatUsd(stats?.earnings.total || 0)}
            </div>
            <div className="text-purple-400 text-sm mt-1">
              {formatGrain(stats?.grain.total || 0)} GRAIN
            </div>
          </motion.div>

          {/* Network Size */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-2xl p-6 border border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-default">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Network className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-gray-400 text-sm">Network Reach</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {stats?.connections.total || 0}
            </div>
            <div className="text-blue-400 text-sm mt-1">
              {stats?.connections.direct || 0} direct / {stats?.connections.remaining || 30} slots left
            </div>
          </motion.div>

          {/* Active Offers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-2xl p-6 border border-green-500/20 hover:border-green-500/40 transition-colors cursor-default">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Briefcase className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-400 text-sm">Active Offers</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {stats?.offers.active || 0}
            </div>
            <div className="text-green-400 text-sm mt-1">
              {stats?.offers.closed || 0} deals closed
            </div>
          </motion.div>

          {/* Monthly Earnings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 rounded-2xl p-6 border border-orange-500/20 hover:border-orange-500/40 transition-colors cursor-default">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-gray-400 text-sm">This Month</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {formatUsd(stats?.earnings.monthly || 0)}
            </div>
            <div className="text-orange-400 text-sm mt-1">
              {formatGrain(stats?.grain.monthly || 0)} GRAIN
            </div>
          </motion.div>
        </div>

        {/* Earnings by Level */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Coins className="w-5 h-5 text-purple-400" />
              Earnings by Level
            </h2>
            <div className="space-y-4">
              {[
                { level: 'L1', label: 'Direct', amount: stats?.earnings.byLevel.l1 || 0, color: 'purple' },
                { level: 'L2', label: '2nd Degree', amount: stats?.earnings.byLevel.l2 || 0, color: 'blue' },
                { level: 'L3', label: '3rd Degree', amount: stats?.earnings.byLevel.l3 || 0, color: 'green' },
                { level: 'L4', label: '4th Degree', amount: stats?.earnings.byLevel.l4 || 0, color: 'orange' },
              ].map((item) => (
                <div key={item.level} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold bg-${item.color}-500/20 text-${item.color}-400`}>
                      {item.level}
                    </span>
                    <span className="text-gray-400">{item.label}</span>
                  </div>
                  <span className="font-semibold">{formatUsd(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Summary */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Activity Summary
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-gray-400">Introductions Made</span>
                <span className="font-semibold">{stats?.introductions.made || 0}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-gray-400">Introductions Received</span>
                <span className="font-semibold">{stats?.introductions.received || 0}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-gray-400">Conversions</span>
                <span className="font-semibold text-green-400">{stats?.introductions.converted || 0}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-400">Offers Created</span>
                <span className="font-semibold">{stats?.offers.created || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
          >
            <Link
              href="/attribution/connections"
              className="group bg-white/5 hover:bg-white/10 rounded-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all flex items-center justify-between block"
              aria-label="Manage your network connections"
            >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Connections</h3>
                <p className="text-sm text-gray-400">
                  {stats?.connections.direct || 0}/30 connections
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.02 }}
          >
            <Link
              href="/attribution/offers"
              className="group bg-white/5 hover:bg-white/10 rounded-2xl p-6 border border-white/10 hover:border-blue-500/30 transition-all flex items-center justify-between block"
              aria-label="View your offers"
            >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Briefcase className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold">View Offers</h3>
                <p className="text-sm text-gray-400">
                  {stats?.offers.active || 0} active offers
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.02 }}
          >
            <Link
              href="/attribution/network"
              className="group bg-white/5 hover:bg-white/10 rounded-2xl p-6 border border-white/10 hover:border-green-500/30 transition-all flex items-center justify-between block"
              aria-label="View your network tree"
            >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Network className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold">Network Tree</h3>
                <p className="text-sm text-gray-400">
                  Visualize your 4-level network
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </Link>
          </motion.div>
        </div>

        {/* Leaderboard */}
        {data?.leaderboard && data.leaderboard.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-yellow-400" />
              Top Earners
            </h2>
            <div className="space-y-3">
              {data.leaderboard.slice(0, 5).map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between py-3 px-4 bg-white/5 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      index === 1 ? 'bg-gray-400/20 text-gray-300' :
                      index === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/10 text-gray-400'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="font-medium">
                      {user.displayName || `User ${user.userId.slice(0, 8)}...`}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatUsd(user.totalEarned)}</div>
                    <div className="text-xs text-gray-500">{user.networkSize} connections</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
