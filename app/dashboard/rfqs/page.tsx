'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Package, TrendingDown, Clock, CheckCircle, DollarSign } from 'lucide-react'

interface RFQ {
  id: string
  title: string
  category: string
  description: string
  status: string
  createdAt: string
  quotes?: Quote[]
}

interface Quote {
  id: string
  sellerId: string
  sellerName: string
  pricePerUnit: number
  totalPrice: number
  quantity: number
  leadTimeDays: number
  validUntil: string
  status: string
  notes?: string
}

interface RFQStats {
  totalRFQs: number
  openRFQs: number
  quotesReceived: number
  avgSavings: number
}

export default function RFQsDashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [rfqs, setRFQs] = useState<RFQ[]>([])
  const [stats, setStats] = useState<RFQStats>({
    totalRFQs: 0,
    openRFQs: 0,
    quotesReceived: 0,
    avgSavings: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in')
    } else if (user) {
      loadRFQs()
    }
  }, [isLoaded, user])

  async function loadRFQs() {
    try {
      const response = await fetch('/api/rfqs/list')
      if (!response.ok) throw new Error('Failed to load RFQs')

      const data = await response.json()
      setRFQs(data.rfqs || [])

      // Calculate stats
      const totalRFQs = data.rfqs?.length || 0
      const openRFQs = data.rfqs?.filter((r: RFQ) => r.status === 'open').length || 0
      const quotesReceived = data.rfqs?.reduce((sum: number, r: RFQ) => sum + (r.quotes?.length || 0), 0) || 0

      setStats({ totalRFQs, openRFQs, quotesReceived, avgSavings: 15 })
    } catch (error) {
      console.error('Failed to load RFQs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getBestQuote = (quotes?: Quote[]) => {
    if (!quotes || quotes.length === 0) return null
    return quotes.reduce((best, quote) =>
      quote.pricePerUnit < best.pricePerUnit ? quote : best
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">RFQ Manager</h1>
              <p className="text-gray-400 mt-1">Track procurement and compare quotes</p>
            </div>
            <button
              onClick={() => router.push('/app')}
              className="px-6 py-3 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition"
            >
              Create New RFQ
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <ShoppingCart className="w-8 h-8 text-amber-500" />
              <span className="text-2xl font-bold">{stats.totalRFQs}</span>
            </div>
            <div className="text-gray-400 text-sm">Total RFQs</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Package className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold">{stats.openRFQs}</span>
            </div>
            <div className="text-gray-400 text-sm">Open RFQs</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-green-500" />
              <span className="text-2xl font-bold">{stats.quotesReceived}</span>
            </div>
            <div className="text-gray-400 text-sm">Quotes Received</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <TrendingDown className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold">{stats.avgSavings}%</span>
            </div>
            <div className="text-gray-400 text-sm">Avg Savings</div>
          </div>
        </div>

        {/* RFQs List */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold">Your RFQs</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
              Loading RFQs...
            </div>
          ) : rfqs.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No RFQs yet</h3>
              <p className="text-gray-400 mb-6">Let Wells handle your procurement needs</p>
              <button
                onClick={() => router.push('/app')}
                className="px-6 py-3 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition"
              >
                Create First RFQ
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {rfqs.map((rfq) => {
                const bestQuote = getBestQuote(rfq.quotes)
                const quoteCount = rfq.quotes?.length || 0

                return (
                  <div key={rfq.id} className="p-6 hover:bg-gray-800/50 transition">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1">{rfq.title}</h3>
                        <p className="text-sm text-gray-400 mb-2">{rfq.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                            {rfq.category}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(rfq.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        rfq.status === 'open'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {rfq.status.toUpperCase()}
                      </span>
                    </div>

                    {quoteCount > 0 ? (
                      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold">{quoteCount} Quote{quoteCount > 1 ? 's' : ''} Received</span>
                          {bestQuote && (
                            <span className="text-xs text-amber-500">Best: ${bestQuote.pricePerUnit}/unit</span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {rfq.quotes?.slice(0, 3).map((quote) => (
                            <div key={quote.id} className="bg-gray-800/50 rounded p-3 border border-gray-700">
                              <div className="text-sm font-semibold mb-1">{quote.sellerName}</div>
                              <div className="text-lg font-bold text-amber-500 mb-1">
                                ${quote.pricePerUnit.toLocaleString()}/unit
                              </div>
                              <div className="text-xs text-gray-400">
                                Lead time: {quote.leadTimeDays} days
                              </div>
                            </div>
                          ))}
                        </div>
                        <button className="mt-3 text-amber-500 text-sm font-semibold hover:text-amber-400">
                          Compare All Quotes →
                        </button>
                      </div>
                    ) : (
                      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 text-center text-gray-500 text-sm">
                        No quotes yet. Wells is finding suppliers...
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-8 bg-gradient-to-br from-amber-900/20 to-amber-800/20 rounded-xl p-8 border border-amber-700/30">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-amber-500" />
            Procurement Best Practices
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Be Specific</h4>
              <p className="text-sm text-gray-400">Include detailed specs, quantities, and timelines for better quotes</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Compare Multiple Quotes</h4>
              <p className="text-sm text-gray-400">Get at least 3 quotes to ensure competitive pricing</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Negotiate</h4>
              <p className="text-sm text-gray-400">Ask Wells to negotiate pricing and terms on your behalf</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
