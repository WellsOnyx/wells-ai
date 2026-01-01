'use client'

/**
 * Deal Card Component
 *
 * Displays a single B2B deal with status, actions, and key info
 */

import { useState } from 'react'
import { B2BDeal, DealStatus } from '@/lib/deals/types'

interface DealCardProps {
  deal: B2BDeal
  userRole: 'buyer' | 'seller'
  onConfirm?: () => void
  onFund?: () => void
  onDeliver?: () => void
  onRelease?: () => void
  onClick?: () => void
  className?: string
}

const STATUS_CONFIG: Record<DealStatus, {
  label: string
  color: string
  bg: string
  icon: string
}> = {
  proposed: {
    label: 'Proposed',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    icon: '📋',
  },
  accepted: {
    label: 'Accepted',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    icon: '🤝',
  },
  funded: {
    label: 'Funded',
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    icon: '💰',
  },
  delivered: {
    label: 'Delivered',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    icon: '📦',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    icon: '✅',
  },
  disputed: {
    label: 'Disputed',
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    icon: '⚠️',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-400',
    bg: 'bg-gray-500/20',
    icon: '❌',
  },
  refunded: {
    label: 'Refunded',
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    icon: '↩️',
  },
}

export function DealCard({
  deal,
  userRole,
  onConfirm,
  onFund,
  onDeliver,
  onRelease,
  onClick,
  className = '',
}: DealCardProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const status = STATUS_CONFIG[deal.status]
  const isCompleted = ['completed', 'cancelled', 'refunded'].includes(deal.status)

  // Determine what action is available
  const canConfirm = deal.status === 'proposed' && (
    (userRole === 'buyer' && !deal.buyerConfirmed) ||
    (userRole === 'seller' && !deal.sellerConfirmed)
  )
  const canFund = userRole === 'buyer' && deal.status === 'accepted' && !deal.escrowFunded
  const canDeliver = userRole === 'seller' && deal.status === 'funded'
  const canRelease = userRole === 'buyer' && deal.status === 'delivered'

  async function handleAction(action: string, handler?: () => void) {
    if (!handler) return
    setLoading(action)
    try {
      await handler()
    } finally {
      setLoading(null)
    }
  }

  const counterparty = userRole === 'buyer'
    ? deal.sellerCompany || 'Seller'
    : deal.buyerCompany || 'Buyer'

  return (
    <div
      className={`
        p-4 rounded-xl border transition-all
        ${isCompleted ? 'bg-white/[0.02] border-white/5' : 'bg-white/5 border-white/10 hover:border-white/20'}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-white truncate">{deal.title}</h3>
          <p className="text-sm text-white/40">
            {userRole === 'buyer' ? 'From' : 'To'}: {counterparty}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${status.bg}`}>
          <span className="text-sm">{status.icon}</span>
          <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
        </div>
      </div>

      {/* Amount */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold text-white">
          ${deal.amount.toLocaleString()}
        </span>
        <span className="text-white/40 text-sm">{deal.currency}</span>
      </div>

      {/* Confirmation Status */}
      {deal.status === 'proposed' && (
        <div className="flex items-center gap-4 mb-3 text-sm">
          <div className={`flex items-center gap-1 ${deal.buyerConfirmed ? 'text-green-400' : 'text-white/40'}`}>
            {deal.buyerConfirmed ? '✓' : '○'} Buyer
          </div>
          <div className={`flex items-center gap-1 ${deal.sellerConfirmed ? 'text-green-400' : 'text-white/40'}`}>
            {deal.sellerConfirmed ? '✓' : '○'} Seller
          </div>
        </div>
      )}

      {/* Escrow Status */}
      {deal.status === 'accepted' && (
        <div className="mb-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-yellow-400 text-sm">
            {deal.escrowFunded
              ? '💰 Escrow funded'
              : userRole === 'buyer'
              ? '⏳ Ready to fund escrow'
              : '⏳ Awaiting buyer funding'}
          </p>
        </div>
      )}

      {/* Auto-release info */}
      {deal.status === 'delivered' && deal.autoRelease && (
        <div className="mb-3 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-blue-400 text-sm">
            ⏱️ Auto-release in {deal.autoReleaseDays} days if no dispute
          </p>
        </div>
      )}

      {/* Actions */}
      {!isCompleted && (canConfirm || canFund || canDeliver || canRelease) && (
        <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
          {canConfirm && (
            <button
              onClick={() => handleAction('confirm', onConfirm)}
              disabled={loading === 'confirm'}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
            >
              {loading === 'confirm' ? 'Confirming...' : 'Yes, Proceed'}
            </button>
          )}

          {canFund && (
            <button
              onClick={() => handleAction('fund', onFund)}
              disabled={loading === 'fund'}
              className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
            >
              {loading === 'fund' ? 'Funding...' : 'Fund Escrow'}
            </button>
          )}

          {canDeliver && (
            <button
              onClick={() => handleAction('deliver', onDeliver)}
              disabled={loading === 'deliver'}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
            >
              {loading === 'deliver' ? 'Marking...' : 'Mark Delivered'}
            </button>
          )}

          {canRelease && (
            <button
              onClick={() => handleAction('release', onRelease)}
              disabled={loading === 'release'}
              className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
            >
              {loading === 'release' ? 'Releasing...' : 'Release Funds'}
            </button>
          )}
        </div>
      )}

      {/* Completed badge */}
      {deal.status === 'completed' && (
        <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-emerald-400 text-sm font-medium">
            ✅ Deal complete. Everyone wins.
          </p>
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-3 text-xs text-white/30">
        {new Date(deal.createdAt).toLocaleDateString()} · {new Date(deal.createdAt).toLocaleTimeString()}
      </div>
    </div>
  )
}

export default DealCard
