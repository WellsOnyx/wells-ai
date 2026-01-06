// @ts-nocheck
'use client'

/**
 * Grain & Vault Single Fund Detail Page
 *
 * Comprehensive view of a single restricted fund:
 * - Fund details and purpose
 * - Transaction history
 * - Linked grants
 * - Donor information
 * - Spending validation and requests
 * - Restriction release workflow
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Wallet,
  Clock,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Loader2,
  DollarSign,
  FileText,
  X,
  Check,
  Plus,
  Minus,
  Gift,
  Calendar,
  ChevronDown,
  ChevronRight,
  Edit2,
  Landmark,
  Shield,
  AlertCircle,
  CheckCircle,
  Pause,
  Play,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  MoreVertical,
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
  underwaterAmount: number
  marketValue: number
}

interface Fund {
  id: string
  orgId: string
  name: string
  description?: string
  purpose?: string
  restrictionType: 'unrestricted' | 'temporarily_restricted' | 'permanently_restricted'
  donorId?: string
  donorName?: string
  donorAnonymous: boolean
  giftDate?: string
  giftAgreementUrl?: string
  releaseSchedule?: string
  releaseStartDate?: string
  releaseEndDate?: string
  releaseAmountPerPeriod?: number
  purposeFulfilled: boolean
  purposeFulfillmentDate?: string
  purposeFulfillmentNotes?: string
  spendingPolicy?: string
  spendingRatePercent?: number
  underwaterThreshold?: number
  linkedGrantIds?: string[]
  linkedProgramIds?: string[]
  status: 'active' | 'frozen' | 'fully_released' | 'closed'
  createdAt: string
  updatedAt: string
  balance?: FundBalance
  calculatedSpendable: number
  transactionCount: number
  releaseCount: number
  spendableInfo?: {
    spendable: number
    restrictionType: string
    isUnderwater: boolean
    corpusValue: number
  }
}

interface Transaction {
  id: string
  fundId: string
  type: string
  amount: number
  balanceAfter?: number
  description?: string
  referenceId?: string
  relatedGrantId?: string
  relatedProgramId?: string
  counterpartyFundId?: string
  approvedBy?: string
  approvedAt?: string
  createdBy?: string
  createdAt: string
}

interface Release {
  id: string
  fundId: string
  amount: number
  releaseType: string
  reason: string
  supportingDocumentation?: string
  destinationFundId?: string
  destinationType?: string
  authorizedBy?: string
  authorizationDate?: string
  status: string
  releasedAt?: string
  createdAt: string
}

// Transaction type config
const TRANSACTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  initial_gift: { label: 'Initial Gift', icon: Gift, color: 'text-emerald-400' },
  additional_gift: { label: 'Additional Gift', icon: Gift, color: 'text-emerald-400' },
  investment_income: { label: 'Investment Income', icon: TrendingUp, color: 'text-blue-400' },
  realized_gain: { label: 'Realized Gain', icon: TrendingUp, color: 'text-emerald-400' },
  realized_loss: { label: 'Realized Loss', icon: TrendingDown, color: 'text-red-400' },
  appreciation: { label: 'Appreciation', icon: TrendingUp, color: 'text-emerald-400' },
  depreciation: { label: 'Depreciation', icon: TrendingDown, color: 'text-red-400' },
  grant_expense: { label: 'Grant Expense', icon: ArrowUpRight, color: 'text-amber-400' },
  program_expense: { label: 'Program Expense', icon: ArrowUpRight, color: 'text-amber-400' },
  admin_fee: { label: 'Admin Fee', icon: Minus, color: 'text-gray-400' },
  transfer_in: { label: 'Transfer In', icon: ArrowDownLeft, color: 'text-blue-400' },
  transfer_out: { label: 'Transfer Out', icon: ArrowUpRight, color: 'text-orange-400' },
  restriction_release: { label: 'Restriction Release', icon: Unlock, color: 'text-purple-400' },
  credit_draw: { label: 'Credit Draw', icon: ArrowUpRight, color: 'text-orange-400' },
  credit_repayment: { label: 'Credit Repayment', icon: ArrowDownLeft, color: 'text-blue-400' },
}

// Restriction type config
const RESTRICTION_CONFIG = {
  unrestricted: {
    label: 'Unrestricted',
    icon: Unlock,
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
  },
  temporarily_restricted: {
    label: 'Temporarily Restricted',
    icon: Clock,
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    textClass: 'text-amber-400',
  },
  permanently_restricted: {
    label: 'Endowment',
    icon: Lock,
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
    textClass: 'text-purple-400',
  },
}

export default function FundDetailPage() {
  const router = useRouter()
  const params = useParams()
  const fundId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fund, setFund] = useState<Fund | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [showSpendModal, setShowSpendModal] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)

  // Fetch fund data
  const fetchFund = useCallback(async (isRefresh = false) => {
    if (!fundId) return

    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetch(`/api/grain/funds/${fundId}?transactions=true&releases=true`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Fund not found')
        }
        throw new Error('Failed to load fund')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Unknown error')
      }

      setFund(data.fund)
      setTransactions(data.transactions || [])
      setReleases(data.releases || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching fund:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fundId])

  useEffect(() => {
    fetchFund()
  }, [fetchFund])

  // Format currency
  const formatUSD = (amount: number, compact = false) => {
    if (compact) {
      if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
      if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Handle fund actions
  const handleFundAction = async (action: string, data?: any) => {
    try {
      const response = await fetch(`/api/grain/funds/${fundId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Action failed')
      }

      fetchFund(true)
      return result
    } catch (err: any) {
      console.error('Fund action error:', err)
      throw err
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading fund details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !fund) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Fund</h2>
          <p className="text-gray-400 mb-6">{error || 'Fund not found'}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/grain-vault/endowment/funds')}
              className="px-6 py-3 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-all"
            >
              Back to Funds
            </button>
            <button
              onClick={() => fetchFund()}
              className="px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const config = RESTRICTION_CONFIG[fund.restrictionType]
  const Icon = config?.icon || Wallet

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/grain-vault/endowment/funds"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${config?.bgClass || 'bg-white/10'} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${config?.textClass || 'text-white'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold">{fund.name}</h1>
                    {fund.balance?.isUnderwater && (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 ${config?.bgClass} ${config?.textClass} text-xs font-medium rounded-full`}>
                      {config?.label}
                    </span>
                    {fund.status !== 'active' && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                        {fund.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchFund(true)}
                disabled={refreshing}
                className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Actions Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showActionsMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowActionsMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-20 py-2">
                      {fund.status === 'active' ? (
                        <button
                          onClick={() => {
                            handleFundAction('freeze')
                            setShowActionsMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                        >
                          <Pause className="w-4 h-4" />
                          Freeze Fund
                        </button>
                      ) : fund.status === 'frozen' ? (
                        <button
                          onClick={() => {
                            handleFundAction('unfreeze')
                            setShowActionsMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Unfreeze Fund
                        </button>
                      ) : null}

                      {fund.restrictionType === 'temporarily_restricted' && !fund.purposeFulfilled && (
                        <button
                          onClick={() => {
                            setShowActionsMenu(false)
                            // Would open mark purpose fulfilled modal
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark Purpose Fulfilled
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setShowActionsMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Fund
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Underwater Alert */}
        {fund.balance?.isUnderwater && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-400 mb-1">Fund is Underwater</h3>
              <p className="text-sm text-gray-400">
                The corpus value has fallen below the protected principal. Spending is suspended until the fund recovers.
                Underwater by {formatUSD(fund.balance.underwaterAmount)}.
              </p>
            </div>
          </div>
        )}

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${config?.bgClass} border ${config?.borderClass} rounded-xl p-5`}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className={`w-4 h-4 ${config?.textClass}`} />
              <p className="text-xs text-gray-400">Corpus Value</p>
            </div>
            <p className={`text-2xl font-bold ${config?.textClass}`}>
              {formatUSD(fund.balance?.corpusValue || 0)}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-400">Protected Principal</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatUSD(fund.balance?.protectedPrincipal || 0)}
            </p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-gray-400">Spendable Balance</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {formatUSD(fund.spendableInfo?.spendable || fund.calculatedSpendable || 0)}
            </p>
          </div>

          <div className={`rounded-xl p-5 ${(fund.balance?.appreciation || 0) >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'} border`}>
            <div className="flex items-center gap-2 mb-2">
              {(fund.balance?.appreciation || 0) >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <p className="text-xs text-gray-400">Total Appreciation</p>
            </div>
            <p className={`text-2xl font-bold ${(fund.balance?.appreciation || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(fund.balance?.appreciation || 0) >= 0 ? '+' : ''}{formatUSD(fund.balance?.appreciation || 0)}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        {fund.status === 'active' && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowSpendModal(true)}
              disabled={fund.balance?.isUnderwater || (fund.spendableInfo?.spendable || 0) <= 0}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus className="w-4 h-4" />
              Record Spending
            </button>

            <button
              onClick={() => setShowInvestmentModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-medium hover:bg-white/10 transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              Record Investment Activity
            </button>

            {fund.restrictionType !== 'unrestricted' && (
              <button
                onClick={() => setShowReleaseModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-medium hover:bg-white/10 transition-all"
              >
                <Unlock className="w-4 h-4" />
                Request Release
              </button>
            )}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Fund Details */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Fund Details</h3>

              <div className="space-y-4">
                {fund.purpose && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Purpose</p>
                    <p className="text-sm text-white">{fund.purpose}</p>
                  </div>
                )}

                {fund.description && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-white">{fund.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-500 mb-1">Created</p>
                  <p className="text-sm text-white">{formatDate(fund.createdAt)}</p>
                </div>

                {fund.spendingPolicy && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Spending Policy</p>
                    <p className="text-sm text-white">{fund.spendingPolicy}</p>
                  </div>
                )}

                {fund.spendingRatePercent && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Spending Rate</p>
                    <p className="text-sm text-purple-400">{(fund.spendingRatePercent * 100).toFixed(1)}% annually</p>
                  </div>
                )}

                {fund.releaseSchedule && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Release Schedule</p>
                    <p className="text-sm text-amber-400 capitalize">{fund.releaseSchedule}</p>
                  </div>
                )}

                {fund.releaseEndDate && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Release End Date</p>
                    <p className="text-sm text-amber-400">{formatDate(fund.releaseEndDate)}</p>
                  </div>
                )}

                {fund.purposeFulfilled && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-400">Purpose Fulfilled</span>
                    </div>
                    {fund.purposeFulfillmentDate && (
                      <p className="text-xs text-gray-400">{formatDate(fund.purposeFulfillmentDate)}</p>
                    )}
                    {fund.purposeFulfillmentNotes && (
                      <p className="text-xs text-gray-500 mt-1">{fund.purposeFulfillmentNotes}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Donor Information */}
            {(fund.donorName || fund.donorAnonymous) && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Donor Information</h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {fund.donorAnonymous ? 'Anonymous Donor' : fund.donorName}
                      </p>
                      {fund.giftDate && (
                        <p className="text-xs text-gray-500">Gift Date: {formatDate(fund.giftDate)}</p>
                      )}
                    </div>
                  </div>

                  {fund.giftAgreementUrl && (
                    <a
                      href={fund.giftAgreementUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
                    >
                      <FileText className="w-4 h-4" />
                      View Gift Agreement
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Balance Breakdown */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Balance Breakdown</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Protected Principal</span>
                  <span className="text-sm font-medium text-white">{formatUSD(fund.balance?.protectedPrincipal || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Accumulated Earnings</span>
                  <span className="text-sm font-medium text-emerald-400">+{formatUSD(fund.balance?.accumulatedEarnings || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Appreciation</span>
                  <span className={`text-sm font-medium ${(fund.balance?.appreciation || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(fund.balance?.appreciation || 0) >= 0 ? '+' : ''}{formatUSD(fund.balance?.appreciation || 0)}
                  </span>
                </div>
                <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                  <span className="text-sm text-gray-400">Total Released</span>
                  <span className="text-sm font-medium text-purple-400">{formatUSD(fund.balance?.totalReleased || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Total Spent</span>
                  <span className="text-sm font-medium text-gray-400">-{formatUSD(fund.balance?.totalSpent || 0)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Corpus Value</span>
                  <span className={`text-sm font-bold ${config?.textClass}`}>{formatUSD(fund.balance?.corpusValue || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transaction History */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-white">Transaction History</h3>
                  <span className="px-2 py-0.5 bg-white/10 text-gray-400 text-xs rounded-full">
                    {transactions.length}
                  </span>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No transactions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {transactions.map((tx) => {
                    const txConfig = TRANSACTION_CONFIG[tx.type] || {
                      label: tx.type,
                      icon: DollarSign,
                      color: 'text-gray-400',
                    }
                    const TxIcon = txConfig.icon

                    return (
                      <div key={tx.id} className="px-5 py-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              tx.amount >= 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                            }`}>
                              <TxIcon className={`w-4 h-4 ${txConfig.color}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{txConfig.label}</p>
                              {tx.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{tx.description}</p>
                              )}
                              <p className="text-xs text-gray-600 mt-1">{formatDateTime(tx.createdAt)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {tx.amount >= 0 ? '+' : ''}{formatUSD(tx.amount)}
                            </p>
                            {tx.referenceId && (
                              <p className="text-xs text-gray-600">Ref: {tx.referenceId}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Restriction Releases */}
            {fund.restrictionType !== 'unrestricted' && (
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-purple-400" />
                    <h3 className="font-semibold text-white">Restriction Releases</h3>
                    <span className="px-2 py-0.5 bg-white/10 text-gray-400 text-xs rounded-full">
                      {releases.length}
                    </span>
                  </div>
                </div>

                {releases.length === 0 ? (
                  <div className="text-center py-12">
                    <Lock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No releases recorded</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {releases.map((release) => (
                      <div key={release.id} className="px-5 py-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                              <Unlock className="w-4 h-4 text-purple-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-white capitalize">
                                  {release.releaseType.replace('_', ' ')}
                                </p>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  release.status === 'completed'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : release.status === 'pending'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {release.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{release.reason}</p>
                              <p className="text-xs text-gray-600 mt-1">{formatDateTime(release.createdAt)}</p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-purple-400">
                            {formatUSD(release.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Spend Modal */}
      {showSpendModal && (
        <SpendModal
          fund={fund}
          onClose={() => setShowSpendModal(false)}
          onSuccess={() => {
            setShowSpendModal(false)
            fetchFund(true)
          }}
        />
      )}

      {/* Investment Modal */}
      {showInvestmentModal && (
        <InvestmentModal
          fund={fund}
          onClose={() => setShowInvestmentModal(false)}
          onSuccess={() => {
            setShowInvestmentModal(false)
            fetchFund(true)
          }}
        />
      )}

      {/* Release Modal */}
      {showReleaseModal && (
        <ReleaseModal
          fund={fund}
          onClose={() => setShowReleaseModal(false)}
          onSuccess={() => {
            setShowReleaseModal(false)
            fetchFund(true)
          }}
        />
      )}
    </div>
  )
}

// ============================================================================
// Spend Modal
// ============================================================================

function SpendModal({
  fund,
  onClose,
  onSuccess,
}: {
  fund: Fund
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'grant_expense' | 'program_expense' | 'admin_fee'>('program_expense')

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/grain/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'spend',
          fundId: fund.id,
          amount: parseFloat(amount),
          description,
          type,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to record spending')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const maxSpendable = fund.spendableInfo?.spendable || fund.calculatedSpendable || 0

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Record Spending</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-xs text-gray-400">Available to Spend</p>
            <p className="text-lg font-bold text-emerald-400">${maxSpendable.toLocaleString()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Expense Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="program_expense">Program Expense</option>
              <option value="grant_expense">Grant Expense</option>
              <option value="admin_fee">Administrative Fee</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Amount *</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                max={maxSpendable}
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this spending for?"
              rows={2}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none"
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
              onClick={handleSubmit}
              disabled={loading || !amount || !description || parseFloat(amount) > maxSpendable}
              className="flex-1 px-4 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Spending'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Investment Modal
// ============================================================================

function InvestmentModal({
  fund,
  onClose,
  onSuccess,
}: {
  fund: Fund
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'investment_income' | 'realized_gain' | 'realized_loss' | 'appreciation' | 'depreciation'>('investment_income')

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/grain/funds/${fund.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: type,
          amount: parseFloat(amount),
          description,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to record activity')
      }

      onSuccess()
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
          <h2 className="text-lg font-bold text-white">Record Investment Activity</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Activity Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="investment_income">Investment Income (Dividends/Interest)</option>
              <option value="realized_gain">Realized Gain</option>
              <option value="realized_loss">Realized Loss</option>
              <option value="appreciation">Market Appreciation</option>
              <option value="depreciation">Market Depreciation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Amount *</label>
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
            <p className="text-xs text-gray-500 mt-1">
              {['realized_loss', 'depreciation'].includes(type)
                ? 'Enter as positive number - will be recorded as reduction'
                : 'Enter as positive number'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
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
              onClick={handleSubmit}
              disabled={loading || !amount}
              className="flex-1 px-4 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Activity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Release Modal
// ============================================================================

function ReleaseModal({
  fund,
  onClose,
  onSuccess,
}: {
  fund: Fund
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [releaseType, setReleaseType] = useState<string>('board_approved')

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/grain/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_release',
          fundId: fund.id,
          amount: parseFloat(amount),
          reason,
          releaseType,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to request release')
      }

      onSuccess()
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
          <h2 className="text-lg font-bold text-white">Request Restriction Release</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Release Type *</label>
            <select
              value={releaseType}
              onChange={(e) => setReleaseType(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="board_approved">Board Approved</option>
              <option value="purpose_fulfilled">Purpose Fulfilled</option>
              <option value="donor_approved">Donor Approved</option>
              <option value="time_based">Time-Based (Scheduled)</option>
              <option value="legal_requirement">Legal Requirement</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Amount to Release *</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this release is being requested..."
              rows={3}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
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
              onClick={handleSubmit}
              disabled={loading || !amount || !reason}
              className="flex-1 px-4 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
