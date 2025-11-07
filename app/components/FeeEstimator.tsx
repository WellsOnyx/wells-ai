'use client'

/**
 * Fee Estimator Component
 *
 * Interactive component that shows fee breakdown and savings opportunities.
 * Encourages users to create GRAIN wallets for in-network pricing.
 */

import { useState } from 'react'
import { DealType, PaymentRail } from '@/lib/pricing/types'

interface FeeBreakdownDisplay {
  transactionAmount: number
  dealType: DealType
  rail: PaymentRail
  wellsFeeGross: number
  wellsFeePercentage: number
  titheAmount: number
  tithePurpose: string
  wellsFeeNet: number
  railCost: number
  totalCharge: number
  effectiveRate: number
  lineItems: {
    description: string
    amount: number
    percentage?: number
  }[]
}

interface SavingsDisplay {
  currentDealType: DealType
  currentFee: number
  inNetworkFee: number
  savingsAmount: number
  savingsPercentage: number
  requirements: string[]
  callToAction: string
}

export default function FeeEstimator() {
  const [amount, setAmount] = useState<string>('100000') // $1,000 default
  const [dealType, setDealType] = useState<DealType>(DealType.ORIGINATED)
  const [rail, setRail] = useState<PaymentRail>(PaymentRail.ACH)
  const [loading, setLoading] = useState(false)
  const [breakdown, setBreakdown] = useState<FeeBreakdownDisplay | null>(null)
  const [savings, setSavings] = useState<SavingsDisplay | null>(null)
  const [error, setError] = useState<string | null>(null)

  const estimateFees = async () => {
    setLoading(true)
    setError(null)

    try {
      const amountCents = Math.round(parseFloat(amount) * 100)

      if (isNaN(amountCents) || amountCents <= 0) {
        setError('Please enter a valid amount')
        return
      }

      const response = await fetch('/api/pricing/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountCents,
          dealType,
          rail
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to estimate fees')
        return
      }

      setBreakdown(data.breakdown)
      setSavings(data.savings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Fee Estimator</h1>
        <p className="text-gray-600">
          See exactly what you'll pay. No hidden fees.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Amount (USD)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="1000"
            min="0"
            step="0.01"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deal Type
          </label>
          <select
            value={dealType}
            onChange={(e) => setDealType(e.target.value as DealType)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={DealType.IN_NETWORK}>
              In-Network (0.33%) - Both parties have wallets
            </option>
            <option value={DealType.SOURCED}>
              Sourced (3.3%) - Platform matched
            </option>
            <option value={DealType.ORIGINATED}>
              Originated (7%) - Wells closed deal
            </option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Rail
          </label>
          <select
            value={rail}
            onChange={(e) => setRail(e.target.value as PaymentRail)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={PaymentRail.GRAIN}>GRAIN Token (Free)</option>
            <option value={PaymentRail.USDC}>USDC (0.1%)</option>
            <option value={PaymentRail.ACH}>ACH (0.8%, max $5)</option>
            <option value={PaymentRail.WIRE}>Wire ($25 flat)</option>
            <option value={PaymentRail.CARD}>Card (2.9% + $0.30)</option>
          </select>
        </div>

        <button
          onClick={estimateFees}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Calculating...' : 'Estimate Fees'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Fee Breakdown */}
      {breakdown && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <h2 className="text-xl font-bold">Fee Breakdown</h2>

          <div className="space-y-2">
            <div className="flex justify-between text-lg">
              <span className="font-medium">Transaction Amount:</span>
              <span className="font-bold">
                {formatCurrency(breakdown.transactionAmount)}
              </span>
            </div>

            <div className="border-t pt-4 space-y-2">
              {breakdown.lineItems.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{item.description}</span>
                  <span>
                    {formatCurrency(item.amount)}
                    {item.percentage && (
                      <span className="text-gray-500 ml-2">
                        ({item.percentage.toFixed(2)}%)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 flex justify-between text-xl font-bold">
              <span>Total Fee:</span>
              <span className="text-blue-600">
                {formatCurrency(breakdown.totalCharge)}
              </span>
            </div>

            <div className="text-sm text-gray-600">
              Effective rate: {breakdown.effectiveRate.toFixed(2)}%
            </div>
          </div>

          {/* Tithe Transparency */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <div className="text-blue-600 text-xl">💙</div>
              <div>
                <div className="font-medium text-blue-900">
                  {formatCurrency(breakdown.titheAmount)} goes to {breakdown.tithePurpose}
                </div>
                <div className="text-sm text-blue-700">
                  10% of all Wells fees support our mission to serve others.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Savings Opportunity */}
      {savings && savings.savingsAmount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <h2 className="text-xl font-bold text-green-900">
              Save {formatCurrency(savings.savingsAmount)} on this transaction!
            </h2>
          </div>

          <div className="text-green-800">
            <p className="font-medium mb-2">{savings.callToAction}</p>
            <p className="text-sm">
              You'd pay {formatCurrency(savings.inNetworkFee)} instead of{' '}
              {formatCurrency(savings.currentFee)} (
              {savings.savingsPercentage.toFixed(0)}% savings)
            </p>
          </div>

          {savings.requirements.length > 0 && (
            <div>
              <h3 className="font-medium text-green-900 mb-2">
                To unlock in-network pricing:
              </h3>
              <ul className="space-y-1 text-sm text-green-800">
                {savings.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span>✓</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>

              <button className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium">
                Create GRAIN Wallet
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pricing Tiers Comparison */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-bold mb-4">Pricing Tiers</h2>

        <div className="grid md:grid-cols-3 gap-4">
          {/* In-Network */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="text-2xl font-bold text-green-600">0.33%</div>
            <div className="font-medium">In-Network</div>
            <div className="text-sm text-gray-600">
              Both parties have GRAIN wallets + verified
            </div>
            <ul className="text-xs space-y-1 text-gray-600">
              <li>✓ Lowest fees</li>
              <li>✓ 1:1 credit line</li>
              <li>✓ Instant settlement</li>
            </ul>
          </div>

          {/* Sourced */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="text-2xl font-bold text-blue-600">3.3%</div>
            <div className="font-medium">Sourced</div>
            <div className="text-sm text-gray-600">
              Wells platform matched the deal
            </div>
            <ul className="text-xs space-y-1 text-gray-600">
              <li>✓ AI matching</li>
              <li>✓ GTM automation</li>
              <li>✓ Lead qualification</li>
            </ul>
          </div>

          {/* Originated */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="text-2xl font-bold text-purple-600">7%</div>
            <div className="font-medium">Originated</div>
            <div className="text-sm text-gray-600">
              Wells negotiated and closed
            </div>
            <ul className="text-xs space-y-1 text-gray-600">
              <li>✓ Full origination</li>
              <li>✓ Negotiation support</li>
              <li>✓ Relationship building</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
