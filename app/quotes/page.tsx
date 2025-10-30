'use client'

import { useState, useEffect } from 'react'

interface Quote {
  id: string
  supplierId: string
  supplierName: string
  rfqId: string
  price: number
  deliveryTime: string
  terms: string
  notes?: string
  submittedAt: string
  status: 'pending' | 'accepted' | 'rejected'
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')

  useEffect(() => {
    // Mock data for now - replace with actual API call
    const mockQuotes: Quote[] = [
      {
        id: '1',
        supplierId: 'sup_001',
        supplierName: 'Acme Steel Co.',
        rfqId: 'rfq_001',
        price: 45000,
        deliveryTime: '2 weeks',
        terms: 'Net 30',
        notes: 'Can expedite for additional 5%',
        submittedAt: new Date().toISOString(),
        status: 'pending'
      },
      {
        id: '2',
        supplierId: 'sup_002',
        supplierName: 'Global Materials Inc.',
        rfqId: 'rfq_001',
        price: 42500,
        deliveryTime: '3 weeks',
        terms: 'Net 45',
        notes: 'Bulk discount available',
        submittedAt: new Date().toISOString(),
        status: 'pending'
      },
      {
        id: '3',
        supplierId: 'sup_003',
        supplierName: 'Precision Parts Ltd.',
        rfqId: 'rfq_002',
        price: 38000,
        deliveryTime: '10 days',
        terms: 'Net 30',
        submittedAt: new Date().toISOString(),
        status: 'accepted'
      }
    ]

    setQuotes(mockQuotes)
    setLoading(false)
  }, [])

  const filteredQuotes = quotes.filter(q =>
    filter === 'all' ? true : q.status === filter
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quotes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Supplier Quotes</h1>
          <p className="mt-2 text-gray-600">Review and compare quotes from suppliers</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {(['all', 'pending', 'accepted', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm capitalize
                  ${filter === status
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {status}
                <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100">
                  {status === 'all' ? quotes.length : quotes.filter(q => q.status === status).length}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Quotes List */}
        {filteredQuotes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No quotes</h3>
            <p className="mt-1 text-sm text-gray-500">No quotes found with status: {filter}</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RFQ ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Terms
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{quote.supplierName}</div>
                      <div className="text-sm text-gray-500">{quote.supplierId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {quote.rfqId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        ${quote.price.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Wells fee: ${Math.round(quote.price * 0.0033).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {quote.deliveryTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {quote.terms}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`
                        px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${quote.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${quote.status === 'accepted' ? 'bg-green-100 text-green-800' : ''}
                        ${quote.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                      `}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {quote.status === 'pending' && (
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-900">
                            View
                          </button>
                          <button className="text-green-600 hover:text-green-900">
                            Accept
                          </button>
                          <button className="text-orange-600 hover:text-orange-900">
                            Counter
                          </button>
                        </div>
                      )}
                      {quote.status === 'accepted' && (
                        <button className="text-blue-600 hover:text-blue-900">
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Quotes</dt>
                    <dd className="text-lg font-semibold text-gray-900">{quotes.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Review</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {quotes.filter(q => q.status === 'pending').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Accepted</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {quotes.filter(q => q.status === 'accepted').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
