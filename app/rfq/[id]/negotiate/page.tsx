'use client'

/**
 * RFQ Negotiation Page
 * Interactive page for AI-to-AI negotiation with real-time status updates
 */

import { useUser } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  ArrowLeft,
  MessageSquare,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  TrendingDown,
  DollarSign,
  Clock,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Target,
  Zap,
  Award,
  ArrowRight,
  Bot,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface QuoteTerms {
  unitPrice: number
  quantity: number
  totalPrice: number
  leadTimeDays: number
  paymentTerms: string
  warrantyMonths?: number
  shippingCost: number
}

interface NegotiationMessage {
  id: string
  role: 'buyer_ai' | 'supplier_ai' | 'system'
  content: string
  proposedTerms?: Partial<QuoteTerms>
  timestamp: string
  round: number
}

interface RFQConstraints {
  id: string
  rfqId: string
  maxTotalBudget?: number
  maxUnitPrice?: number
  targetTotalPrice?: number
  targetUnitPrice?: number
  maxLeadTimeDays?: number
  preferredLeadTimeDays?: number
  acceptablePaymentTerms: string[]
  preferredPaymentTerms?: string
  autoNegotiate: boolean
  negotiationAggression: 'conservative' | 'balanced' | 'aggressive'
  maxNegotiationRounds: number
}

interface RFQNegotiation {
  id: string
  rfqId: string
  quoteId: string
  supplierId: string
  buyerConstraints: RFQConstraints
  initialSupplierPosition: QuoteTerms
  currentSupplierPosition?: QuoteTerms
  status: 'active' | 'paused' | 'completed' | 'failed' | 'timeout' | 'buyer_accepted' | 'supplier_withdrawn'
  currentRound: number
  maxRounds: number
  messages: NegotiationMessage[]
  outcome?: 'agreement' | 'no_agreement' | 'buyer_accepted' | 'supplier_withdrew' | 'timeout' | 'manual_override'
  finalTerms?: QuoteTerms
  startedAt: string
  lastActivityAt: string
  completedAt?: string
  totalPriceReduction?: number
  reductionPercentage?: number
  roundsUsed?: number
}

interface NegotiationSummary {
  total: number
  active: number
  completed: number
  agreements: number
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getStatusConfig = (status: string, outcome?: string) => {
  if (outcome === 'agreement') {
    return { color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Agreement Reached' }
  }
  switch (status) {
    case 'active':
      return { color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', label: 'Negotiating' }
    case 'paused':
      return { color: 'text-amber-400', bgColor: 'bg-amber-500/20', label: 'Paused' }
    case 'completed':
      return { color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Completed' }
    case 'failed':
      return { color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Failed' }
    case 'timeout':
      return { color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: 'Timed Out' }
    case 'buyer_accepted':
      return { color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Buyer Accepted' }
    case 'supplier_withdrawn':
      return { color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Supplier Withdrew' }
    default:
      return { color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: status }
  }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function NegotiatePage() {
  const { user, isLoaded } = useUser()
  const params = useParams()
  const router = useRouter()
  const rfqId = params.id as string

  // State
  const [negotiations, setNegotiations] = useState<RFQNegotiation[]>([])
  const [activeNegotiation, setActiveNegotiation] = useState<RFQNegotiation | null>(null)
  const [summary, setSummary] = useState<NegotiationSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActioning, setIsActioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Polling interval for real-time feel
  const POLL_INTERVAL = 3000 // 3 seconds

  // Fetch negotiation data
  const fetchNegotiations = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfq/${rfqId}/negotiate`)
      const data = await res.json()

      if (data.success) {
        setNegotiations(data.negotiations || [])
        setActiveNegotiation(data.activeNegotiation || null)
        setSummary(data.summary || null)
        setLastUpdated(new Date())
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch negotiation data')
      }
    } catch (err) {
      console.error('Error fetching negotiations:', err)
      setError('Failed to fetch negotiation data')
    } finally {
      setIsLoading(false)
    }
  }, [rfqId])

  // Initial fetch and polling
  useEffect(() => {
    if (isLoaded && user && rfqId) {
      fetchNegotiations()

      // Set up polling for active negotiations
      const interval = setInterval(() => {
        if (activeNegotiation?.status === 'active') {
          fetchNegotiations()
        }
      }, POLL_INTERVAL)

      return () => clearInterval(interval)
    }
  }, [isLoaded, user, rfqId, fetchNegotiations, activeNegotiation?.status])

  // Action handlers
  const handleAction = async (action: string, negotiationId?: string) => {
    setIsActioning(true)
    setError(null)

    try {
      const res = await fetch(`/api/rfq/${rfqId}/negotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, negotiationId }),
      })

      const data = await res.json()

      if (data.success) {
        await fetchNegotiations()
      } else {
        setError(data.error || `Failed to ${action}`)
      }
    } catch (err) {
      console.error(`Error performing ${action}:`, err)
      setError(`Failed to ${action}`)
    } finally {
      setIsActioning(false)
    }
  }

  const handleRunRound = () => {
    if (activeNegotiation) {
      handleAction('run', activeNegotiation.id)
    }
  }

  const handleAccept = () => {
    if (activeNegotiation && confirm('Accept the current offer? This will end the negotiation.')) {
      handleAction('accept', activeNegotiation.id)
    }
  }

  const handleReject = () => {
    if (activeNegotiation && confirm('Reject and walk away? This will end the negotiation without a deal.')) {
      handleAction('reject', activeNegotiation.id)
    }
  }

  const handlePause = () => {
    if (activeNegotiation) {
      handleAction('pause', activeNegotiation.id)
    }
  }

  const handleResume = () => {
    if (activeNegotiation) {
      handleAction('resume', activeNegotiation.id)
    }
  }

  // Calculate savings
  const calculateSavings = (negotiation: RFQNegotiation) => {
    const initial = negotiation.initialSupplierPosition.totalPrice
    const current = negotiation.currentSupplierPosition?.totalPrice || initial
    const saved = initial - current
    const percentage = (saved / initial) * 100
    return { saved, percentage }
  }

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading negotiation...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && negotiations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">{error}</h3>
          <Link href={`/rfq/${rfqId}`} className="text-gold-500 hover:underline">
            Back to RFQ
          </Link>
        </div>
      </div>
    )
  }

