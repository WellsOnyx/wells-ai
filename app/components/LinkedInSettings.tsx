'use client'

/**
 * LinkedIn Integration Settings
 *
 * Allows users to connect their LinkedIn integration:
 * - Manual (copy-paste)
 * - Phantombuster (automated)
 * - Browser Extension (coming soon)
 */

import { useState, useEffect } from 'react'

interface LinkedInIntegration {
  connected: boolean
  provider: 'manual' | 'phantombuster' | 'browser-extension' | null
  dailyConnectionLimit: number
  dailyMessageLimit: number
}

export default function LinkedInSettings() {
  const [integration, setIntegration] = useState<LinkedInIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<'manual' | 'phantombuster' | 'browser-extension'>('manual')
  const [phantombusterApiKey, setPhantombusterApiKey] = useState('')

  // Fetch current integration status
  useEffect(() => {
    fetchIntegration()
  }, [])

  const fetchIntegration = async () => {
    try {
      const response = await fetch('/api/gtm/linkedin/connect')
      if (!response.ok) throw new Error('Failed to fetch integration')

      const data = await response.json()
      setIntegration(data)
    } catch (error) {
      console.error('Failed to fetch integration:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const credentials = selectedProvider === 'phantombuster' ? {
        phantombusterApiKey
      } : undefined

      const response = await fetch('/api/gtm/linkedin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          credentials
        })
      })

      if (!response.ok) throw new Error('Failed to connect')

      await fetchIntegration()
    } catch (error) {
      console.error('Failed to connect:', error)
      alert('Failed to connect LinkedIn integration')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect LinkedIn?')) return

    try {
      const response = await fetch('/api/gtm/linkedin/connect', {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to disconnect')

      await fetchIntegration()
    } catch (error) {
      console.error('Failed to disconnect:', error)
      alert('Failed to disconnect LinkedIn integration')
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="border-2 border-[#183b6d]/20 p-6" style={{ borderStyle: 'dashed' }}>
        {/* Sketch corner marks */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#183b6d]"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#183b6d]"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#183b6d]"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#183b6d]"></div>

        <h2 className="text-2xl font-bold text-[#183b6d] mb-4">LinkedIn Integration</h2>

        {integration?.connected ? (
          // Connected state
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-green-50 border-2 border-green-500 p-4" style={{ borderStyle: 'dashed' }}>
              <div>
                <p className="font-semibold text-green-900">Connected</p>
                <p className="text-sm text-green-700">
                  Provider: <span className="font-mono">{integration.provider}</span>
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Disconnect
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#fafbfc] border-2 border-[#183b6d]/20" style={{ borderStyle: 'dashed' }}>
                <p className="text-sm text-[#9ea1a7]">Daily Connection Limit</p>
                <p className="text-2xl font-bold text-[#183b6d]">{integration.dailyConnectionLimit}</p>
              </div>
              <div className="p-4 bg-[#fafbfc] border-2 border-[#183b6d]/20" style={{ borderStyle: 'dashed' }}>
                <p className="text-sm text-[#9ea1a7]">Daily Message Limit</p>
                <p className="text-2xl font-bold text-[#183b6d]">{integration.dailyMessageLimit}</p>
              </div>
            </div>

            {integration.provider === 'manual' && (
              <div className="p-4 bg-blue-50 border-2 border-blue-500" style={{ borderStyle: 'dashed' }}>
                <p className="text-sm text-blue-900">
                  <strong>Manual Mode:</strong> Wells will provide you with connection requests and messages to copy-paste into LinkedIn.
                </p>
              </div>
            )}

            {integration.provider === 'phantombuster' && (
              <div className="p-4 bg-purple-50 border-2 border-purple-500" style={{ borderStyle: 'dashed' }}>
                <p className="text-sm text-purple-900">
                  <strong>Automated Mode:</strong> Phantombuster will automatically send connection requests and messages on your behalf.
                </p>
              </div>
            )}
          </div>
        ) : (
          // Not connected state
          <div className="space-y-6">
            <p className="text-[#9ea1a7]">
              Connect your LinkedIn to enable GTM campaigns. Choose how you want to run your outreach:
            </p>

            {/* Provider selection */}
            <div className="space-y-3">
              <label className="flex items-start p-4 border-2 border-[#183b6d]/20 hover:border-[#dba63f] cursor-pointer transition-colors" style={{ borderStyle: 'dashed' }}>
                <input
                  type="radio"
                  name="provider"
                  value="manual"
                  checked={selectedProvider === 'manual'}
                  onChange={(e) => setSelectedProvider(e.target.value as any)}
                  className="mt-1 mr-3"
                />
                <div>
                  <p className="font-semibold text-[#183b6d]">Manual (Recommended)</p>
                  <p className="text-sm text-[#9ea1a7]">
                    Wells provides connection requests and messages. You copy-paste into LinkedIn.
                    Safest option, no risk of account restrictions.
                  </p>
                </div>
              </label>

              <label className="flex items-start p-4 border-2 border-[#183b6d]/20 hover:border-[#dba63f] cursor-pointer transition-colors" style={{ borderStyle: 'dashed' }}>
                <input
                  type="radio"
                  name="provider"
                  value="phantombuster"
                  checked={selectedProvider === 'phantombuster'}
                  onChange={(e) => setSelectedProvider(e.target.value as any)}
                  className="mt-1 mr-3"
                />
                <div>
                  <p className="font-semibold text-[#183b6d]">Phantombuster (Automated)</p>
                  <p className="text-sm text-[#9ea1a7]">
                    Fully automated using your Phantombuster account. Requires API key.
                  </p>
                </div>
              </label>

              <label className="flex items-start p-4 border-2 border-[#183b6d]/20 opacity-50 cursor-not-allowed" style={{ borderStyle: 'dashed' }}>
                <input
                  type="radio"
                  name="provider"
                  value="browser-extension"
                  disabled
                  className="mt-1 mr-3"
                />
                <div>
                  <p className="font-semibold text-[#183b6d]">Browser Extension (Coming Soon)</p>
                  <p className="text-sm text-[#9ea1a7]">
                    Semi-automated using a Chrome extension. One-click sending.
                  </p>
                </div>
              </label>
            </div>

            {/* Phantombuster API key input */}
            {selectedProvider === 'phantombuster' && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#183b6d]">
                  Phantombuster API Key
                </label>
                <input
                  type="password"
                  value={phantombusterApiKey}
                  onChange={(e) => setPhantombusterApiKey(e.target.value)}
                  placeholder="Enter your Phantombuster API key"
                  className="w-full px-4 py-2 border-2 border-[#183b6d]/20 focus:border-[#dba63f] focus:outline-none"
                  style={{ borderStyle: 'dashed' }}
                />
                <p className="text-xs text-[#9ea1a7]">
                  Find your API key in your Phantombuster dashboard
                </p>
              </div>
            )}

            {/* Connect button */}
            <button
              onClick={handleConnect}
              disabled={connecting || (selectedProvider === 'phantombuster' && !phantombusterApiKey)}
              className="w-full py-3 bg-[#dba63f] text-[#183b6d] font-bold hover:bg-[#dba63f]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {connecting ? 'Connecting...' : 'Connect LinkedIn'}
            </button>
          </div>
        )}
      </div>

      {/* BYOI Explanation */}
      <div className="p-4 bg-[#fafbfc] border-2 border-[#183b6d]/20" style={{ borderStyle: 'dashed' }}>
        <h3 className="font-semibold text-[#183b6d] mb-2">Bring Your Own Infrastructure (BYOI)</h3>
        <p className="text-sm text-[#9ea1a7] mb-2">
          You own your LinkedIn account and data. Wells provides:
        </p>
        <ul className="text-sm text-[#9ea1a7] space-y-1 ml-4">
          <li>→ 80-90% zone targeting (sweet spot, not 100%)</li>
          <li>→ Message templates following 20-year methodology</li>
          <li>→ Response classification and tracking</li>
          <li>→ Campaign orchestration and analytics</li>
        </ul>
      </div>
    </div>
  )
}
