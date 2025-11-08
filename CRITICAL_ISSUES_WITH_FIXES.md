# WELLS AI - CRITICAL ISSUES WITH SPECIFIC FIXES

## ISSUE #1: Post-Login Redirect Goes to Wrong Page
**File:** `/app/sign-up/[[...sign-up]]/page.tsx` and `/app/sign-in/page.tsx`
**Severity:** CRITICAL
**Impact:** Users confused after login, no path to chat
**Time to Fix:** 30 minutes

### Current Code (WRONG):
```typescript
// app/sign-up/[[...sign-up]]/page.tsx
<SignUp
  redirectUrl="/"  // <-- PROBLEM: Goes to marketing landing page
  // ... other props
/>
```

### Problem:
- `/` is the marketing landing page (LuxuryLanding component)
- Landing page has no "go to chat" button
- Users land and see marketing, not chat interface
- They have no idea where to go next

### Solution Option A (Simple):
```typescript
// app/sign-up/[[...sign-up]]/page.tsx
<SignUp
  redirectUrl="/chat"  // <-- Fixed: Goes directly to chat
  // ... other props
/>

// app/sign-in/page.tsx
<SignIn
  redirectUrl="/chat"  // <-- Fixed: Goes directly to chat
  // ... other props
/>
```

### Solution Option B (Better):
Create a post-login redirect page that determines where to send user:

```typescript
// app/auth/post-login/page.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function PostLoginPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      router.push('/sign-in')
      return
    }

    // Check if user has completed onboarding
    const hasCompletedOnboarding = user.publicMetadata?.onboardingComplete

    if (hasCompletedOnboarding) {
      // Return user to chat
      router.push('/chat')
    } else {
      // New user - show onboarding first
      router.push('/chat?showOnboarding=true')
    }
  }, [isLoaded, user, router])

  return <div>Redirecting...</div>
}
```

Then update sign-up/in:
```typescript
<SignUp redirectUrl="/auth/post-login" />
<SignIn redirectUrl="/auth/post-login" />
```

**Recommendation:** Use Option B - it enables smarter onboarding flow

---

## ISSUE #2: Onboarding Not Integrated with Chat
**File:** `/app/api/chat/route.ts` and `/app/components/WellsAIContent.tsx`
**Severity:** CRITICAL
**Impact:** Users skip onboarding, chat defaults to "buyer", no personalization
**Time to Fix:** 2 hours

### Current Code (BROKEN):
```typescript
// WellsAIContent.tsx (line 152)
setUserData({
  name: userName,
  email: primaryEmail,
  userType: 'buyer' // <-- PROBLEM: Default, not from onboarding
})

// chat/route.ts (line 280-295)
// LEGENDARY ONBOARDING: Temporarily disabled until full integration is complete
// TODO: Properly integrate legendary onboarding system
```

### Problems:
1. No check if onboarding is complete
2. Falls back to hardcoded 'buyer' type
3. Onboarding modal not shown
4. No way to change userType after signup
5. Legendary onboarding is disabled

### Solution:

**Step 1: Update WellsAIContent.tsx to check onboarding**
```typescript
// app/components/WellsAIContent.tsx

useEffect(() => {
  if (isLoaded && user) {
    const primaryEmail = user.emailAddresses?.[0]?.emailAddress
    const userName = user.fullName || user.firstName || user.username

    if (primaryEmail && userName) {
      // Check if onboarding is complete
      const onboardingComplete = user.publicMetadata?.onboardingComplete
      const savedUserType = user.publicMetadata?.userType

      // If not complete, show onboarding modal
      if (!onboardingComplete) {
        setShowOnboardingModal(true)
      }

      setUserData({
        name: userName,
        email: primaryEmail,
        userType: savedUserType || 'buyer'
      })
    }
  }
}, [isLoaded, user])
```

**Step 2: Create onboarding modal component**
```typescript
// app/components/OnboardingModal.tsx
'use client'

import { useState } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import Onboarding from './Onboarding'

export default function OnboardingModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean
  onClose: () => void 
}) {
  const { user } = useUser()
  const clerk = useClerk()

  const handleOnboardingComplete = async (userData: any) => {
    if (!user) return

    // Save to Clerk metadata
    await user.update({
      publicMetadata: {
        onboardingComplete: true,
        userType: userData.userType,
        company: userData.company,
        industry: userData.industry
      }
    })

    // Close modal and refresh
    onClose()
    await clerk.reloadUser()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-screen overflow-auto">
        <Onboarding onComplete={handleOnboardingComplete} />
      </div>
    </div>
  )
}
```

