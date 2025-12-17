'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  DollarSign,
  Percent,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react'

export default function CreateOfferPage() {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    description: '',
    value: '',
    category: '',
    l1: '10',
    l2: '5',
    l3: '3',
    l4: '2',
  })

  const totalCommission = parseFloat(form.l1 || '0') + parseFloat(form.l2 || '0') +
    parseFloat(form.l3 || '0') + parseFloat(form.l4 || '0')

  const handleSubmit = async (e: React.FormEvent, activate = false) => {
    e.preventDefault()
    setError('')

    if (!form.title) {
      setError('Title is required')
      return
    }
    if (!form.value || parseFloat(form.value) <= 0) {
      setError('Deal value must be positive')
      return
    }
    if (totalCommission > 100) {
      setError('Total commission cannot exceed 100%')
      return
    }

    setLoading(true)
    try {
      // Create the offer
      const res = await fetch('/api/attribution/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          value: parseFloat(form.value),
          category: form.category || undefined,
          commissions: {
            l1: parseFloat(form.l1 || '0'),
            l2: parseFloat(form.l2 || '0'),
            l3: parseFloat(form.l3 || '0'),
            l4: parseFloat(form.l4 || '0'),
          },
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to create offer')
        return
      }

      // Optionally activate immediately
      if (activate && json.offer?.id) {
        await fetch(`/api/attribution/offers/${json.offer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'activate' }),
        })
      }

      router.push(`/attribution/offers/${json.offer.id}`)
    } catch {
      setError('Failed to create offer')
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  if (!isSignedIn) {
    router.push('/sign-in')
    return null
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Link
            href="/attribution/offers"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Offers
          </Link>
          <h1 className="text-2xl font-bold">Create Offer</h1>
          <p className="text-gray-400 mt-1">
            Define a high-value deal and set commission rates for your network
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={(e) => handleSubmit(e, false)}>
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-200">{error}</span>
            </div>
          )}

          {/* Basic Info */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
            <h2 className="text-lg font-semibold mb-4">Offer Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Enterprise SaaS Implementation"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the opportunity..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Deal Value (USD) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="number"
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      placeholder="100000"
                      min="0"
                      step="1000"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Select category</option>
                    <option value="saas">SaaS</option>
                    <option value="consulting">Consulting</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="services">Services</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Commission Structure */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Commission Structure</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                totalCommission > 100
                  ? 'bg-red-500/20 text-red-400'
                  : totalCommission > 50
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-green-500/20 text-green-400'
              }`}>
                Total: {totalCommission}%
              </span>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-6">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-200">
                Set the percentage each level in the attribution chain receives when a deal closes.
                L1 is your direct connection, L4 is four degrees away.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'l1', label: 'Level 1 (Direct)', desc: 'Your direct connection' },
                { key: 'l2', label: 'Level 2', desc: '2nd degree connection' },
                { key: 'l3', label: 'Level 3', desc: '3rd degree connection' },
                { key: 'l4', label: 'Level 4', desc: '4th degree connection' },
              ].map((level) => (
                <div key={level.key}>
                  <label className="block text-sm text-gray-400 mb-1">
                    {level.label}
                  </label>
                  <p className="text-xs text-gray-500 mb-2">{level.desc}</p>
                  <div className="relative">
                    <input
                      type="number"
                      value={form[level.key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [level.key]: e.target.value })}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-full pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                    <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  </div>
                </div>
              ))}
            </div>

            {/* Commission Preview */}
            {form.value && parseFloat(form.value) > 0 && (
              <div className="mt-6 p-4 bg-white/5 rounded-lg">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Commission Preview</h3>
                <div className="space-y-2">
                  {[
                    { label: 'L1', pct: form.l1 },
                    { label: 'L2', pct: form.l2 },
                    { label: 'L3', pct: form.l3 },
                    { label: 'L4', pct: form.l4 },
                  ].map((l) => {
                    const amount = parseFloat(form.value) * (parseFloat(l.pct || '0') / 100)
                    return (
                      <div key={l.label} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{l.label}</span>
                        <span className="font-medium">
                          ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create & Activate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
