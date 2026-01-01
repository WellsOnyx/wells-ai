'use client'

/**
 * Deal Flow Component
 *
 * Visual representation of deal progress through stages
 */

import { B2BDeal, DealStatus } from '@/lib/deals/types'

interface DealFlowProps {
  deal: B2BDeal
  userRole: 'buyer' | 'seller'
  className?: string
}

const STAGES: {
  status: DealStatus | 'confirm'
  label: string
  icon: string
}[] = [
  { status: 'proposed', label: 'Proposed', icon: '📋' },
  { status: 'confirm', label: 'Confirmed', icon: '🤝' },
  { status: 'funded', label: 'Funded', icon: '💰' },
  { status: 'delivered', label: 'Delivered', icon: '📦' },
  { status: 'completed', label: 'Complete', icon: '✅' },
]

function getStageIndex(deal: B2BDeal): number {
  switch (deal.status) {
    case 'proposed':
      return deal.buyerConfirmed || deal.sellerConfirmed ? 0.5 : 0
    case 'accepted':
      return deal.escrowFunded ? 2 : 1.5
    case 'funded':
      return 2
    case 'delivered':
      return 3
    case 'completed':
      return 4
    default:
      return 0
  }
}

export function DealFlow({ deal, userRole, className = '' }: DealFlowProps) {
  const currentStageIndex = getStageIndex(deal)
  const isDisputed = deal.status === 'disputed'
  const isCancelled = deal.status === 'cancelled' || deal.status === 'refunded'

  if (isDisputed) {
    return (
      <div className={`p-4 rounded-xl bg-red-500/10 border border-red-500/30 ${className}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="font-semibold text-red-400">Deal Disputed</h4>
            <p className="text-sm text-white/60">Under review. We'll resolve within 24 hours.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isCancelled) {
    return (
      <div className={`p-4 rounded-xl bg-gray-500/10 border border-gray-500/30 ${className}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{deal.status === 'refunded' ? '↩️' : '❌'}</span>
          <div>
            <h4 className="font-semibold text-gray-400">
              {deal.status === 'refunded' ? 'Refunded' : 'Cancelled'}
            </h4>
            <p className="text-sm text-white/60">
              {deal.status === 'refunded' ? 'Funds returned to buyer.' : 'This deal was cancelled.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Progress Bar */}
      <div className="relative mb-2">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${(currentStageIndex / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="flex justify-between">
        {STAGES.map((stage, index) => {
          const isComplete = index < currentStageIndex
          const isCurrent = Math.floor(currentStageIndex) === index
          const isPartial = currentStageIndex > index && currentStageIndex < index + 1

          return (
            <div
              key={stage.status}
              className={`flex flex-col items-center ${
                isComplete || isCurrent ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg
                  transition-all duration-300
                  ${isComplete
                    ? 'bg-green-500/20 border-2 border-green-500'
                    : isCurrent || isPartial
                    ? 'bg-purple-500/20 border-2 border-purple-500 animate-pulse'
                    : 'bg-white/5 border-2 border-white/20'}
                `}
              >
                {isComplete ? '✓' : stage.icon}
              </div>
              <span className={`mt-1 text-xs ${isComplete || isCurrent ? 'text-white' : 'text-white/40'}`}>
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Current Status Description */}
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <CurrentStatusMessage deal={deal} userRole={userRole} />
      </div>
    </div>
  )
}

function CurrentStatusMessage({ deal, userRole }: { deal: B2BDeal; userRole: 'buyer' | 'seller' }) {
  const messages: Record<string, { buyer: string; seller: string }> = {
    proposed: {
      buyer: deal.buyerConfirmed
        ? 'You confirmed. Waiting for seller...'
        : 'Review the deal and confirm to proceed.',
      seller: deal.sellerConfirmed
        ? 'You confirmed. Waiting for buyer...'
        : 'Review the deal and confirm to proceed.',
    },
    accepted: {
      buyer: deal.escrowFunded
        ? 'Escrow funded. Waiting for delivery.'
        : 'Both parties confirmed! Fund the escrow to proceed.',
      seller: deal.escrowFunded
        ? 'Escrow funded. Ready to deliver!'
        : 'Both parties confirmed! Waiting for buyer to fund escrow.',
    },
    funded: {
      buyer: 'Funds are safe in escrow. Waiting for seller to deliver.',
      seller: 'Escrow is funded. Deliver and mark complete to receive payment.',
    },
    delivered: {
      buyer: deal.autoRelease
        ? `Delivery marked. Review and release funds, or auto-release in ${deal.autoReleaseDays} days.`
        : 'Delivery marked complete. Confirm receipt to release funds.',
      seller: 'Marked as delivered. Waiting for buyer to release funds.',
    },
    completed: {
      buyer: 'Deal complete! Funds released to seller.',
      seller: 'Deal complete! Funds received.',
    },
  }

  const msg = messages[deal.status]?.[userRole] || 'Processing...'

  return <p className="text-sm text-white/70">{msg}</p>
}

export default DealFlow
