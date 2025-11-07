# Wells Onyx Campaign Management API

Complete API documentation for the Wells Onyx GTM campaign system.

## Overview

The Wells Onyx Campaign API allows you to programmatically create, manage, and send executive search outreach campaigns. It integrates with:
- `lib/gtm/wells-onyx-launcher.ts` - Campaign generation logic
- `lib/gtm/wells-onyx-templates.ts` - Practice group templates
- Instantly.ai - Email delivery
- PostgreSQL/Prisma - Campaign persistence

## Database Schema

The `WellsOnyxCampaign` model stores campaign data:

```prisma
model WellsOnyxCampaign {
  id                  String         @id @default(uuid())
  campaignId          String         @unique // wo_gtm_123
  userId              String
  practiceGroupId     String
  practiceGroupName   String
  status              CampaignStatus @default(DRAFT)
  prospectCount       Int            @default(0)
  messageCount        Int            @default(0)
  approvedCount       Int            @default(0)
  sentCount           Int            @default(0)
  practiceGroupData   Json?
  prospectsData       Json?
  messagesData        Json?
  instantlyApiKey     String?
  instantlyCampaignId String?
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  approvedAt          DateTime?
  sentAt              DateTime?
  completedAt         DateTime?
}

enum CampaignStatus {
  DRAFT
  READY
  SENDING
  SENT
  COMPLETED
  PAUSED
}
```

## Endpoints

### 1. Create Campaign

**POST** `/api/gtm/wells-onyx/campaign`

Creates a new Wells Onyx GTM campaign with AI-generated personalized messages.

#### Request Body

```json
{
  "practiceGroupId": "cybersecurity",
  "targetCount": 25,
  "instantlyApiKey": "your-instantly-api-key",
  "instantlyCampaignId": "your-instantly-campaign-id"
}
```

**Parameters:**
- `practiceGroupId` (string, required) - Practice group to target. Options:
  - `cybersecurity` - Cybersecurity & Data Privacy Leadership
  - `fintech` - Fintech & Payments Leadership
  - `aerospace` - Aerospace & Defense Leadership
  - `healthcare` - Healthcare & MedTech Leadership
  - `saas` - SaaS & Enterprise Software Leadership
- `targetCount` (number, optional) - Number of prospects to find. Default: 25, Max: 100
- `instantlyApiKey` (string, optional) - Your Instantly.ai API key
- `instantlyCampaignId` (string, optional) - Instantly campaign ID for sending

#### Response

```json
{
  "success": true,
  "campaignId": "wo_gtm_1730908800000",
  "practiceGroup": "Cybersecurity & Data Privacy Leadership",
  "prospects": 25,
  "messages": [
    {
      "prospectEmail": "sarah.chen@midtier-tech.com",
      "channel": "email",
      "subject": "Re: CISO search for MidTier Tech Corp",
      "body": "Sarah,\n\nI noticed MidTier Tech Corp recently announced Series C funding...",
      "approved": false
    }
  ],
  "status": "draft",
  "preview": "WELLS ONYX GTM CAMPAIGN: Cybersecurity & Data Privacy Leadership\n\nProspects: 25\nMessages: 25\n\n--- SAMPLE MESSAGE ---\n..."
}
```

#### Example

```bash
curl -X POST https://your-domain.com/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "practiceGroupId": "cybersecurity",
    "targetCount": 25
  }'
```

---

### 2. Get Campaign Status

**GET** `/api/gtm/wells-onyx/campaign?campaignId=wo_gtm_123`

Retrieves campaign details, status, and message approval state.

#### Query Parameters

- `campaignId` (string, required) - Campaign ID returned from POST endpoint

#### Response

```json
{
  "success": true,
  "campaignId": "wo_gtm_1730908800000",
  "practiceGroup": "Cybersecurity & Data Privacy Leadership",
  "status": "draft",
  "prospects": 25,
  "messages": [
    {
      "prospectEmail": "sarah.chen@midtier-tech.com",
      "channel": "email",
      "subject": "Re: CISO search for MidTier Tech Corp",
      "body": "Sarah,\n\nI noticed...",
      "approved": true,
      "sent": false
    }
  ],
  "approvedCount": 12,
  "sentCount": 0,
  "createdAt": "2025-11-07T10:00:00.000Z",
  "updatedAt": "2025-11-07T10:15:00.000Z",
  "approvedAt": null,
  "sentAt": null
}
```

#### Example

