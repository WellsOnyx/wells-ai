'use client'

import { useState } from 'react'
import { EMPLOYMENT_MODELS, RISK_PROFILES } from '@/lib/employment/models'
import { useRouter } from 'next/navigation'

export default function HROnboarding() {
  const router = useRouter()
  const [step, setStep] = useState<'intro' | 'select' | 'review' | 'sign'>('intro')
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [userData, setUserData] = useState({
    fullName: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    ssn: '',
    entityName: '', // For C2C
    ein: '', // For C2C
    hasLLC: false
  })

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId)
    setStep('review')
  }

  const handleConfirm = async () => {
    if (!selectedModel) return

    // Create employment record in Notion
    try {
      const response = await fetch('/api/hr/create-employment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          ...userData
        })
      })

      const data = await response.json()

      if (data.success) {
        setStep('sign')
      }
    } catch (error) {
      console.error('Failed to create employment record:', error)
    }
  }

  const model = selectedModel ? EMPLOYMENT_MODELS[selectedModel] : null

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-light text-[#183b6d]">
            Wells HR <span className="text-[#575757]">—</span> Employment Onboarding
          </h1>
          <p className="text-sm text-[#575757] mt-2">
            Choose the employment arrangement that works best for you
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Step 1: Intro */}
        {step === 'intro' && (
          <div>
            <h2 className="text-xl font-light text-[#183b6d] mb-6">
              Welcome to Wells Onyx
            </h2>

            <div className="prose prose-sm max-w-none text-[#575757] mb-8">
              <p>
                We offer 5 different employment arrangements so you can choose what works best for your situation:
              </p>

              <ul className="space-y-2">
                <li><strong>W2 with Benefits</strong> — Full employee status with health insurance, 401k, PTO</li>
                <li><strong>W2 Contractor</strong> — W2 tax status without benefits (lower cost, simpler taxes)</li>
                <li><strong>1099 Contractor</strong> — Maximum flexibility, you handle taxes (lowest fees)</li>
                <li><strong>Corp-to-Corp (C2C)</strong> — Your business contracts with us (cleanest separation)</li>
                <li><strong>EOR (Employer of Record)</strong> — Third-party employs you, great for international</li>
              </ul>

              <p className="mt-4">
                Each model has different tradeoffs in terms of flexibility, benefits, taxes, and cost. We'll help you choose the right one.
              </p>
            </div>

            <button
              onClick={() => setStep('select')}
              className="px-6 py-3 bg-[#183b6d] text-white hover:bg-[#183b6d]/90 transition-colors"
            >
              Compare Options →
            </button>
          </div>
        )}

        {/* Step 2: Select Model */}
        {step === 'select' && (
          <div>
            <button
              onClick={() => setStep('intro')}
              className="text-sm text-[#9ea1a7] hover:text-[#183b6d] mb-6"
            >
              ← Back
            </button>

            <h2 className="text-xl font-light text-[#183b6d] mb-8">
              Choose Your Employment Arrangement
            </h2>

            <div className="space-y-6">
              {Object.values(EMPLOYMENT_MODELS).map((employment) => {
                const risk = RISK_PROFILES[employment.id as keyof typeof RISK_PROFILES]

                return (
                  <div
                    key={employment.id}
                    className="border border-[#9ea1a7]/30 p-6 hover:border-[#183b6d] transition-colors cursor-pointer"
                    onClick={() => handleSelectModel(employment.id)}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-[#183b6d]">
                          {employment.name}
                        </h3>
                        <p className="text-sm text-[#575757] mt-1">
                          {employment.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-[#183b6d]">
                          {employment.pricing.platformFee}
                        </div>
                        {employment.pricing.payrollFee && (
                          <div className="text-xs text-[#9ea1a7]">
                            + {employment.pricing.payrollFee}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className={`text-xs px-2 py-1 ${employment.benefits ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {employment.benefits ? '✓ Benefits' : 'No Benefits'}
                      </span>
                      <span className={`text-xs px-2 py-1 ${employment.unemploymentEligible ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        {employment.unemploymentEligible ? 'Unemployment Eligible' : 'No Unemployment Risk'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800">
                        {employment.taxHandling === 'employer_withholds' ? 'Taxes Withheld' : 'You Handle Taxes'}
                      </span>
                    </div>

                    {/* Pros/Cons Grid */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="font-medium text-green-800 mb-2">✓ Pros</div>
                        <ul className="space-y-1 text-[#575757]">
                          {employment.pros.slice(0, 3).map((pro, idx) => (
                            <li key={idx}>• {pro}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium text-red-800 mb-2">✗ Cons</div>
                        <ul className="space-y-1 text-[#575757]">
                          {employment.cons.slice(0, 3).map((con, idx) => (
                            <li key={idx}>• {con}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Best For */}
                    <div className="mt-4 pt-4 border-t border-[#9ea1a7]/20">
                      <div className="text-xs font-medium text-[#183b6d] mb-2">
                        Best for:
                      </div>
                      <div className="text-xs text-[#575757]">
                        {employment.bestFor.slice(0, 2).join(' • ')}
                      </div>
                    </div>

                    {/* Risk Assessment */}
                    {risk && (
                      <div className="mt-4 pt-4 border-t border-[#9ea1a7]/20 text-xs">
                        <div className="font-medium text-[#183b6d] mb-2">Risk Profile:</div>
                        <div className="grid grid-cols-2 gap-2 text-[#575757]">
                          <div>Unemployment: {risk.unemploymentRisk}</div>
                          <div>Misclassification: {risk.misclassificationRisk}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3: Review & Collect Info */}
        {step === 'review' && model && (
          <div>
            <button
              onClick={() => setStep('select')}
              className="text-sm text-[#9ea1a7] hover:text-[#183b6d] mb-6"
            >
              ← Back to options
            </button>

            <h2 className="text-xl font-light text-[#183b6d] mb-2">
              {model.name}
            </h2>
            <p className="text-sm text-[#575757] mb-8">
              Complete your information to proceed
            </p>

            {/* Form */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  value={userData.fullName}
                  onChange={(e) => setUserData({ ...userData, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={userData.address}
                    onChange={(e) => setUserData({ ...userData, address: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={userData.city}
                    onChange={(e) => setUserData({ ...userData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={userData.state}
                    onChange={(e) => setUserData({ ...userData, state: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={userData.zip}
                    onChange={(e) => setUserData({ ...userData, zip: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none"
                  />
                </div>
              </div>

              {(model.id === 'w2-benefits' || model.id === 'w2-no-benefits' || model.id === '1099') && (
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Social Security Number
                  </label>
                  <input
                    type="text"
                    value={userData.ssn}
                    onChange={(e) => setUserData({ ...userData, ssn: e.target.value })}
                    placeholder="XXX-XX-XXXX"
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none"
                  />
                  <p className="text-xs text-[#9ea1a7] mt-1">
                    Required for tax reporting (W-2 or 1099)
                  </p>
                </div>
              )}

              {model.id === 'c2c' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#183b6d] mb-2">
                      Business Entity Name
                    </label>
                    <input
                      type="text"
                      value={userData.entityName}
                      onChange={(e) => setUserData({ ...userData, entityName: e.target.value })}
                      placeholder="Your LLC, Inc, or Corp name"
                      className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#183b6d] mb-2">
                      Employer Identification Number (EIN)
                    </label>
                    <input
                      type="text"
                      value={userData.ein}
                      onChange={(e) => setUserData({ ...userData, ein: e.target.value })}
                      placeholder="XX-XXXXXXX"
                      className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none"
                    />
                  </div>
                </>
              )}

              <button
                onClick={handleConfirm}
                disabled={!userData.fullName || !userData.email}
                className="w-full px-6 py-3 bg-[#183b6d] text-white hover:bg-[#183b6d]/90 transition-colors disabled:bg-[#9ea1a7]/50"
              >
                Review Agreement →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Sign Agreement */}
        {step === 'sign' && model && (
          <div>
            <h2 className="text-xl font-light text-[#183b6d] mb-2">
              Employment Agreement
            </h2>
            <p className="text-sm text-[#575757] mb-8">
              Review and sign your {model.name} agreement
            </p>

            <div className="border border-[#9ea1a7]/30 p-6 max-h-96 overflow-y-auto bg-gray-50 text-sm text-[#575757] mb-6">
              <p className="font-medium text-[#183b6d] mb-4">
                {model.name} Agreement
              </p>

              <p className="mb-4">
                This agreement ("Agreement") is entered into between Wells Onyx LLC ("Company") and {userData.fullName} ("Contractor").
              </p>

              <p className="font-medium mt-6 mb-2">1. Services</p>
              <p className="mb-4">
                Contractor agrees to provide professional services as outlined in project statements of work.
              </p>

              <p className="font-medium mt-6 mb-2">2. Compensation</p>
              <p className="mb-4">
                Platform Fee: {model.pricing.platformFee}<br />
                {model.pricing.payrollFee && `Payroll Processing: ${model.pricing.payrollFee}\n`}
                {model.pricing.benefitsFee && `Benefits: ${model.pricing.benefitsFee}\n`}
              </p>

              <p className="font-medium mt-6 mb-2">3. Tax Status</p>
              <p className="mb-4">
                {model.taxHandling === 'employer_withholds'
                  ? 'Company will withhold federal and state taxes and issue W-2 at year-end.'
                  : 'Contractor is responsible for all tax obligations and will receive 1099-NEC at year-end.'}
              </p>

              {!model.unemploymentEligible && (
                <>
                  <p className="font-medium mt-6 mb-2">4. Unemployment Compensation Waiver</p>
                  <p className="mb-4">
                    Contractor acknowledges this is a project-based engagement and waives any right to claim unemployment benefits.
                    This waiver may not be enforceable in all jurisdictions.
                  </p>
                </>
              )}

              <p className="font-medium mt-6 mb-2">{!model.unemploymentEligible ? '5' : '4'}. Termination</p>
              <p className="mb-4">
                Either party may terminate this Agreement at any time with written notice.
              </p>

              <p className="text-xs text-[#9ea1a7] mt-8">
                This is a simplified summary. Full agreement will be provided via DocuSign.
              </p>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <input
                type="checkbox"
                id="agree"
                className="w-4 h-4"
              />
              <label htmlFor="agree" className="text-sm text-[#575757]">
                I have read and agree to the terms of this {model.name} agreement
              </label>
            </div>

            <button
              className="w-full px-6 py-3 bg-[#183b6d] text-white hover:bg-[#183b6d]/90 transition-colors"
            >
              Sign with DocuSign →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
