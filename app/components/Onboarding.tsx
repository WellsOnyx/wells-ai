'use client'

import { useState } from 'react'

interface OnboardingProps {
  onComplete: (userData: UserData) => void
}

export interface UserData {
  userType: 'buyer' | 'seller' | 'both' | 'job-seeker' | 'entrepreneur'
  name: string
  company?: string
  email: string
  phone?: string
  industry?: string
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1)
  const [userData, setUserData] = useState<Partial<UserData>>({})

  const handleUserTypeSelect = (type: UserData['userType']) => {
    setUserData({ ...userData, userType: type })
    setStep(2)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (userData.userType && userData.name && userData.email) {
      onComplete(userData as UserData)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {step === 1 && (
          <div className="text-center space-y-12">
            {/* Constellation mark */}
            <div className="flex items-center justify-center mb-8">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="opacity-80">
                <path d="M40 8 L38 20 L42 20 Z" fill="#183b6d" />
                <circle cx="40" cy="20" r="3" fill="#183b6d" />
                <line x1="40" y1="23" x2="28" y2="45" stroke="#183b6d" strokeWidth="0.5" />
                <line x1="40" y1="23" x2="52" y2="45" stroke="#183b6d" strokeWidth="0.5" />
                <line x1="40" y1="23" x2="40" y2="55" stroke="#183b6d" strokeWidth="0.5" />
                <circle cx="28" cy="45" r="2" fill="#183b6d" />
                <circle cx="52" cy="45" r="2" fill="#183b6d" />
                <circle cx="40" cy="55" r="2" fill="#183b6d" />
              </svg>
            </div>

            <div>
              <h1 className="text-4xl md:text-5xl font-serif text-[#183b6d] mb-4">
                Welcome to <span className="italic">Wells AI</span>
              </h1>
              <p className="text-lg text-[#575757] font-light">
                Let's get you connected to the right opportunities
              </p>
            </div>

            <div className="space-y-4 max-w-xl mx-auto">
              <p className="text-sm text-[#9ea1a7] uppercase tracking-widest mb-8">What brings you here?</p>

              <button
                onClick={() => handleUserTypeSelect('buyer')}
                className="w-full px-8 py-6 bg-white border-2 border-[#183b6d]/20 rounded-sm hover:border-[#183b6d] hover:bg-[#183b6d]/5 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#183b6d]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#183b6d]/20 transition-all">
                    <svg className="w-6 h-6 text-[#183b6d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-[#183b6d] mb-1">I'm Buying</h3>
                    <p className="text-sm text-[#575757]">Looking to source products, services, or talent</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleUserTypeSelect('seller')}
                className="w-full px-8 py-6 bg-white border-2 border-[#183b6d]/20 rounded-sm hover:border-[#183b6d] hover:bg-[#183b6d]/5 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#183b6d]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#183b6d]/20 transition-all">
                    <svg className="w-6 h-6 text-[#183b6d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-[#183b6d] mb-1">I'm Selling</h3>
                    <p className="text-sm text-[#575757]">Offering products, services, or expertise</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleUserTypeSelect('both')}
                className="w-full px-8 py-6 bg-white border-2 border-[#183b6d]/20 rounded-sm hover:border-[#183b6d] hover:bg-[#183b6d]/5 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#183b6d]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#183b6d]/20 transition-all">
                    <svg className="w-6 h-6 text-[#183b6d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-[#183b6d] mb-1">Both</h3>
                    <p className="text-sm text-[#575757]">I buy and sell on the marketplace</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleUserTypeSelect('job-seeker')}
                className="w-full px-8 py-6 bg-white border-2 border-[#183b6d]/20 rounded-sm hover:border-[#183b6d] hover:bg-[#183b6d]/5 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#183b6d]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#183b6d]/20 transition-all">
                    <svg className="w-6 h-6 text-[#183b6d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-[#183b6d] mb-1">Seeking Opportunities</h3>
                    <p className="text-sm text-[#575757]">Looking for executive roles or projects</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-serif text-[#183b6d] mb-2">Tell us about yourself</h2>
              <p className="text-sm text-[#575757]">
                {userData.userType === 'buyer' && 'So we can match you with the right sellers'}
                {userData.userType === 'seller' && 'So buyers can find you easily'}
                {userData.userType === 'both' && 'So we can connect you to the right opportunities'}
                {userData.userType === 'job-seeker' && 'So we can match you with the right roles'}
              </p>
            </div>

            <div className="space-y-6 max-w-xl mx-auto">
              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={userData.name || ''}
                  onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={userData.email || ''}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors"
                  placeholder="john@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Phone Number (for SMS notifications)
                </label>
                <input
                  type="tel"
                  value={userData.phone || ''}
                  onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {userData.userType !== 'job-seeker' && (
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={userData.company || ''}
                    onChange={(e) => setUserData({ ...userData, company: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors"
                    placeholder="Acme Corp"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Industry
                </label>
                <select
                  value={userData.industry || ''}
                  onChange={(e) => setUserData({ ...userData, industry: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors"
                >
                  <option value="">Select an industry</option>
                  <option value="semiconductors">Semiconductors & Electronics</option>
                  <option value="executive-talent">Executive Talent & Recruitment</option>
                  <option value="industrial">Industrial Equipment</option>
                  <option value="professional-services">Professional Services</option>
                  <option value="raw-materials">Raw Materials</option>
                  <option value="software">Software & Technology</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-3 bg-white border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545] transition-all"
                >
                  Get Started
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
