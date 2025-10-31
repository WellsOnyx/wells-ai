'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

interface GTMSettings {
  notionApiKey: string
  notionDealsDbId: string
  instantlyApiKey: string
  instantlyCampaignId: string
  twilioFrom: string
}

export default function GTMSettingsPage() {
  const { user } = useUser()
  const [settings, setSettings] = useState<GTMSettings>({
    notionApiKey: '',
    notionDealsDbId: '',
    instantlyApiKey: '',
    instantlyCampaignId: '',
    twilioFrom: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  useEffect(() => {
    if (user?.unsafeMetadata) {
      const metadata = user.unsafeMetadata as any
      setSettings({
        notionApiKey: metadata.notionApiKey || '',
        notionDealsDbId: metadata.notionDealsDbId || '',
        instantlyApiKey: metadata.instantlyApiKey || '',
        instantlyCampaignId: metadata.instantlyCampaignId || '',
        twilioFrom: metadata.twilioFrom || '',
      })
    }
  }, [user])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const response = await fetch('/api/settings/gtm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error saving settings:', err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async (service: 'notion' | 'instantly' | 'twilio') => {
    setTestingConnection(service)
    setTestResults((prev) => ({ ...prev, [service]: { success: false, message: 'Testing...' } }))

    try {
      const response = await fetch('/api/settings/gtm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, settings }),
      })

      const data = await response.json()

      if (!response.ok) {
        setTestResults((prev) => ({
          ...prev,
          [service]: { success: false, message: data.error || 'Connection failed' },
        }))
      } else {
        setTestResults((prev) => ({
          ...prev,
          [service]: { success: true, message: data.message || 'Connection successful!' },
        }))
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [service]: { success: false, message: err.message },
      }))
    } finally {
      setTestingConnection(null)
    }
  }

  const isNotionConfigured = settings.notionApiKey && settings.notionDealsDbId
  const isInstantlyConfigured = settings.instantlyApiKey
  const isTwilioConfigured = settings.twilioFrom

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#575757] hover:text-[#183b6d] mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Wells AI
          </Link>
          <h1 className="text-3xl font-serif text-[#183b6d] mb-2">GTM Settings</h1>
          <p className="text-sm text-[#575757]">
            Configure your API keys and integrations for the Wells AI GTM system
          </p>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-sm">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-green-900">Settings saved successfully!</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-medium text-red-900 mb-1">Error Saving Settings</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notion Settings */}
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-medium text-[#183b6d] mb-1">Notion Integration</h2>
              <p className="text-sm text-[#575757]">
                Connect your Notion database to analyze your Ideal Customer Profile
              </p>
            </div>
            {isNotionConfigured && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-sm font-medium">
                ✓ Configured
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#183b6d] mb-2">
                Notion API Key *
              </label>
              <input
                type="password"
                value={settings.notionApiKey}
                onChange={(e) => setSettings({ ...settings, notionApiKey: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors text-sm"
                placeholder="secret_xxxxxxxxxxxx"
              />
              <p className="text-xs text-[#575757] mt-1">
                Get your API key from{' '}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#183b6d] hover:underline"
                >
                  Notion Integrations
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#183b6d] mb-2">
                Deals Database ID *
              </label>
              <input
                type="text"
                value={settings.notionDealsDbId}
                onChange={(e) => setSettings({ ...settings, notionDealsDbId: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors text-sm"
                placeholder="abc123def456..."
              />
              <p className="text-xs text-[#575757] mt-1">
                Found in your Notion database URL after "notion.so/"
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => testConnection('notion')}
                disabled={!isNotionConfigured || testingConnection === 'notion'}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingConnection === 'notion' ? 'Testing...' : 'Test Connection'}
              </button>
              {testResults.notion && (
                <span
                  className={`text-sm ${
                    testResults.notion.success ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {testResults.notion.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Instantly Settings */}
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-medium text-[#183b6d] mb-1">Instantly Integration</h2>
              <p className="text-sm text-[#575757]">
                Connect your Instantly account for email sending and lead database access
              </p>
            </div>
            {isInstantlyConfigured && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-sm font-medium">
                ✓ Configured
              </span>
            )}
          </div>

          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-900">
                <div className="font-medium mb-1">Don't have Instantly?</div>
                <div className="text-blue-700">
                  You can use the Wells AI GTM stack instead ($79/month → FREE at $250K GMV).{' '}
                  <Link href="/payment?plan=gtm-stack" className="underline font-medium">
                    Subscribe here
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#183b6d] mb-2">
                Instantly API Key
              </label>
              <input
                type="password"
                value={settings.instantlyApiKey}
                onChange={(e) => setSettings({ ...settings, instantlyApiKey: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors text-sm"
                placeholder="inst_xxxxxxxxxxxx"
              />
              <p className="text-xs text-[#575757] mt-1">
                Get your API key from{' '}
                <a
                  href="https://app.instantly.ai/app/settings/integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#183b6d] hover:underline"
                >
                  Instantly Settings
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#183b6d] mb-2">
                Campaign ID (Optional)
              </label>
              <input
                type="text"
                value={settings.instantlyCampaignId}
                onChange={(e) => setSettings({ ...settings, instantlyCampaignId: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors text-sm"
                placeholder="camp_xxxxxxxxxxxx"
              />
              <p className="text-xs text-[#575757] mt-1">
                Leave blank to use default campaign
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => testConnection('instantly')}
                disabled={!isInstantlyConfigured || testingConnection === 'instantly'}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingConnection === 'instantly' ? 'Testing...' : 'Test Connection'}
              </button>
              {testResults.instantly && (
                <span
                  className={`text-sm ${
                    testResults.instantly.success ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {testResults.instantly.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Twilio Settings */}
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-medium text-[#183b6d] mb-1">
                Twilio Integration <span className="text-sm font-normal text-gray-500">(Optional)</span>
              </h2>
              <p className="text-sm text-[#575757]">
                Connect Twilio to send SMS messages to existing relationships
              </p>
            </div>
            {isTwilioConfigured && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-sm font-medium">
                ✓ Configured
              </span>
            )}
          </div>

          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-yellow-900">
                <div className="font-medium mb-1">SMS Compliance Notice</div>
                <div className="text-yellow-700">
                  Cold SMS is NOT allowed. Wells AI will only send SMS to prospects you have an existing relationship with. This protects you from TCPA violations.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#183b6d] mb-2">
                Twilio Phone Number
              </label>
              <input
                type="tel"
                value={settings.twilioFrom}
                onChange={(e) => setSettings({ ...settings, twilioFrom: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors text-sm"
                placeholder="+1 (555) 123-4567"
              />
              <p className="text-xs text-[#575757] mt-1">
                Your Twilio phone number in E.164 format (e.g., +12125551234)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => testConnection('twilio')}
                disabled={!isTwilioConfigured || testingConnection === 'twilio'}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingConnection === 'twilio' ? 'Testing...' : 'Test Connection'}
              </button>
              {testResults.twilio && (
                <span
                  className={`text-sm ${
                    testResults.twilio.success ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {testResults.twilio.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-[#575757] hover:text-[#183b6d]"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-3 bg-[#dba63f] text-white font-medium text-sm rounded-sm hover:bg-[#c89430] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-sm">
          <h3 className="text-sm font-medium text-[#183b6d] mb-3">Need Help?</h3>
          <div className="space-y-2 text-sm text-[#575757]">
            <p>
              <strong>Notion:</strong> Create an integration at{' '}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#183b6d] hover:underline"
              >
                notion.so/my-integrations
              </a>{' '}
              and grant access to your Deals database
            </p>
            <p>
              <strong>Instantly:</strong> Get your API key from{' '}
              <a
                href="https://app.instantly.ai/app/settings/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#183b6d] hover:underline"
              >
                Instantly Settings → Integrations
              </a>
            </p>
            <p>
              <strong>Twilio:</strong> Use the environment variables TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and your verified phone number
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