**Step 3: Use in WellsAIContent**
```typescript
// app/components/WellsAIContent.tsx
const [showOnboardingModal, setShowOnboardingModal] = useState(false)

return (
  <>
    <OnboardingModal 
      isOpen={showOnboardingModal} 
      onClose={() => setShowOnboardingModal(false)}
    />
    {/* rest of chat */}
  </>
)
```

---

## ISSUE #3: NextAuth Configuration Unused & Conflicting
**File:** `/lib/auth.ts`, `/middleware.ts`
**Severity:** HIGH (Technical debt)
**Impact:** Confusion about which auth system is active, maintenance burden
**Time to Fix:** 1 hour

### Current Code (WRONG):
```typescript
// middleware.ts uses Clerk
export default clerkMiddleware(async (auth, req) => {
  // ... Clerk auth logic
})

// But /lib/auth.ts has NextAuth config (never used)
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: { ... },
      from: process.env.EMAIL_FROM
    })
  ]
  // ...
}
```

### Problem:
- Two auth systems configured
- Code is confusing to new developers
- NextAuth config will break if not maintained
- Email verification logic undefined (which system?)

### Solution: Remove NextAuth
```bash
# 1. Delete the file
rm lib/auth.ts

# 2. Update package.json (remove unused dependencies)
# Remove: next-auth, @auth/prisma-adapter
npm uninstall next-auth @auth/prisma-adapter

# 3. Delete any NextAuth routes
rm app/api/auth/[...nextauth]/route.ts

# 4. Verify middleware only uses Clerk
# (already correct in middleware.ts)
```

**Note:** Email verification is now handled by Clerk automatically (better!)

---

## ISSUE #4: Memory System Silently Fails
**File:** `/app/api/chat/route.ts` (lines 322-351)
**Severity:** HIGH
**Impact:** No context retention if DB misconfigured, user thinks Wells is stateless
**Time to Fix:** 1 hour

### Current Code (WRONG):
```typescript
// chat/route.ts
if (userData?.userId) {
  try {
    const conversation = await getOrCreateConversation({
      userId: userData.userId,
      sessionId,
      device: userData.device,
      source: userData.source
    })

    conversationId = conversation.id
    const context = await buildConversationContext(userData.userId, sessionId)
    memoryContext = formatContextForPrompt(context)

    console.log('[MEMORY] Loaded conversation context...')
  } catch (error) {
    console.error('[MEMORY] Failed to load context (non-critical):', error)
    // <-- PROBLEM: Silently continues without memory!
  }
}
```

### Problems:
1. If database not configured, error is ignored
2. User gets fresh conversation each time (thinks Wells is dumb)
3. No warning that memory is not working
4. System degraded but user unaware

### Solution A (Fail Hard):
```typescript
if (userData?.userId) {
  if (!process.env.DATABASE_URL) {
    console.error('[MEMORY] DATABASE_URL not configured - memory disabled')
    return NextResponse.json({
      error: 'Database not configured. Please set DATABASE_URL environment variable.',
      details: process.env.NODE_ENV === 'development' 
        ? 'Memory/conversation history requires PostgreSQL database'
        : undefined
    }, { status: 500 })
  }

  try {
    const conversation = await getOrCreateConversation({
      userId: userData.userId,
      sessionId,
      device: userData.device,
      source: userData.source
    })

    conversationId = conversation.id
    const context = await buildConversationContext(userId, sessionId)
    memoryContext = formatContextForPrompt(context)

    console.log('[MEMORY] Loaded conversation context for user:', userId)
  } catch (error) {
    console.error('[MEMORY] CRITICAL: Failed to load conversation:', error)
    // Don't silently fail - memory is critical
    throw new Error(`Memory system failed: ${error.message}`)
  }
}
```

