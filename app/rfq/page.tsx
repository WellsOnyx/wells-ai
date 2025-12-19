'use client'

/**
 * RFQ List Page
 * Shows all buyer's RFQs with status and quick actions
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
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  open: { color: 'text-blue-400 bg-blue-500/20', icon: <Clock className="w-4 h-4" />, label: 'Open' },
  matched: { color: 'text-purple-400 bg-purple-500/20', icon: <Package className="w-4 h-4" />, label: 'Matched' },
  quoting: { color: 'text-amber-400 bg-amber-500/20', icon: <FileText className="w-4 h-4" />, label: 'Quoting' },
  negotiating: { color: 'text-cyan-400 bg-cyan-500/20', icon: <TrendingDown className="w-4 h-4" />, label: 'Negotiating' },
  quoted: { color: 'text-indigo-400 bg-indigo-500/20', icon: <DollarSign className="w-4 h-4" />, label: 'Quoted' },
  awarded: { color: 'text-green-400 bg-green-500/20', icon: <CheckCircle className="w-4 h-4" />, label: 'Awarded' },
  completed: { color: 'text-emerald-400 bg-emerald-500/20', icon: <CheckCircle className="w-4 h-4" />, label: 'Completed' },
  cancelled: { color: 'text-red-400 bg-red-500/20', icon: <AlertCircle className="w-4 h-4" />, label: 'Cancelled' },
}

export default function RFQListPage() {
  const { user, isLoaded } = useUser()
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  useEffect(() => {
    async function fetchRFQs() {
      try {
        const res = await fetch('/api/rfq/list')
        const data = await res.json()
        if (data.success) {
          setRfqs(data.rfqs || [])
        }
      } catch (error) {
        console.error('Error fetching RFQs:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (isLoaded && user) {
      fetchRFQs()
    }
  }, [isLoaded, user])

  const filteredRFQs = rfqs.filter(rfq => {
    if (filter === 'all') return true
    if (filter === 'active') return !['completed', 'cancelled'].includes(rfq.status)
    if (filter === 'completed') return ['completed', 'cancelled'].includes(rfq.status)
    return true
  })

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-gold-500/3 rounded-full blur-3xl" />
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
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold-400 to-gold-600 text-black rounded-xl font-semibold hover:opacity-90 transition-all"
          >
            <Plus className="w-5 h-5" />
            New RFQ
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-gold-500 text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* RFQ List */}
        {filteredRFQs.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            {rfqs.length === 0 ? (
              <>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No procurement requests yet</h3>
                <p className="text-gray-500 mb-6">Just tell Wells what you need. AI will handle quotes, negotiate prices, and get you the best deal.</p>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gold-400 to-gold-600 text-black rounded-xl font-semibold hover:opacity-90 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  Talk to Wells
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  No {filter === 'active' ? 'active' : 'completed'} requests
                </h3>
                <p className="text-gray-500 mb-4">
                  {filter === 'active'
                    ? 'All your requests have been completed or cancelled.'
                    : 'You have no completed or cancelled requests yet.'}
                </p>
                <button
                  onClick={() => setFilter('all')}
                  className="text-gold-400 hover:text-gold-300 font-medium"
                >
                  View all requests
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRFQs.map((rfq) => {
              const statusConfig = STATUS_CONFIG[rfq.status] || STATUS_CONFIG.open
              return (
                <Link
                  key={rfq.id}
                  href={`/rfq/${rfq.id}`}
                  className="block p-6 bg-white/5 rounded-xl border border-white/10 hover:border-gold-500/30 hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white group-hover:text-gold-400 transition-colors">
                          {rfq.category}
                        </h3>
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">{rfq.description}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <span className="text-gray-500">
                          <Package className="w-4 h-4 inline mr-1" />
                          {rfq.quantity} units
                        </span>
                        {rfq.quoteCount !== undefined && (
                          <span className="text-gray-500">
                            <FileText className="w-4 h-4 inline mr-1" />
                            {rfq.quoteCount} quotes
                          </span>
                        )}
                        {rfq.awardedAmount && (
                          <span className="text-green-400">
                            <DollarSign className="w-4 h-4 inline mr-1" />
                            ${rfq.awardedAmount.toLocaleString()}
                          </span>
                        )}
                        <span className="text-gray-500">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {new Date(rfq.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-gold-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
