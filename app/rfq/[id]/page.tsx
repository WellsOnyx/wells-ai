'use client'

/**
 * RFQ Detail Page
 * Shows full RFQ details, quotes, negotiation history, and actions
 */

import { useUser } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Loader2,
  ArrowLeft,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingDown,
  Sparkles,
  Play,
  Award,
  Truck,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Building,
  Calendar,
} from 'lucide-react'

interface Quote {
  id: string
  supplierId: string
  supplierName?: string
  unitPrice: number
  totalPrice: number
  leadTimeDays: number
  paymentTerms?: string
  status: string
  notes?: string
}

interface NegotiationMessage {
  role: string
  content: string
  round: number
  proposedTerms?: {
    unitPrice: number
    totalPrice: number
  }
}

interface Negotiation {
  id: string
  quoteId: string
  status: string
  outcome?: string
  currentRound: number
  maxRounds: number
  messages: NegotiationMessage[]
  finalTerms?: {
    unitPrice: number
    totalPrice: number
    leadTimeDays: number
  }
  savings?: number
  savingsPercentage?: number
}

interface Award {
  id: string
  quoteId: string
  amount: number
  status: string
  dealId?: string
  erpPoNumber?: string
}

interface Fulfillment {
  status: string
  trackingNumber?: string
  carrier?: string
  deliveryConfirmed: boolean
  estimatedDeliveryDate?: string
}

interface RFQDetail {
  id: string
  category: string
  description: string
  quantity: number
  targetPrice?: number
  urgency: string
  status: string
  createdAt: string
  constraints?: {
    maxTotalBudget?: number
    maxUnitPrice?: number
    negotiationAggression?: string
  }
  quotes: Quote[]
  negotiations: Negotiation[]
  award?: Award
  fulfillment?: Fulfillment
}

