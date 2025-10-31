/**
 * Payment Method Selector Component
 *
 * Shows cost comparison between payment methods and encourages
 * ACH for large transactions (saves thousands on $100K+ orders)
 */

'use client'

import { useState } from 'react'

export type PaymentMethod = 'stripe' | 'ach' | 'wire' | 'grain'

interface PaymentMethodOption {
  method: PaymentMethod
  name: string
  description: string
  icon: string
  calculateFee: (amount: number) => number
  settlementTime: string
  available: boolean
}

interface PaymentMethodSelectorProps {
  amount: number // in cents
  selectedMethod: PaymentMethod
  onMethodChange: (method: PaymentMethod) => void
  hasACHConnected?: boolean
  onConnectACH?: () => void
}

export default function PaymentMethodSelector({
  amount,
  selectedMethod,
  onMethodChange,
  hasACHConnected = false,
  onConnectACH,
}: PaymentMethodSelectorProps) {
  const amountInDollars = amount / 100

  const paymentMethods: PaymentMethodOption[] = [
    {
      method: 'stripe',
      name: 'Credit/Debit Card',
      description: 'Instant confirmation, highest fees',
      icon: '💳',
      calculateFee: (amt) => amt * 0.029 + 0.30,
      settlementTime: 'Instant',
      available: true,
    },
    {
      method: 'ach',
      name: 'Bank Account (ACH)',
      description: 'Lowest cost, 1-3 day settlement',
      icon: '🏦',
      calculateFee: () => 0.25,
      settlementTime: '1-3 business days',
      available: hasACHConnected,
    },
    {
      method: 'wire',
      name: 'Wire Transfer',
      description: 'Same day, flat $15 fee',
      icon: '🔁',
      calculateFee: () => 15.00,
      settlementTime: 'Same business day',
      available: false, // Coming soon
    },
    {
      method: 'grain',
      name: 'Grain (Coming Soon)',
      description: '0% fees, instant settlement',
      icon: '⚡',
      calculateFee: () => 0.01,
      settlementTime: 'Instant',
      available: false,
    },
  ]

  // Calculate savings for each method vs card
  const cardFee = amountInDollars * 0.029 + 0.30
  const savings = paymentMethods.map((method) => {
    const fee = method.calculateFee(amountInDollars)
    return {
      method: method.method,
      fee,
      savings: cardFee - fee,
      savingsPercent: ((cardFee - fee) / cardFee) * 100,
    }
  })

  // Find biggest savings
  const bestSavings = savings.reduce((best, current) =>
    current.savings > best.savings ? current : best
  )

  return (
    <div className="space-y-4">
      {/* Savings Alert (if ACH saves $1000+) */}
      {hasACHConnected && amountInDollars >= 50000 && selectedMethod === 'stripe' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💰</div>
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 mb-1">
                Save ${savings.find((s) => s.method === 'ach')?.savings.toFixed(2)} with ACH
              </h4>
              <p className="text-sm text-green-700">
                For large transactions like this, ACH is {savings.find((s) => s.method === 'ach')?.savingsPercent.toFixed(0)}% cheaper than credit cards.
                Settlement takes 1-3 days instead of instant.
              </p>
              <button
                onClick={() => onMethodChange('ach')}
                className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
              >
                Switch to ACH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Options */}
      <div className="space-y-3">
        {paymentMethods.map((method) => {
          const methodSavings = savings.find((s) => s.method === method.method)
          const isSelected = selectedMethod === method.method
          const isDisabled = !method.available

          return (
            <button
              key={method.method}
              onClick={() => method.available && onMethodChange(method.method)}
              disabled={isDisabled}
              className={`w-full p-4 rounded-lg border-2 transition text-left ${
                isSelected
                  ? 'border-black bg-gray-50'
                  : isDisabled
                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-2xl">{method.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{method.name}</h3>
                      {isSelected && (
                        <span className="px-2 py-0.5 bg-black text-white text-xs rounded-full">
                          Selected
                        </span>
                      )}
                      {!method.available && method.method !== 'ach' && (
                        <span className="px-2 py-0.5 bg-gray-300 text-gray-700 text-xs rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{method.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <div>
                        <span className="text-gray-600">Fee: </span>
                        <span className="font-mono font-semibold text-gray-900">
                          ${methodSavings?.fee.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Settlement: </span>
                        <span className="font-medium text-gray-900">{method.settlementTime}</span>
                      </div>
                    </div>
                    {methodSavings && methodSavings.savings > 0 && (
                      <div className="mt-2 text-sm text-green-700 font-medium">
                        💰 Saves ${methodSavings.savings.toFixed(2)} vs card (
                        {methodSavings.savingsPercent.toFixed(0)}%)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Connect ACH Call-to-Action */}
      {!hasACHConnected && onConnectACH && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🏦</div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">Connect Bank Account for Lower Fees</h4>
              <p className="text-sm text-blue-700 mb-3">
                Save ${savings.find((s) => s.method === 'ach')?.savings.toFixed(2)} on this transaction by paying directly from your bank account.
              </p>
              <button
                onClick={onConnectACH}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Connect Bank Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cost Comparison Table */}
      <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Cost Comparison</h4>
        <div className="space-y-2">
          {savings
            .filter((s) => s.method !== 'grain')
            .sort((a, b) => a.fee - b.fee)
            .map((item, index) => {
              const method = paymentMethods.find((m) => m.method === item.method)!
              return (
                <div
                  key={item.method}
                  className={`flex items-center justify-between text-sm p-2 rounded ${
                    index === 0 ? 'bg-green-50' : ''
                  }`}
                >
                  <span className="text-gray-700">
                    {method.icon} {method.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">${item.fee.toFixed(2)}</span>
                    {item.savings > 0 && (
                      <span className="text-xs text-green-600">
                        -${item.savings.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
