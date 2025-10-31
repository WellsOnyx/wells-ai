/**
 * Pricing Notification Component
 *
 * Shows users when processing costs change and requires acceptance
 * if fees increase.
 */

'use client'

import { useState } from 'react'
import { PricingChange } from '@/lib/pricing/dynamic-engine'

export interface PricingNotificationProps {
  userId: string
  changes: PricingChange[]
  oldTotalFee: number
  newTotalFee: number
  impactDescription: string
  requiresAcceptance: boolean
  onAccept?: () => void
  onDecline?: () => void
  onSwitchPaymentMethod?: () => void
}

export default function PricingNotification({
  userId,
  changes,
  oldTotalFee,
  newTotalFee,
  impactDescription,
  requiresAcceptance,
  onAccept,
  onDecline,
  onSwitchPaymentMethod,
}: PricingNotificationProps) {
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)

  const impactAmount = newTotalFee - oldTotalFee
  const isIncrease = impactAmount > 0
  const impactPercent = (Math.abs(impactAmount) / oldTotalFee) * 100

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      if (onAccept) {
        await onAccept()
      }
    } finally {
      setIsAccepting(false)
    }
  }

  const handleDecline = async () => {
    setIsDeclining(true)
    try {
      if (onDecline) {
        await onDecline()
      }
    } finally {
      setIsDeclining(false)
    }
  }

  return (
    <div
      className={`rounded-lg border-2 p-6 ${
        isIncrease
          ? 'border-yellow-400 bg-yellow-50'
          : 'border-green-400 bg-green-50'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="text-3xl">
          {isIncrease ? '⚠️' : '✅'}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">
            {isIncrease ? 'Pricing Update' : 'Pricing Improvement'}
          </h3>
          <p className="mt-1 text-sm text-gray-700">{impactDescription}</p>
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 space-y-3">
        {/* Fee comparison */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Previous Rate:</div>
            <div className="text-lg font-semibold text-gray-900">
              ${oldTotalFee.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-gray-600">New Rate:</div>
            <div className={`text-lg font-semibold ${isIncrease ? 'text-yellow-700' : 'text-green-700'}`}>
              ${newTotalFee.toFixed(2)}
              {isIncrease && (
                <span className="ml-2 text-sm">
                  (+${impactAmount.toFixed(2)})
                </span>
              )}
              {!isIncrease && (
                <span className="ml-2 text-sm">
                  (-${Math.abs(impactAmount).toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Change breakdown */}
        <div className="rounded-md bg-white p-3">
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
            What Changed:
          </div>
          {changes.map((change, idx) => (
            <div key={idx} className="text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-700">
                  {change.field === 'processing_cost' ? 'Processing Cost' : 'Wells AI Margin'}
                </span>
                <span className="font-mono">
                  ${change.oldValue.toFixed(2)} → ${change.newValue.toFixed(2)}
                  <span className={`ml-2 text-xs ${change.changePercent > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    ({change.changePercent > 0 ? '+' : ''}{change.changePercent.toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {change.reason}
              </div>
            </div>
          ))}
        </div>

        {/* Wells AI margin unchanged message (if only processing cost changed) */}
        {changes.length === 1 && changes[0].field === 'processing_cost' && (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            <strong>Wells AI margin unchanged.</strong>
            <br />
            We're passing through external cost changes, not raising our prices.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-2">
        {requiresAcceptance ? (
          <>
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isAccepting ? 'Accepting...' : 'Accept New Pricing'}
            </button>

            {onSwitchPaymentMethod && (
              <button
                onClick={onSwitchPaymentMethod}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                Switch to ACH (Lower Fees)
              </button>
            )}

            <button
              onClick={handleDecline}
              disabled={isDeclining}
              className="w-full px-4 py-2 text-gray-600 hover:text-gray-900 text-sm transition"
            >
              {isDeclining ? 'Declining...' : 'Decline (Disable This Payment Method)'}
            </button>

            <div className="mt-4 text-xs text-gray-500 text-center">
              You must accept to continue using this payment method.
              <br />
              Or switch to ACH for lower, more stable fees.
            </div>
          </>
        ) : (
          <div className="rounded-md bg-green-100 border border-green-300 p-3 text-sm text-green-800 text-center">
            ✓ This change is automatic - no action needed.
            <br />
            Effective immediately for all new transactions.
          </div>
        )}
      </div>
    </div>
  )
}
