'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Send,
  Sparkles,
  Check,
  X,
  Phone,
  Mail,
  MessageSquare,
  Slack,
  Filter,
  Search,
  MoreVertical,
  Clock,
  User,
  Building,
  Loader2,
  RefreshCw,
  Archive,
  CheckCircle
} from 'lucide-react'

// All supported channels
type Channel = 'sms' | 'imessage' | 'gmail' | 'outlook' | 'email' | 'slack' | 'discord' | 'twitter' | 'instagram' | 'linkedin' | 'whatsapp' | 'chat' | 'teams' | 'telegram'

interface Conversation {
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
  intent?: string
}

interface Message {
  id: string
  content: string
  direction: 'inbound' | 'outbound'
  sender_type: 'contact' | 'user' | 'ai' | 'system'
  sender_name?: string
  channel: string
  ai_generated: boolean
  ai_approved?: boolean
  status: string
  created_at: string
}

// Channel display info with icons (using lucide-react icons) and emoji fallbacks
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

// Fallback for lucide icons (keeping for backwards compatibility)
const CHANNEL_ICONS: Record<string, any> = {
  sms: Phone,
  imessage: Phone,
  gmail: Mail,
  outlook: Mail,
  email: Mail,
  slack: Slack,
  discord: MessageSquare,
  twitter: MessageSquare,
  instagram: MessageSquare,
  linkedin: MessageSquare,
  whatsapp: Phone,
  chat: MessageSquare,
  teams: MessageSquare,
  telegram: MessageSquare,
}

