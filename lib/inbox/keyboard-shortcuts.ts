/**
 * Superhuman-style keyboard shortcuts for Wells Inbox
 */

export const SHORTCUTS = {
  // Navigation
  'j': 'next_thread',
  'k': 'previous_thread',
  'o': 'open_thread',
  'Enter': 'open_thread',
  'u': 'back_to_list',
  'Escape': 'close',

  // Actions
  'e': 'archive',
  '#': 'trash',
  's': 'star',
  'x': 'select',
  'v': 'mark_unread',
  'h': 'snooze',
  'l': 'label',
  'r': 'reply',
  'a': 'reply_all',
  'f': 'forward',
  'c': 'compose',

  // Views
  'g i': 'go_to_inbox',
  'g s': 'go_to_sent',
  'g d': 'go_to_drafts',
  'g a': 'go_to_all',
  'g t': 'go_to_trash',

  // Search & Command
  '/': 'search',
  'Meta+k': 'command_palette',
  'Ctrl+k': 'command_palette',
  '?': 'show_shortcuts',

  // AI Features
  'i': 'ai_summary',
  'w': 'ai_write',

  // Multi-select
  'Shift+j': 'select_next',
  'Shift+k': 'select_previous',
  '*+a': 'select_all',
  '*+n': 'select_none',
  '*+r': 'select_read',
  '*+u': 'select_unread',
} as const

export type ShortcutAction = typeof SHORTCUTS[keyof typeof SHORTCUTS]

export interface KeyboardShortcutConfig {
  key: string
  action: ShortcutAction
  description: string
  category: 'navigation' | 'actions' | 'views' | 'ai' | 'multi-select'
}

export const SHORTCUT_DESCRIPTIONS: KeyboardShortcutConfig[] = [
  // Navigation
  { key: 'j', action: 'next_thread', description: 'Next thread', category: 'navigation' },
  { key: 'k', action: 'previous_thread', description: 'Previous thread', category: 'navigation' },
  { key: 'o / Enter', action: 'open_thread', description: 'Open thread', category: 'navigation' },
  { key: 'u', action: 'back_to_list', description: 'Back to list', category: 'navigation' },
  { key: 'Esc', action: 'close', description: 'Close / Cancel', category: 'navigation' },

  // Actions
  { key: 'e', action: 'archive', description: 'Archive', category: 'actions' },
  { key: '#', action: 'trash', description: 'Trash', category: 'actions' },
  { key: 's', action: 'star', description: 'Star / Unstar', category: 'actions' },
  { key: 'v', action: 'mark_unread', description: 'Mark unread', category: 'actions' },
  { key: 'h', action: 'snooze', description: 'Snooze', category: 'actions' },
  { key: 'l', action: 'label', description: 'Add label', category: 'actions' },
  { key: 'r', action: 'reply', description: 'Reply', category: 'actions' },
  { key: 'a', action: 'reply_all', description: 'Reply all', category: 'actions' },
  { key: 'f', action: 'forward', description: 'Forward', category: 'actions' },
  { key: 'c', action: 'compose', description: 'Compose', category: 'actions' },

  // Views
  { key: 'g i', action: 'go_to_inbox', description: 'Go to Inbox', category: 'views' },
  { key: 'g s', action: 'go_to_sent', description: 'Go to Sent', category: 'views' },
  { key: 'g d', action: 'go_to_drafts', description: 'Go to Drafts', category: 'views' },
  { key: 'g a', action: 'go_to_all', description: 'Go to All Mail', category: 'views' },
  { key: 'g t', action: 'go_to_trash', description: 'Go to Trash', category: 'views' },

  // AI Features
  { key: 'i', action: 'ai_summary', description: 'AI Summary', category: 'ai' },
  { key: 'w', action: 'ai_write', description: 'AI Write', category: 'ai' },

  // Multi-select
  { key: '* a', action: 'select_all', description: 'Select all', category: 'multi-select' },
  { key: '* n', action: 'select_none', description: 'Select none', category: 'multi-select' },
  { key: '* r', action: 'select_read', description: 'Select read', category: 'multi-select' },
  { key: '* u', action: 'select_unread', description: 'Select unread', category: 'multi-select' },
]

/**
 * Hook for keyboard shortcuts
 */
export class KeyboardShortcutHandler {
  private listeners: Map<ShortcutAction, Array<() => void>> = new Map()
  private sequenceBuffer: string[] = []
  private sequenceTimeout: NodeJS.Timeout | null = null
  private enabled = true

  constructor() {
    if (typeof window !== 'undefined') {
      this.attachGlobalListener()
    }
  }

  private attachGlobalListener() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this))
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled) return

    // Don't capture if typing in input
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Exception: allow Escape and Cmd+K
      if (e.key !== 'Escape' && !(e.metaKey && e.key === 'k') && !(e.ctrlKey && e.key === 'k')) {
        return
      }
    }

    // Build key combination
    let keyCombo = ''
    if (e.metaKey) keyCombo += 'Meta+'
    if (e.ctrlKey) keyCombo += 'Ctrl+'
    if (e.altKey) keyCombo += 'Alt+'
    if (e.shiftKey && e.key !== 'Shift') keyCombo += 'Shift+'
    keyCombo += e.key

    // Handle sequences (like 'g i')
    if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
      this.addToSequence(e.key)
      const sequence = this.sequenceBuffer.join(' ')

      // Check if sequence matches any shortcut
      for (const [combo, action] of Object.entries(SHORTCUTS)) {
        if (combo === sequence) {
          e.preventDefault()
          this.trigger(action)
          this.clearSequence()
          return
        }
      }
    }

    // Single key shortcut
    const action = SHORTCUTS[keyCombo as keyof typeof SHORTCUTS]
    if (action) {
      e.preventDefault()
      this.trigger(action)
      this.clearSequence()
    }
  }

  private addToSequence(key: string) {
    this.sequenceBuffer.push(key)

    // Auto-clear sequence after 1 second
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout)
    }
    this.sequenceTimeout = setTimeout(() => {
      this.clearSequence()
    }, 1000)
  }

  private clearSequence() {
    this.sequenceBuffer = []
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout)
      this.sequenceTimeout = null
    }
  }

  on(action: ShortcutAction, callback: () => void) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, [])
    }
    this.listeners.get(action)!.push(callback)
  }

  off(action: ShortcutAction, callback: () => void) {
    const callbacks = this.listeners.get(action)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  trigger(action: ShortcutAction) {
    const callbacks = this.listeners.get(action)
    if (callbacks) {
      callbacks.forEach(cb => cb())
    }
  }

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }

  destroy() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.handleKeyDown.bind(this))
    }
    this.listeners.clear()
    this.clearSequence()
  }
}

// Global instance
let globalHandler: KeyboardShortcutHandler | null = null

export function getKeyboardHandler(): KeyboardShortcutHandler {
  if (!globalHandler && typeof window !== 'undefined') {
    globalHandler = new KeyboardShortcutHandler()
  }
  return globalHandler!
}
