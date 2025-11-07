'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// TypeScript Types
interface Signal {
  type: string
  description: string
  score: number
}

interface Prospect {
  id: string
  name: string
  title: string
  company: string
  industry: string
  email?: string
  phone?: string
  linkedInUrl?: string
  matchScore: number
  signals: Signal[]
}

interface Message {
  id: string
  prospectId: string
  prospectName: string
  channel: 'email' | 'sms' | 'linkedin'
  subject?: string
  body: string
  status: 'pending' | 'approved' | 'rejected' | 'sent'
  canSend: boolean
  blockReason?: string
}

interface Campaign {
  id: string
  name: string
  practiceGroup: string
  status: 'draft' | 'pending_review' | 'approved' | 'sending' | 'sent' | 'completed'
  prospects: Prospect[]
  messages: Message[]
  icp: {
    industries: string[]
    titles: string[]
    companySizes: string[]
    geography: string[]
  }
  createdAt: string
  stats: {
    totalProspects: number
    totalMessages: number
    approvedMessages: number
    rejectedMessages: number
    sentMessages: number
  }
}

interface WellsOnyxCampaignReviewProps {
  campaignId?: string
  onComplete?: () => void
  onCancel?: () => void
}

export default function WellsOnyxCampaignReview({
  campaignId,
  onComplete,
  onCancel
}: WellsOnyxCampaignReviewProps) {
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'prospects' | 'messages'>('overview')
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  // Load campaign data
  useEffect(() => {
    loadCampaign()
  }, [campaignId])

  const loadCampaign = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch campaign data from API
      const response = await fetch(`/api/gtm/campaign/${campaignId || 'latest'}`)

      if (!response.ok) {
        throw new Error('Failed to load campaign')
      }

      const data = await response.json()
      setCampaign(data.campaign)
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign')
      console.error('Campaign load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Show notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  // Approve individual message
  const approveMessage = async (messageId: string) => {
    try {
      const response = await fetch('/api/gtm/outreach/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      })

      if (!response.ok) {
        throw new Error('Failed to approve message')
      }

      // Update local state
      setCampaign(prev => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.map(m =>
            m.id === messageId ? { ...m, status: 'approved' } : m
          ),
          stats: {
            ...prev.stats,
            approvedMessages: prev.stats.approvedMessages + 1
          }
        }
      })

      showNotification('success', 'Message approved')
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to approve message')
    }
  }

  // Reject individual message
  const rejectMessage = async (messageId: string) => {
    try {
      const response = await fetch('/api/gtm/outreach/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      })

      if (!response.ok) {
        throw new Error('Failed to reject message')
      }

      // Update local state
      setCampaign(prev => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.map(m =>
            m.id === messageId ? { ...m, status: 'rejected' } : m
          ),
          stats: {
            ...prev.stats,
            rejectedMessages: prev.stats.rejectedMessages + 1
          }
        }
      })

      showNotification('info', 'Message rejected')
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to reject message')
    }
  }

  // Bulk approve all pending messages
  const bulkApproveAll = async () => {
    if (!campaign) return

    const pendingMessages = campaign.messages.filter(m => m.status === 'pending' && m.canSend)

    try {
      await Promise.all(
        pendingMessages.map(m => approveMessage(m.id))
      )
      showNotification('success', `Approved ${pendingMessages.length} messages`)
    } catch (err: any) {
      showNotification('error', 'Failed to approve all messages')
    }
  }

  // Bulk reject all pending messages
  const bulkRejectAll = async () => {
    if (!campaign) return

    const pendingMessages = campaign.messages.filter(m => m.status === 'pending')

    try {
      await Promise.all(
        pendingMessages.map(m => rejectMessage(m.id))
      )
      showNotification('info', `Rejected ${pendingMessages.length} messages`)
    } catch (err: any) {
      showNotification('error', 'Failed to reject all messages')
    }
  }

  // Send all approved messages
  const sendApprovedMessages = async () => {
    if (!campaign) return

    const approvedMessages = campaign.messages.filter(m => m.status === 'approved')

    if (approvedMessages.length === 0) {
      showNotification('error', 'No approved messages to send')
      return
    }

    try {
      setSending(true)

      const response = await fetch(`/api/gtm/campaign/${campaign.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageIds: approvedMessages.map(m => m.id)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send messages')
      }

      const data = await response.json()

      showNotification('success', `Successfully sent ${data.sentCount} messages`)

      // Update campaign status
      setCampaign(prev => {
        if (!prev) return prev
        return {
          ...prev,
          status: 'sent',
          stats: {
            ...prev.stats,
            sentMessages: data.sentCount
          }
        }
      })

      // Call completion callback
      if (onComplete) {
        setTimeout(() => onComplete(), 2000)
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to send messages')
    } finally {
      setSending(false)
    }
  }

  // Get prospect details
  const getProspect = (prospectId: string): Prospect | undefined => {
    return campaign?.prospects.find(p => p.id === prospectId)
  }

  // Filter messages by prospect
  const getProspectMessages = (prospectId: string): Message[] => {
    return campaign?.messages.filter(m => m.prospectId === prospectId) || []
  }

  // Get signal color
  const getSignalColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 80) return 'text-[#dba63f] bg-[#dba63f]/10 border-[#dba63f]/20'
    return 'text-gray-600 bg-gray-50 border-gray-200'
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#dba63f] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-sm text-gray-400 tracking-wider uppercase">Loading Campaign</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1a1a1a] border border-red-900/30 rounded-sm p-8 text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-xl font-serif text-white mb-2">Campaign Not Found</h3>
          <p className="text-sm text-gray-400 mb-6">{error || 'Unable to load campaign details'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-[#dba63f] text-black font-medium text-sm tracking-wider uppercase rounded-sm hover:bg-[#c89430] transition-all"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  const pendingMessages = campaign.messages.filter(m => m.status === 'pending')
  const approvedMessages = campaign.messages.filter(m => m.status === 'approved')
  const rejectedMessages = campaign.messages.filter(m => m.status === 'rejected')

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top">
          <div className={`px-6 py-4 rounded-sm shadow-xl border ${
            notification.type === 'success' ? 'bg-green-900/90 border-green-700' :
            notification.type === 'error' ? 'bg-red-900/90 border-red-700' :
            'bg-blue-900/90 border-blue-700'
          }`}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className="text-sm font-medium text-white">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-serif text-white">{campaign.name}</h1>
                <span className={`px-3 py-1 text-xs font-medium tracking-wider uppercase rounded-sm ${
                  campaign.status === 'sent' ? 'bg-green-900/50 text-green-400 border border-green-700' :
                  campaign.status === 'approved' ? 'bg-blue-900/50 text-blue-400 border border-blue-700' :
                  'bg-gray-800 text-gray-400 border border-gray-700'
                }`}>
                  {campaign.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-400">{campaign.practiceGroup}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => onCancel ? onCancel() : router.back()}
                className="px-5 py-2 border border-gray-700 text-gray-300 rounded-sm hover:bg-gray-900 transition-all text-sm font-medium tracking-wider uppercase"
              >
                Cancel
              </button>
              <button
                onClick={sendApprovedMessages}
                disabled={sending || approvedMessages.length === 0}
                className="px-6 py-2 bg-[#dba63f] text-black font-medium text-sm tracking-wider uppercase rounded-sm hover:bg-[#c89430] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#dba63f]/20"
              >
                {sending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  `Send Approved (${approvedMessages.length})`
                )}
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-5">
              <div className="text-3xl font-bold text-white mb-1">{campaign.stats.totalProspects}</div>
              <div className="text-xs text-gray-400 tracking-wider uppercase">Prospects</div>
            </div>
            <div className="bg-[#1a1a1a] border border-green-900/30 rounded-sm p-5">
              <div className="text-3xl font-bold text-green-400 mb-1">{approvedMessages.length}</div>
              <div className="text-xs text-gray-400 tracking-wider uppercase">Approved</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#dba63f]/20 rounded-sm p-5">
              <div className="text-3xl font-bold text-[#dba63f] mb-1">{pendingMessages.length}</div>
              <div className="text-xs text-gray-400 tracking-wider uppercase">Pending</div>
            </div>
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-5">
              <div className="text-3xl font-bold text-gray-400 mb-1">{campaign.stats.sentMessages}</div>
              <div className="text-xs text-gray-400 tracking-wider uppercase">Sent</div>
            </div>
          </div>

          {/* Bulk Actions */}
          {pendingMessages.length > 0 && (
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={bulkApproveAll}
                className="px-4 py-2 bg-green-900/30 border border-green-700 text-green-400 rounded-sm hover:bg-green-900/50 transition-all text-xs font-medium tracking-wider uppercase"
              >
                Approve All ({pendingMessages.length})
              </button>
              <button
                onClick={bulkRejectAll}
                className="px-4 py-2 bg-red-900/30 border border-red-700 text-red-400 rounded-sm hover:bg-red-900/50 transition-all text-xs font-medium tracking-wider uppercase"
              >
                Reject All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 border-b-2 text-sm font-medium tracking-wider uppercase transition-all ${
                activeTab === 'overview'
                  ? 'border-[#dba63f] text-[#dba63f]'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`py-4 border-b-2 text-sm font-medium tracking-wider uppercase transition-all ${
                activeTab === 'prospects'
                  ? 'border-[#dba63f] text-[#dba63f]'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Prospects ({campaign.prospects.length})
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`py-4 border-b-2 text-sm font-medium tracking-wider uppercase transition-all ${
                activeTab === 'messages'
                  ? 'border-[#dba63f] text-[#dba63f]'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Messages ({campaign.messages.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* ICP Details */}
            <div>
              <h3 className="text-lg font-serif text-white mb-4">Ideal Customer Profile</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-5">
                  <div className="text-xs text-gray-400 tracking-wider uppercase mb-3">Industries</div>
                  <div className="flex flex-wrap gap-2">
                    {campaign.icp.industries.map((industry, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-900 border border-gray-700 text-gray-300 rounded-sm text-xs">
                        {industry}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-5">
                  <div className="text-xs text-gray-400 tracking-wider uppercase mb-3">Target Titles</div>
                  <div className="flex flex-wrap gap-2">
                    {campaign.icp.titles.map((title, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-900 border border-gray-700 text-gray-300 rounded-sm text-xs">
                        {title}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-5">
                  <div className="text-xs text-gray-400 tracking-wider uppercase mb-3">Company Sizes</div>
                  <div className="flex flex-wrap gap-2">
                    {campaign.icp.companySizes.map((size, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-900 border border-gray-700 text-gray-300 rounded-sm text-xs">
                        {size}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-5">
                  <div className="text-xs text-gray-400 tracking-wider uppercase mb-3">Geography</div>
                  <div className="flex flex-wrap gap-2">
                    {campaign.icp.geography.map((geo, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-900 border border-gray-700 text-gray-300 rounded-sm text-xs">
                        {geo}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Prospects */}
            <div>
              <h3 className="text-lg font-serif text-white mb-4">Top Prospects (80-90% Zone)</h3>
              <div className="space-y-3">
                {campaign.prospects
                  .filter(p => p.matchScore >= 0.8)
                  .slice(0, 10)
                  .map((prospect) => (
                    <div
                      key={prospect.id}
                      className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-5 hover:border-[#dba63f]/30 transition-all cursor-pointer"
                      onClick={() => setSelectedProspect(prospect.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-white">{prospect.name}</h4>
                            <span className="text-xs text-gray-500">{prospect.title}</span>
                          </div>
                          <p className="text-sm text-gray-400 mb-3">{prospect.company} • {prospect.industry}</p>

                          {/* Signals */}
                          <div className="flex flex-wrap gap-2">
                            {prospect.signals.slice(0, 3).map((signal, i) => (
                              <div
                                key={i}
                                className={`px-3 py-1 text-xs rounded-sm border ${getSignalColor(signal.score)}`}
                              >
                                {signal.type}: {signal.description}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Match Score */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-gray-400 mb-1">Match</div>
                            <div className="text-lg font-bold text-[#dba63f]">
                              {Math.round(prospect.matchScore * 100)}%
                            </div>
                          </div>
                          <div className="w-2 h-12 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="w-full bg-gradient-to-t from-[#dba63f] to-green-400 rounded-full transition-all"
                              style={{ height: `${prospect.matchScore * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Prospects Tab */}
        {activeTab === 'prospects' && (
          <div className="space-y-3">
            {campaign.prospects.map((prospect) => (
              <div
                key={prospect.id}
                className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-5 hover:border-[#dba63f]/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-white mb-1">{prospect.name}</h4>
                    <p className="text-sm text-gray-400">{prospect.title} at {prospect.company}</p>
                    <p className="text-xs text-gray-500 mt-1">{prospect.industry}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#dba63f]">
                      {Math.round(prospect.matchScore * 100)}%
                    </div>
                    <div className="text-xs text-gray-400">Match Score</div>
                  </div>
                </div>

                {/* Contact Methods */}
                <div className="flex items-center gap-4 mb-4 text-xs">
                  {prospect.email && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {prospect.email}
                    </div>
                  )}
                  {prospect.phone && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {prospect.phone}
                    </div>
                  )}
                  {prospect.linkedInUrl && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                      LinkedIn
                    </div>
                  )}
                </div>

                {/* Signals */}
                <div>
                  <div className="text-xs text-gray-400 tracking-wider uppercase mb-2">Buying Signals</div>
                  <div className="flex flex-wrap gap-2">
                    {prospect.signals.map((signal, i) => (
                      <div
                        key={i}
                        className={`px-3 py-1.5 text-xs rounded-sm border ${getSignalColor(signal.score)}`}
                      >
                        <span className="font-medium">{signal.type}</span>: {signal.description}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Messages for this prospect */}
                {getProspectMessages(prospect.id).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="text-xs text-gray-400 tracking-wider uppercase mb-2">
                      Messages ({getProspectMessages(prospect.id).length})
                    </div>
                    <div className="space-y-2">
                      {getProspectMessages(prospect.id).map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-sm border ${
                            message.status === 'approved' ? 'bg-green-900/20 border-green-700' :
                            message.status === 'rejected' ? 'bg-red-900/20 border-red-700' :
                            'bg-gray-900 border-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-300 uppercase">{message.channel}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-sm ${
                              message.status === 'approved' ? 'bg-green-900 text-green-400' :
                              message.status === 'rejected' ? 'bg-red-900 text-red-400' :
                              'bg-gray-800 text-gray-400'
                            }`}>
                              {message.status}
                            </span>
                          </div>
                          {message.subject && (
                            <div className="text-sm font-medium text-white mb-1">{message.subject}</div>
                          )}
                          <div className="text-xs text-gray-400 line-clamp-2">{message.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            {campaign.messages.map((message) => {
              const prospect = getProspect(message.prospectId)
              if (!prospect) return null

              return (
                <div
                  key={message.id}
                  className={`bg-[#1a1a1a] border rounded-sm p-6 transition-all ${
                    message.status === 'approved' ? 'border-green-700' :
                    message.status === 'rejected' ? 'border-red-700' :
                    !message.canSend ? 'border-orange-700' :
                    'border-gray-800 hover:border-[#dba63f]/30'
                  }`}
                >
                  {/* Message Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-white">{prospect.name}</h4>
                        <span className="text-xs text-gray-500">{prospect.title} at {prospect.company}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className={`px-2 py-1 rounded-sm font-medium uppercase ${
                          message.channel === 'email' ? 'bg-blue-900/30 text-blue-400 border border-blue-700' :
                          message.channel === 'sms' ? 'bg-orange-900/30 text-orange-400 border border-orange-700' :
                          'bg-purple-900/30 text-purple-400 border border-purple-700'
                        }`}>
                          {message.channel}
                        </span>
                        <span className={`px-2 py-1 rounded-sm font-medium uppercase ${
                          message.status === 'approved' ? 'bg-green-900/30 text-green-400 border border-green-700' :
                          message.status === 'rejected' ? 'bg-red-900/30 text-red-400 border border-red-700' :
                          'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}>
                          {message.status}
                        </span>
                        {!message.canSend && message.blockReason && (
                          <span className="px-2 py-1 bg-orange-900/30 text-orange-400 border border-orange-700 rounded-sm font-medium uppercase">
                            Blocked: {message.blockReason}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {message.status === 'pending' && message.canSend && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveMessage(message.id)}
                          className="px-4 py-2 bg-green-900/30 border border-green-700 text-green-400 rounded-sm hover:bg-green-900/50 transition-all text-xs font-medium tracking-wider uppercase"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectMessage(message.id)}
                          className="px-4 py-2 bg-red-900/30 border border-red-700 text-red-400 rounded-sm hover:bg-red-900/50 transition-all text-xs font-medium tracking-wider uppercase"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="space-y-3">
                    {message.subject && (
                      <div>
                        <div className="text-xs text-gray-400 tracking-wider uppercase mb-1">Subject</div>
                        <div className="text-sm font-medium text-white">{message.subject}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-400 tracking-wider uppercase mb-1">Message</div>
                      <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {message.body}
                      </div>
                    </div>
                  </div>

                  {/* Prospect Signals Preview */}
                  {prospect.signals.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <div className="text-xs text-gray-400 tracking-wider uppercase mb-2">Why This Prospect</div>
                      <div className="flex flex-wrap gap-2">
                        {prospect.signals.slice(0, 2).map((signal, i) => (
                          <div
                            key={i}
                            className={`px-3 py-1.5 text-xs rounded-sm border ${getSignalColor(signal.score)}`}
                          >
                            {signal.description}
                          </div>
                        ))}
                        <div className="px-3 py-1.5 text-xs text-[#dba63f] bg-[#dba63f]/10 border border-[#dba63f]/20 rounded-sm">
                          {Math.round(prospect.matchScore * 100)}% Match
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
