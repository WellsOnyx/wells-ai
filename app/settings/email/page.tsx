'use client'

/**
 * Email Settings Page
 * Configure email providers (Gmail, Instantly, Resend, SMTP)
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface EmailProvider {
  id: string
  name: string
  type: 'GMAIL_OAUTH' | 'RESEND' | 'SMTP' | 'INSTANTLY'
  connected: boolean
  email?: string
  status?: 'SUCCESS' | 'FAILED' | 'PENDING'
}

export default function EmailSettingsPage() {
  const searchParams = useSearchParams()
  const [providers, setProviders] = useState<EmailProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [testEmail, setTestEmail] = useState('')
  const [testStatus, setTestStatus] = useState<{
    loading: boolean
    success?: boolean
    message?: string
  }>({ loading: false })

  // Handle OAuth callback messages
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const email = searchParams.get('email')

    if (success === 'gmail_connected') {
      alert(`Gmail connected successfully! ${email || ''}`)
      loadProviders()
    } else if (error) {
      const message = searchParams.get('message') || error
      alert(`Error: ${message}`)
    }
  }, [searchParams])

  // Load email providers
  const loadProviders = async () => {
    try {
      const res = await fetch('/api/settings/email')
      if (res.ok) {
        const data = await res.json()

        // Map to provider format
        const providerList: EmailProvider[] = []

        if (data.config) {
          providerList.push({
            id: data.config.provider,
            name: getProviderName(data.config.provider),
            type: data.config.provider,
            connected: true,
            email: data.config.fromEmail,
            status: data.config.testStatus
          })
        }

        // Add disconnected providers
        const allProviders = ['GMAIL_OAUTH', 'INSTANTLY', 'RESEND', 'SMTP']
        allProviders.forEach(p => {
          if (!providerList.find(pr => pr.type === p)) {
            providerList.push({
              id: p,
              name: getProviderName(p),
              type: p as any,
              connected: false
            })
          }
        })

        setProviders(providerList)
      }
    } catch (error) {
      console.error('Failed to load providers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProviders()
  }, [])

  const getProviderName = (type: string): string => {
    const names: Record<string, string> = {
      GMAIL_OAUTH: 'Gmail',
      INSTANTLY: 'Instantly',
      RESEND: 'Resend',
      SMTP: 'SMTP'
    }
    return names[type] || type
  }

  const handleConnectGmail = () => {
    window.location.href = '/api/auth/gmail/authorize'
  }

  const handleTestEmail = async (provider: EmailProvider) => {
    if (!testEmail) {
      alert('Please enter a test email address')
      return
    }

    setTestStatus({ loading: true })

    try {
      const res = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail })
      })

      const data = await res.json()

      setTestStatus({
        loading: false,
        success: data.success,
        message: data.message
      })

      if (data.success) {
        loadProviders()
      }
    } catch (error) {
      setTestStatus({
        loading: false,
        success: false,
        message: 'Failed to send test email'
      })
    }
  }

  const handleDisconnect = async (provider: EmailProvider) => {
    if (!confirm(`Disconnect ${provider.name}?`)) return

    try {
      const res = await fetch('/api/settings/email/delete', {
        method: 'DELETE'
      })

      if (res.ok) {
        loadProviders()
      }
    } catch (error) {
      console.error('Failed to disconnect provider:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Loading email settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Email Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure your email providers for outreach campaigns
          </p>
        </div>

        {/* Provider Cards */}
        <div className="space-y-4">
          {providers.map(provider => (
            <div
              key={provider.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    provider.connected ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {provider.connected ? (
                      <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {provider.name}
                    </h3>
                    {provider.connected ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-sm text-gray-600">{provider.email}</p>
                        {provider.status === 'SUCCESS' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Verified
                          </span>
                        )}
                        {provider.status === 'FAILED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Failed
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mt-1">Not connected</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {provider.connected ? (
                    <>
                      <button
                        onClick={() => handleDisconnect(provider)}
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <>
                      {provider.type === 'GMAIL_OAUTH' && (
                        <button
                          onClick={handleConnectGmail}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                        >
                          Connect Gmail
                        </button>
                      )}
                      {provider.type === 'INSTANTLY' && (
                        <button
                          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
                        >
                          Configure Instantly
                        </button>
                      )}
                      {(provider.type === 'RESEND' || provider.type === 'SMTP') && (
                        <button
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-lg"
                        >
                          Configure
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Provider Description */}
              <div className="mt-4 text-sm text-gray-600">
                {provider.type === 'GMAIL_OAUTH' && (
                  <p>Best for 1:1 high-value outreach. Maximum deliverability, sends from your Gmail account.</p>
                )}
                {provider.type === 'INSTANTLY' && (
                  <p>Perfect for automated sequences with 3-7 email follow-ups. Track opens, clicks, and replies.</p>
                )}
                {provider.type === 'RESEND' && (
                  <p>Reliable transactional email delivery via API.</p>
                )}
                {provider.type === 'SMTP' && (
                  <p>Connect your own SMTP server for custom email delivery.</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Test Email Section */}
        {providers.some(p => p.connected) && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Test Email Configuration
            </h3>

            <div className="flex items-center space-x-4">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your-email@example.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => handleTestEmail(providers.find(p => p.connected)!)}
                disabled={testStatus.loading || !testEmail}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testStatus.loading ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>

            {testStatus.message && (
              <div className={`mt-4 p-4 rounded-lg ${
                testStatus.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {testStatus.message}
              </div>
            )}
          </div>
        )}

        {/* Wells AI Suggestion */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-blue-900">Wells AI Recommendation</h4>
              <p className="text-sm text-blue-800 mt-1">
                For Wells Onyx's exec search GTM: Connect Gmail for high-value 1:1 outreach to decision-makers,
                and configure Instantly for automated follow-up sequences. This combo maximizes response rates
                while staying within Gmail's 500 emails/day limit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
