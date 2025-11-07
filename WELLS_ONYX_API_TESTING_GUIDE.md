# Wells Onyx Campaign API - Complete Testing Guide

## Quick Start

### Option 1: Run Bash Script (Recommended for curl users)

```bash
chmod +x test-wells-onyx-api.sh
./test-wells-onyx-api.sh
```

### Option 2: Run Node.js Script

```bash
node test-wells-onyx-api.js
```

### Option 3: Manual curl Testing

See "Manual Testing" section below.

---

## Prerequisites

1. **Backend Running**: Ensure the Next.js backend is running:
   ```bash
   npm run dev
   ```
   Should be accessible at `http://localhost:3000`

2. **Database**: Prisma database must be initialized:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

3. **Environment Variables**: Ensure `.env.local` has:
   ```env
   DATABASE_URL=postgresql://...
   CLERK_SECRET_KEY=sk_...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   ANTHROPIC_API_KEY=sk-ant-...
   # Optional: INSTANTLY_API_KEY=...
   ```

4. **Dependencies**:
   - For bash script: `jq` (JSON processor)
   - For Node.js script: Node.js 16+
   - For curl: Standard curl command

---

## Manual Testing with curl

### 1. Create Campaign

```bash
curl -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{
    "practiceGroupId": "cybersecurity",
    "targetCount": 25
  }' | jq .
```

**Response:**
```json
{
  "success": true,
  "campaignId": "wo_gtm_1730908800000",
  "practiceGroup": "Cybersecurity & Data Privacy Leadership",
  "prospects": 25,
  "messages": [
    {
      "prospectEmail": "ciso@example.com",
      "channel": "email",
      "subject": "Urgent: Executive Search for Cybersecurity Leadership",
      "body": "Hi there...",
      "approved": false
    }
  ],
  "status": "draft"
}
```

Save the `campaignId` for next steps:
```bash
CAMPAIGN_ID="wo_gtm_1730908800000"
```

### 2. Retrieve Campaign Status

```bash
curl -X GET "http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=$CAMPAIGN_ID" \
  -H "Content-Type: application/json" | jq .
```

**Response:**
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

### 3. Approve Individual Messages

Approve first message:
```bash
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"action\": \"approve_message\",
    \"messageIndex\": 0
  }" | jq .
```

**Response:**
```json
{
  "success": true,
  "message": "Message approved",
  "approvedCount": 1,
  "totalMessages": 25
}
```

Approve second message:
```bash
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"action\": \"approve_message\",
    \"messageIndex\": 1
  }" | jq .
```

### 4. Reject a Message

```bash
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"action\": \"reject_message\",
    \"messageIndex\": 0
  }" | jq .
```

**Response:**
```json
{
  "success": true,
  "message": "Message rejected",
  "approvedCount": 1,
  "totalMessages": 25
}
```

### 5. Approve All Messages

```bash
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"action\": \"approve_all\"
  }" | jq .
```

**Response:**
```json
{
  "success": true,
  "message": "All messages approved",
  "approvedCount": 25,
  "status": "ready"
}
```

### 6. Send Campaign

**With API Key in Request:**
```bash
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"action\": \"send\",
    \"instantlyApiKey\": \"your-instantly-api-key\"
  }" | jq .
```

**With API Key in Environment:**
```bash
curl -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"action\": \"send\"
  }" | jq .
```

**Response (if API key configured):**
```json
{
  "success": true,
  "message": "Campaign sent successfully",
  "sent": 25,
  "failed": 0,
  "status": "sent"
}
```

**Response (if API key missing):**
```json
{
  "error": "Instantly API key required. Provide instantlyApiKey in request or environment."
}
```

---

## Test Cases Summary

### POST /api/gtm/wells-onyx/campaign

| Test | Input | Expected | Status |
|------|-------|----------|--------|
| Valid creation | practiceGroupId=cybersecurity, targetCount=25 | 200, campaignId returned | ✓ |
| Invalid practice group | practiceGroupId=invalid | 500, error message | ✓ |
| TargetCount too high | targetCount=150 | 400, validation error | ✓ |
| Missing required field | (no practiceGroupId) | 400, validation error | ✓ |
| Default targetCount | (no targetCount specified) | 200, uses default of 25 | ✓ |

