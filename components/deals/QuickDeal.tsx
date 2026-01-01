'use client'

/**
 * Quick Deal Component
 *
 * One-shot deal creation for frictionless B2B transactions
 * "Name it, price it, send it" - deal starts immediately
 */

import { useState } from 'react'

interface QuickDealProps {
  counterpartyId?: string
  counterpartyName?: string
  defaultRole?: 'buyer' | 'seller'
  onSuccess?: (deal: any) => void
  onCancel?: () => void
  className?: string
}

export function QuickDeal({
  counterpartyId,
  counterpartyName,
  defaultRole = 'buyer',
  onSuccess,
  onCancel,
  className = '',
}: QuickDealProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form')
  const [deal, setDeal] = useState<any>(null)

  const [form, setForm] = useState({
    counterpartyId: counterpartyId || '',
    title: '',
    description: '',
    amount: '',
    role: defaultRole,
    autoFund: false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.counterpartyId || !form.title || !form.amount) {
      setError('Please fill in all required fields')
      return
    }

    setStep('confirm')
  }

  async function handleConfirm() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/b2b/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterpartyId: form.counterpartyId,
          title: form.title,
          description: form.description,
          amount: parseFloat(form.amount),
          role: form.role,
          autoFund: form.autoFund,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create deal')
      }

      const data = await res.json()
      setDeal(data.deal)
      setStep('success')
      onSuccess?.(data.deal)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deal')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'success' && deal) {
    return (
      <div className={`p-6 rounded-2xl bg-green-500/10 border border-green-500/30 ${className}`}>
        <div className="text-center">
          <div className="text-5xl mb-4">🤝</div>
          <h3 className="text-xl font-bold text-white mb-2">Deal Created!</h3>
          <p className="text-white/60 mb-4">
            ${parseFloat(form.amount).toLocaleString()} deal with {counterpartyName || 'counterparty'}
          </p>
          <div className="p-3 rounded-lg bg-white/5 text-left mb-4">
            <p className="text-sm text-white/60 mb-1">Next step:</p>
            <p className="text-white">{deal.nextStep || 'Awaiting confirmation'}</p>
          </div>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div className={`p-6 rounded-2xl bg-white/5 border border-white/10 ${className}`}>
        <h3 className="text-lg font-semibold text-white mb-4">Confirm Deal</h3>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
            <span className="text-white/60">Title</span>
            <span className="text-white font-medium">{form.title}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
            <span className="text-white/60">Amount</span>
            <span className="text-white font-bold text-lg">${parseFloat(form.amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
            <span className="text-white/60">Your Role</span>
            <span className="text-white capitalize">{form.role}</span>
          </div>
          {counterpartyName && (
            <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
              <span className="text-white/60">{form.role === 'buyer' ? 'Seller' : 'Buyer'}</span>
              <span className="text-white">{counterpartyName}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setStep('form')}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl font-bold text-white transition-colors"
          >
            {loading ? 'Creating...' : 'Yes, Proceed'}
          </button>
        </div>

        <p className="mt-4 text-xs text-white/40 text-center">
          By confirming, you agree to the deal terms. The other party will be notified.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`p-6 rounded-2xl bg-white/5 border border-white/10 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Quick Deal</h3>

      {/* Role Selection */}
      <div className="mb-4">
        <label className="block text-sm text-white/60 mb-2">I am the...</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, role: 'buyer' }))}
            className={`py-3 rounded-xl border transition-colors ${
              form.role === 'buyer'
                ? 'bg-purple-500/20 border-purple-500 text-white'
                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
            }`}
          >
            🛒 Buyer
          </button>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, role: 'seller' }))}
            className={`py-3 rounded-xl border transition-colors ${
              form.role === 'seller'
                ? 'bg-purple-500/20 border-purple-500 text-white'
                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
            }`}
          >
            🏪 Seller
          </button>
        </div>
      </div>

      {/* Counterparty */}
      {!counterpartyId && (
        <div className="mb-4">
          <label className="block text-sm text-white/60 mb-2">
            {form.role === 'buyer' ? 'Seller ID' : 'Buyer ID'} *
          </label>
          <input
            type="text"
            value={form.counterpartyId}
            onChange={e => setForm(f => ({ ...f, counterpartyId: e.target.value }))}
            placeholder="Enter user ID or email"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
          />
        </div>
      )}

      {/* Title */}
      <div className="mb-4">
        <label className="block text-sm text-white/60 mb-2">What's the deal? *</label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g., 1000 widgets, consulting project, software license"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Amount */}
      <div className="mb-4">
        <label className="block text-sm text-white/60 mb-2">Amount (USD) *</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
          <input
            type="number"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="block text-sm text-white/60 mb-2">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Add any details..."
          rows={2}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 resize-none focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Auto-fund option for buyers */}
      {form.role === 'buyer' && (
        <label className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.autoFund}
            onChange={e => setForm(f => ({ ...f, autoFund: e.target.checked }))}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-green-500 focus:ring-green-500"
          />
          <div>
            <p className="text-white text-sm">Auto-fund escrow</p>
            <p className="text-white/40 text-xs">Immediately fund when seller confirms (if trusted)</p>
          </div>
        </label>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold text-white transition-colors"
        >
          Continue →
        </button>
      </div>
    </form>
  )
}

export default QuickDeal
