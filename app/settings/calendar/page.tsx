'use client'

/**
 * Calendar Settings Page
 * Allows users to connect/disconnect their Cal.com calendar
 */

import { useState, useEffect } from 'react'

export default function CalendarSettingsPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/calendar/status')
      const data = await response.json()

      setIsConnected(data.connected)
      setCalendarEmail(data.calendarEmail)
    } catch (err) {
      console.error('Failed to check calendar status:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/calendar/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, provider: 'calcom' }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Calendar connected successfully!')
        setIsConnected(true)
        setCalendarEmail(data.connection.calendarEmail)
        setApiKey('')
      } else {
        setError(data.error || 'Failed to connect calendar')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your calendar?')) {
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/calendar/disconnect?provider=calcom', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Calendar disconnected successfully')
        setIsConnected(false)
        setCalendarEmail(null)
      } else {
        setError(data.error || 'Failed to disconnect calendar')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white shadow rounded-lg p-8">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Calendar Integration
          </h1>
          <p className="text-gray-600 mb-6">
            Connect your Cal.com calendar to enable AI-powered meeting scheduling
          </p>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {isConnected ? (
            <div>
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center">
                  <svg
                    className="h-5 w-5 text-green-500 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Calendar Connected
                    </p>
                    {calendarEmail && (
                      <p className="text-sm text-green-700">{calendarEmail}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    What you can do now:
                  </h3>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Ask Wells AI to schedule meetings for you</li>
                    <li>Automatically send calendar invites to participants</li>
                    <li>Generate video conference links for meetings</li>
                    <li>Check your availability before booking</li>
                  </ul>
                </div>

                <div className="pt-4 border-t">
                  <button
                    onClick={handleDisconnect}
                    disabled={submitting}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
                  >
                    {submitting ? 'Disconnecting...' : 'Disconnect Calendar'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="apiKey"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Cal.com API Key
                  </label>
                  <input
                    type="password"
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="cal_live_..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Get your API key from{' '}
                    <a
                      href="https://app.cal.com/settings/developer/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Cal.com Settings
                    </a>
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting || !apiKey}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Connecting...' : 'Connect Calendar'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              How it works
            </h3>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>Connect your Cal.com account with an API key</li>
              <li>Chat with Wells AI and ask to schedule a meeting</li>
              <li>AI automatically creates calendar events and sends invites</li>
              <li>Meetings include video conference links</li>
            </ol>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-900 mb-1">
              Why Cal.com?
            </h3>
            <p className="text-sm text-blue-800">
              Cal.com provides built-in video conferencing, simple API integration,
              and no OAuth complexity. Your API key is encrypted and stored securely.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
