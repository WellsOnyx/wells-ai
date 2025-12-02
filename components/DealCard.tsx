'use client'

/**
 * DealCard Component
 *
 * The one-click deal acceptance interface.
 * "Yes, proceed" = deal done, GRAIN escrowed, everyone wins.
 *
 * This is where the magic happens.
 * Powered by Grain & Vault.
 */

import { useState } from 'react'
import {
  Check,
  X,
  Clock,
  Shield,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Zap,
  Building,
  Star,
  Copy,
  ExternalLink,
} from 'lucide-react'
import type { Deal, DealStatus, Party } from '@/lib/transactions'
import type { TrustTier, TrustBadge } from '@/lib/trust'
import { getTierDisplayName, getTierColor, getBadgeInfo } from '@/lib/trust'

// ============================================================================
// PROPS
// ============================================================================

interface DealCardProps {
  deal: Deal
  viewerType: 'buyer' | 'seller'
  onAccept?: () => Promise<{
    nextAction: 'deposit_grain' | 'await_other_party' | 'already_escrowed'
    escrowAddress?: string
    totalRequired?: number
  }>
  onReject?: () => Promise<void>
  onCounter?: (newTerms: Partial<Deal['terms']>) => Promise<void>
  onMarkDelivered?: () => Promise<void>
  onConfirmDelivery?: () => Promise<void>
}

// ============================================================================
// STATUS DISPLAY
// ============================================================================

