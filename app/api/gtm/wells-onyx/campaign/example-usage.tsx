/**
 * Wells Onyx Campaign API - Usage Example
 *
 * This is a React component demonstrating how to use the Wells Onyx Campaign API
 * in a frontend application.
 */

'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'

interface Message {
  prospectEmail: string
  channel: string
  subject?: string
  body: string
  approved: boolean
  sent?: boolean
}

interface Campaign {
  campaignId: string
  practiceGroup: string
  status: string
  prospects: number
  messages: Message[]
  approvedCount: number
  sentCount: number
}

export default function WellsOnyxCampaignExample() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Create Campaign
  const createCampaign = async (practiceGroupId: string) => {
    setLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const response = await fetch('/api/gtm/wells-onyx/campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          practiceGroupId,
          targetCount: 25,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create campaign')
      }

      const data = await response.json()
      setCampaign({
        campaignId: data.campaignId,
        practiceGroup: data.practiceGroup,
        status: data.status,
        prospects: data.prospects,
        messages: data.messages,
        approvedCount: 0,
        sentCount: 0,
      })

      console.log('✅ Campaign created:', data.campaignId)
      console.log(`📊 Generated ${data.messages.length} personalized messages`)
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Approve Single Message
  const approveMessage = async (messageIndex: number) => {
    if (!campaign) return

    setLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const response = await fetch('/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId: campaign.campaignId,
          action: 'approve_message',
          messageIndex,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to approve message')
      }

      const data = await response.json()

      // Update local state
      const updatedMessages = [...campaign.messages]
      updatedMessages[messageIndex].approved = true

      setCampaign({
        ...campaign,
        messages: updatedMessages,
        approvedCount: data.approvedCount,
      })

      console.log(`✅ Message ${messageIndex} approved`)
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Approve All Messages
  const approveAllMessages = async () => {
    if (!campaign) return

    setLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const response = await fetch('/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId: campaign.campaignId,
          action: 'approve_all',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to approve all messages')
      }

      const data = await response.json()

      // Update local state
      const updatedMessages = campaign.messages.map(m => ({ ...m, approved: true }))

      setCampaign({
        ...campaign,
        messages: updatedMessages,
        approvedCount: data.approvedCount,
        status: data.status,
      })

      console.log(`✅ All ${data.approvedCount} messages approved`)
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Step 4: Send Campaign
  const sendCampaign = async () => {
    if (!campaign) return

    setLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const response = await fetch('/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId: campaign.campaignId,
          action: 'send',
          // Optional: provide Instantly API key
          // instantlyApiKey: 'your-api-key',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send campaign')
      }

      const data = await response.json()

      setCampaign({
        ...campaign,
        status: data.status,
        sentCount: data.sent,
      })

      console.log(`✅ Campaign sent successfully!`)
      console.log(`📧 Sent: ${data.sent} messages`)
      console.log(`❌ Failed: ${data.failed} messages`)
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Campaign Status
  const fetchCampaignStatus = async (campaignId: string) => {
    setLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const response = await fetch(
        `/api/gtm/wells-onyx/campaign?campaignId=${campaignId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch campaign')
      }

      const data = await response.json()
      setCampaign({
        campaignId: data.campaignId,
        practiceGroup: data.practiceGroup,
        status: data.status,
        prospects: data.prospects,
        messages: data.messages,
        approvedCount: data.approvedCount,
        sentCount: data.sentCount,
      })

      console.log('✅ Campaign loaded:', data.campaignId)
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Wells Onyx Campaign Manager</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!campaign && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Create New Campaign</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => createCampaign('cybersecurity')}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Cybersecurity Practice
            </button>
            <button
              onClick={() => createCampaign('fintech')}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Fintech Practice
            </button>
            <button
              onClick={() => createCampaign('aerospace')}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              Aerospace Practice
            </button>
            <button
              onClick={() => createCampaign('healthcare')}
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Healthcare Practice
            </button>
            <button
              onClick={() => createCampaign('saas')}
              disabled={loading}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              SaaS Practice
            </button>
          </div>
        </div>
      )}

      {campaign && (
        <div className="space-y-6">
          {/* Campaign Info */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">{campaign.practiceGroup}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Campaign ID:</span>
                <span className="ml-2 font-mono">{campaign.campaignId}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2 font-semibold uppercase">{campaign.status}</span>
              </div>
              <div>
                <span className="text-gray-600">Prospects:</span>
                <span className="ml-2">{campaign.prospects}</span>
              </div>
              <div>
                <span className="text-gray-600">Approved:</span>
                <span className="ml-2">
                  {campaign.approvedCount} / {campaign.messages.length}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={approveAllMessages}
              disabled={loading || campaign.status === 'sent'}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Approve All Messages
            </button>
            <button
              onClick={sendCampaign}
              disabled={loading || campaign.approvedCount === 0 || campaign.status === 'sent'}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Send Campaign
            </button>
            <button
              onClick={() => setCampaign(null)}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Start Over
            </button>
          </div>

          {/* Messages */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Messages ({campaign.messages.length})</h3>
            <div className="space-y-3">
              {campaign.messages.map((message, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    message.approved ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm text-gray-600">To: {message.prospectEmail}</div>
                      {message.subject && (
                        <div className="font-semibold mt-1">Subject: {message.subject}</div>
                      )}
                    </div>
                    {!message.approved && campaign.status !== 'sent' && (
                      <button
                        onClick={() => approveMessage(index)}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    {message.approved && (
                      <span className="px-3 py-1 bg-green-600 text-white text-sm rounded">
                        ✓ Approved
                      </span>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap text-gray-700 mt-2">
                    {message.body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-center">Loading...</p>
          </div>
        </div>
      )}
    </div>
  )
}
