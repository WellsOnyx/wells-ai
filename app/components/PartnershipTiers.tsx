'use client'

import { useState } from 'react'
import { CategoryPioneerOpportunity } from '@/lib/categories'

interface PartnershipTiersProps {
  category: CategoryPioneerOpportunity
  onSelectTier: (tier: 1 | 2 | 3) => void
}

export default function PartnershipTiers({ category, onSelectTier }: PartnershipTiersProps) {
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3 | null>(null)

  const handleSelectTier = (tier: 1 | 2 | 3) => {
    setSelectedTier(tier)
    onSelectTier(tier)
  }

  const tiers = [
    {
      tier: 1,
      name: 'Tier 1: Strategic Partner',
      revenueShare: '20%',
      annualRevenue: category.tier1Revenue,
      requirements: [
        'Co-build 4-week sprint with Wells AI team',
        'Provide supplier network access',
        'Share industry expertise and best practices',
        'Quarterly business reviews',
        'Commit to platform exclusivity in category'
      ],
      economics: `At $${category.potentialYearTwoRevenue}K total category revenue: You earn ~$${category.tier1Revenue}K/year`,
      bestFor: 'Established market leaders who want strategic partnership',
      color: '#183b6d'
    },
    {
      tier: 2,
      name: 'Tier 2: Co-Creator',
      revenueShare: '35%',
      annualRevenue: category.tier2Revenue,
      requirements: [
        'Everything in Tier 1, plus:',
        'Active category evangelism (content, webinars, events)',
        'Commit initial supplier relationships (10+ qualified suppliers)',
        'Co-marketing partnership (press releases, case studies)',
        'Quarterly thought leadership content',
        'Help recruit additional suppliers to platform'
      ],
      economics: `At $${category.potentialYearTwoRevenue}K total category revenue: You earn ~$${category.tier2Revenue}K/year`,
      bestFor: 'Companies willing to actively build the category with us',
      color: '#dba63f',
      recommended: true
    },
    {
      tier: 3,
      name: 'Tier 3: Category Architect',
      revenueShare: '50%',
      annualRevenue: category.tier3Revenue,
      requirements: [
        'Everything in Tier 2, plus:',
        'Full category ownership and management',
        'Build and maintain supplier quality standards',
        'Lead AI training for category-specific intelligence',
        'Develop pricing models and package structures',
        'Handle L2 customer support escalations',
        'Recruit and onboard 50+ qualified suppliers',
        'Guarantee category growth targets (20% YoY)'
      ],
      economics: `At $${category.potentialYearTwoRevenue}K total category revenue: You earn ~$${category.tier3Revenue}K/year`,
      bestFor: 'Market leaders ready to own the category end-to-end',
      color: '#000000'
    }
  ]

  return (
    <div className="my-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-serif text-[#183b6d] mb-2">
          Choose Your Partnership Tier
        </h3>
        <p className="text-sm text-[#575757]">
          Each tier represents a different level of involvement and revenue share.
          Higher tiers earn more but require more active participation.
        </p>
      </div>

      {/* Tiers Grid */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {tiers.map((tierData) => (
          <div
            key={tierData.tier}
            className={`border-2 rounded-sm p-5 relative transition-all ${
              selectedTier === tierData.tier
                ? 'border-[#dba63f] shadow-lg'
                : 'border-[#9ea1a7]/30 hover:border-[#183b6d]'
            } ${tierData.recommended ? 'bg-gradient-to-br from-[#dba63f]/10 to-white' : 'bg-white'}`}
          >
            {tierData.recommended && (
              <div className="absolute top-3 right-3">
                <span className="inline-block px-3 py-1 bg-[#dba63f] text-white text-xs font-medium rounded-full">
                  MOST POPULAR
                </span>
              </div>
            )}

            {/* Tier Header */}
            <div className="mb-4 mt-2">
              <div className="text-sm font-medium text-[#9ea1a7] mb-1">
                {tierData.name}
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-[#183b6d]">
                  {tierData.revenueShare}
                </span>
                <span className="text-sm text-[#575757]">revenue share</span>
              </div>
              <div className="text-sm font-medium text-[#dba63f]">
                ~${tierData.annualRevenue}K/year potential
              </div>
            </div>

            {/* Requirements */}
            <div className="mb-6">
              <div className="text-xs font-medium text-[#9ea1a7] mb-2 uppercase">
                What's Required
              </div>
              <ul className="space-y-1.5 text-xs text-[#575757]">
                {tierData.requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#183b6d] mt-0.5 flex-shrink-0">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Economics */}
            <div className="mb-6 p-3 bg-[#183b6d]/5 rounded-sm">
              <div className="text-xs font-medium text-[#183b6d] mb-1">
                Economics Example:
              </div>
              <div className="text-xs text-[#575757]">
                {tierData.economics}
              </div>
            </div>

            {/* Best For */}
            <div className="mb-4 pb-4 border-b border-[#9ea1a7]/20">
              <div className="text-xs font-medium text-[#9ea1a7] mb-1">
                Best for:
              </div>
              <div className="text-xs text-[#575757]">
                {tierData.bestFor}
              </div>
            </div>

            {/* Select Button */}
            <button
              onClick={() => handleSelectTier(tierData.tier as 1 | 2 | 3)}
              className={`w-full px-4 py-3 rounded-sm font-medium transition-all ${
                selectedTier === tierData.tier
                  ? 'bg-[#dba63f] text-white'
                  : 'bg-[#183b6d] text-white hover:bg-[#0d2545]'
              }`}
            >
              {selectedTier === tierData.tier ? '✓ Selected' : `Select Tier ${tierData.tier}`}
            </button>
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div className="border border-[#183b6d]/20 rounded-sm p-4 bg-[#183b6d]/5">
        <div className="text-sm font-medium text-[#183b6d] mb-2">
          Important Notes:
        </div>
        <ul className="space-y-1 text-xs text-[#575757]">
          <li className="flex items-start gap-2">
            <span className="text-[#183b6d] mt-0.5">•</span>
            <span>Revenue share is calculated on <strong>all deals</strong> in the category, not just yours</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#183b6d] mt-0.5">•</span>
            <span>Partnership is exclusive: Wells AI will not pioneer this category with competitors</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#183b6d] mt-0.5">•</span>
            <span>Revenue share is <strong>perpetual</strong> as long as partnership remains active</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#183b6d] mt-0.5">•</span>
            <span>Category performance is reported monthly with full transparency</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#183b6d] mt-0.5">•</span>
            <span>Partnership can be upgraded (e.g., Tier 1 → Tier 2) based on performance</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
