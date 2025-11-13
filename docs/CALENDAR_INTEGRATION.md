# Calendar Integration Guide

Wells AI now supports real calendar scheduling through Cal.com integration. Users can schedule meetings directly through the AI assistant.

## Features

- **Real calendar bookings** via Cal.com API
- **Video conferencing** included automatically (Cal.com provides meeting URLs)
- **Multi-participant meetings** with email invitations
- **Secure token storage** with AES-256-GCM encryption
- **Rate limiting** to prevent API abuse
- **Timezone support** for global scheduling
- **Availability checking** to prevent double-booking
- **Meeting management** (cancel, reschedule, view upcoming)

## Setup

### 1. Get Cal.com API Key

1. Sign up for Cal.com: https://app.cal.com
2. Go to Settings > Developer > API Keys: https://app.cal.com/settings/developer/api-keys
3. Create a new API key
4. Copy the key (starts with `cal_live_...`)

### 2. Configure Environment Variables

Add to your `.env` or `.env.local`:

```bash
# Cal.com API Configuration
CALCOM_API_KEY=cal_live_your_api_key_here
CALCOM_API_URL=https://api.cal.com/v1
CALCOM_EVENT_TYPE_ID=123456  # Your event type ID

# Calendar Encryption Key (generate with command below)
CALENDAR_ENCRYPTION_KEY=your_64_char_hex_string_here
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run Database Migration

Run the SQL migration to create calendar tables:

```bash
psql $DATABASE_URL < prisma/migrations/add_calendar_tables.sql
```

Or manually execute the SQL in your database console.

### 4. Connect User Calendar

Users can connect their calendar in two ways:

#### Option A: Via API (programmatic)
```bash
curl -X POST https://your-app.com/api/calendar/connect \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "cal_live_...",
    "provider": "calcom"
  }'
```

#### Option B: Via Settings UI (recommended)
Create a settings page where users can input their Cal.com API key securely.

## Usage

### Schedule a Meeting via AI

Users can simply ask Wells AI:

> "Schedule a meeting with john@example.com tomorrow at 2pm for 30 minutes about Q1 planning"

Wells AI will:
1. Check if calendar is connected
2. Parse the meeting details
3. Create the booking via Cal.com API
4. Send calendar invites to all participants
5. Generate a video conference URL
6. Return the meeting details

### API Endpoints

#### Check Connection Status
```bash
GET /api/calendar/status
```

Response:
```json
{
  "connected": true,
  "provider": "calcom",
  "calendarEmail": "user@example.com",
  "lastSyncAt": "2025-01-15T10:30:00Z"
}
```

#### Schedule Meeting
```bash
POST /api/calendar/schedule
Content-Type: application/json

{
  "title": "Q1 Planning Meeting",
  "description": "Discuss Q1 goals and objectives",
  "startTime": "2025-01-20T14:00:00Z",
  "durationMinutes": 30,
  "attendees": [
    { "email": "john@example.com", "name": "John Doe" },
    { "email": "jane@example.com", "name": "Jane Smith" }
  ],
  "timezone": "America/Los_Angeles"
}
```

Response:
```json
{
  "success": true,
  "booking": {
    "id": "booking_123",
    "uid": "cal_uid_456",
    "title": "Q1 Planning Meeting",
    "startTime": "2025-01-20T14:00:00Z",
    "endTime": "2025-01-20T14:30:00Z",
    "meetingUrl": "https://meet.cal.com/xyz123",
    "attendees": [...],
    "status": "pending"
  }
}
```

#### Get Upcoming Bookings
```bash
GET /api/calendar/bookings
```

#### Check Availability
```bash
GET /api/calendar/availability?startDate=2025-01-20&endDate=2025-01-27
```

#### Disconnect Calendar
```bash
DELETE /api/calendar/disconnect?provider=calcom
```

## Architecture

### File Structure

```
lib/integrations/
  └── calendar.ts              # Calendar service & Cal.com client

