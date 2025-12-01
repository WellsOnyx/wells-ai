'use client';

import { useState } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';

interface InvestmentCalculatorProps {
  lockedPrice: number;
  currentNav: number;
  projectedNav?: number[];
}

export function InvestmentCalculator({
  lockedPrice,
  currentNav,
  projectedNav = [1.5, 2.0, 3.0, 5.0],
}: InvestmentCalculatorProps) {
  const [amount, setAmount] = useState<string>('10000');

  const investmentAmount = parseFloat(amount) || 0;
  const grainAmount = investmentAmount / lockedPrice;
  const currentValue = grainAmount * currentNav;
  const currentGain = currentValue - investmentAmount;
  const currentGainPercent = ((currentGain / investmentAmount) * 100).toFixed(2);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="w-5 h-5 text-wells-gold" />
        <h3 className="text-lg font-semibold text-white">Investment Calculator</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Investment Amount (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="10000"
              step="1000"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white focus:outline-none focus:border-wells-gold"
              placeholder="10,000"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Minimum investment: $10,000</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">GRAIN at locked price</span>
            <span className="text-white font-semibold">{grainAmount.toLocaleString()} GRAIN</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Cost per GRAIN</span>
            <span className="text-white font-semibold">${lockedPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Current NAV</span>
            <span className="text-white font-semibold">${currentNav.toFixed(4)}</span>
          </div>
          <div className="border-t border-gray-700 pt-3">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Current Value</span>
              <span className="text-white font-semibold">${currentValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Unrealized Gain</span>
              <span
                className={`font-semibold ${
                  currentGain >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                ${currentGain.toLocaleString()} ({currentGain >= 0 && '+'}
                {currentGainPercent}%)
              </span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-400 mb-3">Future Value Projections</p>
          <div className="grid grid-cols-2 gap-3">
            {projectedNav.map((nav) => {
              const futureValue = grainAmount * nav;
              const futureGain = futureValue - investmentAmount;
              const futureGainPercent = ((futureGain / investmentAmount) * 100).toFixed(0);

              return (
                <div
                  key={nav}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-3"
                >
                  <div className="flex items-center gap-1 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-gray-400">At ${nav.toFixed(2)} NAV</span>
                  </div>
                  <p className="text-lg font-bold text-white mb-1">
                    ${futureValue.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-500">
                    +${futureGain.toLocaleString()} ({futureGainPercent}%)
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
