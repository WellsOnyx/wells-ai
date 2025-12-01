'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getPersonalityMessage, formatQuoteCount, formatFeeMessage } from '@/lib/personality'

interface RFQ {
  id: string
  company: string
  productName: string
  category: string
  specifications: string
  quantity?: string
  targetPrice?: string
  timeline?: string
  status: string
  quotesReceived: number
  createdDate: string
}

interface Quote {
  id: string
  supplierName: string
  price: number
  quantity: string
  leadTime: string
  terms: string
  status: string
  createdDate: string
}

export default function QuoteComparison() {
  const params = useParams()
  const router = useRouter()
  const rfqId = params.rfqId as string

  const [rfq, setRfq] = useState<RFQ | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [loadingMessage] = useState(getPersonalityMessage('playful', 'loadingStates'))
  const [processingMessage] = useState(getPersonalityMessage('playful', 'loadingStates'))

  useEffect(() => {
    loadQuotes()
  }, [rfqId])

  const loadQuotes = async () => {
    setLoading(true)
    try {
      // Fetch RFQ with all submitted quotes
      const res = await fetch(`/api/quotes/request?id=${rfqId}`)
      const data = await res.json()

      if (data.rfq) {
        // Map RFQ data to our RFQ interface
        const mappedRfq: RFQ = {
          id: data.rfq.id,
          company: data.rfq.buyer_email,
          productName: data.rfq.requirements.split('\n')[0].replace('Product: ', ''),
          category: data.rfq.categories[0] || 'Unknown',
          specifications: data.rfq.requirements,
          quantity: data.rfq.quantity ? `${data.rfq.quantity} units` : undefined,
          targetPrice: data.rfq.budget ? `$${data.rfq.budget.toLocaleString()}` : undefined,
          timeline: data.rfq.deadline ? new Date(data.rfq.deadline).toLocaleDateString() : undefined,
          status: data.rfq.status,
          quotesReceived: data.quotesReceived || 0,
          createdDate: new Date(data.rfq.created_at).toLocaleDateString()
        }
        setRfq(mappedRfq)

        // Map quotes data to our Quote interface
        if (data.quotes && data.quotes.length > 0) {
          const mappedQuotes: Quote[] = data.quotes.map((q: any) => ({
            id: q.id,
            supplierName: q.supplier?.name || 'Unknown Supplier',
            price: parseFloat(q.price),
            quantity: data.rfq.quantity ? `${data.rfq.quantity} units` : 'As specified',
            leadTime: q.delivery_time || 'Not specified',
            terms: q.terms || 'Net 30, FOB origin',
            status: q.status || 'pending',
            createdDate: new Date(q.submitted_at).toLocaleDateString()
          }))
          setQuotes(mappedQuotes)
        } else {
          setQuotes([])
        }
      }

    } catch (error) {
      console.error('Failed to load quotes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptQuote = async () => {
    if (!selectedQuote || !rfq) return

    setProcessing(true)
    try {
      const quote = quotes.find(q => q.id === selectedQuote)
      if (!quote) return

      // Create order via API
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqId: rfqId,
          quoteId: quote.id,
          buyerId: 'demo-buyer-id', // In production, get from auth
          buyerEmail: rfq.company
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Redirect to order confirmation
        router.push(`/orders/${data.order.id}`)
      } else {
        alert(data.error || 'Failed to create order')
      }

    } catch (error) {
      console.error('Failed to accept quote:', error)
      alert('Failed to create order. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#183b6d]">{loadingMessage}</div>
      </div>
    )
  }

  if (!rfq) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#9ea1a7]">RFQ not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/" className="text-[#9ea1a7] hover:text-[#183b6d] text-sm">
              ← Back to Wells AI
            </Link>
          </div>
          <h1 className="text-2xl font-serif text-[#183b6d]">Quote Comparison</h1>
          <p className="text-sm text-[#575757] mt-1">
            Review and compare quotes from suppliers for your request
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* RFQ Details */}
        <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6 mb-8">
          <h2 className="text-lg font-medium text-[#183b6d] mb-4">Your Request</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-[#9ea1a7] mb-1">Product</div>
              <div className="text-sm text-[#183b6d] font-medium">{rfq.productName}</div>
            </div>
            <div>
              <div className="text-xs text-[#9ea1a7] mb-1">Category</div>
              <div className="text-sm text-[#183b6d]">{rfq.category}</div>
            </div>
            {rfq.quantity && (
              <div>
                <div className="text-xs text-[#9ea1a7] mb-1">Quantity</div>
                <div className="text-sm text-[#183b6d]">{rfq.quantity}</div>
              </div>
            )}
            {rfq.targetPrice && (
              <div>
                <div className="text-xs text-[#9ea1a7] mb-1">Target Price</div>
                <div className="text-sm text-[#183b6d]">{rfq.targetPrice}</div>
              </div>
            )}
            {rfq.timeline && (
              <div>
                <div className="text-xs text-[#9ea1a7] mb-1">Timeline</div>
                <div className="text-sm text-[#183b6d]">{rfq.timeline}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-[#9ea1a7] mb-1">Specifications</div>
              <div className="text-sm text-[#183b6d]">{rfq.specifications}</div>
            </div>
          </div>
        </div>

        {/* Quotes */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif text-[#183b6d]">
              {quotes.length} {quotes.length === 1 ? 'Quote' : 'Quotes'} Received
            </h2>
            <div className="text-sm text-[#575757]">
              Select a quote to proceed to payment
            </div>
          </div>

          {quotes.length === 0 ? (
            <div className="text-center py-12 border border-[#9ea1a7]/20 rounded-sm bg-white">
              <div className="text-[#9ea1a7] mb-2">{getPersonalityMessage('playful', 'emptyStates')}</div>
              <div className="text-sm text-[#575757]">
                Suppliers have been notified. Quotes typically arrive within 24-48 hours.
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {quotes.map(quote => {
                const isSelected = selectedQuote === quote.id
                const dealValue = quote.price
                const wellsAIFee = dealValue * 0.0033 // 33bps
                const titheAmount = dealValue * 0.10 // 10%
                const totalCost = dealValue + wellsAIFee

                return (
                  <div
                    key={quote.id}
                    onClick={() => setSelectedQuote(quote.id)}
                    className={`border rounded-sm p-6 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#183b6d] bg-[#183b6d]/5'
                        : 'border-[#9ea1a7]/20 hover:border-[#183b6d]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-[#183b6d] bg-[#183b6d]' : 'border-[#9ea1a7]/30'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-[#183b6d]">
                            {quote.supplierName}
                          </h3>
                          <div className="text-xs text-[#9ea1a7] mt-1">
                            Quote submitted {new Date(quote.createdDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#183b6d]">
                          ${quote.price.toLocaleString()}
                        </div>
                        <div className="text-xs text-[#575757] mt-1">
                          + ${wellsAIFee.toFixed(0)} Wells AI fee (33bps)
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 text-sm">
                      <div>
                        <div className="text-[#9ea1a7] mb-1">Quantity</div>
                        <div className="text-[#183b6d] font-medium">{quote.quantity}</div>
                      </div>
                      <div>
                        <div className="text-[#9ea1a7] mb-1">Lead Time</div>
                        <div className="text-[#183b6d] font-medium">{quote.leadTime}</div>
                      </div>
                      <div>
                        <div className="text-[#9ea1a7] mb-1">Payment Terms</div>
                        <div className="text-[#183b6d] font-medium">{quote.terms}</div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-[#9ea1a7]/20">
                        <div className="bg-[#dba63f]/10 border border-[#dba63f]/30 rounded-sm p-4">
                          <div className="text-sm space-y-2">
                            <div className="flex justify-between">
                              <span className="text-[#575757]">Product Cost</span>
                              <span className="text-[#183b6d] font-medium">${dealValue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#575757]">Wells AI Fee (33bps)</span>
                              <span className="text-[#183b6d] font-medium">${wellsAIFee.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-[#dba63f]/30">
                              <span className="text-[#183b6d] font-medium">Total You Pay</span>
                              <span className="text-[#183b6d] font-bold text-lg">${totalCost.toLocaleString()}</span>
                            </div>
                            <div className="text-xs text-[#575757] mt-2 pt-2 border-t border-[#dba63f]/30">
                              Note: ${ titheAmount.toLocaleString()} (10% of gross) contributed to Adullam Sanctuaries
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {quotes.length > 0 && (
          <div className="flex gap-4 justify-end">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAcceptQuote}
              disabled={!selectedQuote || processing}
              className="px-8 py-3 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? processingMessage : 'Accept Quote & Proceed to Payment →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
