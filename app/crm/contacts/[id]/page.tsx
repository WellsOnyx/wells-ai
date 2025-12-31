'use client'

/**
 * Contact Detail Page
 *
 * View and edit individual contact information, activity timeline,
 * outreach history, and quick actions.
 */

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  MapPin,
  Linkedin,
  Twitter,
  Globe,
  Edit,
  Save,
  X,
  Send,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  User,
  Briefcase,
  Tag,
  Activity,
  MoreHorizontal,
  Trash2,
  Plus,
  ExternalLink,
} from 'lucide-react'

interface Contact {
  id: string
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  phone?: string
  company?: string
  title?: string
  industry?: string
  companySize?: string
  city?: string
  state?: string
  country?: string
  linkedinUrl?: string
  twitterHandle?: string
  website?: string
  status: string
  priority: string
  icpScore?: number
  engagementScore?: number
  tags?: string[]
  notes?: string
  listName?: string
  emailsSent: number
  emailsOpened: number
  emailsClicked: number
  callsMade: number
  meetingsBooked: number
  lastContactedAt?: string
  nextFollowUpAt?: string
  createdAt: string
  updatedAt: string
}

interface ActivityItem {
  id: string
  type: string
  channel?: string
  subject?: string
  content?: string
  outcome?: string
  createdAt: string
  createdBy?: string
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedContact, setEditedContact] = useState<Partial<Contact>>({})
  const [newTag, setNewTag] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    fetchContact()
  }, [resolvedParams.id])

  const fetchContact = async () => {
    try {
      setLoading(true)
      // Fetch contact - using list endpoint for now
      const res = await fetch(`/api/crm/contacts?limit=100`)
      const data = await res.json()

      const found = data.contacts?.find((c: any) => c.id === resolvedParams.id)
      if (found) {
        const mapped: Contact = {
          id: found.id,
          email: found.email,
          firstName: found.first_name,
          lastName: found.last_name,
          fullName: found.full_name,
          phone: found.phone,
          company: found.company,
          title: found.title,
          industry: found.industry,
          companySize: found.company_size,
          city: found.city,
          state: found.state,
          country: found.country,
          linkedinUrl: found.linkedin_url,
          twitterHandle: found.twitter_handle,
          website: found.website,
          status: found.status || 'new',
          priority: found.priority || 'cold',
          icpScore: found.icp_score,
          engagementScore: found.engagement_score,
          tags: found.tags || [],
          notes: found.notes,
          listName: found.list_name,
          emailsSent: found.emails_sent || 0,
          emailsOpened: found.emails_opened || 0,
          emailsClicked: found.emails_clicked || 0,
          callsMade: found.calls_made || 0,
          meetingsBooked: found.meetings_booked || 0,
          lastContactedAt: found.last_contacted_at,
          nextFollowUpAt: found.next_follow_up_at,
          createdAt: found.created_at,
          updatedAt: found.updated_at,
        }
        setContact(mapped)
        setEditedContact(mapped)
      }

      // Mock activities for now
      setActivities([
        {
          id: '1',
          type: 'email_sent',
          channel: 'email',
          subject: 'Introduction Email',
          content: 'Hi, I wanted to reach out...',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'email_opened',
          channel: 'email',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ])
    } catch (error) {
      console.error('Failed to fetch contact:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!contact) return
    setSaving(true)

    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          ...editedContact,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setContact({ ...contact, ...editedContact })
        setEditing(false)
      }
    } catch (error) {
      console.error('Failed to save contact:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!contact) return

    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          status: newStatus,
        }),
      })

      if (res.ok) {
        setContact({ ...contact, status: newStatus })
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const addTag = () => {
    if (newTag && !editedContact.tags?.includes(newTag)) {
      setEditedContact({
        ...editedContact,
        tags: [...(editedContact.tags || []), newTag],
      })
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setEditedContact({
      ...editedContact,
      tags: editedContact.tags?.filter(t => t !== tag) || [],
    })
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'contacted': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      case 'replied': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'meeting_booked': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'qualified': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'customer': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'bounced': return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'hot': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'warm': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'cold': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email_sent': return <Mail className="w-4 h-4 text-blue-400" />
      case 'email_opened': return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'email_clicked': return <ExternalLink className="w-4 h-4 text-amber-400" />
      case 'call': return <Phone className="w-4 h-4 text-cyan-400" />
      case 'meeting': return <Calendar className="w-4 h-4 text-purple-400" />
      default: return <Activity className="w-4 h-4 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Contact not found</h2>
          <Link href="/crm/contacts" className="text-amber-400 hover:underline">
            Back to contacts
          </Link>
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
              <Link href="/crm/contacts" className="p-2 hover:bg-[var(--surface-hover)] rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold text-xl">
                  {(contact.fullName || contact.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-bold">
                    {contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email}
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {contact.title} {contact.company && `at ${contact.company}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {editing ? (
                <>
                  <button
                    onClick={() => {
                      setEditing(false)
                      setEditedContact(contact)
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <Link
                    href={`/crm/outreach?contact=${contact.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400"
                  >
                    <Send className="w-4 h-4" />
                    Send Message
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Contact Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Details Card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                Contact Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email
                  </label>
                  {editing ? (
                    <input
                      type="email"
                      value={editedContact.email || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                    />
                  ) : (
                    <a href={`mailto:${contact.email}`} className="text-amber-400 hover:underline">
                      {contact.email}
                    </a>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={editedContact.phone || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                    />
                  ) : (
                    <span>{contact.phone || '-'}</span>
                  )}
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    <Building className="w-4 h-4 inline mr-1" />
                    Company
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editedContact.company || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, company: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                    />
                  ) : (
                    <span>{contact.company || '-'}</span>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Job Title
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editedContact.title || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, title: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                    />
                  ) : (
                    <span>{contact.title || '-'}</span>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </label>
                  <span>
                    {[contact.city, contact.state, contact.country].filter(Boolean).join(', ') || '-'}
                  </span>
                </div>

                {/* Industry */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Industry
                  </label>
                  <span>{contact.industry || '-'}</span>
                </div>
              </div>

              {/* Social Links */}
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Social Links</h3>
                <div className="flex gap-3">
                  {contact.linkedinUrl ? (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)]"
                    >
                      <Linkedin className="w-4 h-4 text-blue-400" />
                      LinkedIn
                    </a>
                  ) : null}
                  {contact.twitterHandle ? (
                    <a
                      href={`https://twitter.com/${contact.twitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)]"
                    >
                      <Twitter className="w-4 h-4 text-cyan-400" />
                      Twitter
                    </a>
                  ) : null}
                  {contact.website ? (
                    <a
                      href={contact.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)]"
                    >
                      <Globe className="w-4 h-4 text-green-400" />
                      Website
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Tags */}
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(editing ? editedContact.tags : contact.tags)?.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--surface)] rounded-full text-sm"
                    >
                      {tag}
                      {editing && (
                        <button onClick={() => removeTag(tag)} className="hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {editing && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        placeholder="Add tag..."
                        className="px-3 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-full text-sm focus:outline-none focus:border-amber-500/50"
                      />
                      <button
                        onClick={addTag}
                        className="px-2 py-1 bg-[var(--surface)] rounded-full hover:bg-[var(--surface-hover)]"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Notes</h3>
                {editing ? (
                  <textarea
                    value={editedContact.notes || ''}
                    onChange={(e) => setEditedContact({ ...editedContact, notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                    placeholder="Add notes about this contact..."
                  />
                ) : (
                  <p className="text-[var(--text-secondary)]">
                    {contact.notes || 'No notes yet'}
                  </p>
                )}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-400" />
                Activity Timeline
              </h2>

              {activities.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
                  <p className="text-[var(--text-secondary)]">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity, index) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center">
                          {getActivityIcon(activity.type)}
                        </div>
                        {index < activities.length - 1 && (
                          <div className="w-0.5 flex-1 bg-[var(--border)] mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {activity.type.replace('_', ' ').charAt(0).toUpperCase() + activity.type.replace('_', ' ').slice(1)}
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {formatDate(activity.createdAt)}
                          </span>
                        </div>
                        {activity.subject && (
                          <p className="text-sm text-[var(--text-secondary)] mt-1">
                            {activity.subject}
                          </p>
                        )}
                        {activity.content && (
                          <p className="text-sm text-[var(--text-tertiary)] mt-1 line-clamp-2">
                            {activity.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Stats & Actions */}
          <div className="space-y-6">
            {/* Status & Priority */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Status</h3>
              <select
                value={contact.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="meeting_booked">Meeting Booked</option>
                <option value="qualified">Qualified</option>
                <option value="customer">Customer</option>
                <option value="churned">Churned</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="bounced">Bounced</option>
              </select>

              <h3 className="text-sm font-medium text-[var(--text-secondary)] mt-4 mb-3">Priority</h3>
              <div className="flex gap-2">
                {['cold', 'warm', 'hot'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      // Update priority
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      contact.priority === p
                        ? getPriorityColor(p)
                        : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Engagement Stats */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Engagement</h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Emails Sent</span>
                  <span className="font-semibold">{contact.emailsSent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Emails Opened</span>
                  <span className="font-semibold text-blue-400">{contact.emailsOpened}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Links Clicked</span>
                  <span className="font-semibold text-amber-400">{contact.emailsClicked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Calls Made</span>
                  <span className="font-semibold">{contact.callsMade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Meetings Booked</span>
                  <span className="font-semibold text-green-400">{contact.meetingsBooked}</span>
                </div>
              </div>

              {contact.icpScore !== undefined && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <div className="flex justify-between mb-2">
                    <span className="text-[var(--text-secondary)]">ICP Score</span>
                    <span className="font-semibold">{contact.icpScore}/100</span>
                  </div>
                  <div className="h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        contact.icpScore >= 70
                          ? 'bg-green-500'
                          : contact.icpScore >= 40
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${contact.icpScore}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Quick Actions</h3>

              <div className="space-y-2">
                <Link
                  href={`/crm/outreach?contact=${contact.id}&channel=email`}
                  className="flex items-center gap-3 w-full p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-all"
                >
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span>Send Email</span>
                </Link>
                <Link
                  href={`/crm/outreach?contact=${contact.id}&channel=sms`}
                  className="flex items-center gap-3 w-full p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-all"
                >
                  <MessageSquare className="w-4 h-4 text-green-400" />
                  <span>Send SMS</span>
                </Link>
                <button className="flex items-center gap-3 w-full p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-all">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span>Schedule Meeting</span>
                </button>
                <button className="flex items-center gap-3 w-full p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-all">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Set Follow-up</span>
                </button>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Created</span>
                  <span>{formatDate(contact.createdAt)}</span>
                </div>
                {contact.lastContactedAt && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Last Contacted</span>
                    <span>{formatDate(contact.lastContactedAt)}</span>
                  </div>
                )}
                {contact.nextFollowUpAt && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Next Follow-up</span>
                    <span className="text-amber-400">{formatDate(contact.nextFollowUpAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delete */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center gap-2 w-full p-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete Contact
            </button>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-2">Delete Contact?</h3>
            <p className="text-[var(--text-secondary)] mb-6">
              This action cannot be undone. This will permanently delete the contact and all associated data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Implement delete
                  router.push('/crm/contacts')
                }}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
