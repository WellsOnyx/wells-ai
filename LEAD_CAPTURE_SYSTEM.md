# GTM Lead Capture System

## Overview

The GTM Lead Capture System for Wells Onyx enables the platform to capture, store, and manage leads during Early Access mode. When users express interest through chat conversations, their requirements are automatically captured and the team is notified for manual follow-up.

## Architecture

### Components

1. **Database Layer** (`lib/leads-db.ts`)
   - CRUD operations for leads
   - Lead notes and activity tracking
   - PostgreSQL/Vercel Postgres integration

2. **Notification System** (`lib/notifications.ts`)
   - Slack webhook notifications
   - Email notifications (placeholder for SendGrid/Resend)
   - Rich formatted messages with lead details

3. **API Endpoints**
   - `POST /api/leads` - Create new lead
   - `GET /api/leads` - List leads (with filters)
   - `GET /api/leads/[leadId]` - Get lead details
   - `PATCH /api/leads/[leadId]` - Update lead status

4. **Chat Integration** (`app/api/chat/route.ts`)
   - Updated system prompts for Early Access mode
   - New `capture_lead` tool for Claude
   - Automatic lead creation from conversations

5. **Admin Dashboard** (`app/leads/page.tsx`)
   - View all captured leads
   - Filter by status, journey, priority
   - Quick stats overview

## Database Schema

```sql
-- Main leads table
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_phone TEXT,
  user_company TEXT,

  journey TEXT NOT NULL, -- 'founder', 'buyer', 'seller', 'jobs'
  requirements TEXT NOT NULL,
  conversation_history JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT DEFAULT 'medium',
  source TEXT DEFAULT 'chat',

  intent TEXT,
  budget DECIMAL(20, 2),
  timeline TEXT,

  contacted_at TIMESTAMP,
  contacted_by TEXT,
  last_contact_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- Lead notes (for sales team)
CREATE TABLE lead_notes (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  note TEXT NOT NULL,
  note_type TEXT DEFAULT 'general',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Activity log (auto-tracked)
CREATE TABLE lead_activities (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  activity_type TEXT NOT NULL,
  activity_data JSONB,
  performed_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Setup

### 1. Database Migration

Run the schema migration:

```bash
psql $POSTGRES_URL < scripts/schema-leads.sql
```

Or if using Vercel Postgres, the migrations will run automatically on deploy.

### 2. Environment Variables

Add to your `.env.local`:

```bash
# Required
POSTGRES_URL=postgresql://...

# Optional - for Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional - for email notifications
RESEND_API_KEY=re_...
SENDGRID_API_KEY=SG...
```

### 3. Slack Webhook Setup

1. Go to https://api.slack.com/apps
2. Create a new app or select existing
3. Enable Incoming Webhooks
4. Add webhook to your workspace
5. Copy webhook URL to `SLACK_WEBHOOK_URL` env var

## Usage

### Chat Flow (Automatic)

When users chat with Wells:

1. User expresses interest (e.g., "I need to hire a CTO")
2. Wells asks clarifying questions
3. Once enough info is gathered, Wells uses `capture_lead` tool
4. Lead is saved to database
5. Team is notified via Slack
6. User receives confirmation message

### Example Conversation

```
User: I need to hire a CTO for my startup

Wells: Got it! Let me gather some details. Remote or on-site?
      What's your budget range? Any must-have technical skills?

User: Remote, $200-300k, needs AI/ML experience

Wells: Perfect. I'm adding this to our priority matching queue.
      Our team will personally review candidates and reach out
      within 24 hours with 3-5 curated matches. You'll get the
      personal touch during Early Access!

