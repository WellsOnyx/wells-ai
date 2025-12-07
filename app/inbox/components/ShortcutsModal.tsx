'use client'

import { X, Keyboard } from 'lucide-react'
import { SHORTCUT_DESCRIPTIONS } from '@/lib/inbox/keyboard-shortcuts'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null

  const groupedShortcuts = SHORTCUT_DESCRIPTIONS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, typeof SHORTCUT_DESCRIPTIONS>)

  const categoryLabels = {
    navigation: 'Navigation',
    actions: 'Actions',
    views: 'Views',
    ai: 'AI Features',
    'multi-select': 'Multi-select'
  }

  const categoryDescriptions = {
    navigation: 'Move around your inbox quickly',
    actions: 'Perform actions on messages',
    views: 'Switch between different views',
    ai: 'Use AI-powered features',
    'multi-select': 'Select multiple messages at once'
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div
          className="w-full max-w-4xl max-h-[85vh] bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Keyboard className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
                <p className="text-sm text-gray-400 mt-0.5">Master these to navigate like a pro</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6">
            <div className="grid grid-cols-2 gap-6">
              {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                <div key={category} className="space-y-3">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {categoryDescriptions[category as keyof typeof categoryDescriptions]}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.action}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors group"
                      >
                        <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                          {shortcut.description}
                        </span>
                        <kbd className="px-2.5 py-1 text-xs font-mono text-white bg-white/10 border border-white/20 rounded shadow-sm flex-shrink-0 ml-3">
                          {shortcut.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-white/5">
            <div className="flex items-center justify-between text-sm">
              <p className="text-gray-400">
                Press <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-xs">?</kbd> anytime to view shortcuts
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
