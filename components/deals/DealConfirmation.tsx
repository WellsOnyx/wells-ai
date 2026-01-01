'use client'

/**
 * Deal Confirmation Component
 *
 * The "Yes, Proceed" moment - makes agreement frictionless
 */

import { useState } from 'react'
import { B2BDeal } from '@/lib/deals/types'

interface DealConfirmationProps {
  deal: B2BDeal
  userRole: 'buyer' | 'seller'
  onConfirm: (message?: string) => Promise<void>
  onDecline?: () => void
  className?: string
}

const QUICK_CONFIRMATIONS = [
  'Yes, proceed',
  'Approved',
  'Deal',
  'Lets do it',
  '👍',
]

export function DealConfirmation({
  deal,
  userRole,
  onConfirm,
  onDecline,
  className = '',
}: DealConfirmationProps) {
  const [loading, setLoading] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const counterparty = userRole === 'buyer'
    ? deal.sellerCompany || 'the seller'
    : deal.buyerCompany || 'the buyer'

  const alreadyConfirmed = userRole === 'buyer' ? deal.buyerConfirmed : deal.sellerConfirmed
  const otherConfirmed = userRole === 'buyer' ? deal.sellerConfirmed : deal.buyerConfirmed

  async function handleConfirm(message?: string) {
    setLoading(true)
    try {
      await onConfirm(message || 'Yes, proceed')
    } finally {
      setLoading(false)
    }
  }

  if (alreadyConfirmed) {
    return (
      <div className={`p-6 rounded-2xl bg-green-500/10 border border-green-500/30 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-xl font-bold text-white mb-2">You've Confirmed</h3>
          <p className="text-white/60">
            {otherConfirmed
              ? 'Both parties confirmed. Deal is active!'
              : `Waiting for ${counterparty} to confirm...`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-6 rounded-2xl bg-white/5 border border-white/10 ${className}`}>
      {/* Deal Summary */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-1">{deal.title}</h3>
        <p className="text-white/40 text-sm mb-4">{deal.description || 'No description'}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white/40 text-xs mb-1">Amount</p>
            <p className="text-xl font-bold text-white">${deal.amount.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white/40 text-xs mb-1">Payment</p>
            <p className="text-lg font-medium text-white capitalize">{deal.paymentTerms}</p>
          </div>
        </div>
      </div>

      {/* Confirmation Status */}
      <div className="flex items-center justify-center gap-6 mb-6 py-3 border-y border-white/10">
        <div className={`flex items-center gap-2 ${deal.buyerConfirmed ? 'text-green-400' : 'text-white/40'}`}>
          <span className="text-lg">{deal.buyerConfirmed ? '✓' : '○'}</span>
          <span className="text-sm">Buyer</span>
        </div>
        <div className="w-8 h-px bg-white/20" />
        <div className={`flex items-center gap-2 ${deal.sellerConfirmed ? 'text-green-400' : 'text-white/40'}`}>
          <span className="text-lg">{deal.sellerConfirmed ? '✓' : '○'}</span>
          <span className="text-sm">Seller</span>
        </div>
      </div>

      {/* Quick Confirmations */}
      {!showCustom && (
        <div className="space-y-3">
          <p className="text-white/60 text-sm text-center">
            Confirm this deal with {counterparty}?
          </p>

          <div className="grid grid-cols-2 gap-2">
            {QUICK_CONFIRMATIONS.slice(0, 4).map(msg => (
              <button
                key={msg}
                onClick={() => handleConfirm(msg)}
                disabled={loading}
                className="py-3 px-4 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-xl text-green-400 font-medium transition-colors disabled:opacity-50"
              >
                {msg}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleConfirm()}
            disabled={loading}
            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl font-bold text-white text-lg transition-colors"
          >
            {loading ? 'Confirming...' : '✓ Yes, Proceed'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCustom(true)}
              className="flex-1 py-2 text-white/40 hover:text-white/60 text-sm transition-colors"
            >
              Add a note...
            </button>
            {onDecline && (
              <button
                onClick={onDecline}
                className="flex-1 py-2 text-red-400/60 hover:text-red-400 text-sm transition-colors"
              >
                Decline
              </button>
            )}
          </div>
        </div>
      )}

      {/* Custom Message */}
      {showCustom && (
        <div className="space-y-3">
          <textarea
            value={customMessage}
            onChange={e => setCustomMessage(e.target.value)}
            placeholder="Add a note with your confirmation..."
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 resize-none focus:outline-none focus:border-green-500/50"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setShowCustom(false)}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleConfirm(customMessage || 'Yes, proceed')}
              disabled={loading}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl font-bold text-white transition-colors"
            >
              {loading ? 'Confirming...' : 'Confirm with Note'}
            </button>
          </div>
        </div>
      )}

      {/* What happens next */}
      <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-blue-400 text-xs">
          <strong>What happens next:</strong> Once both parties confirm,
          {userRole === 'buyer'
            ? ' you can fund the escrow. Funds are held safely until delivery.'
            : ' the buyer will fund escrow. You deliver, they release funds.'}
        </p>
      </div>
    </div>
  )
}

export default DealConfirmation
