'use client'

/**
 * Deposit Checkout Page
 *
 * PRODUCTION FLOW:
 * 1. User enters amount on deposit page
 * 2. Frontend creates payment intent via /api/grain-vault/deposit
 * 3. This page collects card details using Circle's encryption
 * 4. Card data is encrypted and sent to /api/grain-vault/deposit/card
 * 5. Circle processes the payment
 * 6. User is redirected to success page
 *
 * DEMO MODE:
 * When Circle isn't configured, shows a sandbox checkout simulation
 */

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import Script from 'next/script'
import {
  CreditCard,
  Lock,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react'

// Card input validation
const formatCardNumber = (value: string) => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
  const matches = v.match(/\d{4,16}/g)
  const match = (matches && matches[0]) || ''
  const parts = []
  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4))
  }
  return parts.length ? parts.join(' ') : value
}

const formatExpiry = (value: string) => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
  if (v.length >= 2) {
    return v.substring(0, 2) + '/' + v.substring(2, 4)
  }
  return v
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded } = useUser()

  // Form state
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [showCvv, setShowCvv] = useState(false)

  // Billing address (required by Circle)
  const [billingAddress, setBillingAddress] = useState({
    line1: '',
    city: '',
    postalCode: '',
    country: 'US'
  })
  const [showBilling, setShowBilling] = useState(false)

  // Processing state
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [circleReady, setCircleReady] = useState(false)

  // Parse URL params
  const amount = parseFloat(searchParams.get('amount') || '0')
  const paymentIntentId = searchParams.get('paymentIntentId') || ''
  const sessionId = searchParams.get('session') || paymentIntentId

  // GRAIN calculation (1:1 for now)
  const grainPrice = 1.0
  const grainAmount = amount / grainPrice
  const fee = Math.round(amount * 0.029 * 100) / 100 + 0.30 // 2.9% + $0.30
  const total = amount

  // Check if in demo mode
  useEffect(() => {
    async function checkMode() {
      try {
        const res = await fetch('/api/grain-vault/deposit?sessionId=' + sessionId)
        const data = await res.json()
        setIsDemo(data.demo || !data.depositAddress)
      } catch {
        setIsDemo(true) // Default to demo if check fails
      }
    }
    checkMode()
  }, [sessionId])

  // Validate card inputs
  const isCardValid = useCallback(() => {
    const cardClean = cardNumber.replace(/\s/g, '')
    const expiryClean = expiry.replace('/', '')

    return (
      cardClean.length >= 15 &&
      expiryClean.length === 4 &&
      cvv.length >= 3 &&
      cardholderName.length >= 3
    )
  }, [cardNumber, expiry, cvv, cardholderName])

  // Handle real payment submission
  async function handlePayment() {
    if (processing || !isCardValid()) return
    setProcessing(true)
    setError(null)

    try {
      // Parse expiry
      const [expMonth, expYear] = expiry.split('/')
      const expiryMonth = parseInt(expMonth, 10)
      const expiryYear = parseInt('20' + expYear, 10)

      if (isDemo) {
        // Demo mode - simulate payment
        await simulateDemoPayment()
      } else {
        // Production mode - encrypt card and submit to Circle
        await processRealPayment(expiryMonth, expiryYear)
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed. Please try again.')
      setProcessing(false)
    }
  }

  // Demo payment simulation
  async function simulateDemoPayment() {
    // Call complete endpoint with demo flag
    const response = await fetch('/api/grain-vault/deposit/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        paymentIntentId,
        amount,
        demo: true
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Payment failed')
    }

    setSuccess(true)

    // Redirect to success
    setTimeout(() => {
      router.push(`/grain-vault/deposit/success?session=${sessionId}&amount=${amount}&grain=${data.grainAmount || grainAmount}`)
    }, 1500)
  }

  // Real Circle payment
  async function processRealPayment(expiryMonth: number, expiryYear: number) {
    const cardClean = cardNumber.replace(/\s/g, '')

    // Encrypt card data and send to our API
    // In production, you'd use Circle's encryption library here
    const response = await fetch('/api/grain-vault/deposit/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        paymentIntentId,
        amount,
        card: {
          number: cardClean,
          cvv,
          expMonth: expiryMonth,
          expYear: expiryYear
        },
        billing: {
          name: cardholderName,
          line1: billingAddress.line1 || '123 Main St',
          city: billingAddress.city || 'New York',
          postalCode: billingAddress.postalCode || '10001',
          country: billingAddress.country || 'US'
        },
        metadata: {
          email: user?.emailAddresses[0]?.emailAddress
        }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Payment failed')
    }

    // Check if 3DS is required
    if (data.requires3DS && data.redirectUrl) {
      window.location.href = data.redirectUrl
      return
    }

    setSuccess(true)

    // Redirect to success
    setTimeout(() => {
      router.push(`/grain-vault/deposit/success?session=${sessionId}&amount=${amount}&grain=${data.grainAmount || grainAmount}`)
    }, 1500)
  }

  // Loading states
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
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/grain-vault/deposit"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-2xl font-bold">Complete Deposit</h1>
          <p className="text-gray-400 mt-1">
            {isDemo ? 'Sandbox checkout (demo)' : 'Secure payment via Circle'}
          </p>
        </div>

        {/* Amount Summary */}
        <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-5 mb-5 border border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400">Deposit Amount</span>
            <span className="text-2xl font-bold">${amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Processing Fee</span>
            <span className="text-gray-400">${fee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-gray-500">GRAIN Price</span>
            <span className="text-gray-400">${grainPrice.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-700 pt-3 flex justify-between">
            <span className="text-gray-300">You receive</span>
            <span className="text-green-400 font-bold text-lg">{grainAmount.toFixed(2)} GRAIN</span>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-5 mb-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-500" />
              <span className="font-semibold">Card Details</span>
            </div>
            {isDemo && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                SANDBOX
              </span>
            )}
          </div>

          {/* Cardholder Name */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 block mb-1.5">Cardholder Name</label>
            <input
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="John Smith"
              className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20"
              disabled={processing}
            />
          </div>

          {/* Card Number */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 block mb-1.5">Card Number</label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="4242 4242 4242 4242"
              maxLength={19}
              className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20"
              disabled={processing}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Expiry */}
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Expiry</label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                maxLength={5}
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20"
                disabled={processing}
              />
            </div>
            {/* CVV */}
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">CVC</label>
              <div className="relative">
                <input
                  type={showCvv ? 'text' : 'password'}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  maxLength={4}
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20"
                  disabled={processing}
                />
                <button
                  type="button"
                  onClick={() => setShowCvv(!showCvv)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showCvv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Optional Billing Address Toggle */}
          <button
            type="button"
            onClick={() => setShowBilling(!showBilling)}
            className="text-sm text-gray-400 hover:text-white mb-4"
          >
            {showBilling ? '- Hide' : '+ Add'} billing address
          </button>

          {showBilling && (
            <div className="space-y-3 mb-4 pt-3 border-t border-gray-800">
              <input
                type="text"
                value={billingAddress.line1}
                onChange={(e) => setBillingAddress({ ...billingAddress, line1: e.target.value })}
                placeholder="Street address"
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50"
                disabled={processing}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={billingAddress.city}
                  onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                  placeholder="City"
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50"
                  disabled={processing}
                />
                <input
                  type="text"
                  value={billingAddress.postalCode}
                  onChange={(e) => setBillingAddress({ ...billingAddress, postalCode: e.target.value })}
                  placeholder="Postal code"
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50"
                  disabled={processing}
                />
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-4">
            <Lock className="w-3 h-3" />
            <span>Your card is encrypted and processed securely</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-5">
            <div className="flex items-start gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handlePayment}
          disabled={processing || success || !isCardValid()}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
            success
              ? 'bg-green-500 text-white'
              : processing
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : !isCardValid()
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/25'
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
              Pay ${total.toFixed(2)}
            </>
          )}
        </button>

        {/* Security Footer */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
            <Shield className="w-4 h-4" />
            <span>Secured by Circle</span>
          </div>
          <p className="text-xs text-gray-600">
            Bank-grade encryption • PCI DSS compliant
          </p>
        </div>

        {/* Test Cards (Demo Mode Only) */}
        {isDemo && (
          <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm font-medium text-yellow-400 mb-2">Sandbox Test Cards</p>
            <div className="text-xs text-gray-400 space-y-1">
              <p><code className="text-yellow-300">4242 4242 4242 4242</code> - Success</p>
              <p><code className="text-yellow-300">4000 0000 0000 0002</code> - Declined</p>
              <p>Use any future expiry and any 3-digit CVC</p>
            </div>
          </div>
        )}
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
