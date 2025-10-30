'use client'

/**
 * Wells GTM Savings Calculator
 * Interactive calculator showing cost comparison
 */

import { useState } from 'react'

export default function SavingsCalculator() {
  const [targetRevenue, setTargetRevenue] = useState(10000000) // $10M default
  const [teamSize, setTeamSize] = useState('medium') // small, medium, large

  // Traditional sales team costs by size
  const traditionalCosts = {
    small: {
      cost: 400000,
      breakdown: [
        { role: 'Sales Manager', cost: 150000 },
        { role: '1 AE', cost: 150000 },
        { role: '1 SDR', cost: 80000 },
        { role: 'Tools', cost: 20000 },
      ],
    },
    medium: {
      cost: 800000,
      breakdown: [
        { role: 'VP Sales', cost: 250000 },
        { role: '2 AEs', cost: 300000 },
        { role: '2 SDRs', cost: 200000 },
        { role: 'Tools', cost: 50000 },
      ],
    },
    large: {
      cost: 1500000,
      breakdown: [
        { role: 'VP Sales', cost: 300000 },
        { role: '4 AEs', cost: 600000 },
        { role: '4 SDRs', cost: 400000 },
        { role: 'Sales Ops', cost: 150000 },
        { role: 'Tools', cost: 50000 },
      ],
    },
  }

  const traditionalCost = traditionalCosts[teamSize as keyof typeof traditionalCosts].cost
  const breakdown = traditionalCosts[teamSize as keyof typeof traditionalCosts].breakdown
  const wellsFee = targetRevenue * 0.0033 // 33 basis points
  const savings = traditionalCost - wellsFee
  const savingsPercentage = (savings / traditionalCost) * 100
  const roi = targetRevenue / wellsFee

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">Wells GTM Savings Calculator</h1>
          <p className="text-xl text-gray-400">
            See how much you save with 0.33% performance-based pricing
          </p>
        </div>

        {/* Calculator Inputs */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Your Goals</h2>

          {/* Target Revenue Slider */}
          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-2">
              Target Annual Revenue
            </label>
            <input
              type="range"
              min="1000000"
              max="100000000"
              step="1000000"
              value={targetRevenue}
              onChange={(e) => setTargetRevenue(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-3xl font-bold text-green-400 mt-3">
              ${(targetRevenue / 1000000).toFixed(1)}M
            </div>
          </div>

          {/* Team Size Selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Sales Team Size</label>
            <div className="grid grid-cols-3 gap-4">
              {['small', 'medium', 'large'].map((size) => (
                <button
                  key={size}
                  onClick={() => setTeamSize(size)}
                  className={`p-4 rounded-lg border-2 transition ${
                    teamSize === size
                      ? 'border-green-500 bg-green-900/20'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="font-bold capitalize">{size}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {size === 'small' && '3-4 people'}
                    {size === 'medium' && '5-7 people'}
                    {size === 'large' && '9-12 people'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results - Hero Savings */}
        <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border-2 border-green-500 rounded-lg p-8 mb-8">
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-2">YOU SAVE</div>
            <div className="text-7xl font-bold text-green-400 mb-4">
              ${(savings / 1000000).toFixed(2)}M
            </div>
            <div className="text-2xl text-white mb-6">
              {savingsPercentage.toFixed(1)}% cost reduction
            </div>
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-gray-700">
              <div>
                <div className="text-sm text-gray-400">Traditional Cost</div>
                <div className="text-2xl font-bold text-red-400">
                  ${(traditionalCost / 1000).toFixed(0)}K
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Wells Fee (0.33%)</div>
                <div className="text-2xl font-bold text-green-400">
                  ${(wellsFee / 1000).toFixed(0)}K
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">ROI</div>
                <div className="text-2xl font-bold text-blue-400">{roi.toFixed(0)}x</div>
              </div>
            </div>
          </div>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Traditional Team */}
          <div className="bg-gray-900 border border-red-700/50 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-red-400">Traditional Sales Team</h3>
            <div className="space-y-3 mb-6">
              {breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-400">{item.role}</span>
                  <span className="text-red-400 font-bold">
                    ${item.cost.toLocaleString()}/year
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-700 pt-3 flex justify-between font-bold text-lg">
                <span>TOTAL</span>
                <span className="text-red-400">${traditionalCost.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-xs text-red-300 bg-red-900/20 border border-red-700/50 rounded p-3">
              <div className="font-bold mb-1">❌ High Risk</div>
              <ul className="space-y-1">
                <li>• 6-12 month ramp time</li>
                <li>• Fixed cost regardless of results</li>
                <li>• High turnover risk</li>
                <li>• Management overhead</li>
              </ul>
            </div>
          </div>

          {/* Wells GTM SDK */}
          <div className="bg-gradient-to-br from-green-900/20 to-blue-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-green-400">Wells GTM SDK</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Setup Cost</span>
                <span className="text-green-400 font-bold">$0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Monthly Retainer</span>
                <span className="text-green-400 font-bold">$0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Success Fee (0.33%)</span>
                <span className="text-green-400 font-bold">${wellsFee.toLocaleString()}</span>
              </div>
              <div className="border-t border-gray-700 pt-3 flex justify-between font-bold text-lg">
                <span>TOTAL</span>
                <span className="text-green-400">${wellsFee.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-xs text-green-300 bg-green-900/20 border border-green-700/50 rounded p-3">
              <div className="font-bold mb-1">✅ Zero Risk</div>
              <ul className="space-y-1">
                <li>• Live in 48 hours</li>
                <li>• Pay only on results</li>
                <li>• No hiring, no management</li>
                <li>• Scales automatically</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">Ready to Save ${(savings / 1000).toFixed(0)}K?</h3>
          <p className="text-gray-400 mb-6">
            Install Wells GTM SDK and start generating revenue in 48 hours
          </p>
          <div className="bg-gray-900 border border-gray-700 rounded p-4 text-left mb-4 font-mono text-sm">
            <div className="text-green-400">$ npm install @wells/gtm-sdk</div>
          </div>
          <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition">
            Get Started — $0 Upfront
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Wells GTM SDK • 0.33% Success Fee • Zero Risk</p>
          <p className="text-xs mt-1">Built with precision. Powered by trust.</p>
        </div>
      </div>
    </div>
  )
}
