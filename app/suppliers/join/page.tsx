'use client'

/**
 * Supplier Sign-Up Page
 * /suppliers/join
 *
 * Simple form for suppliers to join Wells AI marketplace
 */

import { useState } from 'react'
import { ArrowLeft, Check, Building, Mail, Phone, Tag, Award, Loader2 } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = [
  'Meat & Protein',
  'Seafood',
  'Produce',
  'Dairy',
  'Bakery',
  'Beverages',
  'Packaging',
  'Cleaning Supplies',
  'Equipment',
  'Technology',
  'Office Supplies',
  'Other'
]

export default function SupplierJoinPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    categories: [] as string[],
    capabilities: '',
    certifications: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/suppliers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          categories: formData.categories,
          capabilities: formData.capabilities
            ? formData.capabilities.split(',').map(s => s.trim())
            : [],
          certifications: formData.certifications
            ? formData.certifications.split(',').map(s => s.trim())
            : []
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register')
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">You're In!</h1>
          <p className="text-gray-400 mb-8">
            Welcome to Wells AI, {formData.name}. We'll send quote requests to {formData.email} when buyers need products in your categories.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Join Wells AI Marketplace</h1>
            <p className="text-sm text-gray-400">Start receiving quote requests from buyers</p>
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Company Info */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-500" />
              Company Information
            </h2>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Company Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your company name"
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="quotes@yourcompany.com"
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-500" />
              Product Categories *
            </h2>
            <p className="text-sm text-gray-400">Select all categories you can supply</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryToggle(category)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    formData.categories.includes(category)
                      ? 'bg-amber-500 text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Capabilities */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Additional Information
            </h2>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Capabilities (comma-separated)
              </label>
              <input
                type="text"
                value={formData.capabilities}
                onChange={e => setFormData(prev => ({ ...prev, capabilities: e.target.value }))}
                placeholder="Nationwide delivery, Same-day shipping, Custom cuts"
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Certifications (comma-separated)
              </label>
              <input
                type="text"
                value={formData.certifications}
                onChange={e => setFormData(prev => ({ ...prev, certifications: e.target.value }))}
                placeholder="USDA, Organic, Halal, Kosher"
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || formData.categories.length === 0}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black py-4 rounded-lg font-bold text-lg hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Registering...
              </>
            ) : (
              'Join Wells AI'
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            By joining, you agree to receive quote request emails from Wells AI buyers.
          </p>
        </form>
      </div>
    </div>
  )
}
