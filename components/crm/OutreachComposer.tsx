'use client'

/**
 * OutreachComposer - Message composer with template variables
 *
 * Features:
 * - Template variable insertion
 * - Channel selection (email/SMS/LinkedIn)
 * - Subject line for emails
 * - Character count for SMS
 * - Preview mode
 * - AI message generation
 */

import { useState, useRef, useEffect } from 'react'
import {
  Mail,
  MessageSquare,
  Linkedin,
  Sparkles,
  Eye,
  EyeOff,
  Send,
  Clock,
  ChevronDown,
  User,
  Building,
  Briefcase,
  AtSign,
  Hash,
  Loader2,
  Check,
  X,
} from 'lucide-react'

// Template variables available for insertion
const TEMPLATE_VARIABLES = [
  { key: '{{first_name}}', label: 'First Name', icon: User, example: 'John' },
  { key: '{{last_name}}', label: 'Last Name', icon: User, example: 'Smith' },
  { key: '{{full_name}}', label: 'Full Name', icon: User, example: 'John Smith' },
  { key: '{{company}}', label: 'Company', icon: Building, example: 'Acme Inc' },
  { key: '{{title}}', label: 'Job Title', icon: Briefcase, example: 'VP of Sales' },
  { key: '{{email}}', label: 'Email', icon: AtSign, example: 'john@acme.com' },
  { key: '{{industry}}', label: 'Industry', icon: Hash, example: 'Technology' },
]

// Sample contact for preview
const SAMPLE_CONTACT = {
  first_name: 'Sarah',
  last_name: 'Chen',
  full_name: 'Sarah Chen',
  company: 'TechCorp',
  title: 'Director of Operations',
  email: 'sarah@techcorp.com',
  industry: 'Technology',
}

type Channel = 'email' | 'sms' | 'linkedin'

interface OutreachComposerProps {
  initialChannel?: Channel
  initialSubject?: string
  initialBody?: string
  recipientCount?: number
  onSend?: (data: { channel: Channel; subject?: string; body: string }) => void
  onSchedule?: (data: { channel: Channel; subject?: string; body: string; scheduledAt: string }) => void
  onSaveDraft?: (data: { channel: Channel; subject?: string; body: string }) => void
  loading?: boolean
  className?: string
}

