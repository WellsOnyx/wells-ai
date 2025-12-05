// @ts-nocheck
'use client'

/**
 * DealPayment Component
 * Shows payment status and controls for a deal
 *
 * Features:
 * - Payment status display
 * - "Pay with GRAIN" button
 * - Transaction history
 * - Release/refund controls
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export interface DealPaymentProps {
  dealId: string
  amount: number
  currency?: 'GRAIN' | 'USDC'
  platformFee: number
  status: string
  buyerId: string
  sellerId: string
  currentUserId: string
  escrowWalletAddress?: string
  paymentIntentId?: string
}

interface Transaction {
  id: string
  type: 'payment' | 'release' | 'refund'
  amount: number
  status: string
  createdAt: string
}

export default function DealPayment({
  dealId,
  amount,
  currency = 'GRAIN',
  platformFee,
  status,
  buyerId,
  sellerId,
  currentUserId,
  escrowWalletAddress,
  paymentIntentId,
}: DealPaymentProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [paymentStatus, setPaymentStatus] = useState<string>(status)

  const isBuyer = currentUserId === buyerId
  const isSeller = currentUserId === sellerId
  const totalAmount = amount + platformFee

  useEffect(() => {
    // Poll for payment status if pending
    if (paymentStatus === 'escrow_pending' && paymentIntentId) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/payments/${paymentIntentId}`)
          if (res.ok) {
            const data = await res.json()
            if (data.status === 'succeeded') {
              setPaymentStatus('escrowed')
              clearInterval(interval)
            }
          }
        } catch (error) {
          console.error('Error polling payment status:', error)
        }
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [paymentStatus, paymentIntentId])

  const handlePayNow = async () => {
    setLoading(true)

    try {
      // Accept the deal and create payment intent
      const res = await fetch('/api/deals/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      })

      if (!res.ok) {
        throw new Error('Failed to accept deal')
      }

      const data = await res.json()

      // Redirect to checkout
      router.push(data.checkoutUrl)
    } catch (error) {
      console.error('Error initiating payment:', error)
      alert('Failed to initiate payment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRelease = async () => {
    if (!confirm('Release payment to seller? This action cannot be undone.')) {
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/deals/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      })

      if (!res.ok) {
        throw new Error('Failed to release payment')
      }

      setPaymentStatus('released')
      alert('Payment released to seller!')
    } catch (error) {
      console.error('Error releasing payment:', error)
      alert('Failed to release payment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = () => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      proposed: { label: 'Proposed', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      agreed: { label: 'Agreed', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
      escrow_pending: { label: 'Awaiting Payment', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      escrowed: { label: 'Escrowed', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      in_progress: { label: 'In Progress', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      delivered: { label: 'Delivered', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
      released: { label: 'Completed', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
      refunded: { label: 'Refunded', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    }

    const config = statusConfig[paymentStatus] || statusConfig.proposed

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.className}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="card-premium p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Payment Status</h3>
          <p className="text-gray-400 text-sm">Deal ID: {dealId}</p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Payment Amount */}
      <div className="glass rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Deal Amount</span>
          <span className="text-white font-semibold">
            {amount.toLocaleString()} {currency}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Platform Fee ({((platformFee / amount) * 100).toFixed(2)}%)</span>
          <span className="text-gray-300">
            {platformFee.toLocaleString()} {currency}
          </span>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-white/10">
          <span className="text-white font-semibold">Total to Pay</span>
          <span className="text-2xl font-bold text-amber-500">
            {totalAmount.toLocaleString()} {currency}
          </span>
        </div>
      </div>

      {/* Escrow Address */}
      {escrowWalletAddress && paymentStatus === 'escrow_pending' && (
        <div className="glass-hover rounded-lg p-4 space-y-2">
          <label className="text-sm text-gray-400">Escrow Wallet Address</label>
          <div className="flex items-center gap-2 p-3 bg-black/40 rounded-lg font-mono text-sm">
            <input
              type="text"
              value={escrowWalletAddress}
              readOnly
              className="flex-1 bg-transparent text-white outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(escrowWalletAddress)
              }}
              className="text-amber-500 hover:text-amber-400 transition-colors"
              title="Copy address"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Buyer: Pay Now */}
        {isBuyer && (paymentStatus === 'agreed' || paymentStatus === 'escrow_pending') && (
          <button
            onClick={handlePayNow}
            disabled={loading}
            className="btn-premium-primary w-full py-3 font-bold"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              <>Pay {totalAmount.toLocaleString()} {currency} to Escrow</>
            )}
          </button>
        )}

        {/* Buyer: Release Payment */}
        {isBuyer && (paymentStatus === 'escrowed' || paymentStatus === 'delivered') && (
          <button
            onClick={handleRelease}
            disabled={loading}
            className="btn-premium-primary w-full py-3 font-bold"
          >
            {loading ? 'Releasing...' : 'Release Payment to Seller'}
          </button>
        )}

        {/* Status Messages */}
        {isSeller && paymentStatus === 'escrow_pending' && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
            <div className="text-blue-400 font-medium">Waiting for buyer payment</div>
            <div className="text-blue-300 text-sm mt-1">
              You'll be notified once funds are in escrow
            </div>
          </div>
        )}

        {isSeller && paymentStatus === 'escrowed' && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
            <div className="text-green-400 font-medium">Funds secured in escrow</div>
            <div className="text-green-300 text-sm mt-1">
              Begin work on the deliverables
            </div>
          </div>
        )}

        {paymentStatus === 'released' && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 text-green-400 font-medium">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Payment Complete</span>
            </div>
            <div className="text-green-300 text-sm mt-1">
              {isBuyer ? 'Payment released to seller' : 'Payment received'}
            </div>
          </div>
        )}
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Transaction History
          </h4>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="glass-hover rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    tx.status === 'succeeded' ? 'bg-green-500' : 'bg-amber-500'
                  }`} />
                  <div>
                    <div className="text-white text-sm font-medium capitalize">
                      {tx.type}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-white font-semibold">
                  {tx.amount.toLocaleString()} {currency}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-gray-500 text-xs pt-4 border-t border-white/5">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span>Protected by GRAIN Escrow • Powered by Circle</span>
      </div>
    </div>
  )
}
