'use client'

/**
 * Deals List Component
 *
 * Shows all user's B2B deals with filtering and actions
 */

import { useState, useEffect } from 'react'
import { B2BDeal, DealStatus } from '@/lib/deals/types'
import { DealCard } from './DealCard'

interface DealsListProps {
  initialRole?: 'buyer' | 'seller' | 'all'
  initialStatus?: DealStatus | 'active' | 'all'
  onDealClick?: (deal: B2BDeal) => void
  className?: string
}

export function DealsList({
  initialRole = 'all',
  initialStatus = 'active',
  onDealClick,
  className = '',
}: DealsListProps) {
  const [deals, setDeals] = useState<B2BDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(initialRole)
  const [status, setStatus] = useState<string>(initialStatus)

  useEffect(() => {
    fetchDeals()
  }, [role, status])

  async function fetchDeals() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (role !== 'all') params.set('role', role)
      if (status !== 'all' && status !== 'active') params.set('status', status)
      if (status === 'active') params.set('action', 'true')

      const res = await fetch(`/api/b2b?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDeals(data.deals || [])
      }
    } catch (err) {
      console.error('Failed to fetch deals:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(dealId: string, action: string) {
    try {
      const res = await fetch(`/api/b2b/${dealId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (res.ok) {
        fetchDeals() // Refresh list
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    }
  }

  const getUserRole = (deal: B2BDeal): 'buyer' | 'seller' => {
    // This would normally check against current user ID
    // For now, use the filter role or default to buyer
    return role === 'seller' ? 'seller' : 'buyer'
  }

  return (
    <div className={className}>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Role Filter */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
          {['all', 'buyer', 'seller'].map(r => (
            <button
              key={r}
              onClick={() => setRole(r as typeof role)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                role === r
                  ? 'bg-purple-600 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {r === 'all' ? 'All Roles' : r}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
          {['active', 'all', 'completed'].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                status === s
                  ? 'bg-purple-600 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {s === 'active' ? 'Active' : s === 'all' ? 'All' : 'Completed'}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchDeals}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 text-sm transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && deals.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-white mb-2">No deals yet</h3>
          <p className="text-white/40">
            {status === 'active'
              ? 'No active deals. Create one to get started!'
              : 'No deals match your filters.'}
          </p>
        </div>
      )}

      {/* Deals Grid */}
      {!loading && deals.length > 0 && (
        <div className="grid gap-4">
          {deals.map(deal => {
            const userRole = getUserRole(deal)
            return (
              <DealCard
                key={deal.id}
                deal={deal}
                userRole={userRole}
                onClick={() => onDealClick?.(deal)}
                onConfirm={() => handleAction(deal.id, 'confirm')}
                onFund={() => handleAction(deal.id, 'fund')}
                onDeliver={() => handleAction(deal.id, 'deliver')}
                onRelease={() => handleAction(deal.id, 'release')}
              />
            )
          })}
        </div>
      )}

      {/* Summary */}
      {!loading && deals.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-white/5 flex items-center justify-between text-sm">
          <span className="text-white/40">{deals.length} deal{deals.length !== 1 ? 's' : ''}</span>
          <span className="text-white font-medium">
            ${deals.reduce((sum, d) => sum + d.amount, 0).toLocaleString()} total
          </span>
        </div>
      )}
    </div>
  )
}

export default DealsList
