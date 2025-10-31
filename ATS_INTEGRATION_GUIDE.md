# HRIS/ATS Integration Guide

Wells AI now integrates with **50+ Applicant Tracking Systems (ATS) and HR Information Systems (HRIS)** via Merge.dev.

## What This Enables

### For Companies (Hiring)
1. **Post Jobs**: Pull open positions from your ATS and post them to Wells AI
2. **Receive Applications**: Applications from Wells AI automatically sync to your ATS
3. **Track Candidates**: All candidate data flows into your existing hiring workflow
4. **Sync Employees**: Pull employee data for internal mobility/recruiting

### For Job Seekers
1. **Discover Jobs**: See real jobs from companies using Wells AI
2. **Apply Seamlessly**: Submit applications that go directly to company ATS
3. **Track Status**: See where your application is in the hiring pipeline

## Supported Systems

### Applicant Tracking Systems (ATS)
- **Greenhouse** - Most popular ATS for tech companies
- **Lever** - Modern recruiting platform
- **Ashby** - Analytics-focused ATS
- **JazzHR** - SMB-focused recruiting
- **iCIMS** - Enterprise ATS
- **SmartRecruiters** - Global recruiting platform
- **Jobvite** - Recruiting marketing platform
- **Bullhorn** - Staffing industry standard
- **TeamTailor** - European market leader
- **Fountain** - High-volume hiring

### HR Information Systems (HRIS)
- **BambooHR** - Most popular HRIS for SMBs
- **Workday** - Enterprise HR platform
- **SAP SuccessFactors** - Enterprise HRIS
- **ADP Workforce Now** - Payroll + HRIS
- **Namely** - Mid-market HRIS
- **Gusto** - Payroll + benefits
- **Rippling** - All-in-one HR platform
- **Zenefits** - HR automation

## Architecture

```
┌─────────────────┐
│   Wells AI UI   │
│  (Job Seeker)   │
└────────┬────────┘
         │
         │ POST /api/ats/applications
         │
         ▼
┌─────────────────┐
│  Wells AI API   │
│   (Next.js)     │
└────────┬────────┘
         │
         │ Merge.dev API
         │
         ▼
┌─────────────────┐       ┌──────────────────┐
│   Merge.dev     │──────▶│  Company's ATS   │
│  (Unified API)  │       │  (Greenhouse,    │
└─────────────────┘       │   Lever, etc.)   │
                          └──────────────────┘
```

## Setup Instructions

### 1. Get Merge.dev API Key

