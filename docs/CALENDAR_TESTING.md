# Calendar Integration Testing Guide

Quick guide to test the Wells AI calendar integration.

## Prerequisites

1. Cal.com account created
2. Cal.com API key obtained
3. Database migration run
4. Environment variables configured

## Setup Steps

### 1. Generate Encryption Key

```bash
node scripts/setup-calendar.js
```

This will:
- Generate a secure encryption key
- Validate your Cal.com API key (if set)
- Provide setup instructions

### 2. Add Environment Variables

```bash
# Add to .env.local
CALCOM_API_KEY=cal_live_your_key_here
CALCOM_EVENT_TYPE_ID=123456
CALENDAR_ENCRYPTION_KEY=your_generated_key_here
```

### 3. Run Database Migration

```bash
psql $DATABASE_URL < prisma/migrations/add_calendar_tables.sql
```

### 4. Restart Server

```bash
npm run dev
```

## Testing Scenarios

### Scenario 1: Connect Calendar

**Via UI (Recommended)**
1. Navigate to `/settings/calendar`
2. Enter your Cal.com API key
3. Click "Connect Calendar"
4. Verify success message shows

**Via API**
```bash
curl -X POST http://localhost:3000/api/calendar/connect \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "cal_live_...",
    "provider": "calcom"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "connection": {
    "provider": "calcom",
    "connected": true,
    "calendarEmail": "user@example.com"
  }
}
```

### Scenario 2: Check Connection Status

```bash
curl http://localhost:3000/api/calendar/status
```

**Expected Response:**
```json
{
  "connected": true,
  "provider": "calcom",
  "calendarEmail": "user@example.com",
  "lastSyncAt": "2025-01-15T10:30:00Z"
}
```

### Scenario 3: Schedule Meeting via API

```bash
curl -X POST http://localhost:3000/api/calendar/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Meeting",
    "description": "Testing calendar integration",
    "startTime": "2025-01-20T14:00:00Z",
    "durationMinutes": 30,
    "attendees": [
      { "email": "test@example.com", "name": "Test User" }
    ],
    "timezone": "America/Los_Angeles"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "booking": {
    "id": "booking_123",
    "uid": "cal_uid_456",
    "title": "Test Meeting",
    "startTime": "2025-01-20T14:00:00Z",
    "endTime": "2025-01-20T14:30:00Z",
    "meetingUrl": "https://meet.cal.com/xyz123",
    "attendees": [...],
    "status": "pending"
  }
}
```

### Scenario 4: Schedule via AI Chat

Start a chat with Wells AI and say:

```
"Schedule a meeting with john@example.com tomorrow at 2pm about Q1 planning"
```

**Expected AI Response:**
```
Meeting scheduled successfully! Calendar invite sent to john@example.com

Meeting Details:
- Title: Q1 Planning Meeting
- Time: Tomorrow at 2:00 PM PST
- Duration: 30 minutes
- Video Call: https://meet.cal.com/xyz123
- Attendees: john@example.com

I've sent calendar invites to all participants. They'll receive an email with meeting details and the video call link.
```

### Scenario 5: Get Upcoming Bookings

```bash
curl http://localhost:3000/api/calendar/bookings
```

**Expected Response:**
```json
{
  "success": true,
  "bookings": [
    {
      "id": "booking_123",
      "title": "Q1 Planning Meeting",
      "startTime": "2025-01-20T14:00:00Z",
      "endTime": "2025-01-20T14:30:00Z",
      "meetingUrl": "https://meet.cal.com/xyz123",
      "status": "pending"
    }
  ]
}
```

### Scenario 6: Check Availability

```bash
curl "http://localhost:3000/api/calendar/availability?startDate=2025-01-20&endDate=2025-01-27"
```

**Expected Response:**
```json
{
  "success": true,
  "slots": [
    { "start": "2025-01-20T09:00:00Z", "end": "2025-01-20T09:30:00Z" },
    { "start": "2025-01-20T09:30:00Z", "end": "2025-01-20T10:00:00Z" },
    ...
  ]
}
```

### Scenario 7: Disconnect Calendar

```bash
curl -X DELETE "http://localhost:3000/api/calendar/disconnect?provider=calcom"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Calendar disconnected successfully"
}
```

## Error Cases to Test

### 1. Missing Calendar Connection

**Test:** Try to schedule without connecting calendar

```bash
curl -X POST http://localhost:3000/api/calendar/schedule \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","startTime":"2025-01-20T14:00:00Z","attendees":[{"email":"test@example.com"}]}'
```

