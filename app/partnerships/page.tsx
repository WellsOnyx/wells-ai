'use client'

import { useState } from 'react'
import { OPEN_CATEGORIES, ACTIVE_PARTNERSHIPS, CategoryPioneerOpportunity } from '@/lib/categories'
import Link from 'next/link'

export default function PartnershipsPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryPioneerOpportunity | null>(null)

  // Sample live activity (will be fetched from Notion in production)
  const liveActivity = [
    {
      id: '1',
      type: 'partnership_signed',
      company: 'ABB',
      category: 'Industrial Robotics',
      tier: 3,
      timestamp: '2 hours ago'
    },
    {
      id: '2',
      type: 'category_opened',
      category: 'Cybersecurity Services',
      timestamp: '5 hours ago'
    },
    {
      id: '3',
      type: 'partnership_signed',
      company: 'Medtronic',
      category: 'Medical Device Manufacturing',
      tier: 2,
      timestamp: '1 day ago'
    },
    {
      id: '4',
      type: 'inquiry',
      category: 'Injection Molding',
      timestamp: '2 days ago'
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-serif text-[#183b6d] mb-2">
                Category Pioneers
              </h1>
              <p className="text-[#575757]">
                Build procurement categories, earn perpetual revenue share
              </p>
            </div>
            <Link
              href="/"
              className="px-6 py-3 bg-[#183b6d] text-white text-sm rounded-sm hover:bg-[#0d2545] transition-all"
            >
              Back to Wells AI
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#183b6d]">{OPEN_CATEGORIES.length}</div>
              <div className="text-sm text-[#9ea1a7] mt-1">Open Categories</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#dba63f]">{ACTIVE_PARTNERSHIPS.length}</div>
              <div className="text-sm text-[#9ea1a7] mt-1">Active Partners</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#183b6d]">$12.4B</div>
              <div className="text-sm text-[#9ea1a7] mt-1">Total Market Size</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#dba63f]">20-50%</div>
              <div className="text-sm text-[#9ea1a7] mt-1">Revenue Share</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Open Categories Grid */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <h2 className="text-2xl font-serif text-[#183b6d] mb-2">
                Open Opportunities
              </h2>
              <p className="text-sm text-[#575757]">
                First company to pioneer these categories earns perpetual revenue share
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {OPEN_CATEGORIES.map((category) => (
                <div
                  key={category.slug}
                  className="border border-[#9ea1a7]/30 rounded-sm p-5 bg-white hover:border-[#dba63f] transition-all cursor-pointer group"
                  onClick={() => setSelectedCategory(category)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">{category.emoji}</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-[#183b6d] mb-1 group-hover:text-[#dba63f] transition-colors">
                        {category.name}
                      </h3>
                      <div className="text-xs text-[#9ea1a7] uppercase tracking-wide">
                        {category.status === 'open' ? '🟢 OPEN' : '🟡 IN NEGOTIATION'}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-[#575757] mb-4">
                    {category.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9ea1a7]">Market Size</span>
                      <span className="font-medium text-[#183b6d]">{category.marketSize}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9ea1a7]">Year 2 Potential</span>
                      <span className="font-medium text-[#dba63f]">${category.potentialYearTwoRevenue}K+</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#9ea1a7]/20">
                    <div className="text-xs text-[#575757] mb-2">Revenue Share Tiers:</div>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-[#183b6d]/10 text-[#183b6d] rounded">
                        T1: ${category.tier1Revenue}K
                      </span>
                      <span className="px-2 py-1 bg-[#dba63f]/10 text-[#dba63f] rounded">
                        T2: ${category.tier2Revenue}K
                      </span>
                      <span className="px-2 py-1 bg-black/10 text-black rounded">
                        T3: ${category.tier3Revenue}K
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Active Partnerships Section */}
            <div className="mt-12">
              <h2 className="text-2xl font-serif text-[#183b6d] mb-6">
                Active Category Pioneers
              </h2>

              <div className="space-y-4">
                {ACTIVE_PARTNERSHIPS.map((partnership) => (
                  <div
                    key={partnership.slug}
                    className="border-l-4 border-[#dba63f] bg-[#dba63f]/5 rounded-sm p-5"
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{partnership.emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-medium text-[#183b6d]">
                              {partnership.name}
                            </h3>
                            <div className="text-sm text-[#575757] mt-1">
                              Pioneered by <strong>{partnership.pioneerCompany}</strong>
                            </div>
                          </div>
                          <div className="text-xs text-[#dba63f] uppercase tracking-wide">
                            ✓ LIVE
                          </div>
                        </div>
                        <p className="text-sm text-[#575757] mb-3">
                          {partnership.description}
                        </p>
                        <div className="flex gap-4 text-sm">
                          <span className="text-[#9ea1a7]">
                            Market: <strong className="text-[#183b6d]">{partnership.marketSize}</strong>
                          </span>
                          <span className="text-[#9ea1a7]">
                            Category Revenue: <strong className="text-[#183b6d]">${partnership.potentialYearTwoRevenue}K+/year</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Live Activity Feed */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <h2 className="text-xl font-serif text-[#183b6d] mb-4">
                Live Activity
              </h2>

              <div className="space-y-3">
                {liveActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="border border-[#9ea1a7]/20 rounded-sm p-4 bg-white"
                  >
                    {activity.type === 'partnership_signed' && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-[#dba63f]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-medium text-[#dba63f]">Partnership Signed</span>
                        </div>
                        <div className="text-sm text-[#183b6d] mb-1">
                          <strong>{activity.company}</strong> pioneered <strong>{activity.category}</strong>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#9ea1a7]">
                          <span>Tier {activity.tier}</span>
                          <span>•</span>
                          <span>{activity.timestamp}</span>
                        </div>
                      </div>
                    )}

                    {activity.type === 'category_opened' && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-[#183b6d]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-medium text-[#183b6d]">New Category</span>
                        </div>
                        <div className="text-sm text-[#183b6d] mb-1">
                          <strong>{activity.category}</strong> now open for pioneering
                        </div>
                        <div className="text-xs text-[#9ea1a7]">
                          {activity.timestamp}
                        </div>
                      </div>
                    )}

                    {activity.type === 'inquiry' && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-[#9ea1a7]" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                          </svg>
                          <span className="text-xs font-medium text-[#9ea1a7]">Category Inquiry</span>
                        </div>
                        <div className="text-sm text-[#575757] mb-1">
                          Company interested in <strong>{activity.category}</strong>
                        </div>
                        <div className="text-xs text-[#9ea1a7]">
                          {activity.timestamp}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Call to Action */}
              <div className="mt-6 border-2 border-[#dba63f] bg-gradient-to-br from-[#dba63f]/10 to-white rounded-sm p-5">
                <h3 className="text-lg font-medium text-[#183b6d] mb-2">
                  Want to Pioneer?
                </h3>
                <p className="text-sm text-[#575757] mb-4">
                  Start a conversation on Wells AI and request any category. If it's not on our platform yet,
                  you'll get first mover rights.
                </p>
                <Link
                  href="/"
                  className="block w-full text-center px-4 py-3 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89531] transition-all"
                >
                  Start Conversation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Detail Modal */}
      {selectedCategory && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setSelectedCategory(null)}
        >
          <div
            className="bg-white rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-6">
              <span className="text-5xl">{selectedCategory.emoji}</span>
              <div className="flex-1">
                <h2 className="text-3xl font-serif text-[#183b6d] mb-2">
                  {selectedCategory.name}
                </h2>
                <p className="text-[#575757]">
                  {selectedCategory.description}
                </p>
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-[#9ea1a7] hover:text-[#183b6d]"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-[#9ea1a7]/20 rounded-sm p-4">
                <div className="text-sm text-[#9ea1a7] mb-1">Market Size</div>
                <div className="text-2xl font-bold text-[#183b6d]">{selectedCategory.marketSize}</div>
              </div>
              <div className="border border-[#dba63f]/40 bg-[#dba63f]/5 rounded-sm p-4">
                <div className="text-sm text-[#9ea1a7] mb-1">Year 2 Potential</div>
                <div className="text-2xl font-bold text-[#dba63f]">${selectedCategory.potentialYearTwoRevenue}K+</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium text-[#183b6d] mb-3">
                Revenue Share Tiers
              </h3>
              <div className="space-y-3">
                <div className="border border-[#9ea1a7]/20 rounded-sm p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-[#183b6d]">Tier 1: Strategic Partner</span>
                    <span className="text-[#dba63f] font-bold">20%</span>
                  </div>
                  <div className="text-sm text-[#575757]">
                    Earn ~${selectedCategory.tier1Revenue}K/year at maturity
                  </div>
                </div>
                <div className="border border-[#dba63f]/40 bg-[#dba63f]/5 rounded-sm p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-[#183b6d]">Tier 2: Co-Creator</span>
                    <span className="text-[#dba63f] font-bold">35%</span>
                  </div>
                  <div className="text-sm text-[#575757]">
                    Earn ~${selectedCategory.tier2Revenue}K/year at maturity
                  </div>
                  <div className="mt-2 text-xs text-[#dba63f]">
                    ⭐ MOST POPULAR
                  </div>
                </div>
                <div className="border border-[#9ea1a7]/20 rounded-sm p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-[#183b6d]">Tier 3: Category Architect</span>
                    <span className="text-[#183b6d] font-bold">50%</span>
                  </div>
                  <div className="text-sm text-[#575757]">
                    Earn ~${selectedCategory.tier3Revenue}K/year at maturity
                  </div>
                </div>
              </div>
            </div>

            <Link
              href={`/?category=${selectedCategory.slug}`}
              className="block w-full text-center px-6 py-4 bg-[#dba63f] text-white font-medium rounded-sm hover:bg-[#c89531] transition-all"
            >
              Pioneer This Category →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
