'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mail,
  Search,
  Settings,
  Plus,
  RefreshCw,
  Filter,
  Inbox,
  Send as SendIcon,
  FileText,
  Archive as ArchiveIcon,
  Trash,
  Star,
  Loader2
} from 'lucide-react'

import ThreadList, { type Thread } from './components/ThreadList'
import MessageView, { type Message, type Contact } from './components/MessageView'
import ComposeModal from './components/ComposeModal'
import CommandPalette from './components/CommandPalette'
import SnoozePicker from './components/SnoozePicker'
import { getKeyboardHandler } from '@/lib/inbox/keyboard-shortcuts'

export default function SuperhumanInboxPage() {
  const router = useRouter()

  // State
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [contact, setContact] = useState<Contact>({})
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentView, setCurrentView] = useState<'inbox' | 'sent' | 'drafts' | 'archive' | 'trash'>('inbox')

  // Modal states
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [snoozePickerState, setSnoozePickerState] = useState<{
    isOpen: boolean
    threadId: string | null
    position?: { x: number; y: number }
  }>({ isOpen: false, threadId: null })

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (currentView !== 'inbox') params.set('status', currentView)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/inbox?${params}`)
      const data = await res.json()

      if (data.success) {
        // Map the conversation data to Thread format
        setThreads(data.conversations.map((conv: any) => ({
          ...conv,
          is_starred: conv.is_starred || false,
          ai_category: conv.priority === 'urgent' ? 'urgent' :
                       conv.priority === 'high' ? 'important' : undefined
        })))
      }
    } catch (error) {
      console.error('Failed to fetch threads:', error)
    } finally {
      setLoading(false)
    }
  }, [currentView, searchQuery])

  // Fetch messages for selected thread
  const fetchMessages = useCallback(async (threadId: string) => {
    try {
      setMessagesLoading(true)
      const res = await fetch(`/api/inbox/${threadId}`)
      const data = await res.json()

      if (data.success) {
        setMessages(data.messages)

        // Set contact info
        const conv = data.conversation
        setContact({
          name: conv.contact_name,
          email: conv.contact_email,
          phone: conv.contact_phone,
          company: conv.contact_company
        })
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  // Effects
  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId)
    }
  }, [selectedThreadId, fetchMessages])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = getKeyboardHandler()

    // Navigation
    handler.on('next_thread', () => {
      const currentIndex = threads.findIndex(t => t.id === selectedThreadId)
      if (currentIndex < threads.length - 1) {
        setSelectedThreadId(threads[currentIndex + 1].id)
      }
    })

    handler.on('previous_thread', () => {
      const currentIndex = threads.findIndex(t => t.id === selectedThreadId)
      if (currentIndex > 0) {
        setSelectedThreadId(threads[currentIndex - 1].id)
      }
    })

    handler.on('open_thread', () => {
      if (threads.length > 0 && !selectedThreadId) {
        setSelectedThreadId(threads[0].id)
      }
    })

    // Actions
    handler.on('archive', () => {
      if (selectedThreadId) handleArchive(selectedThreadId)
    })

    handler.on('star', () => {
      if (selectedThreadId) handleStar(selectedThreadId)
    })

    handler.on('snooze', () => {
      if (selectedThreadId) {
        setSnoozePickerState({ isOpen: true, threadId: selectedThreadId })
      }
    })

    handler.on('compose', () => {
      setIsComposeOpen(true)
    })

    handler.on('command_palette', () => {
      setIsCommandPaletteOpen(true)
    })

    handler.on('search', () => {
      document.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    })

    // Views
    handler.on('go_to_inbox', () => setCurrentView('inbox'))
    handler.on('go_to_sent', () => setCurrentView('sent'))
    handler.on('go_to_drafts', () => setCurrentView('drafts'))

    return () => {
      handler.destroy()
    }
  }, [threads, selectedThreadId])

  // Handlers
  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId)
  }

  const handleStar = async (threadId: string) => {
    setThreads(prev => prev.map(t =>
      t.id === threadId ? { ...t, is_starred: !t.is_starred } : t
    ))
    // TODO: API call to update star status
  }

  const handleArchive = async (threadId: string) => {
    try {
      await fetch(`/api/inbox/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      })
      setThreads(prev => prev.filter(t => t.id !== threadId))
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null)
      }
    } catch (error) {
      console.error('Failed to archive:', error)
    }
  }

  const handleSnooze = async (threadId: string, until: Date) => {
    // TODO: Implement snooze functionality
    console.log('Snooze thread', threadId, 'until', until)
    setSnoozePickerState({ isOpen: false, threadId: null })
  }

  const handleReply = async (content: string) => {
    if (!selectedThreadId) return

    try {
      const res = await fetch(`/api/inbox/${selectedThreadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          content,
          sender_name: 'Wells Team'
        })
      })

      const data = await res.json()
      if (data.success) {
        setMessages(prev => [...prev, data.message])
        fetchThreads() // Refresh thread list
      }
    } catch (error) {
      console.error('Failed to send reply:', error)
      throw error
    }
  }

  const handleCompose = async (data: any) => {
    try {
      // TODO: Implement compose functionality
      console.log('Send email:', data)
    } catch (error) {
      console.error('Failed to send:', error)
      throw error
    }
  }

  const handleCommandAction = (action: string) => {
    switch (action) {
      case 'compose':
        setIsComposeOpen(true)
        break
      case 'archive':
        if (selectedThreadId) handleArchive(selectedThreadId)
        break
      case 'star':
        if (selectedThreadId) handleStar(selectedThreadId)
        break
      case 'snooze':
        if (selectedThreadId) {
          setSnoozePickerState({ isOpen: true, threadId: selectedThreadId })
        }
        break
      case 'show_shortcuts':
        // TODO: Show shortcuts modal
        break
    }
  }

  const selectedThread = threads.find(t => t.id === selectedThreadId)

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 h-14 border-b border-white/10 flex items-center justify-between px-4 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            Wells Inbox
          </h1>

          {/* View Tabs */}
          <div className="flex items-center gap-1">
            {[
              { id: 'inbox', label: 'Inbox', icon: Inbox },
              { id: 'sent', label: 'Sent', icon: SendIcon },
              { id: 'drafts', label: 'Drafts', icon: FileText },
              { id: 'archive', label: 'Archive', icon: ArchiveIcon }
            ].map((view) => {
              const Icon = view.icon
              return (
                <button
                  key={view.id}
                  onClick={() => setCurrentView(view.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    currentView === view.id
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {view.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchThreads()}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => router.push('/inbox/settings')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => setIsComposeOpen(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Compose
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thread List Sidebar */}
        <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col bg-black/40">
          {/* Search */}
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="search"
                placeholder="Search messages... (/)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-sm"
              />
            </div>
          </div>

          {/* Thread List */}
          <ThreadList
            threads={threads}
            selectedId={selectedThreadId}
            onSelect={handleSelectThread}
            onStar={handleStar}
            onArchive={handleArchive}
            onSnooze={(id) => setSnoozePickerState({ isOpen: true, threadId: id })}
            loading={loading}
          />
        </div>

        {/* Message View */}
        <div className="flex-1 flex flex-col">
          {selectedThreadId && selectedThread ? (
            <MessageView
              messages={messages}
              contact={contact}
              aiSummary="This is a sales inquiry from a potential customer interested in your executive search services. They mentioned budget approval and are ready to move forward."
              loading={messagesLoading}
              onReply={handleReply}
              onGenerateAI={async () => {
                // TODO: Implement AI generation
                console.log('Generate AI response')
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Mail className="w-16 h-16 text-gray-700 mb-4" />
              <h2 className="text-xl font-semibold text-gray-400 mb-2">No message selected</h2>
              <p className="text-gray-600 text-sm">
                Choose a message from the list or press <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs">c</kbd> to compose
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSend={handleCompose}
        accounts={[
          { id: '1', email: 'wells@example.com', provider: 'gmail' }
        ]}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(path) => router.push(path)}
        onAction={handleCommandAction}
      />

      <SnoozePicker
        isOpen={snoozePickerState.isOpen}
        onClose={() => setSnoozePickerState({ isOpen: false, threadId: null })}
        onSnooze={(until) => {
          if (snoozePickerState.threadId) {
            handleSnooze(snoozePickerState.threadId, until)
          }
        }}
        position={snoozePickerState.position}
      />

      {/* Keyboard shortcut hint */}
      <div className="fixed bottom-4 right-4 px-3 py-2 bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg text-xs text-gray-400">
        Press <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded mx-1">⌘K</kbd> for commands
      </div>
    </div>
  )
}
