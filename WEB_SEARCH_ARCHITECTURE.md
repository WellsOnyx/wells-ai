# Web Search Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Wells AI User                           │
│                  (Asks: "Search for AI news")                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Wells AI (Claude)                          │
│              Detects need for web search tool                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    lib/tools/index.ts                            │
│              executeWebSearch(input, context)                    │
│                                                                   │
│  1. Validates input (query, num_results)                         │
│  2. Imports web-search integration                               │
│  3. Calls searchWeb()                                            │
│  4. Formats results                                              │
│  5. Returns to Wells AI                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              lib/integrations/web-search.ts                      │
│                   searchWeb(options)                             │
│                                                                   │
│  1. Validate input                                               │
│  2. Check cache (15 min TTL)                    ┌──────────┐    │
│  3. If cached → return cached results ─────────▶│  Cache   │    │
│  4. If not cached → continue                    │  Memory  │    │
│  5. Check API key configured                    └──────────┘    │
│  6. Build API request                                            │
│  7. Call Brave Search API ──────────────────────┐               │
│  8. Parse response                               │               │
│  9. Cache results                                │               │
│ 10. Return formatted results                     │               │
└──────────────────────────────────────────────────┼──────────────┘
                                                    │
                                                    ▼
                           ┌─────────────────────────────────────┐
                           │     Brave Search API (External)     │
                           │   https://api.search.brave.com      │
                           │                                     │
                           │  • Receives search query            │
                           │  • Searches web + news              │
                           │  • Returns JSON results             │
                           │  • Tracks API usage                 │
                           └─────────────────────────────────────┘