```bash
curl -X GET "https://your-domain.com/api/gtm/wells-onyx/campaign?campaignId=wo_gtm_123" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

---

### 3. Approve/Reject Messages

**PATCH** `/api/gtm/wells-onyx/campaign`

Approve or reject individual messages, approve all messages, or send the campaign.

#### Request Body - Approve Single Message

```json
{
  "campaignId": "wo_gtm_1730908800000",
  "action": "approve_message",
  "messageIndex": 0
}
```

#### Request Body - Reject Single Message

```json
{
  "campaignId": "wo_gtm_1730908800000",
  "action": "reject_message",
  "messageIndex": 0
}
```

#### Request Body - Approve All Messages

```json
{
  "campaignId": "wo_gtm_1730908800000",
  "action": "approve_all"
}
```

#### Request Body - Send Campaign

```json
{
  "campaignId": "wo_gtm_1730908800000",
  "action": "send",
  "instantlyApiKey": "your-instantly-api-key",
  "instantlyCampaignId": "your-instantly-campaign-id"
}
```

**Parameters:**
- `campaignId` (string, required) - Campaign ID
- `action` (string, required) - One of:
  - `approve_message` - Approve a single message
  - `reject_message` - Reject a single message
  - `approve_all` - Approve all messages
  - `send` - Send approved messages via Instantly.ai
- `messageIndex` (number, optional) - Required for `approve_message` and `reject_message`
- `instantlyApiKey` (string, optional) - Required for `send` if not provided during creation
- `instantlyCampaignId` (string, optional) - Instantly campaign ID

#### Response - Approve Message

```json
{
  "success": true,
  "message": "Message approved",
  "approvedCount": 1,
  "totalMessages": 25
}
```

#### Response - Approve All

```json
{
  "success": true,
  "message": "All messages approved",
  "approvedCount": 25,
  "status": "ready"
}
```

#### Response - Send Campaign

```json
{
  "success": true,
  "message": "Campaign sent successfully",
  "sent": 25,
  "failed": 0,
  "status": "sent"
}
```

#### Example - Approve Single Message

```bash
curl -X PATCH https://your-domain.com/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "campaignId": "wo_gtm_123",
    "action": "approve_message",
    "messageIndex": 0
  }'
```

#### Example - Send Campaign

```bash
curl -X PATCH https://your-domain.com/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "campaignId": "wo_gtm_123",
    "action": "send",
    "instantlyApiKey": "your-instantly-api-key"
  }'
```

---

## Complete Workflow Example

### Step 1: Create Campaign

```javascript
const response = await fetch('/api/gtm/wells-onyx/campaign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`
  },
  body: JSON.stringify({
    practiceGroupId: 'cybersecurity',
    targetCount: 25
  })
})

const { campaignId, messages } = await response.json()
console.log(`Created campaign: ${campaignId}`)
console.log(`Generated ${messages.length} messages`)
```

### Step 2: Review and Approve Messages

```javascript
// Get campaign status
const statusResponse = await fetch(
  `/api/gtm/wells-onyx/campaign?campaignId=${campaignId}`,
  {
    headers: { 'Authorization': `Bearer ${clerkToken}` }
  }
)
const campaign = await statusResponse.json()

// Review each message
campaign.messages.forEach((msg, index) => {
  console.log(`\nMessage ${index}:`)
  console.log(`To: ${msg.prospectEmail}`)
  console.log(`Subject: ${msg.subject}`)
  console.log(`Body: ${msg.body}`)
})

// Approve all messages
await fetch('/api/gtm/wells-onyx/campaign', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`
  },
  body: JSON.stringify({
    campaignId,
    action: 'approve_all'
  })
})
```

### Step 3: Send Campaign

```javascript
const sendResponse = await fetch('/api/gtm/wells-onyx/campaign', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`
  },
  body: JSON.stringify({
    campaignId,
    action: 'send',
    instantlyApiKey: 'your-api-key',
    instantlyCampaignId: 'your-campaign-id'
  })
})

const result = await sendResponse.json()
console.log(`Sent ${result.sent} messages`)
console.log(`Failed: ${result.failed}`)
```

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "Error message",
  "details": {} // Optional additional details
}
```

### Common Error Codes

- **400 Bad Request** - Invalid input data, missing required fields
- **401 Unauthorized** - Missing or invalid authentication token
- **403 Forbidden** - User doesn't own the campaign
- **404 Not Found** - Campaign not found
- **500 Internal Server Error** - Server error

### Example Error Responses

```json
{
  "error": "Campaign not found"
}
```

```json
{
  "error": "Invalid request data",
  "details": [
    {
      "path": ["practiceGroupId"],
      "message": "Practice group ID is required"
    }
  ]
}
```

```json
{
  "error": "12 messages not approved. Approve all messages before sending."
}
```

---

## Practice Groups

Available practice groups with their targeting profiles:

### Cybersecurity (`cybersecurity`)
- **Target Titles:** CEO, COO, VP HR, Head of TA, CHRO
- **Industries:** Financial Services, Healthcare, Technology, Government Contractors, SaaS
- **Company Size:** 51-5000 employees
- **Avg Deal Size:** $35,000

### Fintech (`fintech`)
- **Target Titles:** CEO, COO, CFO, Chief Compliance Officer, VP People
- **Industries:** Financial Technology, Payments, Banking, Digital Assets, Lending
- **Company Size:** 11-500 employees
- **Avg Deal Size:** $40,000

