# Wells Onyx Campaign API - Comprehensive Test Report

## Overview
Testing the Wells Onyx Campaign API endpoints at `app/api/gtm/wells-onyx/campaign/route.ts`

Test Date: 2025-11-07
API Base URL: http://localhost:3000/api/gtm/wells-onyx/campaign

---

## Endpoint Analysis

### 1. POST /api/gtm/wells-onyx/campaign - Create Campaign

#### Endpoint Details:
- **Method**: POST
- **Authentication**: Required (Clerk)
- **Input Validation**: Zod schema with required fields:
  - `practiceGroupId` (string, required)
  - `targetCount` (number, optional, default: 25, min: 1, max: 100)
  - `instantlyApiKey` (string, optional)
  - `instantlyCampaignId` (string, optional)

#### Dependencies:
- Clerk authentication middleware
- `quickLaunch()` function from wells-onyx-launcher
- Prisma ORM for database persistence
- WellsOnyxCampaign model

#### Response Structure:
```json
{
  "success": true,
  "campaignId": "wo_gtm_1730908800000",
  "practiceGroup": "Cybersecurity & Data Privacy Leadership",
  "prospects": 25,
  "messages": [
    {
      "prospectEmail": "email@example.com",
      "channel": "email",
      "subject": "...",
      "body": "...",
      "approved": false
    }
  ],
  "status": "draft",
  "preview": "..."
}
```

#### Test Cases:
1. **Valid Campaign Creation** - Should return 200 with campaign data
2. **Invalid Practice Group** - Should return 500 with error
3. **Invalid TargetCount** - Should return 400 (exceeds max of 100)
4. **Missing Authentication** - Should return 401 Unauthorized
5. **Validation Errors** - Should return 400 with Zod error details

#### Database Operations:
- Creates record in `WellsOnyxCampaign` table
- Stores: campaignId, userId, practiceGroupId, practiceGroupName, status, prospectCount, messageCount, approvedCount, sentCount, practiceGroupData, prospectsData, messagesData, instantlyApiKey, instantlyCampaignId
- Default status: "DRAFT"
- Default approvedCount: 0
- Default sentCount: 0

---

### 2. GET /api/gtm/wells-onyx/campaign?campaignId=XXX - Retrieve Campaign

#### Endpoint Details:
- **Method**: GET
- **Authentication**: Required (Clerk)
- **Parameters**:
  - `campaignId` (query param, required)

#### Validation:
- campaignId is required (returns 400 if missing)
- Campaign must exist in database (returns 404 if not)
- User must own the campaign (returns 403 if not)

#### Response Structure:
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

#### Test Cases:
1. **Valid CampaignId** - Should return 200 with campaign data
2. **Non-existent CampaignId** - Should return 404
3. **Missing campaignId Parameter** - Should return 400
4. **Ownership Verification** - Should return 403 for campaigns not owned by user
5. **Data Consistency** - Retrieved data should match database record

---

### 3. PATCH /api/gtm/wells-onyx/campaign - Update Campaign

#### Endpoint Details:
- **Method**: PATCH
- **Authentication**: Required (Clerk)
- **Actions**:
  - `approve_message` - Approve single message
  - `reject_message` - Reject single message
  - `approve_all` - Approve all messages
  - `send` - Send campaign via Instantly.ai

#### Input Validation:
```json
{
  "campaignId": "wo_gtm_123",
  "action": "approve_message|reject_message|approve_all|send",
  "messageIndex": 0,  // For approve_message/reject_message
  "instantlyApiKey": "key",  // For send action
  "instantlyCampaignId": "id"  // For send action
}
```

#### Action: approve_message
- Requires: `messageIndex`
- Validates: messageIndex is within bounds
- Updates: Sets message.approved = true
- Updates DB: Increments approvedCount, updates status to "READY" if all approved

#### Action: reject_message
- Requires: `messageIndex`
- Validates: messageIndex is within bounds
- Updates: Sets message.approved = false
- Updates DB: Decrements approvedCount

#### Action: approve_all
- Approves all messages in campaign
- Sets status to "READY"
- Records approvedAt timestamp

#### Action: send
- Requires: All messages must be approved
- Requires: Instantly API key (from request, database, or environment)
- Updates status to "SENDING" then "SENT"
- Calls approveCampaign() function
- Records sentAt timestamp

#### Response Structures:

**Approve Message Response:**
```json
{
  "success": true,
  "message": "Message approved",
  "approvedCount": 1,
  "totalMessages": 25
}
```

**Reject Message Response:**
```json
{
  "success": true,
  "message": "Message rejected",
  "approvedCount": 0,
  "totalMessages": 25
}
```

