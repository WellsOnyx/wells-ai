'use client'

/**
 * Checkout Page
 * Full-page checkout experience for GRAIN payments
 *
 * Supports:
 * - Payment links with URL params
 * - Deal-based payments
 * - Success/failure handling
 * - Redirect after completion
 */

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import GrainCheckout from '@/app/components/GrainCheckout'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isLoaded } = useUser()

  const [paymentDetails, setPaymentDetails] = useState<{
    amount: number
    currency: 'GRAIN' | 'USDC'
    description: string
    metadata?: Record<string, string>
    dealId?: string
    recipientName?: string
    redirectUrl?: string
  } | null>(null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    // Try to load payment details from URL params
    const amountParam = searchParams.get('amount')
    const descriptionParam = searchParams.get('description')
    const dealIdParam = searchParams.get('dealId')
    const paymentIdParam = searchParams.get('paymentId')

    if (paymentIdParam) {
      // Load payment details from API
      loadPaymentFromApi(paymentIdParam)
    } else if (amountParam && descriptionParam) {
      // Use URL params
      setPaymentDetails({
        amount: parseFloat(amountParam),
        currency: (searchParams.get('currency') as 'GRAIN' | 'USDC') || 'GRAIN',
        description: descriptionParam,
        dealId: dealIdParam || undefined,
        recipientName: searchParams.get('recipientName') || undefined,
        redirectUrl: searchParams.get('redirectUrl') || undefined,
        metadata: {
          source: searchParams.get('source') || 'checkout_page',
        },
      })
      setStatus('ready')
    } else {
      setErrorMessage('Missing required payment parameters')
      setStatus('error')
    }
  }, [searchParams])

  const loadPaymentFromApi = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}`)
      if (!res.ok) {
        throw new Error('Payment not found')
      }

      const data = await res.json()

      // Check if already paid
      if (data.status === 'succeeded') {
        setStatus('success')
        return
      }

      if (data.status === 'failed') {
        setErrorMessage('This payment has failed')
        setStatus('error')
        return
      }

      setPaymentDetails({
        amount: data.amount,
        currency: data.currency || 'GRAIN',
        description: data.description || 'Payment',
        dealId: data.metadata?.dealId,
        recipientName: data.metadata?.recipientName,
        redirectUrl: data.metadata?.redirectUrl,
        metadata: data.metadata,
      })
      setStatus('ready')
    } catch (error) {
      console.error('Failed to load payment:', error)
      setErrorMessage('Failed to load payment details')
      setStatus('error')
    }
  }

  const handleSuccess = (paymentId: string) => {
    setStatus('success')

    // Redirect after 3 seconds if redirect URL provided
    if (paymentDetails?.redirectUrl) {
      setTimeout(() => {
        router.push(paymentDetails.redirectUrl!)
      }, 3000)
    }
  }

  const handleError = (error: string) => {
    setErrorMessage(error)
    setStatus('error')
  }

  if (!isLoaded || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-premium p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <div className="text-gray-400">Loading payment...</div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card-premium p-8 text-center space-y-6 fade-in-up">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Success Message */}
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Payment Successful!</h1>
              <p className="text-gray-400">
                Your GRAIN payment has been processed successfully.
              </p>
            </div>

            {/* Payment Details */}
            {paymentDetails && (
              <div className="glass rounded-lg p-4 space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-white font-semibold">
                    {paymentDetails.amount.toLocaleString()} {paymentDetails.currency}
                  </span>
                </div>
                {paymentDetails.dealId && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Deal ID</span>
                    <span className="text-gray-300 font-mono text-sm">{paymentDetails.dealId}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {paymentDetails?.redirectUrl ? (
              <div className="text-sm text-gray-500">
                Redirecting you back...
              </div>
            ) : (
              <button
                onClick={() => router.push('/')}
                className="btn-premium-primary w-full"
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card-premium p-8 text-center space-y-6 fade-in-up">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Payment Error</h1>
              <p className="text-gray-400">
                {errorMessage || 'Something went wrong with your payment.'}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="btn-premium-primary w-full"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/')}
                className="btn-premium-secondary w-full"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Ready to pay
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full fade-in-up">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">Checkout</h1>
          <p className="text-gray-400">
            Complete your payment with GRAIN
          </p>
        </div>

        {/* Checkout Component */}
        {paymentDetails && (
          <GrainCheckout
            amount={paymentDetails.amount}
            currency={paymentDetails.currency}
            description={paymentDetails.description}
            metadata={paymentDetails.metadata}
            dealId={paymentDetails.dealId}
            recipientName={paymentDetails.recipientName}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {/* Footer */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-400 transition-colors text-sm"
          >
            ← Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="card-premium p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <div className="text-gray-400">Loading...</div>
            </div>
          </div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
