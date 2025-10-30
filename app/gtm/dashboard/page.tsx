'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  serviceOffering: string
  status: string
  targetCount: number
  outreachSent: number
  meetings: number
  deals: number
  createdDate: string
}

interface PendingOutreach {
  id: string
  targetName: string
  targetCompany: string
  channel: string
  subject: string
  preview: string
  campaignName: string
}

interface Deal {
  id: string
  company: string
  service: string
  value: number
  stage: string
  closeDate: string
}

export default function GTMDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [pendingOutreach, setPendingOutreach] = useState<PendingOutreach[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'outreach' | 'deals'>('overview')

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Load pending outreach
      const outreachRes = await fetch('/api/gtm/outreach/pending')
      const outreachData = await outreachRes.json()

      if (outreachData.success) {
        setPendingOutreach(outreachData.pending.slice(0, 5)) // Top 5 for overview
      }

      // Load real deals from Notion
      const dealsRes = await fetch('/api/deals?stats=true')
      const dealsData = await dealsRes.json()

      if (dealsData.success && dealsData.deals.length > 0) {
        // Convert Notion deals to dashboard format
        const realDeals: Deal[] = dealsData.deals.map((d: any) => ({
          id: d.id,
          company: d.buyerCompany,
          service: d.category,
          value: d.dealValue,
          stage: d.status,
          closeDate: d.closeDate
        }))
        setDeals(realDeals)
      } else {
        // Fallback to mock data if no real deals
        const mockDeals: Deal[] = [
          {
            id: '1',
            company: 'TechCorp',
            service: 'Executive Search',
            value: 250000,
            stage: 'Proposal Sent',
            closeDate: '2025-11-15'
          },
          {
            id: '2',
            company: 'HealthSystem Inc',
            service: 'Wells OS',
            value: 5000000,
            stage: 'Meeting Scheduled',
            closeDate: '2025-12-01'
          }
        ]
        setDeals(mockDeals)
      }

      // Mock campaigns (GTM-specific - not in Notion yet)
      const mockCampaigns: Campaign[] = [
        {
          id: '1',
          name: 'Executive Search - Tech Companies',
          serviceOffering: 'Executive Search',
          status: '🟢 Active',
          targetCount: 150,
          outreachSent: 45,
          meetings: 8,
          deals: 2,
          createdDate: '2025-10-15'
        },
        {
          id: '2',
          name: 'Wells OS - Healthcare Systems',
          serviceOffering: 'Wells OS',
          status: '🟢 Active',
          targetCount: 80,
          outreachSent: 30,
          meetings: 5,
          deals: 1,
          createdDate: '2025-10-20'
        },
        {
          id: '3',
          name: 'Onyx Health - Hospitals',
          serviceOffering: 'IDRE Agency',
          status: '⏸️ Paused',
          targetCount: 200,
          outreachSent: 120,
          meetings: 15,
          deals: 3,
          createdDate: '2025-09-10'
        }
      ]
      setCampaigns(mockCampaigns)

    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate stats
  const totalTargets = campaigns.reduce((sum, c) => sum + c.targetCount, 0)
  const totalOutreach = campaigns.reduce((sum, c) => sum + c.outreachSent, 0)
  const totalMeetings = campaigns.reduce((sum, c) => sum + c.meetings, 0)
  const totalDeals = campaigns.reduce((sum, c) => sum + c.deals, 0)
  const totalPipeline = deals.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-[#9ea1a7] hover:text-[#183b6d]">
                ← Back to Wells AI
              </Link>
              <h1 className="text-2xl font-serif text-[#183b6d]">GTM Control Center</h1>
            </div>
            <Link
              href="/gtm"
              className="px-6 py-2 bg-[#dba63f] text-white text-sm rounded-sm hover:bg-[#c89531] transition-all"
            >
              + New Campaign
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-4">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'campaigns', label: 'Campaigns' },
              { key: 'outreach', label: `Outreach (${pendingOutreach.length})` },
              { key: 'deals', label: 'Deals' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'border-[#183b6d] text-[#183b6d]'
                    : 'border-transparent text-[#9ea1a7] hover:text-[#183b6d]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-[#9ea1a7]">Loading GTM data...</div>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-5 gap-4">
                  <div className="border border-[#9ea1a7]/20 rounded-sm p-4 bg-white">
                    <div className="text-sm text-[#9ea1a7] mb-1">Total Targets</div>
                    <div className="text-3xl font-bold text-[#183b6d]">{totalTargets}</div>
                  </div>
                  <div className="border border-[#9ea1a7]/20 rounded-sm p-4 bg-white">
                    <div className="text-sm text-[#9ea1a7] mb-1">Outreach Sent</div>
                    <div className="text-3xl font-bold text-[#183b6d]">{totalOutreach}</div>
                    <div className="text-xs text-[#575757] mt-1">
                      {totalTargets > 0 ? Math.round((totalOutreach / totalTargets) * 100) : 0}% of targets
                    </div>
                  </div>
                  <div className="border border-[#9ea1a7]/20 rounded-sm p-4 bg-white">
                    <div className="text-sm text-[#9ea1a7] mb-1">Meetings Booked</div>
                    <div className="text-3xl font-bold text-[#dba63f]">{totalMeetings}</div>
                    <div className="text-xs text-[#575757] mt-1">
                      {totalOutreach > 0 ? Math.round((totalMeetings / totalOutreach) * 100) : 0}% conversion
                    </div>
                  </div>
                  <div className="border border-[#9ea1a7]/20 rounded-sm p-4 bg-white">
                    <div className="text-sm text-[#9ea1a7] mb-1">Deals Closed</div>
                    <div className="text-3xl font-bold text-[#183b6d]">{totalDeals}</div>
                    <div className="text-xs text-[#575757] mt-1">
                      {totalMeetings > 0 ? Math.round((totalDeals / totalMeetings) * 100) : 0}% close rate
                    </div>
                  </div>
                  <div className="border border-[#dba63f]/40 bg-[#dba63f]/5 rounded-sm p-4">
                    <div className="text-sm text-[#9ea1a7] mb-1">Pipeline Value</div>
                    <div className="text-3xl font-bold text-[#dba63f]">
                      ${(totalPipeline / 1000000).toFixed(1)}M
                    </div>
                  </div>
                </div>

                {/* Pending Outreach Alert */}
                {pendingOutreach.length > 0 && (
                  <div className="border-l-4 border-[#dba63f] bg-[#dba63f]/5 rounded-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-medium text-[#183b6d] mb-1">
                          {pendingOutreach.length} Messages Awaiting Approval
                        </h3>
                        <p className="text-sm text-[#575757]">
                          AI has generated personalized outreach messages that need human review before sending
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('outreach')}
                        className="px-6 py-3 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89531] transition-all"
                      >
                        Review Now →
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Campaigns */}
                <div>
                  <h2 className="text-xl font-serif text-[#183b6d] mb-4">Active Campaigns</h2>
                  <div className="space-y-3">
                    {campaigns.filter(c => c.status === '🟢 Active').map(campaign => (
                      <div
                        key={campaign.id}
                        className="border border-[#9ea1a7]/20 rounded-sm p-5 bg-white hover:border-[#183b6d] transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-medium text-[#183b6d] mb-1">
                              {campaign.name}
                            </h3>
                            <div className="text-sm text-[#575757]">{campaign.serviceOffering}</div>
                          </div>
                          <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full">
                            {campaign.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-[#9ea1a7]">Targets</div>
                            <div className="font-medium text-[#183b6d]">{campaign.targetCount}</div>
                          </div>
                          <div>
                            <div className="text-[#9ea1a7]">Outreach Sent</div>
                            <div className="font-medium text-[#183b6d]">{campaign.outreachSent}</div>
                          </div>
                          <div>
                            <div className="text-[#9ea1a7]">Meetings</div>
                            <div className="font-medium text-[#dba63f]">{campaign.meetings}</div>
                          </div>
                          <div>
                            <div className="text-[#9ea1a7]">Deals</div>
                            <div className="font-medium text-[#183b6d]">{campaign.deals}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Deals */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-serif text-[#183b6d]">Active Deals</h2>
                    <button
                      onClick={() => setActiveTab('deals')}
                      className="text-sm text-[#183b6d] hover:text-[#dba63f]"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {deals.map(deal => (
                      <div
                        key={deal.id}
                        className="border border-[#9ea1a7]/20 rounded-sm p-4 bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-[#183b6d]">{deal.company}</div>
                            <div className="text-sm text-[#575757]">{deal.service}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-[#dba63f]">
                              ${(deal.value / 1000).toLocaleString()}K
                            </div>
                            <div className="text-xs text-[#575757]">{deal.stage}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CAMPAIGNS TAB */}
            {activeTab === 'campaigns' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-serif text-[#183b6d]">All Campaigns</h2>
                  <Link
                    href="/gtm"
                    className="px-6 py-3 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89531] transition-all"
                  >
                    + Launch New Campaign
                  </Link>
                </div>

                {campaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    className="border border-[#9ea1a7]/20 rounded-sm p-6 bg-white"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-medium text-[#183b6d]">
                            {campaign.name}
                          </h3>
                          <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full">
                            {campaign.status}
                          </span>
                        </div>
                        <div className="text-sm text-[#575757]">
                          {campaign.serviceOffering} • Created {new Date(campaign.createdDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all text-sm">
                          View Details
                        </button>
                        <button className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all text-sm">
                          {campaign.status === '🟢 Active' ? 'Pause' : 'Resume'}
                        </button>
                      </div>
                    </div>

                    {/* Campaign Funnel */}
                    <div className="grid grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-[#183b6d] mb-1">
                          {campaign.targetCount}
                        </div>
                        <div className="text-xs text-[#9ea1a7]">Targets</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-[#183b6d] mb-1">
                          {campaign.outreachSent}
                        </div>
                        <div className="text-xs text-[#9ea1a7]">Outreach Sent</div>
                        <div className="text-xs text-[#575757] mt-1">
                          {Math.round((campaign.outreachSent / campaign.targetCount) * 100)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-[#dba63f] mb-1">
                          {campaign.meetings}
                        </div>
                        <div className="text-xs text-[#9ea1a7]">Meetings</div>
                        <div className="text-xs text-[#575757] mt-1">
                          {campaign.outreachSent > 0 ? Math.round((campaign.meetings / campaign.outreachSent) * 100) : 0}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-[#183b6d] mb-1">
                          {campaign.deals}
                        </div>
                        <div className="text-xs text-[#9ea1a7]">Deals</div>
                        <div className="text-xs text-[#575757] mt-1">
                          {campaign.meetings > 0 ? Math.round((campaign.deals / campaign.meetings) * 100) : 0}%
                        </div>
                      </div>
                      <div className="text-center border-l border-[#9ea1a7]/20 pl-4">
                        <div className="text-2xl font-bold text-[#dba63f] mb-1">
                          {campaign.meetings > 0 ? Math.round((campaign.deals / campaign.targetCount) * 100) : 0}%
                        </div>
                        <div className="text-xs text-[#9ea1a7]">Overall Conversion</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* OUTREACH TAB */}
            {activeTab === 'outreach' && (
              <div className="space-y-4">
                <div className="mb-6">
                  <h2 className="text-2xl font-serif text-[#183b6d] mb-2">
                    Pending Outreach Approvals
                  </h2>
                  <p className="text-sm text-[#575757]">
                    Review AI-generated messages before they're sent to prospects
                  </p>
                </div>

                {pendingOutreach.length === 0 ? (
                  <div className="text-center py-12 border border-[#9ea1a7]/20 rounded-sm bg-white">
                    <div className="text-[#9ea1a7] mb-2">No pending outreach</div>
                    <div className="text-sm text-[#575757]">
                      All generated messages have been approved or rejected
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingOutreach.map(outreach => (
                      <div
                        key={outreach.id}
                        className="border border-[#9ea1a7]/20 rounded-sm p-6 bg-white"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-medium text-[#183b6d]">
                                {outreach.targetName}
                              </h3>
                              <span className="text-xs px-2 py-1 bg-[#9ea1a7]/10 text-[#575757] rounded">
                                {outreach.channel}
                              </span>
                            </div>
                            <div className="text-sm text-[#575757] mb-3">
                              {outreach.targetCompany} • {outreach.campaignName}
                            </div>
                            {outreach.subject && (
                              <div className="text-sm mb-2">
                                <span className="text-[#9ea1a7]">Subject:</span>{' '}
                                <span className="text-[#183b6d] font-medium">{outreach.subject}</span>
                              </div>
                            )}
                            <div className="text-sm text-[#575757] bg-[#183b6d]/5 p-4 rounded-sm">
                              {outreach.preview}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-[#9ea1a7]/20">
                          <button className="px-6 py-3 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89531] transition-all">
                            ✓ Approve & Send
                          </button>
                          <button className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all">
                            ↻ Regenerate
                          </button>
                          <button className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-red-300 hover:text-red-600 transition-all">
                            ✕ Reject
                          </button>
                          <Link
                            href={`/gtm/approve?messageId=${outreach.id}`}
                            className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all"
                          >
                            View Full Details →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DEALS TAB */}
            {activeTab === 'deals' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-serif text-[#183b6d]">Deal Pipeline</h2>
                  <div className="text-right">
                    <div className="text-sm text-[#9ea1a7]">Total Pipeline Value</div>
                    <div className="text-2xl font-bold text-[#dba63f]">
                      ${(totalPipeline / 1000000).toFixed(1)}M
                    </div>
                  </div>
                </div>

                {/* Pipeline Stages */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {[
                    { stage: 'Meeting Scheduled', count: 5, color: '#183b6d' },
                    { stage: 'Proposal Sent', count: 3, color: '#dba63f' },
                    { stage: 'Negotiation', count: 2, color: '#dba63f' },
                    { stage: 'Closed Won', count: 2, color: '#22c55e' }
                  ].map(({ stage, count, color }) => (
                    <div key={stage} className="border border-[#9ea1a7]/20 rounded-sm p-4 bg-white">
                      <div className="text-sm text-[#9ea1a7] mb-1">{stage}</div>
                      <div className="text-3xl font-bold" style={{ color }}>{count}</div>
                    </div>
                  ))}
                </div>

                {/* Deals List */}
                <div className="space-y-3">
                  {deals.map(deal => (
                    <div
                      key={deal.id}
                      className="border border-[#9ea1a7]/20 rounded-sm p-5 bg-white hover:border-[#183b6d] transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-medium text-[#183b6d] mb-1">
                            {deal.company}
                          </h3>
                          <div className="text-sm text-[#575757]">{deal.service}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[#dba63f] mb-1">
                            ${(deal.value / 1000).toLocaleString()}K
                          </div>
                          <div className="text-xs px-3 py-1 bg-[#dba63f]/10 text-[#dba63f] rounded-full inline-block">
                            {deal.stage}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm pt-3 border-t border-[#9ea1a7]/20">
                        <div className="text-[#9ea1a7]">
                          Expected Close: {new Date(deal.closeDate).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2">
                          <button className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all text-sm">
                            View Details
                          </button>
                          <button className="px-4 py-2 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545] transition-all text-sm">
                            Update Stage
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
