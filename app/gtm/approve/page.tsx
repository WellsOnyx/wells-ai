'use client'

import { useState, useEffect } from 'react'

interface OutreachMessage {
  id: string
  target: {
    name: string
    title: string
    company: string
    email: string
    phone: string
  }
  message: string
  channel: string
  campaign: string
  status: string
}

export default function ApproveOutreach() {
  const [messages, setMessages] = useState<OutreachMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [editedMessage, setEditedMessage] = useState('')
  const [processingAction, setProcessingAction] = useState(false)

  useEffect(() => {
    fetchPendingMessages()
  }, [])

  useEffect(() => {
    if (messages[currentIndex]) {
      setEditedMessage(messages[currentIndex].message)
    }
  }, [currentIndex, messages])

  const fetchPendingMessages = async () => {
    try {
      const response = await fetch('/api/gtm/outreach/pending')
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!messages[currentIndex]) return

    setProcessingAction(true)
    try {
      await fetch('/api/gtm/outreach/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: messages[currentIndex].id,
          finalMessage: editedMessage
        })
      })

      // Move to next message
      if (currentIndex < messages.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        // All done, refresh list
        await fetchPendingMessages()
        setCurrentIndex(0)
      }
    } catch (error) {
      console.error('Approval failed:', error)
    } finally {
      setProcessingAction(false)
    }
  }

  const handleReject = async () => {
    if (!messages[currentIndex]) return

    setProcessingAction(true)
    try {
      await fetch('/api/gtm/outreach/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: messages[currentIndex].id
        })
      })

      // Move to next message
      if (currentIndex < messages.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        await fetchPendingMessages()
        setCurrentIndex(0)
      }
    } catch (error) {
      console.error('Rejection failed:', error)
    } finally {
      setProcessingAction(false)
    }
  }

  const handleRegenerate = async () => {
    if (!messages[currentIndex]) return

    setProcessingAction(true)
    try {
      const response = await fetch('/api/gtm/outreach/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: messages[currentIndex].id
        })
      })

      const data = await response.json()
      setEditedMessage(data.newMessage)
    } catch (error) {
      console.error('Regeneration failed:', error)
    } finally {
      setProcessingAction(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#183b6d]">Loading messages...</div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-[#183b6d] text-white py-8 px-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-serif mb-2">Approve Outreach</h1>
            <p className="text-sm text-white/80">Review and approve AI-generated messages</p>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <p className="text-[#575757] mb-4">No messages pending approval</p>
          <a href="/gtm" className="text-[#183b6d] hover:underline">
            → Launch a new campaign
          </a>
        </div>
      </div>
    )
  }

  const current = messages[currentIndex]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#183b6d] text-white py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-serif mb-2">Approve Outreach</h1>
          <p className="text-sm text-white/80">
            Message {currentIndex + 1} of {messages.length}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Target Info */}
          <div className="border border-[#183b6d]/20 rounded-sm p-6 bg-[#183b6d]/5">
            <h2 className="text-lg font-medium text-[#183b6d] mb-4">Target</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[#9ea1a7]">Name:</span>
                <p className="text-[#183b6d] font-medium">{current.target.name}</p>
              </div>
              <div>
                <span className="text-[#9ea1a7]">Title:</span>
                <p className="text-[#183b6d]">{current.target.title}</p>
              </div>
              <div>
                <span className="text-[#9ea1a7]">Company:</span>
                <p className="text-[#183b6d]">{current.target.company}</p>
              </div>
              <div>
                <span className="text-[#9ea1a7]">Channel:</span>
                <p className="text-[#183b6d]">{current.channel}</p>
              </div>
              {current.target.email && (
                <div className="col-span-2">
                  <span className="text-[#9ea1a7]">Email:</span>
                  <p className="text-[#183b6d]">{current.target.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Message Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-[#183b6d]">
                AI-Generated Message (edit if needed)
              </label>
              <button
                onClick={handleRegenerate}
                disabled={processingAction}
                className="text-xs text-[#183b6d] hover:underline"
              >
                ↻ Regenerate
              </button>
            </div>
            <textarea
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] font-mono text-sm"
              rows={12}
            />
            <p className="text-xs text-[#575757] mt-2">
              Character count: {editedMessage.length}
              {current.channel === 'SMS' && editedMessage.length > 160 && (
                <span className="text-[#dba63f] ml-2">⚠️ Over SMS limit (160)</span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleReject}
              disabled={processingAction}
              className="flex-1 px-6 py-4 border-2 border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-red-500 hover:text-red-500 transition-all disabled:opacity-50"
            >
              ✕ Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={processingAction}
              className="flex-1 px-6 py-4 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545] transition-all disabled:opacity-50"
            >
              {processingAction ? 'Processing...' : '✓ Approve & Send'}
            </button>
          </div>

          {/* Progress */}
          <div className="pt-4">
            <div className="h-2 bg-[#9ea1a7]/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#183b6d] transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / messages.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-[#575757] mt-2 text-center">
              {messages.length - currentIndex - 1} messages remaining
            </p>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="border-t border-[#9ea1a7]/20 pt-6">
            <p className="text-xs text-[#9ea1a7] mb-2">Keyboard Shortcuts:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#575757]">
              <div><kbd className="px-2 py-1 bg-[#9ea1a7]/10 rounded">Cmd+Enter</kbd> Approve</div>
              <div><kbd className="px-2 py-1 bg-[#9ea1a7]/10 rounded">Cmd+Backspace</kbd> Reject</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
