# Integrations Library

This directory contains integration modules for Wells AI to connect with external services and APIs.

## Available Integrations

### 1. Web Search (`web-search.ts`)

Real-time web search powered by Brave Search API.

**Quick Start:**
```typescript
import { searchWeb } from '@/lib/integrations/web-search'

const result = await searchWeb({
  query: 'Next.js best practices',
  num_results: 5
})
```

**Setup:**
1. Get API key from https://brave.com/search/api/
2. Add `BRAVE_SEARCH_API_KEY=your-key` to `.env`
3. Start using!

**Features:**
- ✅ Real-time web search
- ✅ 15-minute caching
- ✅ News integration
- ✅ Freshness filters
- ✅ Graceful error handling
- ✅ 2,000 free queries/month

**See Also:**
- `web-search.example.ts` - Usage examples
- `web-search.test.ts` - Test suite
- `/WEB_SEARCH_SETUP.md` - Full documentation

### 2. Gmail (`gmail.ts`)

Gmail integration for reading and sending emails.

### 3. Slack (`slack.ts`)

Slack workspace integration for messaging and notifications.

### 4. Jira (`jira.ts`)

Jira integration for project management and issue tracking.

### 5. Salesforce (`salesforce.ts`)

Salesforce CRM integration for customer data.

## Adding New Integrations

When adding a new integration:

1. Create a new file: `lib/integrations/your-integration.ts`
2. Follow this structure:

```typescript
/**
 * [Service Name] Integration
 *
 * Brief description of what this integration does.
 *
 * ENVIRONMENT VARIABLES:
 * - SERVICE_API_KEY: Description
 * - SERVICE_BASE_URL: Description (optional)
 *
 * SETUP:
 * 1. Get API key from [URL]
 * 2. Add to .env
 * 3. Configure settings
 */

// Type definitions
export interface ServiceOptions {
  // ...
}

export interface ServiceResponse {
  success: boolean
  data?: any
  error?: string
}

// Main function
export async function yourService(options: ServiceOptions): Promise<ServiceResponse> {
  // Implementation
}

// Helper functions
```

3. Add environment variables to `.env.example`
4. Create usage examples in `your-integration.example.ts`
5. Add tests in `your-integration.test.ts`
6. Document in this README

## Best Practices

### Error Handling
Always handle errors gracefully:
```typescript
try {
  const result = await externalAPI()
  return { success: true, data: result }
} catch (error) {
  console.error('[SERVICE] Error:', error)
  return { success: false, error: error.message }
}
```

### Environment Variables
Check for required env vars and provide helpful error messages:
```typescript
const apiKey = process.env.SERVICE_API_KEY
if (!apiKey) {
  return {
    success: false,
    error: 'SERVICE_API_KEY not configured. Get your key at https://...'
  }
}
```

### Caching
Implement caching for expensive operations:
```typescript
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

// Check cache
const cached = cache.get(key)
if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
  return cached.data
}

// Fetch and cache
const data = await fetchData()
cache.set(key, { data, timestamp: Date.now() })
```

### TypeScript Types
Always define clear types for inputs and outputs:
```typescript
export interface RequestOptions {
  required: string
  optional?: number
}

export interface Response {
  success: boolean
  data?: any
  error?: string
}
```

### Logging
Use consistent logging prefixes:
```typescript
console.log('[SERVICE_NAME] Action performed:', data)
console.error('[SERVICE_NAME] Error:', error)
console.warn('[SERVICE_NAME] Warning:', warning)
```

## Testing

Each integration should have a test file:

```typescript
// your-integration.test.ts
import { yourService } from './your-integration'

async function testYourService() {
  console.log('Testing Your Service...\n')

  const result = await yourService({
    // test options
  })

  if (result.success) {
    console.log('✅ Test passed!')
  } else {
    console.log('❌ Test failed:', result.error)
  }
}

if (require.main === module) {
  testYourService().catch(console.error)
}
```

## Security

- Never commit API keys or secrets
- Keep all API keys in environment variables
- Use server-side functions only (never expose keys to client)
- Validate and sanitize all inputs
- Handle sensitive data appropriately

## Support

For integration-specific help, see the individual integration documentation or check:
- `.env.example` for required environment variables
- `*.example.ts` files for usage examples
- `*.test.ts` files for testing
- Project root for setup guides (e.g., `WEB_SEARCH_SETUP.md`)
