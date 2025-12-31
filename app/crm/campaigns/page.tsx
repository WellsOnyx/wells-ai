'use client'

/**
 * Campaigns List Page
 *
 * View and manage outreach campaigns.
 * Filter by status (draft, scheduled, sent).
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Megaphone,
  Search,
  Plus,
  Filter,
  Clock,
  Send,
  Play,
  Pause,
  BarChart3,
  Users,
  Mail,
  MessageSquare,
  Loader2,
  Sparkles,
  ChevronRight,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar,
  Zap,
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  description?: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'
  channel: 'email' | 'sms' | 'linkedin' | 'multi'
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  repliedCount: number
  bouncedCount: number
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      // Mock data for now - in production this would fetch from API
      const mockCampaigns: Campaign[] = [
        {
          id: '1',
          name: 'Q1 2024 Outreach',
          description: 'Initial outreach to Q1 leads',
          status: 'sent',
          channel: 'email',
          totalRecipients: 250,
          sentCount: 250,
          deliveredCount: 245,
          openedCount: 125,
          clickedCount: 45,
          repliedCount: 12,
          bouncedCount: 5,
          startedAt: '2024-01-15T10:00:00Z',
          completedAt: '2024-01-15T12:30:00Z',
          createdAt: '2024-01-14T15:00:00Z',
        },
        {
          id: '2',
          name: 'Product Launch Announcement',
          description: 'Announcing new product features',
          status: 'scheduled',
          channel: 'email',
          totalRecipients: 500,
          sentCount: 0,
          deliveredCount: 0,
          openedCount: 0,
          clickedCount: 0,
          repliedCount: 0,
          bouncedCount: 0,
          scheduledAt: '2024-02-01T09:00:00Z',
          createdAt: '2024-01-20T10:00:00Z',
        },
        {
          id: '3',
          name: 'Conference Follow-up',
          description: 'Follow up with conference attendees',
          status: 'draft',
          channel: 'email',
          totalRecipients: 75,
          sentCount: 0,
          deliveredCount: 0,
          openedCount: 0,
          clickedCount: 0,
          repliedCount: 0,
          bouncedCount: 0,
          createdAt: '2024-01-22T14:00:00Z',
        },
        {
          id: '4',
          name: 'SMS Reminder Campaign',
          description: 'Meeting reminders via SMS',
          status: 'sending',
          channel: 'sms',
          totalRecipients: 50,
          sentCount: 30,
          deliveredCount: 28,
          openedCount: 0,
          clickedCount: 0,
          repliedCount: 5,
          bouncedCount: 2,
          startedAt: new Date().toISOString(),
          createdAt: '2024-01-23T09:00:00Z',
        },
      ]

      setCampaigns(mockCampaigns)
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      case 'scheduled': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'sending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'sent': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'paused': return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit className="w-4 h-4" />
      case 'scheduled': return <Clock className="w-4 h-4" />
      case 'sending': return <Zap className="w-4 h-4" />
      case 'sent': return <CheckCircle2 className="w-4 h-4" />
      case 'paused': return <Pause className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return <Megaphone className="w-4 h-4" />
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4 text-blue-400" />
      case 'sms': return <MessageSquare className="w-4 h-4 text-green-400" />
      default: return <Send className="w-4 h-4 text-gray-400" />
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const calculateRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return '0%'
    return `${Math.round((numerator / denominator) * 100)}%`
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <span className="text-xl font-bold">Wells CRM</span>
              </Link>

              <nav className="hidden md:flex items-center gap-1 ml-6">
                <Link
                  href="/crm"
                  className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium text-sm transition-all"
                >
                  Dashboard
                </Link>
                <Link
                  href="/crm/contacts"
                  className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium text-sm transition-all"
                >
                  Contacts
                </Link>
                <Link
                  href="/crm/lists"
                  className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium text-sm transition-all"
                >
                  Lists
                </Link>
                <Link
                  href="/crm/campaigns"
                  className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 font-medium text-sm"
                >
                  Campaigns
                </Link>
              </nav>
            </div>

            <Link
              href="/crm/campaigns/new"
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Campaigns</h1>
            <p className="text-[var(--text-secondary)]">
              Create and manage your outreach campaigns
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              {['all', 'draft', 'scheduled', 'sending', 'sent', 'paused'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Campaigns List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-12 text-center">
            <Megaphone className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No campaigns found</h3>
            <p className="text-[var(--text-secondary)] mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first campaign to start outreach'}
            </p>
            <Link
              href="/crm/campaigns/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all"
            >
              <Plus className="w-5 h-5" />
              Create Campaign
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/crm/campaigns/${campaign.id}`}
                className="block bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-hover)] transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-xl">
                      {getChannelIcon(campaign.channel)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{campaign.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getStatusColor(campaign.status)}`}>
                          {getStatusIcon(campaign.status)}
                          {campaign.status}
                        </span>
                      </div>
                      {campaign.description && (
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                          {campaign.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-tertiary)]">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {campaign.totalRecipients} recipients
                        </span>
                        {campaign.scheduledAt && campaign.status === 'scheduled' && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Scheduled: {formatDate(campaign.scheduledAt)}
                          </span>
                        )}
                        {campaign.completedAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Completed: {formatDate(campaign.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </div>

                {/* Stats - only show for sent/sending campaigns */}
                {(campaign.status === 'sent' || campaign.status === 'sending') && campaign.sentCount > 0 && (
                  <div className="grid grid-cols-5 gap-4 pt-4 border-t border-[var(--border)]">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{campaign.sentCount}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">Sent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-400">
                        {calculateRate(campaign.deliveredCount, campaign.sentCount)}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">Delivered</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-400">
                        {calculateRate(campaign.openedCount, campaign.deliveredCount)}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">Opened</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-amber-400">
                        {calculateRate(campaign.clickedCount, campaign.openedCount)}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">Clicked</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-purple-400">
                        {campaign.repliedCount}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">Replied</div>
                    </div>
                  </div>
                )}

                {/* Progress bar for sending campaigns */}
                {campaign.status === 'sending' && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <div className="flex justify-between text-sm text-[var(--text-secondary)] mb-2">
                      <span>Sending progress</span>
                      <span>{calculateRate(campaign.sentCount, campaign.totalRecipients)}</span>
                    </div>
                    <div className="h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
                        style={{ width: `${(campaign.sentCount / campaign.totalRecipients) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