  // No negotiations yet
  if (negotiations.length === 0) {
    return (
      <div className="min-h-screen text-white">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-8 relative z-10">
          <Link
            href={`/rfq/${rfqId}`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to RFQ
          </Link>

          <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No Active Negotiations</h3>
            <p className="text-gray-500 mb-6">Start a negotiation from the RFQ page by selecting a quote to negotiate.</p>
            <Link
              href={`/rfq/${rfqId}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gold-400 to-gold-600 text-black rounded-xl font-semibold hover:opacity-90 transition-all"
            >
              <ArrowRight className="w-5 h-5" />
              View Quotes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Main negotiation view
  const currentNegotiation = activeNegotiation || negotiations[0]
  const statusConfig = getStatusConfig(currentNegotiation.status, currentNegotiation.outcome)
  const savings = calculateSavings(currentNegotiation)
  const isActive = currentNegotiation.status === 'active'
  const isPaused = currentNegotiation.status === 'paused'
  const isCompleted = currentNegotiation.status === 'completed' || currentNegotiation.outcome

  return (
    <div className="min-h-screen text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Back Button & Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/rfq/${rfqId}`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to RFQ
          </Link>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <RefreshCw className={`w-4 h-4 ${isActive ? 'animate-spin' : ''}`} />
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* Status Header */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="w-6 h-6 text-cyan-400" />
                <h1 className="text-2xl font-bold">AI Negotiation</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color} ${statusConfig.bgColor}`}>
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-gray-400">Wells AI is negotiating with the supplier AI on your behalf</p>
            </div>
            {isActive && (
              <div className="flex items-center gap-2 text-cyan-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <span className="text-sm font-medium">Live</span>
              </div>
            )}
          </div>

          {/* Progress Indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Negotiation Progress</span>
              <span className="text-sm font-medium">
                Round {currentNegotiation.currentRound} of {currentNegotiation.maxRounds}
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(currentNegotiation.currentRound / currentNegotiation.maxRounds) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Started</span>
              <span>{currentNegotiation.maxRounds - currentNegotiation.currentRound} rounds remaining</span>
            </div>
          </div>

          {/* Action Buttons */}
          {!isCompleted && (
            <div className="flex flex-wrap gap-3">
              {isActive && (
                <>
                  <button
                    onClick={handleRunRound}
                    disabled={isActioning}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {isActioning ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                    Run Next Round
                  </button>
                  <button
                    onClick={handlePause}
                    disabled={isActioning}
                    className="flex items-center gap-2 px-4 py-3 bg-amber-500/20 text-amber-400 rounded-xl font-medium hover:bg-amber-500/30 transition-all disabled:opacity-50"
                  >
                    <Pause className="w-5 h-5" />
                    Pause
                  </button>
                </>
              )}
              {isPaused && (
                <button
                  onClick={handleResume}
                  disabled={isActioning}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isActioning ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  Resume Negotiation
                </button>
              )}
              {(isActive || isPaused) && (
                <>
                  <button
                    onClick={handleAccept}
                    disabled={isActioning}
                    className="flex items-center gap-2 px-4 py-3 bg-green-500/20 text-green-400 rounded-xl font-medium hover:bg-green-500/30 transition-all disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Accept Offer
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={isActioning}
                    className="flex items-center gap-2 px-4 py-3 bg-red-500/20 text-red-400 rounded-xl font-medium hover:bg-red-500/30 transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    Walk Away
                  </button>
                </>
              )}
            </div>
          )}

          {/* Completed Actions */}
          {isCompleted && currentNegotiation.outcome === 'agreement' && (
            <Link
              href={`/rfq/${rfqId}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all"
            >
              <Award className="w-5 h-5" />
              View & Award Quote
            </Link>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Terms Comparison */}
          <div className="lg:col-span-1 space-y-6">
            {/* Savings Card */}
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl border border-green-500/30 p-6">
              <div className="flex items-center gap-3 mb-4">
                <TrendingDown className="w-6 h-6 text-green-400" />
                <h3 className="text-lg font-bold text-green-400">Savings Achieved</h3>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatCurrency(savings.saved)}
              </div>
              <div className="text-green-400 text-sm">
                {formatPercentage(savings.percentage)} below initial quote
              </div>
            </div>

            {/* Current Terms vs Original */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-gold-400" />
                Terms Comparison
              </h3>

              <div className="space-y-4">
                {/* Unit Price */}
                <div>
                  <div className="text-sm text-gray-400 mb-2">Unit Price</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Original</div>
                      <div className="font-medium line-through text-gray-500">
                        {formatCurrency(currentNegotiation.initialSupplierPosition.unitPrice)}
                      </div>
                    </div>
                    <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
                      <div className="text-xs text-cyan-400 mb-1">Current</div>
                      <div className="font-medium text-cyan-300">
                        {formatCurrency(currentNegotiation.currentSupplierPosition?.unitPrice || currentNegotiation.initialSupplierPosition.unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Price */}
                <div>
                  <div className="text-sm text-gray-400 mb-2">Total Price</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Original</div>
                      <div className="font-medium line-through text-gray-500">
                        {formatCurrency(currentNegotiation.initialSupplierPosition.totalPrice)}
                      </div>
                    </div>
                    <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
                      <div className="text-xs text-cyan-400 mb-1">Current</div>
                      <div className="font-medium text-cyan-300">
                        {formatCurrency(currentNegotiation.currentSupplierPosition?.totalPrice || currentNegotiation.initialSupplierPosition.totalPrice)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lead Time */}
                <div>
                  <div className="text-sm text-gray-400 mb-2">Lead Time</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Original</div>
                      <div className="font-medium text-gray-400">
                        {currentNegotiation.initialSupplierPosition.leadTimeDays} days
                      </div>
                    </div>
                    <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
                      <div className="text-xs text-cyan-400 mb-1">Current</div>
                      <div className="font-medium text-cyan-300">
                        {currentNegotiation.currentSupplierPosition?.leadTimeDays || currentNegotiation.initialSupplierPosition.leadTimeDays} days
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Buyer Constraints */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Your Constraints
              </h3>
              <div className="space-y-3 text-sm">
                {currentNegotiation.buyerConstraints.maxTotalBudget && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Budget</span>
                    <span className="font-medium">{formatCurrency(currentNegotiation.buyerConstraints.maxTotalBudget)}</span>
                  </div>
                )}
                {currentNegotiation.buyerConstraints.targetTotalPrice && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Target Price</span>
                    <span className="font-medium text-green-400">{formatCurrency(currentNegotiation.buyerConstraints.targetTotalPrice)}</span>
                  </div>
                )}
                {currentNegotiation.buyerConstraints.maxLeadTimeDays && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Lead Time</span>
                    <span className="font-medium">{currentNegotiation.buyerConstraints.maxLeadTimeDays} days</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Strategy</span>
                  <span className={`font-medium capitalize ${
                    currentNegotiation.buyerConstraints.negotiationAggression === 'aggressive' ? 'text-red-400' :
                    currentNegotiation.buyerConstraints.negotiationAggression === 'conservative' ? 'text-green-400' :
                    'text-amber-400'
                  }`}>
                    {currentNegotiation.buyerConstraints.negotiationAggression}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Negotiation Timeline */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  Negotiation Timeline
                </h3>
                <span className="text-sm text-gray-500">
                  {currentNegotiation.messages.length} messages
                </span>
              </div>

              {/* Messages */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {currentNegotiation.messages.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">Negotiation messages will appear here</p>
                  </div>
                ) : (
                  currentNegotiation.messages.map((msg, index) => (
                    <div
                      key={msg.id || index}
                      className={`flex ${msg.role === 'buyer_ai' ? 'justify-end' : msg.role === 'supplier_ai' ? 'justify-start' : 'justify-center'}`}
                    >
                      {msg.role === 'system' ? (
                        <div className="px-4 py-2 bg-gray-500/20 rounded-lg text-gray-400 text-sm text-center max-w-md">
                          {msg.content}
                        </div>
                      ) : (
                        <div
                          className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                            msg.role === 'buyer_ai'
                              ? 'bg-amber-500/20 border border-amber-500/30'
                              : 'bg-blue-500/20 border border-blue-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className={`w-4 h-4 ${msg.role === 'buyer_ai' ? 'text-amber-400' : 'text-blue-400'}`} />
                            <span className={`text-xs font-medium ${msg.role === 'buyer_ai' ? 'text-amber-400' : 'text-blue-400'}`}>
                              {msg.role === 'buyer_ai' ? 'Your AI' : 'Supplier AI'}
                            </span>
                            <span className="text-xs text-gray-500">
                              Round {msg.round}
                            </span>
                          </div>
                          <p className="text-sm text-gray-200 mb-3">{msg.content}</p>
                          {msg.proposedTerms && (
                            <div className={`mt-3 p-3 rounded-lg ${
                              msg.role === 'buyer_ai' ? 'bg-amber-500/10' : 'bg-blue-500/10'
                            }`}>
                              <div className="text-xs text-gray-400 mb-2">Proposed Terms:</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {msg.proposedTerms.unitPrice && (
                                  <div>
                                    <span className="text-gray-500">Unit: </span>
                                    <span className="font-medium">{formatCurrency(msg.proposedTerms.unitPrice)}</span>
                                  </div>
                                )}
                                {msg.proposedTerms.totalPrice && (
                                  <div>
                                    <span className="text-gray-500">Total: </span>
                                    <span className="font-medium">{formatCurrency(msg.proposedTerms.totalPrice)}</span>
                                  </div>
                                )}
                                {msg.proposedTerms.leadTimeDays && (
                                  <div>
                                    <span className="text-gray-500">Lead: </span>
                                    <span className="font-medium">{msg.proposedTerms.leadTimeDays} days</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="flex justify-center py-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 rounded-full">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                      <span className="text-sm text-cyan-400">Awaiting next round...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Final Terms (if agreement reached) */}
              {currentNegotiation.finalTerms && (
                <div className="mt-6 p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="font-bold text-green-400">Final Agreed Terms</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Unit Price</div>
                      <div className="font-bold text-white">{formatCurrency(currentNegotiation.finalTerms.unitPrice)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Total</div>
                      <div className="font-bold text-white">{formatCurrency(currentNegotiation.finalTerms.totalPrice)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Lead Time</div>
                      <div className="font-bold text-white">{currentNegotiation.finalTerms.leadTimeDays} days</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Saved</div>
                      <div className="font-bold text-green-400">{formatCurrency(savings.saved)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Stats (if multiple negotiations) */}
        {summary && negotiations.length > 1 && (
          <div className="mt-6 bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-bold mb-4">All Negotiations for this RFQ</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-sm text-gray-400">Total</div>
              </div>
              <div className="bg-cyan-500/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-cyan-400">{summary.active}</div>
                <div className="text-sm text-gray-400">Active</div>
              </div>
              <div className="bg-blue-500/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{summary.completed}</div>
                <div className="text-sm text-gray-400">Completed</div>
              </div>
              <div className="bg-green-500/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{summary.agreements}</div>
                <div className="text-sm text-gray-400">Agreements</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
