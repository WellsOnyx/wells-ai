'use client'

/**
 * Attribution Dashboard
 * Shows which deals came from Wells GTM and campaign performance
 */

import { useEffect, useState } from 'react'

interface AttributionData {
  totalRevenue: number
  totalDeals: number
  bySource: Array<{
    source: string
    deals: number
    revenue: number
    conversionRate: number
  }>
  byCampaign: Array<{
    campaign: string
    deals: number
    revenue: number
    prospects: number
    conversionRate: number
  }>
  recentDeals: Array<{
    dealId: string
    customer: string
    revenue: number
    source: string
    campaign: string
    prospectId: string
    closedAt: string
  }>
}

export default function AttributionDashboard() {
  const [data, setData] = useState<AttributionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In production: fetch from /api/attribution
    // For now, use mock data
    setData({
      totalRevenue: 8000000,
      totalDeals: 12,
      bySource: [
        {
          source: 'LinkedIn Outreach',
          deals: 7,
          revenue: 5200000,
          conversionRate: 3.5,
        },
        {
          source: 'Email Outreach',
          deals: 4,
          revenue: 2300000,
          conversionRate: 2.1,
        },
        {
          source: 'Inbound',
          deals: 1,
          revenue: 500000,
          conversionRate: 15.0,
        },
      ],
      byCampaign: [
        {
          campaign: 'Q4 Enterprise',
          deals: 5,
          revenue: 4500000,
          prospects: 142,
          conversionRate: 3.5,
        },
        {
          campaign: 'Mid-Market Growth',
          deals: 4,
          revenue: 2100000,
          prospects: 238,
          conversionRate: 1.7,
        },
        {
          campaign: 'Startup Accelerator',
          deals: 3,
          revenue: 1400000,
          prospects: 89,
          conversionRate: 3.4,
        },
      ],
      recentDeals: [
        {
          dealId: 'DEAL-012',
          customer: 'Enterprise Co',
          revenue: 3700000,
          source: 'wells_linkedin_outreach',
          campaign: 'Q4_Enterprise',
          prospectId: 'PROSPECT-456',
          closedAt: '2025-10-25',
        },
        {
          dealId: 'DEAL-011',
          customer: 'TechCorp Inc',
          revenue: 1800000,
          source: 'wells_email_outreach',
          campaign: 'Mid-Market_Growth',
          prospectId: 'PROSPECT-391',
          closedAt: '2025-10-20',
        },
        {
          dealId: 'DEAL-010',
          customer: 'Acme Corp',
          revenue: 2500000,
          source: 'wells_linkedin_outreach',
          campaign: 'Q4_Enterprise',
          prospectId: 'PROSPECT-289',
          closedAt: '2025-10-15',
        },
      ],
    })
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Loading Attribution Data...</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">GTM Attribution</h1>
        <p className="text-gray-400">Track which campaigns and channels drive revenue</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Total Revenue</div>
          <div className="text-3xl font-bold text-green-400">
            ${(data.totalRevenue / 1000000).toFixed(1)}M
          </div>
          <div className="text-xs text-gray-500 mt-1">From Wells GTM attribution</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Closed Deals</div>
          <div className="text-3xl font-bold text-white">{data.totalDeals}</div>
          <div className="text-xs text-gray-500 mt-1">Tracked from outreach to close</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Avg Deal Size</div>
          <div className="text-3xl font-bold text-blue-400">
            ${Math.round(data.totalRevenue / data.totalDeals / 1000)}K
          </div>
          <div className="text-xs text-gray-500 mt-1">Per closed opportunity</div>
        </div>
      </div>

      {/* Attribution by Source */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Revenue by Source</h2>
        <div className="space-y-4">
          {data.bySource.map((source) => (
            <div key={source.source} className="border-b border-gray-800 pb-4 last:border-0">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-lg">{source.source}</div>
                  <div className="text-sm text-gray-400">
                    {source.deals} deals • {source.conversionRate}% conversion rate
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    ${(source.revenue / 1000000).toFixed(2)}M
                  </div>
                  <div className="text-sm text-gray-400">
                    {((source.revenue / data.totalRevenue) * 100).toFixed(1)}% of total
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${(source.revenue / data.totalRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attribution by Campaign */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Campaign Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-700">
              <tr className="text-left text-sm text-gray-400">
                <th className="pb-3">Campaign</th>
                <th className="pb-3">Prospects</th>
                <th className="pb-3">Deals</th>
                <th className="pb-3">Conversion</th>
                <th className="pb-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.byCampaign.map((campaign) => (
                <tr key={campaign.campaign} className="border-b border-gray-800 last:border-0">
                  <td className="py-4 font-bold">{campaign.campaign}</td>
                  <td className="py-4 text-gray-400">{campaign.prospects}</td>
                  <td className="py-4">
                    <span className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-sm">
                      {campaign.deals}
                    </span>
                  </td>
                  <td className="py-4">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        campaign.conversionRate >= 3
                          ? 'bg-green-900 text-green-300'
                          : 'bg-yellow-900 text-yellow-300'
                      }`}
                    >
                      {campaign.conversionRate}%
                    </span>
                  </td>
                  <td className="py-4 text-right font-bold text-green-400">
                    ${(campaign.revenue / 1000000).toFixed(2)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Attributed Deals */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Recent Attributed Deals</h2>
        <div className="space-y-3">
          {data.recentDeals.map((deal) => (
            <div
              key={deal.dealId}
              className="bg-gray-800 border border-gray-700 rounded p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-lg">{deal.customer}</div>
                  <div className="text-sm text-gray-400">
                    {deal.dealId} • {new Date(deal.closedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-400">
                    ${deal.revenue.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400">
                    Fee: ${Math.round(deal.revenue * 0.0033).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="bg-blue-900 text-blue-300 px-2 py-1 rounded">
                  {deal.source.replace('wells_', '').replace('_', ' ')}
                </span>
                <span className="bg-purple-900 text-purple-300 px-2 py-1 rounded">
                  {deal.campaign.replace('_', ' ')}
                </span>
                <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded">
                  {deal.prospectId}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Wells GTM SDK • Full Attribution Tracking</p>
        <p className="text-xs mt-1">Track every deal from first touch to close</p>
      </div>
    </div>
  )
}
