/**
 * Supplier Match Card - Show matched suppliers with quotes inline
 * Displays supplier matches and allows direct interaction
 */

'use client'

import { useState } from 'react'

interface Supplier {
  id: string
  name: string
  email?: string
  phone?: string
  capabilities?: string[]
  responseTime?: string
  score: number
  pricing?: {
    totalAmount: number
    currency: string
    breakdown?: Array<{
      description: string
      amount: number
    }>
  }
  timeline?: {
    deliveryDate: string
    leadTime: number
  }
  terms?: {
    paymentTerms: string
    warranty?: string
    supportIncluded: boolean
  }
}

interface SupplierMatchCardProps {
  data?: {
    suppliers?: Supplier[]
    rfqId?: string
    category?: string
    description?: string
    onSelect?: (supplier: Supplier) => void
    matches?: Supplier[] // Backward compatibility
    [key: string]: any // Allow any additional props
  }
}

export default function SupplierMatchCard({ data = {} }: SupplierMatchCardProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)

  const suppliers = data?.suppliers || data?.matches || []

  if (suppliers.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 shadow-sm">
        <div className="flex items-center">
          <span className="text-2xl mr-2">🔍</span>
          <div>
            <h3 className="font-semibold text-lg">Finding Suppliers...</h3>
            <p className="text-sm text-gray-600 mt-1">
              I'm searching for suppliers that match your requirements.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const handleSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier.id)
    if (data?.onSelect) {
      data.onSelect(supplier)
    }
  }

  const toggleExpand = (supplierId: string) => {
    setExpandedSupplier(expandedSupplier === supplierId ? null : supplierId)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-md max-w-3xl">
      <div className="flex items-center mb-4">
        <span className="text-2xl mr-2">🎯</span>
        <div>
          <h3 className="font-semibold text-lg">Supplier Matches</h3>
          {data?.category && (
            <p className="text-sm text-gray-600">
              Found {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} for {data.category}
            </p>
          )}
        </div>
      </div>

      {data?.description && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-800">
          <strong>Your Request:</strong> {data.description}
        </div>
      )}

      <div className="space-y-4">
        {suppliers.map((supplier) => {
          const isExpanded = expandedSupplier === supplier.id
          const isSelected = selectedSupplier === supplier.id

          return (
            <div
              key={supplier.id}
              className={`border rounded-lg p-4 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-lg">{supplier.name}</h4>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                      {supplier.score}% match
                    </span>
                  </div>

                  {supplier.responseTime && (
                    <p className="text-sm text-gray-600 mt-1">
                      ⏱️ {supplier.responseTime} response time
                    </p>
                  )}

                  {supplier.capabilities && supplier.capabilities.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {supplier.capabilities.map((cap, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pricing */}
                {supplier.pricing && (
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      ${supplier.pricing.totalAmount.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">{supplier.pricing.currency}</div>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              {(supplier.email || supplier.phone) && !isExpanded && (
                <div className="mt-3 flex gap-4 text-sm text-gray-600">
                  {supplier.email && (
                    <span>📧 {supplier.email}</span>
                  )}
                  {supplier.phone && (
                    <span>📞 {supplier.phone}</span>
                  )}
                </div>
              )}

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  {/* Contact Details */}
                  {(supplier.email || supplier.phone) && (
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Contact</h5>
                      <div className="space-y-1 text-sm text-gray-600">
                        {supplier.email && <div>📧 {supplier.email}</div>}
                        {supplier.phone && <div>📞 {supplier.phone}</div>}
                      </div>
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  {supplier.pricing?.breakdown && (
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Pricing Breakdown</h5>
                      <div className="space-y-1 text-sm">
                        {supplier.pricing.breakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="text-gray-600">{item.description}</span>
                            <span className="font-medium">${item.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  {supplier.timeline && (
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Timeline</h5>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>📅 Delivery: {new Date(supplier.timeline.deliveryDate).toLocaleDateString()}</div>
                        <div>⏳ Lead Time: {supplier.timeline.leadTime} days</div>
                      </div>
                    </div>
                  )}

                  {/* Terms */}
                  {supplier.terms && (
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Terms</h5>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>💰 Payment: {supplier.terms.paymentTerms}</div>
                        {supplier.terms.warranty && <div>🛡️ Warranty: {supplier.terms.warranty}</div>}
                        <div>
                          {supplier.terms.supportIncluded ? '✅' : '❌'} Support Included
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleSelect(supplier)}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isSelected ? '✓ Selected' : 'Select Supplier'}
                </button>
                <button
                  onClick={() => toggleExpand(supplier.id)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
                >
                  {isExpanded ? 'Less Details' : 'More Details'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {selectedSupplier && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-green-600 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="text-sm text-green-800">
              <strong>Supplier Selected!</strong>
              <p className="mt-1">I'll prepare a purchase order with {suppliers.find(s => s.id === selectedSupplier)?.name}.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        💡 Tip: Review all suppliers before selecting. You can request additional information or negotiate terms.
      </div>
    </div>
  )
}
