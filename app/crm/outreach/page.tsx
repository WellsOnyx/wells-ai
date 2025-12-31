'use client'

/**
 * Quick Outreach Page
 *
 * Send messages to selected contacts immediately.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Send,
  Mail,
  MessageSquare,
  Linkedin,
  Users,
  Search,
  Plus,
  X,
  CheckSquare,
  Square,
  Loader2,
  Sparkles,
  ArrowLeft,
  Eye,
  Zap,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface Contact {
  id: string
  email: string
  fullName?: string
  company?: string
  phone?: string
}

export default function OutreachPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedContactId = searchParams.get('contact')
  const preselectedChannel = searchParams.get('channel')

  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Message composition
  const [channel, setChannel] = useState<'email' | 'sms' | 'linkedin'>(
    (preselectedChannel as any) || 'email'
  )
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    fetchContacts()
  }, [])

  useEffect(() => {
    // Pre-select contact if passed in URL
    if (preselectedContactId && contacts.length > 0) {
      const contact = contacts.find(c => c.id === preselectedContactId)
      if (contact) {
        setSelectedContacts(new Set([preselectedContactId]))
      }
    }
  }, [preselectedContactId, contacts])

  const fetchContacts = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/crm/contacts?limit=100')
      const data = await res.json()

      const mappedContacts = (data.contacts || []).map((c: any) => ({
        id: c.id,
        email: c.email,
        fullName: c.full_name,
        company: c.company,
        phone: c.phone,
      }))

      setContacts(mappedContacts)
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleContact = (id: string) => {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedContacts(newSelected)
  }

  const handleSend = async () => {
    if (selectedContacts.size === 0 || !body.trim()) return
    if (channel === 'email' && !subject.trim()) return

    setSending(true)
    try {
      // In production, this would call an API
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSent(true)
    } catch (error) {
      console.error('Failed to send:', error)
    } finally {
      setSending(false)
    }
  }

  const filteredContacts = contacts.filter(contact =>
    contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const canSend = selectedContacts.size > 0 && body.trim() && (channel !== 'email' || subject.trim())

  // Template variables
  const templateVariables = [
    { name: 'first_name', label: 'First Name' },
    { name: 'company', label: 'Company' },
    { name: 'title', label: 'Job Title' },
  ]

  const insertVariable = (variable: string) => {
    setBody(body + `{{${variable}}}`)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Messages Sent!</h2>
          <p className="text-[var(--text-secondary)] mb-8">
            Successfully sent {channel} to {selectedContacts.size} contact{selectedContacts.size > 1 ? 's' : ''}.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setSent(false)
                setSelectedContacts(new Set())
                setSubject('')
                setBody('')
              }}
              className="px-6 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
            >
              Send Another
            </button>
            <Link
              href="/crm/contacts"
              className="px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400"
            >
              View Contacts
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/crm" className="p-2 hover:bg-[var(--surface-hover)] rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Quick Outreach</h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  Send messages to selected contacts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(true)}
                disabled={!body.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send to {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Contact Selection */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold mb-4">
                Select Recipients
                {selectedContacts.size > 0 && (
                  <span className="ml-2 text-sm font-normal text-amber-400">
                    ({selectedContacts.size} selected)
                  </span>
                )}
              </h2>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
                  <p className="text-[var(--text-secondary)]">No contacts found</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => toggleContact(contact.id)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-[var(--surface-hover)] transition-all text-left"
                    >
                      <div className="flex-shrink-0">
                        {selectedContacts.has(contact.id) ? (
                          <CheckSquare className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Square className="w-5 h-5 text-[var(--text-tertiary)]" />
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                        {(contact.fullName || contact.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {contact.fullName || contact.email}
                        </div>
                        <div className="text-sm text-[var(--text-secondary)] truncate">
                          {contact.company || contact.email}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Message Composer */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-6">Compose Message</h2>

            {/* Channel Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">Channel</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'email', label: 'Email', icon: Mail, color: 'blue' },
                  { value: 'sms', label: 'SMS', icon: MessageSquare, color: 'green' },
                  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'cyan' },
                ].map((option) => {
                  const Icon = option.icon
                  const isSelected = channel === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => setChannel(option.value as any)}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                        isSelected
                          ? `bg-${option.color}-500/10 border-${option.color}-500/30 text-${option.color}-400`
                          : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? `text-${option.color}-400` : ''}`} />
                      <span className="font-medium text-sm">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Subject (for email) */}
            {channel === 'email' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject line..."
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                />
              </div>
            )}

            {/* Message Body */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Message *</label>
                <div className="flex gap-1">
                  {templateVariables.map((v) => (
                    <button
                      key={v.name}
                      onClick={() => insertVariable(v.name)}
                      className="px-2 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded hover:bg-[var(--surface-hover)]"
                      title={`Insert ${v.label}`}
                    >
                      {`{{${v.name}}}`}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`Write your ${channel} message...`}
                rows={8}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50 font-mono text-sm"
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-2">
                Use {"{{first_name}}"}, {"{{company}}"} for personalization
              </p>
            </div>

            {/* Send Warning */}
            {selectedContacts.size > 5 && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-400">Bulk send warning</p>
                  <p className="text-[var(--text-secondary)]">
                    You're about to send to {selectedContacts.size} contacts. Consider creating a campaign for better tracking.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Message Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {channel === 'email' && subject && (
              <div className="mb-4">
                <label className="block text-xs text-[var(--text-tertiary)] mb-1">Subject</label>
                <div className="p-3 bg-[var(--surface)] rounded-lg">
                  {subject.replace(/\{\{(\w+)\}\}/g, (_, key) => `[${key}]`)}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">Message</label>
              <div className="p-4 bg-[var(--surface)] rounded-lg whitespace-pre-wrap font-mono text-sm">
                {body.replace(/\{\{(\w+)\}\}/g, (_, key) => `[${key}]`) || 'No message content'}
              </div>
            </div>

            <p className="text-xs text-[var(--text-tertiary)] mt-4">
              Variables like [first_name] will be replaced with actual contact data
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
              >
                Edit Message
              </button>
              <button
                onClick={() => {
                  setShowPreview(false)
                  handleSend()
                }}
                disabled={!canSend}
                className="flex-1 py-2.5 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
