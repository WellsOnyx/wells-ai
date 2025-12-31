'use client'

/**
 * CRM Dashboard - Main Overview Page
 *
 * Displays key metrics, recent contacts, and quick actions for managing
 * contacts, lists, and campaigns.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import {
  Users,
  UserPlus,
  Upload,
  Send,
  Mail,
  Phone,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Loader2,
  Zap,
  Target,
  Megaphone,
  Calendar,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Plus,
} from 'lucide-react'

// Types
interface ContactStats {
  total: number
  active: number
  bounced: number
  recent: number
  byStatus: {
    new: number
    contacted: number
    replied: number
    meeting_booked: number
    qualified: number
  }
}

interface RecentContact {
  id: string
  email: string
  fullName?: string
  company?: string
  status: string
  priority: string
  createdAt: string
}

interface CampaignSummary {
  id: string
  name: string
  status: string
  sent: number
  opened: number
  clicked: number
  replied: number
}

export default function CRMDashboard() {
  const { isLoaded, isSignedIn } = useUser()
  const [stats, setStats] = useState<ContactStats | null>(null)
  const [recentContacts, setRecentContacts] = useState<RecentContact[]>([])
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchDashboardData()
    } else if (isLoaded) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn])

  const fetchDashboardData = async () => {
    try {
      // Fetch contacts for stats
      const contactsRes = await fetch('/api/crm/contacts?limit=10')
      const contactsData = await contactsRes.json()

      // Calculate stats from contacts
      const contacts = contactsData.contacts || []
      const stats: ContactStats = {
        total: contactsData.total || contacts.length,
        active: contacts.filter((c: any) => c.status !== 'bounced' && c.status !== 'unsubscribed').length,
        bounced: contacts.filter((c: any) => c.status === 'bounced').length,
        recent: contacts.filter((c: any) => {
          const createdAt = new Date(c.created_at)
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          return createdAt > weekAgo
        }).length,
        byStatus: {
          new: contacts.filter((c: any) => c.status === 'new').length,
          contacted: contacts.filter((c: any) => c.status === 'contacted').length,
          replied: contacts.filter((c: any) => c.status === 'replied').length,
          meeting_booked: contacts.filter((c: any) => c.status === 'meeting_booked').length,
          qualified: contacts.filter((c: any) => c.status === 'qualified').length,
        }
      }

      setStats(stats)
      setRecentContacts(contacts.slice(0, 5).map((c: any) => ({
        id: c.id,
        email: c.email,
        fullName: c.full_name,
        company: c.company,
        status: c.status,
        priority: c.priority,
        createdAt: c.created_at,
      })))

      // Fetch lists for campaign data
      const listsRes = await fetch('/api/crm/lists')
      const listsData = await listsRes.json()

      // Mock campaign data for now
      setCampaigns([
        {
          id: '1',
          name: 'Q1 Outreach',
          status: 'sent',
          sent: 250,
          opened: 125,
          clicked: 45,
          replied: 12,
        },
        {
          id: '2',
          name: 'Product Launch',
          status: 'scheduled',
          sent: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
        },
      ])
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'contacted': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      case 'replied': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'meeting_booked': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'qualified': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'bounced': return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'hot': return 'text-red-400'
      case 'warm': return 'text-amber-400'
      case 'cold': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">CRM Dashboard</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            Sign in to manage your contacts and campaigns
          </p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 dark:bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/3 rounded-full blur-3xl" />
      </div>

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
                  className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 font-medium text-sm"
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
                  className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium text-sm transition-all"
                >
                  Campaigns
                </Link>
                <Link
                  href="/crm/outreach"
                  className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium text-sm transition-all"
                >
                  Outreach
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/crm/contacts/import"
                className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-all text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Import
              </Link>
              <Link
                href="/crm/campaigns/new"
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                New Campaign
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">CRM Dashboard</h1>
          <p className="text-[var(--text-secondary)]">
            Manage your contacts, lists, and outreach campaigns
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Contacts */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-hover)] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xs text-green-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +12%
              </span>
            </div>
            <div className="text-3xl font-bold mb-1">{stats?.total || 0}</div>
            <div className="text-sm text-[var(--text-secondary)]">Total Contacts</div>
          </div>

          {/* Active Contacts */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-hover)] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">
                {stats?.total ? Math.round((stats.active / stats.total) * 100) : 0}%
              </span>
            </div>
            <div className="text-3xl font-bold mb-1">{stats?.active || 0}</div>
            <div className="text-sm text-[var(--text-secondary)]">Active Contacts</div>
          </div>

          {/* Bounced */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-hover)] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-xs text-red-400 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                -2%
              </span>
            </div>
            <div className="text-3xl font-bold mb-1">{stats?.bounced || 0}</div>
            <div className="text-sm text-[var(--text-secondary)]">Bounced</div>
          </div>

          {/* Recent (Last 7 Days) */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-hover)] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">Last 7 days</span>
            </div>
            <div className="text-3xl font-bold mb-1">{stats?.recent || 0}</div>
            <div className="text-sm text-[var(--text-secondary)]">New This Week</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            href="/crm/contacts/import"
            className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 hover:border-amber-500/30 transition-all flex items-center gap-4"
          >
            <div className="p-3 bg-amber-500/10 rounded-xl group-hover:bg-amber-500/20 transition-all">
              <Upload className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Import Contacts</h3>
              <p className="text-sm text-[var(--text-secondary)]">Upload CSV file</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            href="/crm/contacts?action=create"
            className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 hover:border-blue-500/30 transition-all flex items-center gap-4"
          >
            <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-all">
              <UserPlus className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Create Contact</h3>
              <p className="text-sm text-[var(--text-secondary)]">Add manually</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            href="/crm/campaigns/new"
            className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 hover:border-green-500/30 transition-all flex items-center gap-4"
          >
            <div className="p-3 bg-green-500/10 rounded-xl group-hover:bg-green-500/20 transition-all">
              <Megaphone className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">New Campaign</h3>
              <p className="text-sm text-[var(--text-secondary)]">Start outreach</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-green-400 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Contacts */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Recent Contacts
              </h2>
              <Link
                href="/crm/contacts"
                className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {recentContacts.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                  <p className="text-[var(--text-secondary)]">No contacts yet</p>
                  <Link
                    href="/crm/contacts/import"
                    className="text-amber-400 text-sm mt-2 inline-block hover:underline"
                  >
                    Import your first contacts
                  </Link>
                </div>
              ) : (
                recentContacts.map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/crm/contacts/${contact.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-[var(--surface-hover)] transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold text-sm">
                      {(contact.fullName || contact.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {contact.fullName || contact.email}
                      </div>
                      <div className="text-sm text-[var(--text-secondary)] truncate">
                        {contact.company || contact.email}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs border ${getStatusColor(contact.status)}`}>
                        {contact.status}
                      </span>
                      <div className="text-xs text-[var(--text-tertiary)] mt-1">
                        {formatDate(contact.createdAt)}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Campaign Performance */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                Campaign Performance
              </h2>
              <Link
                href="/crm/campaigns"
                className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {campaigns.length === 0 ? (
                <div className="p-8 text-center">
                  <Megaphone className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                  <p className="text-[var(--text-secondary)]">No campaigns yet</p>
                  <Link
                    href="/crm/campaigns/new"
                    className="text-amber-400 text-sm mt-2 inline-block hover:underline"
                  >
                    Create your first campaign
                  </Link>
                </div>
              ) : (
                campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/crm/campaigns/${campaign.id}`}
                    className="block p-4 hover:bg-[var(--surface-hover)] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{campaign.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs border ${
                        campaign.status === 'sent'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : campaign.status === 'scheduled'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-[var(--surface)] rounded-lg p-2">
                        <div className="text-lg font-semibold">{campaign.sent}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Sent</div>
                      </div>
                      <div className="bg-[var(--surface)] rounded-lg p-2">
                        <div className="text-lg font-semibold text-blue-400">{campaign.opened}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Opened</div>
                      </div>
                      <div className="bg-[var(--surface)] rounded-lg p-2">
                        <div className="text-lg font-semibold text-amber-400">{campaign.clicked}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Clicked</div>
                      </div>
                      <div className="bg-[var(--surface)] rounded-lg p-2">
                        <div className="text-lg font-semibold text-green-400">{campaign.replied}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Replied</div>
                      </div>
                    </div>

                    {campaign.sent > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
                          <span>Open Rate</span>
                          <span>{Math.round((campaign.opened / campaign.sent) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                            style={{ width: `${(campaign.opened / campaign.sent) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Pipeline Overview */}
        <div className="mt-8 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            Pipeline Overview
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'New', value: stats?.byStatus.new || 0, color: 'blue' },
              { label: 'Contacted', value: stats?.byStatus.contacted || 0, color: 'cyan' },
              { label: 'Replied', value: stats?.byStatus.replied || 0, color: 'green' },
              { label: 'Meeting Booked', value: stats?.byStatus.meeting_booked || 0, color: 'amber' },
              { label: 'Qualified', value: stats?.byStatus.qualified || 0, color: 'purple' },
            ].map((stage) => (
              <div key={stage.label} className="text-center">
                <div className={`text-3xl font-bold text-${stage.color}-400`}>
                  {stage.value}
                </div>
                <div className="text-sm text-[var(--text-secondary)] mt-1">{stage.label}</div>
                <div className={`h-1 mt-3 rounded-full bg-${stage.color}-500/30`}>
                  <div
                    className={`h-full rounded-full bg-${stage.color}-500`}
                    style={{
                      width: stats?.total ? `${(stage.value / stats.total) * 100}%` : '0%'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
