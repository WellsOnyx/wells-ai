'use client'

/**
 * RFQ List Page
 * Shows all buyer's RFQs with status, quick stats, and filtering
 */

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Loader2,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Package,
  DollarSign,
  TrendingDown,
  Sparkles,
  MessageSquare,
  Award,
  LayoutGrid,
  RefreshCw,
} from 'lucide-react'

interface RFQ {
  id: string
  category: string
  description: string
  quantity: number
  status: string
  createdAt: string
  quoteCount?: number
  awardedAmount?: number
  targetPrice?: number
}

interface RFQStats {
  total: number
  activeNegotiations: number
  pendingAwards: number
  open: number
  quoting: number
  negotiating: number
  awarded: number
  completed: number
}

type StatusFilter = 'all' | 'open' | 'quoting' | 'negotiating' | 'awarded' | 'completed'

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  open: { color: 'text-blue-400 bg-blue-500/20', icon: <Clock className="w-4 h-4" />, label: 'Open' },
  matched: { color: 'text-purple-400 bg-purple-500/20', icon: <Package className="w-4 h-4" />, label: 'Matched' },
  quoting: { color: 'text-amber-400 bg-amber-500/20', icon: <FileText className="w-4 h-4" />, label: 'Quoting' },
  negotiating: { color: 'text-cyan-400 bg-cyan-500/20', icon: <TrendingDown className="w-4 h-4" />, label: 'Negotiating' },
  quoted: { color: 'text-indigo-400 bg-indigo-500/20', icon: <DollarSign className="w-4 h-4" />, label: 'Quoted' },
  awarded: { color: 'text-green-400 bg-green-500/20', icon: <Award className="w-4 h-4" />, label: 'Awarded' },
  completed: { color: 'text-emerald-400 bg-emerald-500/20', icon: <CheckCircle className="w-4 h-4" />, label: 'Completed' },
  cancelled: { color: 'text-red-400 bg-red-500/20', icon: <AlertCircle className="w-4 h-4" />, label: 'Cancelled' },
}

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'quoting', label: 'Quoting' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'completed', label: 'Completed' },
]

