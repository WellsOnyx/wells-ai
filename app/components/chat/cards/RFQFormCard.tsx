/**
 * RFQ Form Card - Submit Request for Quote inline
 * Allows users to create procurement requests directly in chat
 */

'use client'

import { useState } from 'react'

interface RFQFormCardProps {
  data: {
    prefillDescription?: string
    prefillCategory?: string
    prefillBudget?: { min: number; max: number }
    onSubmit?: (rfq: any) => void
  }
}

export default function RFQFormCard({ data }: RFQFormCardProps) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    description: data.prefillDescription || '',
    category: data.prefillCategory || '',
    budgetMin: data.prefillBudget?.min?.toString() || '',
    budgetMax: data.prefillBudget?.max?.toString() || '',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    requirements: [''],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate form
      if (!formData.description.trim()) {
        throw new Error('Please describe what you need')
      }

      if (!formData.category) {
        throw new Error('Please select a category')
      }

      // Filter out empty requirements
      const requirements = formData.requirements.filter(r => r.trim().length > 0)

      // Build RFQ payload
      const rfqPayload = {
        description: formData.description,
        category: formData.category,
        requirements,
        budget: formData.budgetMin && formData.budgetMax ? {
          min: parseInt(formData.budgetMin),
          max: parseInt(formData.budgetMax),
          currency: 'USD'
        } : undefined,
        deadline: formData.deadline,
      }

      // For now, just call the onSubmit callback
      // In future: POST to /api/rfqs/create
      if (data.onSubmit) {
        data.onSubmit(rfqPayload)
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Failed to submit RFQ')
    } finally {
      setLoading(false)
    }
  }

  const addRequirement = () => {
    setFormData(prev => ({
      ...prev,
      requirements: [...prev.requirements, '']
    }))
  }

  const updateRequirement = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.map((req, i) => i === index ? value : req)
    }))
  }

  const removeRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }))
  }

  if (submitted) {
    return (
      <div className="border border-green-200 rounded-lg p-6 bg-green-50 shadow-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="font-semibold text-lg text-green-900">RFQ Submitted Successfully!</h3>
            <p className="text-sm text-green-700 mt-1">
              I'm now matching you with suppliers who can fulfill your request.
              You'll see supplier quotes in just a moment...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-md max-w-2xl">
      <div className="flex items-center mb-4">
        <span className="text-2xl mr-2">📋</span>
        <h3 className="font-semibold text-lg">Request for Quote</h3>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Fill out the details below and I'll find the best suppliers for you.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            What do you need? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., 500 custom circuit boards with specific requirements..."
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select a category</option>
            <option value="Electronics">Electronics</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="IT Services">IT Services</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Marketing">Marketing</option>
            <option value="Professional Services">Professional Services</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Requirements */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Requirements (optional)
          </label>
          <div className="space-y-2">
            {formData.requirements.map((req, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={req}
                  onChange={(e) => updateRequirement(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`Requirement ${index + 1}`}
                />
                {formData.requirements.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRequirement(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addRequirement}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            + Add requirement
          </button>
        </div>

        {/* Budget Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Min ($)
            </label>
            <input
              type="number"
              value={formData.budgetMin}
              onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="5000"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Max ($)
            </label>
            <input
              type="number"
              value={formData.budgetMax}
              onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="10000"
              min="0"
            />
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Response Deadline
          </label>
          <input
            type="date"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? 'Finding Suppliers...' : 'Get Supplier Quotes'}
        </button>
      </form>

      <p className="text-xs text-gray-500 mt-4">
        ✓ Suppliers are matched based on your requirements<br />
        ✓ All quotes are reviewed before sending<br />
        ✓ You'll receive responses within the deadline
      </p>
    </div>
  )
}
