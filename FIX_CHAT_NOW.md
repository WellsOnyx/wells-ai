# Fix Wells AI Chat - URGENT

The chat is failing because `ANTHROPIC_API_KEY` is not set in Vercel production.

## Quick Fix (5 minutes)

### Step 1: Get Your Anthropic API Key

1. Go to https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Name it: "Wells AI Production"
4. Copy the key (starts with `sk-ant-api03-...`)

### Step 2: Add to Vercel

1. Go to https://vercel.com/wellsonyxs-projects/wellsai/settings/environment-variables
2. Click "Add New"
3. Fill in:
   - **Key**: `ANTHROPIC_API_KEY`
   - **Value**: `[paste your API key]`
   - **Environments**: Check "Production", "Preview", "Development"
4. Click "Save"

### Step 3: Redeploy

```bash
cd /Users/jonahmanning/Downloads/wells-ai-github-ready
vercel --prod
```

OR

1. Go to https://vercel.com/wellsonyxs-projects/wellsai/deployments
2. Click the latest deployment
3. Click "... More" → "Redeploy"
4. Check "Use existing Build Cache"
5. Click "Redeploy"

### Step 4: Test

Wait 30 seconds, then go to https://wellsai.vercel.app and try the chat again.

---

## Other Required Environment Variables

While you're in Vercel settings, make sure these are also set:

### Required (Chat won't work without these):
- `ANTHROPIC_API_KEY` - Claude API key
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk auth
- `CLERK_SECRET_KEY` - Clerk auth

### Optional (Features work with graceful fallback):
- `NOTION_API_KEY` - For data storage
- `NOTION_DEALS_DATABASE_ID` - For deals
- `NOTION_RFQS_DATABASE_ID` - For RFQs
- `NOTION_SUPPLIERS_DATABASE_ID` - For suppliers
- `MERGE_API_KEY` - For ERP integration

### Get All Keys From:
- Anthropic: https://console.anthropic.com/settings/keys
- Clerk: https://dashboard.clerk.com/apps/[your-app]/api-keys
- Notion: https://www.notion.so/my-integrations
- Merge.dev: https://app.merge.dev/keys

---

## Why This Happened

The chat API requires Claude (Anthropic's API) to work. Without the API key:
1. Request hits `/api/chat`
2. Validation middleware passes
3. Chat route checks for `ANTHROPIC_API_KEY`
4. Key is missing → error thrown
5. User sees: "An unexpected error occurred"

---

## Quick Check

After redeploying, test with:

```bash
curl https://wellsai.vercel.app/api/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

Should return Claude's response, not an error.

---

## CRITICAL: Do This Now

1. Get Anthropic API key (2 min)
2. Add to Vercel (1 min)
3. Redeploy (1 min)
4. Test (30 sec)
5. **Total: 5 minutes to fix**

Then chat will work perfectly.
