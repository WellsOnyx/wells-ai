# Supplier Onboarding Email Automation - Priority 2 Complete

## Overview

Automated 4-email sequence sends to suppliers based on signup date:
- **Day 1**: Welcome email with next steps
- **Day 3**: Reminder to upload products
- **Day 7**: Reminder to complete profile
- **Day 14**: "You're almost live" final push

## Files

### Email Templates
**`lib/supplier-onboarding-emails.ts`**
- 4 professional HTML email templates
- Personalized with supplier name
- Clear CTAs pointing to `/suppliers/dashboard`
- Conversion-optimized copy

### Cron Job
**`app/api/cron/supplier-onboarding-emails/route.ts`**
- Runs daily (configured in `vercel.json`)
- Finds suppliers who signed up 1, 3, 7, or 14 days ago
- Sends appropriate email via Resend
- Logs success/failure for each email
- Protected by cron secret for security

## Setup

### 1. Environment Variables
Add to Vercel project settings:
```bash
RESEND_API_KEY=re_xxxxx  # Already configured
CRON_SECRET=your_random_secret_string
```

Generate cron secret:
```bash
openssl rand -base64 32
```

### 2. Vercel Cron Configuration
Already added to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/supplier-onboarding-emails",
    "schedule": "0 9 * * *"
  }]
}
```

Runs daily at 9:00 AM UTC.

### 3. Deploy
```bash
git add -A
git commit -m "Add automated supplier onboarding email sequence"
npx vercel deploy --prod
```

## How It Works

1. **Supplier Signs Up** (`/suppliers/join`)
   - Account created with `created_at` timestamp
   - Stored in `suppliers` table

2. **Cron Job Runs Daily**
   - Finds suppliers created 1, 3, 7, or 14 days ago
   - Sends corresponding email via Resend
   - Logs results

3. **Emails Sent Automatically**
   - Day 1: Welcome + setup guide
   - Day 3: Product upload reminder
   - Day 7: Profile completion reminder
   - Day 14: "Almost live" final push

## Testing

### Manual Trigger (Development)
```bash
curl -X GET http://localhost:3000/api/cron/supplier-onboarding-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Check Sent Emails
Visit [Resend Dashboard](https://resend.com/emails) to see sent emails.

### Test with Real Signup
1. Sign up a test supplier at `/suppliers/join`
2. Modify `created_at` timestamp in database:
```sql
UPDATE suppliers
SET created_at = NOW() - INTERVAL '3 days'
WHERE email = 'test@example.com';
```
3. Manually trigger cron or wait for scheduled run

## Monitoring

### View Cron Logs
```bash
vercel logs --prod | grep supplier-onboarding-emails
```

### Success Metrics
- Check Resend dashboard for delivery rates
- Monitor cron job execution in Vercel dashboard
- Track supplier activation rates

## Email Content

### Day 1: Welcome Email
- Subject: "Welcome to Wells AI - Next Steps"
- Content: Overview of platform, 3-step setup guide
- CTA: "Complete Your Profile"

### Day 3: Product Upload Reminder
- Subject: "Action Needed: Add Your First Products"
- Content: Importance of product catalog
- Stats: "Suppliers with products get 5x more RFQs"
- CTA: "Add Products Now"

### Day 7: Profile Completion
- Subject: "Complete Your Wells AI Profile (10 Minutes)"
- Content: Missing information checklist
- Benefits: Higher search ranking, auto-matching
- CTA: "Complete Profile (10 min)"

### Day 14: Final Push
- Subject: "You're Almost Live on Wells AI!"
- Content: Final checklist, what they're missing
- Urgency: "127 RFQs matched last week in your categories"
- CTA: "Finish Setup & Go Live"

## Next Steps (Priority 3)

Build supplier dashboard to actually support these CTAs:
- Progress bar (0-100% complete)
- Guided setup wizard
- Product upload interface
- Profile completion checklist

## Notes

- All emails use `from: "Wells AI Suppliers <suppliers@wellsai.com>"`
- Unsubscribe link included in Day 14 email footer
- Email styling uses Wells AI brand colors (amber/orange gradient)
- Responsive HTML works on mobile and desktop
- Non-blocking: Email failures don't break the cron job

## Production Checklist

- ✅ Email templates created
- ✅ Cron job endpoint built
- ✅ Resend integration configured
- ✅ Vercel cron schedule added
- ⏳ Test with real supplier signup
- ⏳ Monitor first week of emails
- ⏳ Track conversion rates (signup → active)
