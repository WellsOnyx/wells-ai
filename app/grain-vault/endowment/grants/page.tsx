// @ts-nocheck
'use client'

/**
 * Grain & Vault - Grant Disbursement Interface
 *
 * Request and track grant disbursements from the endowment credit line:
 * - Create new grant requests
 * - Track pending approvals
 * - View disbursement history
 * - Monitor fund allocation
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  Send,
  Calendar,
  Users,
  Building2,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  Landmark,
  CircleDollarSign,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  CreditCard
} from 'lucide-react'

// =============================================================================
// TYPES & MOCK DATA
// =============================================================================

type GrantStatus = 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'rejected'
type GrantCategory = 'scholarship' | 'research' | 'program' | 'capital' | 'operations' | 'arts' | 'community'

interface Grant {
  id: string
  title: string
  recipient: string
  recipientType: 'individual' | 'organization' | 'internal'
  amount: number
  category: GrantCategory
  fundSource: string
  fundId: string
  purpose: string
  status: GrantStatus
  requestDate: string
  approvalDate?: string
  disbursementDate?: string
  requestedBy: string
  approvedBy?: string
  notes?: string
  attachments: number
  milestones?: {
    description: string
    amount: number
    dueDate: string
    status: 'pending' | 'paid'
  }[]
}

const MOCK_GRANTS: Grant[] = [
  // Completed Grants
  {
    id: 'GR-2025-042',
    title: 'Community Arts Center Annual Support',
    recipient: 'Community Arts Center',
    recipientType: 'organization',
    amount: 125000,
    category: 'arts',
    fundSource: 'Memorial Arts Fund',
    fundId: 'fund-011',
    purpose: 'Annual programming support for community arts education and cultural events',
    status: 'completed',
    requestDate: '2025-12-10',
    approvalDate: '2025-12-15',
    disbursementDate: '2025-12-18',
    requestedBy: 'Sarah Mitchell',
    approvedBy: 'Board Finance Committee',
    attachments: 3,
    notes: 'Second year of multi-year commitment'
  },
  {
    id: 'GR-2025-041',
    title: 'STEM Education Initiative Q4',
    recipient: 'STEM Education Initiative',
    recipientType: 'internal',
    amount: 85000,
    category: 'program',
    fundSource: 'Unrestricted - General Operating',
    fundId: 'fund-001',
    purpose: 'Q4 funding for expanded STEM curriculum and teacher training',
    status: 'completed',
    requestDate: '2025-12-08',
    approvalDate: '2025-12-12',
    disbursementDate: '2025-12-15',
    requestedBy: 'Dr. James Wilson',
    approvedBy: 'Executive Director',
    attachments: 2
  },
  {
    id: 'GR-2025-040',
    title: 'Johnson Research Lab Equipment',
    recipient: 'Johnson Research Lab',
    recipientType: 'internal',
    amount: 150000,
    category: 'research',
    fundSource: 'Johnson Research Chair',
    fundId: 'fund-010',
    purpose: 'New laboratory equipment and research supplies for cancer research program',
    status: 'completed',
    requestDate: '2025-12-01',
    approvalDate: '2025-12-05',
    disbursementDate: '2025-12-10',
    requestedBy: 'Dr. Michael Chen',
    approvedBy: 'Research Committee',
    attachments: 5
  },
  {
    id: 'GR-2025-039',
    title: 'Annual Scholarship Awards 2025-2026',
    recipient: 'Multiple Recipients (47 students)',
    recipientType: 'individual',
    amount: 425000,
    category: 'scholarship',
    fundSource: 'Legacy Scholarship Fund',
    fundId: 'fund-009',
    purpose: 'Merit-based scholarship awards for undergraduate students',
    status: 'completed',
    requestDate: '2025-11-15',
    approvalDate: '2025-11-20',
    disbursementDate: '2025-12-01',
    requestedBy: 'Financial Aid Office',
    approvedBy: 'Scholarship Committee',
    attachments: 47
  },

  // Pending/Processing Grants
  {
    id: 'GR-2025-038',
    title: 'Building Renovation Phase 1',
    recipient: 'Turner Construction',
    recipientType: 'organization',
    amount: 750000,
    category: 'capital',
    fundSource: 'Building Campaign',
    fundId: 'fund-005',
    purpose: 'Phase 1 construction payment for new campus building',
    status: 'processing',
    requestDate: '2025-11-20',
    approvalDate: '2025-11-25',
    requestedBy: 'Facilities Department',
    approvedBy: 'Board of Directors',
    attachments: 12,
    milestones: [
      { description: 'Foundation completion', amount: 250000, dueDate: '2025-12-15', status: 'paid' },
      { description: 'Structural framing', amount: 300000, dueDate: '2026-02-01', status: 'pending' },
      { description: 'Final milestone', amount: 200000, dueDate: '2026-04-01', status: 'pending' }
    ]
  },
  {
    id: 'GR-2025-037',
    title: 'Youth Programs Expansion',
    recipient: 'Youth Services Department',
    recipientType: 'internal',
    amount: 95000,
    category: 'program',
    fundSource: 'Unrestricted - Strategic Initiatives',
    fundId: 'fund-002',
    purpose: 'Expand after-school youth programs to 3 new locations',
    status: 'completed',
    requestDate: '2025-11-10',
    approvalDate: '2025-11-15',
    disbursementDate: '2025-11-20',
    requestedBy: 'Maria Rodriguez',
    approvedBy: 'Program Committee',
    attachments: 4
  },

  // Pending Approval
  {
    id: 'GR-2025-043',
    title: 'Graduate Fellowship Program',
    recipient: 'Graduate School',
    recipientType: 'internal',
    amount: 180000,
    category: 'scholarship',
    fundSource: 'Scholarship Fund 2026',
    fundId: 'fund-004',
    purpose: 'Fellowship stipends for 12 doctoral candidates',
    status: 'pending_approval',
    requestDate: '2025-12-20',
    requestedBy: 'Graduate Studies Office',
    attachments: 6,
    notes: 'Awaiting Finance Committee review - scheduled for Jan 5'
  },
  {
    id: 'GR-2025-044',
    title: 'Community Health Initiative',
    recipient: 'Local Health Clinic Network',
    recipientType: 'organization',
    amount: 75000,
    category: 'community',
    fundSource: 'Unrestricted - General Operating',
    fundId: 'fund-001',
    purpose: 'Support for free health screenings in underserved areas',
    status: 'pending_approval',
    requestDate: '2025-12-22',
    requestedBy: 'Community Outreach',
    attachments: 2
  },

  // Draft
  {
    id: 'GR-2025-045',
    title: 'Faculty Development Workshop Series',
    recipient: 'Academic Affairs',
    recipientType: 'internal',
    amount: 45000,
    category: 'program',
    fundSource: 'Unrestricted - Strategic Initiatives',
    fundId: 'fund-002',
    purpose: 'Professional development workshops for faculty members',
    status: 'draft',
    requestDate: '2025-12-24',
    requestedBy: 'HR Department',
    attachments: 1
  },

  // Rejected
  {
    id: 'GR-2025-036',
    title: 'International Conference Sponsorship',
    recipient: 'Global Research Conference',
    recipientType: 'organization',
    amount: 50000,
    category: 'research',
    fundSource: 'Research Initiative',
    fundId: 'fund-006',
    purpose: 'Platinum sponsorship for annual research conference',
    status: 'rejected',
    requestDate: '2025-11-01',
    requestedBy: 'Research Department',
    attachments: 3,
    notes: 'Declined - does not align with current research priorities. Suggest resubmitting for next fiscal year with revised scope.'
  }
]

// Credit Line Summary
const CREDIT_LINE = {
  totalAvailable: 5_000_000,
  currentlyUsed: 1_247_500,
  pendingApprovals: 255_000,
  availableBalance: 3_497_500
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function GrantsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<GrantStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<GrantCategory | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null)

  const formatUSD = (amount: number, compact = false) => {
    if (compact) {
      if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
      if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Filter grants
  const filteredGrants = useMemo(() => {
    let grants = [...MOCK_GRANTS]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      grants = grants.filter(g =>
        g.title.toLowerCase().includes(query) ||
        g.recipient.toLowerCase().includes(query) ||
        g.fundSource.toLowerCase().includes(query) ||
        g.id.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      grants = grants.filter(g => g.status === statusFilter)
    }

    if (categoryFilter !== 'all') {
      grants = grants.filter(g => g.category === categoryFilter)
    }

    // Sort by date, most recent first
    grants.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime())

    return grants
  }, [searchQuery, statusFilter, categoryFilter])

  // Summary stats
  const stats = useMemo(() => {
    const pending = MOCK_GRANTS.filter(g => g.status === 'pending_approval').reduce((sum, g) => sum + g.amount, 0)
    const processing = MOCK_GRANTS.filter(g => g.status === 'processing').reduce((sum, g) => sum + g.amount, 0)
    const completedThisMonth = MOCK_GRANTS.filter(g =>
      g.status === 'completed' &&
      g.disbursementDate &&
      new Date(g.disbursementDate).getMonth() === new Date().getMonth()
    ).reduce((sum, g) => sum + g.amount, 0)

    return { pending, processing, completedThisMonth }
  }, [])

  const getStatusBadge = (status: GrantStatus) => {
    const configs = {
      draft: { icon: Edit2, bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Draft' },
      pending_approval: { icon: Clock, bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending Approval' },
      approved: { icon: CheckCircle, bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Approved' },
      processing: { icon: CircleDollarSign, bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Processing' },
      completed: { icon: CheckCircle, bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' },
      rejected: { icon: XCircle, bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' }
    }
    const config = configs[status]
    const Icon = config.icon

    return (
      <span className={`flex items-center gap-1 px-2 py-1 ${config.bg} ${config.text} text-xs font-medium rounded-full`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  const getCategoryBadge = (category: GrantCategory) => {
    const configs: Record<GrantCategory, { color: string; label: string }> = {
      scholarship: { color: 'text-blue-400 bg-blue-500/10', label: 'Scholarship' },
      research: { color: 'text-purple-400 bg-purple-500/10', label: 'Research' },
      program: { color: 'text-emerald-400 bg-emerald-500/10', label: 'Program' },
      capital: { color: 'text-amber-400 bg-amber-500/10', label: 'Capital' },
      operations: { color: 'text-gray-400 bg-gray-500/10', label: 'Operations' },
      arts: { color: 'text-pink-400 bg-pink-500/10', label: 'Arts' },
      community: { color: 'text-cyan-400 bg-cyan-500/10', label: 'Community' }
    }
    const config = configs[category]

    return (
      <span className={`px-2 py-0.5 ${config.color} text-xs rounded`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/grain-vault/endowment"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <CircleDollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Grant Disbursements</h1>
                  <p className="text-xs text-gray-400">Request & track grants</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-all text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                New Request
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Credit Line Overview */}
        <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold">Credit Line Status</h2>
                <p className="text-xs text-gray-400">Available for disbursements</p>
              </div>
            </div>
            <Link
              href="/grain-vault/endowment"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View Full Dashboard
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Total Credit Line</p>
              <p className="text-xl font-bold text-white">{formatUSD(CREDIT_LINE.totalAvailable, true)}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Available Balance</p>
              <p className="text-xl font-bold text-emerald-400">{formatUSD(CREDIT_LINE.availableBalance, true)}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Currently Used</p>
              <p className="text-xl font-bold text-blue-400">{formatUSD(CREDIT_LINE.currentlyUsed, true)}</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Pending Approval</p>
              <p className="text-xl font-bold text-amber-400">{formatUSD(stats.pending, true)}</p>
            </div>
          </div>

          {/* Utilization Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Credit Utilization</span>
              <span className="text-blue-400">
                {((CREDIT_LINE.currentlyUsed / CREDIT_LINE.totalAvailable) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${(CREDIT_LINE.currentlyUsed / CREDIT_LINE.totalAvailable) * 100}%` }}
                />
                <div
                  className="h-full bg-amber-500/50"
                  style={{ width: `${(stats.pending / CREDIT_LINE.totalAvailable) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full" /> Used
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-amber-500/50 rounded-full" /> Pending
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-white/10 rounded-full" /> Available
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onClick={() => setStatusFilter('pending_approval')}
            className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 cursor-pointer hover:border-amber-500/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-gray-400">Pending Approval</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">
              {MOCK_GRANTS.filter(g => g.status === 'pending_approval').length}
            </p>
            <p className="text-xs text-gray-500">{formatUSD(stats.pending, true)} total</p>
          </div>

          <div
            onClick={() => setStatusFilter('processing')}
            className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 cursor-pointer hover:border-purple-500/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <CircleDollarSign className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400">Processing</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {MOCK_GRANTS.filter(g => g.status === 'processing').length}
            </p>
            <p className="text-xs text-gray-500">{formatUSD(stats.processing, true)} total</p>
          </div>

          <div
            onClick={() => setStatusFilter('completed')}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 cursor-pointer hover:border-emerald-500/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-gray-400">Completed (This Month)</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {MOCK_GRANTS.filter(g => g.status === 'completed' && g.disbursementDate && new Date(g.disbursementDate).getMonth() === new Date().getMonth()).length}
            </p>
            <p className="text-xs text-gray-500">{formatUSD(stats.completedThisMonth, true)} disbursed</p>
          </div>

          <div
            onClick={() => setStatusFilter('draft')}
            className="bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Edit2 className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">Drafts</span>
            </div>
            <p className="text-2xl font-bold text-gray-400">
              {MOCK_GRANTS.filter(g => g.status === 'draft').length}
            </p>
            <p className="text-xs text-gray-500">Ready to submit</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search grants by title, recipient, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="all">All Categories</option>
                <option value="scholarship">Scholarship</option>
                <option value="research">Research</option>
                <option value="program">Program</option>
                <option value="capital">Capital</option>
                <option value="operations">Operations</option>
                <option value="arts">Arts</option>
                <option value="community">Community</option>
              </select>

              {(statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter('all')
                    setCategoryFilter('all')
                    setSearchQuery('')
                  }}
                  className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grants Table */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Grant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fund Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredGrants.map((grant) => (
                  <tr
                    key={grant.id}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedGrant(grant)}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-white">{grant.title}</p>
                          {getCategoryBadge(grant.category)}
                        </div>
                        <p className="text-xs text-gray-500">{grant.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          grant.recipientType === 'organization' ? 'bg-blue-500/20' :
                          grant.recipientType === 'individual' ? 'bg-emerald-500/20' :
                          'bg-purple-500/20'
                        }`}>
                          {grant.recipientType === 'organization' ? (
                            <Building2 className="w-4 h-4 text-blue-400" />
                          ) : grant.recipientType === 'individual' ? (
                            <Users className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Landmark className="w-4 h-4 text-purple-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-white">{grant.recipient}</p>
                          <p className="text-xs text-gray-500 capitalize">{grant.recipientType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-lg font-semibold text-white">{formatUSD(grant.amount, true)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-300">{grant.fundSource}</p>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(grant.status)}
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm text-white">{formatDate(grant.requestDate)}</p>
                        {grant.disbursementDate && (
                          <p className="text-xs text-emerald-400">Paid: {formatDate(grant.disbursementDate)}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedGrant(grant)
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredGrants.length === 0 && (
            <div className="text-center py-12">
              <CircleDollarSign className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No grants found</h3>
              <p className="text-sm text-gray-500 mb-4">Try adjusting your search or filters</p>
            </div>
          )}
        </div>

        {/* Grant Detail Modal */}
        {selectedGrant && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xl font-bold">{selectedGrant.title}</h2>
                      {getCategoryBadge(selectedGrant.category)}
                    </div>
                    <p className="text-sm text-gray-400">{selectedGrant.id}</p>
                  </div>
                  <button
                    onClick={() => setSelectedGrant(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Status & Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-gray-400 mb-2">Status</p>
                    {getStatusBadge(selectedGrant.status)}
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-gray-400 mb-2">Amount</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatUSD(selectedGrant.amount)}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Recipient</p>
                    <p className="text-white">{selectedGrant.recipient}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Fund Source</p>
                    <p className="text-white">{selectedGrant.fundSource}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Purpose</p>
                    <p className="text-white">{selectedGrant.purpose}</p>
                  </div>
                  {selectedGrant.notes && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-400 mb-1">Notes</p>
                      <p className="text-white text-sm">{selectedGrant.notes}</p>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-400">Timeline</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white">Requested</p>
                        <p className="text-xs text-gray-400">{formatDate(selectedGrant.requestDate)} by {selectedGrant.requestedBy}</p>
                      </div>
                    </div>
                    {selectedGrant.approvalDate && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white">Approved</p>
                          <p className="text-xs text-gray-400">{formatDate(selectedGrant.approvalDate)} by {selectedGrant.approvedBy}</p>
                        </div>
                      </div>
                    )}
                    {selectedGrant.disbursementDate && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white">Disbursed</p>
                          <p className="text-xs text-gray-400">{formatDate(selectedGrant.disbursementDate)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Milestones */}
                {selectedGrant.milestones && selectedGrant.milestones.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-400">Payment Milestones</p>
                    <div className="space-y-2">
                      {selectedGrant.milestones.map((milestone, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              milestone.status === 'paid' ? 'bg-emerald-500/20' : 'bg-gray-500/20'
                            }`}>
                              {milestone.status === 'paid' ? (
                                <CheckCircle className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Clock className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-white">{milestone.description}</p>
                              <p className="text-xs text-gray-500">Due: {formatDate(milestone.dueDate)}</p>
                            </div>
                          </div>
                          <p className={`font-medium ${milestone.status === 'paid' ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {formatUSD(milestone.amount, true)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-white">{selectedGrant.attachments} attachment{selectedGrant.attachments !== 1 ? 's' : ''}</span>
                  </div>
                  <button className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                    View All
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedGrant(null)}
                  className="px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
                {(selectedGrant.status === 'draft' || selectedGrant.status === 'pending_approval') && (
                  <button className="px-4 py-2 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 transition-colors">
                    {selectedGrant.status === 'draft' ? 'Submit for Approval' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