const STATUS_CONFIG: Record<string, { color: string; bgColor: string }> = {
  open: { color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  matched: { color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  quoting: { color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  negotiating: { color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  quoted: { color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  awarded: { color: 'text-green-400', bgColor: 'bg-green-500/20' },
  paid: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  fulfilling: { color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  completed: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  cancelled: { color: 'text-red-400', bgColor: 'bg-red-500/20' },
}

export default function RFQDetailPage() {
  const { user, isLoaded } = useUser()
  const params = useParams()
  const router = useRouter()
  const rfqId = params.id as string

  const [rfq, setRfq] = useState<RFQDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isNegotiating, setIsNegotiating] = useState(false)
  const [isAwarding, setIsAwarding] = useState(false)
  const [expandedNegotiation, setExpandedNegotiation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRFQ() {
      try {
        const res = await fetch(`/api/rfq/${rfqId}/complete`)
        const data = await res.json()
        if (data.success) {
          setRfq({
            id: data.rfq.id,
            category: data.rfq.category,
            description: data.rfq.description,
            quantity: data.rfq.quantity,
            targetPrice: data.rfq.targetPrice,
            urgency: data.rfq.urgency || 'standard',
            status: data.rfq.status,
            createdAt: data.rfq.createdAt,
            constraints: data.constraints,
            quotes: data.quotes || [],
            negotiations: data.negotiations || [],
            award: data.award,
            fulfillment: data.fulfillment,
          })
        } else {
          setError(data.error || 'Failed to load RFQ')
        }
      } catch (err) {
        console.error('Error fetching RFQ:', err)
        setError('Failed to load RFQ')
      } finally {
        setIsLoading(false)
      }
    }

    if (isLoaded && user && rfqId) {
      fetchRFQ()
    }
  }, [isLoaded, user, rfqId])

  const handleNegotiate = async (quoteId: string) => {
    setIsNegotiating(true)
    try {
      const res = await fetch(`/api/rfq/${rfqId}/negotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_and_run', quoteId }),
      })
      const data = await res.json()
      if (data.success) {
        // Refresh RFQ data
        window.location.reload()
      } else {
        setError(data.error || 'Negotiation failed')
      }
    } catch (err) {
      console.error('Error starting negotiation:', err)
      setError('Failed to start negotiation')
    } finally {
      setIsNegotiating(false)
    }
  }

  const handleAward = async (quoteId: string, negotiationId?: string) => {
    if (!confirm('Award this quote? This will create a deal and escrow.')) return

    setIsAwarding(true)
    try {
      const res = await fetch(`/api/rfq/${rfqId}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', quoteId, negotiationId }),
      })
      const data = await res.json()
      if (data.success) {
        window.location.reload()
      } else {
        setError(data.error || 'Award failed')
      }
    } catch (err) {
      console.error('Error awarding quote:', err)
      setError('Failed to award quote')
    } finally {
      setIsAwarding(false)
    }
  }

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    )
  }

  if (error || !rfq) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">{error || 'RFQ not found'}</h3>
          <Link href="/rfq" className="text-gold-500 hover:underline">
            Back to RFQs
          </Link>
        </div>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[rfq.status] || STATUS_CONFIG.open
  const hasActiveNegotiation = rfq.negotiations.some(n => n.status === 'active')
  const completedNegotiation = rfq.negotiations.find(n => n.outcome === 'agreement')

  return (
    <div className="min-h-screen text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-gold-500/3 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Back Button */}
        <Link
          href="/rfq"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to RFQs
        </Link>

        {/* Header */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{rfq.category}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color} ${statusConfig.bgColor}`}>
                  {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
                </span>
              </div>
              <p className="text-gray-400">{rfq.description}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Created</div>
              <div className="font-medium">{new Date(rfq.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Package className="w-4 h-4" />
                Quantity
              </div>
              <div className="text-xl font-bold">{rfq.quantity.toLocaleString()}</div>
            </div>
            {rfq.constraints?.maxTotalBudget && (
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <DollarSign className="w-4 h-4" />
                  Max Budget
                </div>
                <div className="text-xl font-bold">${rfq.constraints.maxTotalBudget.toLocaleString()}</div>
              </div>
            )}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <FileText className="w-4 h-4" />
                Quotes
              </div>
              <div className="text-xl font-bold">{rfq.quotes.length}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Urgency
              </div>
              <div className="text-xl font-bold capitalize">{rfq.urgency}</div>
            </div>
          </div>
        </div>

        {/* Award Section (if awarded) */}
        {rfq.award && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl border border-green-500/30 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Award className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-bold text-green-400">Awarded</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-400">Amount</div>
                <div className="text-lg font-bold">${rfq.award.amount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Status</div>
                <div className="text-lg font-bold capitalize">{rfq.award.status}</div>
              </div>
              {rfq.award.erpPoNumber && (
                <div>
                  <div className="text-sm text-gray-400">PO Number</div>
                  <div className="text-lg font-bold">{rfq.award.erpPoNumber}</div>
                </div>
              )}
              {rfq.award.dealId && (
                <div>
                  <div className="text-sm text-gray-400">Deal ID</div>
                  <div className="text-lg font-bold font-mono text-xs">{rfq.award.dealId.slice(0, 8)}...</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fulfillment Section (if exists) */}
        {rfq.fulfillment && (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Truck className="w-6 h-6 text-orange-400" />
              <h2 className="text-xl font-bold">Fulfillment</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-400">Status</div>
                <div className="text-lg font-bold capitalize">{rfq.fulfillment.status}</div>
              </div>
              {rfq.fulfillment.carrier && (
                <div>
                  <div className="text-sm text-gray-400">Carrier</div>
                  <div className="text-lg font-bold">{rfq.fulfillment.carrier}</div>
                </div>
              )}
              {rfq.fulfillment.trackingNumber && (
                <div>
                  <div className="text-sm text-gray-400">Tracking</div>
                  <div className="text-lg font-bold">{rfq.fulfillment.trackingNumber}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-400">Delivered</div>
                <div className="text-lg font-bold">
                  {rfq.fulfillment.deliveryConfirmed ? (
                    <span className="text-green-400">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quotes Section */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-gold-400" />
              <h2 className="text-xl font-bold">Quotes</h2>
            </div>
          </div>

          {rfq.quotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No quotes yet. Waiting for suppliers to respond.
            </div>
          ) : (
            <div className="space-y-4">
              {rfq.quotes.map((quote) => {
                const quoteNegotiation = rfq.negotiations.find(n => n.quoteId === quote.id)
                const isAwarded = rfq.award?.quoteId === quote.id

                return (
                  <div
                    key={quote.id}
                    className={`p-4 rounded-xl border ${
                      isAwarded
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Building className="w-5 h-5 text-gray-400" />
                          <h3 className="font-semibold">{quote.supplierName || 'Supplier'}</h3>
                          {isAwarded && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                              Awarded
                            </span>
                          )}
                          {quoteNegotiation?.outcome === 'agreement' && !isAwarded && (
                            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                              Negotiated
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">Unit Price</div>
                            <div className="font-medium">${quote.unitPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Total</div>
                            <div className="font-medium">${quote.totalPrice.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Lead Time</div>
                            <div className="font-medium">{quote.leadTimeDays} days</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Terms</div>
                            <div className="font-medium">{quote.paymentTerms || 'Net 30'}</div>
                          </div>
                        </div>

                        {/* Negotiation savings */}
                        {quoteNegotiation?.outcome === 'agreement' && quoteNegotiation.savings && (
                          <div className="mt-3 p-2 bg-green-500/10 rounded-lg inline-block">
                            <span className="text-green-400 text-sm">
                              <TrendingDown className="w-4 h-4 inline mr-1" />
                              Saved ${quoteNegotiation.savings.toLocaleString()} ({quoteNegotiation.savingsPercentage?.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {!rfq.award && (
                        <div className="flex flex-col gap-2 ml-4">
                          {!quoteNegotiation && !hasActiveNegotiation && (
                            <button
                              onClick={() => handleNegotiate(quote.id)}
                              disabled={isNegotiating}
                              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all disabled:opacity-50"
                            >
                              {isNegotiating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              Negotiate
                            </button>
                          )}
                          <button
                            onClick={() => handleAward(quote.id, quoteNegotiation?.id)}
                            disabled={isAwarding}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50"
                          >
                            {isAwarding ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Award className="w-4 h-4" />
                            )}
                            Award
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Negotiations Section */}
        {rfq.negotiations.length > 0 && (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold">AI Negotiations</h2>
            </div>

            <div className="space-y-4">
              {rfq.negotiations.map((neg) => (
                <div key={neg.id} className="border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedNegotiation(expandedNegotiation === neg.id ? null : neg.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        neg.outcome === 'agreement'
                          ? 'bg-green-500/20 text-green-400'
                          : neg.status === 'active'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {neg.outcome || neg.status}
                      </span>
                      <span className="text-gray-400">
                        Round {neg.currentRound} of {neg.maxRounds}
                      </span>
                      {neg.savings && (
                        <span className="text-green-400">
                          Saved ${neg.savings.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {expandedNegotiation === neg.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedNegotiation === neg.id && (
                    <div className="p-4 border-t border-white/10 space-y-3">
                      {neg.messages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === 'buyer_ai' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl px-4 py-2 ${
                              msg.role === 'buyer_ai'
                                ? 'bg-gold-500/20 text-gold-100'
                                : msg.role === 'supplier_ai'
                                ? 'bg-white/10'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            <div className="text-xs text-gray-500 mb-1">
                              {msg.role === 'buyer_ai' ? 'Your AI' : msg.role === 'supplier_ai' ? 'Supplier AI' : 'System'}
                              {' - Round ' + msg.round}
                            </div>
                            <p className="text-sm">{msg.content}</p>
                            {msg.proposedTerms && (
                              <div className="mt-2 text-xs text-gray-400">
                                Proposed: ${msg.proposedTerms.unitPrice}/unit (${msg.proposedTerms.totalPrice} total)
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {neg.finalTerms && (
                        <div className="mt-4 p-3 bg-green-500/10 rounded-xl">
                          <div className="text-sm font-medium text-green-400 mb-2">Final Terms</div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-gray-500">Unit Price</div>
                              <div className="font-medium">${neg.finalTerms.unitPrice.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Total</div>
                              <div className="font-medium">${neg.finalTerms.totalPrice.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Lead Time</div>
                              <div className="font-medium">{neg.finalTerms.leadTimeDays} days</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
