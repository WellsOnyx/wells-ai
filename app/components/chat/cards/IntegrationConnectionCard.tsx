/**
 * Integration Connection Card
 * Inline UI for connecting integrations conversationally
 */

'use client'

import { useState } from 'react'
import Button from '@/app/components/Button'
import LoadingSpinner from '@/app/components/LoadingSpinner'

interface IntegrationConnectionCardProps {
  data: {
    integration: 'instantly' | 'clay' | 'apollo' | 'phantombuster' | 'twilio' | 'notion'
    action: 'connect' | 'disconnect' | 'view' | 'test'
    currentStatus?: {
      connected: boolean
      lastTested?: string
      testStatus?: 'success' | 'failed'
    }
    instructions?: {
      title: string
      steps: string[]
      apiKeyLocation: string
      requiredFields: string[]
    }
  }
}

export default function IntegrationConnectionCard({ data }: IntegrationConnectionCardProps) {
  const [apiKey, setApiKey] = useState('')
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  const integrationNames: Record<typeof data.integration, string> = {
    instantly: 'Instantly.ai',
    clay: 'Clay.earth',
    apollo: 'Apollo.io',
    phantombuster: 'PhantomBuster',
    twilio: 'Twilio',
    notion: 'Notion'
  }

  const integrationName = integrationNames[data.integration]

  const handleConnect = async () => {
    if (!apiKey && data.integration !== 'twilio') {
      setResult({ success: false, message: 'Please enter your API key' })
      return
    }

    if (data.integration === 'twilio' && (!accountSid || !authToken)) {
      setResult({ success: false, message: 'Please enter both Account SID and Auth Token' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const credentials: any = {}

      if (data.integration === 'twilio') {
        credentials.accountSid = accountSid
        credentials.authToken = authToken
      } else {
        credentials.apiKey = apiKey
      }

      const response = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration: data.integration,
          credentials
        })
      })

      const responseData = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: `✅ ${integrationName} connected successfully! ${responseData.accountInfo || ''}`
        })
        // Clear sensitive fields
        setApiKey('')
        setAccountSid('')
        setAuthToken('')
      } else {
        setResult({
          success: false,
          message: responseData.error || `Failed to connect ${integrationName}`
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: `Error: ${error.message}`
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration: data.integration
        })
      })

      const responseData = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: `✅ ${integrationName} connection is working! ${responseData.details || ''}`
        })
      } else {
        setResult({
          success: false,
          message: responseData.error || `${integrationName} connection test failed`
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: `Error: ${error.message}`
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm(`Disconnect ${integrationName}? This will remove your saved credentials.`)) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration: data.integration
        })
      })

      if (response.ok) {
        setResult({
          success: true,
          message: `🗑️  ${integrationName} disconnected`
        })
      } else {
        const responseData = await response.json()
        setResult({
          success: false,
          message: responseData.error || `Failed to disconnect ${integrationName}`
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: `Error: ${error.message}`
      })
    } finally {
      setLoading(false)
    }
  }

  // VIEW mode - show current status
  if (data.action === 'view' && data.currentStatus) {
    return (
      <div className="border border-wells-blue/30 rounded-sm p-6 bg-gradient-to-br from-wells-blue/5 to-wells-gold/5 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">
            {data.currentStatus.connected ? '✅' : '🔌'}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-wells-blue mb-1">
              {integrationName}
            </h3>
            <p className="text-sm text-gray-600">
              {data.currentStatus.connected ? 'Connected' : 'Not connected'}
            </p>
            {data.currentStatus.lastTested && (
              <p className="text-xs text-gray-500 mt-1">
                Last tested: {new Date(data.currentStatus.lastTested).toLocaleString()}
                {data.currentStatus.testStatus && (
                  <span className={`ml-2 ${data.currentStatus.testStatus === 'success' ? 'text-wells-success' : 'text-wells-error'}`}>
                    ({data.currentStatus.testStatus})
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {data.currentStatus.connected && (
          <div className="flex gap-2">
            <Button onClick={handleTest} variant="outline" size="sm" isLoading={loading}>
              Test Connection
            </Button>
            <Button onClick={handleDisconnect} variant="danger" size="sm" isLoading={loading}>
              Disconnect
            </Button>
          </div>
        )}

        {result && (
          <div className={`mt-4 p-3 rounded-sm text-sm ${result.success ? 'bg-wells-success/10 text-wells-success border border-wells-success/20' : 'bg-wells-error/10 text-wells-error border border-wells-error/20'}`}>
            {result.message}
          </div>
        )}
      </div>
    )
  }

  // CONNECT mode
  return (
    <div className="border border-wells-gold/30 rounded-sm p-6 bg-gradient-to-br from-wells-blue/5 to-wells-gold/5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-2xl">🔌</div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-wells-blue mb-1">
            Connect {integrationName}
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Connect your {integrationName} account to enable automated outreach
          </p>

          {data.instructions && (
            <Button
              onClick={() => setShowInstructions(!showInstructions)}
              variant="ghost"
              size="sm"
            >
              {showInstructions ? '▼' : '▶'} How to find your API key
            </Button>
          )}
        </div>
      </div>

      {showInstructions && data.instructions && (
        <div className="mb-4 p-4 bg-wells-blue/5 border border-wells-blue/20 rounded-sm">
          <h4 className="font-medium text-sm text-wells-blue mb-2">Setup Instructions:</h4>
          <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
            {data.instructions.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
          <a
            href={data.instructions.apiKeyLocation}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm text-wells-blue hover:text-wells-gold transition-colors"
          >
            Open {integrationName} Settings →
          </a>
        </div>
      )}

      {!result && (
        <div className="space-y-3">
          {data.integration === 'twilio' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account SID
                </label>
                <input
                  type="password"
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={loading}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-wells-gold transition-all text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Auth Token
                </label>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  disabled={loading}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-wells-gold transition-all text-sm disabled:opacity-50"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key here..."
                disabled={loading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-wells-gold transition-all text-sm disabled:opacity-50"
              />
            </div>
          )}

          <Button
            onClick={handleConnect}
            variant="primary"
            fullWidth
            isLoading={loading}
          >
            {loading ? 'Connecting...' : `Connect ${integrationName}`}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            🔒 Your credentials are encrypted and never shared
          </p>
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-sm text-sm ${result.success ? 'bg-wells-success/10 text-wells-success border border-wells-success/20' : 'bg-wells-error/10 text-wells-error border border-wells-error/20'}`}>
          {result.message}
          {result.success && (
            <p className="text-xs mt-2 text-green-700">
              You can now use {integrationName} for automated outreach
            </p>
          )}
        </div>
      )}
    </div>
  )
}
