# Job Seeker System - Integration & Deployment Guide

## System Integration Points

### 1. Wells AI Core Platform

**Chat Interface:**
- ✅ Intent detection added for job seeker queries
- ✅ Response includes `jobSeekerData` object
- ✅ Keywords: job, career, resume, employment
- ✅ Routes users to onboarding or dashboard

**Location:** `/app/api/chat/route.ts`

**Integration Code:**
```typescript
// In chat route response
{
  message: string,
  procurementData: null,
  gtmData: null,
  jobSeekerData: {           // NEW
    hasProfile: boolean,
    needsOnboarding?: boolean,
    matchCount?: number,
    topMatches?: JobMatch[]
  }
}
```

### 2. Existing RFQ System

**Notion Integration:**
- ✅ Reads from existing RFQ database
- ✅ Filters for "Executive Talent" category
- ✅ Respects organization boundaries
- ✅ Status-aware matching

**Location:** `/lib/notion.ts` (uses `getRFQs()`, `getRFQById()`)

**Data Flow:**
```
Notion RFQs (Executive Talent)
    ↓
Job Matching Engine
    ↓
Compatibility Scoring
    ↓
Job Seeker Dashboard
```

### 3. Clerk Authentication

**Profile Storage:**
- ✅ Profiles in `user.publicMetadata.jobSeekerProfile`
- ✅ Applications in `user.publicMetadata.jobApplications`
- ✅ Secure, user-scoped access
- ✅ Organization-aware (future)

**Location:** All `/app/api/job-seeker/*` routes

**Schema:**
```typescript
user.publicMetadata = {
  jobSeekerProfile: {
    id: string,
    name: string,
    email: string,
    currentRole: string,
    desiredRole: string,
    skills: string[],
    experience: string,
    location: string,
    preferences: {...},
    createdDate: string,
    updatedDate: string
  },
  jobApplications: [
    {
      id: string,
      rfqId: string,
      jobSeekerName: string,
      coverLetter: string,
      appliedDate: string,
      status: string
    }
  ]
}
```

### 4. Notification System

**SMS (Twilio):**
- ✅ Template pattern matches supplier notifications
- ✅ Application submission alerts
- ✅ Status updates (future)

**Location:** `/app/api/job-seeker/apply/route.ts`

**Message Format:**
```
🔷 WELLS AI - NEW CANDIDATE

Job: {position}
Candidate: {name}
Current Role: {role}
Skills: {skills}

View Application: {link}

Reply: 1=Interview | 2=Pass
```

### 5. AI Services (Claude)

**Resume Parser:**
- ✅ Extracts structured data from text
- ✅ Provides ATS score
- ✅ Suggests improvements

**Cover Letter Generator:**
- ✅ Personalized to job and candidate
- ✅ Professional tone
- ✅ 250-350 words

**Location:** `/lib/job-seeker/resume-parser.ts`

**API Calls:**
```typescript
// Uses Claude Sonnet 4
model: 'claude-sonnet-4-20250514'
max_tokens: 2000-4000
```

## Deployment Checklist

### Pre-Deployment

- [ ] **Environment Variables Set**
  - [ ] `ANTHROPIC_API_KEY` (required for AI features)
  - [ ] `CLERK_SECRET_KEY` (required for auth)
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (required)
  - [ ] `TWILIO_ACCOUNT_SID` (optional for SMS)
  - [ ] `TWILIO_AUTH_TOKEN` (optional)
  - [ ] `TWILIO_PHONE_NUMBER` (optional)
  - [ ] `NEXT_PUBLIC_APP_URL` (required for links)

- [ ] **Database Setup**
  - [ ] Notion RFQ database has "Executive Talent" category
  - [ ] RFQ database includes required fields
  - [ ] Test RFQs created for matching

- [ ] **Clerk Configuration**
  - [ ] Public metadata enabled
  - [ ] User object includes email
  - [ ] Organizations configured (if multi-org)

- [ ] **Testing Complete**
  - [ ] Onboarding flow (all 4 steps)
  - [ ] Resume parsing
  - [ ] Job matching
  - [ ] Application submission
  - [ ] Dashboard loading
  - [ ] Applications tracking

### Deployment Steps

1. **Build Application:**
```bash
npm run build
```

2. **Deploy to Vercel/Platform:**
```bash
vercel deploy --prod
# or your deployment command
```

3. **Verify Environment Variables:**
```bash
vercel env ls
# Check all required vars are set
```

4. **Test Production:**
- [ ] Visit `/job-seeker/onboarding`
- [ ] Complete test profile
- [ ] Verify matching works
- [ ] Test application flow
- [ ] Check notifications