export default function RFQListPage() {
  const { user, isLoaded } = useUser()
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<RFQStats>({
    total: 0,
    activeNegotiations: 0,
    pendingAwards: 0,
    open: 0,
    quoting: 0,
    negotiating: 0,
    awarded: 0,
    completed: 0,
  })

  const fetchRFQs = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filter !== 'all') {
        params.set('status', filter)
      }

      const res = await fetch(`/api/rfq/list?${params}`)
      const data = await res.json()

      if (data.success) {
        setRfqs(data.rfqs || [])

        // Calculate stats from all RFQs (fetch without filter for stats)
        if (filter === 'all') {
          calculateStats(data.rfqs || [])
        }
      } else {
        setError(data.error || 'Failed to fetch RFQs')
      }
    } catch (err) {
      console.error('Error fetching RFQs:', err)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const calculateStats = (rfqList: RFQ[]) => {
    const newStats: RFQStats = {
      total: rfqList.length,
      activeNegotiations: rfqList.filter(r => r.status === 'negotiating').length,
      pendingAwards: rfqList.filter(r => r.status === 'quoted' || (r.status === 'quoting' && (r.quoteCount || 0) > 0)).length,
      open: rfqList.filter(r => r.status === 'open' || r.status === 'matched').length,
      quoting: rfqList.filter(r => r.status === 'quoting' || r.status === 'quoted').length,
      negotiating: rfqList.filter(r => r.status === 'negotiating').length,
      awarded: rfqList.filter(r => r.status === 'awarded').length,
      completed: rfqList.filter(r => r.status === 'completed').length,
    }
    setStats(newStats)
  }

  // Fetch all RFQs for stats on initial load
  useEffect(() => {
    async function fetchAllForStats() {
      try {
        const res = await fetch('/api/rfq/list')
        const data = await res.json()
        if (data.success) {
          calculateStats(data.rfqs || [])
        }
      } catch (err) {
        console.error('Error fetching stats:', err)
      }
    }

    if (isLoaded && user && filter !== 'all') {
      fetchAllForStats()
    }
  }, [isLoaded, user])

  useEffect(() => {
    if (isLoaded && user) {
      fetchRFQs()
    }
  }, [isLoaded, user, filter])

  const handleRefresh = () => {
    fetchRFQs(true)
  }

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your RFQs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">Error Loading RFQs</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => fetchRFQs()}
            className="px-4 py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Your RFQs
            </h1>
            <p className="text-gray-400 mt-1">Track quotes, negotiations, and orders in one place</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-black rounded-xl font-semibold hover:opacity-90 transition-all"
            >
              <Plus className="w-5 h-5" />
              New RFQ
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-amber-500/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <LayoutGrid className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total RFQs</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {stats.open} open, {stats.quoting} quoting
            </div>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-cyan-500/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Negotiations</p>
                <p className="text-2xl font-bold">{stats.activeNegotiations}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              AI negotiating on your behalf
            </div>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-green-500/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Award className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Pending Awards</p>
                <p className="text-2xl font-bold">{stats.pendingAwards}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Ready for your decision
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                filter === option.value
                  ? 'bg-amber-500 text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {option.label}
              {option.value !== 'all' && (
                <span className="ml-2 text-xs opacity-70">
                  {option.value === 'open' && stats.open}
                  {option.value === 'quoting' && stats.quoting}
                  {option.value === 'negotiating' && stats.negotiating}
                  {option.value === 'awarded' && stats.awarded}
                  {option.value === 'completed' && stats.completed}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* RFQ List */}
        {rfqs.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            {filter === 'all' ? (
              <>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No procurement requests yet</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Just tell Wells what you need. AI will handle quotes, negotiate prices, and get you the best deal.
                </p>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-600 text-black rounded-xl font-semibold hover:opacity-90 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  Talk to Wells
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  No {filter} requests
                </h3>
                <p className="text-gray-500 mb-4">
                  You have no RFQs with status "{filter}" at the moment.
                </p>
                <button
                  onClick={() => setFilter('all')}
                  className="text-amber-400 hover:text-amber-300 font-medium"
                >
                  View all requests
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {rfqs.map((rfq) => {
              const statusConfig = STATUS_CONFIG[rfq.status] || STATUS_CONFIG.open
              return (
                <Link
                  key={rfq.id}
                  href={`/rfq/${rfq.id}`}
                  className="block p-6 bg-white/5 rounded-xl border border-white/10 hover:border-amber-500/30 hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                          {rfq.category}
                        </h3>
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                        {(rfq.quoteCount || 0) > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs">
                            <FileText className="w-3 h-3" />
                            {rfq.quoteCount} {rfq.quoteCount === 1 ? 'quote' : 'quotes'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">{rfq.description}</p>
                      <div className="flex items-center gap-4 sm:gap-6 text-sm flex-wrap">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {rfq.quantity.toLocaleString()} units
                        </span>
                        {rfq.targetPrice && (
                          <span className="text-gray-500 flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            Target: ${rfq.targetPrice.toLocaleString()}
                          </span>
                        )}
                        {rfq.awardedAmount && (
                          <span className="text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Awarded: ${rfq.awardedAmount.toLocaleString()}
                          </span>
                        )}
                        <span className="text-gray-500 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(rfq.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-amber-500 group-hover:translate-x-1 transition-all flex-shrink-0 ml-4" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Refresh indicator */}
        {isRefreshing && (
          <div className="fixed bottom-6 right-6 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2 flex items-center gap-2 border border-white/20">
            <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
            <span className="text-sm text-gray-300">Refreshing...</span>
          </div>
        )}
      </div>
    </div>
  )
}
