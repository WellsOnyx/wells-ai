# Web Search Integration for Wells AI

## Overview

Wells AI now has real-time web search capabilities powered by **Brave Search API**. This enables Wells to look up current information, news, company data, pricing, and any other real-time information from the web.

## Why Brave Search API?

We chose Brave Search API over alternatives for several key reasons:

### Advantages:
- **Free Tier Friendly**: 2,000 queries/month free (perfect for development and early-stage usage)
- **Affordable Scaling**: Only $5 per 1,000 queries after free tier (vs SerpAPI at $50+/month)
- **No Rate Limits**: On paid tier, no artificial rate limiting
- **Privacy-Focused**: No user tracking or data collection
- **High Quality**: Uses Brave's independent search index (not just Google scraping)
- **Simple API**: Clean REST API with JSON responses
- **Reliable**: Built by Brave Software, well-maintained and documented

### Comparison with Alternatives:

| Provider | Free Tier | Paid Pricing | Rate Limits | Quality |
|----------|-----------|--------------|-------------|---------|
| **Brave Search** | 2,000/month | $5/1,000 queries | None on paid | ⭐⭐⭐⭐⭐ |
| SerpAPI | 100/month | $50/5,000 queries | Varies | ⭐⭐⭐⭐ |
| Bing Search API | 1,000/month | $5/1,000 queries | Strict | ⭐⭐⭐⭐ |
| Google Custom Search | 100/day | Not scalable | Very strict | ⭐⭐⭐⭐⭐ |

## Setup Instructions

### 1. Get Your Brave Search API Key

