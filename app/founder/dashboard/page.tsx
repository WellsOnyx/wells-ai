'use client'

/**
 * Founder Dashboard - Your AI Co-Founder Command Center
 *
 * Everything a founder needs in one place:
 * - Company health metrics (burn, runway, ARR)
 * - Active hiring searches (Wells Onyx)
 * - Open deals and RFQs
 * - Fundraising progress
 * - Quick actions across all functions
 */

import { useUser } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import {
  Users,
  Target,
  Briefcase,
  DollarSign,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  ArrowRight,
  ExternalLink
} from 'lucide-react'

interface CompanyMetrics {
  revenue: number // ARR
  growth: string // "23% MoM"
  burn: number // Monthly burn rate
  runway: number // Months
  teamSize: number
  openPositions: number
  activeRFQs: number
  activeCampaigns: number
}

interface HiringSearch {
  id: string
  role: string
  status: 'sourcing' | 'screening' | 'interviewing' | 'offer'
  candidatesFound: number
  topMatches: number
  daysActive: number
}

interface Deal {
  id: string
  companyName: string
  value: number
  stage: 'discovery' | 'proposal' | 'negotiation' | 'closing'
  lastActivity: string
}

interface RFQ {
  id: string
  category: string
  description: string
  quotesReceived: number
  status: 'pending' | 'reviewing' | 'closed'
  createdAt: string
}

