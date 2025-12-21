'use client'

/**
 * Deposit Checkout Page
 *
 * Demo checkout for sandbox mode.
 * In production, this redirects to Circle's hosted checkout.
 */

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  CreditCard,
  Lock,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded } = useUser()

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const amount = parseFloat(searchParams.get('amount') || '0')
  const paymentIntentId = searchParams.get('paymentIntentId') || ''
  const sessionId = searchParams.get('session') || paymentIntentId

  // Calculate GRAIN amount (1:1 for now)
  const grainAmount = amount

  async function handlePayment() {
    if (processing) return
    setProcessing(true)
    setError(null)

    try {
      // In sandbox mode, simulate successful payment
      // This calls our complete deposit endpoint
      const response = await fetch('/api/grain-vault/deposit/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          paymentIntentId,
          amount,
          // Demo card - in production Circle handles this
          demo: true
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed')
      }

      setSuccess(true)

      // Redirect to success page after brief delay
      setTimeout(() => {
        router.push(`/grain-vault/deposit/success?session=${sessionId}&amount=${amount}&grain=${data.grainAmount || grainAmount}`)
      }, 1500)
    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed. Please try again.')
      setProcessing(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    )
  }

  if (!user) {
    router.push('/grain-vault/signin')
    return null
  }

  if (amount <= 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Amount</h1>
          <p className="text-gray-400 mb-6">No deposit amount specified.</p>
          <Link
            href="/grain-vault/deposit"
            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Deposit
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/grain-vault/deposit"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-3xl font-bold">Complete Deposit</h1>
          <p className="text-gray-400 mt-2">Secure payment via Circle</p>
        </div>

        {/* Amount Card */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <div className="text-center mb-6">
            <p className="text-gray-400 text-sm mb-1">Deposit Amount</p>
            <p className="text-4xl font-bold text-white">${amount.toFixed(2)}</p>
            <p className="text-green-400 mt-2">
              You will receive ~{grainAmount.toFixed(2)} GRAIN
            </p>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Processing Fee</span>
              <span className="text-white">$0.00</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">GRAIN Price</span>
              <span className="text-white">$1.00</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t border-gray-800 mt-2">
              <span className="text-white">Total</span>
              <span className="text-green-400">${amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Demo Card Form */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-green-500" />
            <span className="font-semibold">Card Details</span>
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded ml-auto">
              SANDBOX
            </span>
          </div>

          {/* Demo card number */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 block mb-2">Card Number</label>
            <div className="bg-gray-800 rounded-lg px-4 py-3 text-gray-300 font-mono">
              4242 4242 4242 4242
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Expiry</label>
              <div className="bg-gray-800 rounded-lg px-4 py-3 text-gray-300 font-mono">
                12/29
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">CVC</label>
              <div className="bg-gray-800 rounded-lg px-4 py-3 text-gray-300 font-mono">
                123
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            This is a sandbox demo. No real charges will be made.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePayment}
          disabled={processing || success}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
            success
              ? 'bg-green-500 text-white'
              : processing
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {success ? (
            <>
              <CheckCircle className="w-6 h-6" />
              Payment Successful!
            </>
          ) : processing ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Lock className="w-5 h-5" />
              Pay ${amount.toFixed(2)}
            </>
          )}
        </button>

        {/* Security Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="w-3 h-3" />
            Secured by Circle
          </div>
          <p>Your payment is protected by bank-grade encryption</p>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
