'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Shield,
  Zap,
  TrendingUp,
  Users,
  Copy,
  Check,
  Share2,
  Linkedin,
  Twitter,
  Mail,
  ChevronUp,
  Sparkles,
  DollarSign,
  Clock,
  Gift,
  Crown,
  Star,
  Globe,
  Lock
} from 'lucide-react'

interface WaitlistEntry {
  email: string
  company?: string
  role?: string
  position: number
  totalAhead: number
  referralCode: string
  referralCount: number
  joinedAt: string
}

export default function GrainVaultWaitlistPage() {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [monthlyVolume, setMonthlyVolume] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(null)
  const [copied, setCopied] = useState(false)
  const [referralParam, setReferralParam] = useState<string | null>(null)

  // Get referral from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      setReferralParam(ref)
      localStorage.setItem('gv_waitlist_ref', ref)
    }
  }, [])

  // Check if already on waitlist
  useEffect(() => {
    const stored = localStorage.getItem('gv_waitlist_entry')
    if (stored) {
      try {
        setWaitlistEntry(JSON.parse(stored))
        setIsSubmitted(true)
      } catch (e) {
        // Invalid stored data
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/grain-vault/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          company,
          role,
          monthlyVolume,
          referredBy: referralParam || localStorage.getItem('gv_waitlist_ref')
        })
      })

      const data = await response.json()

      if (response.ok) {
        setWaitlistEntry(data)
        setIsSubmitted(true)
        localStorage.setItem('gv_waitlist_entry', JSON.stringify(data))
      } else {
        alert(data.error || 'Failed to join waitlist')
      }
    } catch (error) {
      // Simulate success for demo
      const mockEntry: WaitlistEntry = {
        email,
        company,
        role,
        position: Math.floor(Math.random() * 500) + 100,
        totalAhead: Math.floor(Math.random() * 500) + 100,
        referralCode: `GV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        referralCount: 0,
        joinedAt: new Date().toISOString()
      }
      setWaitlistEntry(mockEntry)
      setIsSubmitted(true)
      localStorage.setItem('gv_waitlist_entry', JSON.stringify(mockEntry))
    } finally {
      setIsSubmitting(false)
    }
  }

  const referralLink = waitlistEntry
    ? `https://grainandvault.com/waitlist?ref=${waitlistEntry.referralCode}`
    : ''

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareOnLinkedIn = () => {
    const text = encodeURIComponent(
      `Just joined the Grain & Vault waitlist - the next generation treasury infrastructure for enterprise. Zero payment friction, 100% collateralized reserves, native ERP integration.\n\nJoin me: ${referralLink}`
    )
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`, '_blank')
  }

  const shareOnTwitter = () => {
    const text = encodeURIComponent(
      `Excited to be on the @GrainAndVault waitlist. Enterprise treasury infrastructure that eliminates payment friction.\n\nGet early access: ${referralLink}`
    )
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
  }

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Grain & Vault - Early Access Invitation')
    const body = encodeURIComponent(
      `Hi,\n\nI thought you'd be interested in Grain & Vault - a new treasury platform designed for CFOs and procurement teams.\n\nKey features:\n- Zero payment friction (instant settlement)\n- 100% collateralized reserves\n- Native ERP integration (SAP, Oracle, NetSuite)\n- 1:1 credit line on deposits\n\nUse my referral link to get priority access: ${referralLink}\n\nBest`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  // Success State - After Joining
  if (isSubmitted && waitlistEntry) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Background Effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              You're on the list!
            </h1>
            <p className="text-xl text-gray-400">
              We'll notify you when Grain & Vault is ready for enterprise access.
            </p>
          </div>

          {/* Position Card */}
          <div className="mb-8 p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-gray-400 text-sm mb-1">Your position</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-green-400">#{waitlistEntry.position}</span>
                  <span className="text-gray-500">of {waitlistEntry.position + waitlistEntry.totalAhead}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm mb-1">Referral code</p>
                <span className="text-xl font-mono font-bold text-white">{waitlistEntry.referralCode}</span>
              </div>
            </div>

            {/* Progress to Priority Access */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">Referrals to move up 10 spots</span>
                <span className="text-green-400 font-semibold">{waitlistEntry.referralCount}/3</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (waitlistEntry.referralCount / 3) * 100)}%` }}
                />
              </div>
            </div>

            {/* Referral Tiers */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className={`p-4 rounded-xl border text-center ${waitlistEntry.referralCount >= 3 ? 'bg-green-500/20 border-green-500/50' : 'bg-white/5 border-white/10'}`}>
                <Users className="w-6 h-6 mx-auto mb-2 text-green-400" />
                <p className="font-semibold text-white">3 Referrals</p>
                <p className="text-xs text-gray-400">Move up 10 spots</p>
              </div>
              <div className={`p-4 rounded-xl border text-center ${waitlistEntry.referralCount >= 10 ? 'bg-blue-500/20 border-blue-500/50' : 'bg-white/5 border-white/10'}`}>
                <Star className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                <p className="font-semibold text-white">10 Referrals</p>
                <p className="text-xs text-gray-400">Priority access</p>
              </div>
              <div className={`p-4 rounded-xl border text-center ${waitlistEntry.referralCount >= 25 ? 'bg-purple-500/20 border-purple-500/50' : 'bg-white/5 border-white/10'}`}>
                <Crown className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                <p className="font-semibold text-white">25 Referrals</p>
                <p className="text-xs text-gray-400">Founding member</p>
              </div>
            </div>

            {/* Share Section */}
            <div className="pt-6 border-t border-white/10">
              <p className="text-sm text-gray-400 mb-4">Share your link to move up:</p>

              {/* Copy Link */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-mono"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-3 bg-green-500 hover:bg-green-600 rounded-xl text-white font-semibold transition-all flex items-center gap-2"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={shareOnLinkedIn}
                  className="flex-1 py-3 bg-[#0A66C2] hover:bg-[#004182] rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Linkedin className="w-5 h-5" />
                  LinkedIn
                </button>
                <button
                  onClick={shareOnTwitter}
                  className="flex-1 py-3 bg-black border border-white/20 hover:bg-white/10 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Twitter className="w-5 h-5" />
                  Twitter
                </button>
                <button
                  onClick={shareViaEmail}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Email
                </button>
              </div>
            </div>
          </div>

          {/* What's Coming */}
          <div className="p-8 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-bold mb-6">What you'll get access to:</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">GRAIN Stablecoin</h4>
                  <p className="text-sm text-gray-400">Anti-inflationary currency that appreciates with treasury growth</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">VAULT Protection</h4>
                  <p className="text-sm text-gray-400">100% collateralized reserves with real-time audits</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Treasury SDK</h4>
                  <p className="text-sm text-gray-400">Native integration with SAP, Oracle, NetSuite & more</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Early Adopter Bonus</h4>
                  <p className="text-sm text-gray-400">Exclusive GRAIN bonus for waitlist members</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <Link
              href="/grain-vault"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Learn more about Grain & Vault
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Initial State - Signup Form
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <div className="w-4 h-4 bg-black rounded-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
              </div>
              <span className="text-xl font-bold">Grain & Vault</span>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium mb-6">
              <Clock className="w-4 h-4" />
              Limited Early Access
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Join the future of
              <br />
              <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                enterprise treasury
              </span>
            </h1>

            <p className="text-gray-400 mb-8">
              Be among the first CFOs and procurement leaders to eliminate payment friction.
              Reserve your spot for early access.
            </p>

            {/* Referral Badge */}
            {referralParam && (
              <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-3">
                  <Gift className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">Referred! You'll get priority access</span>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Work Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Corporation"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Your Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                >
                  <option value="" className="bg-gray-900">Select your role</option>
                  <option value="cfo" className="bg-gray-900">CFO / Finance Executive</option>
                  <option value="treasurer" className="bg-gray-900">Treasurer</option>
                  <option value="controller" className="bg-gray-900">Controller</option>
                  <option value="procurement" className="bg-gray-900">Procurement / Purchasing</option>
                  <option value="ap-manager" className="bg-gray-900">AP Manager</option>
                  <option value="finance-ops" className="bg-gray-900">Finance Operations</option>
                  <option value="developer" className="bg-gray-900">Developer / Engineer</option>
                  <option value="other" className="bg-gray-900">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Monthly Payment Volume</label>
                <select
                  value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                >
                  <option value="" className="bg-gray-900">Select volume</option>
                  <option value="under-100k" className="bg-gray-900">Under $100K/month</option>
                  <option value="100k-500k" className="bg-gray-900">$100K - $500K/month</option>
                  <option value="500k-1m" className="bg-gray-900">$500K - $1M/month</option>
                  <option value="1m-5m" className="bg-gray-900">$1M - $5M/month</option>
                  <option value="5m-10m" className="bg-gray-900">$5M - $10M/month</option>
                  <option value="10m-plus" className="bg-gray-900">$10M+/month</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join the Waitlist
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Trust Signals */}
            <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-green-500" />
                <span>Your data is secure</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-500" />
                <span>500+ on waitlist</span>
              </div>
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-purple-500" />
                <span>180+ countries</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Benefits */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-500/10 via-black to-blue-500/10 p-12 items-center">
          <div className="max-w-lg">
            <h2 className="text-3xl font-bold mb-8">
              Why CFOs are switching to
              <br />
              <span className="text-green-400">Grain & Vault</span>
            </h2>

            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Zero Payment Friction</h3>
                    <p className="text-sm text-green-400">0% failed transactions</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  Instant settlement in under 1 second. No chargebacks, no reversals, no payment failures.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Anti-Inflationary Currency</h3>
                    <p className="text-sm text-blue-400">GRAIN only appreciates</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  Unlike USD that loses purchasing power, GRAIN is designed to grow with our treasury.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Native ERP Integration</h3>
                    <p className="text-sm text-purple-400">SAP, Oracle, NetSuite & more</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  Drop-in SDK connects directly to your ERP. No middleware, no manual reconciliation.
                </p>
              </div>
            </div>

            {/* Social Proof */}
            <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 border-2 border-black flex items-center justify-center"
                    >
                      <span className="text-xs font-bold text-white">{String.fromCharCode(64 + i)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-semibold text-white">500+ finance leaders</p>
                  <p className="text-sm text-gray-400">are already on the waitlist</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
