/**
 * GTM Tier Progress Component
 *
 * Shows user their current tier and progress to next tier
 * Gamification to drive more deal volume
 */

'use client'

import { useState, useEffect } from 'react'
import {
  calculateTier,
  getTierUpgradeIncentive,
  SUBSCRIPTION_TIERS,
  type TierConfig,
} from '@/lib/gtm/subscription-tiers'

interface GTMTierProgressProps {
  userId: string
  trailing12MonthGMV: number
}

export default function GTMTierProgress({ userId, trailing12MonthGMV }: GTMTierProgressProps) {
  const currentTier = calculateTier(trailing12MonthGMV)
  const incentive = getTierUpgradeIncentive(trailing12MonthGMV)

  // Calculate progress to next tier
  const currentIndex = SUBSCRIPTION_TIERS.findIndex((t) => t.tier === currentTier.tier)
  const nextTier = incentive?.nextTier
  const progress = nextTier
    ? ((trailing12MonthGMV - currentTier.minGMV) /
        (nextTier.minGMV - currentTier.minGMV)) *
      100
    : 100

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Current Tier Badge */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">GTM Stack Subscription</h3>
          <p className="text-sm text-gray-600 mt-1">
            Based on trailing 12-month transaction volume
          </p>
        </div>
        <div
          className="px-4 py-2 rounded-full font-bold text-white"
          style={{ backgroundColor: currentTier.color }}
        >
          {currentTier.name}
        </div>
      </div>

      {/* Current Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            ${(trailing12MonthGMV / 1000).toFixed(0)}K
          </div>
          <div className="text-xs text-gray-600 mt-1">12-Month GMV</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            ${currentTier.monthlyCost}
            <span className="text-sm text-gray-600">/mo</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">Current Cost</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {currentTier.monthlyCost === 0 ? 'FREE!' : `$${currentTier.monthlyCost * 12}/yr`}
          </div>
          <div className="text-xs text-gray-600 mt-1">Annual Cost</div>
        </div>
      </div>

      {/* Progress to Next Tier */}
      {incentive && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress to {incentive.nextTier.name}
            </span>
            <span className="text-sm font-medium text-gray-900">{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: incentive.nextTier.color,
              }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-600">
            ${(incentive.gmvNeeded / 1000).toFixed(0)}K more to unlock {incentive.nextTier.name}
          </div>
        </div>
      )}

      {/* Incentive Message */}
      {incentive && (
        <div
          className="p-4 rounded-lg border-2 mb-4"
          style={{
            backgroundColor: `${incentive.nextTier.color}20`,
            borderColor: incentive.nextTier.color,
          }}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎯</div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">
                {incentive.nextTier.monthlyCost === 0
                  ? 'Unlock FREE GTM Stack!'
                  : `Save $${incentive.savings.toLocaleString()}/year`}
              </h4>
              <p className="text-sm text-gray-700">{incentive.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Tier Features */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Your Current Benefits:</h4>
        <ul className="space-y-2">
          {currentTier.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Next Tier Preview */}
      {incentive && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Unlock with {incentive.nextTier.name}:
          </h4>
          <ul className="space-y-2">
            {incentive.nextTier.features
              .filter((f) => !currentTier.features.includes(f))
              .map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-gray-400 mt-0.5">○</span>
                  <span>{feature}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Platinum Achievement */}
      {currentTier.tier === 'platinum' && (
        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-3">
            <div className="text-3xl">👑</div>
            <div>
              <h4 className="font-bold text-purple-900">Platinum Member!</h4>
              <p className="text-sm text-purple-700 mt-1">
                You've unlocked the highest tier. Your GTM stack is completely free, and you have
                access to our white-glove service.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All Tiers Overview */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
          View All Tiers
        </summary>
        <div className="mt-4 space-y-3">
          {SUBSCRIPTION_TIERS.map((tier) => {
            const isCurrent = tier.tier === currentTier.tier
            return (
              <div
                key={tier.tier}
                className={`p-3 rounded-lg border-2 ${
                  isCurrent ? 'border-black bg-gray-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tier.color }}
                    />
                    <span className="font-semibold text-gray-900">{tier.name}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 bg-black text-white text-xs rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {tier.monthlyCost === 0 ? 'FREE' : `$${tier.monthlyCost}/mo`}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  {tier.maxGMV
                    ? `$${(tier.minGMV / 1000).toFixed(0)}K - $${(tier.maxGMV / 1000).toFixed(0)}K GMV/year`
                    : `$${(tier.minGMV / 1000).toFixed(0)}K+ GMV/year`}
                </div>
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}