**Expected:**
```json
{
  "error": "Calendar not connected"
}
```

### 2. Invalid API Key

**Test:** Connect with invalid API key

```bash
curl -X POST http://localhost:3000/api/calendar/connect \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"invalid_key"}'
```

**Expected:**
```json
{
  "error": "Invalid Cal.com API key"
}
```

### 3. Rate Limit

**Test:** Make 101 requests in quick succession

**Expected:**
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

### 4. Invalid Time

**Test:** Schedule meeting in the past

```bash
curl -X POST http://localhost:3000/api/calendar/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "startTime": "2020-01-01T14:00:00Z",
    "attendees": [{"email": "test@example.com"}]
  }'
```

**Expected:** Error from Cal.com API

### 5. Missing Required Fields

**Test:** Omit required fields

```bash
curl -X POST http://localhost:3000/api/calendar/schedule \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'
```

**Expected:**
```json
{
  "error": "Missing required fields: title, startTime, attendees"
}
```

## Database Verification

### Check Connections Table

```sql
SELECT * FROM calendar_connections WHERE user_id = 'your_clerk_user_id';
```

Should show:
- `connected = true`
- `api_key_encrypted` (encrypted string)
- `calendar_email` (your Cal.com email)

### Check Bookings Table

```sql
SELECT * FROM calendar_bookings WHERE user_id = 'your_clerk_user_id';
```

Should show all scheduled meetings.

## Security Testing

### 1. API Key Encryption

```sql
-- Verify API keys are encrypted (not plain text)
SELECT api_key_encrypted, api_key_iv, api_key_auth_tag
FROM calendar_connections
LIMIT 1;
```

All three fields should contain gibberish (encrypted data).

### 2. User Isolation

```sql
-- Try to access another user's calendar
-- Should return empty or error
SELECT * FROM calendar_connections WHERE user_id = 'different_user_id';
```

### 3. Rate Limiting

Make 101 rapid requests - should get rate limited on request 101.

## Performance Testing

### 1. Connection Latency

Time the connection flow:
```bash
time curl -X POST http://localhost:3000/api/calendar/connect \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"cal_live_..."}'
```

Should complete in < 2 seconds.

### 2. Booking Creation

Time booking creation:
```bash
time curl -X POST http://localhost:3000/api/calendar/schedule \
  -H "Content-Type: application/json" \
  -d '{...}'
```

Should complete in < 3 seconds.

## Troubleshooting

### "Calendar not connected" despite connecting

**Solution:**
1. Check `calendar_connections` table in database
2. Verify `connected = true`
3. Check Clerk `userId` matches
4. Restart server to clear any caches

### "Invalid API key" error

**Solution:**
1. Verify API key starts with `cal_live_`
2. Check Cal.com dashboard: https://app.cal.com/settings/developer/api-keys
3. Ensure API key has correct permissions
4. Try regenerating the API key

### Meetings not showing in Cal.com

**Solution:**
1. Check `CALCOM_EVENT_TYPE_ID` is correct
2. Verify event type exists in Cal.com
3. Check Cal.com dashboard for errors
4. Ensure timezone is correct

### Database errors

**Solution:**
1. Verify migration ran successfully
2. Check all three tables exist:
   - `calendar_connections`
   - `calendar_bookings`
   - `calendar_availability`
3. Check user has permissions on tables

### Encryption errors

**Solution:**
1. Verify `CALENDAR_ENCRYPTION_KEY` is set
2. Key must be 64-character hex string
3. Don't change key after storing data
4. Regenerate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Success Criteria

All tests should pass:
- ✅ Connect calendar successfully
- ✅ Schedule meeting via API
- ✅ Schedule meeting via AI chat
- ✅ Get upcoming bookings
- ✅ Check availability
- ✅ Disconnect calendar
- ✅ Rate limiting works
- ✅ API keys are encrypted
- ✅ User isolation enforced
- ✅ Cal.com receives bookings

## Next Steps After Testing

1. **Production deployment**
   - Set production `CALCOM_API_KEY`
   - Generate new `CALENDAR_ENCRYPTION_KEY` (don't reuse dev key)
   - Run migration on production database

2. **User onboarding**
   - Add link to `/settings/calendar` in main navigation
   - Show calendar connection prompt in chat when scheduling
   - Add tooltip/help text

3. **Monitoring**
   - Track booking success rates
   - Monitor Cal.com API errors
   - Alert on rate limit hits
   - Log encryption/decryption errors

4. **Enhancements**
   - Add Google Calendar support
   - Implement recurring meetings
   - Smart time suggestions
   - Meeting templates