5. **Monitor Logs:**
```bash
vercel logs
# Watch for errors
```

### Post-Deployment

- [ ] **Smoke Tests**
  - [ ] Onboarding works
  - [ ] Dashboard loads
  - [ ] Matches appear
  - [ ] Applications submit
  - [ ] Chat integration works

- [ ] **Performance**
  - [ ] Page load < 3 seconds
  - [ ] API responses < 1 second
  - [ ] AI responses < 5 seconds

- [ ] **Monitoring**
  - [ ] Error tracking enabled
  - [ ] Analytics configured
  - [ ] Alerts set up

## Migration Guide

### From No Job Seeker System

**Step 1: Add Schemas**
Already done in `/lib/schemas/index.ts`

**Step 2: Add Library Functions**
Already done in `/lib/job-seeker/*`

**Step 3: Add API Routes**
Already done in `/app/api/job-seeker/*`

**Step 4: Add UI Pages**
Already done in `/app/job-seeker/*`

**Step 5: Update Chat Route**
Already done in `/app/api/chat/route.ts`

**Status:** ✅ Complete - Ready to use!

### Adding to Existing Navigation

**Update your main nav to include:**
```typescript
// In your navigation component
const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/quotes', label: 'Get Quotes' },
  { href: '/suppliers/onboard', label: 'Become a Supplier' },
  { href: '/job-seeker/dashboard', label: 'Find Jobs' },  // NEW
  // ... other links
]
```

**Or add a dropdown:**
```typescript
<DropdownMenu>
  <DropdownMenuTrigger>Career</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem href="/job-seeker/dashboard">
      Browse Jobs
    </DropdownMenuItem>
    <DropdownMenuItem href="/job-seeker/applications">
      My Applications
    </DropdownMenuItem>
    <DropdownMenuItem href="/job-seeker/onboarding">
      Update Profile
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Data Migration

### Existing Users

If you have existing users who want to become job seekers:

**Option 1: Self-Service**
- Direct them to `/job-seeker/onboarding`
- They complete profile themselves
- Stores in their Clerk metadata

**Option 2: Bulk Import**
```typescript
// Script to migrate existing data
import { clerkClient } from '@clerk/nextjs/server'

async function migrateUser(userId: string, profileData: any) {
  const client = await clerkClient()
  await client.users.updateUser(userId, {
    publicMetadata: {
      jobSeekerProfile: {
        id: userId,
        ...profileData,
        createdDate: new Date().toISOString()
      }
    }
  })
}
```

### From Other Systems

**CSV Import:**
```typescript
// Parse CSV with job seeker data
// For each row, create Clerk profile
// Use POST /api/job-seeker/profile
```

**API Integration:**
```typescript
// Sync from external system
// Transform to Wells AI format
// Create profiles via API
```

## Scaling Considerations

### Performance Optimization

**1. Job Matching:**
```typescript
// Current: O(n) where n = number of RFQs
// Optimize: Cache RFQs, index by category
// Impact: Sub-second matching for 1000+ RFQs
```

**2. Profile Retrieval:**
```typescript
// Current: Clerk API call per request
// Optimize: Redis cache for hot profiles
// Impact: 10x faster dashboard loads
```

**3. AI Services:**
```typescript
// Current: Real-time Claude calls
// Optimize: Queue system for batch processing
// Impact: Handle 100+ concurrent resumes
```

### Database Strategy

**Current (Clerk Metadata):**
- ✅ Simple
- ✅ Secure
- ✅ No additional DB needed
- ⚠️ Limited to 1MB per user
- ⚠️ Not ideal for analytics

**Future (Dedicated DB):**
```typescript
// When to migrate:
// - 1000+ job seekers
// - Need advanced analytics
// - Want full-text search

