/**
 * Email Auth Card - Inline authentication via magic link
 * Enables cross-device sync and secure transactions
 */

'use client'

import { useState } from 'react'

interface EmailAuthCardProps {
  data: {
    reason?: string
    benefits?: string[]
  }
}

export default function EmailAuthCard({ data }: EmailAuthCardProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async () => {
    if (!email || !validateEmail(email)) {
      setResult({
        success: false,
        message: 'Please enter a valid email address'
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: '✅ Check your email for a secure sign-in link'
        })
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to send magic link'
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit()
    }
  }

  return (
    <div className="border border-[#dba63f]/30 rounded-sm p-6 bg-gradient-to-br from-[#183b6d]/5 to-[#dba63f]/5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-2xl">🔐</div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-[#183b6d] mb-1">Secure Your Conversations</h3>
          <p className="text-sm text-[#575757]">
            {data.reason || 'Sign in to sync your conversations across all devices and enable secure transactions.'}
          </p>
        </div>
      </div>

      {data.benefits && data.benefits.length > 0 && (
        <div className="mb-4 pl-10">
          <p className="text-xs text-[#575757] font-medium mb-2">You'll get:</p>
          <ul className="space-y-1">
            {data.benefits.map((benefit, idx) => (
              <li key={idx} className="text-xs text-[#575757] flex items-start gap-2">
                <span className="text-[#dba63f]">✓</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!result && (
        <div className="pl-10">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="your@email.com"
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#dba63f] transition-all text-sm disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !email}
              className="px-6 py-2.5 bg-[#dba63f] text-white font-medium text-sm rounded-sm hover:bg-[#c89430] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? 'Sending...' : 'Continue'}
            </button>
          </div>
          <p className="text-xs text-[#9ea1a7] mt-2">
            We'll send you a secure sign-in link. No password needed.
          </p>
        </div>
      )}

      {result && (
        <div className={`pl-10 p-3 rounded-sm text-sm ${result.success ? 'bg-wells-success/10 text-wells-success border border-wells-success/20' : 'bg-wells-error/10 text-wells-error border border-wells-error/20'}`}>
          {result.message}
          {result.success && (
            <p className="text-xs mt-2 text-green-700">
              Click the link in your email to complete sign-in. You can close this tab.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
