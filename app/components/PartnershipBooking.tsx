'use client'

import { useEffect, useState } from 'react'
import { CategoryPioneerOpportunity } from '@/lib/categories'

interface PartnershipBookingProps {
  category: CategoryPioneerOpportunity
  tier: 1 | 2 | 3
  companyName?: string
  contactName?: string
  contactEmail?: string
}

export default function PartnershipBooking({
  category,
  tier,
  companyName = '',
  contactName = '',
  contactEmail = ''
}: PartnershipBookingProps) {
  const [partnershipCreated, setPartnershipCreated] = useState(false)

  // Create partnership record in Notion
  useEffect(() => {
    const createPartnership = async () => {
      if (partnershipCreated) return

      try {
        const response = await fetch('/api/partnerships/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categorySlug: category.slug,
            categoryName: category.name,
            pioneerCompany: companyName || 'Unknown Company',
            contactName: contactName || 'Unknown',
            contactEmail: contactEmail || '',
            tier,
            marketSize: category.marketSize,
            categoryDescription: category.description
          })
        })

        const data = await response.json()
        if (data.success) {
          console.log('Partnership created:', data.partnershipId)
          setPartnershipCreated(true)
        }
      } catch (error) {
        console.error('Failed to create partnership:', error)
      }
    }

    createPartnership()
  }, [category, tier, companyName, contactName, contactEmail, partnershipCreated])

  useEffect(() => {
    // Load Calendly widget script
    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const tierNames = {
    1: 'Strategic Partner (20%)',
    2: 'Co-Creator (35%)',
    3: 'Category Architect (50%)'
  }

  // Calendly URL with pre-filled parameters
  const calendlyUrl = new URL(process.env.NEXT_PUBLIC_CALENDLY_PARTNERSHIP || 'https://calendly.com/jonah-manning/partnership')
  calendlyUrl.searchParams.set('name', contactName)
  calendlyUrl.searchParams.set('email', contactEmail)
  calendlyUrl.searchParams.set('a1', companyName) // Custom field: Company
  calendlyUrl.searchParams.set('a2', category.name) // Custom field: Category
  calendlyUrl.searchParams.set('a3', `Tier ${tier}: ${tierNames[tier]}`) // Custom field: Tier

  return (
    <div className="my-6">
      {/* Success Message */}
      <div className="mb-6 border-l-4 border-[#dba63f] pl-6 py-4 bg-gradient-to-r from-[#dba63f]/10 to-transparent">
        <h3 className="text-2xl font-serif text-[#183b6d] mb-3">
          Excellent Choice! ⭐
        </h3>
        <p className="text-[#575757] mb-4">
          You've selected <strong>Tier {tier}: {tierNames[tier]}</strong> partnership
          for <strong>{category.name}</strong>.
        </p>
        <p className="text-sm text-[#575757]">
          Here's what happens next:
        </p>
      </div>

      {/* Timeline */}
      <div className="mb-6 grid md:grid-cols-4 gap-4">
        <div className="border border-[#183b6d]/20 rounded-sm p-4 bg-white">
          <div className="text-[#dba63f] font-bold text-lg mb-1">Step 1</div>
          <div className="text-sm font-medium text-[#183b6d] mb-2">
            Intro Call (30 min)
          </div>
          <div className="text-xs text-[#575757]">
            Meet with Jonah Manning to discuss category vision and partnership details
          </div>
        </div>

        <div className="border border-[#183b6d]/20 rounded-sm p-4 bg-white">
          <div className="text-[#dba63f] font-bold text-lg mb-1">Step 2</div>
          <div className="text-sm font-medium text-[#183b6d] mb-2">
            Partnership Agreement
          </div>
          <div className="text-xs text-[#575757]">
            24-hour turnaround on customized partnership contract
          </div>
        </div>

        <div className="border border-[#183b6d]/20 rounded-sm p-4 bg-white">
          <div className="text-[#dba63f] font-bold text-lg mb-1">Step 3</div>
          <div className="text-sm font-medium text-[#183b6d] mb-2">
            4-Week Build Sprint
          </div>
          <div className="text-xs text-[#575757]">
            Co-build the category: AI training, supplier network, pricing models
          </div>
        </div>

        <div className="border border-[#183b6d]/20 rounded-sm p-4 bg-white">
          <div className="text-[#dba63f] font-bold text-lg mb-1">Step 4</div>
          <div className="text-sm font-medium text-[#183b6d] mb-2">
            Category Launch
          </div>
          <div className="text-xs text-[#575757]">
            Go live on Wells AI platform + PR announcement + revenue tracking
          </div>
        </div>
      </div>

      {/* Your Opportunity Summary */}
      <div className="mb-6 border border-[#dba63f]/40 rounded-sm p-6 bg-gradient-to-br from-[#dba63f]/5 to-transparent">
        <h4 className="text-lg font-medium text-[#183b6d] mb-4">
          Your Category Pioneer Opportunity
        </h4>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-medium text-[#9ea1a7] mb-2">Category Details</div>
            <div className="space-y-2 text-sm text-[#575757]">
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="font-medium text-[#183b6d]">{category.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Market Size:</span>
                <span className="font-medium text-[#183b6d]">{category.marketSize}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-medium text-[#dba63f]">OPEN</span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-[#9ea1a7] mb-2">Your Partnership</div>
            <div className="space-y-2 text-sm text-[#575757]">
              <div className="flex justify-between">
                <span>Revenue Share:</span>
                <span className="font-medium text-[#183b6d]">{tier === 1 ? '20%' : tier === 2 ? '35%' : '50%'}</span>
              </div>
              <div className="flex justify-between">
                <span>Year 2 Potential:</span>
                <span className="font-medium text-[#183b6d]">
                  ~${tier === 1 ? category.tier1Revenue : tier === 2 ? category.tier2Revenue : category.tier3Revenue}K/year
                </span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium text-[#183b6d]">Perpetual</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendly Embed */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-[#183b6d] mb-4">
          Book Your Partnership Intro Call
        </h4>
        <div
          className="calendly-inline-widget"
          data-url={calendlyUrl.toString()}
          style={{ minWidth: '320px', height: '700px' }}
        />
      </div>

      {/* FAQ */}
      <div className="border-t border-[#9ea1a7]/20 pt-6">
        <h4 className="text-sm font-medium text-[#183b6d] mb-3">
          Frequently Asked Questions
        </h4>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium text-[#183b6d] mb-1">
              Q: What if my competitor also wants to pioneer this category?
            </div>
            <div className="text-[#575757]">
              A: First mover wins. Once you sign the partnership agreement, we will not accept other partners
              in your category. Your exclusivity is protected.
            </div>
          </div>
          <div>
            <div className="font-medium text-[#183b6d] mb-1">
              Q: How is revenue share calculated?
            </div>
            <div className="text-[#575757]">
              A: You earn your percentage (20%/35%/50%) of ALL transaction fees (33bps) in your category.
              Example: If $100M flows through the category, Wells AI earns $330K in fees, and you get
              your share of that ($66K at 20%, $116K at 35%, or $165K at 50%).
            </div>
          </div>
          <div>
            <div className="font-medium text-[#183b6d] mb-1">
              Q: What happens if I don't perform?
            </div>
            <div className="text-[#575757]">
              A: Partnership includes performance commitments (supplier count, category growth, etc.).
              If commitments aren't met, we have the right to downgrade tier or, in extreme cases,
              terminate the partnership. But we'll work with you to succeed—your success is our success.
            </div>
          </div>
          <div>
            <div className="font-medium text-[#183b6d] mb-1">
              Q: Can I upgrade my tier later?
            </div>
            <div className="text-[#575757]">
              A: Yes! If you start at Tier 1 and later want to take on Tier 2 or Tier 3 responsibilities,
              we can upgrade your agreement. Revenue share increases apply from the upgrade date forward.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