### GET /api/gtm/wells-onyx/campaign

| Test | Input | Expected | Status |
|------|-------|----------|--------|
| Valid campaign ID | campaignId=wo_gtm_123 | 200, campaign data | ✓ |
| Non-existent ID | campaignId=wo_gtm_fake | 404, error | ✓ |
| Missing parameter | (no campaignId) | 400, error | ✓ |
| Ownership check | Campaign not owned by user | 403, error | ✓ |

### PATCH /api/gtm/wells-onyx/campaign

| Test | Action | Input | Expected | Status |
|------|--------|-------|----------|--------|
| Approve message | approve_message | messageIndex=0 | 200, approvedCount increments | ✓ |
| Reject message | reject_message | messageIndex=0 | 200, approvedCount decrements | ✓ |
| Approve all | approve_all | (none) | 200, status=ready | ✓ |
| Send approved | send | (with API key) | 200 or error if key missing | ✓ |
| Send unapproved | send | (no approval) | 400, error message | ✓ |
| Invalid index | approve_message | messageIndex=999 | 400, error | ✓ |
| Missing index | approve_message | (no messageIndex) | 400, error | ✓ |
| Non-existent campaign | approve_all | campaignId=fake | 404, error | ✓ |

---

## Test Workflow Examples

### Complete Happy Path

```bash
#!/bin/bash

# 1. Create campaign
echo "Creating campaign..."
CREATE=$(curl -s -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"practiceGroupId":"cybersecurity","targetCount":5}')

CAMPAIGN_ID=$(echo "$CREATE" | jq -r '.campaignId')
echo "Campaign created: $CAMPAIGN_ID"

# 2. Check status
echo "Checking campaign status..."
curl -s "http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=$CAMPAIGN_ID" | jq .

# 3. Approve messages individually
echo "Approving messages..."
for i in {0..4}; do
  curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
    -H "Content-Type: application/json" \
    -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"approve_message\",\"messageIndex\":$i}" | jq .
done

# 4. Send campaign
echo "Sending campaign..."
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"action\":\"send\"}" | jq .
```

### Error Handling Examples

**Test: Campaign not found**
```bash
curl -s http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=invalid \
  -H "Content-Type: application/json"
# Returns 404: { "error": "Campaign not found" }
```

**Test: Validation error**
```bash
curl -s -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"targetCount":150}'
# Returns 400: { "error": "Invalid request data", "details": [...] }
```

**Test: Missing approval**
```bash
curl -s -X PATCH http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"wo_gtm_123","action":"send"}'
# Returns 400: { "error": "3 messages not approved..." }
```

---

## Performance Testing

### Test: Large Campaign Creation

```bash
# Test with maximum allowed targetCount
curl -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
  -H "Content-Type: application/json" \
  -d '{
    "practiceGroupId": "cybersecurity",
    "targetCount": 100
  }' | jq .
```

**Expected Performance:**
- Response time: < 5 seconds
- Creates 100 prospects
- Generates 100 messages
- Database insert: < 500ms

### Test: Multiple Campaign Operations

```bash
# Create multiple campaigns
for i in {1..5}; do
  curl -s -X POST http://localhost:3000/api/gtm/wells-onyx/campaign \
    -H "Content-Type: application/json" \
    -d "{\"practiceGroupId\":\"fintech\",\"targetCount\":10}" | jq '.campaignId'
done
```

---

## Database Verification

### Check Campaign Creation

```bash
# Using psql
psql $DATABASE_URL
SELECT * FROM "WellsOnyxCampaign" ORDER BY "createdAt" DESC LIMIT 1;
```

Expected columns:
- `campaignId`: Unique campaign identifier
- `userId`: User who created it
- `practiceGroupId`: Which practice group
- `status`: DRAFT, READY, SENDING, SENT
- `prospectCount`: Number of prospects
- `messageCount`: Number of messages
- `approvedCount`: Number approved
- `sentCount`: Number sent