[Lead automatically captured and saved]
```

### API Usage

#### Create a Lead Manually

```typescript
const response = await fetch('/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    journey: 'founder',
    requirements: 'Need CTO, remote, $200-300k, AI/ML experience',
    intent: 'hire',
    budget: 250000,
    timeline: '2 months',
    priority: 'high',
    conversationHistory: [
      { role: 'user', content: 'I need a CTO' },
      { role: 'assistant', content: 'Got it! Let me gather details...' }
    ]
  })
})
```

#### Get All Leads

```typescript
const response = await fetch('/api/leads?status=new&journey=founder&limit=50')
const data = await response.json()
console.log(data.leads) // Array of leads
```

#### Update Lead Status

```typescript
const response = await fetch(`/api/leads/${leadId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'contacted',
    contacted: true,
    note: 'Called and left voicemail',
    noteType: 'call'
  })
})
```

## Admin Dashboard

Access the leads dashboard at: `/leads`

Features:
- View all captured leads
- Filter by status, journey, priority
- See lead stats (total, new, in progress, won)
- Click lead to view full details

### Permissions

- **Regular users**: Can only see their own leads
- **Admin users**: Can see all leads and update them

Set admin role in Clerk:
```typescript
// In Clerk dashboard, set user metadata:
{
  "publicMetadata": {
    "role": "admin",
    "isAdmin": true
  }
}
```

## Slack Notification Format

When a lead is captured, Slack receives a formatted message:

```
🎯 New Lead: John Doe

Journey: Founder
Email: john@example.com
Company: Acme Inc
Priority: High
Budget: $250,000

Requirements:
Need CTO, remote, $200-300k, AI/ML experience,
start within 2 months

Recent Conversation:
User: I need a CTO
Wells: Got it! Let me gather details...

Lead ID: abc-123 | Created: 2025-12-03 | Source: chat
```

## Lead Lifecycle

1. **New** - Lead just captured, needs review
2. **Contacted** - Team has reached out
3. **In Progress** - Actively working the lead
4. **Closed** - No longer pursuing
5. **Won** - Successfully converted
6. **Lost** - Did not convert

## Analytics & Reporting

### Key Metrics to Track

- Total leads captured
- Leads by journey type
- Conversion rate (won/total)
- Average time to contact
- Average time to close
- Leads by source (chat, widget, API)

### Sample Queries

```sql
-- Leads created today
SELECT COUNT(*) FROM leads
WHERE created_at >= CURRENT_DATE;

-- Conversion rate by journey
SELECT
  journey,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
  ROUND(100.0 * SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) / COUNT(*), 2) as conversion_rate
FROM leads
GROUP BY journey;

-- Average budget by journey
SELECT
  journey,
  AVG(budget) as avg_budget,
  COUNT(*) as count
FROM leads
WHERE budget IS NOT NULL
GROUP BY journey;
```

## Extending the System

### Add Email Notifications

Uncomment and implement email sending in `lib/notifications.ts`:

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function notifyNewLeadEmail(lead: Lead, recipientEmail: string) {
  await resend.emails.send({
    from: 'wells@wellsonyx.com',
    to: recipientEmail,
    subject: `New Lead: ${lead.userName} (${lead.journey})`,
    html: formatLeadForEmail(lead)
  })
}
```

### Add CRM Integration

Integrate with HubSpot, Salesforce, etc:

```typescript
// In lib/leads-db.ts createLead function
export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const lead = await createLeadInDatabase(input)

  // Sync to CRM
  await syncToCRM(lead)

  return lead
}

async function syncToCRM(lead: Lead) {
  // HubSpot example
  await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        email: lead.userEmail,
        firstname: lead.userName.split(' ')[0],
        lastname: lead.userName.split(' ')[1],
        company: lead.userCompany,
        // ... more fields
      }
    })
  })
}
```

### Add Lead Scoring

Implement automatic lead scoring:

```typescript
function calculateLeadScore(lead: Lead): number {
  let score = 0

  // Budget scoring
  if (lead.budget && lead.budget > 100000) score += 30
  else if (lead.budget && lead.budget > 50000) score += 20
  else if (lead.budget) score += 10

  // Timeline scoring (urgent = high score)
  if (lead.timeline?.toLowerCase().includes('asap')) score += 20
  if (lead.timeline?.toLowerCase().includes('urgent')) score += 20

  // Journey scoring
  if (lead.journey === 'founder') score += 15

  // Company presence
  if (lead.userCompany) score += 10

  return Math.min(score, 100)
}
```

## Troubleshooting

### Leads not being captured

1. Check database connection: `echo $POSTGRES_URL`
2. Verify schema is migrated: `psql $POSTGRES_URL -c "\dt leads"`
3. Check chat API logs for errors
4. Ensure user is authenticated

### Slack notifications not working

1. Verify `SLACK_WEBHOOK_URL` is set
2. Test webhook manually:
   ```bash
   curl -X POST $SLACK_WEBHOOK_URL \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test message"}'
   ```
3. Check notification logs in server console

### Dashboard not showing leads

1. Check user authentication
2. Verify API endpoint: `curl /api/leads`
3. Check browser console for errors
4. Ensure user has appropriate permissions

## Security Considerations

1. **Authentication**: All endpoints require Clerk authentication
2. **Authorization**: Regular users can only see their own leads
3. **Data Privacy**: PII stored in encrypted Vercel Postgres
4. **Webhook Security**: Validate Slack webhook signatures in production
5. **Rate Limiting**: Implement rate limiting on public endpoints

## Future Enhancements

- [ ] Email automation sequences
- [ ] Lead assignment to team members
- [ ] Advanced analytics dashboard
- [ ] Export leads to CSV
- [ ] Bulk operations (assign, update status)
- [ ] Lead enrichment (Clearbit, Apollo)
- [ ] SMS notifications (Twilio)
- [ ] Lead routing rules
- [ ] Custom fields per journey type
- [ ] Integration with calendly for booking
- [ ] AI-powered lead qualification

## Support

For questions or issues:
1. Check logs in Vercel dashboard
2. Review database queries in Vercel Postgres
3. Test endpoints with curl/Postman
4. Contact engineering team

---

Built with ❤️ for Wells Onyx Early Access
