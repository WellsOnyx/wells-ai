'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// Data Types
interface EarningsData {
  agentId: string
  agentName: string
  currentBalance: number
  todayEarnings: number
  weekEarnings: number
  monthEarnings: number
  tasksCompletedToday: number
  hoursWorkedToday: number
  rank: number
}

interface EarningsTransaction {
  id: string
  date: string
  taskTitle: string
  clientName: string
  minutesSpent: number
  grainEarned: number
  sopType: string
}

interface LeaderboardEntry {
  rank: number
  agentName: string
  grainEarned: number
  tasksCompleted: number
}

interface ChartData {
  date: string
  grain: number
  tasks: number
}

// Mock Data Generator
function generateMockData() {
  const clients = [
    'Acme Corp', 'TechStart Inc', 'Global Solutions', 'InnovateTech',
    'BlueSky Enterprises', 'NextGen Systems', 'Alpha Industries', 'Quantum Labs',
    'Vertex Solutions', 'Nimbus Corp', 'Zenith Tech', 'Apex Innovations',
    'Horizon Group', 'Summit Partners', 'Eclipse Technologies'
  ]

  const sopTypes = [
    'Interview Coordination', 'Candidate Sourcing', 'Resume Review',
    'Reference Check', 'Offer Negotiation', 'Client Communication',
    'Pipeline Management', 'Market Research', 'Outreach Campaign',
    'Screening Call', 'Scheduling', 'Documentation'
  ]

  const taskTitles = [
    'Schedule interviews for Senior Engineer role',
    'Source candidates for Product Manager position',
    'Review resumes for Data Scientist opening',
    'Conduct reference checks for VP candidate',
    'Negotiate offer package for CTO hire',
    'Update client on pipeline status',
    'Build candidate pipeline for startup',
    'Research market salary data',
    'Launch outreach campaign for tech roles',
    'Screen candidates for leadership position',
    'Coordinate panel interviews',
    'Prepare candidate documentation',
    'Follow up with hiring managers',
    'Update ATS with new candidates',
    'Conduct salary benchmarking',
    'Schedule debrief meetings'
  ]

  // Generate transactions for last 60 days
  const transactions: EarningsTransaction[] = []
  const today = new Date()

  for (let i = 0; i < 75; i++) {
    const daysAgo = Math.floor(Math.random() * 60)
    const date = new Date(today)
    date.setDate(date.getDate() - daysAgo)

    const minutesSpent = 15 + Math.floor(Math.random() * 180) // 15-195 minutes
    const grainEarned = Math.floor(minutesSpent / 15) * 50 + Math.floor(Math.random() * 100) // Base rate + bonus

    transactions.push({
      id: `txn_${i + 1}`,
      date: date.toISOString(),
      taskTitle: taskTitles[Math.floor(Math.random() * taskTitles.length)],
      clientName: clients[Math.floor(Math.random() * clients.length)],
      minutesSpent,
      grainEarned,
      sopType: sopTypes[Math.floor(Math.random() * sopTypes.length)]
    })
  }

  // Sort by date descending
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Generate chart data for last 30 days
  const chartData: ChartData[] = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    const dayTransactions = transactions.filter(t => {
      const txDate = new Date(t.date)
      return txDate.toDateString() === date.toDateString()
    })

    chartData.push({
      date: date.toISOString().split('T')[0],
      grain: dayTransactions.reduce((sum, t) => sum + t.grainEarned, 0),
      tasks: dayTransactions.length
    })
  }

  // Calculate earnings data
  const todayTransactions = transactions.filter(t => {
    const txDate = new Date(t.date)
    return txDate.toDateString() === today.toDateString()
  })

  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekTransactions = transactions.filter(t => new Date(t.date) >= weekAgo)

  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)
  const monthTransactions = transactions.filter(t => new Date(t.date) >= monthAgo)

  const earningsData: EarningsData = {
    agentId: 'agent_001',
    agentName: 'You',
    currentBalance: transactions.reduce((sum, t) => sum + t.grainEarned, 0),
    todayEarnings: todayTransactions.reduce((sum, t) => sum + t.grainEarned, 0),
    weekEarnings: weekTransactions.reduce((sum, t) => sum + t.grainEarned, 0),
    monthEarnings: monthTransactions.reduce((sum, t) => sum + t.grainEarned, 0),
    tasksCompletedToday: todayTransactions.length,
    hoursWorkedToday: todayTransactions.reduce((sum, t) => sum + t.minutesSpent, 0) / 60,
    rank: 4
  }

  // Generate leaderboard
  const agentNames = [
    'Sarah Chen', 'Marcus Rodriguez', 'Aisha Patel', 'You', 'David Kim',
    'Emma Thompson', 'James Wilson', 'Priya Sharma', 'Alex Morgan', 'Sofia Martinez',
    'Kevin O\'Brien', 'Zoe Anderson', 'Ryan Foster', 'Olivia Brown', 'Lucas Taylor',
    'Nina Gupta', 'Chris Evans', 'Maya Johnson', 'Tom Harris', 'Anna Lee'
  ]

  const leaderboard: LeaderboardEntry[] = agentNames.map((name, index) => {
    const baseGrain = 25000 - (index * 1500) + Math.floor(Math.random() * 1000)
    const tasks = 40 + Math.floor(Math.random() * 60) - (index * 2)

    return {
      rank: index + 1,
      agentName: name,
      grainEarned: baseGrain,
      tasksCompleted: tasks
    }
  })

  return { transactions, chartData, earningsData, leaderboard }
}

