'use client'

/**
 * RFQ Detail Page
 * Comprehensive view of RFQ with tabs for quotes, negotiations, fulfillment
 *
 * Features:
 * - RFQ header with status and dates
 * - Requirements section (product, quantity, specs)
 * - Buyer constraints (budget, timeline, terms)
 * - Quotes comparison cards
 * - Negotiation history
 * - Award status
 * - Fulfillment tracking timeline
 * - Action buttons based on status
 */

import { useUser } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
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
  TrendingUp,
  Play,
  Award,
  Truck,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Building,
  Calendar,
  Shield,
  Settings,
  Target,
  Zap,
  RefreshCw,
  ExternalLink,
  MapPin,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Circle,
  XCircle,
  Eye,
  Edit2,
  Ban,
  Send,
  Scale,
  Timer,
  BadgeCheck,
  Box,
  ClipboardCheck,
} from 'lucide-react'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Quote {
  id: string
  supplierId: string
  supplierName?: string
  unitPrice: number
  totalPrice: number
  leadTimeDays: number
  paymentTerms?: string
  warrantyMonths?: number
  shippingCost?: number
  status: string
  notes?: string
  aiGenerated?: boolean
  aiConfidenceScore?: number
  validUntil?: string
  createdAt?: string
}

interface NegotiationMessage {
  id?: string
  role: string
  content: string
  round: number
  timestamp?: string
  proposedTerms?: {
    unitPrice: number
    totalPrice: number
    leadTimeDays?: number
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
    paymentTerms?: string
  }
  savings?: number
  savingsPercentage?: number
  startedAt?: string
  completedAt?: string
}

interface Award {
  id: string
  quoteId: string
  amount: number
  quantity?: number
  unitPrice?: number
  status: string
  dealId?: string
  escrowId?: string
  erpPoNumber?: string
  erpSyncStatus?: string
  awardedAt?: string
  supplierAcknowledgedAt?: string
  paymentCompletedAt?: string
}

interface Fulfillment {
  id?: string
  status: string
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  estimatedShipDate?: string
  actualShipDate?: string
  estimatedDeliveryDate?: string
  actualDeliveryDate?: string
  deliveryConfirmed: boolean
  deliveryConfirmedBy?: string
  deliveryConfirmedAt?: string
  deliveryProofUrl?: string
  inspectionRequired?: boolean
  inspectionStatus?: string
  hasIssues?: boolean
  issueDescription?: string
}

interface Constraints {
  id?: string
  maxTotalBudget?: number
  maxUnitPrice?: number
  targetTotalPrice?: number
  targetUnitPrice?: number
  requiredDeliveryDate?: string
  maxLeadTimeDays?: number
  preferredLeadTimeDays?: number
  acceptablePaymentTerms?: string[]
  preferredPaymentTerms?: string
  minimumWarrantyMonths?: number
  requiredCertifications?: string[]
  autoNegotiate?: boolean
  negotiationAggression?: string
  allowCounterOffers?: boolean
  maxNegotiationRounds?: number
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
  updatedAt?: string
  deliveryLocation?: string
  requiredCertifications?: string[]
  additionalRequirements?: string
  requestorName?: string
  requestorEmail?: string
  constraints?: Constraints
  quotes: Quote[]
  negotiations: Negotiation[]
  award?: Award
  fulfillment?: Fulfillment
  erpStatus?: {
    poCreated?: boolean
    poNumber?: string
    invoiceCreated?: boolean
    receiptCreated?: boolean
  }
  canComplete?: {
    ready: boolean
    blockers: string[]
  }
}

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

