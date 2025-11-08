'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { BarChart3, Users, Mail, Calendar, TrendingUp, Eye, MousePointerClick } from 'lucide-react'

interface Campaign {
  id: string
  campaignId: string
  practiceGroupName: string
  status: string
  prospectCount: number
  messageCount: number
  sentCount: number
  createdAt: string
  practiceGroupData?: {
    icp?: any
    value_prop?: string
  }
}

interface CampaignStats {
  totalCampaigns: number
  totalLeads: number
  totalSent: number
  activeNow: number
}

export default function CampaignsDashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stats, setStats] = useState<CampaignStats>({
    totalCampaigns: 0,
    totalLeads: 0,
    totalSent: 0,
    activeNow: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in')
    } else if (user) {
      loadCampaigns()
    }
  }, [isLoaded, user])

  async function loadCampaigns() {
    try {
      const response = await fetch('/api/campaigns/list')
      if (!response.ok) throw new Error('Failed to load campaigns')

      const data = await response.json()
      setCampaigns(data.campaigns || [])

      // Calculate stats
      const totalCampaigns = data.campaigns?.length || 0
      const totalLeads = data.campaigns?.reduce((sum: number, c: Campaign) => sum + c.prospectCount, 0) || 0
      const totalSent = data.campaigns?.reduce((sum: number, c: Campaign) => sum + c.sentCount, 0) || 0
      const activeNow = data.campaigns?.filter((c: Campaign) => c.status === 'ACTIVE').length || 0

      setStats({ totalCampaigns, totalLeads, totalSent, activeNow })
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Campaign Analytics</h1>
              <p className="text-gray-400 mt-1">Track your GTM performance</p>
            </div>
            <button
              onClick={() => router.push('/app')}
              className="px-6 py-3 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition"
            >
              Launch New Campaign
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 className="w-8 h-8 text-amber-500" />
              <span className="text-2xl font-bold">{stats.totalCampaigns}</span>
            </div>
            <div className="text-gray-400 text-sm">Total Campaigns</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold">{stats.totalLeads}</span>
            </div>
            <div className="text-gray-400 text-sm">Total Leads Found</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Mail className="w-8 h-8 text-green-500" />
              <span className="text-2xl font-bold">{stats.totalSent}</span>
            </div>
            <div className="text-gray-400 text-sm">Emails Sent</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold">{stats.activeNow}</span>
            </div>
            <div className="text-gray-400 text-sm">Active Now</div>
          </div>
        </div>

        {/* Campaigns List */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold">Your Campaigns</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
              Loading campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
              <p className="text-gray-400 mb-6">Launch your first GTM campaign with Wells</p>
              <button
                onClick={() => router.push('/app')}
                className="px-6 py-3 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition"
              >
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="p-6 hover:bg-gray-800/50 transition cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">
                        {campaign.practiceGroupName}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {campaign.practiceGroupData?.value_prop || 'No value prop set'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      campaign.status === 'ACTIVE'
                        ? 'bg-green-500/20 text-green-400'
                        : campaign.status === 'DRAFT'
                        ? 'bg-gray-500/20 text-gray-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-2xl font-bold text-amber-500">{campaign.prospectCount}</div>
                      <div className="text-xs text-gray-400">Leads Found</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-500">{campaign.sentCount}</div>
                      <div className="text-xs text-gray-400">Emails Sent</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-500">
                        {campaign.sentCount > 0 ? Math.round((campaign.sentCount / campaign.prospectCount) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-400">Coverage</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </span>
                    <span>Campaign ID: {campaign.campaignId}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coming Soon Section */}
        <div className="mt-8 bg-gradient-to-br from-amber-900/20 to-amber-800/20 rounded-xl p-8 border border-amber-700/30">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-amber-500" />
            Coming Soon
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <Eye className="w-8 h-8 text-amber-500 mb-2" />
              <h4 className="font-semibold mb-1">Open Rates</h4>
              <p className="text-sm text-gray-400">Track who's reading your emails</p>
            </div>
            <div>
              <MousePointerClick className="w-8 h-8 text-amber-500 mb-2" />
              <h4 className="font-semibold mb-1">Click Tracking</h4>
              <p className="text-sm text-gray-400">See which links get clicked</p>
            </div>
            <div>
              <Mail className="w-8 h-8 text-amber-500 mb-2" />
              <h4 className="font-semibold mb-1">Response Handling</h4>
              <p className="text-sm text-gray-400">Auto-parse replies and schedule meetings</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
