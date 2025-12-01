'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface RFQ {
  id: string
  buyer_email: string
  requirements: string
  categories: string[]
  quantity?: number
  budget?: number
  deadline?: string
  status: string
  created_at: string
}

export default function SupplierQuoteSubmission() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const rfqId = params.rfqId as string
  const supplierId = searchParams.get('supplier') || searchParams.get('sid')

  const [rfq, setRfq] = useState<RFQ | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state
  const [price, setPrice] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [terms, setTerms] = useState('Net 30, FOB origin')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadRFQ()
  }, [rfqId])

  const loadRFQ = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/quotes/request?id=${rfqId}`)
      const data = await res.json()

      if (data.rfq) {
        setRfq(data.rfq)
      } else {
        setError('RFQ not found')
      }
    } catch (err: any) {
      console.error('Failed to load RFQ:', err)
      setError('Failed to load RFQ details')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supplierId) {
      setError('Supplier ID is required. Please use the link from your email.')
      return
    }

    if (!price || !deliveryTime) {
      setError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/quotes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqId,
          supplierId,
          price: parseFloat(price),
          deliveryTime,
          terms,
          notes
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setSuccess(true)
      } else {
        setError(data.error || 'Failed to submit quote')
      }
    } catch (err: any) {
      console.error('Submit error:', err)
      setError('Failed to submit quote. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#183b6d]">Loading RFQ details...</div>
      </div>
    )
  }

  if (error && !rfq) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Link href="/suppliers/join" className="text-[#183b6d] hover:underline">
            Return to Supplier Portal →
          </Link>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-serif text-[#183b6d] mb-2">Quote Submitted Successfully</h1>
          <p className="text-[#575757] mb-6">
            Your quote has been sent to the buyer. They will review it and contact you if selected.
          </p>
          <p className="text-sm text-[#9ea1a7]">
            You can close this window now.
          </p>
        </div>
      </div>
    )
  }

  if (!rfq) return null

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-serif text-[#183b6d]">Submit Your Quote</h1>
          <p className="text-sm text-[#575757] mt-1">
            Review the RFQ details and provide your best quote
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* RFQ Details */}
        <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6 mb-8">
          <h2 className="text-lg font-medium text-[#183b6d] mb-4">Request Details</h2>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-[#9ea1a7] mb-1">Requirements</div>
              <div className="text-sm text-[#183b6d] whitespace-pre-wrap">{rfq.requirements}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#9ea1a7] mb-1">Categories</div>
                <div className="text-sm text-[#183b6d]">{rfq.categories.join(', ')}</div>
              </div>
              {rfq.quantity && (
                <div>
                  <div className="text-xs text-[#9ea1a7] mb-1">Quantity</div>
                  <div className="text-sm text-[#183b6d]">{rfq.quantity.toLocaleString()} units</div>
                </div>
              )}
              {rfq.budget && (
                <div>
                  <div className="text-xs text-[#9ea1a7] mb-1">Budget</div>
                  <div className="text-sm text-[#183b6d]">${rfq.budget.toLocaleString()}</div>
                </div>
              )}
              {rfq.deadline && (
                <div>
                  <div className="text-xs text-[#9ea1a7] mb-1">Deadline</div>
                  <div className="text-sm text-[#183b6d]">
                    {new Date(rfq.deadline).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quote Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6">
            <h2 className="text-lg font-medium text-[#183b6d] mb-4">Your Quote</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Total Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#575757]">$</span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-[#9ea1a7]/30 rounded focus:outline-none focus:border-[#183b6d]"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-[#9ea1a7] mt-1">Your total price for this order</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Delivery Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded focus:outline-none focus:border-[#183b6d]"
                  placeholder="e.g., 2 weeks, 30 days, etc."
                />
                <p className="text-xs text-[#9ea1a7] mt-1">How long until you can deliver</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded focus:outline-none focus:border-[#183b6d]"
                  placeholder="e.g., Net 30, Net 60, etc."
                />
                <p className="text-xs text-[#9ea1a7] mt-1">Your payment terms (default: Net 30, FOB origin)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-[#9ea1a7]/30 rounded focus:outline-none focus:border-[#183b6d]"
                  placeholder="Any additional details about your quote, certifications, warranties, etc."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <Link
              href="/suppliers/join"
              className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Quote →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
