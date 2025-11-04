'use client'

/**
 * Founder Journey - Holistic Command Center
 *
 * The founder sees everything:
 * - GTM campaigns and pipeline
 * - Job seekers and hiring pipeline
 * - Procurement and deals
 * - Finance and metrics
 *
 * Can switch between journeys seamlessly
 */

import { useUser } from '@clerk/nextjs'
import { useState } from 'react'
import {
  Users,
  Target,
  Briefcase,
  DollarSign,
  TrendingUp,
  Activity,
  MessageSquare,
  Settings
} from 'lucide-react'

type JourneyTab = 'overview' | 'gtm' | 'hiring' | 'procurement' | 'finance'

export default function FounderJourney() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState<JourneyTab>('overview')

  const tabs = [
    { id: 'overview' as JourneyTab, label: 'Overview', icon: Activity },
    { id: 'gtm' as JourneyTab, label: 'GTM', icon: Target },
    { id: 'hiring' as JourneyTab, label: 'Hiring', icon: Users },
    { id: 'procurement' as JourneyTab, label: 'Procurement', icon: Briefcase },
    { id: 'finance' as JourneyTab, label: 'Finance', icon: DollarSign },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Command Center
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Welcome back, {user?.firstName || 'Founder'}
              </p>
            </div>
            <button className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-800 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 border-b-2 transition-all
                    ${isActive
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'overview' && <OverviewPanel />}
        {activeTab === 'gtm' && <GTMPanel />}
        {activeTab === 'hiring' && <HiringPanel />}
        {activeTab === 'procurement' && <ProcurementPanel />}
        {activeTab === 'finance' && <FinancePanel />}
      </div>
    </div>
  )
}

function OverviewPanel() {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Revenue (MTD)"
          value="$847K"
          change="+23%"
          trend="up"
        />
        <MetricCard
          label="Active Campaigns"
          value="12"
          change="+3"
          trend="up"
        />
        <MetricCard
          label="Open Positions"
          value="8"
          change="-2"
          trend="down"
        />
        <MetricCard
          label="Active RFQs"
          value="15"
          change="+5"
          trend="up"
        />
      </div>

      {/* Activity Feed */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-400" />
          Recent Activity
        </h3>
        <div className="space-y-4">
          <ActivityItem
            type="gtm"
            message="New lead: Sarah Chen from TechCorp responded to outreach"
            time="2m ago"
          />
          <ActivityItem
            type="hiring"
            message="John Smith applied for Senior Engineer position"
            time="15m ago"
          />
          <ActivityItem
            type="procurement"
            message="3 quotes received for PCB manufacturing"
            time="1h ago"
          />
          <ActivityItem
            type="finance"
            message="Invoice #1247 paid - $25,000"
            time="2h ago"
          />
        </div>
      </div>

      {/* Wells Insights */}
      <div className="bg-gradient-to-br from-amber-900/20 to-amber-800/10 border border-amber-900/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-amber-400" />
          Wells Insights
        </h3>
        <div className="space-y-3 text-gray-300">
          <p className="leading-relaxed">
            📈 <strong className="text-white">GTM Performance:</strong> Your email campaigns are performing 34% above industry average. Consider scaling the "Enterprise CTO" playbook.
          </p>
          <p className="leading-relaxed">
            👥 <strong className="text-white">Hiring:</strong> 3 strong candidates ready for final interviews. I've prepared interview guides based on your preferences.
          </p>
          <p className="leading-relaxed">
            🔧 <strong className="text-white">Procurement:</strong> I found 2 suppliers offering 15% better rates on your PCB components. Want me to negotiate?
          </p>
        </div>
      </div>
    </div>
  )
}

function GTMPanel() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-400/10 mb-4">
        <Target className="w-8 h-8 text-amber-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">GTM Dashboard</h2>
      <p className="text-gray-400 mb-6">
        Campaign builder, pipeline management, and outreach automation
      </p>
      <a
        href="/gtm"
        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
      >
        Open GTM Dashboard
        <TrendingUp className="w-4 h-4" />
      </a>
    </div>
  )
}

function HiringPanel() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-400/10 mb-4">
        <Users className="w-8 h-8 text-amber-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Hiring Dashboard</h2>
      <p className="text-gray-400 mb-6">
        Job postings, candidate pipeline, and interview scheduling
      </p>
      <a
        href="/hr"
        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
      >
        Open Hiring Dashboard
        <Users className="w-4 h-4" />
      </a>
    </div>
  )
}

function ProcurementPanel() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-400/10 mb-4">
        <Briefcase className="w-8 h-8 text-amber-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Procurement Dashboard</h2>
      <p className="text-gray-400 mb-6">
        RFQs, supplier matching, and deal management
      </p>
      <a
        href="/app"
        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
      >
        Open Procurement Dashboard
        <Briefcase className="w-4 h-4" />
      </a>
    </div>
  )
}

function FinancePanel() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-400/10 mb-4">
        <DollarSign className="w-8 h-8 text-amber-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Finance Dashboard</h2>
      <p className="text-gray-400 mb-6">
        Revenue tracking, invoicing, and financial analytics
      </p>
      <a
        href="/analytics"
        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
      >
        Open Finance Dashboard
        <DollarSign className="w-4 h-4" />
      </a>
    </div>
  )
}

function MetricCard({
  label,
  value,
  change,
  trend
}: {
  label: string
  value: string
  change: string
  trend: 'up' | 'down'
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
      <div className="text-sm text-gray-400 mb-2">{label}</div>
      <div className="text-2xl font-bold text-white mb-2">{value}</div>
      <div className={`text-sm font-medium ${
        trend === 'up' ? 'text-green-400' : 'text-red-400'
      }`}>
        {change}
      </div>
    </div>
  )
}

function ActivityItem({
  type,
  message,
  time
}: {
  type: string
  message: string
  time: string
}) {
  const typeColors = {
    gtm: 'text-blue-400',
    hiring: 'text-purple-400',
    procurement: 'text-amber-400',
    finance: 'text-green-400'
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
      <div className={`w-2 h-2 rounded-full mt-2 ${typeColors[type as keyof typeof typeColors]}`} />
      <div className="flex-1">
        <p className="text-gray-300">{message}</p>
        <p className="text-sm text-gray-500 mt-1">{time}</p>
      </div>
    </div>
  )
}