1. Sign up at [app.merge.dev](https://app.merge.dev)
2. Create a new account
3. Navigate to **Settings** → **API Keys**
4. Copy your Production API Key
5. Add to `.env.local`:

```bash
MERGE_API_KEY=your_merge_api_key_here
```

**Note**: The same `MERGE_API_KEY` works for both:
- `accounting` category (ERP integrations)
- `ats` category (ATS integrations)
- `hris` category (HRIS integrations)

### 2. Configure Merge.dev

1. In Merge.dev dashboard, enable integrations:
   - Go to **Integrations**
   - Enable ATS category
   - Enable HRIS category
2. Add integrations you want to support:
   - Greenhouse
   - Lever
   - BambooHR
   - Workday
   - etc.
3. Configure OAuth credentials for each integration

### 3. Test Connection

```bash
# Check if API key works
curl https://api.merge.dev/api/ats/v1/integrations \
  -H "Authorization: Bearer YOUR_MERGE_API_KEY"
```

## How to Use

### For Company Admins

#### Step 1: Connect Your ATS
1. Go to **Settings** → **ATS & HRIS Integration**
2. Click **Connect ATS/HRIS**
3. Select your system (Greenhouse, Lever, etc.)
4. Authenticate via OAuth
5. Grant permissions

#### Step 2: Sync Jobs
1. Click **Sync Jobs** to pull open positions
2. Jobs automatically appear in Wells AI
3. Set up auto-sync (optional)

#### Step 3: Receive Applications
- Applications submitted via Wells AI automatically flow into your ATS
- Candidates appear as new applications
- Attachments (resume, cover letter) are included
- All metadata preserved

### For Developers

#### List Jobs from ATS
```typescript
// GET /api/ats/jobs?status=OPEN
const response = await fetch('/api/ats/jobs?status=OPEN', {
  headers: {
    'X-Account-Token': accountToken, // From Merge Link
  },
})

const { jobs } = await response.json()
```

#### Submit Application to ATS
```typescript
// POST /api/ats/applications
const response = await fetch('/api/ats/applications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    jobId: 'job_123',
    accountToken: accountToken,
    jobSeeker: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      resumeUrl: 'https://...',
      linkedin: 'https://linkedin.com/in/janedoe',
    },
  }),
})

const { candidateId, applicationId } = await response.json()
```

#### Sync Employees from HRIS
```typescript
// GET /api/ats/sync
const response = await fetch('/api/ats/sync', {
  headers: {
    'X-Account-Token': accountToken,
  },
})

const { employees } = await response.json()
```

## API Reference

### POST /api/ats/connect
Generate Merge Link Token for connecting ATS/HRIS

**Request:**
```json
{
  "companyName": "Acme Corp",
  "email": "admin@acme.com"
}
```

**Response:**
```json
{
  "linkToken": "link_token_abc123...",
  "message": "Link token generated successfully"
}
```

### GET /api/ats/jobs
List jobs from ATS

**Query Params:**
- `status` - Filter by status (OPEN, CLOSED, DRAFT, ARCHIVED)
- `pageSize` - Number of results (default: 50)
- `jobId` - Get specific job

**Headers:**
- `X-Account-Token` - Merge account token (from Link flow)

**Response:**
```json
{
  "jobs": [
    {
      "id": "job_123",
      "name": "Senior Software Engineer",
      "description": "We are looking for...",
      "status": "OPEN",
      "code": "ENG-001",
      "departments": [{ "name": "Engineering" }],
      "offices": [{ "name": "San Francisco", "location": "CA" }]
    }
  ],
  "count": 1
}
```

### POST /api/ats/applications
Submit application to ATS

**Request:**
```json
{
  "jobId": "job_123",
  "accountToken": "acc_token_xyz",
  "jobSeeker": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "resumeUrl": "https://...",
    "coverLetterUrl": "https://...",
    "linkedin": "https://linkedin.com/in/janedoe",
    "portfolio": "https://janedoe.com",
    "currentCompany": "TechCo",
    "currentTitle": "Software Engineer"
  }
}
```

**Response:**
```json
{
  "success": true,
  "candidateId": "candidate_456",
  "applicationId": "application_789",
  "message": "Application submitted successfully"
}
```

### GET /api/ats/applications
List applications from ATS

**Query Params:**
- `jobId` - Filter by job
- `candidateId` - Filter by candidate
- `pageSize` - Number of results

**Headers:**
- `X-Account-Token` - Merge account token

**Response:**
```json
{
  "applications": [
    {
      "id": "application_789",
      "candidate": "candidate_456",
      "job": "job_123",
      "applied_at": "2025-01-15T10:30:00Z",
      "current_stage": { "name": "Phone Screen" }
    }
  ],
  "count": 1
}
```

### GET /api/ats/sync
Sync employees from HRIS

**Query Params:**
- `action` - 'sync' (default) or 'info'
- `pageSize` - Number of results (default: 100)

**Headers:**
- `X-Account-Token` - Merge account token

**Response:**
```json
{
  "success": true,
  "employees": [
    {
      "id": "emp_123",
      "first_name": "John",
      "last_name": "Smith",
      "work_email": "john@company.com",
      "employments": [
        {
          "job_title": "Senior Engineer",
          "employment_type": "FULL_TIME"
        }
      ]
    }
  ],
  "count": 1,
  "syncedAt": "2025-01-15T10:30:00Z"
}
```

### POST /api/ats/sync
Trigger manual employee sync

**Request:**
```json
{
  "accountToken": "acc_token_xyz"
}
```

**Response:**
```json
{
  "success": true,
  "count": 42,
  "syncedAt": "2025-01-15T10:30:00Z",
  "message": "Successfully synced 42 employees"
}
```

## Testing

### 1. Test Connection
```bash
npm run dev
# Open http://localhost:3000/settings/ats
```

### 2. Connect Test ATS
1. Click "Connect ATS/HRIS"
2. Use Merge.dev sandbox credentials
3. Select "Greenhouse" (test mode)
4. Complete OAuth flow

### 3. Test Job Sync
1. Click "Sync Jobs"
2. Verify jobs appear
3. Check job details

### 4. Test Application Submission
```bash
curl -X POST http://localhost:3000/api/ats/applications \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_test_123",
    "accountToken": "test_acc_token",
    "jobSeeker": {
      "firstName": "Test",
      "lastName": "Candidate",
      "email": "test@example.com",
      "phone": "+1234567890",
      "resumeUrl": "https://example.com/resume.pdf"
    }
  }'
```

### 5. Test Employee Sync
1. Click "Sync Employees"
2. Verify employee data appears
3. Check employee details

## Production Checklist

- [ ] Merge.dev Production API key added to `.env.production`
- [ ] ATS/HRIS integrations enabled in Merge dashboard
- [ ] OAuth credentials configured for target integrations
- [ ] Webhook endpoints configured (optional)
- [ ] Database schema updated to store:
  - Account tokens per organization
  - Synced jobs
  - Synced employees
  - Application mappings
- [ ] Auto-sync jobs (cron job or webhook)
- [ ] Auto-sync employees (daily/weekly)
- [ ] Error handling and retry logic
- [ ] Logging and monitoring
- [ ] User permissions (who can connect/sync)

## Integration Workflow

### Job Seeker Journey
```
1. Job Seeker visits Wells AI
   ↓
2. Browses jobs (synced from company ATS)
   ↓
3. Applies for a job
   ↓
4. Wells AI creates candidate in ATS
   ↓
5. Wells AI creates application in ATS
   ↓
6. Company sees application in their ATS
   ↓
7. Company processes application (interview, hire)
   ↓
8. Wells AI updates job seeker on status
```

### Company Admin Journey
```
1. Admin connects ATS to Wells AI
   ↓
2. Admin syncs open jobs
   ↓
3. Jobs appear on Wells AI for job seekers
   ↓
4. Applications flow into ATS automatically
   ↓
5. Admin manages hiring in their ATS
   ↓
6. Wells AI reflects status updates
```

## Advanced Features

### Auto-Sync
Set up webhooks to automatically sync when:
- New job posted in ATS → sync to Wells AI
- Job closed in ATS → remove from Wells AI
- Application status changes → notify candidate

### Field Mapping
Customize how fields map between Wells AI and your ATS:
```typescript
// Custom field mapping
{
  wells_ai_field: 'expectedSalary',
  ats_field: 'desired_compensation',
  transform: (value) => parseInt(value)
}
```

### Bulk Operations
```typescript
// Sync all jobs at once
const allJobs = await listJobs({ accountToken, pageSize: 1000 })

// Bulk create candidates
const candidates = await Promise.all(
  applicants.map(a => createCandidate({ accountToken, candidate: a }))
)
```

## Support

### Common Issues

**Issue**: "ATS not connected" error
- **Fix**: Check that account token is saved and valid
- Run: `GET /api/ats/sync?action=info` to verify connection

**Issue**: Jobs not syncing
- **Fix**: Check ATS permissions (read jobs, candidates)
- Verify Merge integration is active

**Issue**: Applications not creating
- **Fix**: Check required fields (firstName, lastName, email)
- Verify job ID exists in ATS

### Resources
- [Merge.dev Docs](https://docs.merge.dev/ats/overview)
- [Merge.dev Support](https://merge.dev/support)
- Wells AI Slack: #ats-integration

## Next Steps

1. **Connect Your ATS**: Start at `/settings/ats`
2. **Customize UI**: Update job posting page
3. **Add Filters**: Search/filter jobs by department, location
4. **Build Dashboard**: Track application metrics
5. **Enable Webhooks**: Real-time sync

---

**Built with:**
- Merge.dev Universal API
- Next.js 14 App Router
- TypeScript
- Clerk Authentication
