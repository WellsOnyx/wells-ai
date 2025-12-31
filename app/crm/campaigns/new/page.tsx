'use client'

/**
 * Campaign Builder
 *
 * Multi-step wizard to create new outreach campaigns:
 * 1. Name & channel selection
 * 2. Audience (lists, tags, individual contacts)
 * 3. Content (template or custom message)
 * 4. Schedule or send now
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mail,
  MessageSquare,
  Linkedin,
  Twitter,
  Users,
  List,
  Tag,
  UserPlus,
  FileText,
  Sparkles,
  Clock,
  Send,
  Calendar,
  Loader2,
  AlertCircle,
  Eye,
  Zap,
  X,
  Plus,
  Search,
} from 'lucide-react'

interface ContactList {
  name: string
  contactCount: number
}

export default function NewCampaignPage() {
  const router = useRouter()

  // Steps: 1=Name, 2=Audience, 3=Content, 4=Schedule
  const [step, setStep] = useState(1)

  // Step 1: Basic Info
  const [campaignName, setCampaignName] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')
  const [channel, setChannel] = useState<'email' | 'sms' | 'linkedin'>('email')

  // Step 2: Audience
  const [audienceType, setAudienceType] = useState<'lists' | 'tags' | 'manual'>('lists')
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [manualContacts, setManualContacts] = useState<string[]>([])
  const [lists, setLists] = useState<ContactList[]>([])
  const [estimatedRecipients, setEstimatedRecipients] = useState(0)

  // Step 3: Content
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [useTemplate, setUseTemplate] = useState(false)

  // Step 4: Schedule
  const [sendOption, setSendOption] = useState<'now' | 'schedule'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')

  // State
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    fetchLists()
  }, [])

  const fetchLists = async () => {
    try {
      const res = await fetch('/api/crm/lists')
      const data = await res.json()
      setLists((data.lists || []).map((l: any) => ({
        name: l.name,
        contactCount: l.contact_count || l.contactCount || 0,
      })))
    } catch (error) {
      console.error('Failed to fetch lists:', error)
    }
  }

  // Calculate estimated recipients
  useEffect(() => {
    let count = 0
    if (audienceType === 'lists') {
      count = selectedLists.reduce((sum, listName) => {
        const list = lists.find(l => l.name === listName)
        return sum + (list?.contactCount || 0)
      }, 0)
    } else if (audienceType === 'manual') {
      count = manualContacts.length
    }
    setEstimatedRecipients(count)
  }, [audienceType, selectedLists, manualContacts, lists])

  const toggleList = (listName: string) => {
    if (selectedLists.includes(listName)) {
      setSelectedLists(selectedLists.filter(l => l !== listName))
    } else {
      setSelectedLists([...selectedLists, listName])
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // In production, this would call an API to create the campaign
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Redirect to campaigns list
      router.push('/crm/campaigns')
    } catch (error) {
      console.error('Failed to create campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return campaignName.trim() !== ''
      case 2:
        return estimatedRecipients > 0
      case 3:
        return (channel === 'email' ? subject.trim() !== '' : true) && body.trim() !== ''
      case 4:
        return sendOption === 'now' || (scheduledDate !== '' && scheduledTime !== '')
      default:
        return false
    }
  }

  // Template variables
  const templateVariables = [
    { name: 'first_name', label: 'First Name' },
    { name: 'last_name', label: 'Last Name' },
    { name: 'company', label: 'Company' },
    { name: 'title', label: 'Job Title' },
  ]

  const insertVariable = (variable: string) => {
    setBody(body + `{{${variable}}}`)
  }

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-4 mb-8">
      {[
        { num: 1, label: 'Details' },
        { num: 2, label: 'Audience' },
        { num: 3, label: 'Content' },
        { num: 4, label: 'Send' },
      ].map((s, i) => (
        <div key={s.num} className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                step > s.num
                  ? 'bg-green-500 text-black'
                  : step === s.num
                  ? 'bg-amber-500 text-black'
                  : 'bg-[var(--surface)] text-[var(--text-tertiary)]'
              }`}
            >
              {step > s.num ? <Check className="w-5 h-5" /> : s.num}
            </div>
            <span className={`text-xs mt-1 ${
              step >= s.num ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
            }`}>
              {s.label}
            </span>
          </div>
          {i < 3 && (
            <div className={`w-16 h-0.5 ${
              step > s.num ? 'bg-green-500' : 'bg-[var(--border)]'
            }`} />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/crm/campaigns" className="p-2 hover:bg-[var(--surface-hover)] rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Create Campaign</h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  Set up your outreach campaign
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {renderStepIndicator()}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8">
            <h2 className="text-xl font-semibold mb-6">Campaign Details</h2>

            <div className="space-y-6">
              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Campaign Name *</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Q1 Outreach, Product Launch"
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <textarea
                  value={campaignDescription}
                  onChange={(e) => setCampaignDescription(e.target.value)}
                  placeholder="Brief description of this campaign..."
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Channel Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">Channel *</label>
                <div className="grid grid-cols-3 gap-4">
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
                        className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                          isSelected
                            ? `bg-${option.color}-500/10 border-${option.color}-500/30 text-${option.color}-400`
                            : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        <Icon className={`w-6 h-6 ${isSelected ? `text-${option.color}-400` : ''}`} />
                        <span className="font-medium">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Select Audience</h2>
              <div className="text-sm text-[var(--text-secondary)]">
                <Users className="w-4 h-4 inline mr-1" />
                {estimatedRecipients} estimated recipients
              </div>
            </div>

            {/* Audience Type Tabs */}
            <div className="flex gap-2 mb-6">
              {[
                { value: 'lists', label: 'From Lists', icon: List },
                { value: 'tags', label: 'By Tags', icon: Tag },
                { value: 'manual', label: 'Manual Selection', icon: UserPlus },
              ].map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => setAudienceType(option.value as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      audienceType === option.value
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {option.label}
                  </button>
                )
              })}
            </div>

            {/* Lists Selection */}
            {audienceType === 'lists' && (
              <div className="space-y-3">
                {lists.length === 0 ? (
                  <div className="text-center py-8">
                    <List className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">No lists available</p>
                    <Link href="/crm/contacts/import" className="text-amber-400 text-sm hover:underline">
                      Import contacts to create a list
                    </Link>
                  </div>
                ) : (
                  lists.map((list) => (
                    <button
                      key={list.name}
                      onClick={() => toggleList(list.name)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        selectedLists.includes(list.name)
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          selectedLists.includes(list.name)
                            ? 'bg-amber-500 border-amber-500'
                            : 'border-[var(--border)]'
                        }`}>
                          {selectedLists.includes(list.name) && (
                            <Check className="w-3 h-3 text-black" />
                          )}
                        </div>
                        <span className="font-medium">{list.name}</span>
                      </div>
                      <span className="text-sm text-[var(--text-secondary)]">
                        {list.contactCount} contacts
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Tags Selection */}
            {audienceType === 'tags' && (
              <div className="text-center py-8">
                <Tag className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
                <p className="text-[var(--text-secondary)]">Tag-based targeting coming soon</p>
              </div>
            )}

            {/* Manual Selection */}
            {audienceType === 'manual' && (
              <div className="text-center py-8">
                <UserPlus className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
                <p className="text-[var(--text-secondary)]">Manual contact selection coming soon</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Content */}
        {step === 3 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Compose Message</h2>
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-sm"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            </div>

            <div className="space-y-6">
              {/* Subject (for email) */}
              {channel === 'email' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Subject Line *</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              )}

              {/* Message Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Message *</label>
                  <div className="flex gap-2">
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
                  placeholder={`Write your ${channel} message here...

Use template variables like {{first_name}} or {{company}} to personalize.`}
                  rows={10}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50 font-mono text-sm"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-2">
                  Tip: Use {"{{first_name}}"}, {"{{company}}"}, etc. for personalization
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 4 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8">
            <h2 className="text-xl font-semibold mb-6">Schedule Campaign</h2>

            <div className="space-y-6">
              {/* Send Options */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSendOption('now')}
                  className={`p-6 rounded-xl border transition-all text-left ${
                    sendOption === 'now'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Zap className={`w-6 h-6 mb-3 ${sendOption === 'now' ? 'text-amber-400' : ''}`} />
                  <h3 className="font-semibold mb-1">Send Now</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Start sending immediately after creation
                  </p>
                </button>

                <button
                  onClick={() => setSendOption('schedule')}
                  className={`p-6 rounded-xl border transition-all text-left ${
                    sendOption === 'schedule'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Calendar className={`w-6 h-6 mb-3 ${sendOption === 'schedule' ? 'text-amber-400' : ''}`} />
                  <h3 className="font-semibold mb-1">Schedule</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Choose a specific date and time
                  </p>
                </button>
              </div>

              {/* Schedule Date/Time */}
              {sendOption === 'schedule' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Date</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Time</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-[var(--surface)] rounded-xl p-6">
                <h3 className="font-semibold mb-4">Campaign Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)]">Campaign:</span>
                    <span className="ml-2 font-medium">{campaignName}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Channel:</span>
                    <span className="ml-2 font-medium capitalize">{channel}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Recipients:</span>
                    <span className="ml-2 font-medium">{estimatedRecipients}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Send:</span>
                    <span className="ml-2 font-medium">
                      {sendOption === 'now' ? 'Immediately' : `${scheduledDate} at ${scheduledTime}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {sendOption === 'now' ? 'Create & Send' : 'Schedule Campaign'}
            </button>
          )}
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
          </div>
        </div>
      )}
    </div>
  )
}
