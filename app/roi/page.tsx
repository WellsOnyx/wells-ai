'use client'

/**
 * Customer ROI Dashboard
 * Shows customer their savings vs traditional sales team
 */

import { useEffect, useState } from 'react'

interface ROIData {
  revenueGenerated: number
  wellsFee: number
  traditionalCost: number
  savings: number
  savingsPercentage: number
  dealCount: number
  deals: Array<{
    dealId: string
    customer: string
    revenue: number
    fee: number
    closedAt: string
    source: string
  }>
}

export default function ROIDashboard() {
  const [data, setData] = useState<ROIData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In production: fetch from /api/roi
    // For now, use mock data
    setData({
      revenueGenerated: 8000000, // $8M
      wellsFee: 26400, // $8M × 0.0033
      traditionalCost: 800000, // $800K for sales team
      savings: 773600, // $773K saved
      savingsPercentage: 96.7,
      dealCount: 12,
      deals: [
        {
          dealId: 'DEAL-001',
          customer: 'Acme Corp',
          revenue: 2500000,
          fee: 8250,
          closedAt: '2025-10-15',
          source: 'wells_linkedin_outreach',
        },
        {
          dealId: 'DEAL-002',
          customer: 'TechCorp Inc',
          revenue: 1800000,
          fee: 5940,
          closedAt: '2025-10-20',
          source: 'wells_email_outreach',
        },
        {
          dealId: 'DEAL-003',
          customer: 'Enterprise Co',
          revenue: 3700000,
          fee: 12210,
          closedAt: '2025-10-25',
          source: 'wells_linkedin_outreach',
        },
      ],
    })
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Loading ROI Dashboard...</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Your Wells GTM ROI</h1>
        <p className="text-gray-400">Performance-based pricing • 0.33% on closed revenue</p>
      </div>

      {/* Hero Stat - Savings */}
      <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-700/50 rounded-lg p-8 mb-8">
        <div className="text-sm text-gray-400 mb-2">YOU SAVED</div>
        <div className="text-6xl font-bold text-green-400 mb-4">
          ${data.savings.toLocaleString()}
        </div>
        <div className="text-xl text-gray-300 mb-6">
          {data.savingsPercentage.toFixed(1)}% cost reduction vs traditional sales team
        </div>
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-700">
          <div>
            <div className="text-sm text-gray-400">Revenue Generated</div>
            <div className="text-2xl font-bold text-white">
              ${(data.revenueGenerated / 1000000).toFixed(1)}M
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Wells Fee (0.33%)</div>
            <div className="text-2xl font-bold text-blue-400">
              ${data.wellsFee.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Deals Closed</div>
            <div className="text-2xl font-bold text-white">{data.dealCount}</div>
          </div>
        </div>
      </div>

      {/* Cost Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Traditional Sales Team */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Traditional Sales Team</h2>
          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-gray-400">VP Sales</span>
              <span className="text-red-400">$250,000/year</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">2 Account Executives</span>
              <span className="text-red-400">$300,000/year</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">2 SDRs</span>
              <span className="text-red-400">$200,000/year</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tools (CRM, Sales stack)</span>
              <span className="text-red-400">$50,000/year</span>
            </div>
            <div className="border-t border-gray-700 pt-3 flex justify-between font-bold">
              <span>TOTAL COST</span>
              <span className="text-red-400">${data.traditionalCost.toLocaleString()}/year</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Plus 6-12 month ramp time • High risk • Fixed cost regardless of results
          </div>
        </div>

        {/* Wells GTM SDK */}
        <div className="bg-gradient-to-br from-blue-900/20 to-green-900/20 border border-green-700/50 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Wells GTM SDK</h2>
          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-gray-400">Setup Cost</span>
              <span className="text-green-400">$0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Monthly Retainer</span>
              <span className="text-green-400">$0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Success Fee (0.33%)</span>
              <span className="text-green-400">${data.wellsFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Risk</span>
              <span className="text-green-400">$0 (pay only on results)</span>
            </div>
            <div className="border-t border-gray-700 pt-3 flex justify-between font-bold">
              <span>TOTAL COST</span>
              <span className="text-green-400">${data.wellsFee.toLocaleString()}</span>
            </div>
          </div>
          <div className="text-xs text-green-400">
            Live in 48 hours • Zero risk • Only pay when you win
          </div>
        </div>
      </div>

      {/* Deal Breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Closed Deals</h2>
        <div className="space-y-3">
          {data.deals.map((deal) => (
            <div
              key={deal.dealId}
              className="bg-gray-800 border border-gray-700 rounded p-4 flex justify-between items-center"
            >
              <div>
                <div className="font-bold">{deal.customer}</div>
                <div className="text-sm text-gray-400">
                  {deal.dealId} • {new Date(deal.closedAt).toLocaleDateString()}
                </div>
                <div className="text-xs text-blue-400 mt-1">
                  {deal.source.replace('wells_', '').replace('_', ' ')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-400">
                  ${deal.revenue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">Wells fee: ${deal.fee.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Wells GTM SDK • Performance-Based Pricing • 33 Basis Points</p>
        <p className="text-xs mt-1">Built with precision. Powered by trust. Designed for generations.</p>
      </div>
    </div>
  )
}
