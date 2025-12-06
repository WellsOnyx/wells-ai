'use client'

/**
 * Unified Wells AI Dashboard
 *
 * Combines:
 * - AI Chat interface for direct Wells AI conversations
 * - Unified Inbox with multi-channel support
 * - Channel selector for sending via any connected channel
 * - Conversation threads from all sources
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Loader2,
  Rocket,
  ShoppingCart,
  Store,
  Briefcase,
  TrendingUp,
  CheckCircle,
  Clock,
  Sparkles,
  Settings,
  Bell,
  ChevronRight,
  Inbox,
  MessageSquare,
  ChevronDown,
  Phone,
  Mail,
  User,
  Building,
  Archive,
  RefreshCw,
  X,
  Check,
  Search,
  Filter
} from 'lucide-react'

type Journey = 'founder' | 'buyer' | 'seller' | 'jobs' | undefined
type Channel = 'sms' | 'imessage' | 'gmail' | 'outlook' | 'email' | 'slack' | 'discord' | 'twitter' | 'instagram' | 'linkedin' | 'whatsapp' | 'chat' | 'teams' | 'telegram'
type ViewMode = 'ai' | 'inbox'

interface Message {
  role: 'user' | 'assistant'
  content: string
  channel?: Channel
}

interface InboxConversation {
  id: string
  contact_id: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  contact_company?: string
  channel: Channel
  status: 'open' | 'pending' | 'resolved' | 'archived'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  unread_count: number
  last_message_at: string
  last_message_preview?: string
}

interface InboxMessage {
  id: string
  content: string
  direction: 'inbound' | 'outbound'
  sender_type: 'contact' | 'user' | 'ai' | 'system'
  sender_name?: string
  channel: string
  ai_generated: boolean
  status: string
  created_at: string
}

// Channel display info
const CHANNEL_INFO: Record<Channel, { name: string; icon: string; color: string; bgColor: string }> = {
  sms: { name: 'SMS', icon: '💬', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  imessage: { name: 'iMessage', icon: '🍎', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  gmail: { name: 'Gmail', icon: '📧', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  outlook: { name: 'Outlook', icon: '📨', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  email: { name: 'Email', icon: '✉️', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  slack: { name: 'Slack', icon: '💼', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  discord: { name: 'Discord', icon: '🎮', color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  twitter: { name: 'X', icon: '𝕏', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  instagram: { name: 'Instagram', icon: '📷', color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
  linkedin: { name: 'LinkedIn', icon: '💼', color: 'text-sky-400', bgColor: 'bg-sky-500/20' },
  whatsapp: { name: 'WhatsApp', icon: '📱', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  chat: { name: 'Website', icon: '💻', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  teams: { name: 'Teams', icon: '👥', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  telegram: { name: 'Telegram', icon: '✈️', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
}

const JOURNEY_CONFIG = {
  founder: {
    title: 'Founder Mode',
    icon: Rocket,
    color: 'gold',
    gradient: 'from-gold-400 to-gold-600',
    placeholder: "I need to hire a CTO...",
    greeting: "I'm ready to help you build. Need talent, customers, or funding?",
    quickActions: [
      { label: 'Hire Talent', prompt: 'I need to hire for my startup' },
      { label: 'Find Customers', prompt: 'I need to find customers for my product' },
      { label: 'Source Suppliers', prompt: 'I need to source suppliers' },
    ]
  },
  buyer: {
    title: 'Buyer Mode',
    icon: ShoppingCart,
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-600',
    placeholder: "I need to source 10,000 units of...",
    greeting: "I'm ready to source. What products or services do you need?",
    quickActions: [
      { label: 'Get Quotes', prompt: 'I need quotes for bulk materials' },
      { label: 'Find Suppliers', prompt: 'Help me find verified suppliers' },
      { label: 'Compare Options', prompt: 'Compare suppliers for me' },
    ]
  },
  seller: {
    title: 'Seller Mode',
    icon: Store,
    color: 'green',
    gradient: 'from-green-500 to-emerald-600',
    placeholder: "I want to sell to companies looking for...",
    greeting: "I'm ready to find you customers. What do you sell?",
    quickActions: [
      { label: 'Find Leads', prompt: 'Find me qualified buyers' },
      { label: 'List Products', prompt: 'List my products to buyers' },
      { label: 'View Opportunities', prompt: 'Show me RFQs I can respond to' },
    ]
  },
  jobs: {
    title: 'Jobs Mode',
    icon: Briefcase,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-600',
    placeholder: "I'm looking for a role as...",
    greeting: "I'm ready to help your job search. What role are you seeking?",
    quickActions: [
      { label: 'Find Roles', prompt: 'Find me relevant job opportunities' },
      { label: 'Update Profile', prompt: 'Help me update my profile' },
      { label: 'Prep Interview', prompt: 'Help me prepare for interviews' },
    ]
  },
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser()

  // View mode: AI chat or Inbox
  const [viewMode, setViewMode] = useState<ViewMode>('ai')

  // AI Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<Channel | 'wells'>('wells')
  const [showChannelPicker, setShowChannelPicker] = useState(false)

  // Inbox state
  const [conversations, setConversations] = useState<InboxConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<InboxConversation | null>(null)
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([])
  const [isLoadingInbox, setIsLoadingInbox] = useState(false)
  const [inboxFilter, setInboxFilter] = useState<'all' | 'open' | 'pending'>('all')
  const [unreadCount, setUnreadCount] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get journey from Clerk metadata
  const journey = (user?.publicMetadata?.selectedJourney as Journey) || 'founder'
  const config = JOURNEY_CONFIG[journey] || JOURNEY_CONFIG.founder
  const firstName = user?.firstName || 'there'

  // Auto-scroll and initial greeting
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, inboxMessages])

  useEffect(() => {
    if (isLoaded && user && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hey ${firstName}! ${config.greeting}`
      }])
    }
  }, [isLoaded, user, firstName, config.greeting, messages.length])

  // Fetch inbox conversations
  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams()
      if (inboxFilter !== 'all') params.set('status', inboxFilter)
      params.set('stats', 'true')

      const res = await fetch(`/api/inbox?${params}`)
      const data = await res.json()
      if (data.success) {
        setConversations(data.conversations || [])
        // Count unread
        const unread = (data.conversations || []).reduce((sum: number, c: InboxConversation) => sum + c.unread_count, 0)
        setUnreadCount(unread)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
  }

  // Fetch inbox on mount and when switching to inbox view
  useEffect(() => {
    if (viewMode === 'inbox') {
      fetchConversations()
    }
  }, [viewMode, inboxFilter])

  // Fetch messages for selected conversation
  const fetchInboxMessages = async (id: string) => {
    setIsLoadingInbox(true)
    try {
      const res = await fetch(`/api/inbox/${id}`)
      const data = await res.json()
      if (data.success) {
        setInboxMessages(data.messages || [])
        setSelectedConversation(data.conversation)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoadingInbox(false)
    }
  }

  useEffect(() => {
    if (selectedConvId) {
      fetchInboxMessages(selectedConvId)
    }
  }, [selectedConvId])

  // Send message (AI or Inbox)
  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    setInput('')
    setIsLoading(true)

    if (viewMode === 'ai' && selectedChannel === 'wells') {
      // Send to Wells AI
      const updatedMessages: Message[] = [
        ...messages,
        { role: 'user', content: messageText },
      ]
      setMessages(updatedMessages)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages,
            journey,
          }),
        })

        if (!response.ok) throw new Error('Failed to send message')

        const data = await response.json()
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: data.message },
        ])
      } catch {
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: "I'm having trouble connecting. Please try again." },
        ])
      }
    } else if (viewMode === 'inbox' && selectedConvId) {
      // Send to inbox conversation
      try {
        const res = await fetch(`/api/inbox/${selectedConvId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'message',
            content: messageText,
            sender_name: firstName || 'You'
          })
        })

        const data = await res.json()
        if (data.success) {
          setInboxMessages([...inboxMessages, data.message])
          fetchConversations()
        }
      } catch (error) {
        console.error('Error sending message:', error)
      }
    }

    setIsLoading(false)
    inputRef.current?.focus()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Generate AI response for inbox
  const generateAIResponse = async () => {
    if (!selectedConvId) return
    setIsLoading(true)

    try {
      const res = await fetch(`/api/inbox/${selectedConvId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' })
      })

      const data = await res.json()
      if (data.success) {
        // Show the AI-generated message for approval
        setInput(data.content)
      }
    } catch (error) {
      console.error('Error generating AI response:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    )
  }

  const Icon = config.icon

  return (
    <div className="min-h-screen text-white relative">
      {/* Ambient background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-gold-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 glass sticky top-0 z-50 shadow-xl">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/20 group-hover:shadow-gold-500/40 transition-all group-hover:scale-105">
                <Sparkles className="w-4 h-4 text-navy-900 m-2" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Wells Onyx</span>
            </Link>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
              <button
                onClick={() => setViewMode('ai')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'ai'
                    ? 'bg-gradient-to-r from-gold-400 to-gold-600 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                AI Chat
              </button>
              <button
                onClick={() => setViewMode('inbox')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'inbox'
                    ? 'bg-gradient-to-r from-gold-400 to-gold-600 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Inbox className="w-4 h-4" />
                Inbox
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${config.gradient} bg-opacity-10 border border-white/20 backdrop-blur-sm shadow-lg`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{config.title}</span>
              </div>

              <Link
                href="/settings/integrations"
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                title="Connect Channels"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 ring-2 ring-white/10 hover:ring-gold-500/50 transition-all",
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)] relative z-10">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-white/10 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-sm">
          {/* User Profile Summary */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{firstName}</h3>
                <div className="flex items-center gap-1.5">
                  <div className="online-indicator" />
                  <p className="text-xs text-gray-400">{config.title}</p>
                </div>
              </div>
            </div>
          </div>

          {viewMode === 'ai' ? (
            <>
              {/* Quick Stats */}
              <div className="p-4 border-b border-white/10">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Activity</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="w-8 h-8 rounded-lg bg-gold-500/10 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-gold-500" />
                      </div>
                      <span>Active Deals</span>
                    </div>
                    <span className="font-bold text-white">0</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                      <span>Completed</span>
                    </div>
                    <span className="font-bold text-white">0</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-4 flex-1">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  {config.quickActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(action.prompt)}
                      className="group w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-sm"
                    >
                      <span className="text-gray-300 group-hover:text-white">{action.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gold-500 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Inbox Conversations List */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInboxFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      inboxFilter === 'all' ? 'bg-gold-500 text-black' : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setInboxFilter('open')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      inboxFilter === 'open' ? 'bg-gold-500 text-black' : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setInboxFilter('pending')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      inboxFilter === 'pending' ? 'bg-gold-500 text-black' : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={fetchConversations}
                    className="ml-auto p-1.5 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full p-4 text-left border-b border-white/5 hover:bg-white/5 transition-all ${
                        selectedConvId === conv.id ? 'bg-white/10' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          CHANNEL_INFO[conv.channel]?.bgColor || 'bg-gray-500/20'
                        }`}>
                          {CHANNEL_INFO[conv.channel]?.icon || '💬'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">
                              {conv.contact_name || conv.contact_email || conv.contact_phone || 'Unknown'}
                            </span>
                            {conv.unread_count > 0 && (
                              <span className="px-1.5 py-0.5 bg-gold-500 text-black text-xs rounded-full">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {conv.last_message_preview || 'No messages'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              CHANNEL_INFO[conv.channel]?.bgColor || 'bg-gray-500/20'
                            } ${CHANNEL_INFO[conv.channel]?.color || 'text-gray-400'}`}>
                              {CHANNEL_INFO[conv.channel]?.name || conv.channel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col relative">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {viewMode === 'ai' ? (
                <>
                  {/* Welcome Banner - Only show when no messages */}
                  {messages.length <= 1 && (
                    <div className={`rounded-2xl p-6 bg-gradient-to-br ${config.gradient}/10 border border-white/20 mb-6 shadow-xl backdrop-blur-sm`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                          <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold mb-2">Wells is ready to work</h2>
                          <p className="text-gray-400 leading-relaxed">
                            Just type what you need. I'll find matches, negotiate deals, and only charge 1% when something closes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Messages */}
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center mr-3 flex-shrink-0 shadow-lg">
                          <Sparkles className="w-4 h-4 text-navy-900" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-xl ${
                          message.role === 'user'
                            ? `bg-gradient-to-r ${config.gradient} text-white`
                            : 'bg-white/5 border border-white/10 backdrop-blur-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              ) : selectedConvId ? (
                <>
                  {/* Inbox Conversation Header */}
                  {selectedConversation && (
                    <div className="flex items-center justify-between mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                          CHANNEL_INFO[selectedConversation.channel]?.bgColor
                        }`}>
                          {CHANNEL_INFO[selectedConversation.channel]?.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            {selectedConversation.contact_name || selectedConversation.contact_email || 'Unknown'}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {selectedConversation.contact_company || selectedConversation.channel}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={generateAIResponse}
                        disabled={isLoading}
                        className="px-4 py-2 bg-gradient-to-r from-gold-400 to-gold-600 text-black rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        AI Suggest
                      </button>
                    </div>
                  )}

                  {/* Inbox Messages */}
                  {isLoadingInbox ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-gold-500" />
                    </div>
                  ) : (
                    inboxMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.direction === 'inbound' && (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${
                            CHANNEL_INFO[msg.channel as Channel]?.bgColor || 'bg-gray-500/20'
                          }`}>
                            {CHANNEL_INFO[msg.channel as Channel]?.icon || '👤'}
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-xl ${
                            msg.direction === 'outbound'
                              ? msg.ai_generated
                                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                                : 'bg-gradient-to-r from-gold-400 to-gold-600 text-black'
                              : 'bg-white/5 border border-white/10'
                          }`}
                        >
                          {msg.ai_generated && (
                            <div className="flex items-center gap-1 text-xs opacity-75 mb-1">
                              <Sparkles className="w-3 h-3" />
                              AI Generated
                            </div>
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                          <p className="text-[10px] opacity-60 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Inbox className="w-16 h-16 text-gray-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">Select a conversation</h3>
                  <p className="text-gray-500">Choose from the sidebar or wait for incoming messages</p>
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center mr-3 flex-shrink-0 shadow-lg">
                    <Sparkles className="w-4 h-4 text-navy-900" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-gold-500 animate-spin" />
                      <span className="text-sm text-gray-300">Wells is working...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-white/10 glass p-4 sm:p-6 shadow-2xl">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={
                      viewMode === 'ai'
                        ? config.placeholder
                        : selectedConvId
                          ? 'Type a message...'
                          : 'Select a conversation first'
                    }
                    disabled={isLoading || (viewMode === 'inbox' && !selectedConvId)}
                    className="w-full input-premium disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-lg"
                  />
                </div>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading || (viewMode === 'inbox' && !selectedConvId)}
                  className={`bg-gradient-to-r ${config.gradient} text-white px-6 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-lg`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <p className="text-xs text-gray-500">
                  {viewMode === 'ai'
                    ? 'Your AI negotiates. You approve. 1% on closed deals.'
                    : 'Messages sent via your connected channels'}
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
