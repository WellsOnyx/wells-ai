'use client'

import { useState, useCallback } from 'react'

// ============================================
// TYPES
// ============================================

interface ScrapeResult {
  success: boolean
  url: string
  timestamp: string
  meta: {
    title: string
    description: string
    keywords?: string
    author?: string
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    canonical?: string
  }
  headings: {
    h1: string[]
    h2: string[]
    h3: string[]
    h4: string[]
    h5: string[]
    h6: string[]
  }
  links: Array<{
    href: string
    text: string
    rel?: string
    isExternal: boolean
  }>
  forms: Array<{
    action: string
    method: string
    id?: string
    name?: string
    fields: Array<{
      name: string
      type: string
      id?: string
      placeholder?: string
      required?: boolean
      value?: string
    }>
  }>
  images?: Array<{
    src: string
    alt?: string
    width?: string
    height?: string
  }>
  textContent: string
  wordCount: number
  error?: string
}

interface FormTestResult {
  success: boolean
  request: {
    url: string
    method: string
    contentType: string
    dataSent: Record<string, unknown>
    headers: Record<string, string>
  }
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    bodyPreview: string
    bodyLength: number
    isJson: boolean
    jsonData?: unknown
    redirected: boolean
    finalUrl: string
    timing: {
      startTime: string
      endTime: string
      durationMs: number
    }
  }
  error?: string
}

interface FormDataEntry {
  key: string
  value: string
}

// ============================================
// COMPONENTS
// ============================================

