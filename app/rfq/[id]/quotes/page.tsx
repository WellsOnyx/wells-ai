'use client'

/**
 * RFQ Quotes Comparison Page
 * Shows all quotes for an RFQ in a comparison table/grid
 * Highlights best price, fastest delivery, best value
 * Allows selecting a quote to award or start negotiation
 */

import { useUser } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import {
  Loader2,
  ArrowLeft,
  Package,
  Clock,
  DollarSign,
  TrendingDown,
  Sparkles,
  Award,
  Building,
  Calendar,
  ShieldCheck,
  Truck,
  FileText,
  CheckCircle,
  AlertCircle,
  Star,
  Zap,
  Trophy,
  MessageSquare,
  ArrowUpRight,
  Scale,
  Timer,
  Percent,
  Info,
} from 'lucide-react'

// Types matching the API response
interface Quote {
  id: string
  supplierId: string
  unitPrice: number
  quantity: number
  totalPrice: number
  currency: string
  leadTimeDays: number
  paymentTerms?: string
  warrantyMonths?: number
  shippingCost: number
  shippingMethod?: string
  validUntil?: string
  notes?: string
  aiGenerated: boolean
  aiConfidenceScore?: number
  status: string
  negotiationRound: number
  isInitialQuote: boolean
  supplier?: {
    id: string
    companyName: string
    contactEmail: string
  }
}

interface QuoteComparison {
  rfqId: string
  quotes: Quote[]
  recommendation?: {
    quoteId: string
    reason: string
    score: number
  }
  analysis: {
    lowestPrice: { quoteId: string; totalPrice: number }
    fastestDelivery: { quoteId: string; leadTimeDays: number }
    bestValue: { quoteId: string; score: number; reason: string }
  }
}

interface Constraints {
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
  minimumWarrantyMonths?: number
  autoNegotiate: boolean
  negotiationAggression: string
  maxNegotiationRounds: number
}

interface NegotiationInfo {
  quoteId: string
  status: string
  outcome?: string
  currentRound: number
  savings?: number
  savingsPercentage?: number
}

interface APIResponse {
  success: boolean
  quotes: Quote[]
  comparison: QuoteComparison
  constraints: Constraints | null
  meta: {
    rfqId: string
    rfqStatus: string
    quoteCount: number
    hasConstraints: boolean
  }
  error?: string
}

const QUOTE_STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  pending: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Pending' },
  active: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Active' },
  negotiating: { color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', label: 'Negotiating' },
  accepted: { color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Accepted' },
  rejected: { color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Rejected' },
  expired: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: 'Expired' },
  withdrawn: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: 'Withdrawn' },
}

