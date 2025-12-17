'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  Briefcase,
  DollarSign,
  Loader2,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Sparkles,
} from 'lucide-react'
import { AttrOffer, formatUsd, totalCommissionPct } from '@/lib/attribution/types'

export default function OffersPage() {
  const { isLoaded, isSignedIn } = useUser()
  const [offers, setOffers] = useState<AttrOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'closed'>('all')

  const fetchOffers = useCallback(async () => {
    try {
      const url = filter === 'all'
        ? '/api/attribution/offers'
        : `/api/attribution/offers?status=${filter}`
      const res = await fetch(url)
      const json = await res.json()
      setOffers(json.offers || [])
    } catch (error) {
      console.error('Failed to fetch offers:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchOffers()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, fetchOffers])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'draft':
        return <FileText className="w-4 h-4 text-gray-400" />
      case 'closed':
        return <CheckCircle className="w-4 h-4 text-blue-400" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400'
      case 'draft':
        return 'bg-gray-500/20 text-gray-400'
      case 'closed':
        return 'bg-blue-500/20 text-blue-400'
      case 'cancelled':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-yellow-500/20 text-yellow-400'
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="border-b border-white/10">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="h-4 w-32 bg-white/5 rounded animate-pulse mb-4" />
            <div className="flex items-center justify-between">
              <div>
                <div className="h-8 w-32 bg-white/5 rounded-lg animate-pulse mb-2" />
                <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-20 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Your Offers</h1>
              <p className="text-gray-400 mt-1">{offers.length} offers</p>
            </div>
            <Link
              href="/attribution/offers/create"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Create Offer
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'active', 'draft', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg capitalize transition ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Offers List */}
        {offers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white/5 rounded-xl border border-white/10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4"
            >
              <Briefcase className="w-8 h-8 text-purple-400" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">No offers yet</h3>
            <p className="text-gray-400 mb-6 max-w-sm mx-auto">
              Create your first offer to start earning commissions through your network
            </p>
            <Link
              href="/attribution/offers/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-all hover:scale-105"
            >
              <Sparkles className="w-4 h-4" />
              Create your first offer
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer, index) => (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={`/attribution/offers/${offer.id}`}
                  className="group block p-6 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-xl transition-all"
                  aria-label={`View offer: ${offer.title}`}
                >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold group-hover:text-purple-400 transition">
                        {offer.title}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(offer.status)}`}>
                        {offer.status}
                      </span>
                    </div>
                    {offer.description && (
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {offer.description}
                      </p>
                    )}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="font-semibold">{formatUsd(offer.value)}</span>
                      </div>
                      <div className="text-gray-400">
                        Commission: {totalCommissionPct(offer.commissions)}%
                      </div>
                      {offer.category && (
                        <span className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
                          {offer.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