const CHANNEL_COLORS: Record<string, string> = {
  sms: 'bg-green-500/20 text-green-400',
  imessage: 'bg-emerald-500/20 text-emerald-400',
  gmail: 'bg-red-500/20 text-red-400',
  outlook: 'bg-blue-500/20 text-blue-400',
  email: 'bg-indigo-500/20 text-indigo-400',
  slack: 'bg-purple-500/20 text-purple-400',
  discord: 'bg-violet-500/20 text-violet-400',
  twitter: 'bg-gray-500/20 text-gray-400',
  instagram: 'bg-pink-500/20 text-pink-400',
  linkedin: 'bg-sky-500/20 text-sky-400',
  whatsapp: 'bg-green-500/20 text-green-400',
  chat: 'bg-amber-500/20 text-amber-400',
  teams: 'bg-indigo-500/20 text-indigo-400',
  telegram: 'bg-cyan-500/20 text-cyan-400',
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [pendingAIMessage, setPendingAIMessage] = useState<{ content: string; messageId: string } | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      if (searchQuery) params.set('search', searchQuery)
      params.set('stats', 'true')

      const res = await fetch(`/api/inbox?${params}`)
      const data = await res.json()
      if (data.success) {
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch messages for selected conversation
  const fetchMessages = async (id: string) => {
    setIsLoadingMessages(true)
    try {
      const res = await fetch(`/api/inbox/${id}`)
      const data = await res.json()
      if (data.success) {
        setMessages(data.messages)
        setSelectedConversation(data.conversation)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [filter, searchQuery])

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId)
    }
  }, [selectedId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send manual message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedId) return

    setIsSending(true)
    try {
      const res = await fetch(`/api/inbox/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          content: newMessage,
          sender_name: 'Wells AI Team'
        })
      })

      const data = await res.json()
      if (data.success) {
        setMessages([...messages, data.message])
        setNewMessage('')
        fetchConversations()
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsSending(false)
    }
  }

  // Generate AI response
  const handleGenerateAI = async () => {
    if (!selectedId) return

    setIsGeneratingAI(true)
    try {
      const res = await fetch(`/api/inbox/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai-response' })
      })

      const data = await res.json()
      if (data.success) {
        setPendingAIMessage({
          content: data.content,
          messageId: data.messageId
        })
      }
    } catch (error) {
      console.error('Error generating AI response:', error)
    } finally {
      setIsGeneratingAI(false)
    }
  }

  // Approve AI message
  const handleApproveAI = async (editedContent?: string) => {
    if (!selectedId || !pendingAIMessage) return

    setIsSending(true)
    try {
      const res = await fetch(`/api/inbox/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          messageId: pendingAIMessage.messageId,
          userId: 'user-1', // TODO: Use actual user ID
          editedContent
        })
      })

      const data = await res.json()
      if (data.success) {
        setMessages([...messages, data.message])
        setPendingAIMessage(null)
        fetchConversations()
      }
    } catch (error) {
      console.error('Error approving message:', error)
    } finally {
      setIsSending(false)
    }
  }

  // Update status
  const handleStatusChange = async (status: string) => {
    if (!selectedId) return

    try {
      await fetch(`/api/inbox/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      fetchConversations()
      if (selectedConversation) {
        setSelectedConversation({ ...selectedConversation, status: status as any })
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = diff / (1000 * 60 * 60)

    if (hours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (hours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar - Conversation List */}
      <div className="w-96 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-white">Inbox</h1>
            </div>
            <button
              onClick={() => fetchConversations()}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            {(['all', 'open', 'pending', 'resolved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-amber-500 text-black'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No conversations yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Messages from SMS, email, and chat will appear here
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const ChannelIcon = CHANNEL_ICONS[conv.channel] || MessageSquare
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full p-4 text-left border-b border-gray-800 hover:bg-gray-900/50 transition-colors ${
                    selectedId === conv.id ? 'bg-gray-900' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${CHANNEL_COLORS[conv.channel]}`}>
                      <ChannelIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white truncate">
                          {conv.contact_name || conv.contact_email || conv.contact_phone || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      {conv.contact_company && (
                        <p className="text-xs text-gray-500 mb-1">{conv.contact_company}</p>
                      )}
                      <p className="text-sm text-gray-400 truncate">
                        {conv.last_message_preview || 'No messages'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {conv.unread_count > 0 && (
                          <span className="px-2 py-0.5 bg-amber-500 text-black text-xs font-semibold rounded-full">
                            {conv.unread_count}
                          </span>
                        )}
                        {conv.intent && (
                          <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-full">
                            {conv.intent}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Main Content - Messages */}
      <div className="flex-1 flex flex-col">
        {selectedId && selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${CHANNEL_COLORS[selectedConversation.channel]}`}>
                  {(() => {
                    const Icon = CHANNEL_ICONS[selectedConversation.channel] || MessageSquare
                    return <Icon className="w-5 h-5" />
                  })()}
                </div>
                <div>
                  <h2 className="font-semibold text-white">
                    {selectedConversation.contact_name || selectedConversation.contact_email || selectedConversation.contact_phone}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    {selectedConversation.contact_company && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {selectedConversation.contact_company}
                      </span>
                    )}
                    <span className="capitalize">{selectedConversation.channel}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedConversation.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.direction === 'outbound'
                          ? msg.ai_generated
                            ? 'bg-purple-500/20 border border-purple-500/30'
                            : 'bg-amber-500 text-black'
                          : 'bg-gray-800'
                      }`}
                    >
                      {msg.ai_generated && (
                        <div className="flex items-center gap-1 text-xs text-purple-400 mb-1">
                          <Sparkles className="w-3 h-3" />
                          AI Generated
                          {msg.ai_approved && <Check className="w-3 h-3 text-green-400" />}
                        </div>
                      )}
                      <p className={msg.direction === 'outbound' && !msg.ai_generated ? 'text-black' : 'text-white'}>
                        {msg.content}
                      </p>
                      <div className={`text-xs mt-1 ${
                        msg.direction === 'outbound' && !msg.ai_generated ? 'text-black/60' : 'text-gray-500'
                      }`}>
                        {formatTime(msg.created_at)}
                        {msg.sender_name && ` • ${msg.sender_name}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Pending AI Response */}
            {pendingAIMessage && (
              <div className="px-4 py-3 bg-purple-500/10 border-t border-purple-500/30">
                <div className="flex items-center gap-2 text-sm text-purple-400 mb-2">
                  <Sparkles className="w-4 h-4" />
                  AI-Generated Response (Review before sending)
                </div>
                <textarea
                  value={pendingAIMessage.content}
                  onChange={(e) => setPendingAIMessage({ ...pendingAIMessage, content: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-purple-500"
                  rows={3}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setPendingAIMessage(null)}
                    className="px-4 py-2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleApproveAI(pendingAIMessage.content)}
                    disabled={isSending}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold flex items-center gap-2 hover:bg-green-600 disabled:opacity-50"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Compose */}
            <div className="p-4 border-t border-gray-800">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white placeholder:text-gray-500 resize-none focus:outline-none focus:border-amber-500"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI || !!pendingAIMessage}
                    className="p-3 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Generate AI response"
                  >
                    {isGeneratingAI ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="p-3 bg-amber-500 text-black rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Select a conversation</h2>
              <p className="text-gray-400">Choose from the list to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
