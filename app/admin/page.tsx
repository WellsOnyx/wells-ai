'use client'

/**
 * Admin Dashboard
 * One dashboard to rule them all:
 * - RFQs (live from Notion)
 * - Quotes (live from Twilio)
 * - Revenue (33bps calc)
 * - GTM Pipeline (outbound automation)
 */

import { useEffect, useState } from 'react'

interface DashboardData {
  rfqs: {
    total: number
    pending: number
    matched: number
    closed: number
    totalValue: number
    recent: any[]
  }
  sms: {
    total: number
    sent: number
    received: number
    interested: number
    replyRate: number
    interestRate: number
    recent: any[]
  }
  revenue: {
    closedDeals: number
    totalClosedValue: number
    wellsFee: number
    basisPoints: number
    breakdown: any[]
  }
  gtm: {
    prospects: {
      total: number
      qualified: number
      avgICPScore: number
    }
    outreach: {
      sent: number
      opened: number
      replied: number
      openRate: number
      replyRate: number
    }
    meetings: {
      booked: number
      held: number
      showRate: number
    }
    pipeline: {
      opportunities: number
      value: number
      avgDeal: number
      forecast: number
    }
  }
  timestamp: string
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      const response = await fetch('/api/admin/overview')
      const result = await response.json()

      if (result.success) {
        setData(result.data)
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚡</div>
          <div className="text-xl">Loading Wells AI Admin...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 text-red-500">❌</div>
          <div className="text-xl text-red-400">Error: {error}</div>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Wells AI — Command Center</h1>
        <p className="text-gray-400">
          Last updated: {new Date(data.timestamp).toLocaleString()}
          <button
            onClick={fetchData}
            className="ml-4 text-blue-400 hover:text-blue-300 underline"
          >
            Refresh
          </button>
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="RFQs"
          value={data.rfqs.total}
          subtitle={`${data.rfqs.pending} pending`}
          icon="📝"
          trend={`${data.rfqs.closed} closed`}
        />
        <StatCard
          title="SMS Quotes"
          value={data.sms.sent}
          subtitle={`${data.sms.replyRate}% reply rate`}
          icon="📱"
          trend={`${data.sms.interested} interested`}
        />
        <StatCard
          title="Revenue"
          value={`$${data.revenue.wellsFee.toLocaleString()}`}
          subtitle="Wells fee (33bps)"
          icon="💰"
          trend={`${data.revenue.closedDeals} deals closed`}
        />
        <StatCard
          title="GTM Pipeline"
          value={`$${Math.round(data.gtm.pipeline.value / 1000)}k`}
          subtitle={`${data.gtm.pipeline.opportunities} opps`}
          icon="🎯"
          trend={`$${Math.round(data.gtm.pipeline.forecast / 1000)}k forecast`}
        />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* RFQs Section */}
        <DashboardSection
          title="🔷 RFQs (Live from Notion)"
          data={data.rfqs}
          renderContent={() => (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <MetricBox label="Total" value={data.rfqs.total} />
                <MetricBox label="Pending" value={data.rfqs.pending} />
                <MetricBox label="Closed" value={data.rfqs.closed} color="green" />
              </div>
              <div className="text-sm text-gray-400 mb-2">Recent RFQs:</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.rfqs.recent.slice(0, 5).map((rfq, i) => (
                  <div
                    key={rfq.id}
                    className="bg-gray-900 p-3 rounded border border-gray-800"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs text-blue-400">{rfq.requestId}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          rfq.status === 'Closed Won'
                            ? 'bg-green-900 text-green-300'
                            : rfq.status === 'Matched'
                            ? 'bg-yellow-900 text-yellow-300'
                            : 'bg-gray-800 text-gray-300'
                        }`}
                      >
                        {rfq.status}
                      </span>
                    </div>
                    <div className="text-sm">{rfq.buyer}</div>
                    <div className="text-xs text-gray-500 truncate">{rfq.requirements}</div>
                    {rfq.amount > 0 && (
                      <div className="text-xs text-green-400 mt-1">
                        ${rfq.amount.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        />

        {/* SMS Quotes Section */}
        <DashboardSection
          title="📱 SMS Quotes (Live from Twilio)"
          data={data.sms}
          renderContent={() => (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <MetricBox label="Sent" value={data.sms.sent} />
                <MetricBox label="Received" value={data.sms.received} />
                <MetricBox label="Interested" value={data.sms.interested} color="green" />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <MetricBox label="Reply Rate" value={`${data.sms.replyRate}%`} />
                <MetricBox label="Interest Rate" value={`${data.sms.interestRate}%`} color="green" />
              </div>
              <div className="text-sm text-gray-400 mb-2">Recent Messages:</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {data.sms.recent.slice(0, 5).map((msg, i) => (
                  <div key={msg.sid} className="bg-gray-900 p-3 rounded border border-gray-800">
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          msg.direction === 'outbound-api'
                            ? 'bg-blue-900 text-blue-300'
                            : 'bg-purple-900 text-purple-300'
                        }`}
                      >
                        {msg.direction === 'outbound-api' ? '→ Sent' : '← Received'}
                      </span>
                      <span className="text-xs text-gray-500">{msg.status}</span>
                    </div>
                    <div className="text-xs text-gray-400">{msg.from} → {msg.to}</div>
                    <div className="text-sm mt-1">{msg.body.substring(0, 80)}...</div>
                  </div>
                ))}
              </div>
            </>
          )}
        />

        {/* Revenue Section */}
        <DashboardSection
          title="💰 Revenue (33bps Calculation)"
          data={data.revenue}
          renderContent={() => (
            <>
              <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 p-6 rounded-lg border border-green-700/30 mb-6">
                <div className="text-3xl font-bold text-green-400 mb-2">
                  ${data.revenue.wellsFee.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">
                  Wells Onyx Fee ({data.revenue.basisPoints} basis points)
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  From ${data.revenue.totalClosedValue.toLocaleString()} in closed deals
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <MetricBox label="Closed Deals" value={data.revenue.closedDeals} color="green" />
                <MetricBox
                  label="Total Closed"
                  value={`$${Math.round(data.revenue.totalClosedValue / 1000)}k`}
                  color="green"
                />
              </div>

              {data.revenue.breakdown.length > 0 && (
                <>
                  <div className="text-sm text-gray-400 mb-2">Deal Breakdown:</div>
                  <div className="space-y-2">
                    {data.revenue.breakdown.map((deal, i) => (
                      <div key={deal.id} className="bg-gray-900 p-3 rounded border border-gray-800">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">{deal.buyer}</span>
                          <span className="text-green-400">${deal.amount.toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Wells fee: ${deal.fee.toLocaleString()} (33bps)
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        />

        {/* GTM Pipeline Section */}
        <DashboardSection
          title="🎯 GTM Pipeline (Outbound Automation)"
          data={data.gtm}
          renderContent={() => (
            <>
              {/* Prospects */}
              <div className="mb-6">
                <div className="text-xs text-gray-400 mb-2">Prospects</div>
                <div className="grid grid-cols-3 gap-2">
                  <MetricBox
                    label="Total"
                    value={data.gtm.prospects.total.toLocaleString()}
                    size="sm"
                  />
                  <MetricBox
                    label="Qualified"
                    value={data.gtm.prospects.qualified.toLocaleString()}
                    size="sm"
                  />
                  <MetricBox
                    label="Avg ICP"
                    value={`${data.gtm.prospects.avgICPScore}/100`}
                    size="sm"
                  />
                </div>
              </div>

              {/* Outreach */}
              <div className="mb-6">
                <div className="text-xs text-gray-400 mb-2">Outreach</div>
                <div className="grid grid-cols-3 gap-2">
                  <MetricBox label="Sent" value={data.gtm.outreach.sent} size="sm" />
                  <MetricBox
                    label="Open Rate"
                    value={`${data.gtm.outreach.openRate}%`}
                    size="sm"
                  />
                  <MetricBox
                    label="Reply Rate"
                    value={`${data.gtm.outreach.replyRate}%`}
                    size="sm"
                    color="green"
                  />
                </div>
              </div>

              {/* Meetings */}
              <div className="mb-6">
                <div className="text-xs text-gray-400 mb-2">Meetings</div>
                <div className="grid grid-cols-3 gap-2">
                  <MetricBox label="Booked" value={data.gtm.meetings.booked} size="sm" />
                  <MetricBox label="Held" value={data.gtm.meetings.held} size="sm" />
                  <MetricBox
                    label="Show Rate"
                    value={`${data.gtm.meetings.showRate}%`}
                    size="sm"
                    color="green"
                  />
                </div>
              </div>

              {/* Pipeline */}
              <div>
                <div className="text-xs text-gray-400 mb-2">Pipeline</div>
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox label="Opportunities" value={data.gtm.pipeline.opportunities} size="sm" />
                  <MetricBox
                    label="Pipeline Value"
                    value={`$${Math.round(data.gtm.pipeline.value / 1000)}k`}
                    size="sm"
                  />
                  <MetricBox
                    label="Avg Deal"
                    value={`$${Math.round(data.gtm.pipeline.avgDeal / 1000)}k`}
                    size="sm"
                  />
                  <MetricBox
                    label="Forecast"
                    value={`$${Math.round(data.gtm.pipeline.forecast / 1000)}k`}
                    size="sm"
                    color="green"
                  />
                </div>
              </div>
            </>
          )}
        />
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Wells AI — Command Center</p>
        <p className="text-xs mt-1">Built with precision. Powered by trust. Designed for generations.</p>
      </div>
    </div>
  )
}

// Components

function StatCard({ title, value, subtitle, icon, trend }: any) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl">{icon}</span>
        <div className="text-3xl font-bold">{value}</div>
      </div>
      <div className="text-sm text-gray-400">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      {trend && <div className="text-xs text-blue-400 mt-2">{trend}</div>}
    </div>
  )
}

function DashboardSection({ title, data, renderContent }: any) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {renderContent()}
    </div>
  )
}

function MetricBox({ label, value, color, size = 'md' }: any) {
  const bgColor = color === 'green' ? 'bg-green-900/30' : 'bg-gray-800'
  const textColor = color === 'green' ? 'text-green-400' : 'text-white'
  const sizeClass = size === 'sm' ? 'p-2' : 'p-4'

  return (
    <div className={`${bgColor} rounded ${sizeClass}`}>
      <div className={`${size === 'sm' ? 'text-lg' : 'text-2xl'} font-bold ${textColor}`}>
        {value}
      </div>
      <div className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-gray-400`}>{label}</div>
    </div>
  )
}
