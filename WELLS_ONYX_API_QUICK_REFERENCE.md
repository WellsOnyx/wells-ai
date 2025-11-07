# Wells Onyx Campaign API - Quick Reference Card

## Quick Start

```bash
# 1. Run automated tests
node test-wells-onyx-api.js    # or: ./test-wells-onyx-api.sh

# 2. Create campaign
curl -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"practiceGroupId":"cybersecurity","targetCount":25}' | jq .

# 3. Retrieve campaign
curl http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=<ID> | jq .

# 4. Approve all & send
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"<ID>","action":"approve_all"}' | jq .
```

---

## API Endpoints

### POST /api/gtm/wells-onyx/campaign

**Create a new campaign**

```json
{
  "practiceGroupId": "cybersecurity",      // Required: see list below
  "targetCount": 25,                       // Optional: 1-100, default 25
  "instantlyApiKey": "key",                // Optional
  "instantlyCampaignId": "id"              // Optional
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "campaignId": "wo_gtm_1730908800000",
  "practiceGroup": "Cybersecurity & Data Privacy Leadership",
  "prospects": 25,
  "messages": [...],
  "status": "draft",
  "preview": "..."
}
```

---

### GET /api/gtm/wells-onyx/campaign?campaignId=XXX

**Retrieve campaign details**

**Parameters**:
- `campaignId` (required): Campaign ID from creation

**Response**: `200 OK`
```json
{
  "success": true,
  "campaignId": "wo_gtm_1730908800000",
  "practiceGroup": "Cybersecurity & Data Privacy Leadership",
  "status": "draft",
  "prospects": 25,
  "messages": [...],
  "approvedCount": 0,
  "sentCount": 0,
  "createdAt": "2025-11-07T...",
  "updatedAt": "2025-11-07T...",
  "approvedAt": null,
  "sentAt": null
}
```

---

### PATCH /api/gtm/wells-onyx/campaign

**Update campaign (approve/send)**

```json
{
  "campaignId": "wo_gtm_1730908800000",           // Required
  "action": "approve_message",                     // Required: see actions below
  "messageIndex": 0,                               // For: approve_message, reject_message
  "instantlyApiKey": "key",                        // For: send action
  "instantlyCampaignId": "id"                      // For: send action
}
```

#### Actions

**approve_message** - Approve single message by index
```json
{
  "campaignId": "wo_gtm_123",
  "action": "approve_message",
  "messageIndex": 0
}
```
Response: `200 OK`
```json
{
  "success": true,
  "message": "Message approved",
  "approvedCount": 1,
  "totalMessages": 25
}
```

**reject_message** - Reject single message by index
```json
{
  "campaignId": "wo_gtm_123",
  "action": "reject_message",
  "messageIndex": 0
}
```
Response: `200 OK`
```json
{
  "success": true,
  "message": "Message rejected",
  "approvedCount": 0,
  "totalMessages": 25
}
```

**approve_all** - Approve all messages at once
```json
{
  "campaignId": "wo_gtm_123",
  "action": "approve_all"
}
```
Response: `200 OK`
```json
{
  "success": true,
  "message": "All messages approved",
  "approvedCount": 25,
  "status": "ready"
}
```

**send** - Send approved campaign via Instantly.ai
```json
{
  "campaignId": "wo_gtm_123",
  "action": "send",
  "instantlyApiKey": "your-api-key"  // Optional if in .env
}
```
Response: `200 OK`
```json
{
  "success": true,
  "message": "Campaign sent successfully",
  "sent": 25,
  "failed": 0,
  "status": "sent"
}
```

---

## Practice Groups

Valid `practiceGroupId` values:

| ID | Name | Target Role | Avg Deal |
|----|------|-------------|----------|
| `cybersecurity` | Cybersecurity & Data Privacy Leadership | CISO, VP Security | $35K |
| `fintech` | Fintech & Payments Leadership | Chief Risk Officer, VP Compliance | $40K |
| `aerospace` | Aerospace & Defense Leadership | CTO, VP Engineering | $45K |
| `healthcare` | Healthcare & Life Sciences Leadership | CMO, VP Clinical Affairs | $38K |
| `saas` | SaaS & Enterprise Software Leadership | CRO, VP Sales | $42K |

---

## Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| `200` | Success | Campaign created/retrieved/updated |
| `400` | Bad Request | Invalid input, validation error |
| `401` | Unauthorized | Missing/invalid authentication |
| `403` | Forbidden | Not campaign owner |
| `404` | Not Found | Campaign doesn't exist |
| `500` | Server Error | Invalid practice group, DB error |

---

## Campaign Status Flow

```
CREATE
  ↓
DRAFT (initial status)
  ↓
[User approves messages]
  ↓
READY (all messages approved)
  ↓
[User sends]
  ↓
SENDING (sending in progress)
  ↓
SENT (completed)
```

---

## Error Examples

**Invalid Practice Group**
```bash
curl -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"practiceGroupId":"invalid","targetCount":25}'

# Response: 500
# {"error":"Practice group not found: invalid"}
```

