# Email Delivery Infrastructure - Deployment Checklist

## Pre-Deployment Setup

### 1. Google Cloud Console Setup (15 minutes)

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Create new project "Wells AI"
- [ ] Enable Gmail API
  - [ ] Go to "APIs & Services" > "Library"
  - [ ] Search "Gmail API"
  - [ ] Click "Enable"
- [ ] Configure OAuth consent screen
  - [ ] User Type: External
  - [ ] App name: "Wells AI"
  - [ ] Support email: jonah@wellsonyx.com
  - [ ] Add scopes: gmail.send, gmail.compose
- [ ] Create OAuth credentials
  - [ ] "APIs & Services" > "Credentials"
  - [ ] "Create Credentials" > "OAuth client ID"
  - [ ] Application type: Web application
  - [ ] Name: "Wells AI Gmail Integration"
  - [ ] Authorized redirect URIs:
    - [ ] `http://localhost:3000/api/auth/gmail/callback` (dev)
    - [ ] `https://wellsai.vercel.app/api/auth/gmail/callback` (prod)
- [ ] Copy Client ID and Client Secret

### 2. Instantly Setup (5 minutes)

- [ ] Log in to [Instantly.ai](https://instantly.ai)
- [ ] Go to Settings > API
- [ ] Generate new API key
- [ ] Copy API key
- [ ] Verify credits are available

### 3. Environment Variables

#### Development (.env)

- [ ] Add to `.env`:
```bash
# Gmail OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Instantly
INSTANTLY_API_KEY=your_instantly_api_key_here

# Encryption
ENCRYPTION_MASTER_SECRET=$(openssl rand -hex 32)
```

#### Production (Vercel)

- [ ] Add to Vercel environment variables:
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `GOOGLE_REDIRECT_URI=https://wellsai.vercel.app/api/auth/gmail/callback`
  - [ ] `INSTANTLY_API_KEY`
  - [ ] `ENCRYPTION_MASTER_SECRET` (generate new for prod)

### 4. Install Dependencies

- [ ] Run `npm install`
- [ ] Verify `googleapis@^144.0.0` installed
- [ ] Run `npx prisma generate` if needed

## Testing (Development)

### 5. Local Testing

- [ ] Start dev server: `npm run dev`
- [ ] Visit http://localhost:3000/settings/email
- [ ] Test Gmail OAuth:
  - [ ] Click "Connect Gmail"
  - [ ] Authorize app
  - [ ] Verify redirect back with success message
  - [ ] Check email appears in settings
- [ ] Test email sending:
  - [ ] Enter test email address
  - [ ] Click "Send Test Email"
  - [ ] Verify email received
- [ ] Run test suite:
```bash
export TEST_USER_ID=your_clerk_user_id
export TEST_EMAIL=your-email@example.com
npm run test:email
```
- [ ] Verify all 6 tests pass

### 6. API Testing

Test each endpoint:

- [ ] **Gmail OAuth**:
```bash
# Visit in browser (will redirect)
http://localhost:3000/api/auth/gmail/authorize
```

- [ ] **Smart Email Send**:
```bash
curl -X POST http://localhost:3000/api/gtm/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test",
    "text": "Test message",
    "importance": "critical"
  }'
```

- [ ] **Create Instantly Campaign**:
```bash
curl -X POST http://localhost:3000/api/instantly/campaign/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "template": "exec-search"
  }'
```

- [ ] **Add Prospects**:
```bash
curl -X POST http://localhost:3000/api/instantly/campaign/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "prospects": [{
      "email": "prospect@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }]
  }'
```

## Production Deployment

### 7. Pre-Deploy Verification

- [ ] All environment variables added to Vercel
- [ ] Google OAuth redirect URI updated to production URL
- [ ] Instantly API key is production key (not test)
- [ ] Database migrations applied (if needed)
- [ ] All tests passing locally

### 8. Deploy to Vercel

- [ ] Run `vercel --prod`
- [ ] Wait for deployment to complete
- [ ] Note deployment URL

### 9. Production Testing

- [ ] Visit https://wellsai.vercel.app/settings/email
- [ ] Test Gmail OAuth flow in production
- [ ] Send test email from production
- [ ] Verify email received
- [ ] Check Vercel logs for errors

### 10. Post-Deployment Checks

- [ ] Gmail OAuth working
- [ ] Instantly campaigns creating
- [ ] Smart routing functional
- [ ] Rate limiting working
- [ ] Error logging active

## Monitoring Setup

### 11. Configure Monitoring

- [ ] **Vercel Logs**:
  - [ ] Set up log drains if needed
  - [ ] Configure error alerts

- [ ] **Email Provider Dashboards**:
  - [ ] Gmail: Google Cloud Console
  - [ ] Instantly: app.instantly.ai/analytics
  - [ ] Resend: resend.com/emails

- [ ] **Metrics to Track**:
  - [ ] Emails sent per day
  - [ ] Delivery rate (target >95%)
  - [ ] Bounce rate (target <5%)
  - [ ] API response times
  - [ ] Token refresh success rate

### 12. Set Up Alerts

- [ ] Vercel deployment alerts
- [ ] Error rate threshold alerts
- [ ] Gmail rate limit warnings
- [ ] Instantly quota warnings

## Team Onboarding

### 13. Documentation

- [ ] Share `EMAIL_SETUP_GUIDE.md` with team
- [ ] Share `EMAIL_QUICK_START.md` for quick reference
- [ ] Document team workflows
- [ ] Create internal runbook

### 14. Access & Permissions

- [ ] Add team members to Google Cloud project
- [ ] Share Instantly account access
- [ ] Grant Vercel environment variable access
- [ ] Document who has access to what

## Go-Live Checklist

### 15. Final Verification (Before Launch)

- [ ] All tests passing in production
- [ ] Gmail OAuth flow tested end-to-end
- [ ] Instantly campaigns tested
- [ ] Error handling verified
- [ ] Rate limiting verified
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] Team trained

