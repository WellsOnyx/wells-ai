'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  X,
  Plus,
  Loader2,
  ExternalLink,
  Settings,
  AlertCircle,
  CheckCircle2,
  Link2,
  Unlink
} from 'lucide-react'

type Channel = 'sms' | 'imessage' | 'gmail' | 'outlook' | 'email' | 'slack' | 'discord' | 'twitter' | 'instagram' | 'linkedin' | 'whatsapp' | 'chat' | 'teams' | 'telegram'

interface Integration {
  id: string
  channel: Channel
  status: 'connected' | 'pending' | 'error' | 'disconnected'
  account_name?: string
  error_message?: string
  created_at: string
}

interface ChannelInfo {
  name: string
  icon: string
  color: string
  bgColor: string
}

interface IntegrationConfig {
  authType: 'oauth' | 'api_key' | 'webhook' | 'phone'
  requiredFields: string[]
  setupInstructions: string
}

// Field labels for user-friendly display
const FIELD_LABELS: Record<string, string> = {
  phone_number: 'Phone Number',
  api_key: 'API Key',
  api_key_id: 'API Key ID',
  from_email: 'From Email Address',
  webhook_url: 'Webhook URL',
  bot_token: 'Bot Token',
  business_account_id: 'Business Account ID',
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [channelInfo, setChannelInfo] = useState<Record<Channel, ChannelInfo>>({} as any)
  const [integrationConfig, setIntegrationConfig] = useState<Record<Channel, IntegrationConfig>>({} as any)
  const [isLoading, setIsLoading] = useState(true)
  const [connectingChannel, setConnectingChannel] = useState<Channel | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  // Fetch integrations
  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations')
      const data = await res.json()
      if (data.success) {
        setIntegrations(data.integrations || [])
        setChannelInfo(data.channelInfo || {})
        setIntegrationConfig(data.integrationConfig || {})
      }
    } catch (error) {
      console.error('Error fetching integrations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchIntegrations()
  }, [])

  // Get integration status for a channel
  const getIntegrationStatus = (channel: Channel): Integration | undefined => {
    return integrations.find(i => i.channel === channel)
  }

  // Connect channel
  const handleConnect = async (channel: Channel) => {
    const config = integrationConfig[channel]
    if (!config) return

    // For OAuth, redirect directly
    if (config.authType === 'oauth') {
      setConnectingChannel(channel)
      try {
        const res = await fetch('/api/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel })
        })
        const data = await res.json()
        if (data.success && data.oauthUrl) {
          window.location.href = data.oauthUrl
        } else {
          setError(data.error || 'Failed to initiate OAuth')
          setConnectingChannel(null)
        }
      } catch (err) {
        setError('Failed to connect')
        setConnectingChannel(null)
      }
      return
    }

    // For API key / webhook / phone, show modal
    setSelectedChannel(channel)
    setCredentials({})
    setError(null)
    setShowConnectModal(true)
  }

  // Submit credentials
  const handleSubmitCredentials = async () => {
    if (!selectedChannel) return

    setConnectingChannel(selectedChannel)
    setError(null)

    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel,
          credentials,
          accountName: credentials.phone_number || credentials.from_email || undefined
        })
      })
      const data = await res.json()

      if (data.success) {
        setShowConnectModal(false)
        fetchIntegrations()
      } else {
        setError(data.error || 'Failed to connect')
      }
    } catch (err) {
      setError('Failed to connect')
    } finally {
      setConnectingChannel(null)
    }
  }

  // Disconnect channel
  const handleDisconnect = async (channel: Channel) => {
    if (!confirm(`Are you sure you want to disconnect ${channelInfo[channel]?.name || channel}?`)) {
      return
    }

    try {
      await fetch(`/api/integrations?channel=${channel}`, {
        method: 'DELETE'
      })
      fetchIntegrations()
    } catch (err) {
      console.error('Error disconnecting:', err)
    }
  }

  // Get all channels grouped by category
  const channelCategories = {
    'Messaging': ['sms', 'imessage', 'whatsapp', 'telegram'] as Channel[],
    'Email': ['gmail', 'outlook', 'email'] as Channel[],
    'Social': ['twitter', 'instagram', 'linkedin'] as Channel[],
    'Workplace': ['slack', 'discord', 'teams'] as Channel[],
    'Website': ['chat'] as Channel[],
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/inbox" className="p-2 hover:bg-white/10 rounded-lg transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Channel Integrations</h1>
              <p className="text-sm text-gray-400">Connect your accounts to send and receive messages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Connected Summary */}
        <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="font-medium">
              {integrations.filter(i => i.status === 'connected').length} channels connected
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {integrations.filter(i => i.status === 'connected').map(int => (
              <span
                key={int.channel}
                className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm flex items-center gap-2"
              >
                <span>{channelInfo[int.channel]?.icon}</span>
                {channelInfo[int.channel]?.name}
              </span>
            ))}
          </div>
        </div>

        {/* Channel Categories */}
        {Object.entries(channelCategories).map(([category, channels]) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-300">{category}</h2>
            <div className="grid gap-3">
              {channels.map(channel => {
                const info = channelInfo[channel]
                const config = integrationConfig[channel]
                const integration = getIntegrationStatus(channel)
                const isConnected = integration?.status === 'connected'
                const isConnecting = connectingChannel === channel

                if (!info) return null

                return (
                  <div
                    key={channel}
                    className={`p-4 rounded-xl border transition ${
                      isConnected
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${info.bgColor} flex items-center justify-center text-2xl`}>
                          {info.icon}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {info.name}
                            {isConnected && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                Connected
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400">
                            {isConnected && integration.account_name
                              ? integration.account_name
                              : config?.setupInstructions.slice(0, 60) + '...'
                            }
                          </div>
                          {integration?.status === 'error' && (
                            <div className="text-sm text-red-400 flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3 h-3" />
                              {integration.error_message || 'Connection error'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <>
                            <button
                              onClick={() => handleDisconnect(channel)}
                              className="p-2 hover:bg-red-500/20 rounded-lg transition text-gray-400 hover:text-red-400"
                              title="Disconnect"
                            >
                              <Unlink className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleConnect(channel)}
                            disabled={isConnecting}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                          >
                            {isConnecting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Link2 className="w-4 h-4" />
                            )}
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Connect Modal */}
      {showConnectModal && selectedChannel && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-white/10 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${channelInfo[selectedChannel]?.bgColor} flex items-center justify-center text-xl`}>
                  {channelInfo[selectedChannel]?.icon}
                </div>
                <h3 className="text-lg font-semibold">
                  Connect {channelInfo[selectedChannel]?.name}
                </h3>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              {integrationConfig[selectedChannel]?.setupInstructions}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4 mb-6">
              {integrationConfig[selectedChannel]?.requiredFields.map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {FIELD_LABELS[field] || field}
                  </label>
                  <input
                    type={field.includes('token') || field.includes('key') ? 'password' : 'text'}
                    value={credentials[field] || ''}
                    onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                    placeholder={`Enter your ${FIELD_LABELS[field]?.toLowerCase() || field}`}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500 focus:outline-none transition"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConnectModal(false)}
                className="flex-1 px-4 py-3 border border-white/10 rounded-lg hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCredentials}
                disabled={connectingChannel === selectedChannel}
                className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {connectingChannel === selectedChannel ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