export default function FounderDashboard() {
  const { user } = useUser()
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null)
  const [hiringSearches, setHiringSearches] = useState<HiringSearch[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [rfqs, setRFQs] = useState<RFQ[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      // In production, these would be real API calls
      // For now, we'll use mock data to demonstrate the UI

      setMetrics({
        revenue: 847000,
        growth: '+23% MoM',
        burn: 125000,
        runway: 18,
        teamSize: 12,
        openPositions: 3,
        activeRFQs: 5,
        activeCampaigns: 8
      })

      setHiringSearches([
        {
          id: 'search_1',
          role: 'CFO',
          status: 'screening',
          candidatesFound: 42,
          topMatches: 5,
          daysActive: 8
        },
        {
          id: 'search_2',
          role: 'VP Engineering',
          status: 'interviewing',
          candidatesFound: 38,
          topMatches: 3,
          daysActive: 12
        },
        {
          id: 'search_3',
          role: 'CISO',
          status: 'sourcing',
          candidatesFound: 15,
          topMatches: 0,
          daysActive: 3
        }
      ])

      setDeals([
        {
          id: 'deal_1',
          companyName: 'TechCorp Inc',
          value: 85000,
          stage: 'proposal',
          lastActivity: '2h ago'
        },
        {
          id: 'deal_2',
          companyName: 'Acme Industries',
          value: 125000,
          stage: 'negotiation',
          lastActivity: '1d ago'
        },
        {
          id: 'deal_3',
          companyName: 'Global Systems',
          value: 200000,
          stage: 'discovery',
          lastActivity: '3h ago'
        }
      ])

      setRFQs([
        {
          id: 'rfq_1',
          category: 'Office Space',
          description: 'Class A office in downtown SF, 5000 sq ft',
          quotesReceived: 4,
          status: 'reviewing',
          createdAt: '2d ago'
        },
        {
          id: 'rfq_2',
          category: 'AWS Credits',
          description: 'Cloud infrastructure for scaling',
          quotesReceived: 2,
          status: 'pending',
          createdAt: '1d ago'
        }
      ])
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center">
        <div className="text-amber-400 flex items-center gap-3">
          <Clock className="w-6 h-6 animate-spin" />
          <span className="text-lg">Loading your command center...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Founder Command Center
              </h1>
              <p className="text-gray-400">
                Your AI co-founder. Helping you hire, sell, source, and raise.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Quick Action
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Company Health Metrics */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            Company Health
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <HealthMetricCard
              label="ARR"
              value={`$${(metrics!.revenue / 1000).toFixed(0)}K`}
              change={metrics!.growth}
              trend="up"
              icon={DollarSign}
            />
            <HealthMetricCard
              label="Monthly Burn"
              value={`$${(metrics!.burn / 1000).toFixed(0)}K`}
              change="Stable"
              trend="neutral"
              icon={TrendingUp}
            />
            <HealthMetricCard
              label="Runway"
              value={`${metrics!.runway} months`}
              change={metrics!.runway >= 12 ? 'Healthy' : 'Watch'}
              trend={metrics!.runway >= 12 ? 'up' : 'down'}
              icon={Clock}
              urgent={metrics!.runway < 12}
            />
            <HealthMetricCard
              label="Team Size"
              value={`${metrics!.teamSize}`}
              change={`${metrics!.openPositions} open roles`}
              trend="up"
              icon={Users}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickActionCard
              title="Hire CFO"
              description="Wells Onyx will find 5 pre-qualified candidates in 2 weeks"
              icon="👔"
              href="/founder/hiring/start?role=CFO"
            />
            <QuickActionCard
              title="Find Customers"
              description="Launch GTM campaign to find 50+ qualified leads"
              icon="🎯"
              href="/founder/gtm/start"
            />
            <QuickActionCard
              title="Source Office Space"
              description="Get quotes from pre-vetted landlords in 48 hours"
              icon="🏢"
              href="/founder/procurement/start?category=office"
            />
          </div>
        </div>

        {/* Active Hiring Searches */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Active Hiring ({hiringSearches.length})
            </h2>
            <a
              href="/founder/hiring"
              className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="space-y-3">
            {hiringSearches.map(search => (
              <HiringSearchCard key={search.id} search={search} />
            ))}
          </div>
        </div>

        {/* Sales Pipeline */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              Sales Pipeline ({deals.length})
            </h2>
            <a
              href="/founder/deals"
              className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {deals.map(deal => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </div>

        {/* Open RFQs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-amber-400" />
              Procurement ({rfqs.length})
            </h2>
            <a
              href="/founder/procurement"
              className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="space-y-3">
            {rfqs.map(rfq => (
              <RFQCard key={rfq.id} rfq={rfq} />
            ))}
          </div>
        </div>

        {/* Wells Insights */}
        <div className="bg-gradient-to-br from-amber-900/20 to-amber-800/10 border border-amber-900/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Wells Insights
          </h3>
          <div className="space-y-4 text-gray-300">
            <InsightItem
              icon="📈"
              title="GTM Performance"
              description="Your email campaigns are performing 34% above industry average. Consider scaling the Enterprise CTO playbook."
            />
            <InsightItem
              icon="👥"
              title="Hiring Progress"
              description="3 strong CFO candidates ready for final interviews. I've prepared interview guides based on your preferences."
            />
            <InsightItem
              icon="🔧"
              title="Procurement Opportunity"
              description="I found 2 suppliers offering 15% better rates on cloud infrastructure. Want me to negotiate?"
            />
            <InsightItem
              icon="💰"
              title="Runway Alert"
              description="At current burn rate, you have 18 months runway. Consider starting fundraise conversations in 6-9 months."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function HealthMetricCard({
  label,
  value,
  change,
  trend,
  icon: Icon,
  urgent = false
}: {
  label: string
  value: string
  change: string
  trend: 'up' | 'down' | 'neutral'
  icon: any
  urgent?: boolean
}) {
  return (
    <div className={`bg-gray-900/50 border rounded-lg p-6 ${
      urgent ? 'border-red-900/50 bg-red-900/10' : 'border-gray-800'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-400">{label}</div>
        <Icon className={`w-4 h-4 ${urgent ? 'text-red-400' : 'text-amber-400'}`} />
      </div>
      <div className="text-2xl font-bold text-white mb-2">{value}</div>
      <div className={`text-sm font-medium ${
        trend === 'up' ? 'text-green-400' :
        trend === 'down' ? 'text-red-400' :
        'text-gray-400'
      }`}>
        {change}
      </div>
    </div>
  )
}

function QuickActionCard({
  title,
  description,
  icon,
  href
}: {
  title: string
  description: string
  icon: string
  href: string
}) {
  return (
    <a
      href={href}
      className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-amber-900/50 hover:bg-amber-900/10 transition-all group"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-400">
        {description}
      </p>
      <div className="mt-4 flex items-center gap-2 text-amber-400 text-sm font-medium">
        Start now
        <ArrowRight className="w-4 h-4" />
      </div>
    </a>
  )
}

function HiringSearchCard({ search }: { search: HiringSearch }) {
  const statusColors = {
    sourcing: 'text-blue-400 bg-blue-400/10',
    screening: 'text-amber-400 bg-amber-400/10',
    interviewing: 'text-purple-400 bg-purple-400/10',
    offer: 'text-green-400 bg-green-400/10'
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{search.role}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[search.status]}`}>
              {search.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>{search.candidatesFound} candidates found</span>
            {search.topMatches > 0 && (
              <span className="text-amber-400">{search.topMatches} top matches</span>
            )}
            <span>{search.daysActive} days active</span>
          </div>
        </div>
        <a
          href={`/founder/hiring/${search.id}`}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          View
        </a>
      </div>
    </div>
  )
}

function DealCard({ deal }: { deal: Deal }) {
  const stageColors = {
    discovery: 'text-blue-400',
    proposal: 'text-amber-400',
    negotiation: 'text-purple-400',
    closing: 'text-green-400'
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <h3 className="text-lg font-semibold text-white mb-2">{deal.companyName}</h3>
      <div className="text-2xl font-bold text-amber-400 mb-2">
        ${(deal.value / 1000).toFixed(0)}K
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${stageColors[deal.stage]}`}>
          {deal.stage}
        </span>
        <span className="text-gray-400">{deal.lastActivity}</span>
      </div>
    </div>
  )
}

function RFQCard({ rfq }: { rfq: RFQ }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{rfq.category}</h3>
            {rfq.status === 'reviewing' && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-400/10 text-amber-400">
                {rfq.quotesReceived} quotes
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mb-2">{rfq.description}</p>
          <div className="text-xs text-gray-500">{rfq.createdAt}</div>
        </div>
        <a
          href={`/founder/procurement/${rfq.id}`}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          Review
        </a>
      </div>
    </div>
  )
}

function InsightItem({
  icon,
  title,
  description
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-2xl">{icon}</div>
      <div className="flex-1">
        <h4 className="font-semibold text-white mb-1">{title}</h4>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
