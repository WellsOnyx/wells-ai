'use client'

/**
 * LinkedIn Campaign Dashboard
 *
 * Shows active LinkedIn GTM campaigns with:
 * - Campaign stats (response rate, qualification rate, conversion rate)
 * - Prospect lists
 * - Connection requests and messages to copy-paste (manual mode)
 * - Performance diagnostics
 */

import { useState, useEffect } from 'react'
import type { LinkedInCampaign } from '@/lib/gtm/linkedin-integration'

export default function LinkedInCampaignDashboard() {
  const [campaigns, setCampaigns] = useState<LinkedInCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<LinkedInCampaign | null>(null)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/gtm/linkedin/campaigns')
      if (!response.ok) throw new Error('Failed to fetch campaigns')

      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading campaigns...</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#183b6d]">LinkedIn Campaigns</h1>
        <button
          onClick={() => {/* TODO: Open campaign creation modal */}}
          className="px-6 py-3 bg-[#dba63f] text-[#183b6d] font-bold hover:bg-[#dba63f]/90 transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        // Empty state
        <div className="border-2 border-[#183b6d]/20 p-12 text-center relative" style={{ borderStyle: 'dashed' }}>
          {/* Sketch corner marks */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#183b6d]"></div>
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#183b6d]"></div>
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#183b6d]"></div>
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#183b6d]"></div>

          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-[#183b6d] mb-2">No campaigns yet</h3>
          <p className="text-[#9ea1a7] mb-6">
            Create your first LinkedIn campaign to start generating qualified leads using the 20-year methodology.
          </p>
          <button
            onClick={() => {/* TODO: Open campaign creation */}}
            className="px-6 py-3 bg-[#dba63f] text-[#183b6d] font-bold hover:bg-[#dba63f]/90 transition-colors"
          >
            Create Your First Campaign
          </button>
        </div>
      ) : (
        // Campaign list
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onClick={() => setSelectedCampaign(campaign)}
            />
          ))}
        </div>
      )}

      {/* Campaign details modal */}
      {selectedCampaign && (
        <CampaignDetailsModal
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  )
}

