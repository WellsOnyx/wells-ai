'use client'

import { useState } from 'react'
import { UserJourney, UserProfile, FounderProfile, BuyerProfile, SellerProfile, JobsProfile, JOURNEY_CONFIG } from '@/lib/onboarding/types'

interface ProfileExtendedStepProps {
  journey: UserJourney
  profile: Partial<UserProfile>
  onUpdate: (updates: Partial<UserProfile>) => void
  onContinue: () => void
}

export function ProfileExtendedStep({ journey, profile, onUpdate, onContinue }: ProfileExtendedStepProps) {
  const [step, setStep] = useState(0)

  const renderFounderQuestions = () => {
    const founderProfile = (profile.founderProfile || {}) as Partial<FounderProfile>

    const questions = [
      // Question 1: Company Name
      <div key="company" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">What's your company called?</h2>
        <input
          type="text"
          value={founderProfile.companyName || ''}
          onChange={(e) => onUpdate({
            founderProfile: { ...founderProfile, companyName: e.target.value } as FounderProfile
          })}
          className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
          placeholder="Acme Corp"
          autoFocus
        />
      </div>,

      // Question 2: Company Stage
      <div key="stage" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">What stage is {founderProfile.companyName || 'your company'}?</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'idea', label: 'Idea Stage', emoji: '💡' },
            { value: 'mvp', label: 'MVP', emoji: '🛠️' },
            { value: 'early-revenue', label: 'Early Revenue', emoji: '💵' },
            { value: 'scaling', label: 'Scaling', emoji: '🚀' },
            { value: 'series-a+', label: 'Series A+', emoji: '🦄' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => onUpdate({
                founderProfile: { ...founderProfile, companyStage: option.value as FounderProfile['companyStage'] } as FounderProfile
              })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                founderProfile.companyStage === option.value
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <span className="text-2xl">{option.emoji}</span>
              <p className="mt-1 font-medium text-white">{option.label}</p>
            </button>
          ))}
        </div>
      </div>,

      // Question 3: What are you looking for?
      <div key="lookingFor" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">What do you need help with?</h2>
        <p className="text-gray-400">Select all that apply</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'talent', label: 'Hiring Talent', emoji: '👥' },
            { value: 'suppliers', label: 'Finding Suppliers', emoji: '🏭' },
            { value: 'customers', label: 'Getting Customers', emoji: '🎯' },
            { value: 'investors', label: 'Meeting Investors', emoji: '💰' },
          ].map((option) => {
            const isSelected = founderProfile.lookingFor?.includes(option.value as 'talent' | 'suppliers' | 'customers' | 'investors')
            return (
              <button
                key={option.value}
                onClick={() => {
                  const current = founderProfile.lookingFor || []
                  const updated = isSelected
                    ? current.filter(v => v !== option.value)
                    : [...current, option.value as 'talent' | 'suppliers' | 'customers' | 'investors']
                  onUpdate({
                    founderProfile: { ...founderProfile, lookingFor: updated } as FounderProfile
                  })
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <p className="mt-1 font-medium text-white">{option.label}</p>
              </button>
            )
          })}
        </div>
      </div>
    ]

    return questions[step] || null
  }

  const renderBuyerQuestions = () => {
    const buyerProfile = (profile.buyerProfile || {}) as Partial<BuyerProfile>

    const questions = [
      <div key="company" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">What company do you work for?</h2>
        <input
          type="text"
          value={buyerProfile.companyName || ''}
          onChange={(e) => onUpdate({
            buyerProfile: { ...buyerProfile, companyName: e.target.value } as BuyerProfile
          })}
          className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          placeholder="Company name"
          autoFocus
        />
      </div>,

      <div key="industry" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">What industry are you in?</h2>
        <input
          type="text"
          value={buyerProfile.industry || ''}
          onChange={(e) => onUpdate({
            buyerProfile: { ...buyerProfile, industry: e.target.value } as BuyerProfile
          })}
          className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          placeholder="e.g., Manufacturing, Healthcare, Tech"
        />
      </div>,

      <div key="volume" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Typical purchase volume?</h2>
        <div className="space-y-3">
          {[
            { value: 'under-10k', label: 'Under $10K per order', emoji: '💵' },
            { value: '10k-100k', label: '$10K - $100K', emoji: '💰' },
            { value: '100k-1m', label: '$100K - $1M', emoji: '🏦' },
            { value: '1m-plus', label: '$1M+', emoji: '🏛️' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => onUpdate({
                buyerProfile: { ...buyerProfile, purchaseVolume: option.value as BuyerProfile['purchaseVolume'] } as BuyerProfile
              })}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                buyerProfile.purchaseVolume === option.value
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <span className="text-2xl">{option.emoji}</span>
              <span className="font-medium text-white">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    ]

    return questions[step] || null
  }

  const renderSellerQuestions = () => {
    const sellerProfile = (profile.sellerProfile || {}) as Partial<SellerProfile>

    const questions = [
      <div key="company" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">What's your business name?</h2>
        <input
          type="text"
          value={sellerProfile.companyName || ''}
          onChange={(e) => onUpdate({
            sellerProfile: { ...sellerProfile, companyName: e.target.value } as SellerProfile
          })}
          className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          placeholder="Company name"
          autoFocus
        />
      </div>,

      <div key="products" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">What do you sell?</h2>
        <p className="text-gray-400">Describe your products or services</p>
        <textarea
          value={sellerProfile.productsServices?.join(', ') || ''}
          onChange={(e) => onUpdate({
            sellerProfile: { ...sellerProfile, productsServices: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } as SellerProfile
          })}
          className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 h-32 resize-none"
          placeholder="e.g., Custom electronics, Industrial valves, Marketing services"
        />
      </div>,

      <div key="regions" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Where do you ship?</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'usa', label: 'USA' },
            { value: 'canada', label: 'Canada' },
            { value: 'europe', label: 'Europe' },
            { value: 'asia', label: 'Asia' },
            { value: 'global', label: 'Global' },
          ].map((option) => {
            const isSelected = sellerProfile.shippingRegions?.includes(option.value)
            return (
              <button
                key={option.value}
                onClick={() => {
                  const current = sellerProfile.shippingRegions || []
                  const updated = isSelected
                    ? current.filter(v => v !== option.value)
                    : [...current, option.value]
                  onUpdate({
                    sellerProfile: { ...sellerProfile, shippingRegions: updated } as SellerProfile
                  })
                }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className="font-medium text-white">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    ]

    return questions[step] || null
  }

  const renderJobsQuestions = () => {
    const jobsProfile = (profile.jobsProfile || {}) as Partial<JobsProfile>

    const questions = [
      <div key="roles" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">What roles are you looking for?</h2>
        <input
          type="text"
          value={jobsProfile.desiredRoles?.join(', ') || ''}
          onChange={(e) => onUpdate({
            jobsProfile: { ...jobsProfile, desiredRoles: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } as JobsProfile
          })}
          className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          placeholder="e.g., VP of Engineering, Product Manager, CTO"
          autoFocus
        />
      </div>,

      <div key="skills" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">What are your key skills?</h2>
        <textarea
          value={jobsProfile.skills?.join(', ') || ''}
          onChange={(e) => onUpdate({
            jobsProfile: { ...jobsProfile, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } as JobsProfile
          })}
          className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 h-32 resize-none"
          placeholder="e.g., Python, Leadership, Product Strategy, Sales"
        />
      </div>,

      <div key="remote" className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Remote preference?</h2>
        <div className="space-y-3">
          {[
            { value: 'remote-only', label: 'Remote Only', emoji: '🏠' },
            { value: 'hybrid', label: 'Hybrid', emoji: '🔄' },
            { value: 'on-site', label: 'On-site', emoji: '🏢' },
            { value: 'flexible', label: 'Flexible', emoji: '✨' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => onUpdate({
                jobsProfile: { ...jobsProfile, remotePreference: option.value as JobsProfile['remotePreference'] } as JobsProfile
              })}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                jobsProfile.remotePreference === option.value
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <span className="text-2xl">{option.emoji}</span>
              <span className="font-medium text-white">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    ]

    return questions[step] || null
  }

  const getQuestions = () => {
    switch (journey) {
      case 'founder': return renderFounderQuestions()
      case 'buyer': return renderBuyerQuestions()
      case 'seller': return renderSellerQuestions()
      case 'jobs': return renderJobsQuestions()
    }
  }

  const getTotalSteps = () => {
    switch (journey) {
      case 'founder': return 3
      case 'buyer': return 3
      case 'seller': return 3
      case 'jobs': return 3
    }
  }

  const handleNext = () => {
    if (step < getTotalSteps() - 1) {
      setStep(step + 1)
    } else {
      onContinue()
    }
  }

  return (
    <div className="space-y-8">
      {/* Journey Badge */}
      <div className="flex justify-center">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${JOURNEY_CONFIG[journey].color} bg-opacity-20`}>
          <span className="text-white text-sm font-medium">{JOURNEY_CONFIG[journey].title} Journey</span>
        </div>
      </div>

      {/* Question */}
      <div className="min-h-[300px]">
        {getQuestions()}
      </div>

      {/* Navigation */}
      <div className="flex gap-4">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-6 py-3 border border-gray-700 rounded-xl text-white font-medium hover:bg-gray-900 transition-all"
          >
            Back
          </button>
        )}
        <button
          onClick={handleNext}
          className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/25"
        >
          {step < getTotalSteps() - 1 ? 'Next' : 'Continue'}
        </button>
      </div>

      {/* Progress Dots */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: getTotalSteps() }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === step ? 'bg-amber-500 w-6' : i < step ? 'bg-amber-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
