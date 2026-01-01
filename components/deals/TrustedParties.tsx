'use client'

/**
 * Trusted Parties Component
 *
 * Manage trusted trading partners for auto-approve/auto-fund
 */

import { useState, useEffect } from 'react'
import { TrustedParty, TrustLevel } from '@/lib/deals/types'

interface TrustedPartiesProps {
  onSelect?: (party: TrustedParty) => void
  className?: string
}

const TRUST_LEVELS: Record<TrustLevel, {
  label: string
  color: string
  description: string
}> = {
  standard: {
    label: 'Standard',
    color: 'text-blue-400',
    description: 'Normal deal flow',
  },
  elevated: {
    label: 'Elevated',
    color: 'text-purple-400',
    description: 'Auto-approve deals',
  },
  unlimited: {
    label: 'Unlimited',
    color: 'text-green-400',
    description: 'Auto-approve + auto-fund',
  },
}

export function TrustedParties({ onSelect, className = '' }: TrustedPartiesProps) {
  const [parties, setParties] = useState<TrustedParty[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    trustedUserId: '',
    trustLevel: 'standard' as TrustLevel,
    maxDealAmount: '',
    autoApprove: false,
    autoFund: false,
  })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    fetchParties()
  }, [])

  async function fetchParties() {
    try {
      const res = await fetch('/api/b2b/trusted')
      if (res.ok) {
        const data = await res.json()
        setParties(data.parties || [])
      }
    } catch (err) {
      console.error('Failed to fetch trusted parties:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.trustedUserId) {
      setAddError('User ID required')
      return
    }

    setAddLoading(true)
    setAddError(null)

    try {
      const res = await fetch('/api/b2b/trusted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trustedUserId: addForm.trustedUserId,
          trustLevel: addForm.trustLevel,
          maxDealAmount: addForm.maxDealAmount ? parseFloat(addForm.maxDealAmount) : undefined,
          autoApprove: addForm.autoApprove,
          autoFund: addForm.autoFund,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add trusted party')
      }

      const newParty = await res.json()
      setParties(prev => [...prev, newParty])
      setShowAdd(false)
      setAddForm({
        trustedUserId: '',
        trustLevel: 'standard',
        maxDealAmount: '',
        autoApprove: false,
        autoFund: false,
      })
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setAddLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">Trusted Partners</h3>
          <p className="text-sm text-white/40">Auto-approve deals with trusted parties</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-400 text-sm transition-colors"
        >
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="grid gap-3">
            <div>
              <label className="block text-sm text-white/60 mb-1">User ID or Email *</label>
              <input
                type="text"
                value={addForm.trustedUserId}
                onChange={e => setAddForm(f => ({ ...f, trustedUserId: e.target.value }))}
                placeholder="user_xxx or email@company.com"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Trust Level</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(TRUST_LEVELS) as TrustLevel[]).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setAddForm(f => ({
                      ...f,
                      trustLevel: level,
                      autoApprove: level !== 'standard',
                      autoFund: level === 'unlimited',
                    }))}
                    className={`py-2 rounded-lg border text-sm transition-colors ${
                      addForm.trustLevel === level
                        ? 'bg-purple-500/20 border-purple-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                    }`}
                  >
                    {TRUST_LEVELS[level].label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-white/40">
                {TRUST_LEVELS[addForm.trustLevel].description}
              </p>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Max Deal Amount (optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                <input
                  type="number"
                  value={addForm.maxDealAmount}
                  onChange={e => setAddForm(f => ({ ...f, maxDealAmount: e.target.value }))}
                  placeholder="No limit"
                  min="0"
                  className="w-full pl-7 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.autoApprove}
                  onChange={e => setAddForm(f => ({ ...f, autoApprove: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/20 bg-white/5"
                />
                <span className="text-sm text-white/60">Auto-approve</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.autoFund}
                  onChange={e => setAddForm(f => ({ ...f, autoFund: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/20 bg-white/5"
                />
                <span className="text-sm text-white/60">Auto-fund</span>
              </label>
            </div>
          </div>

          {addError && (
            <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {addError}
            </div>
          )}

          <button
            type="submit"
            disabled={addLoading}
            className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium text-white text-sm transition-colors"
          >
            {addLoading ? 'Adding...' : 'Add Trusted Partner'}
          </button>
        </form>
      )}

      {/* Party List */}
      {parties.length === 0 ? (
        <div className="text-center py-8 text-white/40">
          <p>No trusted partners yet.</p>
          <p className="text-sm mt-1">Add partners for frictionless deals.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {parties.map(party => {
            const trustConfig = TRUST_LEVELS[party.trustLevel]
            const successRate = party.totalDeals > 0
              ? Math.round((party.successfulDeals / party.totalDeals) * 100)
              : 100

            return (
              <div
                key={party.id}
                onClick={() => onSelect?.(party)}
                className={`p-3 rounded-xl bg-white/5 border border-white/10 ${
                  onSelect ? 'cursor-pointer hover:border-white/20' : ''
                } transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{party.trustedUserId}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${trustConfig.color}`}>
                        {trustConfig.label}
                      </span>
                      {party.autoApprove && (
                        <span className="text-xs text-purple-400">Auto-approve</span>
                      )}
                      {party.autoFund && (
                        <span className="text-xs text-green-400">Auto-fund</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">
                      ${party.totalVolume.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/40">
                      {party.totalDeals} deals · {successRate}% success
                    </p>
                  </div>
                </div>

                {party.maxDealAmount && (
                  <p className="mt-2 text-xs text-white/40">
                    Max: ${party.maxDealAmount.toLocaleString()} per deal
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TrustedParties
