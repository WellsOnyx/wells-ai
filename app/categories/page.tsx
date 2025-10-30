'use client'

import { useState, useEffect } from 'react'

interface Category {
  id: string
  category: string
  subcategory?: string
  mastery: number // 0-100
  specsCount: number
  suppliersCount: number
  learnedAt: string
  lastUpdated: string
}

export default function CategoryMasteryPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    try {
      const response = await fetch('/api/categories/stats')
      const data = await response.json()
      setCategories(data.categories || [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      setLoading(false)
    }
  }

  const filteredCategories = categories.filter(cat => {
    // Filter by mastery level
    if (filter === 'high' && cat.mastery < 80) return false
    if (filter === 'medium' && (cat.mastery < 50 || cat.mastery >= 80)) return false
    if (filter === 'low' && cat.mastery >= 50) return false

    // Filter by search query
    if (searchQuery && !cat.category.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    return true
  })

  const stats = {
    total: categories.length,
    high: categories.filter(c => c.mastery >= 80).length,
    medium: categories.filter(c => c.mastery >= 50 && c.mastery < 80).length,
    low: categories.filter(c => c.mastery < 50).length,
    avgMastery: categories.length > 0
      ? Math.round(categories.reduce((sum, c) => sum + c.mastery, 0) / categories.length)
      : 0,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading categories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Category Mastery Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Track what Wells AI knows and how well we know it
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Categories</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-1">Phase 2 Goal: 10</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">High Mastery</div>
            <div className="text-3xl font-bold text-green-600">{stats.high}</div>
            <div className="text-xs text-gray-500 mt-1">80%+ confidence</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Medium Mastery</div>
            <div className="text-3xl font-bold text-yellow-600">{stats.medium}</div>
            <div className="text-xs text-gray-500 mt-1">50-79% confidence</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Avg Mastery</div>
            <div className="text-3xl font-bold text-blue-600">{stats.avgMastery}%</div>
            <div className="text-xs text-gray-500 mt-1">Across all categories</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex space-x-2">
              {(['all', 'high', 'medium', 'low'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm capitalize ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Categories List */}
        {filteredCategories.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No matching categories' : 'No categories yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery
                ? 'Try a different search term'
                : 'Start teaching Wells AI about product categories'}
            </p>
            <button
              onClick={() => (window.location.href = '/learn')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
            >
              Teach New Category
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map(category => (
              <div key={category.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-xl font-bold text-gray-900">
                          {category.category}
                        </h3>
                        {category.subcategory && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {category.subcategory}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center space-x-6 text-sm text-gray-600">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {category.specsCount} specs
                        </div>

                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {category.suppliersCount} suppliers
                        </div>

                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(category.learnedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4">
                      <div
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                          category.mastery >= 80
                            ? 'bg-green-100 text-green-800'
                            : category.mastery >= 50
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {category.mastery}% Mastery
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        category.mastery >= 80
                          ? 'bg-green-500'
                          : category.mastery >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${category.mastery}%` }}
                    ></div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex space-x-3">
                    <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                      View Details
                    </button>
                    <button className="text-sm text-gray-600 hover:text-gray-800 font-medium">
                      Improve Knowledge
                    </button>
                    <button className="text-sm text-gray-600 hover:text-gray-800 font-medium">
                      Find Suppliers
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Phase 2A Target Categories */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Phase 2A Target Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              'Semiconductors',
              'Executive Search',
              'Cloud Infrastructure',
              'Industrial Equipment',
              'Professional Services',
            ].map(cat => {
              const learned = categories.find(c => c.category === cat)
              return (
                <div
                  key={cat}
                  className={`p-4 rounded-lg border-2 ${
                    learned
                      ? 'bg-white border-green-500'
                      : 'bg-white border-gray-200 border-dashed'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{cat}</h3>
                    {learned ? (
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                  </div>
                  {learned ? (
                    <div className="text-xs text-green-600 font-medium">
                      ✓ {learned.mastery}% mastered
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">Not learned yet</div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-6 text-center">
            <button
              onClick={() => (window.location.href = '/learn')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
            >
              Start Learning New Category
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
