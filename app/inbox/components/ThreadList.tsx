'use client'

import { useRef, useEffect, useState } from 'react'
import {
  Star,
  Mail,
  MessageSquare,
  Phone,
  Linkedin,
  AtSign,
  Clock,
  AlertCircle,
  Zap,
  TrendingUp,
  Users
} from 'lucide-react'

export interface Thread {
  id: string
  contact_id: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  contact_company?: string
  channel: string
  status: 'open' | 'pending' | 'resolved' | 'archived'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  unread_count: number
  is_starred?: boolean
  last_message_at: string
  last_message_preview?: string
  intent?: string
  ai_category?: 'important' | 'urgent' | 'hot_lead' | 'partnership' | 'support'
  sentiment?: 'positive' | 'neutral' | 'negative'
}

interface ThreadListProps {
  threads: Thread[]
  selectedId: string | null
  onSelect: (id: string) => void
  onStar: (id: string) => void
  onArchive: (id: string) => void
  onSnooze: (id: string) => void
  loading?: boolean
}

const PROVIDER_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  gmail: { icon: Mail, color: 'text-red-400', bg: 'bg-red-500/10' },
  outlook: { icon: Mail, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  email: { icon: Mail, color: 'text-gray-400', bg: 'bg-gray-500/10' },
  linkedin: { icon: Linkedin, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  sms: { icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/10' },
  imessage: { icon: Phone, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  slack: { icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  chat: { icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-500/10' },
}

const AI_BADGES: Record<string, { label: string; icon: any; color: string }> = {
  urgent: { label: 'Urgent', icon: AlertCircle, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  important: { label: 'Important', icon: Star, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  hot_lead: { label: 'Hot Lead', icon: TrendingUp, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  partnership: { label: 'Partnership', icon: Users, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  support: { label: 'Support', icon: Zap, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
}

export default function ThreadList({
  threads,
  selectedId,
  onSelect,
  onStar,
  onArchive,
  onSnooze,
  loading = false
}: ThreadListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Virtual scrolling optimization
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })

  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return
      const { scrollTop, clientHeight } = listRef.current
      const itemHeight = 88 // Approximate thread item height
      const start = Math.floor(scrollTop / itemHeight)
      const end = Math.ceil((scrollTop + clientHeight) / itemHeight) + 10
      setVisibleRange({ start: Math.max(0, start - 10), end })
    }

    const list = listRef.current
    if (list) {
      list.addEventListener('scroll', handleScroll)
      return () => list.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = diff / (1000 * 60 * 60)

    if (hours < 1) {
      const mins = Math.floor(diff / (1000 * 60))
      return `${mins}m`
    } else if (hours < 24) {
      return `${Math.floor(hours)}h`
    } else if (hours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const visibleThreads = threads.slice(visibleRange.start, visibleRange.end)
  const topPadding = visibleRange.start * 88
  const bottomPadding = Math.max(0, (threads.length - visibleRange.end) * 88)

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
      {/* Top padding for virtual scrolling */}
      {topPadding > 0 && <div style={{ height: topPadding }} />}

      {visibleThreads.map((thread) => {
        const providerInfo = PROVIDER_ICONS[thread.channel] || PROVIDER_ICONS.email
        const ProviderIcon = providerInfo.icon
        const aiBadge = thread.ai_category ? AI_BADGES[thread.ai_category] : null
        const AiBadgeIcon = aiBadge?.icon
        const isSelected = selectedId === thread.id
        const isHovered = hoveredId === thread.id

        return (
          <div
            key={thread.id}
            onClick={() => onSelect(thread.id)}
            onMouseEnter={() => setHoveredId(thread.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`
              group relative px-4 py-3 border-b border-white/5 cursor-pointer
              transition-all duration-150 ease-out
              ${isSelected
                ? 'bg-white/[0.08] border-l-2 border-l-amber-500'
                : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
              }
              ${thread.unread_count > 0 ? 'bg-white/[0.02]' : ''}
            `}
          >
            <div className="flex items-start gap-3">
              {/* Provider Icon */}
              <div className={`flex-shrink-0 p-2 rounded-lg ${providerInfo.bg} ${providerInfo.color}`}>
                <ProviderIcon className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {thread.is_starred && (
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                    )}
                    <span className={`font-semibold truncate ${
                      thread.unread_count > 0 ? 'text-white' : 'text-gray-300'
                    }`}>
                      {thread.contact_name || thread.contact_email || thread.contact_phone || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {formatTime(thread.last_message_at)}
                  </span>
                </div>

                {/* Company */}
                {thread.contact_company && (
                  <div className="text-xs text-gray-500 mb-1 truncate">
                    {thread.contact_company}
                  </div>
                )}

                {/* Preview */}
                <div className={`text-sm truncate mb-2 ${
                  thread.unread_count > 0 ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  {thread.last_message_preview || 'No message preview'}
                </div>

                {/* Badges Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {thread.unread_count > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-black text-xs font-bold">
                      {thread.unread_count}
                    </span>
                  )}

                  {aiBadge && AiBadgeIcon && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${aiBadge.color}`}>
                      <AiBadgeIcon className="w-3 h-3" />
                      {aiBadge.label}
                    </span>
                  )}

                  {thread.intent && (
                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-gray-400 text-xs border border-white/10">
                      {thread.intent}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions (show on hover) */}
            {isHovered && !isSelected && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-black/90 backdrop-blur-sm rounded-lg border border-white/10 p-1 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStar(thread.id)
                  }}
                  className="p-1.5 rounded transition-all duration-150 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  title="Star"
                  aria-label={thread.is_starred ? 'Unstar thread' : 'Star thread'}
                >
                  <Star className={`w-4 h-4 transition-colors duration-150 ${thread.is_starred ? 'text-amber-400 fill-amber-400' : 'text-gray-400 hover:text-amber-400'}`} aria-hidden="true" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSnooze(thread.id)
                  }}
                  className="p-1.5 rounded transition-all duration-150 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title="Snooze"
                  aria-label="Snooze thread"
                >
                  <Clock className="w-4 h-4 text-gray-400 transition-colors duration-150 hover:text-blue-400" aria-hidden="true" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onArchive(thread.id)
                  }}
                  className="p-1.5 rounded transition-all duration-150 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                  title="Archive"
                  aria-label="Archive thread"
                >
                  <AtSign className="w-4 h-4 text-gray-400 transition-colors duration-150 hover:text-gray-300" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Bottom padding for virtual scrolling */}
      {bottomPadding > 0 && <div style={{ height: bottomPadding }} />}

      {/* Loading state */}
      {loading && threads.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && threads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <Mail className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">No messages</p>
        </div>
      )}
    </div>
  )
}