const STATUS_CONFIG: Record<string, {
  color: string
  bgColor: string
  icon: React.ReactNode
  label: string
}> = {
  open: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: <Circle className="w-4 h-4" />,
    label: 'Open'
  },
  matched: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    icon: <Target className="w-4 h-4" />,
    label: 'Matched'
  },
  quoting: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: <FileText className="w-4 h-4" />,
    label: 'Quoting'
  },
  negotiating: {
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    icon: <Scale className="w-4 h-4" />,
    label: 'Negotiating'
  },
  quoted: {
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    icon: <DollarSign className="w-4 h-4" />,
    label: 'Quoted'
  },
  awarded: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    icon: <Award className="w-4 h-4" />,
    label: 'Awarded'
  },
  payment_pending: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    icon: <CreditCard className="w-4 h-4" />,
    label: 'Payment Pending'
  },
  paid: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'Paid'
  },
  fulfilling: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    icon: <Truck className="w-4 h-4" />,
    label: 'Fulfilling'
  },
  delivered: {
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/20',
    icon: <Box className="w-4 h-4" />,
    label: 'Delivered'
  },
  completed: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: 'Completed'
  },
  cancelled: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: <XCircle className="w-4 h-4" />,
    label: 'Cancelled'
  },
  closed: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    icon: <Ban className="w-4 h-4" />,
    label: 'Closed'
  },
}

const FULFILLMENT_STEPS = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'processing', label: 'Processing', icon: Settings },
  { key: 'shipped', label: 'Shipped', icon: Send },
  { key: 'in_transit', label: 'In Transit', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
]