### Aerospace (`aerospace`)
- **Target Titles:** CEO, CTO, VP Engineering, Head of Talent, COO
- **Industries:** Aerospace, Defense, Aviation, Space Technology, Drones & Robotics
- **Company Size:** 11-1000 employees
- **Avg Deal Size:** $45,000

### Healthcare (`healthcare`)
- **Target Titles:** CEO, COO, CMO, VP Product, Head of People
- **Industries:** Healthcare Technology, Medical Devices, Digital Health, Biotechnology
- **Company Size:** 11-500 employees
- **Avg Deal Size:** $38,000

### SaaS (`saas`)
- **Target Titles:** CEO, CRO, VP Sales, Head of GTM, VP People
- **Industries:** Software, SaaS, Enterprise Software, Developer Tools, B2B Technology
- **Company Size:** 11-500 employees
- **Avg Deal Size:** $42,000

---

## Integration with Wells AI Chat

The campaign API can be triggered from Wells AI chat conversations:

```
User: "Wells, find me buyers for my cybersecurity practice"

Wells: [Detects Wells Onyx GTM intent, calls API]

Wells: "I've identified 25 prospects in the 80-90% zone - VPs of HR
       and COOs at Series B/C companies who recently raised funding.
       I've drafted personalized messages using your formula.
       Want to review before I send?"
```

See `lib/gtm/wells-onyx-launcher.ts` for intent detection logic.

---

## Prisma Migration

After adding the schema, run:

```bash
npx prisma migrate dev --name add_wells_onyx_campaigns
npx prisma generate
```

---

## Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Instantly.ai (optional - can be provided per-campaign)
INSTANTLY_API_KEY=your-api-key
INSTANTLY_CAMPAIGN_ID=your-campaign-id

# Anthropic (for message generation)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Testing

### Manual Testing with cURL

```bash
# 1. Create campaign
CAMPAIGN_ID=$(curl -s -X POST https://your-domain.com/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d '{"practiceGroupId":"cybersecurity","targetCount":5}' \
  | jq -r '.campaignId')

echo "Campaign ID: $CAMPAIGN_ID"

# 2. Get campaign status
curl -X GET "https://your-domain.com/api/gtm/wells-onyx/campaign?campaignId=$CAMPAIGN_ID" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  | jq .

# 3. Approve all messages
curl -X PATCH https://your-domain.com/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"approve_all\"}" \
  | jq .

# 4. Send campaign (dry run - set INSTANTLY_API_KEY first)
curl -X PATCH https://your-domain.com/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"send\",\"instantlyApiKey\":\"$INSTANTLY_API_KEY\"}" \
  | jq .
```

### Automated Testing

```typescript
import { describe, it, expect } from '@jest/globals'

describe('Wells Onyx Campaign API', () => {
  it('creates a campaign', async () => {
    const response = await fetch('/api/gtm/wells-onyx/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceGroupId: 'cybersecurity',
        targetCount: 5
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.campaignId).toBeTruthy()
    expect(data.messages.length).toBe(5)
  })

  it('approves a message', async () => {
    const createResponse = await fetch('/api/gtm/wells-onyx/campaign', {
      method: 'POST',
      body: JSON.stringify({ practiceGroupId: 'saas', targetCount: 1 })
    })
    const { campaignId } = await createResponse.json()

    const approveResponse = await fetch('/api/gtm/wells-onyx/campaign', {
      method: 'PATCH',
      body: JSON.stringify({
        campaignId,
        action: 'approve_message',
        messageIndex: 0
      })
    })

    expect(approveResponse.status).toBe(200)
    const data = await approveResponse.json()
    expect(data.approvedCount).toBe(1)
  })
})
```

---

## Security Considerations

1. **Authentication:** All endpoints require valid Clerk authentication
2. **Authorization:** Users can only access their own campaigns
3. **API Key Storage:** Instantly API keys are stored encrypted in database
4. **Rate Limiting:** Consider implementing rate limits for campaign creation
5. **Input Validation:** All inputs validated with Zod schemas

---

## Performance

- **Campaign Creation:** ~2-5 seconds for 25 prospects
- **Message Approval:** <100ms per message
- **Campaign Send:** ~1-2 seconds per message (Instantly.ai rate limits)

For large campaigns (50+), consider:
- Background job processing
- Batch sending with delays
- Progress tracking webhooks

---

## Future Enhancements

Planned features:
- [ ] LinkedIn message support
- [ ] A/B testing different message variants
- [ ] Campaign analytics (open rates, reply rates)
- [ ] AI-powered message optimization
- [ ] Webhook notifications for campaign events
- [ ] Campaign templates and presets
- [ ] Multi-channel orchestration (email + LinkedIn)

---

## Support

For questions or issues:
- GitHub Issues: [wells-ai-github-ready/issues](https://github.com/your-org/wells-ai-github-ready/issues)
- Email: support@wellsonyx.com
- Slack: #wells-ai-support
