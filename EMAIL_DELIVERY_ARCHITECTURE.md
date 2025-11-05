# Email Delivery Architecture

## Philosophy

Modern GTM is **not bulk email**. It's surgical, 1:1 relationship building at scale. Wells needs to support multiple delivery methods based on context, volume, and deliverability requirements.

## Provider Matrix

| Provider | Use Case | Volume | Deliverability | Cost | Setup Effort |
|----------|----------|--------|----------------|------|--------------|
| **Gmail OAuth** | High-value 1:1 | 1-10/day | 🟢 Highest | Free | Medium |
| **Outlook OAuth** | Enterprise 1:1 | 1-10/day | 🟢 Highest | Free | Medium |
| **Instantly** | Targeted sequences | 10-100/day | 🟡 High | Paid | Low |
| **SendGrid** | Bulk approved | 100-10k/day | 🟡 Medium | Paid | Low |
| **Salesforce** | CRM-tracked | Any | 🟢 High | Included | High |
| **HubSpot** | CRM-tracked | Any | 🟢 High | Included | High |
| **Apollo** | Sales workflow | 10-100/day | 🟡 Medium | Paid | Low |

## Send Decision Tree

```
Is this a single high-value prospect?
├─ YES → Gmail/Outlook OAuth (personal inbox)
│         - CEO to CEO
│         - Partnership discussions
│         - Executive intros
│
└─ NO → How many recipients?
    ├─ 1-10 → Instantly (personalized sequence)
    │         - ICP-qualified leads
    │         - Warm intros
    │
    ├─ 10-100 → Instantly or SendGrid
    │           - Campaign launch
    │           - Event invites
    │
    └─ 100+ → SendGrid (transactional)
              - Newsletter
              - Announcements
              - Verified opt-ins only
```

## Implementation Priority

### Phase 1: Gmail OAuth (THIS WEEK)
**Why:** Highest deliverability, zero cost, perfect for Wells Onyx's exec search business

**Flow:**
1. User clicks "Connect Gmail" in Wells
2. OAuth flow → permissions for `gmail.send`
3. Store refresh token encrypted in database
4. Wells sends FROM user's actual Gmail account
5. Email appears in user's Sent folder (perfect audit trail)

**API Endpoint:** `/api/gtm/email/send`
```typescript
POST /api/gtm/email/send
{
  "provider": "gmail",
  "to": "ceo@targetcompany.com",
  "subject": "...",
  "body": "...",
  "userId": "user_123" // Owner of Gmail OAuth token
}
```

### Phase 2: Instantly Integration (THIS WEEK)
**Why:** Credits refreshed, perfect for sequences

**Flow:**
1. User provides Instantly API key
2. Wells creates campaign in Instantly
3. Adds prospects to sequence
4. Instantly handles warmup, sending, tracking

**API Endpoint:** `/api/gtm/email/sequence`
```typescript
POST /api/gtm/email/sequence
{
  "provider": "instantly",
  "campaignName": "Q1 Executive Search Outreach",
  "prospects": [
    { "email": "...", "firstName": "...", "variables": {...} }
  ],
  "sequence": [
    { "day": 0, "subject": "...", "body": "..." },
    { "day": 3, "subject": "...", "body": "..." },
    { "day": 7, "subject": "...", "body": "..." }
  ]
}
```

### Phase 3: SendGrid (NEXT WEEK)
**Why:** High volume, transactional, great for verified lists

### Phase 4: CRM Integrations (LATER)
**Why:** Complex OAuth, requires deep integration

## Database Schema

### EmailProvider Model

```prisma
model EmailProvider {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // User/Org
  userId         String
  organizationId String?

  // Provider details
  provider String // "gmail", "outlook", "instantly", "sendgrid", "salesforce", "hubspot"
  status   String @default("active") // "active", "disconnected", "error"

  // OAuth tokens (encrypted)
  accessToken  String? // Current access token
  refreshToken String? // For re-auth
  expiresAt    DateTime?

  // API keys (encrypted)
  apiKey    String? // For Instantly, SendGrid, etc.
  apiSecret String?

  // Provider-specific config
  config Json? // { "fromName": "John Smith", "replyTo": "...", etc. }

  // Usage tracking
  emailsSentToday   Int @default(0)
  emailsSentMonth   Int @default(0)
  lastEmailSentAt   DateTime?
  dailyLimit        Int @default(50) // Provider-specific
  monthlyLimit      Int @default(1000)

  // Email sends using this provider
  emailsSent EmailSent[]

  @@index([userId])
  @@index([organizationId])
  @@index([provider])
  @@index([status])
}
```

### EmailSent Model (Audit Trail)

```prisma
model EmailSent {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Who sent it
  userId         String
  organizationId String?

  // Provider used
  providerId String
  provider   EmailProvider @relation(fields: [providerId], references: [id])

  // Email details
  to          String[]
  cc          String[]
  bcc         String[]
  from        String
  replyTo     String?
  subject     String
  bodyHtml    String @db.Text
  bodyText    String @db.Text

  // Tracking
  providerMessageId String? // Gmail message ID, Instantly campaign ID, etc.
  status            String @default("sent") // "queued", "sent", "delivered", "bounced", "opened", "clicked", "replied"

  // Campaign/context
  campaignId String? // Link to GTM campaign
  context    Json?   // { "prospectId": "...", "playbookId": "...", etc. }

  // Engagement
  openedAt   DateTime?
  clickedAt  DateTime?
  repliedAt  DateTime?

  @@index([userId])
  @@index([providerId])
  @@index([status])
  @@index([campaignId])
  @@index([createdAt])
}
```

## User Experience

### In Wells Chat:

```
USER: I need to send a personalized email to the CEO of Acme Corp

WELLS: I'll draft that email for you. How would you like to send it?

[Card with 3 options]
┌─────────────────────────────────────────┐
│ 📧 Gmail (Recommended)                  │
│ Send from: jonah@wellsonyx.com          │
│ ✓ Highest deliverability                │
│ ✓ Appears in your Sent folder           │
│ ✓ Best for 1:1 executive outreach       │
│ [Send via Gmail]                        │
├─────────────────────────────────────────┤
│ 🚀 Instantly                            │
│ Add to sequence: "CEO Outreach"         │
│ ✓ Automated follow-ups                  │
│ ✓ Open/click tracking                   │
│ [Add to Sequence]                       │
├─────────────────────────────────────────┤
│ ⚡ SendGrid                             │
│ Bulk send (not recommended for 1 email) │
│ [Send via SendGrid]                     │
└─────────────────────────────────────────┘
```

## Security

- All OAuth tokens encrypted at rest (using `@prisma/client` with field-level encryption)
- API keys stored in environment variables OR encrypted in database
- No plaintext credentials ever logged
- Refresh tokens rotated regularly
- Provider connections can be revoked instantly

## Rate Limiting

- Gmail: 500/day per user (Google's limit)
- Outlook: 10,000/day per user
- Instantly: Based on your plan
- SendGrid: Based on your plan

Wells will:
- Track sends per provider
- Warn before hitting limits
- Suggest alternative providers when approaching limits
- Auto-rotate providers if one is rate-limited

## Next Steps

1. ✅ Design architecture (THIS)
2. 🔄 Implement Gmail OAuth flow
3. 🔄 Create email provider settings UI
4. 🔄 Build send endpoint with provider routing
5. 🔄 Integrate Instantly API
6. 🔄 Add email composition UI in chat
7. 🔄 Deploy and test with real sends

---

Built by Wells Onyx
Powered by conversational commerce
