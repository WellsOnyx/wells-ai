'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  DollarSign,
  Users,
  Share2,
  CheckCircle,
  Loader2,
  Play,
  XCircle,
  ChevronRight,
  Gift,
} from 'lucide-react'
import {
  AttrOffer,
  AttrIntroduction,
  AttrClosure,
  formatUsd,
  formatGrain,
  usdToGrain,
} from '@/lib/attribution/types'
import { ConnectionWithUser } from '@/lib/attribution/types'

interface OfferData {
  offer: AttrOffer
  introductions: AttrIntroduction[]
  closures: AttrClosure[]
  stats: {
    introductions: number
    conversions: number
    totalValue: number
  }
}

export default function OfferDetailPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const params = useParams()
  const router = useRouter()
  const offerId = params.offerId as string

  const [data, setData] = useState<OfferData | null>(null)
  const [connections, setConnections] = useState<ConnectionWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showIntroduceModal, setShowIntroduceModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeForm, setCloseForm] = useState({ closerId: '', actualValue: '', notes: '' })

  const fetchData = useCallback(async () => {
    try {
      const [offerRes, connRes] = await Promise.all([
        fetch(`/api/attribution/offers/${offerId}`),
        fetch('/api/attribution/connections'),
      ])
      const offerJson = await offerRes.json()
      const connJson = await connRes.json()
      setData(offerJson)
      setConnections(connJson.connections || [])
    } catch (error) {
      console.error('Failed to fetch:', error)
    } finally {
      setLoading(false)
    }
  }, [offerId])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchData()
    }
  }, [isLoaded, isSignedIn, fetchData])

  const handleActivate = async () => {
    setActionLoading('activate')
    try {
      await fetch(`/api/attribution/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      })
      fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this offer?')) return
    setActionLoading('cancel')
    try {
      await fetch(`/api/attribution/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const handleIntroduce = async (recipientId: string, recipientName?: string) => {
    setActionLoading(recipientId)
    try {
      const res = await fetch(`/api/attribution/offers/${offerId}/introduce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, recipientName }),
      })
      if (res.ok) {
        setShowIntroduceModal(false)
        fetchData()
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleClose = async () => {
    if (!closeForm.closerId || !closeForm.actualValue) return
    setActionLoading('close')
    try {
      const res = await fetch(`/api/attribution/offers/${offerId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closerId: closeForm.closerId,
          actualValue: parseFloat(closeForm.actualValue),
          notes: closeForm.notes,
          autoVerify: true,
        }),
      })
      if (res.ok) {
        setShowCloseModal(false)
        fetchData()
      }
    } finally {
      setActionLoading(null)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  if (!data?.offer) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Offer not found</h1>
          <Link href="/attribution/offers" className="text-purple-400 hover:underline">
            Back to offers
          </Link>
        </div>
      </div>
    )
  }

  const { offer, introductions, closures, stats } = data
  const isOwner = offer.ownerId === user?.id

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href="/attribution/offers"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Offers
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{offer.title}</h1>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  offer.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  offer.status === 'closed' ? 'bg-blue-500/20 text-blue-400' :
                  offer.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {offer.status}
                </span>
              </div>
              {offer.description && (
                <p className="text-gray-400">{offer.description}</p>
              )}
            </div>

            {isOwner && offer.status === 'draft' && (
              <button
                onClick={handleActivate}
                disabled={actionLoading === 'activate'}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
              >
                {actionLoading === 'activate' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Activate
                  </>
                )}
              </button>
            )}

            {isOwner && offer.status === 'active' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowIntroduceModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                >
                  <Share2 className="w-4 h-4" />
                  Introduce
                </button>
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  Close Deal
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Deal Value</div>
            <div className="text-xl font-bold">{formatUsd(offer.value)}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Introductions</div>
            <div className="text-xl font-bold">{stats.introductions}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Conversions</div>
            <div className="text-xl font-bold text-green-400">{stats.conversions}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Total Closed</div>
            <div className="text-xl font-bold">{formatUsd(stats.totalValue)}</div>
          </div>
        </div>

        {/* Commission Structure */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
          <h2 className="text-lg font-semibold mb-4">Commission Structure</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { level: 'L1', pct: offer.commissions.l1 },
              { level: 'L2', pct: offer.commissions.l2 },
              { level: 'L3', pct: offer.commissions.l3 },
              { level: 'L4', pct: offer.commissions.l4 },
            ].map((l) => (
              <div key={l.level} className="text-center">
                <div className="text-2xl font-bold text-purple-400">{l.pct}%</div>
                <div className="text-sm text-gray-400">{l.level}</div>
                <div className="text-xs text-gray-500">
                  {formatUsd(offer.value * (l.pct / 100))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Introduction Chain */}
        {introductions.length > 0 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
            <h2 className="text-lg font-semibold mb-4">Attribution Chain</h2>
            <div className="space-y-3">
              {introductions.map((intro) => (
                <div
                  key={intro.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-bold">
                      L{intro.level}
                    </span>
                    <span>{intro.recipientName || intro.recipientId.slice(0, 8)}</span>
                  </div>
                  <span className={`text-sm ${
                    intro.status === 'converted' ? 'text-green-400' :
                    intro.status === 'interested' ? 'text-blue-400' :
                    'text-gray-400'
                  }`}>
                    {intro.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Closures */}
        {closures.length > 0 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-400" />
              Closed Deals
            </h2>
            <div className="space-y-3">
              {closures.map((closure) => (
                <div
                  key={closure.id}
                  className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{formatUsd(closure.actualValue)}</span>
                    <span className={`text-sm ${
                      closure.status === 'paid' ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {closure.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Closed by: {closure.closerName || closure.closerId}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancel button for active offers */}
        {isOwner && offer.status === 'active' && (
          <div className="mt-8 pt-8 border-t border-white/10">
            <button
              onClick={handleCancel}
              disabled={actionLoading === 'cancel'}
              className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
            >
              {actionLoading === 'cancel' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Cancel Offer
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Introduce Modal */}
      {showIntroduceModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Introduce to Connection</h2>
            <p className="text-gray-400 mb-6">
              Select a connection to introduce this offer to.
            </p>
            {connections.length === 0 ? (
              <p className="text-center py-8 text-gray-400">
                No connections yet.{' '}
                <Link href="/attribution/connections" className="text-purple-400 hover:underline">
                  Add connections first
                </Link>
              </p>
            ) : (
              <div className="space-y-2 mb-6">
                {connections.map((conn) => (
                  <button
                    key={conn.connectionId}
                    onClick={() => handleIntroduce(conn.userId, conn.displayName)}
                    disabled={actionLoading === conn.userId}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition"
                  >
                    <span>{conn.displayName || conn.email || conn.userId}</span>
                    {actionLoading === conn.userId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowIntroduceModal(false)}
              className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Close Deal Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-xl font-bold mb-4">Close Deal</h2>
            <p className="text-gray-400 mb-6">
              Record a closed deal and distribute commissions.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Who closed the deal?</label>
                <select
                  value={closeForm.closerId}
                  onChange={(e) => setCloseForm({ ...closeForm, closerId: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select person</option>
                  {introductions.map((intro) => (
                    <option key={intro.id} value={intro.recipientId}>
                      {intro.recipientName || intro.recipientId}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Final Deal Value (USD)</label>
                <input
                  type="number"
                  value={closeForm.actualValue}
                  onChange={(e) => setCloseForm({ ...closeForm, actualValue: e.target.value })}
                  placeholder={offer.value.toString()}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Notes (optional)</label>
                <textarea
                  value={closeForm.notes}
                  onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={!closeForm.closerId || !closeForm.actualValue || actionLoading === 'close'}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition flex items-center justify-center gap-2"
              >
                {actionLoading === 'close' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Close & Pay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
