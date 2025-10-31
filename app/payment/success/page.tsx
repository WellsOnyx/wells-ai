/**
 * Wells AI - Payment Success Page
 * /payment/success
 *
 * Displays payment confirmation after successful Stripe checkout
 */

'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const [amount, setAmount] = useState<string>('')
  const [paymentId, setPaymentId] = useState<string>('')

  useEffect(() => {
    setAmount(searchParams.get('amount') || '')
    setPaymentId(searchParams.get('payment_id') || '')
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Success Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
          {/* Success Icon */}
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Payment Successful!
          </h1>

          <p className="text-gray-600 text-center mb-6">
            Your payment has been processed successfully.
          </p>

          {/* Payment Details */}
          {amount && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Amount Paid:</span>
                <span className="text-lg font-bold text-gray-900">
                  ${amount}
                </span>
              </div>
              {paymentId && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Payment ID:</span>
                  <span className="text-gray-700 font-mono">
                    {paymentId.substring(0, 20)}...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Next Steps */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-xs font-bold">1</span>
              </div>
              <p className="text-sm text-gray-600">
                A confirmation email has been sent to your inbox
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-xs font-bold">2</span>
              </div>
              <p className="text-sm text-gray-600">
                The seller has been notified and will process your order
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-xs font-bold">3</span>
              </div>
              <p className="text-sm text-gray-600">
                You'll receive updates on your order status
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/quotes"
              className="block w-full px-6 py-3 bg-black text-white text-center rounded-lg hover:bg-gray-800 transition font-medium"
            >
              View My Quotes
            </Link>
            <Link
              href="/"
              className="block w-full px-6 py-3 bg-gray-100 text-gray-700 text-center rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Support */}
        <div className="text-center mt-6 text-sm text-gray-500">
          Need help?{' '}
          <a href="mailto:support@wellsai.com" className="text-blue-600 hover:underline">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}
