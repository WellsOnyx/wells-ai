'use client'

/**
 * Buyer Sourcing Dashboard
 *
 * Shows:
 * - Active sourcing requests
 * - Matched suppliers (with match scores)
 * - Pending introductions
 * - Active deals in progress
 * - Completed transactions (with savings shown)
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Loader2,
  Package,
  Users,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Building2,
  Star,
  Send,
  Eye,
  Filter,
  RefreshCw,
  Zap,
  ExternalLink,
  X,
  Sparkles
} from 'lucide-react'
import {
  REQUEST_STATUS_CONFIG,
  MATCH_STATUS_CONFIG,
  getCategoryById,
  type SourcingRequestStatus,
  type MatchStatus
} from '@/lib/wells-ai/sourcing/categories'

interface SourcingRequest {
  id: string
  title: string
  description: string
  category_id: string
  subcategory_id: string
  status: SourcingRequestStatus
  urgency: string
  budget_min: number | null
  budget_max: number | null
  delivery_location: string
  total_matches: number
  interested_matches: number
  total_introductions: number
  top_match_score: number | null
  created_at: string
  submitted_at: string | null
}

interface SupplierMatch {
  id: string
  supplier_id: string
  match_score: number
  match_reasoning: string
  grain_enabled: boolean
  strengths: string[]
  concerns: string[]
  estimated_price_low: number | null
  estimated_price_high: number | null
  estimated_lead_time_days: number | null
  status: MatchStatus
  buyer_notes: string | null
  supplier: {
    id: string
    company_name: string
    website: string | null
    products: string[]
    certifications: string[]
    lead_time: number
    minimum_order: number
  }
  introduction: {
    intro_status: string
    intro_sent_at: string | null
    supplier_responded_at: string | null
  } | null
}

interface DashboardStats {
  total_requests: number
  active_requests: number
  pending_introductions: number
  deals_in_progress: number
  completed_deals: number
  total_savings: number
  total_spend: number
}

export default function SourcingDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightedRequestId = searchParams.get('request')

  // State
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [requests, setRequests] = useState<SourcingRequest[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedRequest, setExpandedRequest] = useState<string | null>(highlightedRequestId)
  const [matches, setMatches] = useState<Record<string, SupplierMatch[]>>({})
  const [loadingMatches, setLoadingMatches] = useState<string | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<SupplierMatch | null>(null)
  const [introModalOpen, setIntroModalOpen] = useState(false)
  const [introMessage, setIntroMessage] = useState('')
  const [sendingIntro, setSendingIntro] = useState(false)

  // Fetch data
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetch(`/api/wells-ai/source?status=${statusFilter}`)
      const data = await response.json()

      if (data.success) {
        setRequests(data.requests)
        setStats({
          total_requests: data.counts.all || 0,
          active_requests: (data.counts.submitted || 0) + (data.counts.matching || 0) + (data.counts.matched || 0),
          pending_introductions: data.requests.reduce((sum: number, r: SourcingRequest) => sum + r.total_introductions, 0),
          deals_in_progress: data.counts.negotiating || 0,
          completed_deals: data.counts.deal_closed || 0,
          total_savings: 0, // Would come from transactions
          total_spend: 0
        })

        // Auto-expand highlighted request
        if (highlightedRequestId) {
          loadMatchesForRequest(highlightedRequestId)
        }
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load matches for a request
  const loadMatchesForRequest = async (requestId: string) => {
    if (matches[requestId]) return // Already loaded

    setLoadingMatches(requestId)
    try {
      const response = await fetch(`/api/wells-ai/source/matches?request_id=${requestId}`)
      const data = await response.json()

      if (data.success) {
        setMatches(prev => ({
          ...prev,
          [requestId]: data.matches
        }))
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoadingMatches(null)
    }
  }

  // Toggle expand request
  const toggleExpand = (requestId: string) => {
    if (expandedRequest === requestId) {
      setExpandedRequest(null)
    } else {
      setExpandedRequest(requestId)
      loadMatchesForRequest(requestId)
    }
  }

  // Update match status
  const updateMatchStatus = async (matchId: string, status: MatchStatus) => {
    try {
      const response = await fetch('/api/wells-ai/source/matches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, status })
      })

      if (response.ok) {
        // Refresh matches for this request
        const requestId = Object.entries(matches).find(([_, m]) =>
          m.some(match => match.id === matchId)
        )?.[0]

        if (requestId) {
          setMatches(prev => ({
            ...prev,
            [requestId]: prev[requestId].map(m =>
              m.id === matchId ? { ...m, status } : m
            )
          }))
        }
      }
    } catch (error) {
      console.error('Error updating match:', error)
    }
  }

  // Request introduction
  const requestIntroduction = async () => {
    if (!selectedMatch) return

    setSendingIntro(true)
    try {
      const response = await fetch('/api/wells-ai/source/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: selectedMatch.id,
          buyer_message: introMessage
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update local state
        const requestId = Object.entries(matches).find(([_, m]) =>
          m.some(match => match.id === selectedMatch.id)
        )?.[0]

        if (requestId) {
          setMatches(prev => ({
            ...prev,
            [requestId]: prev[requestId].map(m =>
              m.id === selectedMatch.id
                ? { ...m, status: 'intro_sent' as MatchStatus, introduction: { intro_status: 'sent', intro_sent_at: new Date().toISOString(), supplier_responded_at: null } }
                : m
            )
          }))
        }

        setIntroModalOpen(false)
        setSelectedMatch(null)
        setIntroMessage('')
      }
    } catch (error) {
      console.error('Error sending intro:', error)
    } finally {
      setSendingIntro(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [statusFilter])

  // Status badge component
  const StatusBadge = ({ status }: { status: SourcingRequestStatus }) => {
    const config = REQUEST_STATUS_CONFIG[status]
    const colorClasses: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-700',
      blue: 'bg-blue-100 text-blue-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      purple: 'bg-purple-100 text-purple-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      orange: 'bg-orange-100 text-orange-700',
      cyan: 'bg-cyan-100 text-cyan-700',
      green: 'bg-emerald-100 text-emerald-700',
      red: 'bg-red-100 text-red-700'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorClasses[config.color] || colorClasses.gray}`}>
        {config.label}
      </span>
    )
  }

  // Match score component
  const MatchScore = ({ score, grainEnabled }: { score: number; grainEnabled: boolean }) => {
    const color = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-blue-600' : score >= 40 ? 'text-yellow-600' : 'text-gray-600'

    return (
      <div className="flex items-center gap-2">
        <div className={`text-2xl font-bold ${color}`}>{score}</div>
        <div className="text-xs text-gray-500">/ 100</div>
        {grainEnabled && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full">
            <Zap className="w-3 h-3 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">GRAIN</span>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/wells-ai" className="flex items-center gap-2.5 text-gray-900 font-semibold text-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                W
              </div>
              Sourcing
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600">Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/wells-ai/source"
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Request
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.active_requests}</div>
              <div className="text-sm text-gray-500">Active Requests</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{requests.reduce((sum, r) => sum + r.total_matches, 0)}</div>
              <div className="text-sm text-gray-500">Matched Suppliers</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.pending_introductions}</div>
              <div className="text-sm text-gray-500">Introductions</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-cyan-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.deals_in_progress}</div>
              <div className="text-sm text-gray-500">In Negotiation</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.completed_deals}</div>
              <div className="text-sm text-gray-500">Deals Closed</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-4 h-4 text-gray-400" />
          {['all', 'matching', 'matched', 'negotiating', 'deal_closed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {status === 'all' ? 'All' : REQUEST_STATUS_CONFIG[status as SourcingRequestStatus]?.label || status}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sourcing requests yet</h3>
            <p className="text-gray-500 mb-6">Create your first request to start finding suppliers</p>
            <Link
              href="/wells-ai/source"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Request
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const isExpanded = expandedRequest === request.id
              const requestMatches = matches[request.id] || []
              const category = getCategoryById(request.category_id)

              return (
                <div
                  key={request.id}
                  className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                    request.id === highlightedRequestId
                      ? 'border-blue-300 ring-2 ring-blue-100'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Request Header */}
                  <button
                    onClick={() => toggleExpand(request.id)}
                    className="w-full px-6 py-5 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-xl shrink-0">
                      {category?.icon || '📦'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">{request.title}</h3>
                        <StatusBadge status={request.status} />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{category?.name || 'Other'}</span>
                        {request.delivery_location && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>{request.delivery_location}</span>
                          </>
                        )}
                        <span className="text-gray-300">|</span>
                        <span>{new Date(request.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      {request.total_matches > 0 && (
                        <div className="text-center">
                          <div className="text-lg font-semibold text-gray-900">{request.total_matches}</div>
                          <div className="text-xs text-gray-500">Matches</div>
                        </div>
                      )}
                      {request.top_match_score && (
                        <div className="text-center">
                          <div className={`text-lg font-semibold ${
                            request.top_match_score >= 80 ? 'text-emerald-600' : 'text-blue-600'
                          }`}>
                            {request.top_match_score}%
                          </div>
                          <div className="text-xs text-gray-500">Top Score</div>
                        </div>
                      )}
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {/* Description */}
                      <div className="px-6 py-4 bg-gray-50">
                        <p className="text-sm text-gray-600">{request.description}</p>
                        {(request.budget_min || request.budget_max) && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                            <DollarSign className="w-4 h-4" />
                            Budget: {request.budget_min ? `$${request.budget_min.toLocaleString()}` : 'Min not set'} - {request.budget_max ? `$${request.budget_max.toLocaleString()}` : 'Max not set'}
                          </div>
                        )}
                      </div>

                      {/* Matches */}
                      <div className="px-6 py-4">
                        {loadingMatches === request.id ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                          </div>
                        ) : requestMatches.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            {request.status === 'matching' ? (
                              <div className="flex items-center justify-center gap-2">
                                <Sparkles className="w-5 h-5 animate-pulse" />
                                Finding suppliers...
                              </div>
                            ) : (
                              'No matches yet'
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">
                              Matched Suppliers ({requestMatches.length})
                            </h4>

                            {requestMatches.map((match) => (
                              <div
                                key={match.id}
                                className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                              >
                                {/* Match Score */}
                                <div className="shrink-0">
                                  <MatchScore score={match.match_score} grainEnabled={match.grain_enabled} />
                                </div>

                                {/* Supplier Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-medium text-gray-900">{match.supplier.company_name}</h5>
                                    {match.supplier.website && (
                                      <a
                                        href={match.supplier.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-gray-400 hover:text-gray-600"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 mb-2">
                                    Lead time: {match.supplier.lead_time} days | Min order: ${match.supplier.minimum_order}
                                  </div>
                                  {match.strengths.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {match.strengths.slice(0, 3).map((strength, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                                          {strength}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {match.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => updateMatchStatus(match.id, 'interested')}
                                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-200 transition-colors"
                                      >
                                        Interested
                                      </button>
                                      <button
                                        onClick={() => updateMatchStatus(match.id, 'declined')}
                                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                      >
                                        Pass
                                      </button>
                                    </>
                                  )}

                                  {match.status === 'interested' && !match.introduction && (
                                    <button
                                      onClick={() => {
                                        setSelectedMatch(match)
                                        setIntroModalOpen(true)
                                      }}
                                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                                    >
                                      <Send className="w-4 h-4" />
                                      Request Intro
                                    </button>
                                  )}

                                  {match.introduction && (
                                    <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                      MATCH_STATUS_CONFIG[match.status]?.color === 'green'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {MATCH_STATUS_CONFIG[match.status]?.label || match.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
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

      {/* Introduction Modal */}
      {introModalOpen && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Request Introduction</h3>
              <button
                onClick={() => {
                  setIntroModalOpen(false)
                  setSelectedMatch(null)
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-6">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{selectedMatch.supplier.company_name}</h4>
                  <div className="text-sm text-gray-500">Match score: {selectedMatch.match_score}%</div>
                </div>
              </div>

              <label className="block mb-4">
                <span className="text-sm font-medium text-gray-900">Add a personal note (optional)</span>
                <textarea
                  value={introMessage}
                  onChange={(e) => setIntroMessage(e.target.value)}
                  placeholder="Hi, I'm interested in your products for our upcoming project..."
                  className="mt-2 w-full h-24 px-4 py-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                />
              </label>

              <p className="text-sm text-gray-500 mb-6">
                Wells AI will send a professional introduction email to {selectedMatch.supplier.company_name} on your behalf.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIntroModalOpen(false)
                    setSelectedMatch(null)
                  }}
                  className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={requestIntroduction}
                  disabled={sendingIntro}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all"
                >
                  {sendingIntro ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Introduction
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Wells AI Sourcing</span>
            <span>1% success fee on closed deals</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