1. Go to [https://brave.com/search/api/](https://brave.com/search/api/)
2. Click "Get Started" or "Sign Up"
3. Create an account or sign in
4. Navigate to your API dashboard
5. Create a new API key
6. Copy your API key (starts with `BSA...`)

### 2. Add to Environment Variables

Add your API key to `.env`, `.env.local`, or your production environment:

```bash
# Brave Search API (for web search tool)
# Get your API key at: https://brave.com/search/api/
# Free tier: 2,000 queries/month
# Paid tier: $5/1,000 queries
BRAVE_SEARCH_API_KEY=BSA1234567890abcdef...
```

### 3. Verify Setup

The integration will work automatically once the API key is configured. To test:

```typescript
import { searchWeb } from './lib/integrations/web-search'

const result = await searchWeb({
  query: 'Anthropic Claude AI',
  num_results: 5
})

if (result.success) {
  console.log('Search results:', result.results)
} else {
  console.log('Error:', result.error)
}
```

## Usage

### Basic Search

```typescript
import { searchWeb } from '@/lib/integrations/web-search'

const result = await searchWeb({
  query: 'Next.js 14 features',
  num_results: 5
})
```

### Search with Freshness Filter

```typescript
const result = await searchWeb({
  query: 'AI news',
  num_results: 5,
  freshness: 'past_week' // or 'past_day', 'past_month', 'past_year'
})
```

### Search with Country/Language

```typescript
const result = await searchWeb({
  query: 'technology companies',
  num_results: 10,
  country: 'GB', // United Kingdom
  search_lang: 'en'
})
```

### Format Results for Display

```typescript
import { searchWeb, formatSearchResults } from '@/lib/integrations/web-search'

const result = await searchWeb({ query: 'Claude AI', num_results: 3 })

if (result.success) {
  const formatted = formatSearchResults(result.results, result.query)
  console.log(formatted)
  // Output:
  // Search results for "Claude AI":
  //
  // 1. Anthropic | Claude
  //    URL: https://www.anthropic.com/claude
  //    Claude is a next-generation AI assistant...
  //
  // 2. Claude AI: Features and Capabilities
  //    ...
}
```

## API Reference

### `searchWeb(options: WebSearchOptions)`

Performs a web search and returns results.

**Parameters:**
```typescript
interface WebSearchOptions {
  query: string              // Required: Search query
  num_results?: number       // Optional: Number of results (1-20, default: 5)
  freshness?: string         // Optional: 'past_day' | 'past_week' | 'past_month' | 'past_year'
  country?: string           // Optional: Country code (default: 'US')
  search_lang?: string       // Optional: Language code (default: 'en')
}
```

**Returns:**
```typescript
interface WebSearchResponse {
  success: boolean
  results?: SearchResult[]
  query?: string
  total_results?: number
  error?: string
  cached?: boolean          // True if results came from cache
}

interface SearchResult {
  title: string
  url: string
  snippet: string
  published_date?: string   // Available for news results
}
```

### `formatSearchResults(results: SearchResult[], query: string)`

Formats search results into a readable string.

**Parameters:**
- `results`: Array of search results
- `query`: The original search query

**Returns:** Formatted string with numbered results

### `clearSearchCache()`

Clears the in-memory search cache.

### `getCacheStats()`

Returns cache statistics (size and cached queries).

## Features

### 1. Automatic Caching
- Results are cached for 15 minutes
- Reduces API calls for repeated queries
- Automatic cache cleanup

### 2. Graceful Fallback
- If API key is not configured, returns helpful error message
- Doesn't crash the application
- Guides users to setup instructions

### 3. Error Handling
- Invalid API key detection
- Rate limit handling
- Network error recovery
- Input validation

### 4. Rate Limiting Protection
- 15-minute cache prevents excessive API calls
- Configurable num_results (1-20 max)
- Automatic cache cleanup

### 5. News Integration
- Automatically includes recent news results when relevant
- Supports freshness filters
- Published date included when available

## Integration with Wells Tools

The web search is automatically available as a Wells AI tool. Users can ask Wells to search the web:

**Example prompts:**
- "Search for the latest AI news"
- "Look up Next.js 14 documentation"
- "Find current pricing for Anthropic API"
- "What are the latest developments in quantum computing?"

Wells will automatically:
1. Use the `web_search` tool
2. Get real-time results from Brave Search
3. Format and present the information
4. Cite sources with URLs

## Limitations

1. **Free Tier Limit**: 2,000 queries/month on free tier
2. **Cache Duration**: Results cached for 15 minutes (may not reflect very recent changes)
3. **Result Count**: Maximum 20 results per query (though 5-10 is recommended)
4. **No Image Search**: Currently text results only (can be added if needed)
5. **No Local Search**: General web search only (no "near me" functionality)

## Monitoring & Costs

### Free Tier Usage
- 2,000 queries/month free
- Approximately 65 queries per day
- Perfect for development and small-scale usage

### Paid Tier
- $5 per 1,000 queries after free tier
- No rate limits
- Example costs:
  - 10,000 queries/month = $40/month
  - 50,000 queries/month = $240/month
  - 100,000 queries/month = $490/month

### Cost Optimization
The implementation includes several cost-saving features:
- 15-minute cache (reduces duplicate queries)
- Configurable result counts (fewer results = same cost)
- Automatic cache cleanup
- Input validation prevents wasted queries

## Troubleshooting

### "Web search is not configured" Error
- **Cause**: `BRAVE_SEARCH_API_KEY` not set in environment
- **Solution**: Add your API key to `.env` file

### "Invalid Brave Search API key" Error
- **Cause**: API key is incorrect or expired
- **Solution**: Generate a new API key at brave.com/search/api

### "Rate limit exceeded" Error
- **Cause**: Free tier limit reached (2,000/month)
- **Solution**: Upgrade to paid tier or wait until next month

### No Results Found
- **Cause**: Query too specific or no matching results
- **Solution**: Try broader search terms or different query

### Slow Response
- **Cause**: First query (not cached) or network latency
- **Solution**: Results are cached for 15 minutes; subsequent identical queries will be fast

## Future Enhancements

Potential additions if needed:
- Image search support
- Video search integration
- Local/location-based search
- Advanced filtering (file type, site-specific)
- Search analytics dashboard
- Custom cache duration configuration
- Batch search support

## Support

- **Brave Search API Docs**: https://brave.com/search/api/docs/
- **API Dashboard**: https://brave.com/search/api/dashboard
- **Support**: https://brave.com/search/api/support

## Security Notes

- API key is server-side only (never exposed to client)
- No user data sent to Brave (privacy-focused)
- HTTPS-only communication
- Input validation prevents injection attacks
