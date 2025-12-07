'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  User,
  Building,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Download,
  Send,
  Loader2,
  X,
  Check
} from 'lucide-react'

export interface Message {
  id: string
  content: string
  direction: 'inbound' | 'outbound'
  sender_type: 'contact' | 'user' | 'ai' | 'system'
  sender_name?: string
  sender_email?: string
  channel: string
  ai_generated: boolean
  ai_approved?: boolean
  status: string
  created_at: string
  attachments?: Array<{
    id: string
    filename: string
    size: number
    type: string
    url: string
  }>
}

export interface Contact {
  name?: string
  email?: string
  phone?: string
  company?: string
  avatar?: string
}

interface MessageViewProps {
  messages: Message[]
  contact: Contact
  aiSummary?: string
  loading?: boolean
  onReply: (content: string) => void
  onReplyAll?: (content: string) => void
  onForward?: (content: string) => void
  onGenerateAI?: () => void
  isGeneratingAI?: boolean
}

export default function MessageView({
  messages,
  contact,
  aiSummary,
  loading = false,
  onReply,
  onReplyAll,
  onForward,
  onGenerateAI,
  isGeneratingAI = false
}: MessageViewProps) {
  const [replyContent, setReplyContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showAISummary, setShowAISummary] = useState(true)
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set())
  const [hoveredContact, setHoveredContact] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const replyBoxRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-collapse older messages (keep last 3 visible)
  useEffect(() => {
    if (messages.length > 3) {
      const messagesToCollapse = messages.slice(0, -3).map(m => m.id)
      setCollapsedMessages(new Set(messagesToCollapse))
    }
  }, [messages])

  const handleSendReply = async () => {
    if (!replyContent.trim()) return

    setIsSending(true)
    try {
      await onReply(replyContent)
      setReplyContent('')
    } catch (error) {
      console.error('Failed to send reply:', error)
    } finally {
      setIsSending(false)
    }
  }

  const toggleMessageCollapse = (messageId: string) => {
    setCollapsedMessages(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Contact Header */}
      <div className="relative p-6 border-b border-white/5">
        <div
          className="flex items-center gap-4"
          onMouseEnter={() => setHoveredContact(true)}
          onMouseLeave={() => setHoveredContact(false)}
        >
          {/* Avatar */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black font-bold text-lg">
              {contact.name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-black" />
          </div>

          {/* Contact Info */}
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              {contact.name || contact.email || contact.phone || 'Unknown Contact'}
            </h2>
            <div className="flex items-center gap-3 text-sm text-gray-400 mt-0.5">
              {contact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {contact.email}
                </span>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {contact.phone}
                </span>
              )}
            </div>
            {contact.company && (
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <Building className="w-3.5 h-3.5" />
                {contact.company}
              </div>
            )}
          </div>
        </div>

        {/* Contact Card on Hover */}
        {hoveredContact && (
          <div className="absolute top-full left-6 mt-2 p-4 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 min-w-[300px]">
            <div className="space-y-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">Email</div>
                <div className="text-sm text-white">{contact.email || 'Not provided'}</div>
              </div>
              {contact.phone && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Phone</div>
                  <div className="text-sm text-white">{contact.phone}</div>
                </div>
              )}
              {contact.company && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Company</div>
                  <div className="text-sm text-white">{contact.company}</div>
                </div>
              )}
              <div className="pt-2 border-t border-white/10">
                <button className="text-xs text-amber-400 hover:text-amber-300">
                  View full profile →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="px-6 py-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b border-white/5">
          <button
            onClick={() => setShowAISummary(!showAISummary)}
            className="flex items-center gap-2 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors w-full"
          >
            <Sparkles className="w-4 h-4" />
            AI Summary
            {showAISummary ? (
              <ChevronUp className="w-4 h-4 ml-auto" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-auto" />
            )}
          </button>
          {showAISummary && (
            <p className="mt-2 text-sm text-gray-300 leading-relaxed">
              {aiSummary}
            </p>
          )}
        </div>
      )}

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message, index) => {
          const isCollapsed = collapsedMessages.has(message.id)
          const isLastMessage = index === messages.length - 1

          return (
            <div key={message.id} className="group">
              {/* Collapsed Message Preview */}
              {isCollapsed ? (
                <button
                  onClick={() => toggleMessageCollapse(message.id)}
                  className="w-full text-left px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium">
                      {message.sender_name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-400">{message.sender_name || 'Unknown'}</span>
                      <span className="text-gray-600 mx-2">•</span>
                      <span className="text-gray-600 truncate">{message.content.substring(0, 60)}...</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  {/* Message Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        message.direction === 'outbound'
                          ? 'bg-amber-500 text-black'
                          : 'bg-gray-700 text-white'
                      }`}>
                        {message.sender_name?.[0]?.toUpperCase() || (message.direction === 'outbound' ? 'W' : '?')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">
                            {message.sender_name || (message.direction === 'outbound' ? 'Wells' : 'Unknown')}
                          </span>
                          {message.ai_generated && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-xs border border-purple-500/30">
                              <Sparkles className="w-3 h-3" />
                              AI
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatTime(message.created_at)}
                          {message.sender_email && ` • ${message.sender_email}`}
                        </div>
                      </div>
                    </div>
                    {!isLastMessage && (
                      <button
                        onClick={() => toggleMessageCollapse(message.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                      >
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="pl-11 space-y-3">
                    <div className="text-gray-200 text-[15px] leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </div>

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="space-y-2">
                        {message.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                          >
                            <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white truncate">{attachment.filename}</div>
                              <div className="text-xs text-gray-500">{formatFileSize(attachment.size)}</div>
                            </div>
                            <a
                              href={attachment.url}
                              download
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4 text-gray-400" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Box */}
      <div className="border-t border-white/5 p-4 bg-black/40 backdrop-blur-sm">
        <div className="space-y-3">
          <textarea
            ref={replyBoxRef}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Type your reply... (Cmd+Enter to send)"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 resize-none focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
            rows={3}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                handleSendReply()
              }
            }}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onGenerateAI && (
                <button
                  onClick={onGenerateAI}
                  disabled={isGeneratingAI}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 transition-all disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                >
                  {isGeneratingAI ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  AI Write
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {replyContent && (
                <button
                  onClick={() => setReplyContent('')}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleSendReply}
                disabled={!replyContent.trim() || isSending}
                className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
