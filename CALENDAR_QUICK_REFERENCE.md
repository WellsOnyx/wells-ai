# Calendar Integration - Quick Reference

## 🚀 30-Second Setup

```bash
# 1. Generate keys
node scripts/setup-calendar.js

# 2. Add to .env.local
CALCOM_API_KEY=cal_live_...
CALENDAR_ENCRYPTION_KEY=...

# 3. Run migration
psql $DATABASE_URL < prisma/migrations/add_calendar_tables.sql

# 4. Restart
npm run dev
```

## 📁 Files Created

### Core Integration
- `lib/integrations/calendar.ts` - Main calendar service
- `types/calendar.ts` - TypeScript types

### API Endpoints
- `app/api/calendar/connect/route.ts`
- `app/api/calendar/status/route.ts`
- `app/api/calendar/disconnect/route.ts`
- `app/api/calendar/schedule/route.ts`
- `app/api/calendar/bookings/route.ts`
- `app/api/calendar/availability/route.ts`

### Database
- `prisma/migrations/add_calendar_tables.sql`

### UI
- `app/settings/calendar/page.tsx`

### Tools
- `lib/tools/index.ts` (updated executeScheduleMeeting)
- `scripts/setup-calendar.js`

### Documentation
- `docs/CALENDAR_INTEGRATION.md`
- `docs/CALENDAR_TESTING.md`
- `CALENDAR_IMPLEMENTATION_SUMMARY.md`

## 🔑 Environment Variables

```bash
# Required
CALCOM_API_KEY=cal_live_...
CALENDAR_ENCRYPTION_KEY=64_char_hex

# Optional
CALCOM_API_URL=https://api.cal.com/v1
CALCOM_EVENT_TYPE_ID=123456
```

## 🧪 Test Commands

```bash
# Connect
curl -X POST localhost:3000/api/calendar/connect \
  -d '{"apiKey":"cal_live_..."}'

# Status
curl localhost:3000/api/calendar/status

# Schedule
curl -X POST localhost:3000/api/calendar/schedule \
  -d '{"title":"Test","startTime":"2025-01-20T14:00:00Z","attendees":[{"email":"test@example.com"}]}'

# Bookings
curl localhost:3000/api/calendar/bookings

# Disconnect
curl -X DELETE localhost:3000/api/calendar/disconnect
```

## 💬 AI Usage

```
User: "Schedule a meeting with john@example.com tomorrow at 2pm about Q1 planning"

Wells AI: Creates meeting, sends invites, returns video link
```

## 🗄️ Database Tables

- `calendar_connections` - Encrypted API keys
- `calendar_bookings` - Scheduled meetings
- `calendar_availability` - User preferences

## ✅ Features

- ✅ Real calendar bookings (Cal.com)
- ✅ Video conferencing (built-in)
- ✅ Email invitations
- ✅ Multi-participant meetings
- ✅ Timezone support
- ✅ Encrypted token storage
- ✅ Rate limiting (100/min)
- ✅ Settings UI

## ❌ Not Yet Implemented

- Google Calendar integration
- Recurring meetings UI
- Smart time suggestions
- Meeting templates
- Bi-directional sync

## 🔒 Security

- AES-256-GCM encryption for API keys
- Clerk authentication required
- User isolation (can only access own calendar)
- Rate limiting (100 requests/min/user)

## 📊 Rate Limits

**Cal.com:**
- Free: 100/hour
- Pro: 1,000/hour ($12/month)

**Wells AI:**
- 100 operations/minute/user

## 🐛 Troubleshooting

**"Calendar not connected"**
→ User must connect at /settings/calendar

**"Invalid API key"**
→ Get new key: https://app.cal.com/settings/developer/api-keys

**"Rate limit exceeded"**
→ Wait 60 seconds, check for infinite loops

**Encryption errors**
→ Verify CALENDAR_ENCRYPTION_KEY is 64 chars hex

## 📚 Documentation

- **Setup:** `docs/CALENDAR_INTEGRATION.md`
- **Testing:** `docs/CALENDAR_TESTING.md`
- **Summary:** `CALENDAR_IMPLEMENTATION_SUMMARY.md`

## 🎯 Next Steps

1. Run `./scripts/setup-calendar.js`
2. Set environment variables
3. Run database migration
4. Test at `/settings/calendar`
5. Deploy to production

## 💰 Cost

**Cal.com:**
- Free: $0/month (sufficient for most users)
- Pro: $12/month (for high-volume users)

**Recommendation:** Start with free tier, upgrade as needed.

## 🚀 Production Deploy

```bash
# Set production env vars
vercel env add CALCOM_API_KEY production
vercel env add CALENDAR_ENCRYPTION_KEY production

# Run migration
psql $PROD_DB < prisma/migrations/add_calendar_tables.sql

# Deploy
vercel --prod
```

## 📞 Support

- Cal.com Docs: https://cal.com/docs/api-reference
- Cal.com Status: https://status.cal.com
- Get API Key: https://app.cal.com/settings/developer/api-keys
