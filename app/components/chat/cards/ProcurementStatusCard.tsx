'use client'

import { useEffect, useState } from 'react'

interface ProcurementStatusProps {
  data: {
    requestId: string
    category: string
    description: string
    onQuotesUpdate?: (quotes: any[]) => void
  }
}

export default function ProcurementStatusCard({ data }: ProcurementStatusProps) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let pollInterval: NodeJS.Timeout

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/procurement/status?requestId=${data.requestId}`)
        const result = await response.json()

        if (result.success) {
          setStatus(result)
          setLoading(false)

          // Notify parent of quote updates
          if (result.quotes && result.quotes.length > 0 && data.onQuotesUpdate) {
            data.onQuotesUpdate(result.quotes)
          }

          // Stop polling if no longer active
          if (!result.isActive) {
            clearInterval(pollInterval)
          }
        } else {
          setError(result.error || 'Failed to fetch status')
          setLoading(false)
        }
      } catch (err: any) {
        console.error('[PROCUREMENT STATUS] Polling error:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    // Initial fetch
    fetchStatus()

    // Poll every 5 seconds for updates
    pollInterval = setInterval(fetchStatus, 5000)

    return () => clearInterval(pollInterval)
  }, [data.requestId, data.onQuotesUpdate])

  if (loading) {
    return (
      <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-[#183b6d] border-t-transparent rounded-full"></div>
          <p className="text-[#183b6d] text-sm font-medium">
            Reaching out to suppliers...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-sm p-6">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[#183b6d] font-semibold text-base">
            Sourcing {status.category}
          </h3>
          <p className="text-[#9ea1a7] text-sm mt-1">
            {status.description}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          status.status === 'Receiving Responses'
            ? 'bg-green-100 text-green-700'
            : status.status === 'Awaiting Responses'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-700'
        }`}>
          {status.status}
        </div>
      </div>

      {/* Progress */}
      <div className="border-t border-[#9ea1a7]/20 pt-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-[#9ea1a7]">Supplier Responses</span>
          <span className="text-[#183b6d] font-medium">
            {status.responsesReceived} of {status.suppliersContacted}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-[#183b6d] h-2 rounded-full transition-all duration-500"
            style={{
              width: `${(status.responsesReceived / status.suppliersContacted) * 100}%`
            }}
          />
        </div>
      </div>

      {/* Quotes */}
      {status.quotes && status.quotes.length > 0 && (
        <div className="border-t border-[#9ea1a7]/20 pt-4 space-y-3">
          <h4 className="text-[#183b6d] font-medium text-sm">Quotes Received</h4>
          {status.quotes.map((quote: any, idx: number) => (
            <div
              key={idx}
              className="bg-gray-50 rounded-sm p-4 border border-[#9ea1a7]/10"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[#183b6d] font-medium text-sm">
                    {quote.supplier}
                  </p>
                  {quote.leadTime && (
                    <p className="text-[#9ea1a7] text-xs mt-1">
                      Lead time: {quote.leadTime}
                    </p>
                  )}
                </div>
                {quote.price && (
                  <div className="text-right">
                    <p className="text-[#183b6d] font-semibold text-base">
                      ${quote.price}/unit
                    </p>
                    <p className="text-[#9ea1a7] text-xs mt-1">
                      {new Date(quote.receivedAt).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Waiting message */}
      {status.isActive && status.responsesReceived === 0 && (
        <div className="border-t border-[#9ea1a7]/20 pt-4">
          <p className="text-[#9ea1a7] text-sm text-center">
            Waiting for suppliers to respond...
          </p>
        </div>
      )}

      {/* Latest update from backend */}
      {status.latestUpdate && (
        <div className="border-t border-[#9ea1a7]/20 pt-4">
          <p className="text-[#183b6d] text-sm italic">
            "{status.latestUpdate}"
          </p>
        </div>
      )}
    </div>
  )
}