export default function RFQQuotesComparisonPage() {
  const { user, isLoaded } = useUser()
  const params = useParams()
  const router = useRouter()
  const rfqId = params.id as string

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [comparison, setComparison] = useState<QuoteComparison | null>(null)
  const [constraints, setConstraints] = useState<Constraints | null>(null)
  const [negotiations, setNegotiations] = useState<NegotiationInfo[]>([])
  const [rfqStatus, setRfqStatus] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isNegotiating, setIsNegotiating] = useState<string | null>(null)
  const [isAwarding, setIsAwarding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)

  // Fetch quotes and comparison data
  useEffect(() => {
    async function fetchQuotes() {
      try {
        // Fetch quotes and negotiations in parallel
        const [quotesRes, negotiationsRes] = await Promise.all([
          fetch(`/api/rfq/${rfqId}/quotes`),
          fetch(`/api/rfq/${rfqId}/negotiate`),
        ])

        const quotesData: APIResponse = await quotesRes.json()
        const negotiationsData = await negotiationsRes.json()

        if (quotesData.success) {
          setQuotes(quotesData.quotes || [])
          setComparison(quotesData.comparison)
          setConstraints(quotesData.constraints)
          setRfqStatus(quotesData.meta?.rfqStatus || '')
        } else {
          setError(quotesData.error || 'Failed to load quotes')
        }

        if (negotiationsData.success) {
          setNegotiations(
            (negotiationsData.negotiations || []).map((n: any) => ({
              quoteId: n.quoteId,
              status: n.status,
              outcome: n.outcome,
              currentRound: n.currentRound,
              savings: n.totalPriceReduction,
              savingsPercentage: n.reductionPercentage,
            }))
          )
        }
      } catch (err) {
        console.error('Error fetching quotes:', err)
        setError('Failed to load quotes')
      } finally {
        setIsLoading(false)
      }
    }

    if (isLoaded && user && rfqId) {
      fetchQuotes()
    }
  }, [isLoaded, user, rfqId])

  // Get negotiation info for a quote
  const getNegotiationInfo = (quoteId: string): NegotiationInfo | undefined => {
    return negotiations.find((n) => n.quoteId === quoteId)
  }

  // Check if quote matches highlight criteria
  const isLowestPrice = (quoteId: string) => comparison?.analysis.lowestPrice.quoteId === quoteId
  const isFastestDelivery = (quoteId: string) => comparison?.analysis.fastestDelivery.quoteId === quoteId
  const isBestValue = (quoteId: string) => comparison?.analysis.bestValue.quoteId === quoteId
  const isRecommended = (quoteId: string) => comparison?.recommendation?.quoteId === quoteId

  // Check if quote meets constraints
  const meetsConstraints = useMemo(() => {
    if (!constraints) return {}
    const result: Record<string, { meets: boolean; issues: string[] }> = {}

    quotes.forEach((quote) => {
      const issues: string[] = []

      if (constraints.maxTotalBudget && quote.totalPrice > constraints.maxTotalBudget) {
        issues.push(`Exceeds budget by $${(quote.totalPrice - constraints.maxTotalBudget).toLocaleString()}`)
      }
      if (constraints.maxUnitPrice && quote.unitPrice > constraints.maxUnitPrice) {
        issues.push(`Unit price exceeds max by $${(quote.unitPrice - constraints.maxUnitPrice).toFixed(2)}`)
      }
      if (constraints.maxLeadTimeDays && quote.leadTimeDays > constraints.maxLeadTimeDays) {
        issues.push(`Lead time exceeds max by ${quote.leadTimeDays - constraints.maxLeadTimeDays} days`)
      }
      if (
        constraints.acceptablePaymentTerms.length > 0 &&
        quote.paymentTerms &&
        !constraints.acceptablePaymentTerms.includes(quote.paymentTerms)
      ) {
        issues.push(`Payment terms not acceptable`)
      }
      if (constraints.minimumWarrantyMonths && (!quote.warrantyMonths || quote.warrantyMonths < constraints.minimumWarrantyMonths)) {
        issues.push(`Warranty below minimum (${constraints.minimumWarrantyMonths} months required)`)
      }

      result[quote.id] = { meets: issues.length === 0, issues }
    })

    return result
  }, [quotes, constraints])

  // Handle negotiation start
  const handleNegotiate = async (quoteId: string) => {
    if (!confirm('Start AI negotiation for this quote? Wells will negotiate on your behalf.')) return

    setIsNegotiating(quoteId)
    try {
      const res = await fetch(`/api/rfq/${rfqId}/negotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_and_run', quoteId }),
      })
      const data = await res.json()
      if (data.success) {
        // Refresh the page to show updated negotiation status
        window.location.reload()
      } else {
        setError(data.error || 'Negotiation failed')
      }
    } catch (err) {
      console.error('Error starting negotiation:', err)
      setError('Failed to start negotiation')
    } finally {
      setIsNegotiating(null)
    }
  }

  // Handle award
  const handleAward = async (quoteId: string) => {
    const negotiation = getNegotiationInfo(quoteId)
    if (!confirm('Award this quote? This will create a deal and escrow for payment.')) return

    setIsAwarding(quoteId)
    try {
      const res = await fetch(`/api/rfq/${rfqId}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          negotiationId: negotiation?.status === 'completed' ? negotiation : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/rfq/${rfqId}`)
      } else {
        setError(data.error || 'Award failed')
      }
    } catch (err) {
      console.error('Error awarding quote:', err)
      setError('Failed to award quote')
    } finally {
      setIsAwarding(null)
    }
  }

  // Calculate stats
  const stats = useMemo(() => {
    if (quotes.length === 0) return null

    const prices = quotes.map((q) => q.totalPrice)
    const leadTimes = quotes.map((q) => q.leadTimeDays)

    return {
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgLeadTime: leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length,
      minLeadTime: Math.min(...leadTimes),
      maxLeadTime: Math.max(...leadTimes),
      priceSavingsPotential: ((Math.max(...prices) - Math.min(...prices)) / Math.max(...prices)) * 100,
    }
  }, [quotes])

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading quotes comparison...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">{error}</h3>
          <Link href={`/rfq/${rfqId}`} className="text-amber-500 hover:underline">
            Back to RFQ
          </Link>
        </div>
      </div>
    )
  }

  const hasActiveNegotiation = negotiations.some((n) => n.status === 'active')
  const isRFQAwarded = ['awarded', 'paid', 'fulfilling', 'completed'].includes(rfqStatus)

  return (
    <div className="min-h-screen text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Back Button */}
        <Link
          href={`/rfq/${rfqId}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to RFQ Details
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">
              Quote Comparison
            </h1>
            <p className="text-gray-400">
              {quotes.length} quote{quotes.length !== 1 ? 's' : ''} received - Compare pricing, delivery, and terms
            </p>
          </div>
          {comparison?.recommendation && (
            <div className="bg-gradient-to-r from-amber-500/20 to-green-500/20 rounded-xl border border-amber-500/30 p-4">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <Sparkles className="w-5 h-5" />
                <span className="font-semibold">AI Recommendation</span>
              </div>
              <p className="text-sm text-gray-300">{comparison.recommendation.reason}</p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {stats && quotes.length > 1 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                Price Range
              </div>
              <div className="text-lg font-bold">
                ${stats.minPrice.toLocaleString()} - ${stats.maxPrice.toLocaleString()}
              </div>
              {stats.priceSavingsPotential > 5 && (
                <div className="text-xs text-green-400 mt-1">
                  Up to {stats.priceSavingsPotential.toFixed(0)}% savings potential
                </div>
              )}
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Timer className="w-4 h-4" />
                Lead Time Range
              </div>
              <div className="text-lg font-bold">
                {stats.minLeadTime} - {stats.maxLeadTime} days
              </div>
              <div className="text-xs text-gray-500 mt-1">Avg: {stats.avgLeadTime.toFixed(0)} days</div>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Scale className="w-4 h-4" />
                Average Quote
              </div>
              <div className="text-lg font-bold">${stats.avgPrice.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <FileText className="w-4 h-4" />
                Total Quotes
              </div>
              <div className="text-lg font-bold">{quotes.length}</div>
              <div className="text-xs text-gray-500 mt-1">
                {quotes.filter((q) => q.aiGenerated).length} AI-generated
              </div>
            </div>
          </div>
        )}

        {/* Buyer Constraints Reference */}
        {constraints && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-8">
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <Info className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold">Your Constraints</h3>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {constraints.maxTotalBudget && (
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <span className="text-gray-400">Max Budget:</span>
                  <span className="text-white font-medium">${constraints.maxTotalBudget.toLocaleString()}</span>
                </div>
              )}
              {constraints.maxUnitPrice && (
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <span className="text-gray-400">Max Unit:</span>
                  <span className="text-white font-medium">${constraints.maxUnitPrice.toFixed(2)}</span>
                </div>
              )}
              {constraints.maxLeadTimeDays && (
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-gray-400">Max Lead Time:</span>
                  <span className="text-white font-medium">{constraints.maxLeadTimeDays} days</span>
                </div>
              )}
              {constraints.preferredPaymentTerms && (
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span className="text-gray-400">Preferred Terms:</span>
                  <span className="text-white font-medium">{constraints.preferredPaymentTerms}</span>
                </div>
              )}
              {constraints.minimumWarrantyMonths && (
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-gray-400">Min Warranty:</span>
                  <span className="text-white font-medium">{constraints.minimumWarrantyMonths} months</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span className="text-gray-400">Negotiation:</span>
                <span className="text-white font-medium capitalize">{constraints.negotiationAggression}</span>
              </div>
            </div>
          </div>
        )}

        {/* No Quotes State */}
        {quotes.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
            <Loader2 className="w-12 h-12 text-amber-500/50 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">Gathering quotes from suppliers</h3>
            <p className="text-gray-500">This usually takes 2-4 hours for initial responses</p>
          </div>
        ) : (
          /* Quotes Comparison Grid */
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-400">Best Price</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-400">Fastest Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-gray-400">Best Value</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-gray-400">AI Recommended</span>
              </div>
            </div>

            {/* Quotes Cards */}
            {quotes.map((quote) => {
              const negotiation = getNegotiationInfo(quote.id)
              const constraintCheck = meetsConstraints[quote.id]
              const statusConfig = QUOTE_STATUS_CONFIG[quote.status] || QUOTE_STATUS_CONFIG.pending
              const isSelected = selectedQuoteId === quote.id

              // Determine highlight badges
              const badges: { icon: React.ReactNode; label: string; color: string }[] = []
              if (isRecommended(quote.id)) {
                badges.push({ icon: <Star className="w-3 h-3" />, label: 'Recommended', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' })
              }
              if (isBestValue(quote.id)) {
                badges.push({ icon: <Trophy className="w-3 h-3" />, label: 'Best Value', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' })
              }
              if (isLowestPrice(quote.id)) {
                badges.push({ icon: <DollarSign className="w-3 h-3" />, label: 'Best Price', color: 'bg-green-500/20 text-green-400 border-green-500/30' })
              }
              if (isFastestDelivery(quote.id)) {
                badges.push({ icon: <Zap className="w-3 h-3" />, label: 'Fastest', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' })
              }

              return (
                <div
                  key={quote.id}
                  onClick={() => setSelectedQuoteId(isSelected ? null : quote.id)}
                  className={`rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/10 border-amber-500/50 ring-1 ring-amber-500/30'
                      : isRecommended(quote.id)
                      ? 'bg-gradient-to-r from-purple-500/5 to-amber-500/5 border-purple-500/30 hover:border-purple-500/50'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="p-6">
                    {/* Quote Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                          <Building className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{quote.supplier?.companyName || 'Supplier'}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color} ${statusConfig.bgColor}`}>
                              {statusConfig.label}
                            </span>
                            {quote.aiGenerated && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
                                AI Quote
                                {quote.aiConfidenceScore && ` (${quote.aiConfidenceScore}%)`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Highlight Badges */}
                      <div className="flex flex-wrap gap-2">
                        {badges.map((badge, i) => (
                          <span
                            key={i}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${badge.color}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Quote Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      {/* Unit Price */}
                      <div className={`p-3 rounded-lg ${isLowestPrice(quote.id) ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5'}`}>
                        <div className="text-gray-400 text-xs mb-1">Unit Price</div>
                        <div className={`text-lg font-bold ${isLowestPrice(quote.id) ? 'text-green-400' : ''}`}>
                          ${quote.unitPrice.toFixed(2)}
                        </div>
                        {constraints?.targetUnitPrice && (
                          <div className={`text-xs mt-1 ${quote.unitPrice <= constraints.targetUnitPrice ? 'text-green-400' : 'text-amber-400'}`}>
                            {quote.unitPrice <= constraints.targetUnitPrice ? 'At target' : `+$${(quote.unitPrice - constraints.targetUnitPrice).toFixed(2)}`}
                          </div>
                        )}
                      </div>

                      {/* Total Price */}
                      <div className={`p-3 rounded-lg ${isLowestPrice(quote.id) ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5'}`}>
                        <div className="text-gray-400 text-xs mb-1">Total Price</div>
                        <div className={`text-lg font-bold ${isLowestPrice(quote.id) ? 'text-green-400' : ''}`}>
                          ${quote.totalPrice.toLocaleString()}
                        </div>
                        {quote.shippingCost > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            +${quote.shippingCost.toFixed(2)} shipping
                          </div>
                        )}
                      </div>

                      {/* Lead Time */}
                      <div className={`p-3 rounded-lg ${isFastestDelivery(quote.id) ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-white/5'}`}>
                        <div className="text-gray-400 text-xs mb-1">Lead Time</div>
                        <div className={`text-lg font-bold ${isFastestDelivery(quote.id) ? 'text-blue-400' : ''}`}>
                          {quote.leadTimeDays} days
                        </div>
                        {constraints?.preferredLeadTimeDays && (
                          <div className={`text-xs mt-1 ${quote.leadTimeDays <= constraints.preferredLeadTimeDays ? 'text-green-400' : 'text-amber-400'}`}>
                            {quote.leadTimeDays <= constraints.preferredLeadTimeDays ? 'Meets preferred' : `+${quote.leadTimeDays - constraints.preferredLeadTimeDays} days`}
                          </div>
                        )}
                      </div>

                      {/* Payment Terms */}
                      <div className="p-3 rounded-lg bg-white/5">
                        <div className="text-gray-400 text-xs mb-1">Terms</div>
                        <div className="text-lg font-medium">{quote.paymentTerms || 'Net 30'}</div>
                        {quote.warrantyMonths && (
                          <div className="text-xs text-gray-500 mt-1">
                            {quote.warrantyMonths}mo warranty
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="p-3 rounded-lg bg-white/5">
                        <div className="text-gray-400 text-xs mb-1">Quantity</div>
                        <div className="text-lg font-bold">{quote.quantity.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Negotiation Status */}
                    {negotiation && (
                      <div className={`p-3 rounded-lg mb-4 ${
                        negotiation.outcome === 'agreement'
                          ? 'bg-green-500/10 border border-green-500/30'
                          : negotiation.status === 'active'
                          ? 'bg-cyan-500/10 border border-cyan-500/30'
                          : 'bg-gray-500/10 border border-gray-500/30'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className={`w-4 h-4 ${
                              negotiation.outcome === 'agreement' ? 'text-green-400' :
                              negotiation.status === 'active' ? 'text-cyan-400' : 'text-gray-400'
                            }`} />
                            <span className="text-sm font-medium">
                              {negotiation.outcome === 'agreement'
                                ? 'Negotiation Successful'
                                : negotiation.status === 'active'
                                ? `Negotiating (Round ${negotiation.currentRound})`
                                : `Negotiation ${negotiation.outcome || negotiation.status}`}
                            </span>
                          </div>
                          {negotiation.savings && negotiation.savings > 0 && (
                            <div className="flex items-center gap-1 text-green-400 text-sm">
                              <TrendingDown className="w-4 h-4" />
                              Saved ${negotiation.savings.toLocaleString()}
                              {negotiation.savingsPercentage && ` (${negotiation.savingsPercentage.toFixed(1)}%)`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Constraint Warnings */}
                    {constraintCheck && !constraintCheck.meets && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-red-400">Constraint Issues</div>
                            <ul className="text-xs text-red-300/80 mt-1 space-y-0.5">
                              {constraintCheck.issues.map((issue, i) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {quote.notes && (
                      <div className="text-sm text-gray-400 mb-4">
                        <span className="text-gray-500">Notes:</span> {quote.notes}
                      </div>
                    )}

                    {/* Valid Until */}
                    {quote.validUntil && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                        <Calendar className="w-3 h-3" />
                        Valid until {new Date(quote.validUntil).toLocaleDateString()}
                      </div>
                    )}

                    {/* Actions */}
                    {!isRFQAwarded && (
                      <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                        {/* Negotiate Button */}
                        {!negotiation && !hasActiveNegotiation && constraints?.autoNegotiate && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleNegotiate(quote.id)
                            }}
                            disabled={isNegotiating === quote.id}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all disabled:opacity-50"
                          >
                            {isNegotiating === quote.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                            Negotiate
                          </button>
                        )}

                        {/* Award Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAward(quote.id)
                          }}
                          disabled={isAwarding === quote.id}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all disabled:opacity-50 ${
                            isRecommended(quote.id) || isBestValue(quote.id)
                              ? 'bg-gradient-to-r from-amber-500 to-green-500 text-black font-semibold hover:opacity-90'
                              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          }`}
                        >
                          {isAwarding === quote.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Award className="w-4 h-4" />
                          )}
                          Award Quote
                        </button>

                        {/* View Details Link */}
                        <Link
                          href={`/rfq/${rfqId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-all ml-auto"
                        >
                          View RFQ
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                    )}

                    {/* Already Awarded Message */}
                    {isRFQAwarded && (
                      <div className="flex items-center gap-2 pt-4 border-t border-white/10 text-gray-500">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>This RFQ has been awarded</span>
                        <Link
                          href={`/rfq/${rfqId}`}
                          className="text-amber-400 hover:text-amber-300 ml-auto"
                        >
                          View Details
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Best Value Explanation */}
        {comparison?.analysis.bestValue && quotes.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-amber-500/10 to-green-500/10 rounded-xl border border-amber-500/20 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-amber-400">Best Value Analysis</h3>
            </div>
            <p className="text-gray-300">{comparison.analysis.bestValue.reason}</p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="text-gray-500">Value Score:</span>
              <span className="text-amber-400 font-bold">{comparison.analysis.bestValue.score}/100</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
