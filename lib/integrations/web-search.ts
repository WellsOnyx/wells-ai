/**
 * Web Search Integration for Wells AI
 *
 * Uses Brave Search API for real-time web search capabilities.
 *
 * BRAVE SEARCH API:
 * - Free tier: 2,000 queries/month
 * - Paid tier: $5/1,000 queries after free tier
 * - No rate limits on paid tier
 * - Privacy-focused, no user tracking
 * - Get API key at: https://brave.com/search/api/
 *
 * ENVIRONMENT VARIABLES NEEDED:
 * - BRAVE_SEARCH_API_KEY: Your Brave Search API key (get from brave.com/search/api)
 *
 * FALLBACK:
 * If no API key is configured, returns graceful error message
 */

// Cache for search results (15 minutes)
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>()
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes in milliseconds

export interface SearchResult {
  title: string
  url: string
  snippet: string
  published_date?: string
}

export interface WebSearchOptions {
  query: string
  num_results?: number
  freshness?: 'past_day' | 'past_week' | 'past_month' | 'past_year' | null
  country?: string // Default: 'US'
  search_lang?: string // Default: 'en'
}

export interface WebSearchResponse {
  success: boolean
  results?: SearchResult[]
  query?: string
  total_results?: number
  error?: string
  cached?: boolean
}

/**
 * Search the web using Brave Search API
 */
export async function searchWeb(options: WebSearchOptions): Promise<WebSearchResponse> {
  const {
    query,
    num_results = 5,
    freshness = null,
    country = 'US',
    search_lang = 'en'
  } = options

  // Input validation
  if (!query || query.trim().length === 0) {
    return {
      success: false,
      error: 'Search query cannot be empty'
    }
  }

  if (num_results < 1 || num_results > 20) {
    return {
      success: false,
      error: 'Number of results must be between 1 and 20'
    }
  }

  // Check cache first
  const cacheKey = `${query}:${num_results}:${freshness}`
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('[WEB_SEARCH] Cache hit for query:', query)
    return {
      success: true,
      results: cached.results,
      query,
      total_results: cached.results.length,
      cached: true
    }
  }

  // Check if API key is configured
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) {
    console.warn('[WEB_SEARCH] BRAVE_SEARCH_API_KEY not configured')
    return {
      success: false,
      error: 'Web search is not configured. Please add BRAVE_SEARCH_API_KEY to environment variables. Get your API key at https://brave.com/search/api/'
    }
  }

  try {
    console.log('[WEB_SEARCH] Searching for:', query)

    // Build Brave Search API URL
    const params = new URLSearchParams({
      q: query,
      count: num_results.toString(),
      country,
      search_lang,
      // Get both web results and news if available
      text_decorations: 'false', // Remove HTML tags from snippets
      safesearch: 'moderate'
    })

    if (freshness) {
      params.append('freshness', freshness)
    }

    const url = `https://api.search.brave.com/res/v1/web/search?${params}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[WEB_SEARCH] Brave API error:', response.status, errorText)

      // Handle specific error cases
      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid Brave Search API key. Please check your BRAVE_SEARCH_API_KEY environment variable.'
        }
      }

      if (response.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later or upgrade your Brave Search API plan.'
        }
      }

      return {
        success: false,
        error: `Brave Search API error: ${response.status} ${response.statusText}`
      }
    }

    const data = await response.json()

    // Parse results
    const results: SearchResult[] = []

    // Get web results
    if (data.web && data.web.results && Array.isArray(data.web.results)) {
      for (const result of data.web.results.slice(0, num_results)) {
        results.push({
          title: result.title || 'Untitled',
          url: result.url || '',
          snippet: result.description || '',
          published_date: result.page_age || result.age
        })
      }
    }

    // Also check news results if available (for current events)
    if (data.news && data.news.results && Array.isArray(data.news.results)) {
      const newsCount = Math.min(2, num_results - results.length) // Add up to 2 news results
      for (let i = 0; i < newsCount && i < data.news.results.length; i++) {
        const newsResult = data.news.results[i]
        results.push({
          title: newsResult.title || 'Untitled',
          url: newsResult.url || '',
          snippet: newsResult.description || '',
          published_date: newsResult.age
        })
      }
    }

    if (results.length === 0) {
      return {
        success: false,
        error: `No results found for query: "${query}"`
      }
    }

    // Cache the results
    searchCache.set(cacheKey, { results, timestamp: Date.now() })

    // Clean old cache entries (simple cleanup - remove if older than cache duration)
    for (const [key, value] of searchCache.entries()) {
      if (Date.now() - value.timestamp > CACHE_DURATION) {
        searchCache.delete(key)
      }
    }

    console.log('[WEB_SEARCH] Found', results.length, 'results for:', query)

    return {
      success: true,
      results,
      query,
      total_results: results.length,
      cached: false
    }

  } catch (error: any) {
    console.error('[WEB_SEARCH] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to perform web search'
    }
  }
}

/**
 * Format search results for display to AI/user
 */
export function formatSearchResults(results: SearchResult[], query: string): string {
  if (results.length === 0) {
    return `No results found for "${query}"`
  }

  let formatted = `Search results for "${query}":\n\n`

  results.forEach((result, index) => {
    formatted += `${index + 1}. ${result.title}\n`
    formatted += `   URL: ${result.url}\n`
    formatted += `   ${result.snippet}\n`
    if (result.published_date) {
      formatted += `   Published: ${result.published_date}\n`
    }
    formatted += '\n'
  })

  return formatted
}

/**
 * Clear the search cache (useful for testing or manual cache invalidation)
 */
export function clearSearchCache(): void {
  searchCache.clear()
  console.log('[WEB_SEARCH] Cache cleared')
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: searchCache.size,
    entries: Array.from(searchCache.keys())
  }
}