export default function EarningsPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterSOPType, setFilterSOPType] = useState('')
  const [chartView, setChartView] = useState<'7days' | '30days'>('7days')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('week')

  const { transactions, chartData, earningsData, leaderboard } = generateMockData()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && isLoaded && !isSignedIn) {
      router.push('/sign-in?redirect_url=/ai-ops/agent/earnings')
    }
  }, [mounted, isLoaded, isSignedIn, router])

  useEffect(() => {
    if (mounted && isLoaded && isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress || ''
      if (!email.endsWith('@wellsonyx.com')) {
        router.push('/ai-ops')
      }
    }
  }, [mounted, isLoaded, isSignedIn, user, router])

  if (!mounted || !isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-purple-400 text-lg">Loading earnings data...</div>
      </div>
    )
  }

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.taskTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClient = !filterClient || t.clientName === filterClient
    const matchesSOPType = !filterSOPType || t.sopType === filterSOPType
    return matchesSearch && matchesClient && matchesSOPType
  })

  // Get unique clients and SOP types for filters
  const uniqueClients = Array.from(new Set(transactions.map(t => t.clientName))).sort()
  const uniqueSOPTypes = Array.from(new Set(transactions.map(t => t.sopType))).sort()

  // Calculate projected monthly earnings
  const daysInMonth = 30
  const currentDay = new Date().getDate()
  const projectedMonthly = earningsData.monthEarnings / 30 * daysInMonth

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Task', 'Client', 'Time Spent (min)', 'GRAIN Earned', 'SOP Type']
    const rows = filteredTransactions.map(t => [
      new Date(t.date).toLocaleDateString(),
      t.taskTitle,
      t.clientName,
      t.minutesSpent.toString(),
      t.grainEarned.toString(),
      t.sopType
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grain-earnings-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Get chart data based on view
  const displayChartData = chartView === '7days'
    ? chartData.slice(-7)
    : chartData

  const maxGrain = Math.max(...displayChartData.map(d => d.grain), 1)

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            GRAIN Earnings Tracker
          </h1>
          <p className="text-gray-400">Track your performance and earnings in real-time</p>
        </div>

        {/* Today's Earnings Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 border border-purple-500/20 rounded-lg p-6">
            <div className="text-sm text-gray-400 mb-2">Today's Earnings</div>
            <div className="text-3xl font-bold text-purple-400">{earningsData.todayEarnings.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">GRAIN</div>
          </div>

          <div className="bg-gray-900 border border-purple-500/20 rounded-lg p-6">
            <div className="text-sm text-gray-400 mb-2">Tasks Completed</div>
            <div className="text-3xl font-bold text-white">{earningsData.tasksCompletedToday}</div>
            <div className="text-xs text-gray-500 mt-1">Today</div>
          </div>

          <div className="bg-gray-900 border border-purple-500/20 rounded-lg p-6">
            <div className="text-sm text-gray-400 mb-2">Hours Worked</div>
            <div className="text-3xl font-bold text-white">{earningsData.hoursWorkedToday.toFixed(1)}</div>
            <div className="text-xs text-gray-500 mt-1">Today</div>
          </div>

          <div className="bg-gray-900 border border-purple-500/20 rounded-lg p-6">
            <div className="text-sm text-gray-400 mb-2">Avg GRAIN/Task</div>
            <div className="text-3xl font-bold text-white">
              {earningsData.tasksCompletedToday > 0
                ? Math.round(earningsData.todayEarnings / earningsData.tasksCompletedToday)
                : 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Today</div>
          </div>
        </div>

        {/* Period Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-500/30 rounded-lg p-6">
            <div className="text-sm text-purple-300 mb-2">This Week</div>
            <div className="text-2xl font-bold text-white mb-1">{earningsData.weekEarnings.toLocaleString()} GRAIN</div>
            <div className="text-xs text-purple-300">Your Rank: #{earningsData.rank}</div>
          </div>

          <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 border border-pink-500/30 rounded-lg p-6">
            <div className="text-sm text-pink-300 mb-2">This Month</div>
            <div className="text-2xl font-bold text-white mb-1">{earningsData.monthEarnings.toLocaleString()} GRAIN</div>
            <div className="text-xs text-pink-300">Current Balance</div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-500/30 rounded-lg p-6">
            <div className="text-sm text-blue-300 mb-2">Projected Monthly</div>
            <div className="text-2xl font-bold text-white mb-1">{Math.round(projectedMonthly).toLocaleString()} GRAIN</div>
            <div className="text-xs text-blue-300">At current pace</div>
          </div>
        </div>

        {/* Earnings Chart */}
        <div className="bg-gray-900 border border-purple-500/20 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Earnings Chart</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setChartView('7days')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  chartView === '7days'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setChartView('30days')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  chartView === '30days'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Last 30 Days
              </button>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-1 bg-gray-950 rounded-lg p-4">
            {displayChartData.map((data, index) => {
              const heightPercent = (data.grain / maxGrain) * 100
              return (
                <div key={index} className="flex-1 flex flex-col items-center group">
                  <div
                    className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t hover:from-purple-500 hover:to-purple-300 transition-all cursor-pointer relative"
                    style={{ height: `${heightPercent}%`, minHeight: data.grain > 0 ? '4px' : '0' }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {data.grain} GRAIN<br />
                      {data.tasks} tasks
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                    {new Date(data.date).getMonth() + 1}/{new Date(data.date).getDate()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Transaction History */}
          <div className="lg:col-span-2 bg-gray-900 border border-purple-500/20 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Transaction History</h2>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
              >
                Export CSV
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <input
                type="text"
                placeholder="Search tasks or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />

              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">All Clients</option>
                {uniqueClients.map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>

              <select
                value={filterSOPType}
                onChange={(e) => setFilterSOPType(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">All SOP Types</option>
                {uniqueSOPTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Transaction Table */}
            <div className="overflow-x-auto">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-gray-400">Date</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-400">Task</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-400">Client</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-400">Time</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-400">GRAIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction, index) => (
                      <tr
                        key={transaction.id}
                        className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                          index % 2 === 0 ? 'bg-gray-900/50' : ''
                        }`}
                      >
                        <td className="p-3 text-sm text-gray-300">
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-sm">
                          <div className="text-white">{transaction.taskTitle}</div>
                          <div className="text-xs text-gray-500">{transaction.sopType}</div>
                        </td>
                        <td className="p-3 text-sm text-gray-300">{transaction.clientName}</td>
                        <td className="p-3 text-sm text-gray-300 text-right">
                          {Math.floor(transaction.minutesSpent / 60)}h {transaction.minutesSpent % 60}m
                        </td>
                        <td className="p-3 text-sm font-medium text-purple-400 text-right">
                          {transaction.grainEarned.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-gray-900 border border-purple-500/20 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Leaderboard</h2>
            <div className="text-sm text-gray-400 mb-4">This Week's Top Performers</div>

            <div className="space-y-3">
              {leaderboard.slice(0, 10).map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    entry.agentName === 'You'
                      ? 'bg-purple-900/30 border border-purple-500/50'
                      : 'bg-gray-800 hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      entry.rank === 1 ? 'bg-yellow-500 text-black' :
                      entry.rank === 2 ? 'bg-gray-400 text-black' :
                      entry.rank === 3 ? 'bg-orange-600 text-white' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {entry.rank}
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        {entry.agentName}
                        {entry.agentName === 'You' && (
                          <span className="ml-2 text-xs text-purple-400">(You)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{entry.tasksCompleted} tasks</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-purple-400">{entry.grainEarned.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">GRAIN</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Your Stats Summary */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <div className="text-sm text-gray-400 mb-3">Your Position</div>
              <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">Rank</span>
                  <span className="text-xl font-bold text-white">#{earningsData.rank}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">Week Earnings</span>
                  <span className="text-lg font-bold text-purple-400">{earningsData.weekEarnings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Total Balance</span>
                  <span className="text-lg font-bold text-white">{earningsData.currentBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-8 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-lg p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{earningsData.currentBalance.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Total GRAIN Balance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{transactions.length}</div>
              <div className="text-sm text-gray-400">Total Tasks Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {Math.round(transactions.reduce((sum, t) => sum + t.grainEarned, 0) / transactions.length)}
              </div>
              <div className="text-sm text-gray-400">Avg GRAIN per Task</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {Math.round(transactions.reduce((sum, t) => sum + t.minutesSpent, 0) / 60)}h
              </div>
              <div className="text-sm text-gray-400">Total Hours Worked</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