// Options:
// - PostgreSQL (structured)
// - MongoDB (flexible)
// - Notion (existing integration)
```

### Rate Limiting

**Claude API:**
- Current limit: Depends on tier
- Recommendation: Queue + retry logic
- Monitor: Requests per minute

**Clerk API:**
- Current limit: 10,000 req/min (Pro)
- Optimization: Cache profiles
- Monitor: Metadata size

**Twilio SMS:**
- Current limit: Depends on account
- Recommendation: Batch notifications
- Monitor: Message delivery rates

## Advanced Features

### Email Notifications (Future)

**Integration: Resend**
```bash
npm install resend
```

**Setup:**
```typescript
// app/api/job-seeker/notify/route.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'jobs@wellsai.com',
  to: jobSeeker.email,
  subject: 'New Job Match: VP of Engineering',
  html: `<h1>You have a new job match!</h1>...`
})
```

**Triggers:**
- New match (80%+ score)
- Application status update
- Interview invitation
- Weekly digest

### Analytics Dashboard (Future)

**Metrics to Track:**
```typescript
interface JobSeekerAnalytics {
  profileCompletionRate: number,
  averageMatchScore: number,
  applicationConversionRate: number,
  timeToFirstApplication: number,
  topSkillsDemand: string[],
  popularLocations: string[],
  salaryRanges: {
    min: number,
    max: number,
    median: number
  }
}
```

**Implementation:**
- Posthog for events
- Mixpanel for funnels
- Custom dashboard in `/analytics`

### Video Profiles (Future)

**Integration: Mux**
```bash
npm install @mux/mux-node
```

**Flow:**
1. Job seeker records intro video
2. Upload to Mux
3. Generate thumbnail
4. Embed in profile
5. Employers can watch

### Skill Assessments (Future)

**Integration: Custom or 3rd party**
- Technical tests (LeetCode-style)
- Personality assessments (Myers-Briggs)
- Skill verification badges
- Proctored exams

## Troubleshooting

### Common Issues

**1. Profile Not Loading**
```typescript
// Check Clerk user exists
const user = await clerkClient.users.getUser(userId)
console.log(user.publicMetadata)

// Verify structure
if (!user.publicMetadata?.jobSeekerProfile) {
  // Profile doesn't exist - redirect to onboarding
}
```

**2. No Job Matches**
```typescript
// Check RFQs exist
const rfqs = await getRFQs(100)
const talentRFQs = rfqs.filter(r => r.category === 'Executive Talent')
console.log(`Found ${talentRFQs.length} Executive Talent RFQs`)

// If zero, create test RFQs in Notion
```

**3. AI Not Working**
```typescript
// Test API key
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'test' }]
  })
})

// Should return 200
console.log(response.status)
```

**4. Notifications Not Sending**
```typescript
// Test Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

await twilioClient.messages.create({
  body: 'Test message',
  from: process.env.TWILIO_PHONE_NUMBER,
  to: '+1234567890'  // Your test number
})
```

## Security Checklist

- [ ] **Authentication Required**
  - All routes use `auth()` from Clerk
  - Unauthenticated users redirected
  - No data leakage

- [ ] **Authorization Verified**
  - Users can only access own profile
  - Users can only see own applications
  - jobSeekerId === userId enforced

- [ ] **Input Validation**
  - All inputs validated with Zod schemas
  - SQL injection prevented (no raw SQL)
  - XSS prevented (React escaping)

- [ ] **PII Protection**
  - Resumes not logged
  - Email/phone redacted in logs
  - Clerk handles encryption

- [ ] **Rate Limiting**
  - Vercel built-in limits
  - Consider Upstash for custom limits
  - Monitor API abuse

## Support & Maintenance

### Weekly Checks
- [ ] Monitor error rates
- [ ] Check AI usage/costs
- [ ] Review match quality
- [ ] Verify notifications sending

### Monthly Reviews
- [ ] Analyze user metrics
- [ ] Review feature requests
- [ ] Update job categories
- [ ] Optimize performance

### Quarterly Updates
- [ ] Update AI models
- [ ] Refresh resume parser
- [ ] Add new features
- [ ] Security audit

## Success Stories (Template)

Track and share:

```markdown
### Job Seeker Success Story

**Before:**
- Name: Jane Doe
- Current: Senior Engineer
- Looking for: VP Engineering
- Struggles: Can't find right opportunities

**After Wells AI:**
- Completed profile: 5 minutes
- Matched jobs: 12 opportunities
- Applied to: 5 positions
- Interviews: 3
- Offer: 1 (VP Engineering @ TechCo)
- Time to offer: 3 weeks

**Quote:**
"Wells AI made job searching effortless. The AI-generated cover letters were spot-on, and the compatibility scores helped me focus on the right opportunities."
```

## Conclusion

The job seeker system is **fully integrated** and **ready for production**. All core features are implemented, tested, and documented. Launch when ready!

**Key Integration Points:**
✅ Chat system
✅ RFQ marketplace
✅ Clerk authentication
✅ Notification system
✅ AI services

**Next Steps:**
1. Deploy to production
2. Test with real users
3. Monitor metrics
4. Iterate based on feedback

---

**Questions?** Check `JOB_SEEKER_SYSTEM.md` for full documentation.