### Solution B (Use Fallback - Better):
```typescript
if (userData?.userId) {
  let memoryWorking = true

  // Try to load from database
  if (process.env.DATABASE_URL) {
    try {
      const conversation = await getOrCreateConversation({
        userId: userData.userId,
        sessionId,
        device: userData.device,
        source: userData.source
      })

      conversationId = conversation.id
      const context = await buildConversationContext(userData.userId, sessionId)
      memoryContext = formatContextForPrompt(context)

      console.log('[MEMORY] Loaded from database')
    } catch (error) {
      console.error('[MEMORY] Database failed, using fallback:', error)
      memoryWorking = false
    }
  } else {
    console.warn('[MEMORY] DATABASE_URL not set, using session-only memory')
    memoryWorking = false
  }

  // If database failed, try session-based memory
  if (!memoryWorking && messages.length > 0) {
    // Build context from conversation history (sessionId is in URL)
    const recentMessages = messages.slice(-10) // Last 10 messages
    memoryContext = `This conversation has ${messages.length} messages in this session.`
    
    console.log('[MEMORY] Using session memory fallback')
  }
}

// Return memory status to client
return NextResponse.json({
  message: finalAssistantMessage,
  // ... other data
  _debug: process.env.NODE_ENV === 'development' ? {
    memoryAvailable: conversationId !== undefined,
    memorySource: conversationId ? 'database' : 'session'
  } : undefined
})
```

**Recommendation:** Use Solution B - graceful degradation with clear user feedback

---

## ISSUE #5: Environment Variables Missing from Template
**File:** `.env.example`
**Severity:** MEDIUM
**Impact:** New developers can't see what variables are needed, silent failures
**Time to Fix:** 30 minutes

### Current Code (INCOMPLETE):
```bash
# .env.example

# Missing Clerk variables!
# Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# Missing CLERK_SECRET_KEY

# NextAuth (now unused)
NEXTAUTH_URL=...
NEXTAUTH_SECRET=...
```

### Solution: Create complete .env.example

```bash
# .env.example - Complete Environment Variable Template

# ============================================================================
# AUTHENTICATION - Clerk (Primary)
# ============================================================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# ============================================================================
# CRITICAL - Application Core
# ============================================================================

# Claude AI API
ANTHROPIC_API_KEY=sk-ant-api03-...

# Database - PostgreSQL (REQUIRED for full functionality)
DATABASE_URL=postgresql://user:password@localhost:5432/wells_ai

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# ============================================================================
# OPTIONAL - Integration Services
# ============================================================================

# Notion CRM (for GTM campaigns)
NOTION_API_KEY=secret_...
NOTION_DEALS_DATABASE_ID=...
NOTION_SUPPLIERS_DB_ID=...
NOTION_REQUESTS_DB_ID=...
NOTION_CRM_DATABASE_ID=...

# Instantly.ai (for email campaigns)
# Use Wells' shared account OR your own
INSTANTLY_API_KEY=...
INSTANTLY_CAMPAIGN_ID=...
WELLS_INSTANTLY_API_KEY=...

# Twilio (for SMS notifications)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Email (via SendGrid)
SENDGRID_API_KEY=SG...

# ============================================================================
# OPTIONAL - Payment Services
# ============================================================================

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Airwallex
AIRWALLEX_CLIENT_ID=...
AIRWALLEX_API_KEY=...
AIRWALLEX_ACCOUNT_ID=...

# Circle API (for GRAIN & Vault)
CIRCLE_API_KEY=...

# ============================================================================
# OPTIONAL - Features
# ============================================================================

# Vector Database (Pinecone) - for semantic search
PINECONE_API_KEY=...
PINECONE_INDEX=...

# Cron Jobs
CRON_SECRET=...

# Feature Flags
GRAIN_ENABLED=false
CREDIT_LINES_ENABLED=false
TREASURY_YIELD_ENABLED=false
IN_NETWORK_ENABLED=false

# ============================================================================
# DEPLOYMENT
# ============================================================================

# Development
NODE_ENV=development

# Sentry (Error tracking)
NEXT_PUBLIC_SENTRY_DSN=...

# ============================================================================
# NOTES
# ============================================================================
# 
# REQUIRED for basic functionality:
# - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# - CLERK_SECRET_KEY  
# - ANTHROPIC_API_KEY
# 
# REQUIRED for chat persistence:
# - DATABASE_URL
#
# REQUIRED for GTM features:
# - NOTION_API_KEY
# - NOTION_DEALS_DATABASE_ID
# - INSTANTLY_API_KEY (or WELLS_INSTANTLY_API_KEY)
#
# Everything else is optional and can be added later.
```

Also create a validation script:

```typescript
// scripts/validate-env.ts
import * as fs from 'fs'

const REQUIRED_VARS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'ANTHROPIC_API_KEY'
]

const RECOMMENDED_VARS = [
  'DATABASE_URL',
  'NOTION_API_KEY',
  'INSTANTLY_API_KEY'
]

function validateEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v])
  const missingRecommended = RECOMMENDED_VARS.filter(v => !process.env[v])

  if (missing.length > 0) {
    console.error('MISSING REQUIRED VARIABLES:')
    missing.forEach(v => console.error(`  - ${v}`))
    process.exit(1)
  }

  if (missingRecommended.length > 0) {
    console.warn('WARNING: Missing recommended variables:')
    missingRecommended.forEach(v => console.warn(`  - ${v}`))
    console.warn('  Some features may not work.')
  }

  console.log('✅ Environment validation passed')
}

validateEnv()
```

---

## ISSUE #6: GTM Campaign Stored in Wrong Place
**File:** `/app/api/gtm/campaign/create/route.ts` (line 55-61)
**Severity:** MEDIUM
**Impact:** Campaigns not properly persisted, can't list/edit campaigns
**Time to Fix:** 2 hours

### Current Code (WRONG):
```typescript
// Storing campaign in Clerk publicMetadata (wrong place!)
const existingCampaigns = (user.publicMetadata.gtmCampaigns as any[]) || []
await client.users.updateUserMetadata(userId, {
  publicMetadata: {
    ...user.publicMetadata,
    gtmCampaigns: [...existingCampaigns, campaign],
  },
})
```

### Problems:
1. Clerk metadata has size limits (10KB)
2. Can't search/filter campaigns
3. Can't version control campaign changes
4. No analytics storage
5. Can't query across users

### Solution: Use Prisma model

First, add to schema:

```prisma
// prisma/schema.prisma

model GTMCampaign {
  id              String  @id @default(uuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  userId          String
  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  name            String
  userRequest     String  @db.Text
  status          String  @default("draft")  // draft, active, paused, completed
  
  icp             Json?   // ICP analysis
  prospects       Json?   // List of prospects
  messages        Json?   // Campaign messages
  
  instantlyApiKey String?
  instantlyCampaignId String?
  
  metricsOpens    Int @default(0)
  metricsClicks   Int @default(0)
  metricsReplies  Int @default(0)
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

model User {
  // ... existing fields
  gtmCampaigns    GTMCampaign[]
}
```

Then update the route:

```typescript
// app/api/gtm/campaign/create/route.ts
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { request: userRequest } = body

    // Get credentials
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const notionApiKey = user.privateMetadata.notionApiKey as string
    const notionDealsDbId = user.privateMetadata.notionDealsDbId as string

    if (!notionApiKey || !notionDealsDbId) {
      return NextResponse.json(
        { error: 'Notion not connected' },
        { status: 400 }
      )
    }

    // Create campaign
    const campaign = await createCampaign({ userId, userRequest, notionApiKey, notionDealsDbId })

    // Save to database instead of Clerk metadata
    const savedCampaign = await prisma.gTMCampaign.create({
      data: {
        userId,
        name: campaign.name || userRequest.substring(0, 100),
        userRequest,
        status: 'draft',
        icp: campaign.icp,
        prospects: campaign.prospects,
        messages: campaign.messages
      }
    })

    return NextResponse.json({
      success: true,
      campaign: {
        id: savedCampaign.id,
        status: savedCampaign.status,
        prospectCount: campaign.prospects?.length || 0,
        messageCount: campaign.messages?.length || 0,
      }
    })
  } catch (error: any) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
```

---

## Summary of Fixes
| Issue | Severity | Time | File | Priority |
|-------|----------|------|------|----------|
| Post-login redirect | CRITICAL | 30m | sign-up, sign-in | DO FIRST |
| Onboarding integration | CRITICAL | 2h | WellsAIContent.tsx, chat | DO SECOND |
| Memory system optional | HIGH | 1h | chat/route.ts | DO THIRD |
| NextAuth unused | HIGH | 1h | auth.ts, middleware | DO FOURTH |
| Env vars incomplete | MEDIUM | 30m | .env.example | DO FIFTH |
| Campaign storage | MEDIUM | 2h | gtm/campaign/create | DO SIXTH |

**Total time to fix critical blockers:** ~7-8 hours
**Recommended sprint:** This week