**Approve All Response:**
```json
{
  "success": true,
  "message": "All messages approved",
  "approvedCount": 25,
  "status": "ready"
}
```

**Send Response:**
```json
{
  "success": true,
  "message": "Campaign sent successfully",
  "sent": 25,
  "failed": 0,
  "status": "sent"
}
```

#### Test Cases:
1. **Approve Single Message** - Should return 200 and update approvedCount
2. **Reject Single Message** - Should return 200 and decrement approvedCount
3. **Approve All Messages** - Should return 200 and set status to "ready"
4. **Invalid MessageIndex** - Should return 400
5. **Missing MessageIndex** - Should return 400 for approve_message/reject_message
6. **Send Without Approval** - Should return 400 with error message
7. **Send Without API Key** - Should return 400 if no API key available
8. **Campaign Not Found** - Should return 404
9. **Unauthorized Access** - Should return 403

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

## Supported Practice Groups

Based on wells-onyx-templates.ts:
1. **cybersecurity** - CISO, VP Security ($35K avg deal)
2. **fintech** - Chief Risk Officer, Head of Compliance ($40K avg deal)
3. **aerospace** - CTO, VP Engineering ($45K avg deal)
4. **healthcare** - CMO, VP Clinical Affairs ($38K avg deal)
5. **saas** - CRO, VP Sales ($42K avg deal)

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "error": "Error message",
  "details": {}  // Only for Zod validation errors
}
```

### Status Codes:
- **200** - Success
- **400** - Invalid request (validation error, missing param, invalid action)
- **401** - Unauthorized (missing/invalid authentication)
- **403** - Forbidden (not campaign owner)
- **404** - Campaign/resource not found
- **500** - Server error

---

## Security Considerations

1. **Authentication**: All endpoints require Clerk authentication
2. **Authorization**: GET and PATCH verify campaign ownership before returning/modifying
3. **Input Validation**: Zod schema validation on all inputs
4. **API Key Handling**: Instantly API keys can be stored in database or provided per request
5. **Status Transitions**: Campaign status follows workflow (DRAFT → READY → SENDING → SENT)

---

## Integration Points

### Wells Onyx Launcher Integration:
- `quickLaunch()` - Creates campaign with prospects and messages
- `approveCampaign()` - Sends messages via Instantly.ai
- `previewCampaign()` - Generates preview content

### Instantly.ai Integration:
- Sends approved messages
- Returns sent/failed counts
- Requires valid API key

### Prisma Database:
- Persists campaign data
- Tracks status and counts
- Records timestamps

---

## Testing Approach

### Manual Testing Steps:

1. **Prerequisite**: Ensure backend is running (npm run dev)
2. **Ensure**: Prisma migrations are applied
3. **Set up**: Valid Clerk authentication token
4. **Run tests**: Use curl commands or test script

### Automated Testing:

Tests are in `app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts`

Run with:
```bash
npm test app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts
```

---

## Known Limitations

1. **Send Action**: Requires valid Instantly API key - will fail if not provided
2. **Practice Group Validation**: Only predefined practice groups are supported
3. **TargetCount Limits**: Max 100 prospects per campaign
4. **Database Dependency**: All operations require Prisma/database connection
5. **Ownership Check**: Users can only access/modify their own campaigns

---

## Future Enhancements

1. Add campaign scheduling (send at specific time)
2. Add analytics integration (track opens, clicks)
3. Add message templating system
4. Add bulk campaign operations
5. Add campaign cloning
6. Add approval workflows (manager approval before send)
7. Add A/B testing support
8. Add webhook callbacks for Instantly.ai events

---

## Files Involved

- **API Route**: `/app/api/gtm/wells-onyx/campaign/route.ts`
- **Tests**: `/app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts`
- **Example**: `/app/api/gtm/wells-onyx/campaign/example-usage.tsx`
- **Docs**: `/docs/WELLS_ONYX_CAMPAIGN_API.md`
- **Support Library**: `/lib/gtm/wells-onyx-launcher.ts`
- **Templates**: `/lib/gtm/wells-onyx-templates.ts`
- **Database Schema**: `/prisma/schema.prisma`

---

## Environment Variables Required

```env
# Clerk Authentication
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...

# Database
DATABASE_URL=postgresql://...

# Instantly.ai (Optional - can be provided per request)
INSTANTLY_API_KEY=your-api-key
INSTANTLY_CAMPAIGN_ID=your-campaign-id

# Anthropic API (for prospect finding)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Summary

The Wells Onyx Campaign API provides a complete system for:
1. Creating GTM campaigns with AI-generated messaging
2. Managing message approval workflow
3. Sending campaigns via Instantly.ai
4. Tracking campaign status and metrics

All endpoints include proper authentication, authorization, validation, and error handling.
