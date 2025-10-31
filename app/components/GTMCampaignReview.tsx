'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  channel: 'email' | 'sms' | 'linkedin'
  prospectName: string
  prospectEmail?: string
  prospectPhone?: string
  prospectLinkedIn?: string
  subject?: string
  body: string
  canSend: boolean
  blockReason?: string
  approved: boolean
}

interface Prospect {
  id: string
  name: string
  title: string
  company: string
  email?: string
  phone?: string
  linkedIn?: string
  matchScore: number
}

interface Campaign {
  id: string
  userRequest: string
  prospects: Prospect[]
  messages: Message[]
  icp: {
    industry: string[]
    companySize: string
    titles: string[]
    geography: string[]
  }
  usingWellsStack: boolean
  status: 'draft' | 'sent'
  createdAt: string
}

interface GTMCampaignReviewProps {
  campaign: Campaign
  onApprove?: () => void
  onCancel?: () => void
}

export default function GTMCampaignReview({
  campaign,
  onApprove,
  onCancel
}: GTMCampaignReviewProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'emails' | 'linkedin' | 'sms'>('overview')
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const router = useRouter()

  const emailMessages = campaign.messages.filter(m => m.channel === 'email')
  const linkedinMessages = campaign.messages.filter(m => m.channel === 'linkedin')
  const smsMessages = campaign.messages.filter(m => m.channel === 'sms')
  const allowedSMS = smsMessages.filter(m => m.canSend)
  const blockedSMS = smsMessages.filter(m => !m.canSend)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      const response = await fetch(`/api/gtm/campaign/${campaign.id}/approve`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve campaign')
      }

      if (onApprove) {
        onApprove()
      } else {
        // Redirect to success page or show success message
        alert(`Campaign sent! ${data.result.sent} messages delivered.`)
        router.push('/')
      }
    } catch (error: any) {
      console.error('Error approving campaign:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsApproving(false)
      setShowConfirmModal(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-serif text-[#183b6d] mb-2">Campaign Review</h1>
              <p className="text-sm text-[#575757]">{campaign.userRequest}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => onCancel ? onCancel() : router.back()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={isApproving}
                className="px-6 py-2 bg-[#dba63f] text-white font-medium rounded-sm hover:bg-[#c89430] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? 'Sending...' : 'Approve & Send'}
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 rounded-sm p-4">
              <div className="text-2xl font-bold text-[#183b6d]">{campaign.prospects.length}</div>
              <div className="text-xs text-[#575757] mt-1">Prospects</div>
            </div>
            <div className="bg-gray-50 rounded-sm p-4">
              <div className="text-2xl font-bold text-green-600">{emailMessages.length}</div>
              <div className="text-xs text-[#575757] mt-1">Emails Ready</div>
            </div>
            <div className="bg-gray-50 rounded-sm p-4">
              <div className="text-2xl font-bold text-blue-600">{linkedinMessages.length}</div>
              <div className="text-xs text-[#575757] mt-1">LinkedIn Drafts</div>
            </div>
            <div className="bg-gray-50 rounded-sm p-4">
              <div className="text-2xl font-bold text-orange-600">{allowedSMS.length}</div>
              <div className="text-xs text-[#575757] mt-1">SMS Allowed</div>
            </div>
          </div>

          {/* Using Wells Stack Badge */}
          {campaign.usingWellsStack && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[#dba63f]/10 border border-[#dba63f]/20 rounded-sm">
              <svg className="w-4 h-4 text-[#dba63f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium text-[#dba63f]">Using Wells AI GTM Stack</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex gap-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'border-[#183b6d] text-[#183b6d]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('emails')}
                className={`py-4 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === 'emails'
                    ? 'border-[#183b6d] text-[#183b6d]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Emails ({emailMessages.length})
              </button>
              <button
                onClick={() => setActiveTab('linkedin')}
                className={`py-4 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === 'linkedin'
                    ? 'border-[#183b6d] text-[#183b6d]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                LinkedIn ({linkedinMessages.length})
              </button>
              <button
                onClick={() => setActiveTab('sms')}
                className={`py-4 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === 'sms'
                    ? 'border-[#183b6d] text-[#183b6d]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                SMS ({allowedSMS.length}/{smsMessages.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-[#183b6d] mb-3">Ideal Customer Profile</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-sm p-4">
                      <div className="text-xs text-[#575757] mb-2">Industries</div>
                      <div className="flex flex-wrap gap-2">
                        {campaign.icp.industry.map((ind, i) => (
                          <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded-sm text-xs">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-sm p-4">
                      <div className="text-xs text-[#575757] mb-2">Company Size</div>
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded-sm text-xs">
                        {campaign.icp.companySize}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-sm p-4">
                      <div className="text-xs text-[#575757] mb-2">Target Titles</div>
                      <div className="flex flex-wrap gap-2">
                        {campaign.icp.titles.map((title, i) => (
                          <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded-sm text-xs">
                            {title}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-sm p-4">
                      <div className="text-xs text-[#575757] mb-2">Geography</div>
                      <div className="flex flex-wrap gap-2">
                        {campaign.icp.geography.map((geo, i) => (
                          <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded-sm text-xs">
                            {geo}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-[#183b6d] mb-3">Top Prospects</h3>
                  <div className="space-y-2">
                    {campaign.prospects.slice(0, 5).map((prospect) => (
                      <div key={prospect.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-sm">
                        <div>
                          <div className="font-medium text-sm text-[#183b6d]">{prospect.name}</div>
                          <div className="text-xs text-[#575757]">{prospect.title} at {prospect.company}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-[#575757]">Match: {Math.round(prospect.matchScore * 100)}%</div>
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${prospect.matchScore * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Emails Tab */}
            {activeTab === 'emails' && (
              <div className="space-y-4">
                {emailMessages.map((message) => (
                  <div key={message.id} className="border border-gray-200 rounded-sm p-4 hover:border-[#183b6d] transition-colors cursor-pointer"
                    onClick={() => setSelectedMessage(message)}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-medium text-sm text-[#183b6d]">{message.prospectName}</div>
                        <div className="text-xs text-[#575757]">{message.prospectEmail}</div>
                      </div>
                      <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-sm">Ready to Send</span>
                    </div>
                    <div className="text-sm text-[#183b6d] font-medium mb-2">Subject: {message.subject}</div>
                    <div className="text-sm text-[#575757] line-clamp-3">{message.body}</div>
                  </div>
                ))}
              </div>
            )}

            {/* LinkedIn Tab */}
            {activeTab === 'linkedin' && (
              <div>
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-sm">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-900">
                      <div className="font-medium mb-1">Manual Send Required</div>
                      <div className="text-blue-700">LinkedIn messages must be sent manually from your account to comply with their Terms of Service. Copy the message and paste it into LinkedIn.</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {linkedinMessages.map((message) => (
                    <div key={message.id} className="border border-gray-200 rounded-sm p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-medium text-sm text-[#183b6d]">{message.prospectName}</div>
                          <div className="text-xs text-[#575757]">{message.prospectLinkedIn}</div>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(message.body)
                            alert('Message copied to clipboard!')
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-sm hover:bg-blue-700 transition-colors"
                        >
                          Copy Message
                        </button>
                      </div>
                      <div className="text-sm text-[#575757] whitespace-pre-wrap">{message.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SMS Tab */}
            {activeTab === 'sms' && (
              <div className="space-y-6">
                {allowedSMS.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-green-600 mb-3">Allowed SMS ({allowedSMS.length})</h3>
                    <div className="space-y-4">
                      {allowedSMS.map((message) => (
                        <div key={message.id} className="border border-green-200 rounded-sm p-4 bg-green-50">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-medium text-sm text-[#183b6d]">{message.prospectName}</div>
                              <div className="text-xs text-[#575757]">{message.prospectPhone}</div>
                            </div>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-sm">Will Send</span>
                          </div>
                          <div className="text-sm text-[#575757]">{message.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {blockedSMS.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-red-600 mb-3">Blocked SMS ({blockedSMS.length})</h3>
                    <div className="space-y-4">
                      {blockedSMS.map((message) => (
                        <div key={message.id} className="border border-red-200 rounded-sm p-4 bg-red-50">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-medium text-sm text-[#183b6d]">{message.prospectName}</div>
                              <div className="text-xs text-[#575757]">{message.prospectPhone}</div>
                            </div>
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-sm">Blocked</span>
                          </div>
                          <div className="text-sm text-red-700 font-medium mb-2">Reason: {message.blockReason}</div>
                          <div className="text-sm text-[#575757]">{message.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {smsMessages.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No SMS messages in this campaign
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-serif text-[#183b6d] mb-4">Confirm Campaign Send</h3>
            <p className="text-sm text-[#575757] mb-6">
              You're about to send:
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span><strong>{emailMessages.length}</strong> emails via {campaign.usingWellsStack ? 'Wells AI' : 'your Instantly account'}</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span><strong>{linkedinMessages.length}</strong> LinkedIn drafts (manual send)</span>
              </li>
              {allowedSMS.length > 0 && (
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  <span><strong>{allowedSMS.length}</strong> SMS messages</span>
                </li>
              )}
            </ul>
            <p className="text-xs text-[#575757] mb-6 italic">
              Once sent, emails cannot be recalled. Make sure you've reviewed all messages.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isApproving}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1 px-4 py-2 bg-[#dba63f] text-white font-medium rounded-sm hover:bg-[#c89430] transition-colors disabled:opacity-50"
              >
                {isApproving ? 'Sending...' : 'Yes, Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMessage(null)}>
          <div className="bg-white rounded-sm shadow-xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-[#183b6d]">{selectedMessage.prospectName}</h3>
                <p className="text-sm text-[#575757]">{selectedMessage.prospectEmail}</p>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <div className="mb-4">
                <div className="text-xs text-[#575757] mb-1">Subject</div>
                <div className="text-sm font-medium text-[#183b6d]">{selectedMessage.subject}</div>
              </div>
              <div>
                <div className="text-xs text-[#575757] mb-1">Body</div>
                <div className="text-sm text-[#575757] whitespace-pre-wrap">{selectedMessage.body}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
