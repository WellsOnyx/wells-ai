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

import { useState, useEffect } from 'react'
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
   * Product/service description for dynamic pricing tier detection
   * Example: "50 tons of organic vegetables" or "Executive search for VP of Engineering"
   */
  productDescription?: string

  /**
   * Optional: Payment method (defaults to 'stripe')
   */
  paymentMethod?: 'stripe' | 'ach' | 'wire' | 'grain'

  /**
   * Optional: Use dynamic pricing (defaults to true)
   */
  useDynamicPricing?: boolean

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
  productDescription,
  paymentMethod = 'stripe',
  useDynamicPricing = true,
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
  const [pricingInfo, setPricingInfo] = useState<{
    totalFee: number
    processingCost: number
    wellsAIMargin: number
    industryTier: string
    confidence: number
    reasoning: string
  } | null>(null)

  const handleCheckout = async () => {
    if (!user) {
      setError('You must be signed in to make a payment')
      onError?.('You must be signed in to make a payment')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let wellsAIFee: number
      let total: number
      let tierInfo = ''

      // Use dynamic pricing if enabled and product description provided
      if (useDynamicPricing && productDescription) {
        // Call pricing API to get dynamic fee
        const pricingResponse = await fetch('/api/pricing/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amount / 100, // Convert to dollars
            paymentMethod,
            productDescription,
          }),
        })

        if (!pricingResponse.ok) {
          throw new Error('Failed to calculate dynamic pricing')
        }

        const pricingData = await pricingResponse.json()
        wellsAIFee = Math.round(pricingData.pricing.totalFee * 100) // Convert to cents
        total = amount + wellsAIFee

        // Store pricing info for display
        setPricingInfo({
          totalFee: wellsAIFee,
          processingCost: Math.round(pricingData.pricing.processingCostTotal * 100),
          wellsAIMargin: Math.round(pricingData.pricing.wellsAIRevenue * 100),
          industryTier: pricingData.detection.tier,
          confidence: pricingData.detection.confidence,
          reasoning: pricingData.detection.reasoning,
        })

        // Build tier info for confirmation
        const tierNames: Record<string, string> = {
          'commodities': 'Commodities (0.5%)',
          'standard': 'Standard B2B (2%)',
          'high-value': 'High-Value Services (3%)',
          'gtm-service': 'Full GTM Service (10%)',
        }

        tierInfo = `\nDetected Tier: ${tierNames[pricingData.detection.tier] || pricingData.detection.tier}\n` +
          `Confidence: ${(pricingData.detection.confidence * 100).toFixed(0)}%\n` +
          `Reasoning: ${pricingData.detection.reasoning}\n\n` +
          `Processing Cost: $${(pricingData.pricing.processingCostTotal).toFixed(2)}\n` +
          `Wells AI Margin: $${(pricingData.pricing.wellsAIRevenue).toFixed(2)}\n`
      } else {
        // Fallback to fixed 5.5% fee
        wellsAIFee = Math.round(amount * 0.055)
        total = amount + wellsAIFee
      }

      // Confirm with user
      const confirmed = confirm(
        `Payment Summary:\n\n` +
        `Amount: $${(amount / 100).toFixed(2)}\n` +
        (tierInfo || `Wells AI Platform Fee (5.5% - includes processing): $${(wellsAIFee / 100).toFixed(2)}\n`) +
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

  // Pre-calculate pricing on mount if using dynamic pricing
  useEffect(() => {
    if (useDynamicPricing && productDescription && !pricingInfo) {
      // Pre-calculate pricing to show user
      fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount / 100,
          paymentMethod,
          productDescription,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setPricingInfo({
            totalFee: Math.round(data.pricing.totalFee * 100),
            processingCost: Math.round(data.pricing.processingCostTotal * 100),
            wellsAIMargin: Math.round(data.pricing.wellsAIRevenue * 100),
            industryTier: data.detection.tier,
            confidence: data.detection.confidence,
            reasoning: data.detection.reasoning,
          })
        })
        .catch((err) => {
          console.error('Error pre-calculating pricing:', err)
        })
    }
  }, [useDynamicPricing, productDescription, amount, paymentMethod, pricingInfo])

  // Default button styles
  const defaultClassName = 'px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed'

  const tierNames: Record<string, string> = {
    'commodities': 'Commodities',
    'standard': 'Standard B2B',
    'high-value': 'High-Value Services',
    'gtm-service': 'Full GTM Service',
  }

  const tierColors: Record<string, string> = {
    'commodities': 'bg-green-50 border-green-200 text-green-800',
    'standard': 'bg-blue-50 border-blue-200 text-blue-800',
    'high-value': 'bg-purple-50 border-purple-200 text-purple-800',
    'gtm-service': 'bg-orange-50 border-orange-200 text-orange-800',
  }

  return (
    <div>
      {/* Pricing Info Display */}
      {pricingInfo && useDynamicPricing && (
        <div className="mb-4 p-4 rounded-lg border bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Dynamic Pricing</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${tierColors[pricingInfo.industryTier] || 'bg-gray-50 border-gray-200 text-gray-800'}`}>
              {tierNames[pricingInfo.industryTier] || pricingInfo.industryTier}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Transaction Amount:</span>
              <span className="font-medium text-gray-900">${(amount / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Processing Cost:</span>
              <span className="font-mono text-gray-900">${(pricingInfo.processingCost / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Wells AI Margin:</span>
              <span className="font-mono text-gray-900">${(pricingInfo.wellsAIMargin / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
              <span>Total Fee:</span>
              <span className="text-gray-900">${(pricingInfo.totalFee / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-lg">
              <span>You Pay:</span>
              <span className="text-gray-900">${((amount + pricingInfo.totalFee) / 100).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
            <strong>Detection:</strong> {pricingInfo.reasoning}
            <br />
            <strong>Confidence:</strong> {(pricingInfo.confidence * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        disabled={!isLoaded || loading}
        className={className || defaultClassName}
      >
        {loading ? 'Processing...' : buttonText}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}
