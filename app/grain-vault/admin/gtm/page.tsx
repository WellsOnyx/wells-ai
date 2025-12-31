'use client'

/**
 * Grain & Vault - GTM Dashboard
 *
 * Track cold outreach progress, pipeline, and key metrics
 * Designed for manual cold start GTM ($200-500/mo budget)
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  TrendingUp,
  Users,
  Mail,
  Calendar,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  XCircle,
  MessageSquare,
  Linkedin,
  Phone,
  Video,
  ChevronRight,
  RefreshCw,
  Plus,
  Filter,
  Download,
  Sparkles,
  DollarSign,
  Percent,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface Lead {
  id: string
  company: string
  contact: string
  title: string
  email: string
  linkedIn?: string
  status: 'cold' | 'contacted' | 'replied' | 'demo_scheduled' | 'demo_complete' | 'proposal' | 'won' | 'lost'
  source: 'linkedin' | 'apollo' | 'referral' | 'inbound'
  lastContact: string
  nextAction: string
  estimatedValue: number
  activities: Activity[]
}

interface Activity {
  id: string
  type: 'email' | 'linkedin_connect' | 'linkedin_message' | 'call' | 'demo' | 'loom'
  date: string
  notes: string
  response?: string
}

interface PipelineMetrics {
  totalLeads: number
  contacted: number
  replied: number
  demosScheduled: number
  demosCompleted: number
  proposals: number
  won: number
  lost: number
  pipelineValue: number
}

interface WeeklyMetrics {
  week: string
  emailsSent: number
  linkedInConnections: number
  replies: number
  demosBooked: number
  demosCompleted: number
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    company: 'Acme Manufacturing',
    contact: 'Sarah Chen',
    title: 'CFO',
    email: 'sarah.chen@acmemanuf.com',
    linkedIn: 'linkedin.com/in/sarahchen',
    status: 'demo_scheduled',
    source: 'linkedin',
    lastContact: '2025-01-15',
    nextAction: 'Demo call 1/17 2pm',
    estimatedValue: 75000,
    activities: [
      { id: 'a1', type: 'linkedin_connect', date: '2025-01-10', notes: 'Sent connection request' },
      { id: 'a2', type: 'linkedin_message', date: '2025-01-12', notes: 'Intro message about treasury yield', response: 'Interested, send more info' },
      { id: 'a3', type: 'email', date: '2025-01-14', notes: 'Sent demo invite', response: 'Confirmed for Friday' },
    ],
  },
  {
    id: '2',
    company: 'Global Distributors Inc',
    contact: 'Michael Torres',
    title: 'VP Procurement',
    email: 'm.torres@globaldist.com',
    status: 'replied',
    source: 'apollo',
    lastContact: '2025-01-14',
    nextAction: 'Follow up with Loom video',
    estimatedValue: 120000,
    activities: [
      { id: 'a4', type: 'email', date: '2025-01-10', notes: 'Cold email - procurement angle' },
      { id: 'a5', type: 'email', date: '2025-01-13', notes: 'Follow up with case study' },
      { id: 'a6', type: 'email', date: '2025-01-14', notes: 'Reply received', response: 'Forwarded to CFO, she\'ll reach out' },
    ],
  },
  {
    id: '3',
    company: 'Midwest Industrial',
    contact: 'Jennifer Walsh',
    title: 'Controller',
    email: 'jwalsh@midwestind.com',
    status: 'demo_complete',
    source: 'linkedin',
    lastContact: '2025-01-16',
    nextAction: 'Send proposal',
    estimatedValue: 50000,
    activities: [
      { id: 'a7', type: 'linkedin_connect', date: '2025-01-08', notes: 'Connected' },
      { id: 'a8', type: 'demo', date: '2025-01-16', notes: 'Demo completed. Interested in Q2 implementation. Need SOC 2 docs.' },
    ],
  },
  {
    id: '4',
    company: 'Pacific Foods Co',
    contact: 'Robert Kim',
    title: 'Treasury Manager',
    email: 'rkim@pacificfoods.com',
    status: 'contacted',
    source: 'apollo',
    lastContact: '2025-01-15',
    nextAction: 'Send touch 2 email',
    estimatedValue: 80000,
    activities: [
      { id: 'a9', type: 'email', date: '2025-01-15', notes: 'Cold email - treasury yield angle' },
    ],
  },
  {
    id: '5',
    company: 'Southern Supply Chain',
    contact: 'Amanda Foster',
    title: 'VP Finance',
    email: 'afoster@southernsupply.com',
    status: 'proposal',
    source: 'referral',
    lastContact: '2025-01-16',
    nextAction: 'Follow up on proposal',
    estimatedValue: 150000,
    activities: [
      { id: 'a10', type: 'call', date: '2025-01-08', notes: 'Intro call via referral from John Smith' },
      { id: 'a11', type: 'demo', date: '2025-01-12', notes: 'Full demo. Very interested.' },
      { id: 'a12', type: 'email', date: '2025-01-16', notes: 'Sent proposal' },
    ],
  },
]

const MOCK_WEEKLY_METRICS: WeeklyMetrics[] = [
  { week: 'Week 1', emailsSent: 22, linkedInConnections: 12, replies: 3, demosBooked: 2, demosCompleted: 0 },
  { week: 'Week 2', emailsSent: 45, linkedInConnections: 18, replies: 6, demosBooked: 3, demosCompleted: 2 },
  { week: 'Week 3', emailsSent: 38, linkedInConnections: 15, replies: 5, demosBooked: 2, demosCompleted: 3 },
]

// =============================================================================
// COMPONENT
// =============================================================================

export default function GTMDashboard() {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [weeklyMetrics, setWeeklyMetrics] = useState<WeeklyMetrics[]>(MOCK_WEEKLY_METRICS)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showAddLead, setShowAddLead] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Calculate pipeline metrics
  const pipelineMetrics: PipelineMetrics = {
    totalLeads: leads.length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    replied: leads.filter(l => l.status === 'replied').length,
    demosScheduled: leads.filter(l => l.status === 'demo_scheduled').length,
    demosCompleted: leads.filter(l => l.status === 'demo_complete').length,
    proposals: leads.filter(l => l.status === 'proposal').length,
    won: leads.filter(l => l.status === 'won').length,
    lost: leads.filter(l => l.status === 'lost').length,
    pipelineValue: leads
      .filter(l => ['demo_scheduled', 'demo_complete', 'proposal'].includes(l.status))
      .reduce((sum, l) => sum + l.estimatedValue, 0),
  }

  // Calculate key metrics
  const totalEmails = weeklyMetrics.reduce((sum, w) => sum + w.emailsSent, 0)
  const totalReplies = weeklyMetrics.reduce((sum, w) => sum + w.replies, 0)
  const totalDemos = weeklyMetrics.reduce((sum, w) => sum + w.demosCompleted, 0)
  const responseRate = totalEmails > 0 ? ((totalReplies / totalEmails) * 100).toFixed(1) : '0'
  const demoRate = totalEmails > 0 ? ((totalDemos / totalEmails) * 100).toFixed(1) : '0'

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      cold: 'bg-gray-500/20 text-gray-400',
      contacted: 'bg-blue-500/20 text-blue-400',
      replied: 'bg-cyan-500/20 text-cyan-400',
      demo_scheduled: 'bg-yellow-500/20 text-yellow-400',
      demo_complete: 'bg-orange-500/20 text-orange-400',
      proposal: 'bg-purple-500/20 text-purple-400',
      won: 'bg-green-500/20 text-green-400',
      lost: 'bg-red-500/20 text-red-400',
    }
    return colors[status] || colors.cold
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      cold: 'Cold',
      contacted: 'Contacted',
      replied: 'Replied',
      demo_scheduled: 'Demo Scheduled',
      demo_complete: 'Demo Complete',
      proposal: 'Proposal',
      won: 'Won',
      lost: 'Lost',
    }
    return labels[status] || status
  }

  const getActivityIcon = (type: string) => {
    const icons: Record<string, typeof Mail> = {
      email: Mail,
      linkedin_connect: Linkedin,
      linkedin_message: MessageSquare,
      call: Phone,
      demo: Video,
      loom: Video,
    }
    const Icon = icons[type] || Mail
    return <Icon className="w-4 h-4" />
  }

  const filteredLeads = selectedStatus === 'all'
    ? leads
    : leads.filter(l => l.status === selectedStatus)

  const refreshData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/gtm/pipeline')
      if (res.ok) {
        const data = await res.json()
        if (data.leads) setLeads(data.leads)
        if (data.weeklyMetrics) setWeeklyMetrics(data.weeklyMetrics)
      }
    } catch (e) {
      console.error('Failed to refresh data:', e)
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/grain-vault/admin" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <span className="text-xl font-bold tracking-tight">Grain & Vault</span>
              </Link>
              <span className="text-gray-500">/</span>
              <span className="text-gray-400">GTM Dashboard</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={refreshData}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowAddLead(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Lead
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Mail className="w-4 h-4" />
              Emails Sent
            </div>
            <div className="text-2xl font-bold">{totalEmails}</div>
            <div className="text-xs text-gray-500 mt-1">This month</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <MessageSquare className="w-4 h-4" />
              Replies
            </div>
            <div className="text-2xl font-bold text-cyan-400">{totalReplies}</div>
            <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
              <ArrowUpRight className="w-3 h-3" />
              {responseRate}% rate
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Calendar className="w-4 h-4" />
              Demos Booked
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {pipelineMetrics.demosScheduled + pipelineMetrics.demosCompleted}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {pipelineMetrics.demosScheduled} upcoming
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Video className="w-4 h-4" />
              Demos Completed
            </div>
            <div className="text-2xl font-bold text-orange-400">{pipelineMetrics.demosCompleted}</div>
            <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
              <ArrowUpRight className="w-3 h-3" />
              {demoRate}% of emails
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <DollarSign className="w-4 h-4" />
              Pipeline Value
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${(pipelineMetrics.pipelineValue / 1000).toFixed(0)}K
            </div>
            <div className="text-xs text-gray-500 mt-1">{pipelineMetrics.proposals} proposals</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Target className="w-4 h-4" />
              Goal Progress
            </div>
            <div className="text-2xl font-bold">
              {pipelineMetrics.demosScheduled + pipelineMetrics.demosCompleted}/10
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((pipelineMetrics.demosScheduled + pipelineMetrics.demosCompleted) / 10) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Pipeline Funnel */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-400" />
                Pipeline Funnel
              </h2>

              <div className="space-y-3">
                {[
                  { label: 'Contacted', count: pipelineMetrics.contacted, color: 'bg-blue-500' },
                  { label: 'Replied', count: pipelineMetrics.replied, color: 'bg-cyan-500' },
                  { label: 'Demo Scheduled', count: pipelineMetrics.demosScheduled, color: 'bg-yellow-500' },
                  { label: 'Demo Complete', count: pipelineMetrics.demosCompleted, color: 'bg-orange-500' },
                  { label: 'Proposal', count: pipelineMetrics.proposals, color: 'bg-purple-500' },
                  { label: 'Won', count: pipelineMetrics.won, color: 'bg-green-500' },
                ].map((stage, i) => (
                  <div key={stage.label} className="flex items-center gap-4">
                    <div className="w-32 text-sm text-gray-400">{stage.label}</div>
                    <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden">
                      <div
                        className={`h-full ${stage.color} transition-all flex items-center justify-end px-3`}
                        style={{ width: `${Math.max(10, (stage.count / pipelineMetrics.totalLeads) * 100)}%` }}
                      >
                        <span className="text-sm font-medium text-black">{stage.count}</span>
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm text-gray-500">
                      {((stage.count / pipelineMetrics.totalLeads) * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lead List */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  Active Leads
                </h2>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-3 py-1.5 bg-black/50 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-green-500"
                  >
                    <option value="all">All Status</option>
                    <option value="contacted">Contacted</option>
                    <option value="replied">Replied</option>
                    <option value="demo_scheduled">Demo Scheduled</option>
                    <option value="demo_complete">Demo Complete</option>
                    <option value="proposal">Proposal</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-black/30 border border-white/5 rounded-lg p-4 hover:border-white/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{lead.company}</h3>
                        <p className="text-sm text-gray-400">{lead.contact} - {lead.title}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                        {getStatusLabel(lead.status)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${(lead.estimatedValue / 1000).toFixed(0)}K
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {lead.lastContact}
                      </span>
                      <span className="capitalize">{lead.source}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {lead.activities.slice(-3).map((activity) => (
                          <div
                            key={activity.id}
                            className={`p-1.5 rounded ${activity.response ? 'bg-green-500/20' : 'bg-white/5'}`}
                            title={activity.notes}
                          >
                            {getActivityIcon(activity.type)}
                          </div>
                        ))}
                      </div>
                      <div className="text-sm text-gray-400">
                        Next: {lead.nextAction}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Weekly Progress */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Weekly Progress
              </h2>

              <div className="space-y-4">
                {weeklyMetrics.map((week, i) => (
                  <div key={week.week} className="pb-4 border-b border-white/5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{week.week}</span>
                      <span className="text-sm text-gray-400">{week.demosBooked} demos</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Mail className="w-3 h-3" />
                        {week.emailsSent} emails
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Linkedin className="w-3 h-3" />
                        {week.linkedInConnections} connects
                      </div>
                      <div className="flex items-center gap-2 text-cyan-400">
                        <MessageSquare className="w-3 h-3" />
                        {week.replies} replies
                      </div>
                      <div className="flex items-center gap-2 text-orange-400">
                        <Video className="w-3 h-3" />
                        {week.demosCompleted} demos
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Ratios */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Percent className="w-5 h-5 text-green-400" />
                Key Ratios
              </h2>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-400">Response Rate</span>
                    <span className="font-medium">{responseRate}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-cyan-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, parseFloat(responseRate) * 5)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Target: 15-20%</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-400">Demo Rate</span>
                    <span className="font-medium">{demoRate}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, parseFloat(demoRate) * 10)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Target: 7-10%</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-400">Demo Show Rate</span>
                    <span className="font-medium">
                      {pipelineMetrics.demosScheduled + pipelineMetrics.demosCompleted > 0
                        ? ((pipelineMetrics.demosCompleted / (pipelineMetrics.demosScheduled + pipelineMetrics.demosCompleted)) * 100).toFixed(0)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${(pipelineMetrics.demosCompleted / Math.max(1, pipelineMetrics.demosScheduled + pipelineMetrics.demosCompleted)) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Target: 70-80%</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-400">Est. CAC</span>
                    <span className="font-medium">
                      ${pipelineMetrics.won > 0 ? ((300 + (totalEmails * 0.1)) / pipelineMetrics.won).toFixed(0) : '--'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Based on $300/mo tools + time
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>

              <div className="space-y-2">
                <Link
                  href="/grain-vault/demo/enterprise"
                  className="flex items-center justify-between p-3 bg-black/30 rounded-lg hover:bg-black/50 transition-colors"
                >
                  <span className="text-sm">Enterprise Demo</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
                <a
                  href="https://www.linkedin.com/sales/search/people"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-black/30 rounded-lg hover:bg-black/50 transition-colors"
                >
                  <span className="text-sm">Sales Navigator</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </a>
                <a
                  href="https://app.apollo.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-black/30 rounded-lg hover:bg-black/50 transition-colors"
                >
                  <span className="text-sm">Apollo.io</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </a>
                <button
                  onClick={() => {/* Export CSV logic */}}
                  className="w-full flex items-center justify-between p-3 bg-black/30 rounded-lg hover:bg-black/50 transition-colors"
                >
                  <span className="text-sm">Export Pipeline</span>
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            {/* This Week's Focus */}
            <div className="bg-gradient-to-br from-green-500/20 to-cyan-500/20 border border-green-500/30 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">This Week's Focus</h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/30 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <span>Send 40 cold emails (CFO focus)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-gray-400" />
                  </div>
                  <span>15 LinkedIn connection requests</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-gray-400" />
                  </div>
                  <span>Follow up on 5 no-replies (Loom)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-gray-400" />
                  </div>
                  <span>Complete 3 demos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Lead Modal - simplified placeholder */}
      {showAddLead && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add New Lead</h2>

            <form className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Company</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:border-green-500"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Contact Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:border-green-500"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Title</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:border-green-500"
                  placeholder="CFO"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:border-green-500"
                  placeholder="john@acme.com"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Estimated Deal Size</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:border-green-500"
                  placeholder="50000"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddLead(false)}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-medium rounded-lg transition-colors"
                >
                  Add Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