function CampaignCard({
  campaign,
  onClick
}: {
  campaign: LinkedInCampaign
  onClick: () => void
}) {
  const { stats } = campaign

  // Calculate metrics
  const responseRate = stats.messagesSent > 0
    ? Math.round((stats.responsesReceived / stats.messagesSent) * 100)
    : 0

  const qualificationRate = stats.responsesReceived > 0
    ? Math.round((stats.qualifiedResponses / stats.responsesReceived) * 100)
    : 0

  const conversionRate = stats.messagesSent > 0
    ? Math.round((stats.meetingsBooked / stats.messagesSent) * 100)
    : 0

  // Determine status color
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800 border-gray-300',
    active: 'bg-green-100 text-green-800 border-green-300',
    paused: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    completed: 'bg-blue-100 text-blue-800 border-blue-300'
  }

  return (
    <div
      onClick={onClick}
      className="border-2 border-[#183b6d]/20 p-6 hover:border-[#dba63f] cursor-pointer transition-all group relative"
      style={{ borderStyle: 'dashed' }}
    >
      {/* Sketch corner marks */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#183b6d]"></div>
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#183b6d]"></div>
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#183b6d]"></div>
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#183b6d]"></div>

      {/* Campaign name and status */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-[#183b6d] group-hover:text-[#dba63f] transition-colors">
          {campaign.name}
        </h3>
        <span className={`px-2 py-1 text-xs border ${statusColors[campaign.status]}`}>
          {campaign.status}
        </span>
      </div>

      {/* Key metrics */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-[#9ea1a7]">Response Rate</span>
          <span className={`font-semibold ${responseRate >= 20 ? 'text-green-600' : 'text-red-600'}`}>
            {responseRate}%
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#9ea1a7]">Qualification Rate</span>
          <span className={`font-semibold ${qualificationRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
            {qualificationRate}%
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#9ea1a7]">Conversion Rate</span>
          <span className={`font-semibold ${conversionRate >= 10 ? 'text-green-600' : 'text-red-600'}`}>
            {conversionRate}%
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[#9ea1a7]">Messages Sent</p>
          <p className="font-semibold text-[#183b6d]">{stats.messagesSent}</p>
        </div>
        <div>
          <p className="text-[#9ea1a7]">Responses</p>
          <p className="font-semibold text-[#183b6d]">{stats.responsesReceived}</p>
        </div>
        <div>
          <p className="text-[#9ea1a7]">Qualified</p>
          <p className="font-semibold text-[#183b6d]">{stats.qualifiedResponses}</p>
        </div>
        <div>
          <p className="text-[#9ea1a7]">Meetings</p>
          <p className="font-semibold text-[#183b6d]">{stats.meetingsBooked}</p>
        </div>
      </div>
    </div>
  )
}

function CampaignDetailsModal({
  campaign,
  onClose
}: {
  campaign: LinkedInCampaign
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto border-4 border-[#183b6d]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-2 border-[#183b6d]/20 p-6 flex items-center justify-between" style={{ borderStyle: 'dashed' }}>
          <div>
            <h2 className="text-2xl font-bold text-[#183b6d]">{campaign.name}</h2>
            <p className="text-sm text-[#9ea1a7]">{campaign.qualification.roleTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-3xl text-[#9ea1a7] hover:text-[#183b6d] transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Performance metrics */}
          <div>
            <h3 className="font-semibold text-[#183b6d] mb-3">Performance Metrics</h3>
            <div className="grid grid-cols-3 gap-4">
              <MetricCard
                label="Response Rate"
                value={`${Math.round((campaign.stats.responsesReceived / (campaign.stats.messagesSent || 1)) * 100)}%`}
                target="20-40%"
                status={campaign.stats.responseRate >= 0.2 ? 'good' : 'poor'}
              />
              <MetricCard
                label="Qualification Rate"
                value={`${Math.round((campaign.stats.qualifiedResponses / (campaign.stats.responsesReceived || 1)) * 100)}%`}
                target="50%+"
                status={campaign.stats.qualificationRate >= 0.5 ? 'good' : 'poor'}
              />
              <MetricCard
                label="Conversion Rate"
                value={`${Math.round((campaign.stats.meetingsBooked / (campaign.stats.messagesSent || 1)) * 100)}%`}
                target="10-15%"
                status={campaign.stats.conversionRate >= 0.1 ? 'good' : 'poor'}
              />
            </div>
          </div>

          {/* Target prospects */}
          <div>
            <h3 className="font-semibold text-[#183b6d] mb-3">Target Prospects (80-90% Zone)</h3>
            <div className="border-2 border-[#183b6d]/20 p-4" style={{ borderStyle: 'dashed' }}>
              <p className="text-sm text-[#9ea1a7]">
                {campaign.targetCandidates.length} prospects identified in the sweet spot
              </p>
              {/* TODO: List prospects */}
            </div>
          </div>

          {/* Daily workflow */}
          <div>
            <h3 className="font-semibold text-[#183b6d] mb-3">Daily LinkedIn Routine</h3>
            <div className="space-y-2">
              <WorkflowStep
                time="Morning (15 min)"
                tasks={[
                  `Send ${campaign.dailyConnectionLimit} connection requests`,
                  'Engage with 5-10 prospect posts'
                ]}
              />
              <WorkflowStep
                time="Midday (10 min)"
                tasks={[
                  'Check for new connection acceptances',
                  'Send Day 1 message to new connections',
                  'Respond to replies'
                ]}
              />
              <WorkflowStep
                time="Evening (5 min)"
                tasks={[
                  'Review profile views',
                  'Schedule follow-ups for tomorrow'
                ]}
              />
            </div>
          </div>

          {/* Search criteria */}
          <div>
            <h3 className="font-semibold text-[#183b6d] mb-3">LinkedIn Search Criteria</h3>
            <div className="border-2 border-[#183b6d]/20 p-4 font-mono text-sm" style={{ borderStyle: 'dashed' }}>
              <p><strong>Keywords:</strong> {campaign.searchCriteria.keywords?.join(', ') || 'N/A'}</p>
              <p><strong>Titles:</strong> {campaign.searchCriteria.titles?.join(', ') || 'N/A'}</p>
              <p><strong>Companies:</strong> {campaign.searchCriteria.companies?.join(', ') || 'N/A'}</p>
              <p><strong>Industries:</strong> {campaign.searchCriteria.industries?.join(', ') || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  target,
  status
}: {
  label: string
  value: string
  target: string
  status: 'good' | 'poor'
}) {
  return (
    <div className={`border-2 p-4 ${status === 'good' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`} style={{ borderStyle: 'dashed' }}>
      <p className="text-xs text-[#9ea1a7]">{label}</p>
      <p className={`text-2xl font-bold ${status === 'good' ? 'text-green-700' : 'text-red-700'}`}>{value}</p>
      <p className="text-xs text-[#9ea1a7]">Target: {target}</p>
    </div>
  )
}

function WorkflowStep({
  time,
  tasks
}: {
  time: string
  tasks: string[]
}) {
  return (
    <div className="border-2 border-[#183b6d]/20 p-3" style={{ borderStyle: 'dashed' }}>
      <p className="font-semibold text-[#183b6d] text-sm mb-2">{time}</p>
      <ul className="space-y-1">
        {tasks.map((task, i) => (
          <li key={i} className="text-sm text-[#9ea1a7]">→ {task}</li>
        ))}
      </ul>
    </div>
  )
}