const STATUS_CONFIG: Record<DealStatus, { label: string; color: string; icon: typeof Check }> = {
  proposed: { label: 'Proposed', color: 'blue', icon: Clock },
  negotiating: { label: 'Negotiating', color: 'amber', icon: TrendingUp },
  agreed: { label: 'Agreed', color: 'green', icon: Check },
  escrow_pending: { label: 'Awaiting Payment', color: 'amber', icon: Clock },
  escrowed: { label: 'Funds Secured', color: 'green', icon: Shield },
  in_progress: { label: 'In Progress', color: 'blue', icon: Zap },
  delivered: { label: 'Delivered', color: 'purple', icon: Check },
  released: { label: 'Complete', color: 'green', icon: Check },
  disputed: { label: 'Disputed', color: 'red', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'gray', icon: X },
  refunded: { label: 'Refunded', color: 'gray', icon: Check },
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DealCard({
  deal,
  viewerType,
  onAccept,
  onReject,
  onCounter,
  onMarkDelivered,
  onConfirmDelivery,
}: DealCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [escrowInfo, setEscrowInfo] = useState<{
    address: string
    amount: number
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const otherParty = viewerType === 'buyer' ? deal.seller : deal.buyer
  const statusConfig = STATUS_CONFIG[deal.status]
  const StatusIcon = statusConfig.icon

  // Format GRAIN amount (1 GRAIN = $1 USDC)
  const formatGrain = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Copy escrow address to clipboard
  const copyAddress = async () => {
    if (!escrowInfo?.address) return
    await navigator.clipboard.writeText(escrowInfo.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Handle one-click accept
  const handleAccept = async () => {
    if (!onAccept) return

    setIsAccepting(true)
    setError(null)

    try {
      const result = await onAccept()

      // If buyer needs to deposit GRAIN
      if (result.nextAction === 'deposit_grain' && result.escrowAddress) {
        setEscrowInfo({
          address: result.escrowAddress,
          amount: result.totalRequired || deal.terms.amount + deal.platformFee,
        })
      }
      // Success messages for other actions are handled by parent
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to accept deal'
      setError(message)
    } finally {
      setIsAccepting(false)
    }
  }

  // Handle reject
  const handleReject = async () => {
    if (!onReject) return

    setIsRejecting(true)
    setError(null)

    try {
      await onReject()
    } catch {
      setError('Failed to reject deal')
    } finally {
      setIsRejecting(false)
    }
  }

  // Determine available actions
  const canAccept =
    onAccept &&
    (deal.status === 'proposed' || deal.status === 'negotiating') &&
    !isAccepting

  const canReject =
    onReject &&
    (deal.status === 'proposed' || deal.status === 'negotiating') &&
    !isRejecting

  const canMarkDelivered =
    onMarkDelivered &&
    viewerType === 'seller' &&
    (deal.status === 'escrowed' || deal.status === 'in_progress')

  const canConfirmDelivery =
    onConfirmDelivery &&
    viewerType === 'buyer' &&
    deal.status === 'delivered'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              statusConfig.color === 'green' ? 'bg-green-500/20 text-green-400' :
              statusConfig.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
              statusConfig.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
              statusConfig.color === 'red' ? 'bg-red-500/20 text-red-400' :
              statusConfig.color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
              'bg-gray-500/20 text-gray-400'
            }`}
          >
            <StatusIcon className="w-4 h-4" />
            {statusConfig.label}
          </div>

          {/* Amount in GRAIN */}
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {formatGrain(deal.terms.amount)} <span className="text-amber-400 text-lg">GRAIN</span>
            </div>
            <div className="text-sm text-gray-500">
              +{formatGrain(deal.platformFee)} fee ({deal.platformFeePercent.toFixed(2)}%)
            </div>
          </div>
        </div>

        {/* Description */}
        <h3 className="text-lg font-semibold text-white mb-2">
          {deal.terms.description}
        </h3>

        {/* Other Party */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Building className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="text-white font-medium">{otherParty.name}</div>
            <TrustBadgeDisplay trustScore={otherParty.trustScore} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* GRAIN Deposit Instructions */}
        {escrowInfo && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-amber-400 mb-3">
              <Shield className="w-5 h-5" />
              <span className="font-semibold">Deposit GRAIN to Escrow</span>
            </div>
            <p className="text-sm text-gray-300 mb-3">
              Send exactly <span className="font-bold text-white">{formatGrain(escrowInfo.amount)} GRAIN</span> to this escrow address on Base L2:
            </p>
            <div className="flex items-center gap-2 bg-black/30 rounded-lg p-3">
              <code className="text-xs text-amber-300 flex-1 font-mono break-all">
                {escrowInfo.address}
              </code>
              <button
                onClick={copyAddress}
                className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
              <ExternalLink className="w-3 h-3" />
              <a
                href={`https://basescan.org/address/${escrowInfo.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-400 transition-colors"
              >
                View on BaseScan
              </a>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {canAccept && (
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Yes, Proceed
                </>
              )}
            </button>
          )}

          {canReject && (
            <button
              onClick={handleReject}
              disabled={isRejecting}
              className="px-6 py-3 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isRejecting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <X className="w-5 h-5" />
              )}
              Decline
            </button>
          )}

          {canMarkDelivered && (
            <button
              onClick={onMarkDelivered}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Mark as Delivered
            </button>
          )}

          {canConfirmDelivery && (
            <button
              onClick={onConfirmDelivery}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Confirm & Release Funds
            </button>
          )}
        </div>
      </div>

      {/* Expandable Details */}
      <div className="border-t border-gray-800">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-3 flex items-center justify-between text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-sm">Deal Details</span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {isExpanded && (
          <div className="px-6 pb-6 space-y-4">
            {/* Deliverables */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Deliverables</h4>
              <ul className="space-y-1">
                {deal.terms.deliverables.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-white">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Timeline */}
            {deal.terms.timeline && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Timeline</h4>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-white">
                    <span className="text-gray-400">Start:</span>{' '}
                    {new Date(deal.terms.timeline.startDate).toLocaleDateString()}
                  </div>
                  <div className="text-white">
                    <span className="text-gray-400">End:</span>{' '}
                    {new Date(deal.terms.timeline.endDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}

            {/* GRAIN Escrow Status */}
            {deal.escrowBalance > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 mb-1">
                  <Shield className="w-5 h-5" />
                  <span className="font-medium">GRAIN Escrow Protected</span>
                </div>
                <p className="text-sm text-gray-400">
                  {formatGrain(deal.escrowBalance)} GRAIN securely held until delivery confirmed
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Powered by Grain & Vault on Base L2
                </p>
              </div>
            )}

            {/* Negotiation History */}
            {deal.messages.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Negotiation History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {deal.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg text-sm ${
                        msg.from === 'system'
                          ? 'bg-gray-800 text-gray-400'
                          : msg.from === 'buyer_ai'
                          ? 'bg-blue-500/10 text-blue-200'
                          : 'bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      <div className="font-medium mb-1">
                        {msg.from === 'system'
                          ? 'System'
                          : msg.from === 'buyer_ai'
                          ? 'Buyer AI'
                          : 'Seller AI'}
                      </div>
                      {msg.content}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// TRUST BADGE DISPLAY
// ============================================================================

interface TrustBadgeDisplayProps {
  trustScore?: Party['trustScore']
}

function TrustBadgeDisplay({ trustScore }: TrustBadgeDisplayProps) {
  if (!trustScore) {
    return (
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <span>New member</span>
      </div>
    )
  }

  const tierColor = getTierColor(trustScore.tier as TrustTier)

  return (
    <div className="flex items-center gap-2">
      <div
        className={`text-sm font-medium ${
          tierColor === 'gradient'
            ? 'bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent'
            : tierColor === 'amber'
            ? 'text-amber-400'
            : tierColor === 'purple'
            ? 'text-purple-400'
            : tierColor === 'green'
            ? 'text-green-400'
            : tierColor === 'blue'
            ? 'text-blue-400'
            : 'text-gray-400'
        }`}
      >
        {getTierDisplayName(trustScore.tier as TrustTier)}
      </div>

      {/* Trust Score */}
      <div className="flex items-center gap-1 text-sm text-gray-400">
        <Star className="w-3 h-3" />
        {trustScore.overall}
      </div>

      {/* Badges (show first 2) */}
      {trustScore.badges && trustScore.badges.length > 0 && (
        <div className="flex items-center gap-1">
          {(trustScore.badges as TrustBadge[]).slice(0, 2).map((badge) => {
            const info = getBadgeInfo(badge)
            return (
              <span
                key={badge}
                title={info.description}
                className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded"
              >
                {info.name}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default DealCard
