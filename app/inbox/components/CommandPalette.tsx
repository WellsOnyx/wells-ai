'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search,
  Mail,
  Send,
  Archive,
  Trash,
  Star,
  Clock,
  Tag,
  Inbox,
  FileText,
  Settings,
  User,
  Building,
  Zap,
  Command
} from 'lucide-react'

interface Command {
  id: string
  label: string
  description?: string
  icon: any
  action: () => void
  category: 'navigation' | 'actions' | 'search' | 'settings'
  shortcut?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNavigate?: (path: string) => void
  onAction?: (action: string) => void
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onAction
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands: Command[] = [
    // Navigation
    {
      id: 'nav_inbox',
      label: 'Go to Inbox',
      icon: Inbox,
      action: () => onNavigate?.('/inbox'),
      category: 'navigation',
      shortcut: 'g i'
    },
    {
      id: 'nav_sent',
      label: 'Go to Sent',
      icon: Send,
      action: () => onNavigate?.('/inbox/sent'),
      category: 'navigation',
      shortcut: 'g s'
    },
    {
      id: 'nav_drafts',
      label: 'Go to Drafts',
      icon: FileText,
      action: () => onNavigate?.(  '/inbox/drafts'),
      category: 'navigation',
      shortcut: 'g d'
    },
    {
      id: 'nav_archive',
      label: 'Go to Archive',
      icon: Archive,
      action: () => onNavigate?.('/inbox/archive'),
      category: 'navigation',
      shortcut: 'g a'
    },
    {
      id: 'nav_trash',
      label: 'Go to Trash',
      icon: Trash,
      action: () => onNavigate?.('/inbox/trash'),
      category: 'navigation',
      shortcut: 'g t'
    },

    // Actions
    {
      id: 'action_compose',
      label: 'Compose New Message',
      icon: Mail,
      action: () => onAction?.('compose'),
      category: 'actions',
      shortcut: 'c'
    },
    {
      id: 'action_archive',
      label: 'Archive Selected',
      icon: Archive,
      action: () => onAction?.('archive'),
      category: 'actions',
      shortcut: 'e'
    },
    {
      id: 'action_star',
      label: 'Star Selected',
      icon: Star,
      action: () => onAction?.('star'),
      category: 'actions',
      shortcut: 's'
    },
    {
      id: 'action_snooze',
      label: 'Snooze Selected',
      icon: Clock,
      action: () => onAction?.('snooze'),
      category: 'actions',
      shortcut: 'h'
    },
    {
      id: 'action_trash',
      label: 'Move to Trash',
      icon: Trash,
      action: () => onAction?.('trash'),
      category: 'actions',
      shortcut: '#'
    },
    {
      id: 'action_label',
      label: 'Add Label',
      icon: Tag,
      action: () => onAction?.('label'),
      category: 'actions',
      shortcut: 'l'
    },

    // Search
    {
      id: 'search_contacts',
      label: 'Search Contacts',
      icon: User,
      action: () => onAction?.('search_contacts'),
      category: 'search'
    },
    {
      id: 'search_companies',
      label: 'Search Companies',
      icon: Building,
      action: () => onAction?.('search_companies'),
      category: 'search'
    },

    // Settings
    {
      id: 'settings_accounts',
      label: 'Manage Accounts',
      icon: Settings,
      action: () => onNavigate?.('/inbox/settings'),
      category: 'settings'
    },
    {
      id: 'settings_shortcuts',
      label: 'Keyboard Shortcuts',
      icon: Command,
      action: () => onAction?.('show_shortcuts'),
      category: 'settings',
      shortcut: '?'
    },
  ]

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase()) ||
        cmd.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = []
    }
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, Command[]>)

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    search: 'Search',
    settings: 'Settings'
  }

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selectedCommand = filteredCommands[selectedIndex]
      if (selectedCommand) {
        selectedCommand.action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4 pointer-events-none">
        <div
          className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-in zoom-in-95 slide-in-from-top-4 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-white placeholder:text-gray-500 outline-none text-lg"
            />
            <kbd className="px-2 py-1 text-xs text-gray-500 bg-white/5 border border-white/10 rounded">
              ESC
            </kbd>
          </div>

          {/* Command List */}
          <div ref={listRef} className="max-h-[400px] overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Zap className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No commands found</p>
                <p className="text-sm text-gray-600 mt-1">Try a different search</p>
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, cmds]) => (
                <div key={category} className="py-2">
                  <div className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {categoryLabels[category]}
                  </div>
                  {cmds.map((command, index) => {
                    const globalIndex = filteredCommands.indexOf(command)
                    const isSelected = globalIndex === selectedIndex
                    const Icon = command.icon

                    return (
                      <button
                        key={command.id}
                        data-index={globalIndex}
                        onClick={() => {
                          command.action()
                          onClose()
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full px-6 py-3 flex items-center gap-3 transition-colors ${
                          isSelected
                            ? 'bg-amber-500/20 border-l-2 border-l-amber-500'
                            : 'hover:bg-white/5 border-l-2 border-l-transparent'
                        }`}
                      >
                        <Icon className={`w-5 h-5 flex-shrink-0 ${
                          isSelected ? 'text-amber-400' : 'text-gray-400'
                        }`} />
                        <div className="flex-1 text-left min-w-0">
                          <div className={`font-medium truncate ${
                            isSelected ? 'text-white' : 'text-gray-200'
                          }`}>
                            {command.label}
                          </div>
                          {command.description && (
                            <div className="text-sm text-gray-500 truncate">
                              {command.description}
                            </div>
                          )}
                        </div>
                        {command.shortcut && (
                          <kbd className="px-2 py-1 text-xs text-gray-500 bg-white/5 border border-white/10 rounded flex-shrink-0">
                            {command.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">↓</kbd>
                <span>to navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">↵</kbd>
                <span>to select</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">⌘K</kbd>
              <span>to open</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
