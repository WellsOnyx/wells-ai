'use client'

/**
 * Negotiations Page
 *
 * Watch AI-to-AI negotiations in real-time
 * Buyer ↔ Wells (Buyer) ↔ Wells (Supplier) ↔ Supplier
 * Humans never meet. AIs handle everything.
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Loader2,
  Plus,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Play,
  Eye,
  MessageSquare,
  TrendingDown,
  DollarSign,
} from 'lucide-react'

interface NegotiationRoom {
  id: string
  status: 'preparing' | 'negotiating' | 'agreed' | 'failed' | 'expired'
  buyer: { id: string; name: string; company?: string }
  seller: { id: string; name: string; company?: string }
  subject: string
  description?: string
  currentRound: number
  maxRounds: number
  agreedTerms?: {
    price: number
    quantity: number
    totalValue: number
    buyerSatisfaction: number
    sellerSatisfaction: number
  }
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG = {
  preparing: { label: 'Preparing', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Clock },
  negotiating: { label: 'Negotiating', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Bot },
  agreed: { label: 'Agreed', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle2 },
  failed: { label: 'No Deal', color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle },
  expired: { label: 'Expired', color: 'text-gray-400', bg: 'bg-gray-500/20', icon: Clock },
}

export default function NegotiationsPage() {
  const { user, isLoaded } = useUser()
  const [rooms, setRooms] = useState<NegotiationRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  useEffect(() => {
    fetchRooms()
  }, [])

  async function fetchRooms() {
    try {
      const res = await fetch('/api/negotiate')
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || [])
      }
    } catch (err) {
      console.error('Failed to fetch negotiations:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredRooms = rooms.filter(room => {
    if (filter === 'active') return room.status === 'negotiating' || room.status === 'preparing'
    if (filter === 'completed') return ['agreed', 'failed', 'expired'].includes(room.status)
    return true
  })

  const stats = {
    active: rooms.filter(r => r.status === 'negotiating').length,
    agreed: rooms.filter(r => r.status === 'agreed').length,
    totalSaved: rooms
      .filter(r => r.agreedTerms)
      .reduce((sum, r) => sum + (r.agreedTerms?.totalValue || 0) * 0.1, 0), // Estimate 10% savings
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-white">AI Negotiations</span>
              <p className="text-xs text-gray-500">Your AIs handle everything</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/deals"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              View Deals
            </Link>
            <UserButton
              appearance={{
                elements: { avatarBox: "w-8 h-8" }
              }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white mb-2">Your AI Negotiations</h1>
          <p className="text-gray-400">
            Watch as your AI negotiates with suppliers. You just approve the final deal.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-sm text-gray-400">Active</span>
            </div>
            <p className="text-2xl font-semibold text-white">{stats.active}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">Deals Made</span>
            </div>
            <p className="text-2xl font-semibold text-white">{stats.agreed}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm text-gray-400">Est. Savings</span>
            </div>
            <p className="text-2xl font-semibold text-white">${stats.totalSaved.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
            {(['all', 'active', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-md text-sm capitalize transition-colors ${
                  filter === f
                    ? 'bg-purple-600 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={fetchRooms}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 text-sm transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Negotiations List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No negotiations yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Tell Wells what you need. Your AI will find suppliers and negotiate the best deal.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
              Start a Conversation
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRooms.map(room => {
              const config = STATUS_CONFIG[room.status]
              const StatusIcon = config.icon

              return (
                <Link
                  key={room.id}
                  href={`/negotiations/${room.id}`}
                  className="block p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white">{room.subject}</h3>
                        <span className={`flex items-center gap-1 px-2 py-0.5 ${config.bg} rounded-full text-xs ${config.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </div>

                      <p className="text-sm text-gray-400 mb-3">
                        {room.description || `Negotiating with ${room.seller.name}`}
                      </p>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <span className="text-xs text-blue-400">B</span>
                          </div>
                          <span className="text-gray-500">{room.buyer.name}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-600" />
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
                            <Bot className="w-3 h-3 text-purple-400" />
                          </div>
                          <span className="text-gray-500">Wells AI</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-600" />
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                            <span className="text-xs text-green-400">S</span>
                          </div>
                          <span className="text-gray-500">{room.seller.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {room.status === 'negotiating' && (
                        <div className="flex items-center gap-2 text-purple-400 mb-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-sm">Round {room.currentRound}/{room.maxRounds}</span>
                        </div>
                      )}

                      {room.agreedTerms && (
                        <div className="text-right">
                          <p className="text-lg font-semibold text-green-400">
                            ${room.agreedTerms.totalValue.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {room.agreedTerms.buyerSatisfaction}% satisfaction
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-gray-500 mt-2 group-hover:text-white transition-colors">
                        <Eye className="w-4 h-4" />
                        <span className="text-sm">Watch</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* How It Works */}
        <div className="mt-12 p-6 bg-gradient-to-br from-purple-900/20 to-pink-900/10 border border-purple-500/20 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">How AI-to-AI Negotiation Works</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-sm text-white font-medium">You Tell Wells</p>
              <p className="text-xs text-gray-500 mt-1">"I need 1000 widgets"</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Bot className="w-6 h-6 text-purple-400" />
              </div>
              <p className="text-sm text-white font-medium">AIs Negotiate</p>
              <p className="text-xs text-gray-500 mt-1">Your AI vs Their AI</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-sm text-white font-medium">Best Deal Found</p>
              <p className="text-xs text-gray-500 mt-1">Optimal terms for you</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm text-white font-medium">You Approve</p>
              <p className="text-xs text-gray-500 mt-1">"Yes, proceed"</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
