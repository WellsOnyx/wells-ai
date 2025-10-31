/**
 * Wells AI - Checkout Button Component
 * Reusable component for initiating Stripe Checkout
 *
 * Usage:
 * <CheckoutButton
 *   amount={10000}
 *   description="Acme Widgets x100"
 *   metadata={{ rfqId: 'rfq_123', quoteId: 'quote_456' }}
 * />
 */

'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'

interface CheckoutButtonProps {
  /**
   * Amount in cents (e.g., 10000 = $100.00)
   */
  amount: number

  /**
   * Description of what the buyer is purchasing
   */
  description: string

  /**
   * Optional: Seller's Stripe Connect account ID
   */
  sellerStripeAccountId?: string

  /**
   * Optional: Additional metadata to attach to the payment
   */
  metadata?: Record<string, string>

  /**
   * Optional: Custom button text
   */
  buttonText?: string

  /**
   * Optional: Custom button class
   */
  className?: string

  /**
   * Optional: Success callback
   */
  onSuccess?: () => void

  /**
   * Optional: Error callback
   */
  onError?: (error: string) => void
}

export default function CheckoutButton({
  amount,
  description,
  sellerStripeAccountId,
  metadata = {},
  buttonText = 'Pay Now',
  className,
  onSuccess,
  onError
}: CheckoutButtonProps) {
  const { user, isLoaded } = useUser()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async () => {
    if (!user) {
      setError('You must be signed in to make a payment')
      onError?.('You must be signed in to make a payment')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Calculate pricing for display
      const wellsAIFee = Math.round(amount * 0.055)
      const total = amount + wellsAIFee

      // Confirm with user
      const confirmed = confirm(
        `Payment Summary:\n\n` +
        `Amount: $${(amount / 100).toFixed(2)}\n` +
        `Wells AI Platform Fee (5.5% - includes processing): $${(wellsAIFee / 100).toFixed(2)}\n` +
        `Total: $${(total / 100).toFixed(2)}\n\n` +
        `Proceed to payment?`
      )

      if (!confirmed) {
        setLoading(false)
        return
      }

      // Create checkout session
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount,
          description,
          buyerEmail: user.emailAddresses[0]?.emailAddress || '',
          sellerStripeAccountId,
          metadata
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to create checkout session')
      }

      const data = await response.json()

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        onSuccess?.()
        window.location.href = data.checkoutUrl
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err: any) {
      console.error('Checkout error:', err)
      const errorMessage = err.message || 'Failed to initiate checkout'
      setError(errorMessage)
      onError?.(errorMessage)
      setLoading(false)
    }
  }

  // Default button styles
  const defaultClassName = 'px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={!isLoaded || loading}
        className={className || defaultClassName}
      >
        {loading ? 'Processing...' : buttonText}
      </button>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}
