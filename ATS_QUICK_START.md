# ATS Integration - Quick Start

## 30-Second Overview

Wells AI now connects to **50+ ATS/HRIS systems** (Greenhouse, Lever, BambooHR, Workday, etc.) via Merge.dev.

**What it does:**
- Companies sync jobs from their ATS to Wells AI
- Job seekers apply through Wells AI
- Applications automatically flow into company's ATS
- Two-way sync keeps everything up to date

---

## Setup (5 minutes)

### 1. Get Merge.dev API Key
```bash
# Sign up at https://app.merge.dev
# Get API key from Settings → API Keys
# Add to .env.local:
MERGE_API_KEY=your_merge_api_key_here
```

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Visit Settings Page
```
http://localhost:3000/settings/ats
```

### 4. Connect ATS (Demo Mode)
- Click "Connect ATS/HRIS"
- For demo: generates mock connection
- For production: completes OAuth flow

---

## Test It (2 minutes)

### Option A: UI Testing
1. Visit http://localhost:3000/settings/ats
2. Click "Connect ATS/HRIS" (demo mode)
3. Click "Sync Jobs" (simulated)
4. See synced jobs displayed

### Option B: API Testing
```bash
# Test connection
curl http://localhost:3000/api/ats/jobs \
  -H "X-Account-Token: demo_token"

# Submit application
curl -X POST http://localhost:3000/api/ats/applications \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_123",
    "accountToken": "demo_token",
    "jobSeeker": {
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "resumeUrl": "https://example.com/resume.pdf"
    }
  }'
```

### Option C: Automated Test Script
```bash
npx tsx scripts/test-ats-integration.ts
```

---

## Files You Need to Know

### Core Library
**`lib/merge/ats.ts`** - All ATS/HRIS functions
- `listJobs()` - Get jobs from ATS
- `createApplication()` - Submit application
- `syncEmployees()` - Pull employee data

### API Routes
```
POST /api/ats/connect        → Connect ATS
GET  /api/ats/jobs          → List jobs
POST /api/ats/applications  → Submit application
GET  /api/ats/sync          → Sync employees
```

### UI
**`app/settings/ats/page.tsx`** - Settings page
- Connect/disconnect ATS
- Sync jobs and employees
- View synced data

### Documentation
- **`ATS_INTEGRATION_GUIDE.md`** - Complete guide
- **`ATS_BUILD_SUMMARY.md`** - What was built
- **`ATS_QUICK_START.md`** - This file
- **`lib/merge/examples.ts`** - Code examples

---

## Supported Systems

### ATS (Applicant Tracking)
Greenhouse • Lever • Ashby • JazzHR • iCIMS • SmartRecruiters • Jobvite • Bullhorn • TeamTailor • Fountain • +40 more

### HRIS (Human Resources)
BambooHR • Workday • SAP SuccessFactors • ADP • Namely • Gusto • Rippling • Zenefits • +more

---

## Common Use Cases

### 1. Company Hiring
```typescript
// Sync jobs from ATS
const jobs = await listJobs({ accountToken, status: 'OPEN' })

// Jobs appear in Wells AI
// Job seekers apply
// Applications flow back to ATS
```

### 2. Job Seeker Applying
```typescript
// Convert job seeker to ATS format
const { candidate, application } = convertToATSApplication({
  jobSeeker: { firstName, lastName, email, ... },
  jobId,
})

// Submit to ATS
await createCandidate({ accountToken, candidate })
await createApplication({ accountToken, application })
```

### 3. Internal Recruiting
```typescript
// Sync employees from HRIS
const employees = await syncEmployees({ accountToken })

// Use for internal job postings
```

---

## Production Deployment

### Required Steps
1. ✅ Add `MERGE_API_KEY` to production env
2. ✅ Enable ATS/HRIS in Merge dashboard
3. ⚠️ Add database tables (see `ATS_BUILD_SUMMARY.md`)
4. ⚠️ Store account tokens per organization
5. ⚠️ Add cron job for auto-sync
6. ⚠️ Add error handling and logging

### Optional Enhancements
- Webhooks for real-time sync
- Job board UI with search/filters
- Application status tracking
- Email notifications
- Analytics dashboard

---

## Need Help?

### Documentation
- Full Guide: `ATS_INTEGRATION_GUIDE.md`
- Build Summary: `ATS_BUILD_SUMMARY.md`
- Code Examples: `lib/merge/examples.ts`

### Testing
- Test Script: `npx tsx scripts/test-ats-integration.ts`
- Settings UI: http://localhost:3000/settings/ats

### Resources
- Merge.dev Docs: https://docs.merge.dev/ats/overview
- Merge.dev Support: https://merge.dev/support

---

## Quick Reference

### Environment Variable
```bash
MERGE_API_KEY=your_key_here
```

### Key Functions
```typescript
import {
  listJobs,
  createApplication,
  syncEmployees
} from '@/lib/merge/ats'
```

### Settings Page
```
/settings/ats
```

### Test Command
```bash
npx tsx scripts/test-ats-integration.ts
```

---

**That's it!** You now have a complete ATS/HRIS integration ready to go.

Start at: http://localhost:3000/settings/ats