### Check Message Updates

```bash
SELECT "campaignId", "status", "approvedCount", "sentCount"
FROM "WellsOnyxCampaign"
WHERE "campaignId" = 'wo_gtm_123';
```

After approve_message: `approvedCount` should increment
After send: `sentCount` should increment, `status` should be SENT

---

## Debugging

### Enable Logging

The API includes console logs prefixed with `[WELLS ONYX GTM]`. Check the server logs:

```bash
# In another terminal while backend is running
npm run dev
# Look for: [WELLS ONYX GTM] Creating campaign...
#           [WELLS ONYX GTM] Campaign created: wo_gtm_123
#           [WELLS ONYX GTM] Message 0 approved
```

### Verify Response Format

Always check that responses follow expected schema:

```bash
curl -s http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=$CAMPAIGN_ID | \
  jq '{success, campaignId, practiceGroup, status, prospects, approvedCount, sentCount}'
```

### Check for Missing Fields

```bash
# Verify all expected response fields
curl -s http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=$CAMPAIGN_ID | \
  jq 'keys'
```

---

## Common Issues and Solutions

### Issue: 401 Unauthorized

**Cause**: Clerk authentication token missing or invalid

**Solution**:
1. Ensure backend has valid `CLERK_SECRET_KEY`
2. For testing, add temporary debug header
3. Check Clerk configuration in `auth()` call

### Issue: Campaign creation fails with "Practice group not found"

**Cause**: Invalid `practiceGroupId`

**Solution**:
Valid practice groups:
- `cybersecurity`
- `fintech`
- `aerospace`
- `healthcare`
- `saas`

### Issue: Send fails with "Instantly API key required"

**Cause**: No API key configured

**Solution**:
1. Set `INSTANTLY_API_KEY` in environment, OR
2. Pass `instantlyApiKey` in request body

### Issue: "Campaign not found" but just created

**Cause**: Race condition or database delay

**Solution**:
1. Wait a moment before retrieving
2. Verify database is running
3. Check Prisma migrations applied

### Issue: Validation error with strange message

**Cause**: Zod schema validation failure

**Solution**:
1. Check request JSON syntax (use `jq` to validate)
2. Verify all required fields present
3. Check field types (targetCount must be number, not string)

---

## Integration Testing Checklist

- [ ] POST: Create campaign with 25 prospects
- [ ] POST: Validate practice group list
- [ ] POST: Test targetCount bounds (1-100)
- [ ] POST: Verify database persistence
- [ ] GET: Retrieve created campaign
- [ ] GET: Verify all fields in response
- [ ] GET: Test 404 for non-existent
- [ ] GET: Verify ownership check
- [ ] PATCH: Approve single message
- [ ] PATCH: Reject single message
- [ ] PATCH: Approve all messages
- [ ] PATCH: Verify status change to READY
- [ ] PATCH: Reject send without approval
- [ ] PATCH: Test invalid messageIndex
- [ ] PATCH: Send with API key (if configured)
- [ ] Database: Verify all records created
- [ ] Database: Verify counts updated correctly
- [ ] Error handling: 404 for missing campaign
- [ ] Error handling: 400 for validation errors
- [ ] Error handling: 403 for ownership violation

---

## Performance Benchmarks

Expected response times on modern hardware:

| Operation | Time |
|-----------|------|
| Create campaign (25 prospects) | 2-4s |
| Create campaign (100 prospects) | 4-8s |
| Retrieve campaign | < 100ms |
| Approve single message | < 50ms |
| Approve all messages | < 100ms |
| Send campaign (all approved) | 2-5s |

---

## Support

For questions about testing:
1. Check the API documentation in `/docs/WELLS_ONYX_CAMPAIGN_API.md`
2. Review the test files in `__tests__/route.test.ts`
3. Check server logs for `[WELLS ONYX GTM]` messages
4. Verify environment variables are set correctly
