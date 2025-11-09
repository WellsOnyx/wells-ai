'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Zap, TrendingUp, Users, ShoppingCart, Briefcase, CheckCircle, Clock, Play, Pause, Settings, BarChart3, DollarSign } from 'lucide-react'

interface AIOperation {
  id: string
  name: string
  category: 'sales' | 'procurement' | 'hiring' | 'finance' | 'customer_service'
  description: string
  status: 'active' | 'paused' | 'scheduled'
  frequency: string
  lastRun?: string
  nextRun?: string
  metrics: {
    totalRuns: number
    successRate: number
    timeSaved: number
    costSaved: number
  }
  icon: any
}

export default function AIOpsDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'operations' | 'marketplace'>('overview')

  const operations: AIOperation[] = [
    {
      id: 'op_sales_1',
      name: 'Daily Lead Generation',
      category: 'sales',
      description: 'Find 50 qualified leads in your ICP, enrich with Apollo, personalize outreach',
      status: 'active',
      frequency: 'Daily at 9am',
      lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
      metrics: {
        totalRuns: 47,
        successRate: 94,
        timeSaved: 188, // hours
        costSaved: 18800 // dollars
      },
      icon: Users
    },
    {
      id: 'op_sales_2',
      name: 'Follow-up Sequence',
      category: 'sales',
      description: 'Send personalized follow-ups to prospects who haven\'t replied in 5 days',
      status: 'active',
      frequency: 'Continuous',
      lastRun: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      metrics: {
        totalRuns: 312,
        successRate: 89,
        timeSaved: 156,
        costSaved: 15600
      },
      icon: Bot
    },
    {
      id: 'op_proc_1',
      name: 'Supplier RFQ Management',
      category: 'procurement',
      description: 'Automatically send RFQs to suppliers, collect quotes, compare pricing',
      status: 'active',
      frequency: 'As needed',
      lastRun: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      metrics: {
        totalRuns: 23,
        successRate: 96,
        timeSaved: 92,
        costSaved: 45000
      },
      icon: ShoppingCart
    },
    {
      id: 'op_hire_1',
      name: 'Job Posting & Screening',
      category: 'hiring',
      description: 'Post jobs to 20+ boards, screen candidates, schedule interviews',
      status: 'paused',
      frequency: 'Weekly',
      metrics: {
        totalRuns: 12,
        successRate: 88,
        timeSaved: 96,
        costSaved: 9600
      },
      icon: Briefcase
    },
    {
      id: 'op_fin_1',
      name: 'Invoice Processing',
      category: 'finance',
      description: 'Extract invoice data, match to POs, route for approval, process payment',
      status: 'active',
      frequency: 'Real-time',
      lastRun: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      metrics: {
        totalRuns: 156,
        successRate: 99,
        timeSaved: 78,
        costSaved: 7800
      },
      icon: DollarSign
    }
  ]

  const stats = {
    totalOperations: operations.length,
    activeOperations: operations.filter(op => op.status === 'active').length,
    totalTimeSaved: operations.reduce((sum, op) => sum + op.metrics.timeSaved, 0),
    totalCostSaved: operations.reduce((sum, op) => sum + op.metrics.costSaved, 0),
    avgSuccessRate: Math.round(operations.reduce((sum, op) => sum + op.metrics.successRate, 0) / operations.length)
  }

  const marketplaceOperations = [
    {
      id: 'mp_1',
      name: 'Customer Support Autopilot',
      description: 'AI handles 90% of customer support tickets automatically',
      category: 'customer_service',
      price: 199,
      savings: '30 hrs/week',
      icon: Bot
    },
    {
      id: 'mp_2',
      name: 'Social Media Manager',
      description: 'Auto-generate and post content across all platforms',
      category: 'sales',
      price: 149,
      savings: '20 hrs/week',
      icon: TrendingUp
    },
    {
      id: 'mp_3',
      name: 'Competitive Intelligence',
      description: 'Monitor competitors, track pricing, analyze strategies',
      category: 'sales',
      price: 299,
      savings: '15 hrs/week',
      icon: BarChart3
    },
    {
      id: 'mp_4',
      name: 'Expense Management',
      description: 'Categorize expenses, flag anomalies, generate reports',
      category: 'finance',
      price: 99,
      savings: '10 hrs/week',
      icon: DollarSign
    }
  ]

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sales': return 'bg-blue-500/20 text-blue-400'
      case 'procurement': return 'bg-green-500/20 text-green-400'
      case 'hiring': return 'bg-purple-500/20 text-purple-400'
      case 'finance': return 'bg-amber-500/20 text-amber-400'
      case 'customer_service': return 'bg-pink-500/20 text-pink-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Bot className="w-8 h-8 text-blue-500" />
                AI Ops
              </h1>
              <p className="text-gray-400 mt-1">Run your entire business on autopilot</p>
            </div>
            <button
              onClick={() => router.push('/app')}
              className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-400 transition"
            >
              Add New Operation
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('operations')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'operations'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Operations
          </button>
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'marketplace'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Marketplace
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid md:grid-cols-5 gap-6">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                <Zap className="w-8 h-8 text-blue-500 mb-4" />
                <div className="text-3xl font-bold text-blue-500 mb-1">{stats.totalOperations}</div>
                <div className="text-sm text-gray-400">Total Operations</div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                <Play className="w-8 h-8 text-green-500 mb-4" />
                <div className="text-3xl font-bold text-green-500 mb-1">{stats.activeOperations}</div>
                <div className="text-sm text-gray-400">Active Now</div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                <Clock className="w-8 h-8 text-purple-500 mb-4" />
                <div className="text-3xl font-bold text-purple-500 mb-1">{stats.totalTimeSaved}h</div>
                <div className="text-sm text-gray-400">Time Saved</div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                <DollarSign className="w-8 h-8 text-amber-500 mb-4" />
                <div className="text-3xl font-bold text-amber-500 mb-1">${(stats.totalCostSaved / 1000).toFixed(0)}K</div>
                <div className="text-sm text-gray-400">Cost Saved</div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                <CheckCircle className="w-8 h-8 text-green-500 mb-4" />
                <div className="text-3xl font-bold text-green-500 mb-1">{stats.avgSuccessRate}%</div>
                <div className="text-sm text-gray-400">Success Rate</div>
              </div>
            </div>

            {/* Value Prop */}
            <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-xl p-8 border border-blue-700/30">
              <h2 className="text-2xl font-bold mb-4">How AI Ops Works</h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div>
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-blue-500">1</span>
                  </div>
                  <h3 className="font-semibold mb-2">Tell Wells What to Do</h3>
                  <p className="text-sm text-gray-400">
                    "Find 50 leads in fintech, send personalized cold emails, follow up in 5 days"
                  </p>
                </div>
                <div>
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-purple-500">2</span>
                  </div>
                  <h3 className="font-semibold mb-2">AI Executes Automatically</h3>
                  <p className="text-sm text-gray-400">
                    Wells handles everything: research, outreach, follow-ups, booking meetings
                  </p>
                </div>
                <div>
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-green-500">3</span>
                  </div>
                  <h3 className="font-semibold mb-2">You Review Results</h3>
                  <p className="text-sm text-gray-400">
                    Get daily summaries, approve deals, collect revenue. No manual work.
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {operations.filter(op => op.lastRun).slice(0, 5).map((op) => (
                  <div key={op.id} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <div className="font-semibold">{op.name}</div>
                        <div className="text-sm text-gray-400">
                          Completed {new Date(op.lastRun!).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-green-500 font-semibold">Success</div>
                      <div className="text-xs text-gray-500">2.3 min runtime</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <div className="space-y-4">
            {operations.map((op) => {
              const Icon = op.icon
              return (
                <div
                  key={op.id}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-1">{op.name}</h3>
                        <p className="text-sm text-gray-400 mb-2">{op.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className={`px-2 py-1 rounded ${getCategoryColor(op.category)}`}>
                            {op.category.replace('_', ' ')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {op.frequency}
                          </span>
                          {op.nextRun && (
                            <span>Next: {new Date(op.nextRun).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        op.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {op.status.toUpperCase()}
                      </span>
                      <button className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-700">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">{op.metrics.totalRuns}</div>
                      <div className="text-xs text-gray-500">Total Runs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">{op.metrics.successRate}%</div>
                      <div className="text-xs text-gray-500">Success Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-500">{op.metrics.timeSaved}h</div>
                      <div className="text-xs text-gray-500">Time Saved</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-500">${(op.metrics.costSaved / 1000).toFixed(1)}K</div>
                      <div className="text-xs text-gray-500">Cost Saved</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 mt-4">
                    {op.status === 'active' ? (
                      <button className="px-4 py-2 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition flex items-center gap-2">
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                    ) : (
                      <button className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-400 transition flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        Resume
                      </button>
                    )}
                    <button className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-400 transition">
                      View Logs
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Marketplace Tab */}
        {activeTab === 'marketplace' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-xl p-6 border border-blue-700/30">
              <h2 className="text-xl font-bold mb-2">Add More AI Operations</h2>
              <p className="text-gray-400">
                Expand your automation capabilities with pre-built operations from the marketplace
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {marketplaceOperations.map((mp) => {
                const Icon = mp.icon
                return (
                  <div
                    key={mp.id}
                    className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-1">{mp.name}</h3>
                        <p className="text-sm text-gray-400 mb-3">{mp.description}</p>
                        <span className={`px-2 py-1 rounded text-xs ${getCategoryColor(mp.category)}`}>
                          {mp.category.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                      <div>
                        <div className="text-2xl font-bold text-blue-500">${mp.price}/mo</div>
                        <div className="text-xs text-gray-500">Saves {mp.savings}</div>
                      </div>
                      <button className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-400 transition">
                        Add Operation
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
