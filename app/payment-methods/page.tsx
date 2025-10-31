/**
 * Wells AI - Payment Methods Management
 * /payment-methods
 *
 * Allows buyers to:
 * - View saved payment methods
 * - Add new payment method
 * - Set default payment method
 * - Delete payment method
 */

'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

// ===== TYPES =====

interface PaymentMethod {
  id: string
  type: string
  card?: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  }
  isDefault: boolean
}

// ===== MAIN COMPONENT =====

export default function PaymentMethodsPage() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentMethodsContent />
    </Elements>
  )
}

// ===== CONTENT COMPONENT =====

function PaymentMethodsContent() {
  const { user, isLoaded } = useUser()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Load payment methods
  useEffect(() => {
    if (isLoaded && user) {
      loadPaymentMethods()
    }
  }, [isLoaded, user])

  const loadPaymentMethods = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/stripe/payment-methods')

      if (!response.ok) {
        throw new Error('Failed to load payment methods')
      }

      const data = await response.json()
      setPaymentMethods(data.paymentMethods || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/stripe/payment-methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId,
          action: 'set_default'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to set default payment method')
      }

      setSuccess('Default payment method updated')
      await loadPaymentMethods()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) {
      return
    }

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/stripe/payment-methods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId })
      })

      if (!response.ok) {
        throw new Error('Failed to delete payment method')
      }

      setSuccess('Payment method deleted')
      await loadPaymentMethods()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading payment methods...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Please sign in to manage payment methods</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Methods</h1>
          <p className="text-gray-600 mt-2">
            Manage your saved payment methods for faster checkout
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Payment Methods List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Saved Cards</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {paymentMethods.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No payment methods saved yet
              </div>
            ) : (
              paymentMethods.map((method) => (
                <div key={method.id} className="p-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Card Icon */}
                    <div className="w-12 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center text-white font-bold text-xs">
                      {method.card?.brand.toUpperCase()}
                    </div>

                    {/* Card Details */}
                    <div>
                      <div className="font-medium text-gray-900">
                        {method.card?.brand} •••• {method.card?.last4}
                      </div>
                      <div className="text-sm text-gray-500">
                        Expires {method.card?.exp_month}/{method.card?.exp_year}
                      </div>
                      {method.isDefault && (
                        <div className="text-xs text-green-600 font-medium mt-1">
                          Default
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3">
                    {!method.isDefault && (
                      <button
                        onClick={() => handleSetDefault(method.id)}
                        className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(method.id)}
                      className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Payment Method */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full px-6 py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium"
          >
            + Add Payment Method
          </button>
        ) : (
          <AddPaymentMethodForm
            onSuccess={() => {
              setShowAddForm(false)
              setSuccess('Payment method added successfully')
              loadPaymentMethods()
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </div>
  )
}

// ===== ADD PAYMENT METHOD FORM =====

interface AddPaymentMethodFormProps {
  onSuccess: () => void
  onCancel: () => void
}

function AddPaymentMethodForm({ onSuccess, onCancel }: AddPaymentMethodFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get card element
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element not found')
      }

      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement
      })

      if (stripeError) {
        throw new Error(stripeError.message)
      }

      if (!paymentMethod) {
        throw new Error('Failed to create payment method')
      }

      // Attach payment method to customer
      const response = await fetch('/api/stripe/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to save payment method')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Card</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Details
          </label>
          <div className="border border-gray-300 rounded-lg p-3">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#1f2937',
                    '::placeholder': {
                      color: '#9ca3af'
                    }
                  },
                  invalid: {
                    color: '#ef4444'
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={!stripe || loading}
            className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Card'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>

      <p className="text-xs text-gray-500 mt-4">
        Your card information is securely stored by Stripe. Wells AI never sees your full card number.
      </p>
    </div>
  )
}
