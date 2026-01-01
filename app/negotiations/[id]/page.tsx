'use client'

/**
 * Negotiation Room Detail Page
 *
 * Watch AI-to-AI negotiation in real-time
 * See each round as the AIs work toward agreement
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  ArrowLeft,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Pause,
  FastForward,
  DollarSign,
  TrendingDown,
  MessageSquare,
  Zap,
  Shield,
} from 'lucide-react'

interface NegotiationRound {
  round: number
  timestamp: string
  buyerAgent: {
    message: string
    proposedTerms: any
    satisfaction: number
  }
  sellerAgent: {
    message: string
    counterTerms: any
    satisfaction: number
  }
  convergence: number
  sticking_points: string[]
}

interface NegotiationRoom {
  id: string
  status: 'preparing' | 'negotiating' | 'agreed' | 'failed' | 'expired'
  buyer: { id: string; name: string; company?: string }
  seller: { id: string; name: string; company?: string }
  subject: string
  description?: string
  buyerMandate: any
  sellerMandate: any
  rounds: NegotiationRound[]
  currentRound: number
  maxRounds: number
  agreedTerms?: any
  failureReason?: string
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG = {
  preparing: { label: 'Preparing', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  negotiating: { label: 'Negotiating', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  agreed: { label: 'Deal Reached!', color: 'text-green-400', bg: 'bg-green-500/20' },
  failed: { label: 'No Agreement', color: 'text-red-400', bg: 'bg-red-500/20' },
  expired: { label: 'Expired', color: 'text-gray-400', bg: 'bg-gray-500/20' },
}

export default function NegotiationRoomPage() {
  const { user, isLoaded } = useUser()
  const params = useParams()
  const router = useRouter()
  const roomId = params.id as string

  const [room, setRoom] = useState<NegotiationRoom | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer')

  const roundsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchRoom()
  }, [roomId])

  useEffect(() => {
    roundsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room?.rounds])

  async function fetchRoom() {
    try {
      const res = await fetch(`/api/negotiate/${roomId}`)
      if (res.ok) {
        const data = await res.json()
        setRoom(data.room)
        setRole(data.role)
      } else if (res.status === 404) {
        router.push('/negotiations')
      }
    } catch (err) {
      console.error('Failed to fetch room:', err)
    } finally {
      setLoading(false)
    }
  }

  async function runNegotiation(mode: 'full' | 'step') {
    if (!room || running) return
    setRunning(true)

    try {
      const res = await fetch(`/api/negotiate/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })

      if (res.ok) {
        await fetchRoom()
      }
    } catch (err) {
      console.error('Failed to run negotiation:', err)
    } finally {
      setRunning(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Room not found</h2>
          <Link href="/negotiations" className="text-purple-400 hover:text-purple-300">
            Back to negotiations
          </Link>
        </div>
      </div>
    )
  }

  const config = STATUS_CONFIG[room.status]
  const canRun = room.status === 'preparing' || room.status === 'negotiating'

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/negotiations"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Negotiations</span>
            </Link>
            <div className="w-px h-6 bg-white/10" />
            <span className={`px-3 py-1 ${config.bg} rounded-full text-sm ${config.color}`}>
              {config.label}
            </span>
          </div>

          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">{room.subject}</h1>
          {room.description && (
            <p className="text-gray-400">{room.description}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Negotiation Rounds */}
          <div className="lg:col-span-2">
            {/* Controls */}
            {canRun && (
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => runNegotiation('step')}
                  disabled={running}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {running ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Next Round
                </button>
                <button
                  onClick={() => runNegotiation('full')}
                  disabled={running}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  <FastForward className="w-4 h-4" />
                  Run All
                </button>
                <span className="text-sm text-gray-500 ml-auto">
                  Round {room.currentRound} of {room.maxRounds}
                </span>
              </div>
            )}

            {/* Rounds */}
            <div className="space-y-6">
              {room.rounds.length === 0 ? (
                <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
                  <Bot className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Ready to negotiate</h3>
                  <p className="text-gray-500 mb-4">
                    Click "Next Round" to watch the AIs negotiate
                  </p>
                </div>
              ) : (
                room.rounds.map((round, i) => (
                  <div
                    key={round.round}
                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                  >
                    {/* Round Header */}
                    <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        Round {round.round}
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all"
                              style={{ width: `${round.convergence}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">{round.convergence}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="p-5 space-y-4">
                      {/* Buyer Agent */}
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Bot className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-blue-400">Your AI</span>
                            <span className="text-xs text-gray-500">
                              {round.buyerAgent.satisfaction}% satisfied
                            </span>
                          </div>
                          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl rounded-tl-sm">
                            <p className="text-sm text-white">{round.buyerAgent.message}</p>
                            {round.buyerAgent.proposedTerms?.price && (
                              <p className="text-xs text-blue-400 mt-2">
                                Proposed: ${round.buyerAgent.proposedTerms.price.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Seller Agent */}
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Bot className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-purple-400">Seller's AI</span>
                            <span className="text-xs text-gray-500">
                              {round.sellerAgent.satisfaction}% satisfied
                            </span>
                          </div>
                          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl rounded-tl-sm">
                            <p className="text-sm text-white">{round.sellerAgent.message}</p>
                            {round.sellerAgent.counterTerms?.price && (
                              <p className="text-xs text-purple-400 mt-2">
                                Counter: ${round.sellerAgent.counterTerms.price.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sticking Points */}
                      {round.sticking_points.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {round.sticking_points.map((point, j) => (
                            <span
                              key={j}
                              className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-400"
                            >
                              {point}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={roundsEndRef} />
            </div>

            {/* Agreement */}
            {room.status === 'agreed' && room.agreedTerms && (
              <div className="mt-6 p-6 bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/30 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">Deal Reached!</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-sm text-gray-400 mb-1">Final Price</p>
                    <p className="text-xl font-bold text-green-400">
                      ${room.agreedTerms.price?.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-sm text-gray-400 mb-1">Total Value</p>
                    <p className="text-xl font-bold text-white">
                      ${room.agreedTerms.totalValue?.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-sm text-gray-400 mb-1">Your Satisfaction</p>
                    <p className="text-xl font-bold text-blue-400">
                      {room.agreedTerms.buyerSatisfaction}%
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-sm text-gray-400 mb-1">Agreed in Round</p>
                    <p className="text-xl font-bold text-purple-400">
                      {room.agreedTerms.agreedOnRound}
                    </p>
                  </div>
                </div>

                <Link
                  href="/deals"
                  className="block w-full py-3 bg-green-600 hover:bg-green-500 text-white text-center font-medium rounded-xl transition-colors"
                >
                  View in Deals
                </Link>
              </div>
            )}

            {/* Failure */}
            {room.status === 'failed' && (
              <div className="mt-6 p-6 bg-red-900/20 border border-red-500/30 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <XCircle className="w-6 h-6 text-red-400" />
                  <h3 className="text-lg font-semibold text-white">No Agreement Reached</h3>
                </div>
                <p className="text-gray-400">{room.failureReason}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Parties */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Parties</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-blue-400 font-medium">B</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{room.buyer.name}</p>
                    <p className="text-xs text-gray-500">{room.buyer.company || 'Buyer'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-green-400 font-medium">S</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{room.seller.name}</p>
                    <p className="text-xs text-gray-500">{room.seller.company || 'Seller'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Mandate */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Your Mandate</h3>
              <div className="space-y-2 text-sm">
                {role === 'buyer' && room.buyerMandate && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Need</span>
                      <span className="text-white">{room.buyerMandate.requirement}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quantity</span>
                      <span className="text-white">{room.buyerMandate.quantity} {room.buyerMandate.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ideal Price</span>
                      <span className="text-green-400">${room.buyerMandate.idealPrice?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Max Price</span>
                      <span className="text-amber-400">${room.buyerMandate.maxPrice?.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* AI Info */}
            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/10 border border-purple-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-medium text-purple-400">AI Protection</h3>
              </div>
              <p className="text-sm text-gray-400">
                Your AI never reveals your maximum budget or dealbreakers to the other side.
                It negotiates strategically to get you the best possible deal.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
