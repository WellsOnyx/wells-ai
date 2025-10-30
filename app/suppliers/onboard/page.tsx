'use client'

import { useState } from 'react'

interface SupplierFormData {
  companyName: string
  email: string
  phone: string
  website: string
  categories: string[]
  capabilities: string[]
  certifications: string[]
  minOrderValue: string
  typicalLeadTime: string
  description: string
}

export default function SupplierOnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [formData, setFormData] = useState<SupplierFormData>({
    companyName: '',
    email: '',
    phone: '',
    website: '',
    categories: [],
    capabilities: [],
    certifications: [],
    minOrderValue: '',
    typicalLeadTime: '',
    description: '',
  })

  const [categoryInput, setCategoryInput] = useState('')
  const [capabilityInput, setCapabilityInput] = useState('')
  const [certificationInput, setCertificationInput] = useState('')

  const totalSteps = 4

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)

    try {
      const response = await fetch('/api/suppliers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setSubmitted(true)
      } else {
        alert('Error submitting form. Please try again.')
      }
    } catch (error) {
      console.error('Submission error:', error)
      alert('Error submitting form. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function addItem(type: 'categories' | 'capabilities' | 'certifications', value: string) {
    if (!value.trim()) return

    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], value.trim()],
    }))

    // Clear input
    if (type === 'categories') setCategoryInput('')
    if (type === 'capabilities') setCapabilityInput('')
    if (type === 'certifications') setCertificationInput('')
  }

  function removeItem(type: 'categories' | 'capabilities' | 'certifications', index: number) {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }))
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Wells AI!</h2>
          <p className="text-gray-600 mb-6">
            Your application has been submitted. We'll review your information and activate your
            account within 24 hours.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>What's Next:</strong>
              <br />
              1. We'll verify your information
              <br />
              2. Add you to our supplier network
              <br />
              3. Send your login credentials
              <br />
              4. Start receiving RFQs!
            </p>
          </div>

          <button
            onClick={() => (window.location.href = '/')}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Back to Homepage
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Join Wells AI Network</h1>
          <p className="text-lg text-gray-600">
            Connect with buyers looking for suppliers like you
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    s <= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s}
                </div>
                {s < totalSteps && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      s < step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Company Info</span>
            <span>Categories</span>
            <span>Capabilities</span>
            <span>Review</span>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Company Info */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Company Information</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, companyName: e.target.value }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Manufacturing Inc."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, email: e.target.value }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="contact@acme.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, website: e.target.value }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://acme.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, description: e.target.value }))
                    }
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tell us about your company, what you manufacture, your experience..."
                  />
                </div>
              </div>
            )}

            {/* Step 2: Categories */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Product Categories</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What categories do you serve? *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={categoryInput}
                      onChange={e => setCategoryInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addItem('categories', categoryInput)
                        }
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Semiconductors, Steel Products, Injection Molding"
                    />
                    <button
                      type="button"
                      onClick={() => addItem('categories', categoryInput)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.categories.map((cat, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => removeItem('categories', idx)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {formData.categories.length === 0 && (
                  <p className="text-sm text-gray-500">Add at least one category to continue</p>
                )}
              </div>
            )}

            {/* Step 3: Capabilities */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Capabilities & Certifications
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capabilities *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={capabilityInput}
                      onChange={e => setCapabilityInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addItem('capabilities', capabilityInput)
                        }
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., CNC Machining, 3D Printing, Quality Testing"
                    />
                    <button
                      type="button"
                      onClick={() => addItem('capabilities', capabilityInput)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.capabilities.map((cap, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full"
                      >
                        {cap}
                        <button
                          type="button"
                          onClick={() => removeItem('capabilities', idx)}
                          className="ml-2 text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certifications
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={certificationInput}
                      onChange={e => setCertificationInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addItem('certifications', certificationInput)
                        }
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., ISO 9001, AS9100, ITAR"
                    />
                    <button
                      type="button"
                      onClick={() => addItem('certifications', certificationInput)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.certifications.map((cert, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-800 rounded-full"
                      >
                        {cert}
                        <button
                          type="button"
                          onClick={() => removeItem('certifications', idx)}
                          className="ml-2 text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Order Value
                    </label>
                    <input
                      type="text"
                      value={formData.minOrderValue}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, minOrderValue: e.target.value }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="$5,000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Typical Lead Time
                    </label>
                    <input
                      type="text"
                      value={formData.typicalLeadTime}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, typicalLeadTime: e.target.value }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="4-6 weeks"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Review Your Information</h2>

                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Company</h3>
                    <p className="text-gray-700">{formData.companyName}</p>
                    <p className="text-sm text-gray-600">{formData.email}</p>
                    <p className="text-sm text-gray-600">{formData.phone}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {formData.categories.map((cat, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Capabilities</h3>
                    <div className="flex flex-wrap gap-2">
                      {formData.capabilities.map((cap, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  {formData.certifications.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Certifications</h3>
                      <div className="flex flex-wrap gap-2">
                        {formData.certifications.map((cert, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                          >
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
                >
                  Back
                </button>
              ) : (
                <div></div>
              )}

              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !formData.companyName) ||
                    (step === 2 && formData.categories.length === 0) ||
                    (step === 3 && formData.capabilities.length === 0)
                  }
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
