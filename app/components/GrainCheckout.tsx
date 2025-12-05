// @ts-nocheck
'use client'

/**
 * GrainCheckout Component
 * Embedded checkout UI for Grain & Vault payments
 *
 * Features:
 * - Shows amount, GRAIN balance, and payment details
 * - Initiates payment intent via API
 * - Polls for payment status or uses webhook
 * - Premium dark theme with amber accents
 */

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

export interface GrainCheckoutProps {
  amount: number
  currency?: 'GRAIN' | 'USDC'
  description: string
  metadata?: Record<string, string>
  onSuccess: (paymentId: string) => void
  onError: (error: string) => void
  dealId?: string
  recipientName?: string
}

interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  walletAddress?: string
  qrCode?: string
}

export default function GrainCheckout({
  amount,
  currency = 'GRAIN',
  description,
  metadata,
  onSuccess,
  onError,
  dealId,
  recipientName,
}: GrainCheckoutProps) {
  const { user, isLoaded } = useUser()
  const [loading, setLoading] = useState(false)
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null)
  const [grainBalance, setGrainBalance] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  // Fetch GRAIN balance if user is logged in
  useEffect(() => {
    if (isLoaded && user) {
      fetchGrainBalance()
    }
  }, [isLoaded, user])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  const fetchGrainBalance = async () => {
    try {
      const res = await fetch('/api/treasury/balance')
      if (res.ok) {
        const data = await res.json()
        setGrainBalance(data.balance || 0)
      }
    } catch (err) {
      console.error('Failed to fetch GRAIN balance:', err)
    }
  }

  const initiatePayment = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency,
          description,
          metadata: {
            ...metadata,
            dealId,
          },
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create payment intent')
      }

      const intent = await res.json()
      setPaymentIntent(intent)

      // Start polling for payment status
      startPolling(intent.id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed'
      setError(errorMessage)
      onError(errorMessage)
      setLoading(false)
    }
  }

  const startPolling = (paymentId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}`)
        if (res.ok) {
          const data = await res.json()

          if (data.status === 'succeeded') {
            clearInterval(interval)
            setPollingInterval(null)
            setLoading(false)
            onSuccess(paymentId)
          } else if (data.status === 'failed') {
            clearInterval(interval)
            setPollingInterval(null)
            setLoading(false)
            const errorMsg = data.error || 'Payment failed'
            setError(errorMsg)
            onError(errorMsg)
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000) // Poll every 3 seconds

    setPollingInterval(interval)
  }

  const hasEnoughBalance = grainBalance !== null && grainBalance >= amount

  return (
    <div className="card-premium p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-2xl font-bold text-white mb-1">Pay with GRAIN</h2>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>

      {/* Amount Display */}
      <div className="glass rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-start">
          <span className="text-gray-400">Amount</span>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              {amount.toLocaleString()} <span className="text-amber-500">{currency}</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              ≈ ${amount.toLocaleString()} USD
            </div>
          </div>
        </div>

        {recipientName && (
          <div className="flex justify-between items-center pt-3 border-t border-white/5">
            <span className="text-gray-400">To</span>
            <span className="text-white font-medium">{recipientName}</span>
          </div>
        )}

        {dealId && (
          <div className="flex justify-between items-center pt-3 border-t border-white/5">
            <span className="text-gray-400">Deal ID</span>
            <span className="text-gray-300 font-mono text-sm">{dealId}</span>
          </div>
        )}
      </div>

      {/* Balance Display */}
      {isLoaded && user && grainBalance !== null && (
        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
          <span className="text-gray-400 text-sm">Your GRAIN Balance</span>
          <div className="text-right">
            <div className="text-lg font-semibold text-white">
              {grainBalance.toLocaleString()} GRAIN
            </div>
            {!hasEnoughBalance && (
              <div className="text-xs text-red-400 mt-1">Insufficient balance</div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="text-red-400 font-medium">Payment Error</div>
              <div className="text-red-300 text-sm mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Intent Display */}
      {paymentIntent && paymentIntent.status === 'pending' && (
        <div className="glass-hover rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="pulse-glow w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-white font-medium">Waiting for payment...</span>
          </div>

          {paymentIntent.walletAddress && (
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Send GRAIN to:</label>
              <div className="flex items-center gap-2 p-3 bg-black/40 rounded-lg font-mono text-sm">
                <input
                  type="text"
                  value={paymentIntent.walletAddress}
                  readOnly
                  className="flex-1 bg-transparent text-white outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentIntent.walletAddress!)
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

          {paymentIntent.qrCode && (
            <div className="flex justify-center py-4">
              <img src={paymentIntent.qrCode} alt="Payment QR Code" className="w-48 h-48" />
            </div>
          )}

          <div className="text-xs text-gray-500 text-center">
            This page will update automatically when payment is confirmed
          </div>
        </div>
      )}

      {/* Action Button */}
      {!paymentIntent && (
        <button
          onClick={initiatePayment}
          disabled={loading || (isLoaded && user && !hasEnoughBalance)}
          className="btn-premium-primary w-full py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            <>Pay {amount.toLocaleString()} {currency}</>
          )}
        </button>
      )}

      {/* Not Logged In Warning */}
      {isLoaded && !user && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="text-amber-400 font-medium">Sign In Required</div>
              <div className="text-amber-300 text-sm mt-1">
                Please sign in to complete this payment
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span>Secured by Grain & Vault • Powered by Circle</span>
      </div>
    </div>
  )
}
