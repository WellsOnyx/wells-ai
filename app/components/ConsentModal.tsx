'use client'

import { useState } from 'react'

export interface ConsentAction {
  actionId: string
  actionType: 'sms' | 'email' | 'partner_outreach' | 'rfq_notification' | 'payment'
  title: string
  description: string
  recipient?: string
  messagePreview?: string
  metadata?: Record<string, any>
}

interface ConsentModalProps {
  action: ConsentAction
  onDecision: (actionId: string, decision: 'approve' | 'reject') => Promise<void>
  onClose: () => void
}

export default function ConsentModal({ action, onDecision, onClose }: ConsentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDecision = async (decision: 'approve' | 'reject') => {
    setIsProcessing(true)
    setError(null)

    try {
      await onDecision(action.actionId, decision)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process decision')
      setIsProcessing(false)
    }
  }

  const getActionIcon = () => {
    switch (action.actionType) {
      case 'sms':
        return '💬'
      case 'email':
        return '📧'
      case 'partner_outreach':
        return '🤝'
      case 'rfq_notification':
        return '📋'
      case 'payment':
        return '💰'
      default:
        return '🔔'
    }
  }

  const getActionColor = () => {
    switch (action.actionType) {
      case 'sms':
        return 'blue'
      case 'email':
        return 'purple'
      case 'partner_outreach':
        return 'green'
      case 'rfq_notification':
        return 'yellow'
      case 'payment':
        return 'red'
      default:
        return 'gray'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-${getActionColor()}-50 border-b border-${getActionColor()}-200 p-6`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <span className="text-4xl">{getActionIcon()}</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Action Requires Approval
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Wells AI wants to perform this action on your behalf
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              disabled={isProcessing}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Action Summary */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {action.title}
            </h3>
            <p className="text-gray-700">
              {action.description}
            </p>
          </div>

          {/* Recipient */}
          {action.recipient && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-600 mb-1">Recipient:</p>
              <p className="text-gray-900 font-mono">{action.recipient}</p>
            </div>
          )}

          {/* Message Preview */}
          {action.messagePreview && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-600 mb-2">Message Preview:</p>
              <div className="bg-white border border-gray-200 rounded p-3">
                <p className="text-gray-900 whitespace-pre-wrap font-mono text-sm">
                  {action.messagePreview}
                </p>
              </div>
            </div>
          )}

          {/* Details Toggle */}
          {action.metadata && Object.keys(action.metadata).length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                {showDetails ? '▼ Hide Details' : '▶ View Details'}
              </button>

              {showDetails && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4">
                  <pre className="text-xs text-gray-700 overflow-x-auto">
                    {JSON.stringify(action.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between space-x-3 border-t">
          <button
            onClick={() => handleDecision('reject')}
            disabled={isProcessing}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reject
          </button>

          <button
            onClick={() => handleDecision('approve')}
            disabled={isProcessing}
            className="px-8 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <span>✓ Approve &amp; Send</span>
            )}
          </button>
        </div>

        {/* Audit Notice */}
        <div className="bg-yellow-50 border-t border-yellow-200 px-6 py-3">
          <p className="text-xs text-yellow-800">
            🔒 All decisions are logged with timestamp and user identity for compliance and audit purposes.
          </p>
        </div>
      </div>
    </div>
  )
}