**Validation Error**
```bash
curl -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"practiceGroupId":"cybersecurity","targetCount":150}'

# Response: 400
# {"error":"Invalid request data","details":[{"code":"too_big",...}]}
```

**Missing Parameter**
```bash
curl http://localhost:3000/api/gtm/wells-onyx/campaign

# Response: 400
# {"error":"campaignId required"}
```

**Send Without Approval**
```bash
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"wo_gtm_123","action":"send"}'

# Response: 400
# {"error":"5 messages not approved. Approve all messages before sending."}
```

**Missing API Key for Send**
```bash
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"wo_gtm_123","action":"send"}'

# Response: 400 (if INSTANTLY_API_KEY not set)
# {"error":"Instantly API key required..."}
```

---

## Workflow Examples

### Complete Campaign in One Go

```bash
# 1. Create campaign
RESPONSE=$(curl -s -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"practiceGroupId":"cybersecurity","targetCount":5}')

CAMPAIGN_ID=$(echo "$RESPONSE" | jq -r '.campaignId')
echo "Created: $CAMPAIGN_ID"

# 2. Check status
curl -s http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=$CAMPAIGN_ID | jq .

# 3. Approve all
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"approve_all\"}" | jq .

# 4. Send (if API key configured)
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"send\"}" | jq .
```

### Review Individual Messages

```bash
# Create campaign
CAMPAIGN_ID=$(curl -s -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"practiceGroupId":"fintech","targetCount":3}' | jq -r '.campaignId')

# Review messages
curl -s http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=$CAMPAIGN_ID | \
  jq '.messages[] | {email: .prospectEmail, subject: .subject, approved: .approved}'

# Approve first message
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"approve_message\",\"messageIndex\":0}" | jq .

# Approve second message
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"approve_message\",\"messageIndex\":1}" | jq .

# Send when ready
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"send\"}" | jq .
```

---

## Database Schema

```prisma
model WellsOnyxCampaign {
  id                  String         @id @default(uuid())
  campaignId          String         @unique
  userId              String
  practiceGroupId     String
  practiceGroupName   String
  status              CampaignStatus @default(DRAFT)
  prospectCount       Int
  messageCount        Int
  approvedCount       Int
  sentCount           Int
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

---

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:password@host/dbname
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
ANTHROPIC_API_KEY=sk-ant-...

# Optional
INSTANTLY_API_KEY=your-api-key
INSTANTLY_CAMPAIGN_ID=your-campaign-id
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Ensure Clerk auth is configured and token is valid |
| `404 Campaign not found` | Check campaignId is correct, verify you own the campaign |
| `400 Practice group not found` | Use valid practiceGroupId from the list above |
| `400 targetCount out of range` | Use value between 1 and 100 |
| `400 messages not approved` | Call approve_all or approve individual messages first |
| `400 API key required` | Set INSTANTLY_API_KEY env var or pass in request |
| `403 Unauthorized (GET/PATCH)` | You don't own this campaign, use your own |

---

## Testing

**Run automated test suite**:
```bash
# Bash version
chmod +x test-wells-onyx-api.sh
./test-wells-onyx-api.sh

# Node.js version
node test-wells-onyx-api.js
```

**Run Jest tests**:
```bash
npm test app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts
```

---

## Files

| File | Purpose |
|------|---------|
| `app/api/gtm/wells-onyx/campaign/route.ts` | API implementation |
| `test-wells-onyx-api.sh` | Bash test script |
| `test-wells-onyx-api.js` | Node.js test script |
| `WELLS_ONYX_API_TEST_REPORT.md` | Detailed analysis |
| `WELLS_ONYX_API_TESTING_GUIDE.md` | How to test |
| `WELLS_ONYX_API_TEST_SUMMARY.md` | Test results |
| `app/api/gtm/wells-onyx/campaign/README.md` | Quick start |
| `app/api/gtm/wells-onyx/campaign/example-usage.tsx` | Frontend example |
| `app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts` | Jest tests |

---

## Quick Help

**Get all messages for review**:
```bash
curl -s http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=<ID> | \
  jq '.messages[] | {i: [.prospectEmail], subject: .subject}'
```

**Count approved messages**:
```bash
curl -s http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=<ID> | \
  jq '[.messages[] | select(.approved==true)] | length'
```

**Get campaign status only**:
```bash
curl -s http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=<ID> | \
  jq '{status, approvedCount, totalMessages: (.messages | length)}'
```

**Retry single message approval**:
```bash
# Reject it
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"<ID>","action":"reject_message","messageIndex":0}' | jq .

# Then approve again
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"<ID>","action":"approve_message","messageIndex":0}' | jq .
```

---

## Support

- See `WELLS_ONYX_API_TESTING_GUIDE.md` for detailed testing instructions
- See `WELLS_ONYX_API_TEST_SUMMARY.md` for test results and analysis
- See `app/api/gtm/wells-onyx/campaign/README.md` for quick start
- Check server logs for `[WELLS ONYX GTM]` prefix messages