export default function OutreachComposer({
  initialChannel = 'email',
  initialSubject = '',
  initialBody = '',
  recipientCount = 0,
  onSend,
  onSchedule,
  onSaveDraft,
  loading = false,
  className = '',
}: OutreachComposerProps) {
  const [channel, setChannel] = useState<Channel>(initialChannel)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [showPreview, setShowPreview] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [generating, setGenerating] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const variablesRef = useRef<HTMLDivElement>(null)

  // Close variables dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (variablesRef.current && !variablesRef.current.contains(e.target as Node)) {
        setShowVariables(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Insert variable at cursor position
  const insertVariable = (variable: string) => {
    const textarea = bodyRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newBody = body.slice(0, start) + variable + body.slice(end)
    setBody(newBody)

    // Reset cursor position after insert
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + variable.length, start + variable.length)
    }, 0)

    setShowVariables(false)
  }

  // Replace template variables with sample values for preview
  const getPreviewText = (text: string): string => {
    let preview = text
    TEMPLATE_VARIABLES.forEach(({ key }) => {
      const fieldKey = key.replace(/\{\{|\}\}/g, '') as keyof typeof SAMPLE_CONTACT
      preview = preview.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), SAMPLE_CONTACT[fieldKey] || key)
    })
    return preview
  }

  // AI message generation (mock)
  const generateWithAI = async () => {
    setGenerating(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    if (channel === 'email') {
      setSubject('Quick question about {{company}}\'s operations')
      setBody(`Hi {{first_name}},

I noticed you're the {{title}} at {{company}} and wanted to reach out.

We've been helping companies in the {{industry}} space streamline their procurement processes, and I thought there might be an opportunity to collaborate.

Would you be open to a quick 15-minute call next week to explore this?

Best,
[Your Name]`)
    } else if (channel === 'sms') {
      setBody(`Hi {{first_name}}! Following up on my email about helping {{company}} streamline operations. Would love to connect - what's your availability this week?`)
    } else {
      setBody(`Hi {{first_name}}, I came across your profile and was impressed by your work at {{company}}. I'd love to connect and explore potential synergies in the {{industry}} space.`)
    }

    setGenerating(false)
  }

  // Character count for SMS
  const smsCharCount = body.length
  const smsSegments = Math.ceil(smsCharCount / 160) || 1

  // Handle send
  const handleSend = () => {
    onSend?.({ channel, subject: channel === 'email' ? subject : undefined, body })
  }

  // Handle schedule
  const handleSchedule = () => {
    if (!scheduleDate || !scheduleTime) return
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
    onSchedule?.({ channel, subject: channel === 'email' ? subject : undefined, body, scheduledAt })
    setShowSchedule(false)
  }

  // Handle save draft
  const handleSaveDraft = () => {
    onSaveDraft?.({ channel, subject: channel === 'email' ? subject : undefined, body })
  }

  const isValid = body.trim().length > 0 && (channel !== 'email' || subject.trim().length > 0)

  return (
    <div className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden ${className}`}>
      {/* Header with channel selector */}
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-secondary)]">Channel:</span>
          <div className="flex bg-[var(--surface)] rounded-lg p-1">
            <button
              onClick={() => setChannel('email')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                channel === 'email'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              onClick={() => setChannel('sms')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                channel === 'sms'
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              SMS
            </button>
            <button
              onClick={() => setChannel('linkedin')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                channel === 'linkedin'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Linkedin className="w-4 h-4" />
              LinkedIn
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
              showPreview
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Composer body */}
      <div className="p-4">
        {showPreview ? (
          // Preview mode
          <div className="space-y-4">
            <div className="p-4 bg-[var(--surface)] rounded-xl">
              <div className="flex items-center gap-2 mb-3 text-xs text-[var(--text-tertiary)]">
                <User className="w-3 h-3" />
                Preview for: {SAMPLE_CONTACT.full_name} ({SAMPLE_CONTACT.company})
              </div>

              {channel === 'email' && (
                <div className="mb-3 pb-3 border-b border-[var(--border)]">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">Subject</div>
                  <div className="font-medium">{getPreviewText(subject)}</div>
                </div>
              )}

              <div className="whitespace-pre-wrap text-[var(--text-primary)]">
                {getPreviewText(body)}
              </div>
            </div>
          </div>
        ) : (
          // Edit mode
          <div className="space-y-4">
            {/* Subject line for email */}
            {channel === 'email' && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Subject Line
                </label>
                <input
                  ref={subjectRef}
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject line..."
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-amber-500/50"
                />
              </div>
            )}

            {/* Message body */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  Message
                </label>
                <div className="flex items-center gap-2">
                  {/* Variable insertion dropdown */}
                  <div className="relative" ref={variablesRef}>
                    <button
                      onClick={() => setShowVariables(!showVariables)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]"
                    >
                      <Hash className="w-4 h-4" />
                      Variables
                      <ChevronDown className={`w-3 h-3 transition-transform ${showVariables ? 'rotate-180' : ''}`} />
                    </button>

                    {showVariables && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-10 overflow-hidden">
                        <div className="p-2 border-b border-[var(--border)]">
                          <span className="text-xs text-[var(--text-tertiary)]">Insert variable</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {TEMPLATE_VARIABLES.map(({ key, label, icon: Icon, example }) => (
                            <button
                              key={key}
                              onClick={() => insertVariable(key)}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--surface-hover)] text-left"
                            >
                              <Icon className="w-4 h-4 text-[var(--text-tertiary)]" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{label}</div>
                                <div className="text-xs text-[var(--text-tertiary)]">{key}</div>
                              </div>
                              <span className="text-xs text-[var(--text-tertiary)] bg-[var(--surface)] px-2 py-0.5 rounded">
                                {example}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Generate button */}
                  <button
                    onClick={generateWithAI}
                    disabled={generating}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-sm text-white font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {generating ? 'Generating...' : 'AI Generate'}
                  </button>
                </div>
              </div>

              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`Write your ${channel === 'email' ? 'email' : channel === 'sms' ? 'SMS' : 'LinkedIn message'}...`}
                rows={8}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-amber-500/50 resize-none"
              />

              {/* SMS character count */}
              {channel === 'sms' && (
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className={`${smsCharCount > 160 ? 'text-amber-400' : 'text-[var(--text-tertiary)]'}`}>
                    {smsCharCount} characters ({smsSegments} segment{smsSegments !== 1 ? 's' : ''})
                  </span>
                  {smsCharCount > 160 && (
                    <span className="text-amber-400">
                      Long messages may be split into multiple texts
                    </span>
                  )}
                </div>
              )}

              {/* LinkedIn character limit warning */}
              {channel === 'linkedin' && body.length > 300 && (
                <div className="mt-2 text-xs text-amber-400">
                  LinkedIn connection requests have a 300 character limit. Current: {body.length}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer with actions */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--text-secondary)]">
            {recipientCount > 0 && (
              <span>Sending to <strong className="text-[var(--text-primary)]">{recipientCount}</strong> recipient{recipientCount !== 1 ? 's' : ''}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {onSaveDraft && (
              <button
                onClick={handleSaveDraft}
                disabled={loading}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Save Draft
              </button>
            )}

            {/* Schedule dropdown */}
            {onSchedule && (
              <div className="relative">
                <button
                  onClick={() => setShowSchedule(!showSchedule)}
                  disabled={!isValid || loading}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--border-hover)]"
                >
                  <Clock className="w-4 h-4" />
                  Schedule
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSchedule ? 'rotate-180' : ''}`} />
                </button>

                {showSchedule && (
                  <div className="absolute right-0 bottom-full mb-2 w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-10 p-4">
                    <div className="text-sm font-medium mb-3">Schedule Send</div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Date</label>
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Time</label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setShowSchedule(false)}
                          className="flex-1 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSchedule}
                          disabled={!scheduleDate || !scheduleTime}
                          className="flex-1 px-3 py-2 bg-amber-500 text-black rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Send button */}
            {onSend && (
              <button
                onClick={handleSend}
                disabled={!isValid || loading}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-black rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-400 transition-all"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {loading ? 'Sending...' : 'Send Now'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
