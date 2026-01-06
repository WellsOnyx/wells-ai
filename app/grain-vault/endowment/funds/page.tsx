// @ts-nocheck
'use client'

/**
 * Grain & Vault Restricted Funds Management
 *
 * Main page for managing nonprofit restricted funds:
 * - List all funds with balances
 * - Create new funds (unrestricted, temporarily restricted, permanently restricted)
 * - Fund detail navigation
 * - Allocation interface
 * - Release workflow access
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Clock,
  Lock,
  Unlock,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Loader2,
  DollarSign,
  Users,
  Calendar,
  Building2,
  FileText,
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  Landmark,
  Shield,
  Gift,
  Download,
  Edit2,
  Eye,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

// Types
interface FundBalance {
  protectedPrincipal: number
  accumulatedEarnings: number
  appreciation: number
  totalSpent: number
  totalReleased: number
  spendableBalance: number
  corpusValue: number
  isUnderwater: boolean
  marketValue: number
}

interface Fund {
  id: string
  orgId: string
  name: string
  description?: string
  purpose?: string
  restrictionType: 'unrestricted' | 'temporarily_restricted' | 'permanently_restricted'
  donorName?: string
  donorAnonymous: boolean
  status: 'active' | 'frozen' | 'fully_released' | 'closed'
  balance?: FundBalance
  calculatedSpendable: number
  transactionCount: number
  releaseCount: number
  createdAt: string
  purposeFulfilled: boolean
  spendingRatePercent?: number
  releaseSchedule?: string
  releaseEndDate?: string
}

interface FundTotals {
  unrestricted: { count: number; total: number; spendable: number }
  temporarilyRestricted: { count: number; total: number; spendable: number }
  permanentlyRestricted: { count: number; total: number; spendable: number }
  grandTotal: { count: number; total: number; spendable: number }
}

// Restriction type config
const RESTRICTION_CONFIG = {
  unrestricted: {
    label: 'Unrestricted',
    icon: Unlock,
    color: 'emerald',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    description: 'Can use for any purpose',
  },
  temporarily_restricted: {
    label: 'Temporarily Restricted',
    icon: Clock,
    color: 'amber',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    textClass: 'text-amber-400',
    description: 'Donor-specified purpose, releases over time',
  },
  permanently_restricted: {
    label: 'Endowment',
    icon: Lock,
    color: 'purple',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
    textClass: 'text-purple-400',
    description: 'Principal protected, only earnings available',
  },
}

export default function RestrictedFundsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [funds, setFunds] = useState<Fund[]>([])
  const [totals, setTotals] = useState<FundTotals | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>('active')
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'date'>('value')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [expandedFund, setExpandedFund] = useState<string | null>(null)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null)

  // Mock org ID (in production, get from auth context)
  const orgId = 'org_demo_123'

  // Fetch funds
  const fetchFunds = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({
        orgId,
        includeTotals: 'true',
      })

      if (filterType) params.append('type', filterType)
      if (filterStatus) params.append('status', filterStatus)

      const response = await fetch(`/api/grain/funds?${params}`)

      if (!response.ok) {
        throw new Error('Failed to load funds')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Unknown error')
      }

      setFunds(data.funds || [])
      setTotals(data.totals)
      setError(null)
    } catch (err: any) {
      console.error('Error fetching funds:', err)
      setError(err.message)
      // Set empty data on error
      setFunds([])
      setTotals(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [orgId, filterType, filterStatus])

  useEffect(() => {
    fetchFunds()
  }, [fetchFunds])

  // Format currency
  const formatUSD = (amount: number, compact = false) => {
    if (compact) {
      if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
      if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Filter and sort funds
  const filteredFunds = useMemo(() => {
    let result = [...funds]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((fund) =>
        fund.name.toLowerCase().includes(query) ||
        fund.description?.toLowerCase().includes(query) ||
        fund.purpose?.toLowerCase().includes(query) ||
        fund.donorName?.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'value':
          comparison = (a.balance?.corpusValue || 0) - (b.balance?.corpusValue || 0)
          break
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return result
  }, [funds, searchQuery, sortBy, sortOrder])

  const getRestrictionBadge = (type: string) => {
    const config = RESTRICTION_CONFIG[type as keyof typeof RESTRICTION_CONFIG]
    if (!config) return null
    const Icon = config.icon
    return (
      <span className={`flex items-center gap-1 px-2 py-1 ${config.bgClass} ${config.textClass} text-xs font-medium rounded-full`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        )
      case 'frozen':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded">
            <Lock className="w-3 h-3" />
            Frozen
          </span>
        )
      case 'fully_released':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded">
            <Unlock className="w-3 h-3" />
            Released
          </span>
        )
      case 'closed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gray-500/10 text-gray-400 text-xs rounded">
            <X className="w-3 h-3" />
            Closed
          </span>
        )
      default:
        return null
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading funds...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-40">
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Landmark className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Restricted Funds</h1>
                  <p className="text-xs text-gray-400">Endowment Fund Management</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchFunds(true)}
                disabled={refreshing}
                className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm">
                <Download className="w-4 h-4" />
                Export
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                New Fund
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-400">Total Assets</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatUSD(totals?.grandTotal.total || 0, true)}
            </p>
            <p className="text-xs text-emerald-400 mt-1">
              {totals?.grandTotal.count || 0} funds | {formatUSD(totals?.grandTotal.spendable || 0, true)} spendable
            </p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Unlock className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-gray-400">Unrestricted</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {formatUSD(totals?.unrestricted.total || 0, true)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {totals?.unrestricted.count || 0} funds | Fully available
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-gray-400">Temp. Restricted</p>
            </div>
            <p className="text-2xl font-bold text-amber-400">
              {formatUSD(totals?.temporarilyRestricted.total || 0, true)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {totals?.temporarilyRestricted.count || 0} funds | {formatUSD(totals?.temporarilyRestricted.spendable || 0, true)} released
            </p>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <p className="text-xs text-gray-400">Endowments</p>
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {formatUSD(totals?.permanentlyRestricted.total || 0, true)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {totals?.permanentlyRestricted.count || 0} funds | {formatUSD(totals?.permanentlyRestricted.spendable || 0, true)} earnings
            </p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search funds by name, donor, or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 hidden sm:block">Type:</span>
              <select
                value={filterType || 'all'}
                onChange={(e) => setFilterType(e.target.value === 'all' ? null : e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
              >
                <option value="all">All Types</option>
                <option value="unrestricted">Unrestricted</option>
                <option value="temporarily_restricted">Temporarily Restricted</option>
                <option value="permanently_restricted">Permanently Restricted</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 hidden sm:block">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
              >
                <option value="value">Value</option>
                <option value="name">Name</option>
                <option value="date">Created Date</option>
              </select>
              <button
                onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              >
                {sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Funds List */}
        {error ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => fetchFunds()}
              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
            >
              Try Again
            </button>
          </div>
        ) : filteredFunds.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Funds Found</h3>
            <p className="text-gray-400 mb-6">
              {searchQuery || filterType
                ? 'Try adjusting your search or filters'
                : 'Create your first fund to get started'}
            </p>
            {!searchQuery && !filterType ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Fund
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilterType(null)
                }}
                className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFunds.map((fund) => {
              const config = RESTRICTION_CONFIG[fund.restrictionType]
              const Icon = config?.icon || Wallet
              const isExpanded = expandedFund === fund.id

              return (
                <div
                  key={fund.id}
                  className={`bg-white/5 border rounded-xl overflow-hidden transition-all ${
                    fund.balance?.isUnderwater
                      ? 'border-red-500/30'
                      : config?.borderClass || 'border-white/10'
                  }`}
                >
                  {/* Fund Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedFund(isExpanded ? null : fund.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config?.bgClass || 'bg-white/10'}`}>
                          <Icon className={`w-6 h-6 ${config?.textClass || 'text-white'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white">{fund.name}</h3>
                            {fund.balance?.isUnderwater && (
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {getRestrictionBadge(fund.restrictionType)}
                            {getStatusBadge(fund.status)}
                            {fund.donorName && !fund.donorAnonymous && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Gift className="w-3 h-3" />
                                {fund.donorName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-lg font-bold text-white">
                            {formatUSD(fund.balance?.corpusValue || 0, true)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatUSD(fund.calculatedSpendable, true)} spendable
                          </p>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Underwater Alert */}
                    {fund.balance?.isUnderwater && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-red-400">
                          Fund is underwater - spending may be restricted until corpus recovers
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-white/10 p-4 bg-white/[0.02]">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Fund Details */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Fund Details</h4>

                          <div className="space-y-3">
                            {fund.purpose && (
                              <div>
                                <p className="text-xs text-gray-500">Purpose</p>
                                <p className="text-sm text-white">{fund.purpose}</p>
                              </div>
                            )}
                            {fund.description && (
                              <div>
                                <p className="text-xs text-gray-500">Description</p>
                                <p className="text-sm text-white">{fund.description}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-gray-500">Created</p>
                              <p className="text-sm text-white">{formatDate(fund.createdAt)}</p>
                            </div>
                            {fund.releaseEndDate && (
                              <div>
                                <p className="text-xs text-gray-500">Release Date</p>
                                <p className="text-sm text-amber-400">{formatDate(fund.releaseEndDate)}</p>
                              </div>
                            )}
                            {fund.spendingRatePercent && (
                              <div>
                                <p className="text-xs text-gray-500">Spending Rate</p>
                                <p className="text-sm text-purple-400">{(fund.spendingRatePercent * 100).toFixed(1)}% annually</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Financial Summary */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Financial Summary</h4>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white/5 rounded-lg">
                              <p className="text-xs text-gray-500">Corpus Value</p>
                              <p className="text-lg font-bold text-white">{formatUSD(fund.balance?.corpusValue || 0, true)}</p>
                            </div>
                            <div className="p-3 bg-white/5 rounded-lg">
                              <p className="text-xs text-gray-500">Principal</p>
                              <p className="text-lg font-bold text-gray-300">{formatUSD(fund.balance?.protectedPrincipal || 0, true)}</p>
                            </div>
                            <div className="p-3 bg-emerald-500/10 rounded-lg">
                              <p className="text-xs text-gray-500">Earnings</p>
                              <p className="text-lg font-bold text-emerald-400">+{formatUSD(fund.balance?.accumulatedEarnings || 0, true)}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${(fund.balance?.appreciation || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                              <p className="text-xs text-gray-500">Appreciation</p>
                              <p className={`text-lg font-bold ${(fund.balance?.appreciation || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {(fund.balance?.appreciation || 0) >= 0 ? '+' : ''}{formatUSD(fund.balance?.appreciation || 0, true)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Activity Summary */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Activity</h4>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                              <span className="text-sm text-gray-400">Transactions</span>
                              <span className="text-sm font-medium text-white">{fund.transactionCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                              <span className="text-sm text-gray-400">Releases</span>
                              <span className="text-sm font-medium text-white">{fund.releaseCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                              <span className="text-sm text-gray-400">Total Spent</span>
                              <span className="text-sm font-medium text-white">{formatUSD(fund.balance?.totalSpent || 0, true)}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/grain-vault/endowment/funds/${fund.id}`)
                              }}
                              className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedFund(fund)
                                setShowAllocateModal(true)
                              }}
                              className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 text-white rounded-lg text-sm hover:bg-white/10 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              Allocate
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Create Fund Modal */}
      {showCreateModal && (
        <CreateFundModal
          orgId={orgId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchFunds(true)
          }}
        />
      )}

      {/* Allocate Modal */}
      {showAllocateModal && selectedFund && (
        <AllocateModal
          fund={selectedFund}
          onClose={() => {
            setShowAllocateModal(false)
            setSelectedFund(null)
          }}
          onAllocated={() => {
            setShowAllocateModal(false)
            setSelectedFund(null)
            fetchFunds(true)
          }}
        />
      )}
    </div>
  )
}

// ============================================================================
// Create Fund Modal
// ============================================================================

function CreateFundModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [restrictionType, setRestrictionType] = useState<'unrestricted' | 'temporarily_restricted' | 'permanently_restricted'>('unrestricted')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [purpose, setPurpose] = useState('')
  const [donorName, setDonorName] = useState('')
  const [donorAnonymous, setDonorAnonymous] = useState(false)
  const [initialPrincipal, setInitialPrincipal] = useState('')
  const [releaseSchedule, setReleaseSchedule] = useState('')
  const [releaseAmountPerPeriod, setReleaseAmountPerPeriod] = useState('')
  const [spendingRatePercent, setSpendingRatePercent] = useState('5')

  const handleCreate = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/grain/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          orgId,
          name,
          description,
          purpose,
          restrictionType,
          donorName: donorName || undefined,
          donorAnonymous,
          initialPrincipal: initialPrincipal ? parseFloat(initialPrincipal) : undefined,
          releaseSchedule: releaseSchedule || undefined,
          releaseAmountPerPeriod: releaseAmountPerPeriod ? parseFloat(releaseAmountPerPeriod) : undefined,
          spendingRatePercent: restrictionType === 'permanently_restricted'
            ? parseFloat(spendingRatePercent) / 100
            : undefined,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create fund')
      }

      onCreated()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create New Fund</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Choose Type */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-400 mb-6">
                Select the type of fund based on donor restrictions:
              </p>

              {Object.entries(RESTRICTION_CONFIG).map(([type, config]) => {
                const Icon = config.icon
                const isSelected = restrictionType === type

                return (
                  <button
                    key={type}
                    onClick={() => setRestrictionType(type as any)}
                    className={`w-full p-4 rounded-xl border transition-all text-left ${
                      isSelected
                        ? `${config.bgClass} ${config.borderClass}`
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${config.bgClass} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${config.textClass}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-semibold ${isSelected ? config.textClass : 'text-white'}`}>
                          {config.label}
                        </h3>
                        <p className="text-sm text-gray-400">{config.description}</p>
                      </div>
                      {isSelected && (
                        <Check className={`w-5 h-5 ${config.textClass}`} />
                      )}
                    </div>
                  </button>
                )
              })}

              <button
                onClick={() => setStep(2)}
                className="w-full mt-6 px-4 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2: Fund Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fund Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Smith Family Scholarship Fund"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the fund..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              {(restrictionType === 'temporarily_restricted' || restrictionType === 'permanently_restricted') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Purpose / Restriction {restrictionType === 'temporarily_restricted' ? '*' : ''}
                  </label>
                  <textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Donor's specified purpose for the funds..."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Donor Name
                  </label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Donor name"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Initial Amount
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="number"
                      value={initialPrincipal}
                      onChange={(e) => setInitialPrincipal(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="donorAnonymous"
                  checked={donorAnonymous}
                  onChange={(e) => setDonorAnonymous(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="donorAnonymous" className="text-sm text-gray-400">
                  Donor wishes to remain anonymous
                </label>
              </div>

              {/* Type-specific fields */}
              {restrictionType === 'temporarily_restricted' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-4">
                  <h4 className="text-sm font-medium text-amber-400">Release Schedule</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Schedule</label>
                      <select
                        value={releaseSchedule}
                        onChange={(e) => setReleaseSchedule(e.target.value)}
                        className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="">No schedule</option>
                        <option value="immediate">Immediate</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annual">Annual</option>
                        <option value="milestone">Milestone-based</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Amount per Period</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                        <input
                          type="number"
                          value={releaseAmountPerPeriod}
                          onChange={(e) => setReleaseAmountPerPeriod(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {restrictionType === 'permanently_restricted' && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-4">
                  <h4 className="text-sm font-medium text-purple-400">Endowment Spending Policy</h4>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Annual Spending Rate</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={spendingRatePercent}
                        onChange={(e) => setSpendingRatePercent(e.target.value)}
                        min="0"
                        max="100"
                        step="0.5"
                        className="w-24 px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                      />
                      <span className="text-gray-400">%</span>
                      <span className="text-xs text-gray-500">of corpus value annually</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Standard endowment spending rates range from 4% to 5% annually
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white rounded-lg font-medium hover:bg-white/10 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading || !name || (restrictionType === 'temporarily_restricted' && !purpose)}
                  className="flex-1 px-4 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Create Fund
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Allocate Modal
// ============================================================================

function AllocateModal({
  fund,
  onClose,
  onAllocated,
}: {
  fund: Fund
  onClose: () => void
  onAllocated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [designation, setDesignation] = useState('')

  const handleAllocate = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/grain/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'allocate',
          fundId: fund.id,
          allocatedAmount: parseFloat(amount),
          designation,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to allocate')
      }

      onAllocated()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Allocate to {fund.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Designation
            </label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Optional: specific designation within fund"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white rounded-lg font-medium hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAllocate}
              disabled={loading || !amount}
              className="flex-1 px-4 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Allocate'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