type TabKey = 'overview' | 'quotes' | 'negotiations' | 'fulfillment'

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RFQDetailPage() {
  const { user, isLoaded } = useUser()
  const params = useParams()
  const router = useRouter()
  const rfqId = params.id as string

  // State
  const [rfq, setRfq] = useState<RFQDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [expandedNegotiation, setExpandedNegotiation] = useState<string | null>(null)
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Action states
  const [isNegotiating, setIsNegotiating] = useState(false)
  const [isAwarding, setIsAwarding] = useState(false)
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  // Fetch RFQ data
  const fetchRFQ = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)

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
          updatedAt: data.rfq.updatedAt,
          deliveryLocation: data.rfq.deliveryLocation,
          requiredCertifications: data.rfq.requiredCertifications,
          additionalRequirements: data.rfq.additionalRequirements,
          requestorName: data.rfq.requestorName,
          requestorEmail: data.rfq.requestorEmail,
          constraints: data.constraints,
          quotes: data.quotes || [],
          negotiations: data.negotiations || [],
          award: data.award,
          fulfillment: data.fulfillment,
          erpStatus: data.erpStatus,
          canComplete: data.canComplete,
        })
        setError(null)
      } else {
        setError(data.error || 'Failed to load RFQ')
      }
    } catch (err) {
      console.error('Error fetching RFQ:', err)
      setError('Failed to load RFQ')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [rfqId])

  useEffect(() => {
    if (isLoaded && user && rfqId) {
      fetchRFQ()
    }
  }, [isLoaded, user, rfqId, fetchRFQ])

  // Action handlers
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
        fetchRFQ(true)
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
    if (!confirm('Award this quote? This will create a deal and escrow payment.')) return

    setIsAwarding(true)
    try {
      const res = await fetch(`/api/rfq/${rfqId}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', quoteId, negotiationId }),
      })
      const data = await res.json()
      if (data.success) {
        fetchRFQ(true)
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

  const handleConfirmDelivery = async () => {
    if (!confirm('Confirm delivery received? This will release payment to the supplier.')) return

    setIsConfirmingDelivery(true)
    try {
      const res = await fetch(`/api/rfq/${rfqId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_delivery', confirmedBy: user?.id }),
      })
      const data = await res.json()
      if (data.success) {
        fetchRFQ(true)
      } else {
        setError(data.error || 'Confirmation failed')
      }
    } catch (err) {
      console.error('Error confirming delivery:', err)
      setError('Failed to confirm delivery')
    } finally {
      setIsConfirmingDelivery(false)
    }
  }

  const handleComplete = async () => {
    if (!confirm('Complete this RFQ? This will finalize all records.')) return

    setIsCompleting(true)
    try {
      const res = await fetch(`/api/rfq/${rfqId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        fetchRFQ(true)
      } else {
        setError(data.error || 'Completion failed')
      }
    } catch (err) {
      console.error('Error completing RFQ:', err)
      setError('Failed to complete RFQ')
    } finally {
      setIsCompleting(false)
    }
  }

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading RFQ details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !rfq) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">{error || 'RFQ not found'}</h3>
          <p className="text-gray-500 mb-6">The requested RFQ could not be loaded.</p>
          <Link
            href="/rfq"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to RFQs
          </Link>
        </div>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[rfq.status] || STATUS_CONFIG.open
  const hasActiveNegotiation = rfq.negotiations.some(n => n.status === 'active')
  const completedNegotiation = rfq.negotiations.find(n => n.outcome === 'agreement')
  const canAward = ['quoted', 'negotiating'].includes(rfq.status) && rfq.quotes.length > 0
  const canConfirmDelivery = rfq.fulfillment &&
    ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(rfq.fulfillment.status) &&
    !rfq.fulfillment.deliveryConfirmed

  // Calculate totals for header
  const lowestQuote = rfq.quotes.length > 0
    ? rfq.quotes.reduce((min, q) => q.totalPrice < min.totalPrice ? q : min, rfq.quotes[0])
    : null
  const totalSavings = rfq.negotiations.reduce((sum, n) => sum + (n.savings || 0), 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10 max-w-7xl">
        {/* Back Button & Refresh */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/rfq"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to RFQs
          </Link>
          <button
            onClick={() => fetchRFQ(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-white/5 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400/70 text-sm hover:text-red-400">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* HEADER SECTION */}
        {/* ================================================================== */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  {rfq.category}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color} ${statusConfig.bgColor}`}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
                {rfq.urgency !== 'standard' && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    rfq.urgency === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    <Zap className="w-3 h-3" />
                    {rfq.urgency.charAt(0).toUpperCase() + rfq.urgency.slice(1)}
                  </span>
                )}
              </div>
              <p className="text-gray-400 max-w-2xl">{rfq.description}</p>
            </div>

            <div className="flex flex-col items-end gap-2 text-right">
              <div className="text-sm text-gray-500">
                Created {new Date(rfq.createdAt).toLocaleDateString()}
              </div>
              {rfq.updatedAt && rfq.updatedAt !== rfq.createdAt && (
                <div className="text-xs text-gray-600">
                  Updated {new Date(rfq.updatedAt).toLocaleDateString()}
                </div>
              )}
              <div className="text-xs text-gray-600 font-mono">
                ID: {rfq.id.slice(0, 8)}...
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Package className="w-4 h-4" />
                Quantity
              </div>
              <div className="text-xl font-bold">{rfq.quantity.toLocaleString()}</div>
            </div>

            {rfq.targetPrice && (
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Target className="w-4 h-4" />
                  Target Price
                </div>
                <div className="text-xl font-bold">${rfq.targetPrice.toLocaleString()}</div>
              </div>
            )}

            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <FileText className="w-4 h-4" />
                Quotes
              </div>
              <div className="text-xl font-bold">{rfq.quotes.length}</div>
            </div>

            {lowestQuote && (
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <TrendingDown className="w-4 h-4" />
                  Best Price
                </div>
                <div className="text-xl font-bold text-green-400">${lowestQuote.totalPrice.toLocaleString()}</div>
              </div>
            )}

            {totalSavings > 0 && (
              <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                  <TrendingDown className="w-4 h-4" />
                  AI Savings
                </div>
                <div className="text-xl font-bold text-green-400">${totalSavings.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================== */}
        {/* AWARD SECTION (if awarded) */}
        {/* ================================================================== */}
        {rfq.award && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl border border-green-500/30 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Award className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-400">Awarded</h2>
                <p className="text-green-400/70 text-sm">
                  {rfq.award.awardedAt && `Awarded on ${new Date(rfq.award.awardedAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-400">Total Amount</div>
                <div className="text-2xl font-bold text-white">${rfq.award.amount.toLocaleString()}</div>
              </div>
              {rfq.award.quantity && (
                <div>
                  <div className="text-sm text-gray-400">Quantity</div>
                  <div className="text-lg font-bold">{rfq.award.quantity.toLocaleString()}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-400">Status</div>
                <div className="text-lg font-bold capitalize">{rfq.award.status.replace('_', ' ')}</div>
              </div>
              {rfq.award.erpPoNumber && (
                <div>
                  <div className="text-sm text-gray-400">PO Number</div>
                  <div className="text-lg font-bold font-mono">{rfq.award.erpPoNumber}</div>
                </div>
              )}
            </div>

            {rfq.award.dealId && (
              <div className="mt-4 pt-4 border-t border-green-500/20">
                <Link
                  href={`/deals/${rfq.award.dealId}`}
                  className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Deal Details
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* FULFILLMENT TIMELINE (if in progress) */}
        {/* ================================================================== */}
        {rfq.fulfillment && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Truck className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Fulfillment</h2>
                  <p className="text-gray-400 text-sm">Track your order status</p>
                </div>
              </div>

              {canConfirmDelivery && (
                <button
                  onClick={handleConfirmDelivery}
                  disabled={isConfirmingDelivery}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50"
                >
                  {isConfirmingDelivery ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Confirm Delivery
                </button>
              )}
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="flex justify-between items-center mb-8">
                {FULFILLMENT_STEPS.map((step, index) => {
                  const currentIndex = FULFILLMENT_STEPS.findIndex(s => s.key === rfq.fulfillment?.status)
                  const isCompleted = index <= currentIndex
                  const isCurrent = index === currentIndex
                  const Icon = step.icon

                  return (
                    <div key={step.key} className="flex flex-col items-center flex-1 relative">
                      {/* Connector line */}
                      {index > 0 && (
                        <div
                          className={`absolute left-0 right-1/2 top-5 h-0.5 -translate-x-1/2 ${
                            index <= currentIndex ? 'bg-green-500' : 'bg-gray-700'
                          }`}
                        />
                      )}
                      {index < FULFILLMENT_STEPS.length - 1 && (
                        <div
                          className={`absolute left-1/2 right-0 top-5 h-0.5 translate-x-1/2 ${
                            index < currentIndex ? 'bg-green-500' : 'bg-gray-700'
                          }`}
                        />
                      )}

                      {/* Step indicator */}
                      <div
                        className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center ${
                          isCompleted
                            ? isCurrent
                              ? 'bg-green-500 text-white ring-4 ring-green-500/30'
                              : 'bg-green-500/20 text-green-400'
                            : 'bg-gray-800 text-gray-500'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <span className={`mt-2 text-xs font-medium ${
                        isCompleted ? 'text-green-400' : 'text-gray-500'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Fulfillment Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
              <div>
                <div className="text-sm text-gray-400">Status</div>
                <div className="font-medium capitalize">{rfq.fulfillment.status.replace('_', ' ')}</div>
              </div>
              {rfq.fulfillment.carrier && (
                <div>
                  <div className="text-sm text-gray-400">Carrier</div>
                  <div className="font-medium">{rfq.fulfillment.carrier}</div>
                </div>
              )}
              {rfq.fulfillment.trackingNumber && (
                <div>
                  <div className="text-sm text-gray-400">Tracking</div>
                  <div className="font-medium font-mono">
                    {rfq.fulfillment.trackingUrl ? (
                      <a
                        href={rfq.fulfillment.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                      >
                        {rfq.fulfillment.trackingNumber}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      rfq.fulfillment.trackingNumber
                    )}
                  </div>
                </div>
              )}
              {rfq.fulfillment.estimatedDeliveryDate && (
                <div>
                  <div className="text-sm text-gray-400">Est. Delivery</div>
                  <div className="font-medium">
                    {new Date(rfq.fulfillment.estimatedDeliveryDate).toLocaleDateString()}
                  </div>
                </div>
              )}
              {rfq.fulfillment.deliveryConfirmed && (
                <div>
                  <div className="text-sm text-gray-400">Delivered</div>
                  <div className="font-medium text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Confirmed
                  </div>
                </div>
              )}
            </div>

            {/* Issues Alert */}
            {rfq.fulfillment.hasIssues && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Issue Reported
                </div>
                <p className="text-gray-400 text-sm">{rfq.fulfillment.issueDescription}</p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TABS NAVIGATION */}
        {/* ================================================================== */}
        <div className="flex items-center gap-1 mb-6 bg-white/5 p-1 rounded-xl">
          {[
            { key: 'overview' as TabKey, label: 'Overview', icon: Eye },
            { key: 'quotes' as TabKey, label: `Quotes (${rfq.quotes.length})`, icon: FileText },
            { key: 'negotiations' as TabKey, label: `Negotiations (${rfq.negotiations.length})`, icon: MessageSquare },
            { key: 'fulfillment' as TabKey, label: 'Details', icon: ClipboardCheck },
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-amber-500 text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ================================================================== */}
        {/* TAB CONTENT */}
        {/* ================================================================== */}
        <div className="space-y-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              {/* Requirements Section */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Package className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold">Requirements</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Product/Service</div>
                      <div className="font-medium">{rfq.category}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Description</div>
                      <div className="text-gray-300">{rfq.description}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Quantity</div>
                      <div className="font-medium">{rfq.quantity.toLocaleString()} units</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {rfq.deliveryLocation && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Delivery Location</div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>{rfq.deliveryLocation}</span>
                        </div>
                      </div>
                    )}
                    {rfq.requiredCertifications && rfq.requiredCertifications.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Required Certifications</div>
                        <div className="flex flex-wrap gap-2">
                          {rfq.requiredCertifications.map((cert, i) => (
                            <span key={i} className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                              {cert}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {rfq.additionalRequirements && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Additional Requirements</div>
                        <div className="text-gray-300 text-sm">{rfq.additionalRequirements}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Buyer Constraints Section */}
              {rfq.constraints && (
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Shield className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold">Buyer Constraints</h3>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Budget Constraints */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Budget
                      </h4>
                      {rfq.constraints.maxTotalBudget && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Max Total</span>
                          <span className="font-medium">${rfq.constraints.maxTotalBudget.toLocaleString()}</span>
                        </div>
                      )}
                      {rfq.constraints.maxUnitPrice && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Max Unit</span>
                          <span className="font-medium">${rfq.constraints.maxUnitPrice.toFixed(2)}</span>
                        </div>
                      )}
                      {rfq.constraints.targetTotalPrice && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Target Total</span>
                          <span className="font-medium text-green-400">${rfq.constraints.targetTotalPrice.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Timeline Constraints */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Timeline
                      </h4>
                      {rfq.constraints.requiredDeliveryDate && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Deadline</span>
                          <span className="font-medium">{new Date(rfq.constraints.requiredDeliveryDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {rfq.constraints.maxLeadTimeDays && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Max Lead Time</span>
                          <span className="font-medium">{rfq.constraints.maxLeadTimeDays} days</span>
                        </div>
                      )}
                      {rfq.constraints.preferredLeadTimeDays && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Preferred</span>
                          <span className="font-medium text-green-400">{rfq.constraints.preferredLeadTimeDays} days</span>
                        </div>
                      )}
                    </div>

                    {/* Negotiation Settings */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Negotiation
                      </h4>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Auto-Negotiate</span>
                        <span className={`font-medium ${rfq.constraints.autoNegotiate ? 'text-green-400' : 'text-gray-500'}`}>
                          {rfq.constraints.autoNegotiate ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      {rfq.constraints.negotiationAggression && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Style</span>
                          <span className={`font-medium capitalize ${
                            rfq.constraints.negotiationAggression === 'aggressive' ? 'text-red-400' :
                            rfq.constraints.negotiationAggression === 'balanced' ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {rfq.constraints.negotiationAggression}
                          </span>
                        </div>
                      )}
                      {rfq.constraints.maxNegotiationRounds && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Max Rounds</span>
                          <span className="font-medium">{rfq.constraints.maxNegotiationRounds}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Terms */}
                  {rfq.constraints.acceptablePaymentTerms && rfq.constraints.acceptablePaymentTerms.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-sm text-gray-400 mb-2">Acceptable Payment Terms</div>
                      <div className="flex flex-wrap gap-2">
                        {rfq.constraints.acceptablePaymentTerms.map((term, i) => (
                          <span
                            key={i}
                            className={`px-2 py-1 text-xs rounded-full ${
                              term === rfq.constraints?.preferredPaymentTerms
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-white/10 text-gray-300'
                            }`}
                          >
                            {term}
                            {term === rfq.constraints?.preferredPaymentTerms && ' (preferred)'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4">
                {rfq.status === 'completed' && rfq.canComplete?.ready && (
                  <button
                    onClick={handleComplete}
                    disabled={isCompleting}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-600 text-black rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {isCompleting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    Complete RFQ
                  </button>
                )}

                {rfq.canComplete && !rfq.canComplete.ready && rfq.canComplete.blockers.length > 0 && (
                  <div className="text-sm text-gray-400">
                    <span className="text-yellow-400">Cannot complete yet:</span>{' '}
                    {rfq.canComplete.blockers.join(', ')}
                  </div>
                )}
              </div>
            </>
          )}

          {/* QUOTES TAB */}
          {activeTab === 'quotes' && (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <FileText className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Supplier Quotes</h3>
                    <p className="text-gray-400 text-sm">Compare pricing and terms from suppliers</p>
                  </div>
                </div>
              </div>

              {rfq.quotes.length === 0 ? (
                <div className="text-center py-12">
                  <Loader2 className="w-10 h-10 text-amber-500/50 animate-spin mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">Gathering quotes from suppliers...</p>
                  <p className="text-gray-500 text-sm mt-1">Usually takes 2-4 hours for initial responses</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rfq.quotes
                    .sort((a, b) => a.totalPrice - b.totalPrice)
                    .map((quote, index) => {
                      const quoteNegotiation = rfq.negotiations.find(n => n.quoteId === quote.id)
                      const isAwarded = rfq.award?.quoteId === quote.id
                      const isExpanded = expandedQuote === quote.id
                      const isBestPrice = index === 0

                      return (
                        <div
                          key={quote.id}
                          className={`rounded-xl border transition-all ${
                            isAwarded
                              ? 'bg-green-500/10 border-green-500/30'
                              : isBestPrice
                              ? 'bg-amber-500/5 border-amber-500/20'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          {/* Quote Header */}
                          <div
                            className="p-4 cursor-pointer"
                            onClick={() => setExpandedQuote(isExpanded ? null : quote.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Building className="w-5 h-5 text-gray-400" />
                                  <h4 className="font-semibold">{quote.supplierName || 'Supplier'}</h4>
                                  {isAwarded && (
                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                                      <Award className="w-3 h-3" />
                                      Awarded
                                    </span>
                                  )}
                                  {isBestPrice && !isAwarded && (
                                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                                      Best Price
                                    </span>
                                  )}
                                  {quoteNegotiation?.outcome === 'agreement' && (
                                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                                      Negotiated
                                    </span>
                                  )}
                                  {quote.aiGenerated && (
                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full flex items-center gap-1">
                                      <Zap className="w-3 h-3" />
                                      AI Generated
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div>
                                    <div className="text-xs text-gray-500">Unit Price</div>
                                    <div className="font-medium">${quote.unitPrice.toFixed(2)}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Total</div>
                                    <div className="font-medium text-lg">${quote.totalPrice.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Lead Time</div>
                                    <div className="font-medium">{quote.leadTimeDays} days</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Terms</div>
                                    <div className="font-medium">{quote.paymentTerms || 'Net 30'}</div>
                                  </div>
                                </div>

                                {quoteNegotiation?.outcome === 'agreement' && quoteNegotiation.savings && (
                                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-lg">
                                    <TrendingDown className="w-4 h-4 text-green-400" />
                                    <span className="text-green-400 text-sm font-medium">
                                      Saved ${quoteNegotiation.savings.toLocaleString()} ({quoteNegotiation.savingsPercentage?.toFixed(1)}%)
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Actions */}
                                {canAward && !rfq.award && (
                                  <div className="flex gap-2">
                                    {!quoteNegotiation && !hasActiveNegotiation && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleNegotiate(quote.id)
                                        }}
                                        disabled={isNegotiating}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all disabled:opacity-50 text-sm"
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
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleAward(quote.id, quoteNegotiation?.id)
                                      }}
                                      disabled={isAwarding}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50 text-sm"
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

                                <button className="p-1.5 text-gray-400 hover:text-white">
                                  {isExpanded ? (
                                    <ChevronUp className="w-5 h-5" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-white/10 pt-4">
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  {quote.warrantyMonths && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-400">Warranty</span>
                                      <span>{quote.warrantyMonths} months</span>
                                    </div>
                                  )}
                                  {quote.shippingCost !== undefined && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-400">Shipping</span>
                                      <span>${quote.shippingCost.toLocaleString()}</span>
                                    </div>
                                  )}
                                  {quote.validUntil && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-400">Valid Until</span>
                                      <span>{new Date(quote.validUntil).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                  {quote.aiConfidenceScore && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-400">AI Confidence</span>
                                      <span className="text-purple-400">{quote.aiConfidenceScore}%</span>
                                    </div>
                                  )}
                                </div>
                                {quote.notes && (
                                  <div>
                                    <div className="text-sm text-gray-400 mb-1">Notes</div>
                                    <p className="text-sm text-gray-300">{quote.notes}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )}

          {/* NEGOTIATIONS TAB */}
          {activeTab === 'negotiations' && (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">AI Negotiations</h3>
                  <p className="text-gray-400 text-sm">Wells AI negotiated with suppliers on your behalf</p>
                </div>
              </div>

              {rfq.negotiations.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No negotiations yet</p>
                  <p className="text-gray-500 text-sm mt-1">Select a quote and click "Negotiate" to start</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rfq.negotiations.map((neg) => {
                    const isExpanded = expandedNegotiation === neg.id
                    const quote = rfq.quotes.find(q => q.id === neg.quoteId)

                    return (
                      <div key={neg.id} className="border border-white/10 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedNegotiation(isExpanded ? null : neg.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              neg.outcome === 'agreement'
                                ? 'bg-green-500/20 text-green-400'
                                : neg.status === 'active'
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {neg.outcome === 'agreement' ? (
                                <BadgeCheck className="w-5 h-5" />
                              ) : neg.status === 'active' ? (
                                <Timer className="w-5 h-5 animate-pulse" />
                              ) : (
                                <MessageSquare className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{quote?.supplierName || 'Supplier'}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  neg.outcome === 'agreement'
                                    ? 'bg-green-500/20 text-green-400'
                                    : neg.status === 'active'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : neg.outcome === 'no_agreement'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {neg.outcome || neg.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                                <span>Round {neg.currentRound} of {neg.maxRounds}</span>
                                {neg.savings && (
                                  <span className="text-green-400">
                                    Saved ${neg.savings.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="p-4 border-t border-white/10 space-y-4 bg-white/[0.02]">
                            {/* Messages */}
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {neg.messages.map((msg, i) => (
                                <div
                                  key={i}
                                  className={`flex ${msg.role === 'buyer_ai' ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-xl px-4 py-3 ${
                                      msg.role === 'buyer_ai'
                                        ? 'bg-amber-500/20 text-amber-100'
                                        : msg.role === 'supplier_ai'
                                        ? 'bg-white/10'
                                        : 'bg-gray-500/20 text-gray-400'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                      {msg.role === 'buyer_ai' ? (
                                        <>
                                          <Zap className="w-3 h-3 text-amber-400" />
                                          Your AI
                                        </>
                                      ) : msg.role === 'supplier_ai' ? (
                                        <>
                                          <Building className="w-3 h-3" />
                                          Supplier AI
                                        </>
                                      ) : (
                                        'System'
                                      )}
                                      <span>- Round {msg.round}</span>
                                    </div>
                                    <p className="text-sm">{msg.content}</p>
                                    {msg.proposedTerms && (
                                      <div className="mt-2 pt-2 border-t border-white/10 text-xs text-gray-400">
                                        Proposed: ${msg.proposedTerms.unitPrice.toFixed(2)}/unit
                                        (${msg.proposedTerms.totalPrice.toLocaleString()} total)
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Final Terms */}
                            {neg.finalTerms && (
                              <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                                <div className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4" />
                                  Final Agreed Terms
                                </div>
                                <div className="grid grid-cols-4 gap-4 text-sm">
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
                                  {neg.finalTerms.paymentTerms && (
                                    <div>
                                      <div className="text-gray-500">Terms</div>
                                      <div className="font-medium">{neg.finalTerms.paymentTerms}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* DETAILS/FULFILLMENT TAB */}
          {activeTab === 'fulfillment' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* ERP Status */}
              {rfq.erpStatus && (
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Settings className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold">ERP Integration</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Purchase Order</span>
                      <span className={`flex items-center gap-2 ${rfq.erpStatus.poCreated ? 'text-green-400' : 'text-gray-500'}`}>
                        {rfq.erpStatus.poCreated ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            {rfq.erpStatus.poNumber || 'Created'}
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4" />
                            Pending
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Invoice</span>
                      <span className={`flex items-center gap-2 ${rfq.erpStatus.invoiceCreated ? 'text-green-400' : 'text-gray-500'}`}>
                        {rfq.erpStatus.invoiceCreated ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Created
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4" />
                            Pending
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Receipt</span>
                      <span className={`flex items-center gap-2 ${rfq.erpStatus.receiptCreated ? 'text-green-400' : 'text-gray-500'}`}>
                        {rfq.erpStatus.receiptCreated ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Created
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4" />
                            Pending
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Requestor Info */}
              {(rfq.requestorName || rfq.requestorEmail) && (
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Building className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold">Requestor</h3>
                  </div>

                  <div className="space-y-2">
                    {rfq.requestorName && (
                      <div>
                        <div className="text-sm text-gray-400">Name</div>
                        <div className="font-medium">{rfq.requestorName}</div>
                      </div>
                    )}
                    {rfq.requestorEmail && (
                      <div>
                        <div className="text-sm text-gray-400">Email</div>
                        <div className="font-medium">{rfq.requestorEmail}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Completion Blockers */}
              {rfq.canComplete && !rfq.canComplete.ready && rfq.canComplete.blockers.length > 0 && (
                <div className="bg-yellow-500/5 backdrop-blur-xl rounded-2xl border border-yellow-500/20 p-6 md:col-span-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    </div>
                    <h3 className="text-lg font-bold text-yellow-400">Completion Blockers</h3>
                  </div>

                  <ul className="space-y-2">
                    {rfq.canComplete.blockers.map((blocker, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <XCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
