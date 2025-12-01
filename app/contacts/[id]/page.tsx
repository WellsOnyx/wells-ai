'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  company_name: string | null
  company_domain: string | null
  company_size: string | null
  company_industry: string | null
  email: string | null
  linkedin_url: string | null
  city: string | null
  state: string | null
  country: string | null
  seniority_level: string | null
  status: string
  tags: string[]
  notes: string | null
  source: string
  last_contacted_at: string | null
  last_responded_at: string | null
  created_at: string
  updated_at: string
}

export default function ContactDetail() {
  const params = useParams()
  const router = useRouter()
  const contactId = params.id as string

  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Contact>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadContact()
  }, [contactId])

  const loadContact = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/gtm/contacts/${contactId}`)
      const data = await res.json()

      if (res.ok && data.contact) {
        setContact(data.contact)
        setEditForm(data.contact)
      } else {
        console.error('Failed to load contact')
      }
    } catch (error) {
      console.error('Failed to load contact:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!contact) return

    setSaving(true)
    try {
      const res = await fetch(`/api/gtm/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      const data = await res.json()

      if (res.ok && data.contact) {
        setContact(data.contact)
        setEditing(false)
      } else {
        alert(data.error || 'Failed to update contact')
      }
    } catch (error) {
      console.error('Failed to update contact:', error)
      alert('Failed to update contact')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const res = await fetch(`/api/gtm/contacts/${contactId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        router.push('/contacts')
      } else {
        alert('Failed to delete contact')
      }
    } catch (error) {
      console.error('Failed to delete contact:', error)
      alert('Failed to delete contact')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#9ea1a7]/20 border-t-[#183b6d] mb-4"></div>
          <p className="text-[#575757]">Loading contact...</p>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#9ea1a7] mb-4">Contact not found</p>
          <Link href="/contacts" className="text-[#183b6d] hover:underline">
            ← Back to Contacts
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Link href="/contacts" className="text-[#9ea1a7] hover:text-[#183b6d] text-sm">
              ← All Contacts
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif text-[#183b6d]">
                {contact.first_name} {contact.last_name}
              </h1>
              {contact.title && contact.company_name && (
                <p className="text-sm text-[#575757] mt-1">
                  {contact.title} at {contact.company_name}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {!editing ? (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded hover:border-[#183b6d] hover:text-[#183b6d]"
                  >
                    Edit Contact
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditing(false)
                      setEditForm(contact)
                    }}
                    className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded hover:border-[#183b6d] hover:text-[#183b6d]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-[#183b6d] text-white rounded hover:bg-[#0d2545] disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-6">
          {/* Main Content - 2 columns */}
          <div className="col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6">
              <h2 className="text-lg font-medium text-[#183b6d] mb-4">Contact Information</h2>
              {!editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">First Name</div>
                      <div className="text-sm text-[#183b6d]">{contact.first_name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">Last Name</div>
                      <div className="text-sm text-[#183b6d]">{contact.last_name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">Email</div>
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="text-sm text-[#183b6d] hover:underline">
                          {contact.email}
                        </a>
                      ) : (
                        <div className="text-sm text-[#183b6d]">—</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">LinkedIn</div>
                      {contact.linkedin_url ? (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#183b6d] hover:underline"
                        >
                          View Profile →
                        </a>
                      ) : (
                        <div className="text-sm text-[#183b6d]">—</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">Title</div>
                      <div className="text-sm text-[#183b6d]">{contact.title || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">Seniority</div>
                      <div className="text-sm text-[#183b6d]">{contact.seniority_level || '—'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">First Name</label>
                      <input
                        type="text"
                        value={editForm.first_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">Last Name</label>
                      <input
                        type="text"
                        value={editForm.last_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">Email</label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">LinkedIn URL</label>
                      <input
                        type="url"
                        value={editForm.linkedin_url || ''}
                        onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">Title</label>
                      <input
                        type="text"
                        value={editForm.title || ''}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">Seniority</label>
                      <select
                        value={editForm.seniority_level || ''}
                        onChange={(e) => setEditForm({ ...editForm, seniority_level: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      >
                        <option value="">Select...</option>
                        <option value="C-Level">C-Level</option>
                        <option value="VP">VP</option>
                        <option value="Director">Director</option>
                        <option value="Manager">Manager</option>
                        <option value="Individual Contributor">Individual Contributor</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Company Information */}
            <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6">
              <h2 className="text-lg font-medium text-[#183b6d] mb-4">Company Information</h2>
              {!editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">Company Name</div>
                      <div className="text-sm text-[#183b6d]">{contact.company_name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">Domain</div>
                      {contact.company_domain ? (
                        <a
                          href={`https://${contact.company_domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#183b6d] hover:underline"
                        >
                          {contact.company_domain}
                        </a>
                      ) : (
                        <div className="text-sm text-[#183b6d]">—</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">Industry</div>
                      <div className="text-sm text-[#183b6d]">{contact.company_industry || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">Company Size</div>
                      <div className="text-sm text-[#183b6d]">{contact.company_size || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#9ea1a7] mb-1">Location</div>
                      <div className="text-sm text-[#183b6d]">
                        {[contact.city, contact.state, contact.country].filter(Boolean).join(', ') || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">Company Name</label>
                      <input
                        type="text"
                        value={editForm.company_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">Domain</label>
                      <input
                        type="text"
                        value={editForm.company_domain || ''}
                        onChange={(e) => setEditForm({ ...editForm, company_domain: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">Industry</label>
                      <input
                        type="text"
                        value={editForm.company_industry || ''}
                        onChange={(e) => setEditForm({ ...editForm, company_industry: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">Company Size</label>
                      <select
                        value={editForm.company_size || ''}
                        onChange={(e) => setEditForm({ ...editForm, company_size: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      >
                        <option value="">Select...</option>
                        <option value="1-10">1-10</option>
                        <option value="11-50">11-50</option>
                        <option value="51-200">51-200</option>
                        <option value="201-500">201-500</option>
                        <option value="501-1000">501-1000</option>
                        <option value="1001-5000">1001-5000</option>
                        <option value="5001+">5001+</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">City</label>
                      <input
                        type="text"
                        value={editForm.city || ''}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9ea1a7] mb-1 block">State</label>
                      <input
                        type="text"
                        value={editForm.state || ''}
                        onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                        className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6">
              <h2 className="text-lg font-medium text-[#183b6d] mb-4">Notes</h2>
              {!editing ? (
                <div className="text-sm text-[#575757] whitespace-pre-wrap">
                  {contact.notes || 'No notes yet.'}
                </div>
              ) : (
                <textarea
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={6}
                  placeholder="Add notes about this contact..."
                  className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                />
              )}
            </div>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6">
              <h3 className="text-sm font-medium text-[#183b6d] mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="block w-full px-4 py-2 text-center bg-[#183b6d] text-white rounded text-sm hover:bg-[#0d2545]"
                  >
                    Send Email
                  </a>
                )}
                <button className="w-full px-4 py-2 text-center border border-[#9ea1a7]/30 text-[#575757] rounded text-sm hover:border-[#183b6d] hover:text-[#183b6d]">
                  Add to Campaign
                </button>
                <button className="w-full px-4 py-2 text-center border border-[#9ea1a7]/30 text-[#575757] rounded text-sm hover:border-[#183b6d] hover:text-[#183b6d]">
                  Export Contact
                </button>
              </div>
            </div>

            {/* Status & Metadata */}
            <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6">
              <h3 className="text-sm font-medium text-[#183b6d] mb-4">Status & Info</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-[#9ea1a7] mb-1">Status</div>
                  {!editing ? (
                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                      contact.status === 'new' ? 'bg-blue-100 text-blue-800' :
                      contact.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                      contact.status === 'responded' ? 'bg-green-100 text-green-800' :
                      contact.status === 'qualified' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                    </span>
                  ) : (
                    <select
                      value={editForm.status || ''}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="responded">Responded</option>
                      <option value="qualified">Qualified</option>
                      <option value="unqualified">Unqualified</option>
                    </select>
                  )}
                </div>
                <div>
                  <div className="text-xs text-[#9ea1a7] mb-1">Source</div>
                  <div className="text-sm text-[#183b6d]">{contact.source}</div>
                </div>
                <div>
                  <div className="text-xs text-[#9ea1a7] mb-1">Added</div>
                  <div className="text-sm text-[#183b6d]">
                    {new Date(contact.created_at).toLocaleDateString()}
                  </div>
                </div>
                {contact.last_contacted_at && (
                  <div>
                    <div className="text-xs text-[#9ea1a7] mb-1">Last Contacted</div>
                    <div className="text-sm text-[#183b6d]">
                      {new Date(contact.last_contacted_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {contact.last_responded_at && (
                  <div>
                    <div className="text-xs text-[#9ea1a7] mb-1">Last Response</div>
                    <div className="text-sm text-[#183b6d]">
                      {new Date(contact.last_responded_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6">
              <h3 className="text-sm font-medium text-[#183b6d] mb-4">Activity Timeline</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="text-[#183b6d] font-medium">Contact Added</div>
                    <div className="text-xs text-[#9ea1a7] mt-1">
                      {new Date(contact.created_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-[#575757] mt-1">
                      Imported from {contact.source}
                    </div>
                  </div>
                </div>
                {contact.last_contacted_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="text-[#183b6d] font-medium">Last Contacted</div>
                      <div className="text-xs text-[#9ea1a7] mt-1">
                        {new Date(contact.last_contacted_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
                {contact.last_responded_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="text-[#183b6d] font-medium">Last Response</div>
                      <div className="text-xs text-[#9ea1a7] mt-1">
                        {new Date(contact.last_responded_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