### 16. Launch

- [ ] Enable email delivery in production
- [ ] Monitor closely for first 24 hours
- [ ] Start with small volume (10-20 emails/day)
- [ ] Gradually increase volume
- [ ] Track metrics daily

### 17. Post-Launch (Week 1)

- [ ] Daily metrics review
- [ ] Check deliverability rates
- [ ] Review error logs
- [ ] Gather user feedback
- [ ] Adjust routing logic if needed

## Rollback Plan

If issues occur:

- [ ] Disable new email system
- [ ] Fall back to existing Resend integration
- [ ] Document issues encountered
- [ ] Fix in development
- [ ] Re-test before re-deploying

## Success Criteria

Launch is successful when:

- [ ] Gmail OAuth working for all users
- [ ] Instantly campaigns creating without errors
- [ ] Email delivery rate >95%
- [ ] Bounce rate <5%
- [ ] No critical errors in logs
- [ ] Users can send emails successfully
- [ ] Smart routing selecting correct providers
- [ ] Rate limits respected

## Support Contacts

### Technical Issues
- **Email Integration**: Check `EMAIL_SETUP_GUIDE.md`
- **API Errors**: Review Vercel logs
- **OAuth Issues**: Google Cloud Console logs

### Provider Support
- **Google**: [Google Cloud Support](https://cloud.google.com/support)
- **Instantly**: support@instantly.ai
- **Resend**: support@resend.com

### Internal
- **Implementation**: Claude/Wells AI
- **Deployment**: DevOps team
- **Business Owner**: Jonah Manning

---

## Quick Reference

### Key Files
- Setup Guide: `EMAIL_SETUP_GUIDE.md`
- Quick Start: `EMAIL_QUICK_START.md`
- Build Summary: `EMAIL_DELIVERY_SUMMARY.md`
- Test Script: `scripts/test-email-delivery.ts`

### Key Commands
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run tests
npm run test:email

# Deploy to production
vercel --prod

# Check logs
vercel logs
```

### Key URLs
- Dev Settings: http://localhost:3000/settings/email
- Prod Settings: https://wellsai.vercel.app/settings/email
- Google Cloud: https://console.cloud.google.com
- Instantly: https://app.instantly.ai

---

**Last Updated**: November 21, 2025
**Version**: 1.0
**Status**: Ready for Deployment