function CodeBlock({ children, language = 'json' }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Simple syntax highlighting
  const highlightJson = (code: string) => {
    return code
      .replace(/"([^"]+)":/g, '<span class="text-cyan-400">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="text-amber-400">"$1"</span>')
      .replace(/: (\d+)/g, ': <span class="text-emerald-400">$1</span>')
      .replace(/: (true|false)/g, ': <span class="text-purple-400">$1</span>')
      .replace(/: (null)/g, ': <span class="text-gray-500">$1</span>')
  }

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="bg-black/40 border border-white/10 rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code
          dangerouslySetInnerHTML={{
            __html: language === 'json' ? highlightJson(children) : children,
          }}
        />
      </pre>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function StatusBadge({ status }: { status: number }) {
  const getStatusColor = () => {
    if (status >= 200 && status < 300) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (status >= 300 && status < 400) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    if (status >= 400 && status < 500) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    return 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  return (
    <span className={`px-2 py-1 rounded-md text-sm font-mono border ${getStatusColor()}`}>
      {status}
    </span>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function TestToolsPage() {
  // Scraper state
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [extractImages, setExtractImages] = useState(false)

  // Form tester state
  const [formUrl, setFormUrl] = useState('')
  const [formMethod, setFormMethod] = useState<'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'>('POST')
  const [formContentType, setFormContentType] = useState<'application/json' | 'application/x-www-form-urlencoded'>('application/json')
  const [formData, setFormData] = useState<FormDataEntry[]>([{ key: '', value: '' }])
  const [formLoading, setFormLoading] = useState(false)
  const [formResult, setFormResult] = useState<FormTestResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Active tab
  const [activeTab, setActiveTab] = useState<'scraper' | 'form-tester'>('scraper')

  // ============================================
  // HANDLERS
  // ============================================

  const handleScrape = useCallback(async () => {
    if (!scrapeUrl.trim()) {
      setScrapeError('Please enter a URL')
      return
    }

    setScrapeLoading(true)
    setScrapeError(null)
    setScrapeResult(null)

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: scrapeUrl,
          options: { extractImages },
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setScrapeError(data.error || 'Failed to scrape URL')
        return
      }

      setScrapeResult(data)
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setScrapeLoading(false)
    }
  }, [scrapeUrl, extractImages])

  const handleFormTest = useCallback(async () => {
    if (!formUrl.trim()) {
      setFormError('Please enter a URL')
      return
    }

    setFormLoading(true)
    setFormError(null)
    setFormResult(null)

    // Convert formData array to object
    const dataObject: Record<string, string> = {}
    formData.forEach(({ key, value }) => {
      if (key.trim()) {
        dataObject[key.trim()] = value
      }
    })

    try {
      const response = await fetch('/api/form-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formUrl,
          method: formMethod,
          contentType: formContentType,
          data: dataObject,
          timeout: 30000,
        }),
      })

      const data = await response.json()

      if (data.error && !data.response) {
        setFormError(data.error)
        return
      }

      setFormResult(data)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setFormLoading(false)
    }
  }, [formUrl, formMethod, formContentType, formData])

  const addFormField = () => {
    setFormData([...formData, { key: '', value: '' }])
  }

  const removeFormField = (index: number) => {
    if (formData.length > 1) {
      setFormData(formData.filter((_, i) => i !== index))
    }
  }

  const updateFormField = (index: number, field: 'key' | 'value', newValue: string) => {
    const updated = [...formData]
    updated[index][field] = newValue
    setFormData(updated)
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
            <span className="text-amber-400">&#9881;</span>
            <span className="text-sm text-gray-300">Developer Tools</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Test Tools
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Web scraping and form testing utilities for development and debugging
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white/5 border border-white/10 rounded-xl p-1 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('scraper')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'scraper'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Web Scraper
            </button>
            <button
              onClick={() => setActiveTab('form-tester')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'form-tester'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Form Tester
            </button>
          </div>
        </div>

        {/* Web Scraper Section */}
        {activeTab === 'scraper' && (
          <div className="space-y-6">
            {/* Input Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Scrape a Website</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Target URL</label>
                  <input
                    type="url"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extractImages}
                      onChange={(e) => setExtractImages(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/20"
                    />
                    <span className="text-sm">Extract images</span>
                  </label>
                </div>

                <button
                  onClick={handleScrape}
                  disabled={scrapeLoading || !scrapeUrl.trim()}
                  className="w-full py-3 rounded-xl font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {scrapeLoading ? (
                    <>
                      <LoadingSpinner />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Scrape URL
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {scrapeError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {scrapeError}
                </p>
              </div>
            )}

            {/* Results Display */}
            {scrapeResult && (
              <div className="space-y-6">
                {/* Meta Information */}
                <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Page Metadata
                  </h3>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-black/20 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Title</p>
                      <p className="text-white">{scrapeResult.meta.title || 'No title found'}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Final URL</p>
                      <p className="text-cyan-400 text-sm break-all">{scrapeResult.url}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-4 md:col-span-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
                      <p className="text-gray-300">{scrapeResult.meta.description || 'No description found'}</p>
                    </div>
                    {scrapeResult.meta.ogImage && (
                      <div className="bg-black/20 rounded-lg p-4 md:col-span-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">OG Image</p>
                        <img
                          src={scrapeResult.meta.ogImage}
                          alt="OG Image"
                          className="max-w-md rounded-lg border border-white/10"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400">
                    <span>Word count: <span className="text-white">{scrapeResult.wordCount.toLocaleString()}</span></span>
                    <span>Links: <span className="text-white">{scrapeResult.links.length}</span></span>
                    <span>Forms: <span className="text-white">{scrapeResult.forms.length}</span></span>
                    {scrapeResult.images && <span>Images: <span className="text-white">{scrapeResult.images.length}</span></span>}
                  </div>
                </div>

                {/* Headings */}
                <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Headings Structure
                  </h3>

                  <div className="space-y-3">
                    {Object.entries(scrapeResult.headings).map(([level, texts]) => (
                      texts.length > 0 && (
                        <div key={level} className="bg-black/20 rounded-lg p-4">
                          <p className="text-xs text-amber-400 uppercase tracking-wide mb-2">{level.toUpperCase()} ({texts.length})</p>
                          <ul className="space-y-1">
                            {texts.slice(0, 10).map((text, i) => (
                              <li key={i} className="text-gray-300 text-sm">{text}</li>
                            ))}
                            {texts.length > 10 && (
                              <li className="text-gray-500 text-sm">...and {texts.length - 10} more</li>
                            )}
                          </ul>
                        </div>
                      )
                    ))}
                    {Object.values(scrapeResult.headings).every(h => h.length === 0) && (
                      <p className="text-gray-500">No headings found</p>
                    )}
                  </div>
                </div>

                {/* Forms Found */}
                {scrapeResult.forms.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Forms Found ({scrapeResult.forms.length})
                    </h3>

                    <div className="space-y-4">
                      {scrapeResult.forms.map((form, i) => (
                        <div key={i} className="bg-black/20 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded font-mono">{form.method}</span>
                            <span className="text-gray-400 text-sm break-all">{form.action || '(no action)'}</span>
                          </div>
                          {form.fields.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-500">Fields:</p>
                              <div className="flex flex-wrap gap-2">
                                {form.fields.map((field, j) => (
                                  <span
                                    key={j}
                                    className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300"
                                  >
                                    {field.name} <span className="text-gray-500">({field.type})</span>
                                    {field.required && <span className="text-red-400">*</span>}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Links ({scrapeResult.links.length})
                  </h3>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {scrapeResult.links.slice(0, 50).map((link, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${link.isExternal ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {link.isExternal ? 'EXT' : 'INT'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-300 truncate">{link.text || '(no text)'}</p>
                          <p className="text-gray-500 text-xs truncate">{link.href}</p>
                        </div>
                      </div>
                    ))}
                    {scrapeResult.links.length > 50 && (
                      <p className="text-gray-500 text-sm text-center py-2">
                        Showing first 50 of {scrapeResult.links.length} links
                      </p>
                    )}
                  </div>
                </div>

                {/* Raw JSON */}
                <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Raw Response
                  </h3>
                  <CodeBlock>{JSON.stringify(scrapeResult, null, 2)}</CodeBlock>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Tester Section */}
        {activeTab === 'form-tester' && (
          <div className="space-y-6">
            {/* Input Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Test Form Submission</h2>

              <div className="space-y-4">
                {/* URL and Method */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-sm text-gray-400 mb-2">Target URL</label>
                    <input
                      type="url"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://httpbin.org/post"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Method</label>
                    <select
                      value={formMethod}
                      onChange={(e) => setFormMethod(e.target.value as typeof formMethod)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    >
                      <option value="POST" className="bg-gray-800">POST</option>
                      <option value="GET" className="bg-gray-800">GET</option>
                      <option value="PUT" className="bg-gray-800">PUT</option>
                      <option value="PATCH" className="bg-gray-800">PATCH</option>
                      <option value="DELETE" className="bg-gray-800">DELETE</option>
                    </select>
                  </div>
                </div>

                {/* Content Type */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Content Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name="contentType"
                        value="application/json"
                        checked={formContentType === 'application/json'}
                        onChange={(e) => setFormContentType(e.target.value as typeof formContentType)}
                        className="text-amber-500 focus:ring-amber-500/20"
                      />
                      <span className="text-sm">JSON</span>
                    </label>
                    <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name="contentType"
                        value="application/x-www-form-urlencoded"
                        checked={formContentType === 'application/x-www-form-urlencoded'}
                        onChange={(e) => setFormContentType(e.target.value as typeof formContentType)}
                        className="text-amber-500 focus:ring-amber-500/20"
                      />
                      <span className="text-sm">Form URL Encoded</span>
                    </label>
                  </div>
                </div>

                {/* Form Data Builder */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Form Data</label>
                  <div className="space-y-2">
                    {formData.map((entry, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={entry.key}
                          onChange={(e) => updateFormField(index, 'key', e.target.value)}
                          placeholder="Key"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 text-sm"
                        />
                        <input
                          type="text"
                          value={entry.value}
                          onChange={(e) => updateFormField(index, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 text-sm"
                        />
                        <button
                          onClick={() => removeFormField(index)}
                          disabled={formData.length === 1}
                          className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addFormField}
                      className="w-full py-2 border border-dashed border-white/20 rounded-lg text-gray-400 hover:text-white hover:border-white/40 transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Field
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleFormTest}
                  disabled={formLoading || !formUrl.trim()}
                  className="w-full py-3 rounded-xl font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {formLoading ? (
                    <>
                      <LoadingSpinner />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Submit Form
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formError}
                </p>
              </div>
            )}

            {/* Results Display */}
            {formResult && (
              <div className="space-y-6">
                {/* Response Overview */}
                <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Response Overview
                  </h3>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-black/20 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={formResult.response.status} />
                        <span className="text-gray-300">{formResult.response.statusText}</span>
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Duration</p>
                      <p className="text-white font-mono">{formResult.response.timing.durationMs}ms</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Response Size</p>
                      <p className="text-white font-mono">{formResult.response.bodyLength.toLocaleString()} bytes</p>
                    </div>
                  </div>

                  {formResult.response.redirected && (
                    <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                      <p className="text-cyan-400 text-sm">
                        Redirected to: <span className="font-mono">{formResult.response.finalUrl}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Request Details */}
                <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                    </svg>
                    Request Sent
                  </h3>
                  <CodeBlock>{JSON.stringify(formResult.request, null, 2)}</CodeBlock>
                </div>

                {/* Response Headers */}
                <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Response Headers
                  </h3>
                  <CodeBlock>{JSON.stringify(formResult.response.headers, null, 2)}</CodeBlock>
                </div>

                {/* Response Body */}
                <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Response Body
                    {formResult.response.isJson && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded ml-2">JSON</span>
                    )}
                  </h3>
                  <CodeBlock>
                    {formResult.response.isJson && formResult.response.jsonData
                      ? JSON.stringify(formResult.response.jsonData, null, 2)
                      : formResult.response.bodyPreview}
                  </CodeBlock>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
