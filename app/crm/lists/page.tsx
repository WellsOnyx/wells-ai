'use client'

/**
 * Lists Management Page
 *
 * Create, edit, and manage contact lists.
 * View contacts in each list and perform bulk operations.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ListPlus,
  List,
  Users,
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Upload,
  Download,
  Target,
  Loader2,
  Sparkles,
  Clock,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Zap,
} from 'lucide-react'

interface ContactList {
  id: string
  name: string
  description?: string
  source: string
  contactCount: number
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export default function ListsPage() {
  const router = useRouter()
  const [lists, setLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Create list modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [creating, setCreating] = useState(false)

  // Delete confirmation
  const [deleteListId, setDeleteListId] = useState<string | null>(null)

  // Score modal
  const [scoreListName, setScoreListName] = useState<string | null>(null)
  const [scoring, setScoring] = useState(false)

  useEffect(() => {
    fetchLists()
  }, [])

  const fetchLists = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/crm/lists')
      const data = await res.json()

      const mappedLists = (data.lists || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        source: l.source,
        contactCount: l.contact_count || l.contactCount || 0,
        tags: l.tags,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      }))

      setLists(mappedLists)
    } catch (error) {
      console.error('Failed to fetch lists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) return
    setCreating(true)

    try {
      // For now, we'll just add to local state
      // In production, this would call an API
      const newList: ContactList = {
        id: `list_${Date.now()}`,
        name: newListName,
        description: newListDescription,
        source: 'manual',
        contactCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setLists([newList, ...lists])
      setShowCreateModal(false)
      setNewListName('')
      setNewListDescription('')
    } catch (error) {
      console.error('Failed to create list:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteList = async (listId: string) => {
    try {
      // In production, this would call an API
      setLists(lists.filter(l => l.id !== listId))
      setDeleteListId(null)
    } catch (error) {
      console.error('Failed to delete list:', error)
    }
  }

  const handleScoreList = async (listName: string) => {
    setScoring(true)
    try {
      const res = await fetch('/api/crm/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listName }),
      })

      if (res.ok) {
        const data = await res.json()
        alert(`Scored ${data.contactsScored} contacts`)
        setScoreListName(null)
      }
    } catch (error) {
      console.error('Failed to score list:', error)
    } finally {
      setScoring(false)
    }
  }

  const filteredLists = lists.filter(list =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    list.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <span className="text-xl font-bold">Wells CRM</span>
              </Link>

              <nav className="hidden md:flex items-center gap-1 ml-6">
                <Link
                  href="/crm"
                  className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium text-sm transition-all"
                >
                  Dashboard
                </Link>
                <Link
                  href="/crm/contacts"
                  className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium text-sm transition-all"
                >
                  Contacts
                </Link>
                <Link
                  href="/crm/lists"
                  className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 font-medium text-sm"
                >
                  Lists
                </Link>
                <Link
                  href="/crm/campaigns"
                  className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium text-sm transition-all"
                >
                  Campaigns
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/crm/contacts/import"
                className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-all text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Import
              </Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                New List
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Contact Lists</h1>
            <p className="text-[var(--text-secondary)]">
              Organize your contacts into targeted lists
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search lists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Lists Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-12 text-center">
            <List className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No lists found</h3>
            <p className="text-[var(--text-secondary)] mb-6">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Create your first list to organize contacts'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all"
            >
              <Plus className="w-5 h-5" />
              Create List
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLists.map((list) => (
              <div
                key={list.id}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-hover)] transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-amber-500/10 rounded-xl">
                    <List className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="relative">
                    <button className="p-2 hover:bg-[var(--surface-hover)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4 text-[var(--text-tertiary)]" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-1">{list.name}</h3>
                {list.description && (
                  <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">
                    {list.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {list.contactCount} contacts
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDate(list.createdAt)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/crm/contacts?list=${encodeURIComponent(list.name)}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-sm font-medium"
                  >
                    <Users className="w-4 h-4" />
                    View
                  </Link>
                  <button
                    onClick={() => setScoreListName(list.name)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-sm font-medium"
                    title="Score contacts with ICP"
                  >
                    <Target className="w-4 h-4 text-amber-400" />
                  </button>
                  <button
                    onClick={() => setDeleteListId(list.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Create New List</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">List Name *</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Q1 Prospects, VIP Contacts"
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <textarea
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="What is this list for?"
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateList}
                disabled={!newListName.trim() || creating}
                className="flex-1 py-2.5 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteListId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Delete List?</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  This will not delete the contacts in the list
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteListId(null)}
                className="flex-1 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteList(deleteListId)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score List Modal */}
      {scoreListName && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <Target className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Score Contacts</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Apply ICP scoring to "{scoreListName}"
                </p>
              </div>
            </div>

            <p className="text-[var(--text-secondary)] text-sm mb-6">
              This will analyze each contact in the list and assign an ICP score based on:
              industry, company size, job title, and location.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setScoreListName(null)}
                className="flex-1 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleScoreList(scoreListName)}
                disabled={scoring}
                className="flex-1 py-2.5 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scoring ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Score Contacts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
