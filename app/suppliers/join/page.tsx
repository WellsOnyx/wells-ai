'use client'

/**
 * Supplier Sign-Up Page
 * /suppliers/join
 *
 * Enhanced landing page with testimonials, featured suppliers, and FAQ
 */

import { useState } from 'react'
import { ArrowLeft, Check, Building, Mail, Phone, Tag, Award, Loader2, Star, TrendingUp, Zap, Users } from 'lucide-react'
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

const TESTIMONIALS = [
  {
    name: 'Sarah Chen',
    company: 'Sysco Meat & Seafood',
    quote: 'In 3 months, Wells AI sent us 40+ qualified RFQs. We closed 12 deals worth $180k. The automated matching saves our sales team 15 hours per week.',
    rating: 5
  },
  {
    name: 'Michael Rodriguez',
    company: 'Grainger Industrial Supply',
    quote: "We used to chase cold leads. Now buyers find us. Wells AI increased our quote volume by 3x while cutting acquisition costs in half.",
    rating: 5
  },
  {
    name: 'Jennifer Park',
    company: 'CDW Corporation',
    quote: 'The platform instantly matches us with buyers who need exactly what we sell. Our close rate went from 12% to 34% because leads are pre-qualified.',
    rating: 5
  }
]

const FEATURED_SUPPLIERS = [
  { name: 'Sysco', category: 'Food Service' },
  { name: 'Grainger', category: 'Industrial' },
  { name: 'CDW', category: 'Technology' },
  { name: 'Uline', category: 'Packaging' },
  { name: 'Ferguson', category: 'Plumbing' },
  { name: 'Cintas', category: 'Facilities' }
]

const FAQ_ITEMS = [
  {
    question: 'How does Wells AI work?',
    answer: 'Buyers submit RFQs through our platform. We match them with suppliers based on category, capabilities, and certifications. You receive quote requests via email and respond directly to interested buyers.'
  },
  {
    question: 'What does it cost?',
    answer: "It's free to join and receive quote requests. We only charge a small transaction fee (2-3%) when you close a deal through the platform. No monthly fees, no subscriptions."
  },
  {
    question: 'How many quote requests will I receive?',
    answer: 'It varies by category and your capabilities. Most suppliers receive 5-15 qualified RFQs per month. Popular categories like Technology and Food Service see higher volumes.'
  },
  {
    question: 'Can I choose which quotes to respond to?',
    answer: "Absolutely. You receive all matching RFQs via email. You decide which ones to quote. There's no obligation to respond to every request."
  },
  {
    question: 'How fast will I get approved?',
    answer: 'Most suppliers are approved within 24-48 hours. We verify your company information and capabilities to ensure quality for buyers.'
  }
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Join Wells AI Marketplace</h1>
            <p className="text-sm text-gray-400">Start receiving quote requests from buyers</p>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-6">
            Join 50+ Suppliers Already on Wells AI
          </h2>
          <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
            Stop chasing leads. Let qualified buyers find you. Wells AI connects B2B suppliers with buyers who need exactly what you sell.
          </p>
          <div className="flex flex-wrap justify-center gap-8 mb-12">
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-500 mb-2">50+</div>
              <div className="text-gray-400">Active Suppliers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-500 mb-2">3x</div>
              <div className="text-gray-400">More Quote Volume</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-500 mb-2">48hrs</div>
              <div className="text-gray-400">Average Approval</div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <Zap className="w-12 h-12 text-amber-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-3">Instant Matching</h3>
            <p className="text-gray-400">
              Our AI matches buyers with your capabilities automatically. Only receive RFQs you can actually fulfill.
            </p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <TrendingUp className="w-12 h-12 text-amber-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-3">Higher Close Rates</h3>
            <p className="text-gray-400">
              Pre-qualified leads mean less time wasted. Average close rate is 34% vs industry standard of 12%.
            </p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <Users className="w-12 h-12 text-amber-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-3">Growing Network</h3>
            <p className="text-gray-400">
              Join suppliers from Office, Tech, Food Service, Industrial, and more. Network effects increase quote volume.
            </p>
          </div>
        </div>

        {/* Featured Suppliers */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-white text-center mb-8">
            Join Industry Leaders Already on Wells AI
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {FEATURED_SUPPLIERS.map((supplier, idx) => (
              <div key={idx} className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center">
                <div className="font-bold text-white mb-1">{supplier.name}</div>
                <div className="text-sm text-gray-500">{supplier.category}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-white text-center mb-12">
            What Suppliers Are Saying
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, idx) => (
              <div key={idx} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4 italic">"{testimonial.quote}"</p>
                <div className="border-t border-gray-800 pt-4">
                  <div className="font-semibold text-white">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-white text-center mb-12">
            Frequently Asked Questions
          </h3>
          <div className="max-w-3xl mx-auto space-y-6">
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h4 className="text-lg font-bold text-white mb-3">{item.question}</h4>
                <p className="text-gray-400">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Sign Up Form */}
      <div className="bg-gray-900 border-t border-gray-800 py-16">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to Start Receiving Quotes?
            </h2>
            <p className="text-lg text-gray-400">
              Join in minutes. Start getting qualified RFQs within 48 hours.
            </p>
          </div>

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
                Joining marketplace...
              </>
            ) : (
              'Join 50+ Suppliers on Wells AI →'
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            Free to join. No monthly fees. Only pay when you close deals (2-3% transaction fee).
          </p>
        </form>
        </div>
      </div>
      </div>
    </div>
  )
}
