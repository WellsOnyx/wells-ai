'use client'

/**
 * Deal Detail Page
 *
 * Full view of a single B2B deal with actions, timeline, and messages
 * "Yes, proceed" = deal done, money escrowed, everyone wins
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  ArrowLeft,
  Handshake,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  AlertTriangle,
  XCircle,
  Send,
  MessageSquare,
  FileText,
  Shield,
  Zap,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react'
import { DealFlow } from '@/components/deals/DealFlow'
import { B2BDeal, DealStatus } from '@/lib/deals/types'

// Status configuration
const STATUS_CONFIG: Record<DealStatus, {
  label: string
  color: string
  bgColor: string
  icon: React.ElementType
}> = {
  proposed: { label: 'Proposed', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: Clock },
  accepted: { label: 'Accepted', color: 'text-purple-400', bgColor: 'bg-purple-500/20', icon: CheckCircle2 },
  funded: { label: 'Funded', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: DollarSign },
  delivered: { label: 'Delivered', color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: Package },
  completed: { label: 'Completed', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: CheckCircle2 },
  disputed: { label: 'Disputed', color: 'text-red-400', bgColor: 'bg-red-500/20', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: XCircle },
  refunded: { label: 'Refunded', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: XCircle },
}

interface DealMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  createdAt: string
}

interface DealEvent {
  id: string
  type: string
  description: string
  createdAt: string
  metadata?: any
}

export default function DealDetailPage() {
  const { user, isLoaded } = useUser()
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  // State
  const [deal, setDeal] = useState<B2BDeal | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [messages, setMessages] = useState<DealMessage[]>([])
  const [events, setEvents] = useState<DealEvent[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'messages' | 'timeline'>('details')
  const [copied, setCopied] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch deal
  useEffect(() => {
    fetchDeal()
  }, [dealId])

  // Auto-scroll messages
  useEffect(() => {
    if (activeTab === 'messages') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeTab])

  async function fetchDeal() {
    setLoading(true)
    try {
      const res = await fetch(`/api/b2b/${dealId}`)
      if (res.ok) {
        const data = await res.json()
        setDeal(data.deal)
        setMessages(data.messages || [])
        setEvents(data.events || [])
      } else if (res.status === 404) {
        router.push('/deals')
      }
    } catch (err) {
      console.error('Failed to fetch deal:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action: string) {
    if (!deal) return
    setActionLoading(action)

    try {
      const res = await fetch(`/api/b2b/${deal.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (res.ok) {
        await fetchDeal()
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    } finally {
      setActionLoading(null)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !deal) return
    setSendingMessage(true)

    try {
      const res = await fetch(`/api/b2b/${deal.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      })

      if (res.ok) {
        setNewMessage('')
        await fetchDeal()
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSendingMessage(false)
    }
  }

  function copyDealId() {
    if (deal) {
      navigator.clipboard.writeText(deal.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Determine user role (would normally check against user ID)
  const getUserRole = (): 'buyer' | 'seller' => {
    // For now, assume buyer - in production, compare user.id with deal.buyerId/sellerId
    return 'buyer'
  }

  const userRole = deal ? getUserRole() : 'buyer'
  const statusConfig = deal ? STATUS_CONFIG[deal.status] : STATUS_CONFIG.proposed
  const StatusIcon = statusConfig.icon

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Handshake className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Deal not found</h2>
          <p className="text-gray-500 mb-6">This deal may have been removed or doesn't exist.</p>
          <Link
            href="/deals"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Deals
          </Link>
        </div>
      </div>
    )
  }

  // Determine available actions
  const getActions = () => {
    const actions: { label: string; action: string; primary?: boolean; icon: React.ElementType }[] = []

    if (deal.status === 'proposed') {
      const needsConfirmation = userRole === 'buyer' ? !deal.buyerConfirmed : !deal.sellerConfirmed
      if (needsConfirmation) {
        actions.push({ label: 'Yes, Proceed', action: 'confirm', primary: true, icon: CheckCircle2 })
      }
    }

    if (deal.status === 'accepted' && userRole === 'buyer' && !deal.escrowFunded) {
      actions.push({ label: 'Fund Escrow', action: 'fund', primary: true, icon: DollarSign })
    }

    if (deal.status === 'funded' && userRole === 'seller') {
      actions.push({ label: 'Mark Delivered', action: 'deliver', primary: true, icon: Package })
    }

    if (deal.status === 'delivered' && userRole === 'buyer') {
      actions.push({ label: 'Release Funds', action: 'release', primary: true, icon: Zap })
    }

    return actions
  }

  const actions = getActions()

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/deals"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Deals</span>
            </Link>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 ${statusConfig.bgColor} rounded-lg flex items-center justify-center`}>
                <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
              </div>
              <span className={`text-sm font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={copyDealId}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 text-sm transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              <span className="font-mono text-xs">{deal.id.slice(0, 8)}...</span>
            </button>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                }
              }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Deal Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">{deal.title}</h1>
          {deal.description && (
            <p className="text-gray-400 mb-4">{deal.description}</p>
          )}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-2xl font-bold text-white">${deal.amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Created {new Date(deal.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Deal Flow Progress */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Deal Progress</h3>
              <DealFlow deal={deal} userRole={userRole} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg w-fit">
              {(['details', 'messages', 'timeline'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-md text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'bg-purple-600 text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-sm text-gray-500 mb-1">Buyer</p>
                    <p className="text-white font-medium">{deal.buyerId}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {deal.buyerConfirmed ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> Confirmed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-sm text-gray-500 mb-1">Seller</p>
                    <p className="text-white font-medium">{deal.sellerId}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {deal.sellerConfirmed ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> Confirmed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Deal Terms</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-sm text-gray-500">Payment Terms</span>
                      <span className="text-sm text-white capitalize">{deal.paymentTerms}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-sm text-gray-500">Payment Method</span>
                      <span className="text-sm text-white capitalize">{deal.paymentMethod}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-sm text-gray-500">Delivery</span>
                      <span className="text-sm text-white capitalize">{deal.deliveryType}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-sm text-gray-500">Escrow</span>
                      <span className={`text-sm ${deal.escrowFunded ? 'text-green-400' : 'text-gray-400'}`}>
                        {deal.escrowFunded ? 'Funded' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                {deal.autoRelease && (
                  <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <Shield className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm text-white">Auto-release enabled</p>
                      <p className="text-xs text-gray-500">
                        Funds will auto-release {deal.autoReleaseDays} days after delivery if no dispute
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="h-80 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500">No messages yet</p>
                      <p className="text-sm text-gray-600">Start a conversation about this deal</p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                            msg.senderId === user?.id
                              ? 'bg-purple-600 text-white rounded-br-md'
                              : 'bg-white/10 text-white rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs opacity-60 mt-1">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-white/10 p-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl transition-colors"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                {events.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">No events yet</p>
                    <p className="text-sm text-gray-600">Deal activity will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((event, i) => (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 bg-purple-500 rounded-full" />
                          {i < events.length - 1 && (
                            <div className="w-px h-full bg-white/10 my-1" />
                          )}
                        </div>
                        <div className="pb-4">
                          <p className="text-white text-sm">{event.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(event.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Primary Actions */}
            {actions.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-medium text-gray-400 mb-4">Actions</h3>
                <div className="space-y-3">
                  {actions.map(({ label, action, primary, icon: Icon }) => (
                    <button
                      key={action}
                      onClick={() => handleAction(action)}
                      disabled={actionLoading === action}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
                        primary
                          ? 'bg-green-600 hover:bg-green-500 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {actionLoading === action ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Icon className="w-4 h-4" />
                          {label}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Deal Summary */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="text-white font-semibold">${deal.amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Platform Fee (1%)</span>
                  <span className="text-gray-400">${(deal.amount * 0.01).toLocaleString()}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                  <span className="text-gray-500">Net to Seller</span>
                  <span className="text-green-400 font-semibold">
                    ${(deal.amount * 0.99).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Your Role */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Your Role</h3>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  userRole === 'buyer' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                }`}>
                  {userRole === 'buyer' ? (
                    <DollarSign className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Package className="w-5 h-5 text-purple-400" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium capitalize">{userRole}</p>
                  <p className="text-xs text-gray-500">
                    {userRole === 'buyer' ? 'You are purchasing' : 'You are selling'}
                  </p>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/20 border border-purple-500/20 rounded-2xl p-5">
              <h3 className="text-sm font-medium text-purple-400 mb-2">Need Help?</h3>
              <p className="text-sm text-gray-400 mb-4">
                Questions about this deal? Our support team is here 24/7.
              </p>
              <Link
                href="/chat"
                className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                Chat with Support <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
