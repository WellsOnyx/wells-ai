'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Order {
  id: string
  quoteId: string
  buyerId: string
  buyerEmail: string
  supplierId: string
  supplierName: string
  amount: number
  status: string
  createdAt: string
  quote: {
    price: number
    deliveryTime: string
    terms: string
    notes?: string
  } | null
  rfq: {
    id: string
    requirements: string
    categories: string[]
    quantity?: number
  } | null
}

export default function OrderTracking() {
  const params = useParams()
  const orderId = params.orderId as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  const loadOrder = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/create?id=${orderId}`)
      const data = await res.json()

      if (data.order) {
        setOrder(data.order)
      } else {
        setError('Order not found')
      }
    } catch (err: any) {
      console.error('Failed to load order:', err)
      setError('Failed to load order details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#183b6d]">Loading order details...</div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error || 'Order not found'}</div>
          <Link href="/" className="text-[#183b6d] hover:underline">
            Return to Home →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-serif text-[#183b6d]">Order Confirmation</h1>
          <p className="text-sm text-[#575757] mt-1">
            Your order has been successfully placed
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-sm p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-medium text-green-900 mb-1">Order Placed Successfully</h2>
              <p className="text-sm text-green-700">
                Your order has been created and the supplier has been notified. You'll receive updates via email.
              </p>
              <div className="mt-3 text-sm text-green-800">
                <strong>Order ID:</strong> {order.id}
              </div>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6 mb-6">
          <h3 className="text-lg font-medium text-[#183b6d] mb-4">Order Details</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#9ea1a7] mb-1">Supplier</div>
                <div className="text-sm text-[#183b6d] font-medium">{order.supplierName}</div>
              </div>
              <div>
                <div className="text-xs text-[#9ea1a7] mb-1">Total Amount</div>
                <div className="text-sm text-[#183b6d] font-medium">${order.amount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-[#9ea1a7] mb-1">Status</div>
                <div className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#9ea1a7] mb-1">Order Date</div>
                <div className="text-sm text-[#183b6d]">
                  {new Date(order.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quote Details */}
        {order.quote && (
          <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6 mb-6">
            <h3 className="text-lg font-medium text-[#183b6d] mb-4">Quote Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-[#575757]">Price:</span>
                <span className="text-sm text-[#183b6d] font-medium">${order.quote.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#575757]">Delivery Time:</span>
                <span className="text-sm text-[#183b6d]">{order.quote.deliveryTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#575757]">Payment Terms:</span>
                <span className="text-sm text-[#183b6d]">{order.quote.terms}</span>
              </div>
              {order.quote.notes && (
                <div>
                  <div className="text-sm text-[#575757] mb-1">Notes:</div>
                  <div className="text-sm text-[#183b6d]">{order.quote.notes}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Request Details */}
        {order.rfq && (
          <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6 mb-8">
            <h3 className="text-lg font-medium text-[#183b6d] mb-4">Original Request</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-[#9ea1a7] mb-1">Requirements</div>
                <div className="text-sm text-[#183b6d] whitespace-pre-wrap">{order.rfq.requirements}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#9ea1a7] mb-1">Categories</div>
                  <div className="text-sm text-[#183b6d]">{order.rfq.categories.join(', ')}</div>
                </div>
                {order.rfq.quantity && (
                  <div>
                    <div className="text-xs text-[#9ea1a7] mb-1">Quantity</div>
                    <div className="text-sm text-[#183b6d]">{order.rfq.quantity} units</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-6 mb-8">
          <h3 className="text-lg font-medium text-blue-900 mb-3">What Happens Next?</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>The supplier will receive your order notification</li>
            <li>You'll receive email updates on order status</li>
            <li>The supplier will begin processing your order</li>
            <li>Track your order status on this page</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            href="/"
            className="flex-1 px-6 py-3 text-center border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all"
          >
            Return to Home
          </Link>
          <button
            onClick={() => window.print()}
            className="flex-1 px-6 py-3 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545] transition-all"
          >
            Print Order Confirmation
          </button>
        </div>
      </div>
    </div>
  )
}
