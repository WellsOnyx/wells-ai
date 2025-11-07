# Wells Onyx Campaign API - Quick Start

Complete campaign management for Wells Onyx executive search. Launch GTM campaigns in 3 API calls.

## Installation

### 1. Database Migration

```bash
cd /Users/jonahmanning/Downloads/wells-ai-github-ready
npx prisma migrate dev --name add_wells_onyx_campaigns
npx prisma generate
```

### 2. Environment Variables

Add to `.env`:
```env
# Required
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
ANTHROPIC_API_KEY=sk-ant-...

# Optional (can provide per-campaign)
INSTANTLY_API_KEY=your-instantly-api-key
INSTANTLY_CAMPAIGN_ID=your-campaign-id
```

## Usage

### 3-Step Workflow

```bash
# Step 1: Create Campaign
curl -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d '{
    "practiceGroupId": "cybersecurity",
    "targetCount": 25
  }'

# Returns: { "campaignId": "wo_gtm_123", "messages": [...] }

# Step 2: Approve All Messages
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d '{
    "campaignId": "wo_gtm_123",
    "action": "approve_all"
  }'

# Step 3: Send Campaign
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d '{
    "campaignId": "wo_gtm_123",
    "action": "send",
    "instantlyApiKey": "your-api-key"
  }'
```

## Practice Groups

| ID | Practice Group | Targets | Avg Deal |
|----|---------------|---------|----------|
| `cybersecurity` | Cybersecurity & Data Privacy | CISOs, VP Security | $35K |
| `fintech` | Fintech & Payments | Chief Risk Officers | $40K |
| `aerospace` | Aerospace & Defense | CTOs, VP Engineering | $45K |
| `healthcare` | Healthcare & MedTech | CMOs, VP Clinical | $38K |
| `saas` | SaaS & Enterprise Software | CROs, VP Sales | $42K |

## Files Created

```
✅ app/api/gtm/wells-onyx/campaign/route.ts          # API endpoints (393 lines)
✅ app/api/gtm/wells-onyx/campaign/example-usage.tsx # React component
✅ app/api/gtm/wells-onyx/campaign/README.md         # Quick reference
✅ app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts # Tests
✅ docs/WELLS_ONYX_CAMPAIGN_API.md                   # Full API docs
✅ prisma/schema.prisma                              # WellsOnyxCampaign model
```

## API Endpoints

### POST `/api/gtm/wells-onyx/campaign`
**Create campaign**
```json
{
  "practiceGroupId": "cybersecurity",
  "targetCount": 25
}
```
Returns: Campaign with AI-generated messages

### GET `/api/gtm/wells-onyx/campaign?campaignId=wo_gtm_123`
**Get campaign status**

Returns: Campaign details, message approval state, metrics

### PATCH `/api/gtm/wells-onyx/campaign`
**Update campaign**

Actions:
- `approve_message` - Approve single message (requires `messageIndex`)
- `reject_message` - Reject single message (requires `messageIndex`)
- `approve_all` - Approve all messages
- `send` - Send approved messages via Instantly.ai

## Example: Complete Workflow

```javascript
// 1. Create Campaign
const createResponse = await fetch('/api/gtm/wells-onyx/campaign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    practiceGroupId: 'cybersecurity',
    targetCount: 25
  })
})

const { campaignId, messages } = await createResponse.json()
console.log(`Created campaign with ${messages.length} messages`)

// 2. Review messages (optional)
messages.forEach((msg, i) => {
  console.log(`\nMessage ${i}:`)
  console.log(`To: ${msg.prospectEmail}`)
  console.log(`Subject: ${msg.subject}`)
  console.log(msg.body)
})

// 3. Approve all
await fetch('/api/gtm/wells-onyx/campaign', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    campaignId,
    action: 'approve_all'
  })
})

// 4. Send
const sendResponse = await fetch('/api/gtm/wells-onyx/campaign', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    campaignId,
    action: 'send',
    instantlyApiKey: process.env.INSTANTLY_API_KEY
  })
})

const { sent, failed } = await sendResponse.json()
console.log(`✅ Sent: ${sent} | ❌ Failed: ${failed}`)
```

## React Component

Use the pre-built component:

```tsx
import WellsOnyxCampaignExample from '@/app/api/gtm/wells-onyx/campaign/example-usage'

export default function CampaignPage() {
  return <WellsOnyxCampaignExample />
}
```

Features:
- Practice group selection
- Message preview
- One-click approval
- Send campaign
- Real-time status

## Database Schema

```prisma
model WellsOnyxCampaign {
  id                  String         @id @default(uuid())
  campaignId          String         @unique // wo_gtm_123
  userId              String
  practiceGroupId     String
  practiceGroupName   String
  status              CampaignStatus @default(DRAFT)
  prospectCount       Int
  messageCount        Int
  approvedCount       Int
  sentCount           Int
  messagesData        Json           // Full message array
  createdAt           DateTime       @default(now())
  // ... more fields
}
```

## Testing

```bash
# Run tests
npm test app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts

# Manual test
CAMPAIGN_ID=$(curl -s -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"practiceGroupId":"saas","targetCount":5}' | jq -r '.campaignId')

echo "Campaign: $CAMPAIGN_ID"

# Approve and send
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"approve_all\"}" | jq .
```

## Integration with Wells AI

Wells AI automatically detects campaign intent:

```
User: "Find me buyers for my cybersecurity practice"

Wells: [Calls quickLaunch({ practiceGroupId: 'cybersecurity' })]

Wells: "I've identified 25 prospects in the 80-90% zone:
       - VPs of HR at Series B/C companies
       - COOs at recently funded startups
       - CHROs at companies with security incidents

       I've drafted personalized messages using your formula.
       Review and approve?"

User: "Approve all"

Wells: [Calls approve_all action]

Wells: "All 25 messages approved. Send now?"

User: "Yes"

Wells: [Calls send action]

Wells: "✅ Campaign sent! 25 messages delivered via Instantly.ai"
```

## Error Handling

All endpoints return:
```json
{
  "error": "Error message",
  "details": {} // Optional
}
```

Common errors:
- `400` - Invalid input (wrong practice group, targetCount > 100)
- `401` - Not authenticated
- `403` - Not campaign owner
- `404` - Campaign not found
- `500` - Server error

## Documentation

Full docs: `/docs/WELLS_ONYX_CAMPAIGN_API.md`

Contents:
- Complete API reference
- Request/response examples
- Error handling guide
- Integration patterns
- Advanced usage

## Performance

- **Campaign creation:** 2-5 seconds (25 prospects)
- **Message approval:** <100ms per message
- **Send campaign:** 1-2 seconds per message (Instantly rate limits)

## Security

- ✅ Clerk authentication required
- ✅ Campaign ownership verification
- ✅ Input validation with Zod
- ✅ API keys stored securely
- ✅ SQL injection protection (Prisma)

## Next Steps

1. Run migration: `npx prisma migrate dev`
2. Test endpoints with cURL
3. Try React component
4. Integrate with Wells AI chat
5. Connect Instantly.ai account

## Support

- 📖 Full docs: `/docs/WELLS_ONYX_CAMPAIGN_API.md`
- 💻 Example code: `example-usage.tsx`
- 🧪 Tests: `__tests__/route.test.ts`
- 📝 Quick ref: `README.md`

---

**Built for Wells Onyx by Wells AI**
