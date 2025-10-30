'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AnalyticsData {
  performance: {
    avgResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
    errorRate: number
  }
  usage: {
    totalConversations: number
    totalMessages: number
    avgMessagesPerConversation: number
    activeUsers: number
  }
  revenue: {
    totalRevenue: number
    totalDeals: number
    avgDealSize: number
    wellsFees: number
  }
  cache: {
    hitRate: number
    missRate: number
    totalKeys: number
  }
  trends: {
    date: string
    conversations: number
    deals: number
    revenue: number
  }[]
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')

  useEffect(() => {
    fetchAnalytics()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000)
    return () => clearInterval(interval)
  }, [timeRange])

  async function fetchAnalytics() {
    try {
      const response = await fetch(`/api/analytics/dashboard?range=${timeRange}`)
      const analyticsData = await response.json()
      setData(analyticsData)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No analytics data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Wells AI Analytics</h1>
            <p className="mt-2 text-gray-600">Real-time performance and usage metrics</p>
          </div>

          {/* Time range selector */}
          <div className="flex space-x-2">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm
                  ${timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Response Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {data.performance.avgResponseTime}ms
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  P95: {data.performance.p95ResponseTime}ms | P99: {data.performance.p99ResponseTime}ms
                </p>
              </div>
              <div className={`
                p-3 rounded-full
                ${data.performance.avgResponseTime < 2000 ? 'bg-green-100' : 'bg-red-100'}
              `}>
                <svg className={`h-6 w-6 ${data.performance.avgResponseTime < 2000 ? 'text-green-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Conversations */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Conversations</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {data.usage.totalConversations.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {data.usage.avgMessagesPerConversation.toFixed(1)} msgs/conv
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  ${data.revenue.totalRevenue.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Wells fees: ${data.revenue.wellsFees.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Cache Hit Rate */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {(data.cache.hitRate * 100).toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {data.cache.totalKeys} keys cached
                </p>
              </div>
              <div className={`
                p-3 rounded-full
                ${data.cache.hitRate > 0.8 ? 'bg-green-100' : 'bg-yellow-100'}
              `}>
                <svg className={`h-6 w-6 ${data.cache.hitRate > 0.8 ? 'text-green-600' : 'text-yellow-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Conversations Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversations Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="conversations" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Error Rate</span>
                  <span className="font-medium text-gray-900">{(data.performance.errorRate * 100).toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${data.performance.errorRate < 0.01 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(data.performance.errorRate * 100 * 10, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Avg Response</span>
                  <span className="font-medium text-gray-900">{data.performance.avgResponseTime}ms</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${data.performance.avgResponseTime < 2000 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min((data.performance.avgResponseTime / 5000) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Cache Hit Rate</span>
                  <span className="font-medium text-gray-900">{(data.cache.hitRate * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${data.cache.hitRate * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Statistics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Total Messages</dt>
                <dd className="text-sm font-semibold text-gray-900">{data.usage.totalMessages.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Active Users</dt>
                <dd className="text-sm font-semibold text-gray-900">{data.usage.activeUsers.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Avg Msgs/Conv</dt>
                <dd className="text-sm font-semibold text-gray-900">{data.usage.avgMessagesPerConversation.toFixed(1)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Total Deals</dt>
                <dd className="text-sm font-semibold text-gray-900">{data.revenue.totalDeals.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Avg Deal Size</dt>
                <dd className="text-sm font-semibold text-gray-900">${data.revenue.avgDealSize.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Status</span>
                <span className="flex items-center">
                  <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-sm font-medium text-green-600">Operational</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <span className="flex items-center">
                  <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-sm font-medium text-green-600">Healthy</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Cache</span>
                <span className="flex items-center">
                  <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-sm font-medium text-green-600">Connected</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Monitoring</span>
                <span className="flex items-center">
                  <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-sm font-medium text-green-600">Active</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()} | Auto-refreshes every 30 seconds
        </div>
      </div>
    </div>
  )
}
