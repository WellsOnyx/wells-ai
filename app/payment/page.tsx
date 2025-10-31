'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getPersonalityMessage, formatFeeMessage, formatTitheMessage } from '@/lib/personality'

// Force dynamic rendering to prevent build-time prerendering
export const dynamic = 'force-dynamic'

function PaymentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const rfqId = searchParams.get('rfqId')
  const quoteId = searchParams.get('quoteId')
  const amount = parseFloat(searchParams.get('amount') || '0')
  const wellsAIFee = parseFloat(searchParams.get('wellsAIFee') || '0')
  const tithe = parseFloat(searchParams.get('tithe') || '0')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'ach' | 'wire'>('card')
  const [loadingMessage, setLoadingMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handlePayment = async () => {
    if (!rfqId || !quoteId || !amount) {
      setError('Missing payment details')
      return
    }

    setLoading(true)
    setError(null)
    setLoadingMessage(getPersonalityMessage('playful', 'loadingStates'))

    try {
      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqId,
          quoteId,
          amount: Math.round(amount * 100), // Convert to cents
          wellsAIFee: Math.round(wellsAIFee * 100),
          tithe: Math.round(tithe * 100),
          paymentMethod
        })
      })

      const data = await response.json()

      if (data.success) {
        // In production, redirect to Stripe Checkout or use Elements
        // For MVP, simulate success
        setSuccess(true)
        setSuccessMessage(getPersonalityMessage('playful', 'successMessages'))
        setTimeout(() => {
          router.push(`/deal-confirmation?dealId=${data.dealId}`)
        }, 2000)
      } else {
        setError(data.error || getPersonalityMessage('playful', 'errorMessages'))
      }
    } catch (err: any) {
      setError(err.message || getPersonalityMessage('playful', 'errorMessages'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif text-[#183b6d] mb-2">{successMessage}</h1>
          <p className="text-sm text-[#575757]">Redirecting to deal confirmation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#9ea1a7] hover:text-[#183b6d] text-sm">
              ← Back
            </Link>
          </div>
          <h1 className="text-2xl font-serif text-[#183b6d] mt-2">Complete Payment</h1>
          <p className="text-sm text-[#575757] mt-1">
            Secure payment processing powered by Stripe
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Payment Form */}
          <div>
            <h2 className="text-lg font-medium text-[#183b6d] mb-4">Payment Method</h2>

            {/* Payment Method Selection */}
            <div className="space-y-3 mb-6">
              {[
                { id: 'card', label: 'Credit/Debit Card', icon: '💳', recommended: true },
                { id: 'ach', label: 'ACH Bank Transfer', icon: '🏦', recommended: false },
                { id: 'wire', label: 'Wire Transfer', icon: '💸', recommended: false }
              ].map(method => (
                <div
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`border rounded-sm p-4 cursor-pointer transition-all ${
                    paymentMethod === method.id
                      ? 'border-[#183b6d] bg-[#183b6d]/5'
                      : 'border-[#9ea1a7]/20 hover:border-[#183b6d]/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === method.id ? 'border-[#183b6d] bg-[#183b6d]' : 'border-[#9ea1a7]/30'
                    }`}>
                      {paymentMethod === method.id && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="text-xl">{method.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-[#183b6d]">{method.label}</div>
                    </div>
                    {method.recommended && (
                      <span className="text-xs px-2 py-1 bg-[#dba63f]/20 text-[#dba63f] rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Stripe Form Placeholder */}
            {paymentMethod === 'card' && (
              <div className="border border-[#9ea1a7]/20 rounded-sm p-6 bg-white mb-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#575757] mb-2 block">Card Number</label>
                    <div className="border border-[#9ea1a7]/30 rounded-sm p-3 bg-[#9ea1a7]/5">
                      <div className="text-sm text-[#9ea1a7]">Stripe Elements will load here</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-[#575757] mb-2 block">Expiry Date</label>
                      <div className="border border-[#9ea1a7]/30 rounded-sm p-3 bg-[#9ea1a7]/5">
                        <div className="text-sm text-[#9ea1a7]">MM/YY</div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-[#575757] mb-2 block">CVC</label>
                      <div className="border border-[#9ea1a7]/30 rounded-sm p-3 bg-[#9ea1a7]/5">
                        <div className="text-sm text-[#9ea1a7]">123</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'ach' && (
              <div className="border border-[#dba63f]/30 bg-[#dba63f]/5 rounded-sm p-4 mb-6">
                <p className="text-sm text-[#575757]">
                  ACH transfer details will be provided after clicking "Complete Payment".
                  Funds typically settle in 2-3 business days.
                </p>
              </div>
            )}

            {paymentMethod === 'wire' && (
              <div className="border border-[#dba63f]/30 bg-[#dba63f]/5 rounded-sm p-4 mb-6">
                <p className="text-sm text-[#575757]">
                  Wire transfer instructions will be provided after clicking "Complete Payment".
                  Same-day processing available for wires received before 2pm EST.
                </p>
              </div>
            )}

            {error && (
              <div className="border border-red-300 bg-red-50 rounded-sm p-4 mb-6">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={loading || !amount}
              className="w-full px-6 py-4 bg-[#183b6d] text-white font-medium rounded-sm hover:bg-[#0d2545] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? loadingMessage : `Complete Payment - $${amount.toLocaleString()}`}
            </button>

            <p className="text-xs text-[#9ea1a7] text-center mt-4">
              Secured by Stripe • PCI DSS compliant
            </p>
          </div>

          {/* Order Summary */}
          <div>
            <h2 className="text-lg font-medium text-[#183b6d] mb-4">Payment Summary</h2>

            <div className="border border-[#9ea1a7]/20 rounded-sm p-6 bg-white">
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#575757]">Product Cost</span>
                  <span className="text-[#183b6d] font-medium">
                    ${(amount - wellsAIFee).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <div>
                    <div className="text-[#575757]">Wells AI Platform Fee</div>
                    <div className="text-xs text-[#9ea1a7]">33 basis points (0.33%)</div>
                  </div>
                  <span className="text-[#183b6d] font-medium">
                    ${wellsAIFee.toLocaleString()}
                  </span>
                </div>

                <div className="border-t border-[#9ea1a7]/20 pt-4">
                  <div className="flex justify-between">
                    <span className="text-[#183b6d] font-medium">Total Payment</span>
                    <span className="text-[#183b6d] font-bold text-xl">
                      ${amount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#9ea1a7]/20 pt-4 mt-4">
                  <div className="bg-[#dba63f]/10 rounded-sm p-3">
                    <div className="text-xs text-[#575757] mb-1">First Fruits Contribution</div>
                    <div className="text-sm text-[#183b6d] font-medium">
                      ${tithe.toLocaleString()} → Adullam Sanctuaries
                    </div>
                    <p className="text-xs text-[#9ea1a7] mt-2">
                      10% of gross receipts supporting recovery and restoration ministry
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border border-[#9ea1a7]/20 rounded-sm p-4 bg-white">
              <h3 className="text-sm font-medium text-[#183b6d] mb-2">What happens next?</h3>
              <ol className="text-sm text-[#575757] space-y-2">
                <li className="flex gap-2">
                  <span className="text-[#dba63f]">1.</span>
                  <span>Payment processed securely via Stripe</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#dba63f]">2.</span>
                  <span>Supplier notified to begin production</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#dba63f]">3.</span>
                  <span>You receive order confirmation & tracking</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#dba63f]">4.</span>
                  <span>Product delivered per agreed terms</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#9ea1a7]">Loading payment details...</div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
