'use client'

import { useState } from 'react'
import { CategoryPioneerOpportunity } from '@/lib/categories'

interface PartnershipPitchProps {
  category: CategoryPioneerOpportunity
  userRequest: string
  onSelectPath: (path: 'standard' | 'partnership') => void
}

export default function PartnershipPitch({ category, userRequest, onSelectPath }: PartnershipPitchProps) {
  const [selectedPath, setSelectedPath] = useState<'standard' | 'partnership' | null>(null)

  const handleSelectPartnership = () => {
    setSelectedPath('partnership')
    onSelectPath('partnership')
  }

  const handleSelectStandard = () => {
    setSelectedPath('standard')
    onSelectPath('standard')
  }

  return (
    <div className="my-6 border-2 border-[#dba63f] rounded-sm p-6 bg-gradient-to-br from-[#dba63f]/5 to-transparent">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{category.emoji}</span>
          <div>
            <h3 className="text-2xl font-serif text-[#183b6d]">
              Category Pioneer Opportunity
            </h3>
            <p className="text-sm text-[#575757]">
              You're the first to request {category.name} on Wells AI
            </p>
          </div>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="mb-6 p-4 bg-white rounded-sm border border-[#183b6d]/20">
        <p className="text-[#183b6d] font-medium mb-2">
          🎯 What this means for you:
        </p>
        <p className="text-sm text-[#575757]">
          You're requesting a category that's not on our platform yet. This gives you a unique opportunity
          to become the <strong>Category Pioneer</strong> and earn revenue share on all future deals in this category.
        </p>
      </div>

      {/* Two Paths */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Standard Path */}
        <div className="border border-[#9ea1a7]/30 rounded-sm p-5 bg-white hover:border-[#183b6d] transition-all">
          <div className="mb-4">
            <h4 className="text-lg font-medium text-[#183b6d] mb-2">Standard Path</h4>
            <p className="text-sm text-[#575757] mb-4">
              We'll learn {category.name} and find suppliers for you
            </p>
          </div>

          <ul className="space-y-2 text-sm text-[#575757] mb-6">
            <li className="flex items-start gap-2">
              <span className="text-[#183b6d] mt-0.5">→</span>
              <span>Generic learning process (2-4 weeks)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#183b6d] mt-0.5">→</span>
              <span>33bps on <em>your</em> deals only</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#183b6d] mt-0.5">→</span>
              <span>No special placement or priority</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#183b6d] mt-0.5">→</span>
              <span>Standard supplier matching</span>
            </li>
          </ul>

          <button
            onClick={handleSelectStandard}
            disabled={selectedPath === 'partnership'}
            className="w-full px-4 py-3 border-2 border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue Standard
          </button>
        </div>

        {/* Partnership Path */}
        <div className="border-2 border-[#dba63f] rounded-sm p-5 bg-gradient-to-br from-[#dba63f]/10 to-white relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <span className="inline-block px-3 py-1 bg-[#dba63f] text-white text-xs font-medium rounded-full">
              RECOMMENDED
            </span>
          </div>

          <div className="mb-4 mt-6">
            <h4 className="text-lg font-medium text-[#183b6d] mb-2">
              Partnership Path ⭐
            </h4>
            <p className="text-sm text-[#575757] mb-4">
              Co-build this category with us and earn forever
            </p>
          </div>

          <ul className="space-y-2 text-sm text-[#183b6d] mb-6">
            <li className="flex items-start gap-2">
              <span className="text-[#dba63f] mt-0.5">✓</span>
              <span><strong>4-week co-build sprint</strong> with Wells AI team</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#dba63f] mt-0.5">✓</span>
              <span><strong>Earn 20-50%</strong> of ALL future fees (not just your deals)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#dba63f] mt-0.5">✓</span>
              <span><strong>Permanent featured placement</strong> as Category Pioneer</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#dba63f] mt-0.5">✓</span>
              <span><strong>Your brand on our homepage</strong> (massive visibility)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#dba63f] mt-0.5">✓</span>
              <span className="font-medium">Example: ${category.potentialYearTwoRevenue}K+/year by Year 2</span>
            </li>
          </ul>

          <button
            onClick={handleSelectPartnership}
            disabled={selectedPath === 'standard'}
            className="w-full px-4 py-3 bg-[#dba63f] text-white font-medium rounded-sm hover:bg-[#c89531] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Explore Partnership →
          </button>
        </div>
      </div>

      {/* Market Size Context */}
      <div className="border-t border-[#9ea1a7]/20 pt-4">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-[#9ea1a7] mb-1">Market Size</div>
            <div className="text-lg font-medium text-[#183b6d]">{category.marketSize}</div>
          </div>
          <div>
            <div className="text-[#9ea1a7] mb-1">Category Status</div>
            <div className="text-lg font-medium text-[#dba63f]">OPEN</div>
          </div>
          <div>
            <div className="text-[#9ea1a7] mb-1">Your Opportunity</div>
            <div className="text-lg font-medium text-[#183b6d]">First Mover</div>
          </div>
        </div>
      </div>
    </div>
  )
}
