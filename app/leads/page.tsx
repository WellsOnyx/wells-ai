'use client'

/**
 * Leads Dashboard
 *
 * View and manage captured leads from GTM efforts
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'

interface Lead {
  id: string
  userId: string
  userEmail: string
  userName: string
  userPhone?: string | null
  userCompany?: string | null
  journey: 'founder' | 'buyer' | 'seller' | 'jobs'
  requirements: string
  status: 'new' | 'contacted' | 'in_progress' | 'closed' | 'won' | 'lost'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  intent?: string | null
  budget?: number | null
  timeline?: string | null
  contactedAt?: string | null
  contactedBy?: string | null
  createdAt: string
  conversationPreview?: { role: string; content: string } | null
}

export default function LeadsPage() {
  const { isLoaded, userId } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState({
    status: '',
    journey: '',
    priority: '',
  })

  useEffect(() => {
    if (isLoaded && userId) {
      fetchLeads()
    }
  }, [isLoaded, userId, filter])

  async function fetchLeads() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter.status) params.append('status', filter.status)
      if (filter.journey) params.append('journey', filter.journey)
      if (filter.priority) params.append('priority', filter.priority)

      const response = await fetch(`/api/leads?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch leads')
      }

      const data = await response.json()
      setLeads(data.leads)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading leads...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    )
  }

  const statusColors = {
    new: 'bg-blue-500',
    contacted: 'bg-yellow-500',
    in_progress: 'bg-purple-500',
    closed: 'bg-gray-500',
    won: 'bg-green-500',
    lost: 'bg-red-500',
  }

  const priorityColors = {
    low: 'text-gray-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    urgent: 'text-red-400',
  }

  const journeyEmojis = {
    founder: '👔',
    buyer: '🛒',
    seller: '💼',
    jobs: '💼',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Leads Dashboard</h1>
          <p className="text-gray-300">Manage captured leads from your GTM efforts</p>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Journey</label>
              <select
                value={filter.journey}
                onChange={(e) => setFilter({ ...filter, journey: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Journeys</option>
                <option value="founder">Founder</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="jobs">Jobs</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
              <select
                value={filter.priority}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{leads.length}</div>
            <div className="text-sm text-gray-300">Total Leads</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">
              {leads.filter((l) => l.status === 'new').length}
            </div>
            <div className="text-sm text-gray-300">New</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">
              {leads.filter((l) => l.status === 'in_progress').length}
            </div>
            <div className="text-sm text-gray-300">In Progress</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">
              {leads.filter((l) => l.status === 'won').length}
            </div>
            <div className="text-sm text-gray-300">Won</div>
          </div>
        </div>

        {/* Leads List */}
        <div className="space-y-4">
          {leads.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-12 text-center">
              <div className="text-gray-400 text-lg">No leads found</div>
              <div className="text-gray-500 text-sm mt-2">
                Leads will appear here as users express interest
              </div>
            </div>
          ) : (
            leads.map((lead) => (
              <div
                key={lead.id}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/15 transition-colors cursor-pointer"
                onClick={() => (window.location.href = `/leads/${lead.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{journeyEmojis[lead.journey]}</div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">{lead.userName}</h3>
                      <p className="text-gray-300 text-sm">{lead.userEmail}</p>
                      {lead.userCompany && (
                        <p className="text-gray-400 text-sm">{lead.userCompany}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium text-white ${
                        statusColors[lead.status]
                      }`}
                    >
                      {lead.status.replace('_', ' ').toUpperCase()}
                    </span>
                    {lead.priority && (
                      <span
                        className={`text-xs font-medium ${priorityColors[lead.priority]}`}
                      >
                        {lead.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-400 mb-1">Requirements</div>
                  <div className="text-white">{lead.requirements}</div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Journey</div>
                    <div className="text-white capitalize">{lead.journey}</div>
                  </div>
                  {lead.budget && (
                    <div>
                      <div className="text-gray-400">Budget</div>
                      <div className="text-white">${lead.budget.toLocaleString()}</div>
                    </div>
                  )}
                  {lead.timeline && (
                    <div>
                      <div className="text-gray-400">Timeline</div>
                      <div className="text-white">{lead.timeline}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-gray-400">Created</div>
                    <div className="text-white">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
