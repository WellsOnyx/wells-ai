'use client'

/**
 * Unified Wells AI Dashboard
 *
 * Features:
 * - Multi-journey support (founder, buyer, seller, jobs, treasury)
 * - AI Chat interface with journey-aware context
 * - Quick actions based on user role
 * - ERP connection status
 * - GRAIN balance and appreciation
 * - Recent activity across all journeys
 * - Unified Inbox support
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import TreasuryPanel from '@/components/dashboard/TreasuryPanel'
import {
  Send,
  Loader2,
  Rocket,
  ShoppingCart,
  Store,
  Briefcase,
  Wallet,
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
  Filter,
  Database,
  Link2,
  AlertCircle,
  Plus,
  BarChart3,
  FileText,
  Users,
  Zap,
  ExternalLink,
} from 'lucide-react'
import {
  JourneyRouter,
  JourneyType,
  JOURNEY_ROUTES,
  UserContext,
  loadUserContext,
  QuickAction,
  getJourneyInfo,
  getRoleDisplayName,
} from '@/lib/routing/journey-router'

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'ai' | 'inbox' | 'overview'
type Channel = 'sms' | 'imessage' | 'gmail' | 'outlook' | 'email' | 'slack' | 'discord' | 'twitter' | 'instagram' | 'linkedin' | 'whatsapp' | 'chat' | 'teams' | 'telegram'

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

// ============================================================================
// JOURNEY CONFIG
// ============================================================================

const JOURNEY_ICONS: Record<JourneyType, React.ElementType> = {
  founder: Rocket,
  buyer: ShoppingCart,
  seller: Store,
  jobs: Briefcase,
  treasury: Wallet,
}

const JOURNEY_CONFIG = {
  founder: {
    title: 'Founder Mode',
    icon: Rocket,
    color: 'gold',
    gradient: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-500',
    placeholder: "I need to hire a CTO...",
    greeting: "I'm ready to help you build. Need talent, customers, or funding?",
    quickActions: [
      { label: 'Hire Talent', prompt: 'I need to hire for my startup', icon: Users },
      { label: 'Find Customers', prompt: 'I need to find customers for my product', icon: TrendingUp },
      { label: 'Source Suppliers', prompt: 'I need to source suppliers', icon: ShoppingCart },
    ]
  },
  buyer: {
    title: 'Sourcing',
    icon: ShoppingCart,
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    textColor: 'text-blue-500',
    placeholder: "I need to source 10,000 units of...",
    greeting: "I'm ready to source. What products or services do you need?",
    quickActions: [
      { label: 'Get Quotes', prompt: 'I need quotes for bulk materials', icon: FileText },
      { label: 'Find Suppliers', prompt: 'Help me find verified suppliers', icon: Search },
      { label: 'Compare Options', prompt: 'Compare suppliers for me', icon: BarChart3 },
    ]
  },
  seller: {
    title: 'Sales',
    icon: Store,
    color: 'green',
    gradient: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    textColor: 'text-green-500',
    placeholder: "I want to sell to companies looking for...",
    greeting: "I'm ready to find you customers. What do you sell?",
    quickActions: [
      { label: 'Find Leads', prompt: 'Find me qualified buyers', icon: Users },
      { label: 'List Products', prompt: 'List my products to buyers', icon: Plus },
      { label: 'View RFQs', prompt: 'Show me RFQs I can respond to', icon: FileText },
    ]
  },
  jobs: {
    title: 'Hiring',
    icon: Briefcase,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-600',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    textColor: 'text-purple-500',
    placeholder: "I'm looking for a role as...",
    greeting: "I'm ready to help with hiring. What role do you need?",
    quickActions: [
      { label: 'Post Job', prompt: 'I need to post a job opening', icon: Plus },
      { label: 'Find Candidates', prompt: 'Find me candidates for my open roles', icon: Search },
      { label: 'Screen Resumes', prompt: 'Help me screen resumes', icon: FileText },
    ]
  },
  treasury: {
    title: 'Treasury',
    icon: Wallet,
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    textColor: 'text-emerald-500',
    placeholder: "Check my GRAIN balance...",
    greeting: "I'm ready to help with treasury. What do you need?",
    quickActions: [
      { label: 'Check Balance', prompt: "What's my GRAIN balance?", icon: Wallet },
      { label: 'Make Payment', prompt: 'I need to pay an invoice', icon: Zap },
      { label: 'View Activity', prompt: 'Show me recent transactions', icon: BarChart3 },
    ]
  },
}

// Channel display info
const CHANNEL_INFO: Record<Channel, { name: string; icon: string; color: string; bgColor: string }> = {
  sms: { name: 'SMS', icon: '?', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  imessage: { name: 'iMessage', icon: '?', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  gmail: { name: 'Gmail', icon: '?', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  outlook: { name: 'Outlook', icon: '?', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  email: { name: 'Email', icon: '?', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  slack: { name: 'Slack', icon: '?', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  discord: { name: 'Discord', icon: '?', color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  twitter: { name: 'X', icon: '?', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  instagram: { name: 'Instagram', icon: '?', color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
  linkedin: { name: 'LinkedIn', icon: '?', color: 'text-sky-400', bgColor: 'bg-sky-500/20' },
  whatsapp: { name: 'WhatsApp', icon: '?', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  chat: { name: 'Website', icon: '?', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  teams: { name: 'Teams', icon: '?', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  telegram: { name: 'Telegram', icon: '?', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const searchParams = useSearchParams()

  // Get journey from URL or user metadata
  const urlJourney = searchParams.get('journey') as JourneyType | null

  // View mode: AI chat, Inbox, or Overview
  const [viewMode, setViewMode] = useState<ViewMode>('overview')

  // Journey state
  const [activeJourney, setActiveJourney] = useState<JourneyType>('founder')
  const [userContext, setUserContext] = useState<UserContext | null>(null)

  // AI Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Inbox state
  const [conversations, setConversations] = useState<InboxConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<InboxConversation | null>(null)
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([])
  const [isLoadingInbox, setIsLoadingInbox] = useState(false)
  const [inboxFilter, setInboxFilter] = useState<'all' | 'open' | 'pending'>('all')
  const [unreadCount, setUnreadCount] = useState(0)

  // Stats
  const [stats, setStats] = useState({
    activeDeals: 0,
    completedDeals: 0,
    grainBalance: 0,
    pendingActions: 0,
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ============================================================================
  // LOAD USER CONTEXT
  // ============================================================================

  useEffect(() => {
    if (isLoaded && user) {
      const meta = user.publicMetadata as Record<string, unknown>

      // Build user context from Clerk metadata
      const context: UserContext = {
        userId: user.id,
        email: user.primaryEmailAddress?.emailAddress || '',
        companyName: meta.companyName as string | undefined,
        role: (meta.role as UserContext['role']) || 'other',
        needs: (meta.needs as UserContext['needs']) || [],
        primaryJourney: (meta.primaryJourney as JourneyType) || (meta.selectedJourney as JourneyType) || 'founder',
        activeJourneys: (meta.activeJourneys as JourneyType[]) || ['founder'],
        erpConnected: meta.erpConnected === true,
        erpSystem: meta.erpSystem as string | undefined,
        grainBalance: 0, // Will be fetched
        onboardingComplete: meta.onboardingCompleted === true,
        createdAt: new Date(meta.signupCompletedAt as string || Date.now()),
        lastActiveAt: new Date(),
      }

      setUserContext(context)

      // Set active journey from URL or primary
      setActiveJourney(urlJourney || context.primaryJourney)
    }
  }, [isLoaded, user, urlJourney])

  // Initialize greeting message when journey changes
  useEffect(() => {
    if (isLoaded && user) {
      const config = JOURNEY_CONFIG[activeJourney] || JOURNEY_CONFIG.founder
      const firstName = user.firstName || 'there'
      setMessages([{
        role: 'assistant',
        content: `Hey ${firstName}! ${config.greeting}`
      }])
    }
  }, [isLoaded, user, activeJourney])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, inboxMessages])

  // ============================================================================
  // FETCH DATA
  // ============================================================================

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (inboxFilter !== 'all') params.set('status', inboxFilter)
      params.set('stats', 'true')

      const res = await fetch(`/api/inbox?${params}`)
      const data = await res.json()
      if (data.success) {
        setConversations(data.conversations || [])
        const unread = (data.conversations || []).reduce((sum: number, c: InboxConversation) => sum + c.unread_count, 0)
        setUnreadCount(unread)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
  }, [inboxFilter])

  useEffect(() => {
    if (viewMode === 'inbox') {
      fetchConversations()
    }
  }, [viewMode, inboxFilter, fetchConversations])

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

  // ============================================================================
  // SEND MESSAGE
  // ============================================================================

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    setInput('')
    setIsLoading(true)

    if (viewMode === 'ai' || viewMode === 'overview') {
      // Send to Wells AI
      const updatedMessages: Message[] = [
        ...messages,
        { role: 'user', content: messageText },
      ]
      setMessages(updatedMessages)
      if (viewMode === 'overview') setViewMode('ai')

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages,
            journey: activeJourney,
            context: {
              product: 'wellsai',
              userContext: userContext ? {
                role: userContext.role,
                companyName: userContext.companyName,
                activeJourneys: userContext.activeJourneys,
              } : undefined,
            },
          }),
        })

        if (!response.ok) throw new Error('Failed to send message')

        const data = await response.json()
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: data.message },
        ])
      } catch (error) {
        console.error('Dashboard chat error:', error)
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
            sender_name: user?.firstName || 'You'
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

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  const config = JOURNEY_CONFIG[activeJourney] || JOURNEY_CONFIG.founder
  const Icon = config.icon
  const firstName = user?.firstName || 'there'

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all group-hover:scale-105 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">WellsAI</span>
            </Link>

            {/* View Mode Toggle */}
            <div className="hidden md:flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('overview')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'overview'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Overview
              </button>
              <button
                onClick={() => setViewMode('ai')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'ai'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Chat
              </button>
              <button
                onClick={() => setViewMode('inbox')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'inbox'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Inbox className="w-4 h-4" />
                Inbox
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Journey Switcher */}
              {userContext && userContext.activeJourneys.length > 1 && (
                <div className="relative group">
                  <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor} ${config.borderColor} border transition-all hover:shadow-sm`}>
                    <Icon className={`w-4 h-4 ${config.textColor}`} />
                    <span className="text-sm font-medium text-gray-700">{config.title}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    {userContext.activeJourneys.map((journey) => {
                      const jConfig = JOURNEY_CONFIG[journey]
                      const JIcon = jConfig.icon
                      return (
                        <button
                          key={journey}
                          onClick={() => setActiveJourney(journey)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                            activeJourney === journey ? 'bg-gray-50' : ''
                          }`}
                        >
                          <JIcon className={`w-4 h-4 ${jConfig.textColor}`} />
                          <span className="text-sm font-medium text-gray-700">{jConfig.title}</span>
                          {activeJourney === journey && (
                            <Check className="w-4 h-4 text-blue-500 ml-auto" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <Link
                href="/settings/integrations"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 ring-2 ring-gray-100 hover:ring-blue-500/50 transition-all",
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-gray-200 bg-white">
          {/* User Summary */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{firstName}</h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-xs text-gray-500">{config.title}</p>
                </div>
              </div>
            </div>

            {/* ERP Status */}
            {userContext && (
              <div className={`p-3 rounded-lg ${userContext.erpConnected ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  <Database className={`w-4 h-4 ${userContext.erpConnected ? 'text-green-600' : 'text-amber-600'}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {userContext.erpConnected ? 'ERP Connected' : 'No ERP Connected'}
                  </span>
                </div>
                {!userContext.erpConnected && (
                  <Link
                    href="/settings/integrations"
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    Connect now <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {viewMode === 'overview' || viewMode === 'ai' ? (
            <>
              {/* Stats */}
              <div className="p-4 border-b border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Activity</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                      </div>
                      <span>Active Deals</span>
                    </div>
                    <span className="font-bold text-gray-900">{stats.activeDeals}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <span>Completed</span>
                    </div>
                    <span className="font-bold text-gray-900">{stats.completedDeals}</span>
                  </div>
                  {userContext?.activeJourneys.includes('treasury') && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <Wallet className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span>GRAIN Balance</span>
                      </div>
                      <span className="font-bold text-gray-900">{stats.grainBalance.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-4 flex-1">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  {config.quickActions.map((action, i) => {
                    const ActionIcon = action.icon
                    return (
                      <button
                        key={i}
                        onClick={() => sendMessage(action.prompt)}
                        className="group w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <ActionIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700 group-hover:text-gray-900">{action.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            // Inbox sidebar
            <>
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  {(['all', 'open', 'pending'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setInboxFilter(filter)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        inboxFilter === filter ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                  <button
                    onClick={fetchConversations}
                    className="ml-auto p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full p-4 text-left border-b border-gray-50 hover:bg-gray-50 transition-all ${
                        selectedConvId === conv.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          CHANNEL_INFO[conv.channel]?.bgColor || 'bg-gray-100'
                        }`}>
                          {CHANNEL_INFO[conv.channel]?.icon || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 truncate">
                              {conv.contact_name || conv.contact_email || conv.contact_phone || 'Unknown'}
                            </span>
                            {conv.unread_count > 0 && (
                              <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {conv.last_message_preview || 'No messages'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {viewMode === 'overview' ? (
            // Overview Mode
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                {/* Welcome */}
                <div className={`rounded-2xl p-6 bg-gradient-to-br ${config.gradient} text-white mb-6 shadow-xl`}>
                  <h1 className="text-2xl font-bold mb-2">
                    Welcome back, {firstName}
                  </h1>
                  <p className="text-white/80">
                    {config.greeting}
                  </p>
                </div>

                {/* Quick Chat */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    Ask Wells Anything
                  </h2>
                  <div className="flex gap-3">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={config.placeholder}
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || isLoading}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/25"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Journey Cards */}
                {userContext && userContext.activeJourneys.length > 1 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Journeys</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userContext.activeJourneys.map((journey) => {
                        const jConfig = JOURNEY_CONFIG[journey]
                        const JIcon = jConfig.icon
                        return (
                          <button
                            key={journey}
                            onClick={() => setActiveJourney(journey)}
                            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                              activeJourney === journey
                                ? `${jConfig.borderColor} ${jConfig.bgColor}`
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${jConfig.gradient} flex items-center justify-center mb-3`}>
                              <JIcon className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900">{jConfig.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">{JOURNEY_ROUTES[journey].description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Treasury Panel - shown when treasury journey is active */}
                {activeJourney === 'treasury' && user?.id && (
                  <TreasuryPanel
                    userId={user.id}
                    onAction={(prompt) => sendMessage(prompt)}
                  />
                )}

                {/* Recent Activity - shown for non-treasury journeys */}
                {activeJourney !== 'treasury' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
                    <div className="text-center py-8 text-gray-400">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No recent activity</p>
                      <p className="text-sm mt-1">Start a conversation with Wells to get things done</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Chat/Inbox Mode
            <>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  {viewMode === 'ai' ? (
                    <>
                      {/* AI Messages */}
                      {messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {message.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mr-3 flex-shrink-0 shadow-lg">
                              <Sparkles className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm ${
                              message.role === 'user'
                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                                : 'bg-white border border-gray-200'
                            }`}
                          >
                            <p className={`whitespace-pre-wrap leading-relaxed ${
                              message.role === 'user' ? 'text-white' : 'text-gray-700'
                            }`}>
                              {message.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : selectedConvId ? (
                    <>
                      {/* Inbox Messages */}
                      {selectedConversation && (
                        <div className="flex items-center justify-between mb-4 p-4 bg-white rounded-xl border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                              CHANNEL_INFO[selectedConversation.channel]?.bgColor
                            }`}>
                              {CHANNEL_INFO[selectedConversation.channel]?.icon}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {selectedConversation.contact_name || selectedConversation.contact_email || 'Unknown'}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {selectedConversation.contact_company || CHANNEL_INFO[selectedConversation.channel]?.name}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {isLoadingInbox ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        </div>
                      ) : (
                        inboxMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm ${
                                msg.direction === 'outbound'
                                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                                  : 'bg-white border border-gray-200'
                              }`}
                            >
                              <p className={`whitespace-pre-wrap leading-relaxed ${
                                msg.direction === 'outbound' ? 'text-white' : 'text-gray-700'
                              }`}>
                                {msg.content}
                              </p>
                              <p className={`text-[10px] mt-1 ${
                                msg.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'
                              }`}>
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Inbox className="w-16 h-16 text-gray-300 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-400 mb-2">Select a conversation</h3>
                      <p className="text-gray-400">Choose from the sidebar</p>
                    </div>
                  )}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mr-3 flex-shrink-0 shadow-lg">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                          <span className="text-sm text-gray-500">Wells is working...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 bg-white p-4 sm:p-6">
                <div className="max-w-3xl mx-auto">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
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
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || isLoading || (viewMode === 'inbox' && !selectedConvId)}
                      className={`bg-gradient-to-r ${config.gradient} text-white px-6 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg`}
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-center text-xs text-gray-400 mt-3">
                    {viewMode === 'ai'
                      ? 'Your AI negotiates. You approve. 1% on closed deals.'
                      : 'Messages sent via your connected channels'}
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