```

## Request Flow

### 1. User Request
```
User: "Search for the latest AI news"
```

### 2. Wells AI Processing
```typescript
// Wells detects need for web_search tool
{
  name: 'web_search',
  input: {
    query: 'latest AI news',
    num_results: 5
  }
}
```

### 3. Tool Execution
```typescript
// lib/tools/index.ts
async function executeWebSearch(input, context) {
  const { searchWeb, formatSearchResults } = await import('../integrations/web-search')

  const searchResponse = await searchWeb({
    query: input.query,
    num_results: input.num_results || 5
  })

  return {
    success: true,
    result: {
      query: input.query,
      results: searchResponse.results,
      formatted: formatSearchResults(searchResponse.results, input.query)
    }
  }
}
```

### 4. Web Search Integration
```typescript
// lib/integrations/web-search.ts
export async function searchWeb(options: WebSearchOptions) {
  // 1. Check cache
  const cacheKey = `${query}:${num_results}:${freshness}`
  const cached = searchCache.get(cacheKey)
  if (cached && !expired) {
    return { success: true, results: cached.results, cached: true }
  }

  // 2. Call Brave API
  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${query}`,
    {
      headers: {
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
      }
    }
  )

  // 3. Parse and cache
  const data = await response.json()
  const results = parseResults(data)
  searchCache.set(cacheKey, { results, timestamp: Date.now() })

  return { success: true, results, cached: false }
}
```

### 5. Brave API Request
```
GET https://api.search.brave.com/res/v1/web/search?q=latest%20AI%20news&count=5
Headers:
  X-Subscription-Token: BSA...
  Accept: application/json
```

### 6. Brave API Response
```json
{
  "web": {
    "results": [
      {
        "title": "Latest AI News - TechCrunch",
        "url": "https://techcrunch.com/ai-news",
        "description": "Breaking news about AI technology..."
      },
      // ... more results
    ]
  },
  "news": {
    "results": [
      {
        "title": "AI Breakthrough Announced Today",
        "url": "https://reuters.com/...",
        "description": "Researchers announce...",
        "age": "2 hours ago"
      }
    ]
  }
}
```

### 7. Parsed Results
```typescript
[
  {
    title: "Latest AI News - TechCrunch",
    url: "https://techcrunch.com/ai-news",
    snippet: "Breaking news about AI technology...",
    published_date: undefined
  },
  {
    title: "AI Breakthrough Announced Today",
    url: "https://reuters.com/...",
    snippet: "Researchers announce...",
    published_date: "2 hours ago"
  },
  // ... more results
]
```

### 8. Formatted Response
```
Search results for "latest AI news":

1. Latest AI News - TechCrunch
   URL: https://techcrunch.com/ai-news
   Breaking news about AI technology...

2. AI Breakthrough Announced Today
   URL: https://reuters.com/...
   Researchers announce...
   Published: 2 hours ago

3. ...
```

### 9. Wells AI Response
```
I found the latest AI news for you:

1. **Latest AI News - TechCrunch**
   Breaking news about AI technology...
   [Read more](https://techcrunch.com/ai-news)

2. **AI Breakthrough Announced Today** (2 hours ago)
   Researchers announce...
   [Read more](https://reuters.com/...)

Would you like me to search for something more specific?
```

## Data Flow Diagram

```
┌──────────┐     query      ┌──────────┐    API call    ┌───────────┐
│   User   │ ──────────────▶│  Wells   │ ─────────────▶│  Tools    │
└──────────┘                └──────────┘                └─────┬─────┘
     ▲                                                         │
     │                                                         ▼
     │                                                  ┌─────────────┐
     │                                                  │ Web Search  │
     │                                                  │ Integration │
     │                                                  └──────┬──────┘
     │                                                         │
     │                                                   ┌─────▼─────┐
     │                                                   │   Cache?  │
     │                                                   └─────┬─────┘
     │                                                         │
     │                                                  Yes ───┴─── No
     │                                                   │           │
     │                                              ┌────▼───┐       ▼
     │                                              │ Return │  ┌────────┐
     │                                              │ Cached │  │ Brave  │
     │                                              └────┬───┘  │  API   │
     │                                                   │      └────┬───┘
     │                                                   │           │
     │     formatted results                             │      ┌────▼────┐
     └───────────────────────────────────────────────────┴──────┤ Parse & │
                                                                 │  Cache  │
                                                                 └─────────┘
```

## Caching Strategy

### Cache Key Structure
```
{query}:{num_results}:{freshness}
```

Examples:
- `"AI news":5:null`
- `"Next.js":10:past_week`

### Cache Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                    Search Request                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ Generate Cache   │
              │ Key from Query   │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Cache Lookup    │
              └────────┬─────────┘
                       │
             ┌─────────┴─────────┐
             │                   │
          Found              Not Found
             │                   │
             ▼                   ▼
     ┌──────────────┐   ┌──────────────┐
     │ Check Age    │   │  Call API    │
     └──────┬───────┘   └──────┬───────┘
            │                  │
      ┌─────┴─────┐           │
      │           │           │
   < 15min     > 15min        │
      │           │           │
      ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Return  │ │  Delete  │ │  Cache   │
│  Cached  │ │   Old    │ │   New    │
│  Result  │ │  Entry   │ │  Result  │
└──────────┘ └─────┬────┘ └────┬─────┘
                   │            │
                   ▼            ▼
              ┌──────────┐ ┌──────────┐
              │ Call API │ │  Return  │
              └─────┬────┘ │  Result  │
                    │      └──────────┘
                    ▼
               ┌──────────┐
               │  Cache   │
               │   New    │
               │  Result  │
               └─────┬────┘
                     │
                     ▼
               ┌──────────┐
               │  Return  │
               │  Result  │
               └──────────┘
```

### Cache Benefits
1. **Reduced API Calls**: 15-minute cache prevents duplicate queries
2. **Cost Savings**: Fewer API calls = lower costs
3. **Faster Response**: Cached results return instantly
4. **Better UX**: No waiting for repeated queries

### Cache Limitations
1. **Stale Data**: Results may be up to 15 minutes old
2. **Memory Usage**: Cache grows with unique queries
3. **Not Persistent**: Cache cleared on restart

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Search Request                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ Validate Input   │
              └────────┬─────────┘
                       │
              ┌────────┴────────┐
              │                 │
           Valid            Invalid
              │                 │
              ▼                 ▼
     ┌──────────────┐   ┌──────────────┐
     │ Check API    │   │ Return Error │
     │ Key Config   │   │ "Invalid     │
     └──────┬───────┘   │  Input"      │
            │           └──────────────┘
       ┌────┴────┐
       │         │
   Configured  Missing
       │         │
       ▼         ▼
┌──────────┐ ┌──────────────┐
│ Call API │ │ Return Error │
└─────┬────┘ │ "Not         │
      │      │  Configured" │
      │      └──────────────┘
      ▼
┌──────────────┐
│ API Response │
└──────┬───────┘
       │
  ┌────┴────┐
  │         │
200 OK    Error
  │         │
  ▼         ▼
┌─────┐  ┌───────────────┐
│Parse│  │ Error Handler │
└──┬──┘  └───────┬───────┘
   │             │
   │      ┌──────┴──────┐
   │      │             │
   │    401          429
   │  (Invalid)   (Rate Limit)
   │      │             │
   ▼      ▼             ▼
┌────┐ ┌────┐       ┌────┐
│ OK │ │Err │       │Err │
└────┘ └────┘       └────┘
```

## Component Responsibilities

### 1. lib/tools/index.ts
**Responsibility**: Tool orchestration
- Validates tool input
- Routes to correct integration
- Formats response for Wells AI
- Handles tool errors

### 2. lib/integrations/web-search.ts
**Responsibility**: Web search implementation
- Manages Brave API communication
- Handles caching strategy
- Validates search parameters
- Parses API responses
- Error handling and recovery

### 3. Brave Search API
**Responsibility**: Search execution
- Indexes and searches web
- Returns relevant results
- Tracks API usage
- Rate limiting

## Security Architecture

```
┌──────────────────────────────────────────────────┐
│              Client (Browser)                     │
│  - No API key access                              │
│  - No direct API calls                            │
│  - Communicates via Wells AI only                 │
└──────────────────────┬───────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────┐
│           Wells AI Server (Next.js)               │
│                                                   │
│  ┌─────────────────────────────────────────┐    │
│  │  Environment Variables (Server-Side)    │    │
│  │  - BRAVE_SEARCH_API_KEY (secret)        │    │
│  │  - Never sent to client                  │    │
│  └─────────────────────────────────────────┘    │
│                                                   │
│  ┌─────────────────────────────────────────┐    │
│  │  Input Validation                        │    │
│  │  - Sanitize query                        │    │
│  │  - Validate num_results (1-20)          │    │
│  │  - Type checking                         │    │
│  └─────────────────────────────────────────┘    │
└──────────────────────┬───────────────────────────┘
                       │ HTTPS + API Key
                       ▼
┌──────────────────────────────────────────────────┐
│            Brave Search API                       │
│  - Requires valid API key                         │
│  - Rate limiting                                  │
│  - No user tracking                               │
└──────────────────────────────────────────────────┘
```

## Performance Metrics

### Without Cache
```
Average Response Time: 500-1000ms
- API call: 400-800ms
- Parsing: 50-100ms
- Formatting: 50-100ms
```

### With Cache (Hit)
```
Average Response Time: 1-5ms
- Cache lookup: 1-2ms
- Formatting: 1-3ms
```

### Cache Hit Rate Estimate
- First query: 0% (must fetch)
- Repeated query (< 15min): 100% (cached)
- Average over time: ~30-50% (depends on query diversity)

## Scalability Considerations

### Current Implementation
- In-memory cache (single process)
- Suitable for: Single server, moderate traffic
- Limitations: Cache not shared across instances

### For High Scale (Future)
1. **Distributed Cache**: Redis or Memcached
2. **CDN Caching**: Cache at edge for faster responses
3. **Request Batching**: Combine similar queries
4. **Result Pagination**: Load more results on demand
5. **Background Refresh**: Update cache before expiry

## Monitoring Points

### Key Metrics to Track
1. **API Usage**: Queries per day/month
2. **Cache Hit Rate**: Cached vs fresh queries
3. **Response Time**: Average latency
4. **Error Rate**: Failed queries percentage
5. **Cost**: Monthly API spending

### Recommended Monitoring
```typescript
// Log these metrics
{
  timestamp: Date.now(),
  query: sanitized_query,
  num_results: 5,
  cached: true/false,
  response_time_ms: 234,
  success: true/false,
  error: null
}
```

## Conclusion

The web search architecture is designed to be:
- **Simple**: Clear separation of concerns
- **Efficient**: 15-minute caching reduces API calls
- **Reliable**: Comprehensive error handling
- **Secure**: API keys server-side only
- **Scalable**: Can be enhanced with distributed caching
- **Cost-Effective**: Caching minimizes API usage

The implementation is production-ready and can scale as needed.
