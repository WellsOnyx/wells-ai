# Seller Notification System - Migration Guide

This guide walks you through deploying the new seller notification system to production.

## Step 1: Database Migration

Run Prisma migration to add notification tables:

```bash
# Generate Prisma client with new models
npx prisma generate

# Push schema changes to database
npx prisma db push

# OR create a migration (recommended for production)
npx prisma migrate dev --name add_seller_notifications
```

This adds:
- `SellerNotification` table
- `SellerNotificationPreference` table
- `NotificationStatus` enum
- `NotificationType` enum

## Step 2: Environment Variables

Add to your production environment:

```bash
# Already configured (verify in Vercel/Railway)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Add new variables
CRON_SECRET=generate-random-secret-here
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

Generate CRON_SECRET:
```bash
openssl rand -base64 32
```

## Step 3: Deploy Code

All files are ready to deploy:

### New Files
- `lib/rfq-matching.ts` - Matching algorithm
- `lib/seller-notifications.ts` - Notification system
- `app/api/sellers/notify/route.ts` - Manual trigger endpoint
- `app/api/sellers/notifications/route.ts` - History endpoint
- `app/api/cron/daily-digest/route.ts` - Daily digest job
- `app/api/cron/weekly-digest/route.ts` - Weekly digest job

### Modified Files
- `app/api/rfqs/route.ts` - Auto-notification on POST
- `prisma/schema.prisma` - New tables
- `vercel.json` - Cron job configuration

Deploy to Vercel/Railway:
```bash
git add .
git commit -m "Add seller notification system"
git push origin main
```

## Step 4: Verify Cron Jobs

### Vercel

Cron jobs are automatically configured via `vercel.json`.

Verify in Vercel Dashboard:
1. Go to your project
2. Click "Cron Jobs" tab
3. Verify two jobs exist:
   - Daily Digest: `0 8 * * *` (8am daily)
   - Weekly Digest: `0 8 * * 1` (8am Monday)

### Other Platforms

If not using Vercel, set up cron jobs manually:

**Railway:**
```bash
# Add to railway.json
{
  "cron": [
    {
      "command": "curl -H 'Authorization: Bearer $CRON_SECRET' https://yourapp.com/api/cron/daily-digest",
      "schedule": "0 8 * * *"
    },
    {
      "command": "curl -H 'Authorization: Bearer $CRON_SECRET' https://yourapp.com/api/cron/weekly-digest",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

**GitHub Actions:**
```yaml
# .github/workflows/cron-daily-digest.yml
name: Daily Digest
on:
  schedule:
    - cron: '0 8 * * *'
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Daily Digest
        run: |
          curl -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://yourapp.com/api/cron/daily-digest
```

## Step 5: Test Notification System

### Test 1: Manual Notification Trigger

```bash
# Test mode (no actual sending)
curl -X POST https://yourapp.com/api/sellers/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "rfqId": "test_rfq_123",
    "testMode": true,
    "minMatchScore": 30
  }'
```

Expected response:
```json
{
  "success": true,
  "matchResult": {
    "totalMatches": 5,
    "highQualityMatches": 3,
    "notified": 3
  },
  "notifications": {
    "total": 3,
    "successful": 3,
    "failed": 0
  },
  "testMode": true
}
```

### Test 2: Create RFQ with Auto-Notification

```bash
curl -X POST https://yourapp.com/api/rfqs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "category": "Electronics",
    "title": "Test RFQ",
    "description": "Testing notification system",
    "requirements": "STM32 microcontrollers",
    "autoNotify": true,
    "minMatchScore": 50
  }'
```

### Test 3: Check Notification History

```bash
curl https://yourapp.com/api/sellers/notifications?stats=true \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Test 4: Verify SMS Delivery

Check Twilio dashboard:
1. Go to https://console.twilio.com
2. Click "Messaging" → "Logs"
3. Verify messages were sent
4. Check delivery status

## Step 6: Monitor Initial Performance

### Week 1 Checklist

- [ ] Monitor Vercel/Railway logs for errors
- [ ] Check Twilio SMS delivery rates
- [ ] Verify cron jobs are running (check logs daily at 8am)
- [ ] Review notification stats for first sellers
- [ ] Test opt-out mechanism (reply STOP to SMS)
- [ ] Monitor database performance (notification table growth)

### Key Metrics to Track

```bash
# Get notification stats
curl https://yourapp.com/api/sellers/notifications?stats=true
```

Track:
- **Open Rate**: Should be >50%
- **Click Rate**: Should be >30%
- **Response Rate**: Track quotes submitted after notification
- **Opt-Out Rate**: Should be <5%

## Step 7: Gradual Rollout (Optional)

If you want to test with a subset of sellers first:

### Phase 1: Test with 5-10 sellers (Week 1)
```typescript
// In app/api/rfqs/route.ts
const minMatchScore = 80 // Only notify excellent matches
```

### Phase 2: Expand to verified sellers (Week 2)
```typescript
const matchResult = await matchRFQWithSellers(rfq, {
  includeUnverified: false // Only verified sellers
})
```

### Phase 3: Full rollout (Week 3+)
```typescript
// Use default settings
const matchResult = await matchRFQWithSellers(rfq, {
  minMatchScore: 50,
  includeUnverified: true
})
```

## Rollback Plan

If you need to rollback:

### Option 1: Disable Auto-Notifications
```typescript
// In app/api/rfqs/route.ts
const autoNotify = false // Temporarily disable
```

### Option 2: Increase Match Score Threshold
```typescript
// Only notify top matches
const minMatchScore = 90
```

### Option 3: Full Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Database rollback (if needed)
npx prisma migrate rollback
```

## Troubleshooting

### Notifications not sending

**Check logs:**
```bash
vercel logs --follow
# or
railway logs --tail
```

**Common issues:**
- Missing Twilio credentials
- Invalid phone numbers
- Rate limiting (Twilio)
- Database connection errors

### Cron jobs not running

**Verify configuration:**
```bash
# Vercel: Check dashboard
# Railway: Check railway.json
# GitHub Actions: Check workflow logs
```

**Test manually:**
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://yourapp.com/api/cron/daily-digest
```

### High opt-out rate

**Actions:**
- Review SMS message content (too frequent?)
- Check match quality (false positives?)
- Verify notification preferences are respected
- Add quiet hours support

## Post-Migration Enhancements

### Week 2: Email Integration
Integrate SendGrid/Resend for email notifications:
```typescript
// lib/seller-notifications.ts
// Replace console.log with actual email sending
```

### Week 3: Analytics Dashboard
Build seller dashboard showing:
- Notification history
- Match quality over time
- Quote conversion rates
- Earnings from notifications

### Week 4: Smart Scheduling
Add intelligent timing:
- Respect seller timezones
- Learn best notification times
- Avoid quiet hours

## Support

If you encounter issues:

1. **Check logs first**: Most issues show up in logs
2. **Test mode**: Use `testMode: true` to debug without sending
3. **Twilio dashboard**: Verify SMS delivery
4. **Database**: Check notification records are being created

## Success Criteria

After 2 weeks, you should see:
- ✅ 50+ notifications sent
- ✅ 60%+ open rate
- ✅ 40%+ click rate
- ✅ <5% opt-out rate
- ✅ Sellers submitting quotes from notifications
- ✅ Zero failed notifications (or <1%)

## Next Steps

Once stable:
1. Expand to more seller categories
2. Add push notifications (mobile app)
3. Build analytics dashboard
4. Implement A/B testing for message formats
5. Add ML-based match scoring
