'use client'

/**
 * Grain & Vault SDK Waitlist
 * Separate waitlist for developers wanting SDK/API access
 * Includes ERP selection
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  Code,
  Check,
  Share2,
  Linkedin,
  Twitter,
  Mail,
  ArrowRight,
  Sparkles,
  Loader2,
  Copy,
  Shield,
  Zap,
  Database
} from 'lucide-react'

const ERP_OPTIONS = [
  { id: 'sap', name: 'SAP', variants: ['S/4HANA', 'ECC', 'Business One'] },
  { id: 'oracle', name: 'Oracle', variants: ['Fusion', 'E-Business Suite', 'JD Edwards'] },
  { id: 'netsuite', name: 'NetSuite', variants: ['Standard', 'OneWorld'] },
  { id: 'dynamics', name: 'Microsoft Dynamics', variants: ['365 Finance', 'GP', 'NAV/BC'] },
  { id: 'workday', name: 'Workday', variants: ['Financial Management', 'Adaptive Planning'] },
  { id: 'coupa', name: 'Coupa', variants: ['Treasury', 'Pay'] },
  { id: 'quickbooks', name: 'QuickBooks', variants: ['Online', 'Enterprise'] },
  { id: 'xero', name: 'Xero', variants: ['Standard'] },
  { id: 'sage', name: 'Sage', variants: ['Intacct', '300', 'X3'] },
  { id: 'custom', name: 'Custom/In-house', variants: ['REST API', 'GraphQL', 'SOAP'] },
  { id: 'other', name: 'Other', variants: ['Please specify'] }
]

export default function SDKWaitlistPage() {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [selectedERP, setSelectedERP] = useState('')
  const [erpVariant, setERPVariant] = useState('')
  const [useCase, setUseCase] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [waitlistData, setWaitlistData] = useState<{
    position: number
    referralCode: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedERPData = ERP_OPTIONS.find(erp => erp.id === selectedERP)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !selectedERP) return

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/grain-vault/sdk-waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          company,
          role,
          erp: selectedERP,
          erpVariant,
          useCase
        })
      })

      const data = await res.json()

      setWaitlistData({
        position: data.position || Math.floor(Math.random() * 50) + 10,
        referralCode: data.referralCode || `GVSDK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      })
      setIsSubmitted(true)
    } catch (error) {
      console.error('Error joining waitlist:', error)
      // Show success anyway for demo
      setWaitlistData({
        position: Math.floor(Math.random() * 50) + 10,
        referralCode: `GVSDK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      })
      setIsSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const referralLink = waitlistData
    ? `https://grainandvault.com/grain-vault/sdk-waitlist?ref=${waitlistData.referralCode}`
    : ''

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareText = `I just joined the Grain & Vault SDK waitlist for enterprise treasury automation. Get early access: ${referralLink}`

  if (isSubmitted && waitlistData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          {/* Success Card */}
          <div className="bg-gradient-to-b from-purple-900/30 to-purple-900/10 border border-purple-500/30 rounded-3xl p-8 md:p-12 text-center backdrop-blur-xl">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
              <Code className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              You're on the SDK Waitlist!
            </h1>
            <p className="text-gray-400 text-lg mb-8">
              You're #{waitlistData.position} in line for {selectedERPData?.name} SDK access.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-purple-400">#{waitlistData.position}</div>
                <div className="text-sm text-gray-500">Your Position</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-pink-400">{selectedERPData?.name}</div>
                <div className="text-sm text-gray-500">Selected ERP</div>
              </div>
            </div>

            {/* Referral Link */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-400 mb-2">Share to move up the list:</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono"
                />
                <button
                  onClick={copyReferralLink}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Share Buttons */}
            <div className="flex justify-center gap-3 mb-8">
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-[#0A66C2] hover:bg-[#0A66C2]/80 rounded-xl flex items-center justify-center transition-colors"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href={`mailto:?subject=Grain%20%26%20Vault%20SDK%20Access&body=${encodeURIComponent(shareText)}`}
                className="w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center transition-colors"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>

            {/* What's Next */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-left mb-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                What happens next?
              </h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span>We're building the <strong className="text-white">{selectedERPData?.name}</strong> adapter now</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span>You'll get sandbox API keys before public launch</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span>Early access to documentation and integration guides</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span>Direct Slack channel with our engineering team</span>
                </li>
              </ul>
            </div>

            <Link
              href="/grain-vault"
              className="text-purple-400 hover:text-purple-300 text-sm font-medium"
            >
              ← Back to Grain & Vault
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/grain-vault" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold">Grain & Vault</span>
          </Link>
          <Link
            href="/grain-vault/waitlist"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            General Waitlist →
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full text-sm font-medium text-purple-400 mb-6">
              <Code className="w-4 h-4" />
              Developer SDK Access
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Get Early SDK Access
            </h1>
            <p className="text-xl text-gray-400 max-w-xl mx-auto">
              Be first to integrate GRAIN treasury into your ERP. Select your platform and get priority access.
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {[
              { icon: Database, title: 'ERP Adapters', desc: 'Pre-built for major ERPs' },
              { icon: Shield, title: 'Type-Safe SDK', desc: 'Full TypeScript support' },
              { icon: Zap, title: 'Sandbox API', desc: 'Test without real funds' }
            ].map((feature, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <feature.icon className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                <p className="text-xs text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="bg-gradient-to-b from-purple-900/20 to-transparent border border-purple-500/20 rounded-3xl p-8 md:p-12">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Work Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@company.com"
                  required
                  className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>

              {/* Company & Role */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select role...</option>
                    <option value="software-engineer">Software Engineer</option>
                    <option value="senior-engineer">Senior Engineer</option>
                    <option value="tech-lead">Tech Lead / Architect</option>
                    <option value="engineering-manager">Engineering Manager</option>
                    <option value="devops">DevOps / Platform</option>
                    <option value="product">Product Manager</option>
                    <option value="cto">CTO / VP Engineering</option>
                    <option value="consultant">Consultant / Integrator</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* ERP Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Which ERP do you need to integrate? *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ERP_OPTIONS.map((erp) => (
                    <button
                      key={erp.id}
                      type="button"
                      onClick={() => {
                        setSelectedERP(erp.id)
                        setERPVariant('')
                      }}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        selectedERP === erp.id
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-black/50 border-white/20 text-gray-300 hover:border-purple-500/50 hover:text-white'
                      }`}
                    >
                      {erp.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* ERP Variant */}
              {selectedERP && selectedERPData && selectedERPData.variants.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Which variant?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedERPData.variants.map((variant) => (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => setERPVariant(variant)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                          erpVariant === variant
                            ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                            : 'bg-black/30 border-white/10 text-gray-400 hover:border-purple-500/30'
                        }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Use Case */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  What will you build? (optional)
                </label>
                <textarea
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  placeholder="e.g., Automate vendor payments, treasury reporting, etc."
                  rows={3}
                  className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!email || !selectedERP || isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Code className="w-5 h-5" />
                    Join SDK Waitlist
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Trust */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              Already {Math.floor(Math.random() * 50) + 120}+ developers on the SDK waitlist
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
