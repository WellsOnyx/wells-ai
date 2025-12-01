# CRON_SECRET Setup Instructions

## Generated CRON_SECRET

```
ldMuNK3V2tZpGQpG57Rv7IgtEJMl66WJz6L9qzl0Tmg=
```

## Setup Steps

### 1. Add to Vercel Environment Variables

Go to Vercel Dashboard:
1. Visit https://vercel.com/wellsonyxs-projects/wellsai/settings/environment-variables
2. Add new environment variable:
   - **Name**: `CRON_SECRET`
   - **Value**: `ldMuNK3V2tZpGQpG57Rv7IgtEJMl66WJz6L9qzl0Tmg=`
   - **Environment**: Production, Preview, Development (all three)
3. Click "Save"
4. Redeploy if needed

### 2. Verify Cron Job is Configured

The cron job is already configured in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/supplier-onboarding-emails",
    "schedule": "0 9 * * *"
  }]
}
```

This runs daily at 9:00 AM UTC.

### 3. Test the Endpoint Manually

Once deployed, test with curl:

```bash
curl -X GET https://wellsai.vercel.app/api/cron/supplier-onboarding-emails \
  -H "Authorization: Bearer ldMuNK3V2tZpGQpG57Rv7IgtEJMl66WJz6L9qzl0Tmg="
```

Expected response:
```json
{
  "success": true,
  "timestamp": "2025-XX-XXTXX:XX:XX.XXXZ",
  "totalEmails": 0,
  "successCount": 0,
  "failCount": 0,
  "results": [],
  "latency_ms": XXX
}
```

### 4. Monitor Cron Execution

View cron logs in Vercel:
```bash
vercel logs --prod | grep supplier-onboarding-emails
```

Or check Vercel Dashboard → Deployments → Logs

### 5. Check Email Delivery

Visit Resend Dashboard:
- https://resend.com/emails
- Check for emails sent from `Wells AI Suppliers <suppliers@wellsai.com>`
- Verify delivery status

## Security Note

Keep this secret secure. Never commit it to git or share it publicly. It's used to authenticate cron job requests.
