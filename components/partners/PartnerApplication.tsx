'use client'

/**
 * Partner Application Form
 *
 * Allows users to apply for the affiliate/referral program
 */

import { useState } from 'react'
import { PartnerType } from '@/lib/partners/types'

interface Props {
  onSuccess?: () => void
  className?: string
}

export function PartnerApplication({ onSuccess, className = '' }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    website: '',
    partnerType: 'affiliate' as PartnerType,
    audienceSize: '',
    audienceDescription: '',
    promotionMethods: [] as string[],
    monthlyTraffic: '',
    existingPartnerships: '',
  })

  const promotionOptions = [
    { id: 'blog', label: 'Blog/Content' },
    { id: 'email', label: 'Email List' },
    { id: 'social', label: 'Social Media' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'podcast', label: 'Podcast' },
    { id: 'paid_ads', label: 'Paid Ads' },
    { id: 'community', label: 'Community/Forum' },
    { id: 'consulting', label: 'Consulting/Agency' },
  ]

  const audienceSizes = [
    { id: '0-1k', label: '0 - 1,000' },
    { id: '1k-10k', label: '1,000 - 10,000' },
    { id: '10k-50k', label: '10,000 - 50,000' },
    { id: '50k-100k', label: '50,000 - 100,000' },
    { id: '100k+', label: '100,000+' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/partners/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          monthlyTraffic: form.monthlyTraffic ? parseInt(form.monthlyTraffic) : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit application')
      }

      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  function togglePromotion(id: string) {
    setForm(prev => ({
      ...prev,
      promotionMethods: prev.promotionMethods.includes(id)
        ? prev.promotionMethods.filter(m => m !== id)
        : [...prev.promotionMethods, id],
    }))
  }

  if (success) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Application Submitted!</h3>
        <p className="text-white/60">
          We'll review your application and get back to you within 1-2 business days.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {/* Partner Type */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Partner Type *
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: 'affiliate', label: 'Affiliate', desc: 'Earn per referral' },
            { id: 'reseller', label: 'Reseller', desc: 'Sell to your clients' },
            { id: 'agency', label: 'Agency', desc: 'Manage clients' },
            { id: 'strategic', label: 'Strategic', desc: 'Deep integration' },
          ].map(type => (
            <button
              key={type.id}
              type="button"
              onClick={() => setForm(prev => ({ ...prev, partnerType: type.id as PartnerType }))}
              className={`p-3 rounded-xl border text-left transition-colors ${
                form.partnerType === type.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <p className="font-medium text-white">{type.label}</p>
              <p className="text-xs text-white/40">{type.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Contact Info */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Your Name *
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-purple-500 focus:outline-none"
            placeholder="John Smith"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Email *
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-purple-500 focus:outline-none"
            placeholder="john@company.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Phone
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-purple-500 focus:outline-none"
            placeholder="+1 (555) 000-0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Company Name
          </label>
          <input
            type="text"
            value={form.companyName}
            onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-purple-500 focus:outline-none"
            placeholder="Your Company"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Website
        </label>
        <input
          type="url"
          value={form.website}
          onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-purple-500 focus:outline-none"
          placeholder="https://yourwebsite.com"
        />
      </div>

      {/* Audience Info */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Audience Size
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {audienceSizes.map(size => (
            <button
              key={size.id}
              type="button"
              onClick={() => setForm(prev => ({ ...prev, audienceSize: size.id }))}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                form.audienceSize === size.id
                  ? 'border-purple-500 bg-purple-500/10 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Describe Your Audience
        </label>
        <textarea
          value={form.audienceDescription}
          onChange={e => setForm(prev => ({ ...prev, audienceDescription: e.target.value }))}
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-purple-500 focus:outline-none resize-none"
          placeholder="Who is your audience? What industries, roles, or interests do they have?"
        />
      </div>

      {/* Promotion Methods */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          How Will You Promote?
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {promotionOptions.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => togglePromotion(option.id)}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                form.promotionMethods.includes(option.id)
                  ? 'border-purple-500 bg-purple-500/10 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Existing Partnerships
        </label>
        <textarea
          value={form.existingPartnerships}
          onChange={e => setForm(prev => ({ ...prev, existingPartnerships: e.target.value }))}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-purple-500 focus:outline-none resize-none"
          placeholder="List any current affiliate/partner relationships you have"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 px-6 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl font-semibold text-white transition-colors"
      >
        {loading ? 'Submitting...' : 'Submit Application'}
      </button>

      <p className="text-white/40 text-xs text-center">
        By applying, you agree to our Partner Terms and Conditions.
      </p>
    </form>
  )
}

export default PartnerApplication
