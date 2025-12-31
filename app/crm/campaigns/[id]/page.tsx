'use client'

/**
 * Campaign Detail Page
 *
 * View campaign performance, recipient list, and controls.
 */

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  Play,
  BarChart3,
  Eye,
  MousePointer,
  Reply,
  AlertTriangle,
  Loader2,
  Sparkles,
  Calendar,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  description?: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'
  channel: 'email' | 'sms' | 'linkedin'
  subject?: string
  body: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  repliedCount: number
  bouncedCount: number
  unsubscribedCount: number
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

interface Recipient {
  id: string
  email: string
  name?: string
  company?: string
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed'
  sentAt?: string
  openedAt?: string
  clickedAt?: string
  repliedAt?: string
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'recipients'>('overview')
  const [recipientFilter, setRecipientFilter] = useState<string>('all')

  useEffect(() => {
    fetchCampaign()
  }, [resolvedParams.id])

  const fetchCampaign = async () => {
    try {
      setLoading(true)
      // Mock data - in production this would fetch from API
      const mockCampaign: Campaign = {
        id: resolvedParams.id,
        name: 'Q1 2024 Outreach',
        description: 'Initial outreach to Q1 leads from conference and inbound',
        status: 'sent',
        channel: 'email',
        subject: 'Quick question about {{company}}',
        body: `Hi {{first_name}},

I noticed {{company}} has been growing rapidly in the {{industry}} space.

We help companies like yours streamline their operations with AI-powered automation.

Would you be open to a quick call this week?

Best,
The Wells Team`,
        totalRecipients: 250,
        sentCount: 250,
        deliveredCount: 245,
        openedCount: 125,
        clickedCount: 45,
        repliedCount: 12,
        bouncedCount: 5,
        unsubscribedCount: 2,
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T12:30:00Z',
        createdAt: '2024-01-14T15:00:00Z',
      }

      setCampaign(mockCampaign)

      // Mock recipients
      const mockRecipients: Recipient[] = [
        { id: '1', email: 'john@acme.com', name: 'John Smith', company: 'Acme Inc', status: 'replied', sentAt: '2024-01-15T10:01:00Z', openedAt: '2024-01-15T10:30:00Z', repliedAt: '2024-01-15T14:00:00Z' },
        { id: '2', email: 'sarah@tech.co', name: 'Sarah Johnson', company: 'Tech Co', status: 'clicked', sentAt: '2024-01-15T10:02:00Z', openedAt: '2024-01-15T11:00:00Z', clickedAt: '2024-01-15T11:05:00Z' },
        { id: '3', email: 'mike@startup.io', name: 'Mike Brown', company: 'Startup IO', status: 'opened', sentAt: '2024-01-15T10:03:00Z', openedAt: '2024-01-15T12:00:00Z' },
        { id: '4', email: 'lisa@enterprise.com', name: 'Lisa Davis', company: 'Enterprise Corp', status: 'delivered', sentAt: '2024-01-15T10:04:00Z' },
        { id: '5', email: 'tom@oldmail.net', name: 'Tom Wilson', company: 'Old Mail', status: 'bounced', sentAt: '2024-01-15T10:05:00Z' },
        { id: '6', email: 'anna@bigco.com', name: 'Anna Lee', company: 'Big Co', status: 'sent', sentAt: '2024-01-15T10:06:00Z' },
      ]

      setRecipients(mockRecipients)
    } catch (error) {
      console.error('Failed to fetch campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePauseCampaign = async () => {
    // Implement pause
    if (campaign) {
      setCampaign({ ...campaign, status: 'paused' })
    }
  }

  const handleResumeCampaign = async () => {
    // Implement resume
    if (campaign) {
      setCampaign({ ...campaign, status: 'sending' })
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
    if (denominator === 0) return 0
    return Math.round((numerator / denominator) * 100)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      case 'sent': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'delivered': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      case 'opened': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'clicked': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'replied': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'bounced': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const filteredRecipients = recipients.filter(r =>
    recipientFilter === 'all' || r.status === recipientFilter
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
          <Link href="/crm/campaigns" className="text-amber-400 hover:underline">
            Back to campaigns
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/crm/campaigns" className="p-2 hover:bg-[var(--surface-hover)] rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">{campaign.name}</h1>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${
                    campaign.status === 'sent' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    campaign.status === 'sending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    campaign.status === 'paused' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                {campaign.description && (
                  <p className="text-sm text-[var(--text-secondary)]">{campaign.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {campaign.status === 'sending' && (
                <button
                  onClick={handlePauseCampaign}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              )}
              {campaign.status === 'paused' && (
                <button
                  onClick={handleResumeCampaign}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
              )}
              <button className="p-2 hover:bg-[var(--surface-hover)] rounded-lg">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <Send className="w-5 h-5 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{campaign.sentCount}</div>
            <div className="text-xs text-[var(--text-tertiary)]">Sent</div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-400">
              {calculateRate(campaign.deliveredCount, campaign.sentCount)}%
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Delivered</div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <Eye className="w-5 h-5 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-400">
              {calculateRate(campaign.openedCount, campaign.deliveredCount)}%
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Opened</div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <MousePointer className="w-5 h-5 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-400">
              {calculateRate(campaign.clickedCount, campaign.openedCount)}%
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Clicked</div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <Reply className="w-5 h-5 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-400">{campaign.repliedCount}</div>
            <div className="text-xs text-[var(--text-tertiary)]">Replied</div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <XCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-400">{campaign.bouncedCount}</div>
            <div className="text-xs text-[var(--text-tertiary)]">Bounced</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'overview'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('recipients')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'recipients'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Recipients ({campaign.totalRecipients})
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel Visualization */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-6">Engagement Funnel</h3>

              <div className="space-y-4">
                {[
                  { label: 'Sent', count: campaign.sentCount, color: 'blue' },
                  { label: 'Delivered', count: campaign.deliveredCount, color: 'cyan' },
                  { label: 'Opened', count: campaign.openedCount, color: 'green' },
                  { label: 'Clicked', count: campaign.clickedCount, color: 'amber' },
                  { label: 'Replied', count: campaign.repliedCount, color: 'purple' },
                ].map((stage, index) => (
                  <div key={stage.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[var(--text-secondary)]">{stage.label}</span>
                      <span className="font-medium">{stage.count}</span>
                    </div>
                    <div className="h-8 bg-[var(--surface)] rounded-lg overflow-hidden">
                      <div
                        className={`h-full bg-${stage.color}-500/30 border-l-4 border-${stage.color}-500 flex items-center justify-end px-2`}
                        style={{ width: `${(stage.count / campaign.sentCount) * 100}%` }}
                      >
                        <span className={`text-xs font-medium text-${stage.color}-400`}>
                          {calculateRate(stage.count, campaign.sentCount)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Campaign Content */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-6">Campaign Content</h3>

              {campaign.channel === 'email' && campaign.subject && (
                <div className="mb-4">
                  <label className="block text-xs text-[var(--text-tertiary)] mb-1">Subject</label>
                  <div className="p-3 bg-[var(--surface)] rounded-lg">
                    {campaign.subject}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-[var(--text-tertiary)] mb-1">Message</label>
                <div className="p-4 bg-[var(--surface)] rounded-lg whitespace-pre-wrap text-sm max-h-64 overflow-auto">
                  {campaign.body}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-6">Timeline</h3>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--surface)] flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="font-medium">Created</div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      {formatDate(campaign.createdAt)}
                    </div>
                  </div>
                </div>

                {campaign.startedAt && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Play className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium">Started Sending</div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {formatDate(campaign.startedAt)}
                      </div>
                    </div>
                  </div>
                )}

                {campaign.completedAt && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <div className="font-medium">Completed</div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {formatDate(campaign.completedAt)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Comparison */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-6">Performance vs Average</h3>

              <div className="space-y-4">
                {[
                  { label: 'Open Rate', value: calculateRate(campaign.openedCount, campaign.deliveredCount), avg: 22, color: 'green' },
                  { label: 'Click Rate', value: calculateRate(campaign.clickedCount, campaign.openedCount), avg: 3, color: 'amber' },
                  { label: 'Reply Rate', value: calculateRate(campaign.repliedCount, campaign.sentCount), avg: 1, color: 'purple' },
                ].map((metric) => {
                  const isAboveAvg = metric.value > metric.avg
                  return (
                    <div key={metric.label} className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
                      <span>{metric.label}</span>
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold text-${metric.color}-400`}>
                          {metric.value}%
                        </span>
                        <span className={`flex items-center gap-1 text-xs ${
                          isAboveAvg ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {isAboveAvg ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {isAboveAvg ? '+' : ''}{metric.value - metric.avg}% vs avg
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recipients Tab */}
        {activeTab === 'recipients' && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 border-b border-[var(--border)]">
              <div className="flex gap-2 flex-wrap">
                {['all', 'replied', 'clicked', 'opened', 'delivered', 'bounced'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setRecipientFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      recipientFilter === status
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipients Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">Contact</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">Company</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">Sent</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">Opened</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">Clicked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredRecipients.map((recipient) => (
                    <tr key={recipient.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{recipient.name || recipient.email}</div>
                          {recipient.name && (
                            <div className="text-sm text-[var(--text-secondary)]">{recipient.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {recipient.company || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs border ${getStatusColor(recipient.status)}`}>
                          {recipient.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {formatDate(recipient.sentAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {recipient.openedAt ? formatDate(recipient.openedAt) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {recipient.clickedAt ? formatDate(recipient.clickedAt) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
