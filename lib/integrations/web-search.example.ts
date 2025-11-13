/**
 * Web Search Integration - Usage Examples
 *
 * These examples show how to use the web search functionality
 * in different scenarios within Wells AI.
 */

import { searchWeb, formatSearchResults } from './web-search'

/**
 * Example 1: Basic search for company information
 */
export async function searchCompanyInfo(companyName: string) {
  const result = await searchWeb({
    query: `${companyName} company information funding revenue`,
    num_results: 5
  })

  if (result.success && result.results) {
    return {
      success: true,
      data: result.results,
      summary: `Found ${result.total_results} results about ${companyName}`
    }
  }

  return {
    success: false,
    error: result.error
  }
}

/**
 * Example 2: Search for latest news
 */
export async function searchLatestNews(topic: string) {
  const result = await searchWeb({
    query: `${topic} latest news`,
    num_results: 10,
    freshness: 'past_week' // Only recent news
  })

  if (result.success && result.results) {
    // Filter results to only include actual news sources
    const newsResults = result.results.filter(r =>
      r.published_date ||
      r.url.includes('news') ||
      r.url.includes('blog') ||
      r.url.includes('techcrunch') ||
      r.url.includes('reuters')
    )

    return {
      success: true,
      data: newsResults,
      formatted: formatSearchResults(newsResults, `${topic} latest news`)
    }
  }

  return {
    success: false,
    error: result.error
  }
}

/**
 * Example 3: Research a technology or tool
 */
export async function researchTechnology(techName: string) {
  const queries = [
    `${techName} documentation`,
    `${techName} best practices`,
    `${techName} vs alternatives comparison`
  ]

  const results = await Promise.all(
    queries.map(query => searchWeb({ query, num_results: 3 }))
  )

  const allResults = results
    .filter(r => r.success)
    .flatMap(r => r.results || [])

  return {
    success: allResults.length > 0,
    data: allResults,
    categories: {
      documentation: results[0].results || [],
      bestPractices: results[1].results || [],
      comparisons: results[2].results || []
    }
  }
}

/**
 * Example 4: Find pricing information
 */
export async function findPricing(productOrService: string) {
  const result = await searchWeb({
    query: `${productOrService} pricing cost plans 2025`,
    num_results: 7
  })

  if (result.success && result.results) {
    // Prioritize results that likely contain pricing info
    const pricingResults = result.results.filter(r => {
      const text = (r.title + r.snippet).toLowerCase()
      return text.includes('pricing') ||
             text.includes('cost') ||
             text.includes('price') ||
             text.includes('plans') ||
             text.includes('$')
    })

    return {
      success: true,
      data: pricingResults.length > 0 ? pricingResults : result.results,
      formatted: formatSearchResults(
        pricingResults.length > 0 ? pricingResults : result.results,
        `${productOrService} pricing`
      )
    }
  }

  return {
    success: false,
    error: result.error
  }
}

/**
 * Example 5: Competitive research
 */
export async function competitiveResearch(companyName: string) {
  const competitorsResult = await searchWeb({
    query: `${companyName} competitors alternatives`,
    num_results: 5
  })

  const marketResult = await searchWeb({
    query: `${companyName} market share industry analysis`,
    num_results: 5
  })

  return {
    success: competitorsResult.success && marketResult.success,
    competitors: competitorsResult.results || [],
    marketAnalysis: marketResult.results || [],
    formatted: {
      competitors: formatSearchResults(
        competitorsResult.results || [],
        'Competitors'
      ),
      market: formatSearchResults(
        marketResult.results || [],
        'Market Analysis'
      )
    }
  }
}

/**
 * Example 6: Job market research
 */
export async function searchJobMarket(role: string, location?: string) {
  const query = location
    ? `${role} jobs ${location} salary trends 2025`
    : `${role} jobs salary trends 2025`

  const result = await searchWeb({
    query,
    num_results: 8,
    freshness: 'past_month'
  })

  if (result.success && result.results) {
    return {
      success: true,
      data: result.results,
      insights: extractJobInsights(result.results)
    }
  }

  return {
    success: false,
    error: result.error
  }
}

/**
 * Example 7: Verify information or fact-check
 */
export async function verifyInformation(claim: string) {
  const result = await searchWeb({
    query: `${claim} verify fact check`,
    num_results: 5,
    freshness: 'past_year'
  })

  if (result.success && result.results) {
    // Look for authoritative sources
    const authoritativeSources = result.results.filter(r => {
      const url = r.url.toLowerCase()
      return url.includes('.gov') ||
             url.includes('.edu') ||
             url.includes('wikipedia') ||
             url.includes('reuters') ||
             url.includes('apnews')
    })

    return {
      success: true,
      allResults: result.results,
      authoritativeSources,
      formatted: formatSearchResults(
        authoritativeSources.length > 0 ? authoritativeSources : result.results,
        claim
      )
    }
  }

  return {
    success: false,
    error: result.error
  }
}

// Helper functions

function extractJobInsights(results: any[]) {
  const insights = {
    platforms: [] as string[],
    mentions: {
      salary: 0,
      remote: 0,
      benefits: 0
    }
  }

  results.forEach(result => {
    const text = (result.title + result.snippet).toLowerCase()

    // Extract job platforms
    if (text.includes('linkedin')) insights.platforms.push('LinkedIn')
    if (text.includes('indeed')) insights.platforms.push('Indeed')
    if (text.includes('glassdoor')) insights.platforms.push('Glassdoor')

    // Count keyword mentions
    if (text.includes('salary') || text.includes('$')) insights.mentions.salary++
    if (text.includes('remote') || text.includes('hybrid')) insights.mentions.remote++
    if (text.includes('benefits') || text.includes('401k')) insights.mentions.benefits++
  })

  insights.platforms = [...new Set(insights.platforms)] // Remove duplicates

  return insights
}

/**
 * Example 8: Monitor brand mentions
 */
export async function monitorBrandMentions(brandName: string) {
  const result = await searchWeb({
    query: `"${brandName}" news mentions`,
    num_results: 10,
    freshness: 'past_week'
  })

  if (result.success && result.results) {
    return {
      success: true,
      recentMentions: result.results,
      count: result.total_results,
      summary: `Found ${result.total_results} recent mentions of "${brandName}"`
    }
  }

  return {
    success: false,
    error: result.error
  }
}

// Export all examples
export const examples = {
  searchCompanyInfo,
  searchLatestNews,
  researchTechnology,
  findPricing,
  competitiveResearch,
  searchJobMarket,
  verifyInformation,
  monitorBrandMentions
}
