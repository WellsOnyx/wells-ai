'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Linkedin,
  MessageSquare,
  Check,
  Plus,
  Trash2,
  Settings,
  Bell,
  Keyboard,
  Sparkles,
  User,
  ChevronRight,
  Key,
  Loader2
} from 'lucide-react'
import { SHORTCUT_DESCRIPTIONS } from '@/lib/inbox/keyboard-shortcuts'

interface ConnectedAccount {
  id: string
  email: string
  provider: 'gmail' | 'outlook' | 'linkedin' | 'slack'
  status: 'active' | 'error' | 'syncing'
  lastSync?: string
}

const PROVIDER_INFO = {
  gmail: {
    name: 'Gmail',
    icon: Mail,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    connectUrl: '/api/inbox/gmail/auth'
  },
  outlook: {
    name: 'Outlook',
    icon: Mail,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    connectUrl: '/api/integrations/outlook/auth'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    connectUrl: '/api/integrations/linkedin/auth'
  },
  slack: {
    name: 'Slack',
    icon: MessageSquare,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    connectUrl: '/api/integrations/slack/oauth'
  }
}

export default function InboxSettingsPage() {
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([])

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    desktop: false,
    sound: true
  })

  const [aiPreferences, setAIPreferences] = useState({
    autoSummarize: true,
    priorityDetection: true,
    smartReply: true,
    autoCategories: true
  })

  const [activeTab, setActiveTab] = useState<'accounts' | 'notifications' | 'shortcuts' | 'ai'>('accounts')

  const handleConnectAccount = async (provider: keyof typeof PROVIDER_INFO) => {
    const info = PROVIDER_INFO[provider]
    setConnecting(provider)

    try {
      // Call the auth API to get the OAuth URL
      // The API will get userId from Clerk session
      const response = await fetch(info.connectUrl)
      const data = await response.json()

      if (data.success && data.authUrl) {
        // Redirect to OAuth provider
        window.location.href = data.authUrl
      } else if (data.error?.includes('Unauthorized') || response.status === 401) {
        alert('Please sign in first')
        window.location.href = '/sign-in'
      } else {
        alert(data.error || 'Failed to start authentication')
        setConnecting(null)
      }
    } catch (error) {
      console.error('Connect error:', error)
      alert('Failed to connect. Please try again.')
      setConnecting(null)
    }
  }

  const handleDisconnectAccount = (accountId: string) => {
    if (confirm('Are you sure you want to disconnect this account?')) {
      setConnectedAccounts(prev => prev.filter(a => a.id !== accountId))
    }
  }

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

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/inbox"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Inbox Settings</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage your inbox preferences and connected accounts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('accounts')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'accounts'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <User className="w-4 h-4" />
                Connected Accounts
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'notifications'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Bell className="w-4 h-4" />
                Notifications
              </button>
              <button
                onClick={() => setActiveTab('shortcuts')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'shortcuts'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                Keyboard Shortcuts
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'ai'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                AI Preferences
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Connected Accounts */}
            {activeTab === 'accounts' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">Connected Accounts</h2>
                  <p className="text-sm text-gray-400">Manage email and messaging accounts synced to your inbox</p>
                </div>

                {/* Connected Accounts List */}
                <div className="space-y-3">
                  {connectedAccounts.map((account) => {
                    const info = PROVIDER_INFO[account.provider]
                    const Icon = info.icon
                    return (
                      <div
                        key={account.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                      >
                        <div className={`p-3 rounded-lg ${info.bg}`}>
                          <Icon className={`w-5 h-5 ${info.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white">{account.email}</h3>
                            {account.status === 'active' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs border border-green-500/30">
                                <Check className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 mt-0.5">{info.name}</p>
                          {account.lastSync && (
                            <p className="text-xs text-gray-500 mt-1">
                              Last synced: {new Date(account.lastSync).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDisconnectAccount(account.id)}
                          className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Add New Account */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Add Account</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(PROVIDER_INFO).map(([key, info]) => {
                      const Icon = info.icon
                      const isConnected = connectedAccounts.some(a => a.provider === key)
                      return (
                        <button
                          key={key}
                          onClick={() => !isConnected && handleConnectAccount(key as any)}
                          disabled={isConnected}
                          className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Icon className={`w-5 h-5 ${info.color}`} />
                          <div className="flex-1 text-left">
                            <div className="font-medium text-white text-sm">{info.name}</div>
                          </div>
                          {!isConnected && <Plus className="w-4 h-4 text-gray-400" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">Notification Preferences</h2>
                  <p className="text-sm text-gray-400">Choose how you want to be notified about new messages</p>
                </div>

                <div className="space-y-3">
                  {Object.entries(notifications).map(([key, value]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-medium text-white capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">
                          {key === 'email' && 'Get email notifications for new messages'}
                          {key === 'push' && 'Receive push notifications on mobile'}
                          {key === 'desktop' && 'Show desktop notifications'}
                          {key === 'sound' && 'Play sound for new messages'}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Keyboard Shortcuts */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">Keyboard Shortcuts</h2>
                  <p className="text-sm text-gray-400">Master these shortcuts to navigate faster</p>
                </div>

                <div className="space-y-6">
                  {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        {categoryLabels[category as keyof typeof categoryLabels]}
                      </h3>
                      <div className="space-y-2">
                        {shortcuts.map((shortcut) => (
                          <div
                            key={shortcut.action}
                            className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                          >
                            <span className="text-sm text-gray-300">{shortcut.description}</span>
                            <kbd className="px-3 py-1.5 text-xs font-mono text-white bg-white/10 border border-white/20 rounded-md">
                              {shortcut.key}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Preferences */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">AI Preferences</h2>
                  <p className="text-sm text-gray-400">Customize how AI assists you with your inbox</p>
                </div>

                <div className="space-y-3">
                  {Object.entries(aiPreferences).map(([key, value]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-medium text-white capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">
                          {key === 'autoSummarize' && 'Automatically generate summaries for long threads'}
                          {key === 'priorityDetection' && 'Detect and highlight urgent/important messages'}
                          {key === 'smartReply' && 'Suggest AI-powered quick replies'}
                          {key === 'autoCategories' && 'Automatically categorize messages (leads, support, etc.)'}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setAIPreferences({ ...aiPreferences, [key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
