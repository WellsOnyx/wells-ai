/**
 * Email Composer - Send partner outreach emails with consent
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function EmailComposerPage() {
  const [to, setTo] = useState('')
  const [toName, setToName] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'queued' | 'sent' | 'error'>('idle')
  const [actionId, setActionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleQueue = async () => {
    if (!to || !subject || !message) {
      setErrorMessage('Please fill in all fields')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      // Convert message to HTML
      const html = message
        .split('\n\n')
        .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
        .join('')

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          toName,
          subject,
          html,
          text: message,
          metadata: {
            partner: 'ibm',
            source: 'partner_outreach'
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        setStatus('queued')
        setActionId(data.actionId)
      } else {
        setStatus('error')
        setErrorMessage(data.error)
      }
    } catch (error: any) {
      setStatus('error')
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!actionId) return

    setLoading(true)
    setErrorMessage(null)

    try {
      const html = message
        .split('\n\n')
        .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
        .join('')

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          action: 'send',
          to,
          toName,
          subject,
          html,
          text: message,
          approvedBy: 'user'
        })
      })

      const data = await response.json()

      if (data.success) {
        setStatus('sent')
      } else {
        setStatus('error')
        setErrorMessage(data.error)
      }
    } catch (error: any) {
      setStatus('error')
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/partners/ibm"
            className="text-sm text-gray-400 hover:text-white mb-4 inline-block"
          >
            ← Back to IBM Opportunities
          </Link>
          <h1 className="text-4xl font-bold mb-2">Send Partner Email</h1>
          <p className="text-gray-400">
            Compose and send emails with consent approval
          </p>
        </div>

        {/* Email Composer */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="space-y-6">
            {/* To */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                To (Email) *
              </label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="partner@ibm.com"
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
                disabled={status !== 'idle'}
              />
            </div>

            {/* To Name */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                To (Name)
              </label>
              <input
                type="text"
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                placeholder="John Smith"
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
                disabled={status !== 'idle'}
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Re: Partnership opportunity"
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
                disabled={status !== 'idle'}
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Message *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Paste your email message here..."
                rows={12}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white font-mono text-sm"
                disabled={status !== 'idle'}
              />
              <p className="text-xs text-gray-500 mt-2">
                Tip: Use double line breaks for paragraphs
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              {status === 'idle' && (
                <button
                  onClick={handleQueue}
                  disabled={loading}
                  className="flex-1 bg-white text-black font-semibold py-3 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Queuing...' : 'Queue for Approval'}
                </button>
              )}

              {status === 'queued' && (
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white font-semibold py-3 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Approve & Send'}
                </button>
              )}

              {status !== 'idle' && status !== 'queued' && (
                <button
                  onClick={() => {
                    setStatus('idle')
                    setActionId(null)
                    setTo('')
                    setToName('')
                    setSubject('')
                    setMessage('')
                    setErrorMessage(null)
                  }}
                  className="flex-1 bg-gray-700 text-white py-3 rounded hover:bg-gray-600"
                >
                  Compose New Email
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {status === 'queued' && (
          <div className="mt-6 bg-blue-900 border border-blue-700 rounded-lg p-4">
            <div className="font-semibold text-blue-200">Email Queued for Approval</div>
            <div className="text-sm text-blue-300 mt-1">
              Action ID: {actionId}
            </div>
            <div className="text-sm text-blue-300 mt-2">
              Review the email above and click "Approve & Send" to send it.
            </div>
          </div>
        )}

        {status === 'sent' && (
          <div className="mt-6 bg-green-900 border border-green-700 rounded-lg p-4">
            <div className="font-semibold text-green-200">✅ Email Sent Successfully</div>
            <div className="text-sm text-green-300 mt-1">
              Your email to {to} has been sent.
            </div>
            {actionId && (
              <div className="text-xs text-green-400 mt-2">
                Action ID: {actionId}
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 bg-red-900 border border-red-700 rounded-lg p-4">
            <div className="font-semibold text-red-200">Error</div>
            <div className="text-sm text-red-300 mt-1">{errorMessage}</div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold mb-3">Email Sending Flow</h3>
          <ol className="text-sm text-gray-400 space-y-2">
            <li>1. Compose your email message</li>
            <li>2. Click "Queue for Approval" to queue the email</li>
            <li>3. Review the queued email</li>
            <li>4. Click "Approve & Send" to send the email</li>
            <li>5. Email is sent via SendGrid (or dry-run if not configured)</li>
            <li>6. All actions are logged to audit trail with policy version</li>
          </ol>

          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              SendGrid Status: {process.env.SENDGRID_API_KEY ? '✅ Configured' : '⚠️  Not configured (dry-run mode)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
