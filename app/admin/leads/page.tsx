'use client'

/**
 * Admin Dashboard - Leads Management
 *
 * View and manage all incoming leads from Wells conversations.
 * Features:
 * - Table view with filtering and sorting
 * - Status management
 * - Lead detail modal with full conversation history
 * - Notes and activity tracking
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Sparkles,
  Loader2,
  Search,
  Filter,
  ChevronDown,
  Eye,
  X,
  MessageSquare,
  Calendar,
  Rocket,
  ShoppingCart,
  Store,
  Briefcase,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  ArrowUpDown,
  Mail,
  Phone,
  Building,
  User,
  FileText,
  Activity
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface Lead {
  id: string
  user_id: string
  user_email: string
  user_name: string
  user_phone?: string
  user_company?: string
  journey: 'founder' | 'buyer' | 'seller' | 'jobs'
  requirements: string
  conversation_history: Array<{ role: string; content: string }>
  status: 'new' | 'contacted' | 'in_progress' | 'closed' | 'won' | 'lost'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  source: string
  intent?: string
  budget?: number
  timeline?: string
  created_at: string
  updated_at: string
  contacted_at?: string
  contacted_by?: string
  closed_at?: string
  notes_count?: number
  activities_count?: number
}

interface LeadNote {
  id: string
  note: string
  note_type: string
  created_by: string
  created_at: string
}

interface LeadActivity {
  id: string
  activity_type: string
  activity_data: any
  performed_by: string
  created_at: string
}

// ============================================================================
// JOURNEY CONFIG
// ============================================================================

const JOURNEY_CONFIG = {
  founder: {
    icon: Rocket,
    color: 'amber',
    label: 'Founder',
  },
  buyer: {
    icon: ShoppingCart,
    color: 'blue',
    label: 'Buyer',
  },
  seller: {
    icon: Store,
    color: 'green',
    label: 'Seller',
  },
  jobs: {
    icon: Briefcase,
    color: 'purple',
    label: 'Jobs',
  },
}

const STATUS_CONFIG = {
  new: {
    icon: AlertCircle,
    color: 'blue',
    label: 'New',
  },
  contacted: {
    icon: Mail,
    color: 'cyan',
    label: 'Contacted',
  },
  in_progress: {
    icon: Clock,
    color: 'amber',
    label: 'In Progress',
  },
  closed: {
    icon: CheckCircle,
    color: 'green',
    label: 'Closed',
  },
  won: {
    icon: CheckCircle,
    color: 'green',
    label: 'Won',
  },
  lost: {
    icon: XCircle,
    color: 'red',
    label: 'Lost',
  },
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminLeadsPage() {
  const { user, isLoaded } = useUser()
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadDetails, setLeadDetails] = useState<{
    lead: Lead
    notes: LeadNote[]
    activities: LeadActivity[]
  } | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [journeyFilter, setJourneyFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch leads
  useEffect(() => {
    fetchLeads()
  }, [statusFilter, journeyFilter])

  const fetchLeads = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (journeyFilter !== 'all') params.append('journey', journeyFilter)

      const response = await fetch(`/api/admin/leads?${params}`)
      if (!response.ok) throw new Error('Failed to fetch leads')

      const data = await response.json()
      setLeads(data.leads)
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch lead details
  const fetchLeadDetails = async (leadId: string) => {
    setIsDetailLoading(true)
    try {
      const response = await fetch(`/api/admin/leads/${leadId}`)
      if (!response.ok) throw new Error('Failed to fetch lead details')

      const data = await response.json()
      setLeadDetails(data)
    } catch (error) {
      console.error('Error fetching lead details:', error)
    } finally {
      setIsDetailLoading(false)
    }
  }

  // Update lead status
  const updateLeadStatus = async (leadId: string, status: string) => {
    try {
      const response = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status }),
      })

      if (!response.ok) throw new Error('Failed to update lead')

      // Refresh leads
      await fetchLeads()
      if (selectedLead?.id === leadId) {
        await fetchLeadDetails(leadId)
      }
    } catch (error) {
      console.error('Error updating lead:', error)
    }
  }

  // Open lead detail modal
  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead)
    fetchLeadDetails(lead.id)
  }

  // Close modal
  const closeModal = () => {
    setSelectedLead(null)
    setLeadDetails(null)
  }

  // Filter leads by search
  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      lead.user_name.toLowerCase().includes(query) ||
      lead.user_email.toLowerCase().includes(query) ||
      lead.requirements.toLowerCase().includes(query) ||
      (lead.user_company && lead.user_company.toLowerCase().includes(query))
    )
  })

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 glass sticky top-0 z-50 shadow-xl">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-4 h-4 text-black" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Wells Admin
                </span>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                <Link
                  href="/admin/leads"
                  className="px-4 py-2 rounded-lg bg-white/10 text-white font-medium text-sm transition-all"
                >
                  Leads
                </Link>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 font-medium text-sm transition-all"
                >
                  Dashboard
                </Link>
              </nav>
            </div>

            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9 ring-2 ring-white/10 hover:ring-amber-500/50 transition-all',
                },
              }}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Leads Management
          </h1>
          <p className="text-gray-400">
            View and manage all incoming leads from Wells conversations
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Leads', value: leads.length, color: 'blue' },
            {
              label: 'New',
              value: leads.filter((l) => l.status === 'new').length,
              color: 'amber',
            },
            {
              label: 'In Progress',
              value: leads.filter((l) => l.status === 'in_progress').length,
              color: 'cyan',
            },
            {
              label: 'Closed',
              value: leads.filter((l) => ['closed', 'won'].includes(l.status)).length,
              color: 'green',
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="card-premium p-6 hover:scale-105 transition-transform cursor-pointer"
            >
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card-premium p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, email, company, or requirements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 input-premium"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-premium pr-10 appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
            </div>

            {/* Journey Filter */}
            <div className="relative">
              <select
                value={journeyFilter}
                onChange={(e) => setJourneyFilter(e.target.value)}
                className="input-premium pr-10 appearance-none cursor-pointer"
              >
                <option value="all">All Journeys</option>
                <option value="founder">Founder</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="jobs">Jobs</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="card-premium overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-20">
              <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No leads found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">
                      Lead
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">
                      Journey
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">
                      Requirements
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">
                      Created
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredLeads.map((lead) => {
                    const journeyConfig = JOURNEY_CONFIG[lead.journey]
                    const statusConfig = STATUS_CONFIG[lead.status]
                    const JourneyIcon = journeyConfig.icon
                    const StatusIcon = statusConfig.icon

                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => openLeadDetail(lead)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold text-sm">
                              {lead.user_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{lead.user_name}</div>
                              <div className="text-sm text-gray-400">{lead.user_email}</div>
                              {lead.user_company && (
                                <div className="text-xs text-gray-500">{lead.user_company}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-${journeyConfig.color}-500/10 border border-${journeyConfig.color}-500/20`}>
                            <JourneyIcon className={`w-4 h-4 text-${journeyConfig.color}-500`} />
                            <span className="text-sm font-medium">{journeyConfig.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            <p className="text-sm text-gray-300 line-clamp-2">
                              {lead.requirements}
                            </p>
                            {lead.conversation_history && lead.conversation_history.length > 0 && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                <MessageSquare className="w-3 h-3" />
                                <span>{lead.conversation_history.length} messages</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-${statusConfig.color}-500/10 border border-${statusConfig.color}-500/20`}>
                            <StatusIcon className={`w-4 h-4 text-${statusConfig.color}-500`} />
                            <span className="text-sm font-medium">{statusConfig.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-400">{formatDate(lead.created_at)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openLeadDetail(lead)
                            }}
                            className="btn-premium-secondary px-4 py-2 text-sm"
                          >
                            <Eye className="w-4 h-4 inline mr-2" />
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-gradient-to-b from-white/10 to-white/5 border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 glass border-b border-white/10 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold text-xl">
                    {selectedLead.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {selectedLead.user_name}
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {selectedLead.user_email}
                      </span>
                      {selectedLead.user_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {selectedLead.user_phone}
                        </span>
                      )}
                      {selectedLead.user_company && (
                        <span className="flex items-center gap-1">
                          <Building className="w-4 h-4" />
                          {selectedLead.user_company}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Status Selector */}
              <div className="mt-4 flex items-center gap-4">
                <label className="text-sm font-semibold text-gray-400">Status:</label>
                <select
                  value={selectedLead.status}
                  onChange={(e) => updateLeadStatus(selectedLead.id, e.target.value)}
                  className="input-premium text-sm py-2"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
              {isDetailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Content */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Requirements */}
                    <div className="card-premium p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-500" />
                        Requirements
                      </h3>
                      <p className="text-gray-300 leading-relaxed">{selectedLead.requirements}</p>
                      {selectedLead.intent && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <span className="text-sm font-semibold text-gray-400">Intent: </span>
                          <span className="text-white">{selectedLead.intent}</span>
                        </div>
                      )}
                    </div>

                    {/* Conversation History */}
                    <div className="card-premium p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-amber-500" />
                        Conversation History
                      </h3>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {selectedLead.conversation_history &&
                          selectedLead.conversation_history.map((msg, i) => (
                            <div
                              key={i}
                              className={`flex ${
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                                  msg.role === 'user'
                                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black'
                                    : 'bg-white/5 border border-white/10 text-gray-200'
                                }`}
                              >
                                <div className="text-xs font-semibold mb-1 opacity-70">
                                  {msg.role === 'user' ? 'User' : 'Wells'}
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Info Card */}
                    <div className="card-premium p-6">
                      <h3 className="text-lg font-bold mb-4">Details</h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <div className="text-gray-400 mb-1">Journey</div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const config = JOURNEY_CONFIG[selectedLead.journey]
                              const Icon = config.icon
                              return (
                                <>
                                  <Icon className="w-4 h-4 text-amber-500" />
                                  <span className="text-white font-medium">{config.label}</span>
                                </>
                              )
                            })()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">Created</div>
                          <div className="text-white">
                            {new Date(selectedLead.created_at).toLocaleString()}
                          </div>
                        </div>
                        {selectedLead.contacted_at && (
                          <div>
                            <div className="text-gray-400 mb-1">Contacted</div>
                            <div className="text-white">
                              {new Date(selectedLead.contacted_at).toLocaleString()}
                            </div>
                          </div>
                        )}
                        {selectedLead.budget && (
                          <div>
                            <div className="text-gray-400 mb-1">Budget</div>
                            <div className="text-white">${selectedLead.budget.toLocaleString()}</div>
                          </div>
                        )}
                        {selectedLead.timeline && (
                          <div>
                            <div className="text-gray-400 mb-1">Timeline</div>
                            <div className="text-white">{selectedLead.timeline}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Activities */}
                    {leadDetails?.activities && leadDetails.activities.length > 0 && (
                      <div className="card-premium p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <Activity className="w-5 h-5 text-amber-500" />
                          Activity
                        </h3>
                        <div className="space-y-3">
                          {leadDetails.activities.slice(0, 5).map((activity) => (
                            <div key={activity.id} className="text-sm">
                              <div className="text-gray-300">{activity.activity_type}</div>
                              <div className="text-xs text-gray-500">
                                {formatDate(activity.created_at)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {leadDetails?.notes && leadDetails.notes.length > 0 && (
                      <div className="card-premium p-6">
                        <h3 className="text-lg font-bold mb-4">Notes</h3>
                        <div className="space-y-3">
                          {leadDetails.notes.map((note) => (
                            <div key={note.id} className="text-sm">
                              <p className="text-gray-300 mb-1">{note.note}</p>
                              <div className="text-xs text-gray-500">
                                {formatDate(note.created_at)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
