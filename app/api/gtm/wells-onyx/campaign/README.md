# Wells Onyx Campaign API

Complete campaign management system for Wells Onyx executive search GTM.

## Quick Start

### 1. Run Prisma Migration

```bash
npx prisma migrate dev --name add_wells_onyx_campaigns
npx prisma generate
```

### 2. Create a Campaign

```bash
curl -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "practiceGroupId": "cybersecurity",
    "targetCount": 25
  }'
```

Response:
```json
{
  "success": true,
  "campaignId": "wo_gtm_1730908800000",
  "practiceGroup": "Cybersecurity & Data Privacy Leadership",
  "prospects": 25,
  "messages": [...],
  "status": "draft"
}
```

### 3. Approve Messages

```bash
# Approve all at once
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "campaignId": "wo_gtm_1730908800000",
    "action": "approve_all"
  }'
```

### 4. Send Campaign

```bash
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "campaignId": "wo_gtm_1730908800000",
    "action": "send",
    "instantlyApiKey": "your-api-key"
  }'
```

## Files Created

```
app/api/gtm/wells-onyx/campaign/
├── route.ts                    # Main API route (POST, GET, PATCH)
├── example-usage.tsx           # React component example
├── README.md                   # This file
└── __tests__/
    └── route.test.ts           # Jest tests

docs/
└── WELLS_ONYX_CAMPAIGN_API.md  # Complete API documentation

prisma/
└── schema.prisma               # Updated with WellsOnyxCampaign model
```

## API Endpoints

### POST `/api/gtm/wells-onyx/campaign`
Create new campaign with AI-generated messages

### GET `/api/gtm/wells-onyx/campaign?campaignId=<id>`
Retrieve campaign status and messages

### PATCH `/api/gtm/wells-onyx/campaign`
Update campaign (approve/reject messages, send)

## Practice Groups

- `cybersecurity` - CISO, VP Security ($35K avg deal)
- `fintech` - Chief Risk Officer, Head of Compliance ($40K avg deal)
- `aerospace` - CTO, VP Engineering ($45K avg deal)
- `healthcare` - CMO, VP Clinical Affairs ($38K avg deal)
- `saas` - CRO, VP Sales ($42K avg deal)

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

## Integration Points

### Wells AI Chat
Detects Wells Onyx GTM intent and triggers campaign creation:
```
User: "Wells, find me buyers for my cybersecurity practice"
Wells: [Creates campaign] "I've identified 25 prospects..."
```

### Instantly.ai
Sends approved messages via Instantly API:
- Email delivery
- Lead tracking
- Campaign management

### Notion (Optional)
Can integrate with Notion GTM databases for tracking.

## Error Handling

All endpoints return consistent error format:
```json
{
  "error": "Error message",
  "details": {}
}
```

Status codes:
- `200` - Success
- `400` - Invalid request
- `401` - Unauthorized
- `403` - Forbidden (not campaign owner)
- `404` - Campaign not found
- `500` - Server error

## Testing

Run tests:
```bash
npm test app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts
```

Manual test workflow:
```bash
# 1. Create
CAMPAIGN_ID=$(curl -s -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"practiceGroupId":"cybersecurity","targetCount":5}' | jq -r '.campaignId')

# 2. Get status
curl -s "http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=$CAMPAIGN_ID" | jq .

# 3. Approve all
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"approve_all\"}" | jq .

# 4. Send (requires Instantly API key)
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"send\",\"instantlyApiKey\":\"$INSTANTLY_API_KEY\"}" | jq .
```

## Environment Variables

```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
ANTHROPIC_API_KEY=sk-ant-...
INSTANTLY_API_KEY=your-api-key        # Optional
INSTANTLY_CAMPAIGN_ID=your-campaign-id # Optional
```

## Frontend Usage

See `example-usage.tsx` for complete React component with:
- Campaign creation UI
- Message review interface
- Approval workflow
- Send functionality

## Dependencies

Required packages:
- `@clerk/nextjs` - Authentication
- `@prisma/client` - Database ORM
- `zod` - Input validation
- `next` - API routes

## Documentation

See `/docs/WELLS_ONYX_CAMPAIGN_API.md` for complete API documentation including:
- Request/response examples
- Error handling
- Workflow examples
- Integration guides

## Support

For questions:
- Check `/docs/WELLS_ONYX_CAMPAIGN_API.md`
- Review `example-usage.tsx`
- Run tests for examples
- Check console logs (prefixed with `[WELLS ONYX GTM]`)
