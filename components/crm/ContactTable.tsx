'use client'

/**
 * ContactTable - Reusable contact data table component
 *
 * Features:
 * - Sortable columns
 * - Selection with checkboxes
 * - Pagination controls
 * - Row click handler
 */

import { useState } from 'react'
import {
  CheckSquare,
  Square,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react'

export interface Contact {
  id: string
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  phone?: string
  company?: string
  title?: string
  status: string
  priority: string
  tags?: string[]
  lastContactedAt?: string
  createdAt: string
}

interface ContactTableProps {
  contacts: Contact[]
  selectedIds?: Set<string>
  onSelect?: (id: string) => void
  onSelectAll?: () => void
  selectAll?: boolean
  onRowClick?: (contact: Contact) => void
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  loading?: boolean
}

export default function ContactTable({
  contacts,
  selectedIds = new Set(),
  onSelect,
  onSelectAll,
  selectAll = false,
  onRowClick,
  sortField,
  sortOrder,
  onSort,
  page = 1,
  pageSize = 25,
  total = 0,
  onPageChange,
  loading = false,
}: ContactTableProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'contacted': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      case 'replied': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'meeting_booked': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'qualified': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'bounced': return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const renderSortHeader = (field: string, label: string) => (
    <button
      onClick={() => onSort?.(field)}
      className="flex items-center gap-1 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
    >
      {label}
      <ArrowUpDown className={`w-4 h-4 ${sortField === field ? 'text-amber-400' : ''}`} />
    </button>
  )

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
            <tr>
              {onSelect && (
                <th className="w-12 px-4 py-3 text-left">
                  <button
                    onClick={onSelectAll}
                    className="p-1 hover:bg-[var(--surface-hover)] rounded"
                  >
                    {selectAll ? (
                      <CheckSquare className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Square className="w-5 h-5 text-[var(--text-tertiary)]" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-4 py-3 text-left">
                {onSort ? renderSortHeader('fullName', 'Name') : (
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">Name</span>
                )}
              </th>
              <th className="px-4 py-3 text-left">
                {onSort ? renderSortHeader('email', 'Email') : (
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">Email</span>
                )}
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">
                Phone
              </th>
              <th className="px-4 py-3 text-left">
                {onSort ? renderSortHeader('company', 'Company') : (
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">Company</span>
                )}
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">
                Tags
              </th>
              <th className="px-4 py-3 text-left">
                {onSort ? renderSortHeader('status', 'Status') : (
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">Status</span>
                )}
              </th>
              <th className="px-4 py-3 text-left">
                {onSort ? renderSortHeader('lastContactedAt', 'Last Contact') : (
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">Last Contact</span>
                )}
              </th>
              <th className="w-12 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                onClick={() => onRowClick?.(contact)}
              >
                {onSelect && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onSelect(contact.id)}
                      className="p-1 hover:bg-[var(--surface)] rounded"
                    >
                      {selectedIds.has(contact.id) ? (
                        <CheckSquare className="w-5 h-5 text-amber-400" />
                      ) : (
                        <Square className="w-5 h-5 text-[var(--text-tertiary)]" />
                      )}
                    </button>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                      {(contact.fullName || contact.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '-'}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        {contact.title || '-'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm">{contact.email}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {contact.phone || '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm">{contact.company || '-'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {contact.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-[var(--surface)] rounded-full text-xs text-[var(--text-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                    {contact.tags && contact.tags.length > 2 && (
                      <span className="text-xs text-[var(--text-tertiary)]">
                        +{contact.tags.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs border ${getStatusColor(contact.status)}`}>
                    {contact.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {formatDate(contact.lastContactedAt)}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button className="p-2 hover:bg-[var(--surface)] rounded-lg">
                    <MoreHorizontal className="w-4 h-4 text-[var(--text-tertiary)]" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {onPageChange && total > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
          <div className="text-sm text-[var(--text-secondary)]">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface-hover)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface-hover)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
