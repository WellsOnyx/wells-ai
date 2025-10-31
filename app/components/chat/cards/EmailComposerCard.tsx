/**
 * Email Composer Card - Inline email composition in chat
 */

'use client'

import { useState } from 'react'

interface EmailComposerCardProps {
  data: {
    to?: string
    subject?: string
    prefilledContent?: string
    context?: string
  }
}

export default function EmailComposerCard({ data }: EmailComposerCardProps) {
  const [to, setTo] = useState(data.to || '')
  const [subject, setSubject] = useState(data.subject || '')
  const [content, setContent] = useState(data.prefilledContent || '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSend = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          html: `<p>${content.replace(/\n/g, '<br>')}</p>`,
          text: content
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, message: `✅ Email queued for approval (ID: ${data.actionId})` })
      } else {
        setResult({ success: false, message: `❌ Failed: ${data.error}` })
      }
    } catch (error: any) {
      setResult({ success: false, message: `❌ Error: ${error.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      <h3 className="font-semibold text-lg mb-3">✉️ Compose Email</h3>

      {data.context && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
          <strong>Context:</strong> {data.context}
        </div>
      )}

      <div className="space-y-3">
        {/* To field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="recipient@example.com"
          />
        </div>

        {/* Subject field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Email subject"
          />
        </div>

        {/* Content field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Email content..."
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={loading || !to || !subject || !content}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Sending...' : '📤 Send Email'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`p-3 rounded ${result.success ? 'bg-green-50 text-green-900 border border-green-200' : 'bg-red-50 text-red-900 border border-red-200'}`}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  )
}
