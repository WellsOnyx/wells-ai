/**
 * Deal Card - Inline transaction component in chat
 *
 * Shows supplier quote with one-click "Accept Deal" button
 */

'use client'

import { useState } from 'react'

interface DealCardProps {
  rfqId: string
  supplier: {
    id: string
    name: string
    rating?: number
    completedDeals?: number
    trustScore?: number
    trustLevel?: string
  }
  quote: {
    amount: number
    deliveryTime?: string
    terms?: string
  }
  category?: string
  onAccept?: (transactionId: string) => void
}

export function DealCard({ rfqId, supplier, quote, category, onAccept }: DealCardProps) {
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setAccepting(true)
    setError(null)

    try {
      const response = await fetch('/api/transactions/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqId,
          sellerId: supplier.id,
          amount: quote.amount * 100, // Convert to cents
          category
        })
      })

      const data = await response.json()

      if (data.success) {
        setAccepted(true)
        if (onAccept) onAccept(data.transaction.id)
      } else {
        setError(data.error || 'Failed to accept deal')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept deal')
    } finally {
      setAccepting(false)
    }
  }

  if (accepted) {
    return (
      <div className="my-4 p-6 bg-green-600/20 border border-green-500 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h3 className="text-lg font-bold text-green-400">Deal Accepted!</h3>
        </div>
        <p className="text-sm text-green-200">
          Your transaction with {supplier.name} is being processed. You'll receive next steps via email.
        </p>
      </div>
    )
  }

  return (
    <div className="my-4 p-6 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-blue-500 transition">
      {/* Supplier Info */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{supplier.name}</h3>
          {supplier.rating && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="text-yellow-400">★</span>
              <span>{supplier.rating.toFixed(1)}</span>
              {supplier.completedDeals && (
                <span>· {supplier.completedDeals} deals completed</span>
              )}
            </div>
          )}
          {supplier.trustScore && (
            <div className="flex items-center gap-2 mt-1">
              <div className="px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-xs">
                <span className="text-blue-400 font-semibold">Trust Score: {supplier.trustScore}</span>
                {supplier.trustLevel && (
                  <span className="text-blue-300 ml-1">({supplier.trustLevel})</span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            ${quote.amount.toLocaleString()}
          </div>
          {quote.deliveryTime && (
            <div className="text-sm text-slate-400">{quote.deliveryTime}</div>
          )}
        </div>
      </div>

      {/* Quote Details */}
      {quote.terms && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded">
          <p className="text-sm text-slate-300">{quote.terms}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Accept Button */}
      <button
        onClick={handleAccept}
        disabled={accepting}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 rounded-lg font-semibold text-white transition"
      >
        {accepting ? 'Processing...' : 'Accept Deal'}
      </button>

      <p className="mt-2 text-xs text-center text-slate-400">
        Wells will collect a 2.5% platform fee
      </p>
    </div>
  )
}
