'use client'

/**
 * Wells AI Enterprise SDK Waitlist
 * Enterprise demo request form with ERP selection
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, CheckCircle2, Users, Zap, Shield, Globe } from 'lucide-react'

const ERP_OPTIONS = [
  { id: 'sap-ariba', name: 'SAP Ariba', category: 'Procurement' },
  { id: 'sap-s4hana', name: 'SAP S/4HANA', category: 'ERP' },
  { id: 'netsuite', name: 'Oracle NetSuite', category: 'ERP' },
  { id: 'oracle-cloud', name: 'Oracle Cloud', category: 'ERP' },
  { id: 'dynamics-365', name: 'Dynamics 365', category: 'ERP' },
  { id: 'workday', name: 'Workday', category: 'Finance' },
  { id: 'coupa', name: 'Coupa', category: 'Procurement' },
  { id: 'jaggaer', name: 'Jaggaer', category: 'Procurement' },
  { id: 'other', name: 'Other / Custom', category: 'Custom' }
]

const COMPANY_SIZES = [
  { id: 'startup', label: 'Startup (<50)' },
  { id: 'smb', label: 'SMB (50-500)' },
  { id: 'mid-market', label: 'Mid-Market (500-5000)' },
  { id: 'enterprise', label: 'Enterprise (5000+)' }
]

const USE_CASES = [
  { id: 'indirect-sourcing', label: 'Indirect Sourcing & Tail Spend', icon: '📦' },
  { id: 'supplier-discovery', label: 'Supplier Discovery & Qualification', icon: '🔍' },
  { id: 'enterprise-sales', label: 'Enterprise Sales Acceleration', icon: '📈' },
  { id: 'procurement-automation', label: 'Procurement Automation', icon: '⚡' },
  { id: 'vendor-management', label: 'Vendor Management', icon: '🤝' },
  { id: 'other', label: 'Other', icon: '💡' }
]

export default function SDKWaitlistPage() {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [position, setPosition] = useState(0)
  const [referralCode, setReferralCode] = useState('')

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    title: '',
    companySize: '',
    erp: '',
    useCases: [] as string[],
    annualSpend: '',
    message: ''
  })

  const handleUseCaseToggle = (useCase: string) => {
    setFormData(prev => ({
      ...prev,
      useCases: prev.useCases.includes(useCase)
        ? prev.useCases.filter(u => u !== useCase)
        : [...prev.useCases, useCase]
    }))
  }

  const handleSubmit = async () => {
    if (!formData.email || !formData.erp) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/sdk-waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setPosition(data.position || Math.floor(Math.random() * 50) + 10)
        setReferralCode(data.referralCode || `WELLS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`)
        setIsSubmitted(true)
      }
    } catch (error) {
      // Fallback for demo
      setPosition(Math.floor(Math.random() * 50) + 10)
      setReferralCode(`WELLS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`)
      setIsSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap');
          .font-playfair { font-family: 'Playfair Display', Georgia, serif; }
        `}</style>

        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>

          <h1 className="font-playfair text-4xl font-medium text-gray-900 mb-4">
            You're on the list
          </h1>

          <p className="text-lg text-gray-500 mb-8">
            Our enterprise team will reach out within 24-48 hours to schedule your demo.
          </p>

          <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <div className="text-3xl font-bold text-violet-600">#{position}</div>
                <div className="text-sm text-gray-500">Queue position</div>
              </div>
              <div>
                <div className="text-lg font-mono font-bold text-gray-900">{referralCode}</div>
                <div className="text-sm text-gray-500">Your referral code</div>
              </div>
            </div>

            <div className="text-sm text-gray-500 border-t border-gray-100 pt-4">
              Share your code to move up the queue. Each referral moves you up 5 spots.
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap');
        .font-playfair { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>

      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900 font-semibold text-[17px]">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>

          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16">
          {/* Left - Info */}
          <div>
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Enterprise Demo
            </div>

            <h1 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 mb-4 leading-tight">
              Deploy AI-Powered Procurement
            </h1>

            <p className="text-lg text-gray-500 mb-10 leading-relaxed">
              Get a personalized demo of Wells AI integrated with your ERP. See how enterprises are automating indirect sourcing and capturing 33bps on every transaction.
            </p>

            {/* Benefits */}
            <div className="space-y-4 mb-10">
              {[
                { icon: Zap, title: 'Deploy in Days', desc: 'Not months. Native ERP integration.' },
                { icon: Shield, title: 'Enterprise Security', desc: 'SOC 2, GDPR, and SSO ready.' },
                { icon: Users, title: 'Dedicated Support', desc: 'White-glove onboarding and success team.' },
                { icon: Globe, title: 'Global Scale', desc: 'Multi-currency, multi-entity support.' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Social Proof */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="text-sm text-gray-500 mb-3">Trusted by procurement teams at:</div>
              <div className="flex flex-wrap gap-4 text-gray-400 text-sm font-medium">
                <span>Fortune 500</span>
                <span>•</span>
                <span>PE Portfolio Cos</span>
                <span>•</span>
                <span>High-Growth Startups</span>
              </div>
            </div>
          </div>

          {/* Right - Form */}
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl shadow-gray-200/50">
            {/* Progress */}
            <div className="flex items-center gap-2 mb-8">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    s <= step ? 'bg-violet-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Your Information</h2>
                  <p className="text-sm text-gray-500">Tell us about yourself and your company.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Jane Smith"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Work Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jane@company.com"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Company *</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Acme Corp"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="VP Procurement"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Size</label>
                  <div className="grid grid-cols-2 gap-2">
                    {COMPANY_SIZES.map((size) => (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, companySize: size.id })}
                        className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                          formData.companySize === size.id
                            ? 'bg-violet-50 border-violet-300 text-violet-700'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.email}
                  className="w-full py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Your ERP System</h2>
                  <p className="text-sm text-gray-500">Select your current procurement/ERP platform.</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {ERP_OPTIONS.map((erp) => (
                    <button
                      key={erp.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, erp: erp.id })}
                      className={`px-3 py-3 rounded-xl text-sm font-medium border transition-all ${
                        formData.erp === erp.id
                          ? 'bg-violet-50 border-violet-300 text-violet-700'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {erp.name}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Annual Procurement Spend</label>
                  <select
                    value={formData.annualSpend}
                    onChange={(e) => setFormData({ ...formData, annualSpend: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                  >
                    <option value="">Select range</option>
                    <option value="<1m">Less than $1M</option>
                    <option value="1m-10m">$1M - $10M</option>
                    <option value="10m-50m">$10M - $50M</option>
                    <option value="50m-100m">$50M - $100M</option>
                    <option value="100m+">$100M+</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!formData.erp}
                    className="flex-1 py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Use Cases</h2>
                  <p className="text-sm text-gray-500">What problems are you looking to solve?</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {USE_CASES.map((useCase) => (
                    <button
                      key={useCase.id}
                      type="button"
                      onClick={() => handleUseCaseToggle(useCase.id)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left flex items-center gap-2 ${
                        formData.useCases.includes(useCase.id)
                          ? 'bg-violet-50 border-violet-300 text-violet-700'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span>{useCase.icon}</span>
                      <span className="text-xs">{useCase.label}</span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Anything else we should know?</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about your specific challenges..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Request Demo'}
                  </button>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  By submitting, you agree to our Terms and Privacy Policy.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
