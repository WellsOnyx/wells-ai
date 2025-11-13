/**
 * Test file for Web Search Integration
 *
 * This is a simple test to verify the web search integration works.
 * Run this to test your Brave Search API setup.
 *
 * Usage:
 *   1. Set BRAVE_SEARCH_API_KEY in your .env file
 *   2. Run: node --loader ts-node/esm lib/integrations/web-search.test.ts
 *   OR
 *   3. Import and use in your application
 */

import { searchWeb, formatSearchResults, getCacheStats, clearSearchCache } from './web-search'

async function testWebSearch() {
  console.log('🔍 Testing Web Search Integration...\n')

  // Test 1: Basic search
  console.log('Test 1: Basic search query')
  console.log('Query: "Anthropic Claude AI latest news"\n')

  const result1 = await searchWeb({
    query: 'Anthropic Claude AI latest news',
    num_results: 3
  })

  if (result1.success) {
    console.log('✅ Search successful!')
    console.log(`Found ${result1.total_results} results`)
    console.log(`Cached: ${result1.cached}`)
    console.log('\nResults:')
    result1.results?.forEach((result, idx) => {
      console.log(`\n${idx + 1}. ${result.title}`)
      console.log(`   URL: ${result.url}`)
      console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`)
    })
  } else {
    console.log('❌ Search failed:', result1.error)
  }

  console.log('\n---\n')

  // Test 2: Cache functionality
  console.log('Test 2: Testing cache (same query again)')
  const result2 = await searchWeb({
    query: 'Anthropic Claude AI latest news',
    num_results: 3
  })

  if (result2.success) {
    console.log('✅ Search successful!')
    console.log(`Cached: ${result2.cached}`) // Should be true
  } else {
    console.log('❌ Search failed:', result2.error)
  }

  console.log('\n---\n')

  // Test 3: Different query
  console.log('Test 3: Different search query')
  console.log('Query: "Next.js 14 app router best practices"\n')

  const result3 = await searchWeb({
    query: 'Next.js 14 app router best practices',
    num_results: 5
  })

  if (result3.success) {
    console.log('✅ Search successful!')
    console.log(`Found ${result3.total_results} results\n`)
    console.log('Formatted output:')
    console.log(formatSearchResults(result3.results || [], result3.query || ''))
  } else {
    console.log('❌ Search failed:', result3.error)
  }

  console.log('\n---\n')

  // Test 4: Fresh results (news)
  console.log('Test 4: Fresh results with freshness filter')
  console.log('Query: "AI technology trends" (past week)\n')

  const result4 = await searchWeb({
    query: 'AI technology trends',
    num_results: 3,
    freshness: 'past_week'
  })

  if (result4.success) {
    console.log('✅ Search successful!')
    console.log(`Found ${result4.total_results} results`)
    result4.results?.forEach((result, idx) => {
      console.log(`\n${idx + 1}. ${result.title}`)
      if (result.published_date) {
        console.log(`   Published: ${result.published_date}`)
      }
    })
  } else {
    console.log('❌ Search failed:', result4.error)
  }

  console.log('\n---\n')

  // Test 5: Error handling - empty query
  console.log('Test 5: Error handling - empty query')
  const result5 = await searchWeb({
    query: '',
    num_results: 5
  })

  if (!result5.success) {
    console.log('✅ Error handled correctly:', result5.error)
  } else {
    console.log('❌ Should have failed with empty query')
  }

  console.log('\n---\n')

  // Test 6: Cache stats
  console.log('Test 6: Cache statistics')
  const stats = getCacheStats()
  console.log(`Cache size: ${stats.size} entries`)
  console.log('Cached queries:', stats.entries)

  console.log('\n---\n')
  console.log('🎉 All tests completed!')
}

// Run tests if this file is executed directly
if (require.main === module) {
  testWebSearch().catch(console.error)
}

export { testWebSearch }
