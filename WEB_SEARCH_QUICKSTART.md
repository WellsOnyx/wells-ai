# Web Search - Quick Start Guide

Get Wells AI searching the web in 2 minutes.

## Step 1: Get Your API Key (30 seconds)

1. Go to **https://brave.com/search/api/**
2. Click "Get Started"
3. Sign up or sign in
4. Copy your API key (starts with `BSA...`)

## Step 2: Add to Environment (30 seconds)

Add this line to your `.env` file:

```bash
BRAVE_SEARCH_API_KEY=BSA1234567890abcdef...
```

## Step 3: Test It (1 minute)

Wells can now search the web! Try asking:

- "Search for the latest AI news"
- "Look up Next.js 14 features"
- "Find Anthropic Claude pricing"
- "What's happening with quantum computing?"

## That's It!

Wells now has real-time web search powered by Brave Search API.

### Free Tier Limits
- 2,000 queries per month (free)
- ~65 queries per day
- Perfect for development and small-scale usage

### Need More?
- Paid tier: $5 per 1,000 queries
- No rate limits
- Same great quality

## Usage in Code

```typescript
import { searchWeb } from '@/lib/integrations/web-search'

const result = await searchWeb({
  query: 'your search query',
  num_results: 5
})

if (result.success) {
  console.log(result.results)
}
```

## More Resources

- **Full Documentation**: See `WEB_SEARCH_SETUP.md`
- **Usage Examples**: See `lib/integrations/web-search.example.ts`
- **Test Suite**: See `lib/integrations/web-search.test.ts`
- **Brave API Docs**: https://brave.com/search/api/docs/

## Troubleshooting

**"Web search is not configured"**
→ Add `BRAVE_SEARCH_API_KEY` to your `.env` file

**"Invalid API key"**
→ Double-check your API key is correct and active

**"Rate limit exceeded"**
→ You've hit the 2,000/month limit. Upgrade to paid tier or wait until next month.

**No results found**
→ Try broader search terms

## Support

- Brave Search API Dashboard: https://brave.com/search/api/dashboard
- Wells AI Issues: See project README
