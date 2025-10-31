/**
 * Consent Approval Card - Approve/reject pending actions inline
 */

'use client'

import { useState } from 'react'
import { ConsentAction } from '@/lib/consent'

interface ConsentApprovalCardProps {
  data: {
    actions: ConsentAction[]
  }
}

export default function ConsentApprovalCard({ data }: ConsentApprovalCardProps) {
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const handleDecision = async (actionId: string, decision: 'approve' | 'reject') => {
    setProcessing({ ...processing, [actionId]: true })

    try {
      const response = await fetch('/api/consent/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          decision,
          decidedBy: 'user'
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResults({
          ...results,
          [actionId]: {
            success: true,
            message: decision === 'approve' ? '✅ Approved' : '❌ Rejected'
          }
        })
      } else {
        setResults({
          ...results,
          [actionId]: {
            success: false,
            message: `Error: ${data.error}`
          }
        })
      }
    } catch (error: any) {
      setResults({
        ...results,
        [actionId]: {
          success: false,
          message: `Error: ${error.message}`
        }
      })
    } finally {
      setProcessing({ ...processing, [actionId]: false })
    }
  }

  if (data.actions.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
        <p className="text-gray-500 text-center py-4">No pending approvals</p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      <h3 className="font-semibold text-lg mb-3">✋ Pending Approvals</h3>

      <div className="space-y-3">
        {data.actions.map((action) => {
          const result = results[action.actionId]
          const isProcessing = processing[action.actionId]

          return (
            <div
              key={action.actionId}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-gray-900">{action.title}</h4>
                  <p className="text-sm text-gray-600">{action.description}</p>
                  {action.recipient && (
                    <p className="text-sm text-gray-500 mt-1">
                      To: {action.recipient}
                    </p>
                  )}
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  {action.actionType}
                </span>
              </div>

              {action.messagePreview && (
                <div className="mt-2 p-2 bg-white rounded text-sm text-gray-700 italic border-l-4 border-blue-300">
                  {action.messagePreview}
                </div>
              )}

              {!result && !isProcessing && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleDecision(action.actionId, 'approve')}
                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition text-sm font-medium"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => handleDecision(action.actionId, 'reject')}
                    className="flex-1 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 transition text-sm font-medium"
                  >
                    ❌ Reject
                  </button>
                </div>
              )}

              {isProcessing && (
                <div className="mt-3 text-center text-sm text-gray-500">
                  Processing...
                </div>
              )}

              {result && (
                <div className={`mt-3 p-2 rounded text-sm ${result.success ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}>
                  {result.message}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
