'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  company_name: string | null
  email: string | null
  linkedin_url: string | null
  city: string | null
  state: string | null
  country: string | null
  company_industry: string | null
  company_size: string | null
  seniority_level: string | null
  status: string
  created_at: string
}

interface SearchResponse {
  contacts: Contact[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalContacts, setTotalContacts] = useState(0)

  // Filters
  const [filters, setFilters] = useState({
    industry: '',
    company_size: '',
    seniority: '',
    status: '',
    state: ''
  })

  // Fetch contacts
  useEffect(() => {
    loadContacts()
  }, [searchQuery, currentPage, filters])

  const loadContacts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        q: searchQuery,
        industry: filters.industry,
        company_size: filters.company_size,
        seniority: filters.seniority,
        status: filters.status,
        state: filters.state
      })

      const res = await fetch(`/api/gtm/contacts?${params}`)
      const data: SearchResponse = await res.json()

      if (res.ok) {
        setContacts(data.contacts)
        setTotalPages(data.totalPages)
        setTotalContacts(data.total)
      }
    } catch (error) {
      console.error('Failed to load contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  // Select all contacts on current page
  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)))
    }
  }

  // Toggle individual contact selection
  const handleSelectContact = (id: string) => {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedContacts(newSelected)
  }

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      industry: '',
      company_size: '',
      seniority: '',
      status: '',
      state: ''
    })
    setSearchQuery('')
    setCurrentPage(1)
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '') || searchQuery !== ''

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-[#9ea1a7] hover:text-[#183b6d] text-sm">
                ← Wells AI
              </Link>
              <Link href="/admin/contacts/upload" className="text-[#9ea1a7] hover:text-[#183b6d] text-sm">
                Upload CSV
              </Link>
            </div>
            <div className="text-sm text-[#575757]">
              {totalContacts.toLocaleString()} contacts
            </div>
          </div>
          <h1 className="text-2xl font-serif text-[#183b6d]">GTM Contacts</h1>
          <p className="text-sm text-[#575757] mt-1">
            Search and manage contacts from Clay imports
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Filters */}
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-24">
              <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[#183b6d]">Filters</h3>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-[#9ea1a7] hover:text-[#183b6d]"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="text-xs text-[#9ea1a7] mb-2 block">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                      className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                    >
                      <option value="">All</option>
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="responded">Responded</option>
                      <option value="qualified">Qualified</option>
                      <option value="unqualified">Unqualified</option>
                    </select>
                  </div>

                  {/* Seniority */}
                  <div>
                    <label className="text-xs text-[#9ea1a7] mb-2 block">Seniority</label>
                    <select
                      value={filters.seniority}
                      onChange={(e) => handleFilterChange('seniority', e.target.value)}
                      className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                    >
                      <option value="">All</option>
                      <option value="C-Level">C-Level</option>
                      <option value="VP">VP</option>
                      <option value="Director">Director</option>
                      <option value="Manager">Manager</option>
                      <option value="Individual Contributor">Individual Contributor</option>
                    </select>
                  </div>

                  {/* Company Size */}
                  <div>
                    <label className="text-xs text-[#9ea1a7] mb-2 block">Company Size</label>
                    <select
                      value={filters.company_size}
                      onChange={(e) => handleFilterChange('company_size', e.target.value)}
                      className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                    >
                      <option value="">All</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-500">201-500</option>
                      <option value="501-1000">501-1000</option>
                      <option value="1001-5000">1001-5000</option>
                      <option value="5001+">5001+</option>
                    </select>
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="text-xs text-[#9ea1a7] mb-2 block">Industry</label>
                    <input
                      type="text"
                      value={filters.industry}
                      onChange={(e) => handleFilterChange('industry', e.target.value)}
                      placeholder="e.g. Software"
                      className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="text-xs text-[#9ea1a7] mb-2 block">State</label>
                    <input
                      type="text"
                      value={filters.state}
                      onChange={(e) => handleFilterChange('state', e.target.value)}
                      placeholder="e.g. CA"
                      className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded text-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder="Search by name, company, title, or email..."
                  className="w-full px-4 py-3 pl-12 border border-[#9ea1a7]/30 rounded-sm text-[#183b6d] focus:outline-none focus:border-[#183b6d]"
                />
                <svg
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9ea1a7]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Results Table */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#9ea1a7]/20 border-t-[#183b6d] mb-4"></div>
                <p className="text-[#575757]">Loading contacts...</p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12 border border-[#9ea1a7]/20 rounded-sm">
                <p className="text-[#9ea1a7] mb-2">No contacts found</p>
                <p className="text-sm text-[#575757]">Try adjusting your search or filters</p>
              </div>
            ) : (
              <>
                <div className="border border-[#9ea1a7]/20 rounded-sm overflow-hidden mb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#183b6d]/5">
                        <tr>
                          <th className="px-4 py-3 text-left w-12">
                            <input
                              type="checkbox"
                              checked={selectedContacts.size === contacts.length && contacts.length > 0}
                              onChange={handleSelectAll}
                              className="rounded border-[#9ea1a7]/30"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#183b6d] uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#183b6d] uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#183b6d] uppercase tracking-wider">
                            Company
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#183b6d] uppercase tracking-wider">
                            Location
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#183b6d] uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#183b6d] uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-[#9ea1a7]/10">
                        {contacts.map((contact) => (
                          <tr
                            key={contact.id}
                            className="hover:bg-[#183b6d]/5 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedContacts.has(contact.id)}
                                onChange={() => handleSelectContact(contact.id)}
                                className="rounded border-[#9ea1a7]/30"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/contacts/${contact.id}`}
                                className="text-sm font-medium text-[#183b6d] hover:underline"
                              >
                                {contact.first_name} {contact.last_name}
                              </Link>
                              {contact.email && (
                                <div className="text-xs text-[#9ea1a7] mt-1">{contact.email}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#575757]">
                              {contact.title || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#575757]">
                              {contact.company_name || '—'}
                              {contact.company_industry && (
                                <div className="text-xs text-[#9ea1a7] mt-1">{contact.company_industry}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#575757]">
                              {contact.city && contact.state
                                ? `${contact.city}, ${contact.state}`
                                : contact.state || contact.city || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-1 text-xs rounded ${
                                contact.status === 'new' ? 'bg-blue-100 text-blue-800' :
                                contact.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                                contact.status === 'responded' ? 'bg-green-100 text-green-800' :
                                contact.status === 'qualified' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/contacts/${contact.id}`}
                                className="text-sm text-[#183b6d] hover:underline"
                              >
                                View →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[#575757]">
                    Showing {contacts.length} of {totalContacts.toLocaleString()} contacts
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded hover:border-[#183b6d] hover:text-[#183b6d] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    <div className="flex items-center gap-2 px-4">
                      <span className="text-sm text-[#575757]">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded hover:border-[#183b6d] hover:text-[#183b6d] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedContacts.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#9ea1a7]/20 shadow-lg z-30">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#183b6d] font-medium">
                {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded hover:border-[#183b6d] hover:text-[#183b6d]">
                  Add to Campaign
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/gtm/contacts/export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contactIds: Array.from(selectedContacts) })
                      })

                      if (res.ok) {
                        const blob = await res.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `contacts-export-${new Date().toISOString().split('T')[0]}.csv`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        window.URL.revokeObjectURL(url)
                      } else {
                        alert('Export failed')
                      }
                    } catch (err) {
                      alert('Export failed')
                    }
                  }}
                  className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded hover:border-[#183b6d] hover:text-[#183b6d]"
                >
                  Export CSV
                </button>
                <button className="px-4 py-2 border border-[#9ea1a7]/30 text-[#575757] rounded hover:border-[#183b6d] hover:text-[#183b6d]">
                  Add Tag
                </button>
                <button
                  onClick={() => setSelectedContacts(new Set())}
                  className="px-4 py-2 bg-[#183b6d] text-white rounded hover:bg-[#0d2545]"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