app/api/calendar/
  ├── connect/route.ts          # POST - Connect calendar
  ├── status/route.ts           # GET - Check connection
  ├── disconnect/route.ts       # DELETE - Disconnect
  ├── schedule/route.ts         # POST - Schedule meeting
  ├── bookings/route.ts         # GET - List bookings
  └── availability/route.ts     # GET - Check availability

prisma/migrations/
  └── add_calendar_tables.sql   # Database schema

lib/tools/
  └── index.ts                  # Updated executeScheduleMeeting()
```

### Database Tables

**calendar_connections** - Stores encrypted API credentials
- `user_id` - Clerk user ID
- `provider` - 'calcom', 'google', 'outlook'
- `api_key_encrypted` - AES-256-GCM encrypted API key
- `api_key_iv` - Initialization vector
- `api_key_auth_tag` - Authentication tag
- `connected` - Boolean status
- `calendar_email` - User's calendar email

**calendar_bookings** - Tracks all scheduled meetings
- `id` - Booking ID
- `user_id` - Owner
- `booking_uid` - Cal.com UID
- `title`, `description` - Meeting details
- `start_time`, `end_time` - Schedule
- `attendees` - JSON array of participants
- `meeting_url` - Video call URL
- `status` - pending/accepted/cancelled

**calendar_availability** - User availability preferences (future)
- `user_id` - Owner
- `working_hours` - JSON object with daily schedules
- `timezone` - User's timezone
- `buffer_before_minutes` - Buffer before meetings
- `buffer_after_minutes` - Buffer after meetings

### Security

**Token Encryption**
- All API keys and OAuth tokens are encrypted using AES-256-GCM
- Encryption key stored in environment variable (never committed)
- Each encrypted value has unique IV and auth tag
- Tokens are decrypted only when needed for API calls

**Rate Limiting**
- 100 requests per minute per user
- Prevents API abuse and cost overruns
- Sliding window algorithm

**Access Control**
- All endpoints require Clerk authentication
- Users can only access their own calendar data
- Database queries filter by `user_id`

## Rate Limits

### Cal.com API Limits
- Free: 100 requests/hour
- Pro: 1,000 requests/hour
- Enterprise: Custom limits

### Wells AI Limits
- 100 calendar operations per minute per user
- Prevents accidental API spam from AI loops

## Future Enhancements

### Phase 2: Google Calendar Support
- OAuth 2.0 flow for Google sign-in
- Bi-directional sync (read existing events)
- Support for recurring meetings
- Calendar conflict detection

### Phase 3: Smart Scheduling
- AI-powered meeting time suggestions
- Analyze participant availability
- Optimize for timezone differences
- Buffer time between meetings

### Phase 4: Advanced Features
- Meeting templates
- Automatic follow-up scheduling
- Integration with project management tools
- Meeting transcription and summaries

## Troubleshooting

### "Calendar not connected" error
- User needs to connect their Cal.com account first
- Check that `CALCOM_API_KEY` is set in environment
- Verify API key is valid at Cal.com dashboard

### "Failed to schedule meeting" error
- Check Cal.com API status: https://status.cal.com
- Verify `CALCOM_EVENT_TYPE_ID` is correct
- Ensure start time is in future
- Check that attendee emails are valid

### "Rate limit exceeded" error
- User has made too many requests (100/min limit)
- Wait 60 seconds and try again
- Check for infinite loops in AI tool calling

### Encryption errors
- Verify `CALENDAR_ENCRYPTION_KEY` is set
- Key must be 64-character hex string (32 bytes)
- Don't change key after storing encrypted data

## Cost Estimates

### Cal.com Pricing
- **Free**: $0/month - 100 requests/hour, basic features
- **Pro**: $12/month - 1,000 requests/hour, custom branding
- **Enterprise**: Custom pricing - unlimited requests

### Alternative: Google Calendar
- **Free** for all users
- Requires OAuth setup (more complex)
- No built-in video conferencing (need Zoom/Meet integration)

**Recommendation**: Start with Cal.com for simplicity. Add Google Calendar later for users who prefer it.

## Support

For issues or questions:
- Cal.com docs: https://docs.cal.com
- Cal.com API reference: https://cal.com/docs/api-reference
- Wells AI support: [your support email]
