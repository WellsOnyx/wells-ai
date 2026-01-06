'use client'

/**
 * Grain & Vault Faith Benevolence Management
 * grainandvault.com/faith/benevolence
 *
 * Manage benevolence requests with privacy-first design.
 * Request intake, approval workflow, and immediate disbursement.
 *
 * "Give to the one who asks you, and do not turn away from the one who wants to borrow from you."
 * - Matthew 5:42
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  HandHeart,
  Shield,
  Lock,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Eye,
  EyeOff,
  Send,
  DollarSign,
  Home,
  Zap,
  Heart,
  Truck,
  Pill,
  Utensils,
  MoreHorizontal,
  RefreshCw,
  Loader2,
  Check,
  X,
  Building2,
  FileText,
  User,
  Phone,
  Mail,
  Calendar
} from 'lucide-react'

// Types
interface BenevolenceRequest {
  id: string
  requestorName: string
  requestorContact?: string
  category: 'rent' | 'utilities' | 'medical' | 'food' | 'transportation' | 'funeral' | 'other'
  amountRequested: number
  amountApproved?: number
  description: string
  urgency: 'immediate' | 'within_week' | 'within_month'
  status: 'pending' | 'under_review' | 'approved' | 'denied' | 'disbursed' | 'closed'
  reviewedBy?: string
  reviewNotes?: string
  disbursementMethod?: 'check' | 'direct' | 'vendor_payment'
  vendorName?: string
  isConfidential: boolean
  createdAt: string
  updatedAt: string
}

// Mock data
const mockRequests: BenevolenceRequest[] = [
  {
    id: 'benev_001',
    requestorName: 'Johnson Family',
    requestorContact: '***-***-4521',
    category: 'utilities',
    amountRequested: 450,
    description: 'Electric bill past due, facing shutoff this week. Family of 4 with young children.',
    urgency: 'immediate',
    status: 'pending',
    isConfidential: true,
    createdAt: '2025-01-05T10:30:00Z',
    updatedAt: '2025-01-05T10:30:00Z',
  },
  {
    id: 'benev_002',
    requestorName: 'Williams, M.',
    requestorContact: '***-***-8832',
    category: 'rent',
    amountRequested: 1200,
    description: 'Lost job last month, behind on rent. Has new job starting next week but needs help this month.',
    urgency: 'within_week',
    status: 'pending',
    isConfidential: true,
    createdAt: '2025-01-04T14:15:00Z',
    updatedAt: '2025-01-04T14:15:00Z',
  },
  {
    id: 'benev_003',
    requestorName: 'Anonymous Member',
    category: 'medical',
    amountRequested: 800,
    description: 'Medical bills from emergency room visit. Insurance denied partial coverage.',
    urgency: 'within_week',
    status: 'pending',
    isConfidential: true,
    createdAt: '2025-01-03T09:00:00Z',
    updatedAt: '2025-01-03T09:00:00Z',
  },
  {
    id: 'benev_004',
    requestorName: 'Garcia Family',
    requestorContact: '***-***-1234',
    category: 'food',
    amountRequested: 300,
    amountApproved: 300,
    description: 'Temporary food assistance needed while waiting for first paycheck at new job.',
    urgency: 'immediate',
    status: 'approved',
    reviewedBy: 'Pastor Chen',
    reviewNotes: 'Approved full amount. Issue grocery store gift cards.',
    disbursementMethod: 'vendor_payment',
    vendorName: 'Kroger',
    isConfidential: false,
    createdAt: '2025-01-02T11:00:00Z',
    updatedAt: '2025-01-05T08:00:00Z',
  },
  {
    id: 'benev_005',
    requestorName: 'Thompson, S.',
    requestorContact: '***-***-9876',
    category: 'transportation',
    amountRequested: 500,
    amountApproved: 400,
    description: 'Car repair needed to get to work. Single parent with two jobs.',
    urgency: 'immediate',
    status: 'disbursed',
    reviewedBy: 'Elder Williams',
    reviewNotes: 'Approved $400 for essential repairs. Direct payment to auto shop.',
    disbursementMethod: 'vendor_payment',
    vendorName: 'Reliable Auto Repair',
    isConfidential: false,
    createdAt: '2025-01-01T16:00:00Z',
    updatedAt: '2025-01-04T10:00:00Z',
  },
]

// Category config
const categoryConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  rent: { icon: Home, color: 'blue', label: 'Rent/Housing' },
  utilities: { icon: Zap, color: 'amber', label: 'Utilities' },
  medical: { icon: Pill, color: 'red', label: 'Medical' },
  food: { icon: Utensils, color: 'emerald', label: 'Food' },
  transportation: { icon: Truck, color: 'purple', label: 'Transportation' },
  funeral: { icon: Heart, color: 'gray', label: 'Funeral' },
  other: { icon: MoreHorizontal, color: 'gray', label: 'Other' },
}

const urgencyConfig: Record<string, { color: string; label: string }> = {
  immediate: { color: 'red', label: 'Immediate' },
  within_week: { color: 'amber', label: 'Within Week' },
  within_month: { color: 'blue', label: 'Within Month' },
}

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'amber', label: 'Pending Review' },
  under_review: { color: 'blue', label: 'Under Review' },
  approved: { color: 'emerald', label: 'Approved' },
  denied: { color: 'red', label: 'Denied' },
  disbursed: { color: 'purple', label: 'Disbursed' },
  closed: { color: 'gray', label: 'Closed' },
}

export default function BenevolencePage() {
  const [requests, setRequests] = useState<BenevolenceRequest[]>(mockRequests)
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<BenevolenceRequest | null>(null)
  const [showNewRequestModal, setShowNewRequestModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterUrgency, setFilterUrgency] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAmounts, setShowAmounts] = useState(true)

  // Fund balance (mock)
  const benevolenceFundBalance = 42362.50
  const creditLineAvailable = 847250.00

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  const formatCurrency = (amount: number) => {
    if (!showAmounts) return '****'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const filteredRequests = requests.filter(req => {
    if (filterStatus !== 'all' && req.status !== filterStatus) return false
    if (filterUrgency !== 'all' && req.urgency !== filterUrgency) return false
    if (searchQuery && !req.requestorName.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const approvedCount = requests.filter(r => r.status === 'approved').length

  const getColorClasses = (color: string) => ({
    bg: `bg-${color}-500/20`,
    border: `border-${color}-500/30`,
    text: `text-${color}-400`,
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-black animate-spin" />
          </div>
          <p className="text-gray-400">Loading benevolence requests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link href="/grain-vault/faith/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <HandHeart className="w-5 h-5 text-black" />
                </div>
                <div>
                  <span className="text-lg font-semibold">Benevolence</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAmounts(!showAmounts)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title={showAmounts ? 'Hide amounts' : 'Show amounts'}
              >
                {showAmounts ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowNewRequestModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-black text-sm font-medium rounded-lg transition-all hover:from-amber-600 hover:to-orange-700"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Request</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Scripture Quote */}
        <p className="text-sm text-amber-400/50 italic text-center mb-8">
          "Give to the one who asks you, and do not turn away from the one who wants to borrow from you." - Matthew 5:42
        </p>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400">Pending</span>
            </div>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">Approved</span>
            </div>
            <p className="text-2xl font-bold">{approvedCount}</p>
          </div>
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400">Fund Balance</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(benevolenceFundBalance)}</p>
          </div>
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400">Credit Available</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(creditLineAvailable)}</p>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl mb-8 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold mb-1">Privacy Protected</p>
            <p className="text-sm text-gray-400">
              All benevolence requests are handled with strict confidentiality. Requestor information
              is only visible to authorized ministry staff. Contact details are partially masked.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="disbursed">Disbursed</option>
            <option value="denied">Denied</option>
          </select>
          <select
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All Urgency</option>
            <option value="immediate">Immediate</option>
            <option value="within_week">Within Week</option>
            <option value="within_month">Within Month</option>
          </select>
        </div>

        {/* Two-Column Layout */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Request List */}
          <div className="lg:col-span-2 space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
                <HandHeart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No requests match your filters</p>
              </div>
            ) : (
              filteredRequests.map((request) => {
                const category = categoryConfig[request.category]
                const urgency = urgencyConfig[request.urgency]
                const status = statusConfig[request.status]
                const CategoryIcon = category.icon
                const isSelected = selectedRequest?.id === request.id

                return (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className={`p-5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-${category.color}-500/20 flex items-center justify-center`}>
                          <CategoryIcon className={`w-5 h-5 text-${category.color}-400`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{request.requestorName}</p>
                            {request.isConfidential && (
                              <Lock className="w-3 h-3 text-gray-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-400">{category.label}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatCurrency(request.amountRequested)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded bg-${urgency.color}-500/20 text-${urgency.color}-400`}>
                          {urgency.label}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{request.description}</p>

                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full bg-${status.color}-500/20 text-${status.color}-400 font-medium`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Request Detail Panel */}
          <div className="lg:col-span-1">
            {selectedRequest ? (
              <div className="sticky top-24 bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg">Request Details</h3>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Requestor Info */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-semibold">{selectedRequest.requestorName}</p>
                      {selectedRequest.requestorContact && (
                        <p className="text-sm text-gray-400">{selectedRequest.requestorContact}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-4 mb-6">
                  <div className="p-3 bg-black/30 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Category</p>
                    <p className="font-medium capitalize">{categoryConfig[selectedRequest.category].label}</p>
                  </div>
                  <div className="p-3 bg-black/30 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Amount Requested</p>
                    <p className="text-xl font-bold text-amber-400">{formatCurrency(selectedRequest.amountRequested)}</p>
                  </div>
                  {selectedRequest.amountApproved && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <p className="text-xs text-emerald-400 mb-1">Amount Approved</p>
                      <p className="text-xl font-bold text-emerald-400">{formatCurrency(selectedRequest.amountApproved)}</p>
                    </div>
                  )}
                  <div className="p-3 bg-black/30 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-sm">{selectedRequest.description}</p>
                  </div>
                  {selectedRequest.reviewNotes && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-400 mb-1">Review Notes</p>
                      <p className="text-sm">{selectedRequest.reviewNotes}</p>
                      <p className="text-xs text-gray-500 mt-2">- {selectedRequest.reviewedBy}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {selectedRequest.status === 'pending' && (
                  <div className="space-y-3">
                    <button className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-black font-semibold rounded-lg flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-emerald-700 transition-all">
                      <CheckCircle className="w-5 h-5" />
                      Approve Request
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 font-medium rounded-lg text-sm hover:bg-blue-500/30 transition-colors">
                        Mark Under Review
                      </button>
                      <button className="py-2 bg-red-500/20 border border-red-500/30 text-red-400 font-medium rounded-lg text-sm hover:bg-red-500/30 transition-colors">
                        Deny Request
                      </button>
                    </div>
                  </div>
                )}

                {selectedRequest.status === 'approved' && (
                  <div className="space-y-3">
                    <button className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:from-purple-600 hover:to-purple-700 transition-all">
                      <Send className="w-5 h-5" />
                      Process Disbursement
                    </button>
                    <p className="text-xs text-gray-500 text-center">
                      Funds will be disbursed via {selectedRequest.disbursementMethod?.replace('_', ' ') || 'check'}
                      {selectedRequest.vendorName && ` to ${selectedRequest.vendorName}`}
                    </p>
                  </div>
                )}

                {selectedRequest.status === 'disbursed' && (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg text-center">
                    <CheckCircle className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                    <p className="font-semibold text-purple-400">Disbursement Complete</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {formatCurrency(selectedRequest.amountApproved || selectedRequest.amountRequested)} disbursed
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="sticky top-24 bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                  <HandHeart className="w-8 h-8 text-amber-400/50" />
                </div>
                <p className="text-gray-400 mb-2">Select a request to view details</p>
                <p className="text-sm text-gray-500">
                  Click on any request from the list to review and take action
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Credit Line Notice */}
        <div className="mt-8 p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/30 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold mb-2">Immediate Help via Credit Line</h3>
              <p className="text-sm text-gray-400 mb-4">
                When urgent benevolence needs arise and the benevolence fund is low, you can
                immediately draw from your 0% interest credit line. Your congregation's deposits
                remain fully protected while you help families in crisis.
              </p>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <p className="text-gray-500">Fund Balance</p>
                  <p className="font-semibold text-emerald-400">{formatCurrency(benevolenceFundBalance)}</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="text-gray-500">Credit Available</p>
                  <p className="font-semibold text-blue-400">{formatCurrency(creditLineAvailable)}</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="text-gray-500">Interest Rate</p>
                  <p className="font-semibold text-purple-400">0%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* New Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">New Benevolence Request</h2>
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="p-2 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Requestor Name *</label>
                <input
                  type="text"
                  placeholder="Full name or 'Anonymous'"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Contact (optional)</label>
                <input
                  type="text"
                  placeholder="Phone or email"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category *</label>
                  <select className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50">
                    <option value="">Select...</option>
                    <option value="rent">Rent/Housing</option>
                    <option value="utilities">Utilities</option>
                    <option value="medical">Medical</option>
                    <option value="food">Food</option>
                    <option value="transportation">Transportation</option>
                    <option value="funeral">Funeral</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Urgency *</label>
                  <select className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50">
                    <option value="immediate">Immediate</option>
                    <option value="within_week">Within Week</option>
                    <option value="within_month">Within Month</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Amount Requested *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description *</label>
                <textarea
                  rows={3}
                  placeholder="Describe the situation and how the funds will be used..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="confidential"
                  defaultChecked
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/50"
                />
                <label htmlFor="confidential" className="text-sm text-gray-400">
                  Mark as confidential (recommended)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewRequestModal(false)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
