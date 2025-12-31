'use client'

/**
 * Buyer Sourcing Intake Page
 *
 * "What do you need?" intake form for buyers to submit sourcing requests.
 * Features:
 * - Natural language input: "I need [category] for [use case]"
 * - AI-assisted spec suggestions
 * - Category selection with subcategories
 * - Glassmorphic UI matching Wells AI design
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  ChevronRight,
  Loader2,
  Sparkles,
  Package,
  Truck,
  Factory,
  Leaf,
  Wrench,
  Box,
  Cpu,
  Settings,
  CheckCircle,
  ArrowRight,
  DollarSign,
  Clock,
  MapPin,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react'
import {
  SOURCING_CATEGORIES,
  COMMON_SPECS,
  URGENCY_OPTIONS,
  getAllSpecs,
  getCategoryById,
  getSubcategoryById,
  type Category,
  type SubCategory,
  type CategorySpec,
  type SourcingUrgency
} from '@/lib/wells-ai/sourcing/categories'

// Map category icons
const CATEGORY_ICONS: Record<string, any> = {
  raw_materials: Package,
  packaging: Box,
  components: Cpu,
  equipment: Factory,
  logistics: Truck,
  services: Wrench,
  food_ingredients: Leaf,
  other: Settings
}

export default function SourcingIntakePage() {
  const router = useRouter()
  const [step, setStep] = useState<'input' | 'category' | 'specs' | 'review'>('input')

  // Form state
  const [naturalInput, setNaturalInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubCategory | null>(null)
  const [specifications, setSpecifications] = useState<Record<string, any>>({})
  const [urgency, setUrgency] = useState<SourcingUrgency>('standard')
  const [painPoints, setPainPoints] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<{
    category?: string;
    subcategory?: string;
    suggestedSpecs?: Record<string, any>;
    summary?: string;
  } | null>(null)

  // Handle natural language input submission
  const handleNaturalSubmit = async () => {
    if (!naturalInput.trim()) return

    setIsAnalyzing(true)
    setError(null)

    try {
      // Call AI to analyze the input and suggest category/specs
      const response = await fetch('/api/wells-ai/source/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: naturalInput })
      })

      if (response.ok) {
        const data = await response.json()
        setAiSuggestions(data.suggestions)

        // Auto-select category if suggested
        if (data.suggestions?.category) {
          const cat = getCategoryById(data.suggestions.category)
          if (cat) {
            setSelectedCategory(cat)
            if (data.suggestions.subcategory) {
              const subcat = getSubcategoryById(data.suggestions.category, data.suggestions.subcategory)
              if (subcat) setSelectedSubcategory(subcat)
            }
          }
        }

        // Pre-fill specs if suggested
        if (data.suggestions?.suggestedSpecs) {
          setSpecifications(prev => ({
            ...prev,
            ...data.suggestions.suggestedSpecs
          }))
        }
      }
    } catch (err) {
      console.error('Analysis error:', err)
      // Continue anyway - AI suggestions are optional
    }

    setIsAnalyzing(false)
    setStep('category')
  }

  // Get all specs for current selection
  const currentSpecs = selectedCategory && selectedSubcategory
    ? getAllSpecs(selectedCategory.id, selectedSubcategory.id)
    : COMMON_SPECS

  // Handle spec change
  const handleSpecChange = (specId: string, value: any) => {
    setSpecifications(prev => ({
      ...prev,
      [specId]: value
    }))
  }

  // Handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/wells-ai/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: naturalInput.substring(0, 100),
          description: naturalInput,
          category_id: selectedCategory?.id || 'other',
          subcategory_id: selectedSubcategory?.id,
          specifications,
          quantity: specifications.quantity,
          unit_of_measure: specifications.unit,
          order_frequency: specifications.frequency,
          budget_min: specifications.budget_min,
          budget_max: specifications.budget_max,
          delivery_location: specifications.delivery_location,
          urgency,
          current_pain_points: painPoints,
          required_certifications: specifications.required_certifications,
          prefer_grain_enabled: true
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit request')
      }

      // Redirect to dashboard to see matches
      router.push(`/wells-ai/source/dashboard?request=${data.request.id}`)

    } catch (err: any) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/wells-ai" className="flex items-center gap-2.5 text-gray-900 font-semibold text-lg">
            <div className="w-8 h-8 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              W
            </div>
            Source
          </Link>

          <Link
            href="/wells-ai/source/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            View My Requests
          </Link>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center gap-3 mb-12">
          {['What You Need', 'Category', 'Details', 'Review'].map((label, i) => {
            const stepIndex = ['input', 'category', 'specs', 'review'].indexOf(step)
            const isActive = i === stepIndex
            const isComplete = i < stepIndex

            return (
              <div key={label} className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : isComplete
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {isComplete ? <CheckCircle className="w-4 h-4" /> : <span>{i + 1}</span>}
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < 3 && (
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                )}
              </div>
            )
          })}
        </div>

        {/* Step 1: Natural Language Input */}
        {step === 'input' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold text-gray-900 mb-3">
                What do you need to source?
              </h1>
              <p className="text-gray-500 text-lg">
                Tell us in your own words. Wells AI will help you find the right suppliers.
              </p>
            </div>

            {/* Main Input */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-violet-500/10 rounded-2xl blur-xl" />
              <div className="relative bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl p-1">
                <textarea
                  value={naturalInput}
                  onChange={(e) => setNaturalInput(e.target.value)}
                  placeholder="I need 5,000 units of food-grade plastic containers for my beverage startup. Need them delivered to Chicago by end of Q1..."
                  className="w-full h-40 px-5 py-4 bg-transparent text-gray-900 text-lg placeholder:text-gray-400 resize-none focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey) {
                      handleNaturalSubmit()
                    }
                  }}
                />
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI will suggest categories and specs
                  </div>
                  <button
                    onClick={handleNaturalSubmit}
                    disabled={!naturalInput.trim() || isAnalyzing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Example Prompts */}
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                'I need packaging materials for my cosmetics line',
                'Looking for a 3PL partner in the Midwest',
                'Need custom CNC machined parts - aluminum',
                'Sourcing organic ingredients for food manufacturing'
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => setNaturalInput(example)}
                  className="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Category Selection */}
        {step === 'category' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold text-gray-900 mb-3">
                What category best fits?
              </h1>
              <p className="text-gray-500">
                {aiSuggestions?.summary || 'Select the category that matches your sourcing needs'}
              </p>
            </div>

            {/* AI Suggestion Banner */}
            {aiSuggestions?.category && (
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-blue-700">
                  Based on your input, we suggest: <strong>{getCategoryById(aiSuggestions.category)?.name}</strong>
                </span>
              </div>
            )}

            {/* Category Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SOURCING_CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category.id] || Package
                const isSelected = selectedCategory?.id === category.id
                const isSuggested = aiSuggestions?.category === category.id

                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category)
                      setSelectedSubcategory(null)
                    }}
                    className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : isSuggested
                          ? 'bg-blue-50 border-blue-300 text-gray-900 hover:border-blue-400'
                          : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    {isSuggested && !isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                      isSelected ? 'bg-white/20' : 'bg-gray-100'
                    }`}>
                      <span className="text-xl">{category.icon}</span>
                    </div>
                    <h3 className="font-medium mb-1">{category.name}</h3>
                    <p className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                      {category.description}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Subcategory Selection */}
            {selectedCategory && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Select subcategory
                </h2>
                <div className="flex flex-wrap gap-2">
                  {selectedCategory.subcategories.map((sub) => {
                    const isSelected = selectedSubcategory?.id === sub.id
                    const isSuggested = aiSuggestions?.subcategory === sub.id

                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubcategory(sub)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-gray-900 border-gray-900 text-white'
                            : isSuggested
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span>{sub.icon}</span>
                        {sub.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <button
                onClick={() => setStep('input')}
                className="px-5 py-2.5 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('specs')}
                disabled={!selectedCategory || !selectedSubcategory}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Specifications */}
        {step === 'specs' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold text-gray-900 mb-3">
                Tell us more details
              </h1>
              <p className="text-gray-500">
                The more details you provide, the better we can match you with suppliers
              </p>
            </div>

            {/* Specs Form */}
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
              {currentSpecs.map((spec) => (
                <div key={spec.id} className="p-5">
                  <label className="block mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {spec.label}
                      {spec.required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                    {spec.helperText && (
                      <span className="block text-xs text-gray-500 mt-0.5">{spec.helperText}</span>
                    )}
                  </label>

                  {spec.type === 'text' && (
                    <input
                      type="text"
                      value={specifications[spec.id] || ''}
                      onChange={(e) => handleSpecChange(spec.id, e.target.value)}
                      placeholder={spec.placeholder}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                    />
                  )}

                  {spec.type === 'number' && (
                    <input
                      type="number"
                      value={specifications[spec.id] || ''}
                      onChange={(e) => handleSpecChange(spec.id, e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder={spec.placeholder}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                    />
                  )}

                  {spec.type === 'select' && (
                    <select
                      value={specifications[spec.id] || ''}
                      onChange={(e) => handleSpecChange(spec.id, e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                    >
                      <option value="">Select...</option>
                      {spec.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {spec.type === 'multiselect' && (
                    <div className="flex flex-wrap gap-2">
                      {spec.options?.map((opt) => {
                        const selected = (specifications[spec.id] || []).includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const current = specifications[spec.id] || []
                              if (selected) {
                                handleSpecChange(spec.id, current.filter((v: string) => v !== opt))
                              } else {
                                handleSpecChange(spec.id, [...current, opt])
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                              selected
                                ? 'bg-gray-900 border-gray-900 text-white'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {spec.type === 'boolean' && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSpecChange(spec.id, true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          specifications[spec.id] === true
                            ? 'bg-gray-900 border-gray-900 text-white'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpecChange(spec.id, false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          specifications[spec.id] === false
                            ? 'bg-gray-900 border-gray-900 text-white'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Urgency */}
              <div className="p-5">
                <label className="block mb-3">
                  <span className="text-sm font-medium text-gray-900">Timeline / Urgency</span>
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {URGENCY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setUrgency(option.value)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        urgency === option.value
                          ? 'bg-gray-900 border-gray-900 text-white'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <p className={`text-xs ${urgency === option.value ? 'text-white/70' : 'text-gray-500'}`}>
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pain Points */}
              <div className="p-5">
                <label className="block mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    Current challenges with suppliers (optional)
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Help us understand what to avoid
                  </span>
                </label>
                <textarea
                  value={painPoints}
                  onChange={(e) => setPainPoints(e.target.value)}
                  placeholder="e.g., Current supplier has quality issues, lead times are too long..."
                  className="w-full h-24 px-4 py-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <button
                onClick={() => setStep('category')}
                className="px-5 py-2.5 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('review')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
              >
                Review & Submit
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Submit */}
        {step === 'review' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold text-gray-900 mb-3">
                Review your request
              </h1>
              <p className="text-gray-500">
                Make sure everything looks correct before submitting
              </p>
            </div>

            {/* Review Card */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {naturalInput.substring(0, 100)}
                </h2>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <span>{selectedCategory?.icon}</span>
                    {selectedCategory?.name}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>{selectedSubcategory?.name}</span>
                </div>
              </div>

              {/* Details */}
              <div className="p-6 space-y-4">
                {/* Key Specs */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {specifications.quantity && (
                    <div className="flex items-start gap-3">
                      <Package className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Quantity</div>
                        <div className="text-sm text-gray-500">
                          {specifications.quantity} {specifications.unit || 'units'}
                        </div>
                      </div>
                    </div>
                  )}

                  {(specifications.budget_min || specifications.budget_max) && (
                    <div className="flex items-start gap-3">
                      <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Budget</div>
                        <div className="text-sm text-gray-500">
                          {specifications.budget_min ? `$${specifications.budget_min.toLocaleString()}` : 'Min not set'}
                          {' - '}
                          {specifications.budget_max ? `$${specifications.budget_max.toLocaleString()}` : 'Max not set'}
                        </div>
                      </div>
                    </div>
                  )}

                  {specifications.delivery_location && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Delivery</div>
                        <div className="text-sm text-gray-500">{specifications.delivery_location}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">Timeline</div>
                      <div className="text-sm text-gray-500">
                        {URGENCY_OPTIONS.find(u => u.value === urgency)?.label}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full Description */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="text-sm font-medium text-gray-900 mb-2">Full Description</div>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap">{naturalInput}</div>
                </div>

                {/* Pain Points */}
                {painPoints && (
                  <div className="pt-4 border-t border-gray-100">
                    <div className="text-sm font-medium text-gray-900 mb-2">Current Challenges</div>
                    <div className="text-sm text-gray-600">{painPoints}</div>
                  </div>
                )}
              </div>

              {/* GRAIN Notice */}
              <div className="px-6 py-4 bg-emerald-50 border-t border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-900">GRAIN-enabled suppliers prioritized</div>
                    <div className="text-xs text-emerald-700">
                      Pay instantly with GRAIN and get better terms
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* What Happens Next */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                What happens next
              </h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-medium shrink-0">1</span>
                  Wells AI analyzes your request and finds matching suppliers
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-medium shrink-0">2</span>
                  Review matched suppliers with compatibility scores
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-medium shrink-0">3</span>
                  Request introductions to suppliers you like
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-medium shrink-0">4</span>
                  Get quotes, negotiate, and close the deal
                </li>
              </ol>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <button
                onClick={() => setStep('specs')}
                className="px-5 py-2.5 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Find Suppliers
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Wells AI Sourcing</span>
            <span>1% success fee on closed deals</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
