// @ts-nocheck
/**
 * Admin Credentials Page
 *
 * ⚠️ MASTER ACCESS ONLY ⚠️
 *
 * Self-service page to update API keys and session cookies
 * without needing to redeploy or access Vercel dashboard.
 */

'use client'

import { useState, useEffect } from 'react'

interface CredentialField {
  key: string
  label: string
  type: 'text' | 'password'
  description: string
  placeholder: string
}

const CREDENTIAL_FIELDS: CredentialField[] = [
  {
    key: 'APOLLO_API_KEY',
    label: 'Apollo API Key',
    type: 'password',
    description: 'From Apollo.io Settings → Integrations → API',
    placeholder: 'Enter Apollo API key...',
  },
  {
    key: 'LINKEDIN_SESSION_COOKIE',
    label: 'LinkedIn Session Cookie (li_at)',
    type: 'password',
    description: 'From browser DevTools → Application → Cookies → linkedin.com → li_at',
    placeholder: 'Enter li_at cookie value...',
  },
  {
    key: 'LINKEDIN_RECRUITER_SESSION',
    label: 'LinkedIn Recruiter Session (optional)',
    type: 'password',
    description: 'If you have LinkedIn Recruiter access',
    placeholder: 'Enter Recruiter session cookie...',
  },
  {
    key: 'OWNER_EMAIL',
    label: 'Owner Email',
    type: 'text',
    description: 'Email for escalations and notifications',
    placeholder: 'you@company.com',
  },
  {
    key: 'ESCALATION_SLACK_WEBHOOK',
    label: 'Slack Webhook URL (optional)',
    type: 'password',
    description: 'For escalation notifications in Slack',
    placeholder: 'https://hooks.slack.com/services/...',
  },
]

export default function AdminCredentialsPage() {
  const [masterKey, setMasterKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Record<string, 'saved' | 'error' | 'loading' | null>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Authenticate with master key
  const handleAuth = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/credentials', {
        headers: {
          'Authorization': `Bearer ${masterKey}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setCredentials(data.credentials || {})
        setAuthenticated(true)
      } else {
        setError('Invalid master key')
      }
    } catch (err) {
      setError('Failed to authenticate')
    } finally {
      setLoading(false)
    }
  }

  // Save a single credential
  const handleSave = async (key: string, value: string) => {
    setStatus(prev => ({ ...prev, [key]: 'loading' }))

    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      })

      if (res.ok) {
        setStatus(prev => ({ ...prev, [key]: 'saved' }))
        setTimeout(() => {
          setStatus(prev => ({ ...prev, [key]: null }))
        }, 3000)
      } else {
        setStatus(prev => ({ ...prev, [key]: 'error' }))
      }
    } catch (err) {
      setStatus(prev => ({ ...prev, [key]: 'error' }))
    }
  }

  // Test a credential
  const handleTest = async (key: string) => {
    setStatus(prev => ({ ...prev, [key]: 'loading' }))

    try {
      const res = await fetch('/api/admin/credentials/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key }),
      })

      const data = await res.json()
      if (data.valid) {
        setStatus(prev => ({ ...prev, [key]: 'saved' }))
      } else {
        setStatus(prev => ({ ...prev, [key]: 'error' }))
      }

      setTimeout(() => {
        setStatus(prev => ({ ...prev, [key]: null }))
      }, 3000)
    } catch (err) {
      setStatus(prev => ({ ...prev, [key]: 'error' }))
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">🔐 Master Access</h1>
            <p className="text-gray-400">Enter your Cold Start master key</p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              value={masterKey}
              onChange={(e) => setMasterKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              placeholder="COLD_START_MASTER_KEY"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              onClick={handleAuth}
              disabled={loading || !masterKey}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Authenticating...' : 'Access Credentials'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">⚙️ Credentials Manager</h1>
          <p className="text-gray-400">
            Update API keys and session cookies. Changes take effect immediately.
          </p>
        </div>

        <div className="space-y-6">
          {CREDENTIAL_FIELDS.map((field) => (
            <div key={field.key} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium">{field.label}</label>
                {status[field.key] === 'saved' && (
                  <span className="text-green-500 text-sm">✓ Saved</span>
                )}
                {status[field.key] === 'error' && (
                  <span className="text-red-500 text-sm">✗ Error</span>
                )}
                {status[field.key] === 'loading' && (
                  <span className="text-yellow-500 text-sm">Saving...</span>
                )}
              </div>

              <p className="text-gray-500 text-sm mb-3">{field.description}</p>

              <div className="flex gap-2">
                <input
                  type={field.type}
                  value={credentials[field.key] || ''}
                  onChange={(e) => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded focus:outline-none focus:border-blue-500 text-sm"
                />
                <button
                  onClick={() => handleSave(field.key, credentials[field.key] || '')}
                  disabled={status[field.key] === 'loading'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded text-sm font-medium transition-colors"
                >
                  Save
                </button>
                {(field.key === 'APOLLO_API_KEY' || field.key === 'LINKEDIN_SESSION_COOKIE') && (
                  <button
                    onClick={() => handleTest(field.key)}
                    disabled={status[field.key] === 'loading'}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded text-sm font-medium transition-colors"
                  >
                    Test
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
          <h3 className="font-medium text-yellow-500 mb-2">💡 How to get LinkedIn cookie</h3>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>Open LinkedIn in Chrome and log in</li>
            <li>Press F12 to open DevTools</li>
            <li>Go to Application → Cookies → linkedin.com</li>
            <li>Find <code className="bg-gray-800 px-1 rounded">li_at</code> and copy its value</li>
            <li>Paste it above and click Save</li>
          </ol>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => setAuthenticated(false)}
            className="text-gray-500 hover:text-gray-400 text-sm"
          >
            Lock & Exit
          </button>
        </div>
      </div>
    </div>
  )
}
