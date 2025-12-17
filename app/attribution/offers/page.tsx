'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
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
          <div className="text-center py-16 bg-white/5 rounded-xl">
            <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No offers yet</p>
            <Link
              href="/attribution/offers/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Create your first offer
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => (
              <Link
                key={offer.id}
                href={`/attribution/offers/${offer.id}`}
                className="group block p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
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
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
