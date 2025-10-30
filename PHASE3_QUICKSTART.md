# Phase 3 Quick Start Guide

Get Wells AI Phase 3 integrations (Widget, Bots, ERP) up and running in minutes.

---

## What You're Setting Up

**Phase 3: Native Everywhere** makes Wells AI available on:
- ✅ Any website (embeddable widget)
- ✅ Slack workspaces
- ✅ Microsoft Teams
- ✅ Discord servers
- ✅ Google Chat spaces
- ✅ 100+ ERP systems (via Merge.dev)

**Status**: All code is deployed to production at https://wellsai.vercel.app

**What's Left**: Configuration (API keys, webhooks, environment variables)

---

## Quick Configuration (30 minutes)

### Step 1: Environment Variables (5 min)

1. Go to Vercel project → **Settings** → **Environment Variables**

2. Add required variables:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-key  # Get from console.anthropic.com
   POSTGRES_URL=postgresql://...        # Already configured
   NEXT_PUBLIC_BASE_URL=https://wellsai.vercel.app
   ```

3. **Redeploy** after adding variables (Vercel dashboard → Deployments → Redeploy)

### Step 2: Choose Integrations

Pick which integrations you want to set up:

**Option A: Widget Only** (5 minutes)
- Embeddable chat for any website
- No external accounts needed
- Perfect for MVP testing

**Option B: One Bot** (15 minutes)
- Choose Slack, Teams, Discord, or Google Chat
- Great for internal testing
- Requires platform account

**Option C: ERP Integration** (20 minutes)
- Connect to customer ERPs
- Auto-sync deals to purchase orders
- Requires Merge.dev account

**Option D: Full Setup** (60 minutes)
- All bots + ERP integration
- Complete Phase 3 experience
- Recommended for production

---

## Option A: Widget Only (5 min)

### 1. Test Widget

The widget is already live! Test it now:

```html
<!-- Add to any webpage -->
<script src="https://wellsai.vercel.app/widget.js" data-wells-key="demo"></script>
```

### 2. Generate API Keys (Optional)

For production, generate unique keys per customer:

```sql
-- Add to your database
CREATE TABLE widget_api_keys (
  key VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255),
  domain VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Generate key
INSERT INTO widget_api_keys (key, customer_id, domain)
VALUES (
  'wai_' || substr(md5(random()::text), 1, 32),
  'customer_123',
  'example.com'
);
```

### 3. Customer Installation

Give customers this code:

```html
<script src="https://wellsai.vercel.app/widget.js"
        data-wells-key="CUSTOMER_API_KEY">
</script>
```

**Done!** Widget is working.

**Full Widget Docs**: `docs/integrations/WIDGET_DOCUMENTATION.md`

---

## Option B: Slack Bot (15 min)

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name: `Wells AI`, select workspace
4. **OAuth & Permissions** → Add Bot Token Scopes:
   - `chat:write`, `commands`, `im:history`, `im:write`
5. **Slash Commands** → Add command:
   - Command: `/wells-help`
   - Request URL: `https://wellsai.vercel.app/api/slack/commands`
6. **Install to Workspace** → Copy Bot Token

### 2. Add to Vercel

```bash
SLACK_BOT_TOKEN=xoxb-your-token
```

Redeploy.

### 3. Test

In Slack:
```
/wells-help
```

**Done!** Slack bot is working.

**Full Slack Setup**: `docs/integrations/BOT_CONFIGURATION_GUIDE.md#slack-bot-setup`

---

## Option C: ERP Integration (20 min)

### 1. Create Merge.dev Account

1. Go to https://merge.dev → Sign up
2. Enable **Accounting** category
3. Copy **Production API Key** from Settings → API Keys

### 2. Add to Vercel

```bash
MERGE_API_KEY=live_your_key_here
```

Redeploy.

### 3. Run Database Migration

```bash
psql $POSTGRES_URL < scripts/schema-erp.sql
```

Or via Vercel Postgres dashboard: paste contents of `scripts/schema-erp.sql`

### 4. Test Connection

```bash
curl -X POST https://wellsai.vercel.app/api/erp/link-token \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test_123",
    "customerEmail": "test@example.com",
    "companyName": "Test Corp"
  }'
```

Should return: `{"linkToken": "link_prod_..."}`

**Done!** ERP integration is ready.

**Full ERP Setup**: `docs/integrations/ERP_INTEGRATION_GUIDE.md`

---

## Option D: Full Setup (60 min)

Follow all three guides above, plus:

### Additional Bots

**Teams** (15 min):
- https://dev.botframework.com → Register bot
- Add `TEAMS_APP_ID` and `TEAMS_APP_PASSWORD`
- Upload manifest ZIP to Teams

**Discord** (15 min):
- https://discord.com/developers/applications → New Application
- Add `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID`
- Register slash commands

**Google Chat** (20 min):
- https://console.cloud.google.com → Enable Chat API
- Create service account → Download JSON
- Add credentials to Vercel

### Complete Environment Variables

Copy `.env.example` → `.env.local` and fill in all values.

**Verify**:
```bash
npm run validate:env
```

---

## Testing All Integrations

### Widget Test

```html
<script src="https://wellsai.vercel.app/widget.js" data-wells-key="demo"></script>
```

Open webpage → Chat widget appears → Type "help"

### Slack Test

```
/wells-help
/wells-rfq 100 office chairs
/wells-find steel suppliers
```

### Teams Test

```
@Wells AI help
@Wells AI create rfq 50 laptops
```

### Discord Test

```
/help
/rfq description: 100 office chairs
/find query: steel suppliers
```

### Google Chat Test

```
@Wells AI help
@Wells AI create rfq 25 desks
```

### ERP Test

1. Create test deal:
   ```bash
   curl -X POST https://wellsai.vercel.app/api/test/create-deal \
     -H "Content-Type: application/json" \
     -d '{"buyerId": "test_123", "productName": "Test", "amount": 1000}'
   ```

2. Mark as paid:
   ```bash
   curl -X PATCH https://wellsai.vercel.app/api/test/update-deal \
     -H "Content-Type: application/json" \
     -d '{"dealId": "DEAL_ID", "status": "paid"}'
   ```

3. Check sync:
   ```bash
   curl https://wellsai.vercel.app/api/deals/sync-erp/status/DEAL_ID
   ```

---

## Common Issues & Fixes

### Widget Not Appearing

**Problem**: Script tag added but nothing shows
**Fix**:
- Open browser console for errors
- Verify URL is correct: `https://wellsai.vercel.app/widget.js`
- Check CORS if widget on different domain

### Slack Commands Not Working

**Problem**: `/wells-help` returns error
**Fix**:
- Verify `SLACK_BOT_TOKEN` in Vercel
- Check slash command Request URL matches
- Reinstall app to workspace

### ERP Sync Failing

**Problem**: Deal marked paid but not syncing
**Fix**:
- Check `MERGE_API_KEY` is production key (`live_...`)
- Verify database trigger exists:
  ```sql
  SELECT * FROM information_schema.triggers
  WHERE trigger_name = 'trigger_auto_sync_deal_to_erp';
  ```
- Check customer has ERP connected:
  ```sql
  SELECT * FROM merge_account_tokens
  WHERE customer_id = 'CUSTOMER_ID';
  ```

### Bot Timing Out

**Problem**: Bot responds slowly or times out
**Fix**:
- Check Vercel function logs for errors
- Verify database connection is working
- Increase Vercel timeout if needed (Settings → Functions)

---

## Monitoring

### Check Deployment Status

```bash
vercel ls
```

### View Logs

```bash
vercel logs wellsai.vercel.app --since=1h
```

### Monitor Specific Endpoint

```bash
vercel logs --filter=/api/slack/commands --follow
```

### Database Health

```sql
-- Check recent activity
SELECT COUNT(*) FROM rfqs WHERE created_at > NOW() - INTERVAL '1 hour';
SELECT COUNT(*) FROM erp_syncs WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Production Readiness Checklist

Before going live:

### Security
- [ ] All API keys rotated from defaults
- [ ] Environment variables set in Vercel (not in code)
- [ ] Webhook signature verification enabled
- [ ] Rate limiting configured
- [ ] CORS configured for widget domains

### Testing
- [ ] Widget tested on 3+ different domains
- [ ] Each bot tested with 10+ commands
- [ ] ERP sync tested with real account
- [ ] Error handling tested (invalid inputs)
- [ ] Load tested (10+ concurrent users)

### Monitoring
- [ ] Sentry error tracking enabled
- [ ] Database alerts configured
- [ ] Vercel alerts set up
- [ ] Uptime monitoring active
- [ ] Usage analytics tracked

### Documentation
- [ ] Customer onboarding docs written
- [ ] Support team trained
- [ ] API docs published
- [ ] Video tutorials recorded
- [ ] FAQ created

### Support
- [ ] Support email configured (support@wellsonyx.com)
- [ ] On-call rotation established
- [ ] Escalation process documented
- [ ] SLA defined
- [ ] Customer success plan ready

---

## Next Steps

### Week 1: Soft Launch
- Deploy to 5 test customers
- Collect feedback
- Fix any issues
- Monitor metrics daily

### Week 2: Gradual Rollout
- Deploy to 20 customers
- Enable all bots
- Connect first ERP customers
- Scale infrastructure as needed

### Week 3: Full Launch
- Announce Phase 3 publicly
- Enable self-service onboarding
- Scale support team
- Monitor growth

### Week 4: Optimize
- Analyze usage patterns
- Optimize slow endpoints
- Add requested features
- Plan Phase 4

---

## Support & Resources

### Documentation
- **Widget Docs**: `docs/integrations/WIDGET_DOCUMENTATION.md`
- **Bot Setup**: `docs/integrations/BOT_CONFIGURATION_GUIDE.md`
- **ERP Setup**: `docs/integrations/ERP_INTEGRATION_GUIDE.md`
- **Architecture**: `ARCHITECTURE.md`
- **Contributing**: `CONTRIBUTING.md`

### External Resources
- **Merge.dev Docs**: https://docs.merge.dev
- **Slack API**: https://api.slack.com/docs
- **Teams Bot Framework**: https://dev.botframework.com/bots
- **Discord Developers**: https://discord.com/developers/docs
- **Google Chat API**: https://developers.google.com/chat

### Get Help
- **Email**: support@wellsonyx.com
- **Slack**: #wells-ai-support (if internal)
- **GitHub Issues**: https://github.com/YOUR_ORG/wells-ai/issues

---

## Summary

**Phase 3 Status**: ✅ Deployed to production

**What's Working**:
- Widget embeddable on any website
- 4 bot platforms ready (just need API keys)
- ERP integration ready (just need Merge.dev account)
- All endpoints live and tested
- Database triggers active
- Auto-sync configured

**What's Needed**:
- API keys for platforms you want to use
- Customer testing and feedback
- Production monitoring setup

**Time to Production**: 30-60 minutes depending on how many integrations you enable

---

Built with precision. Powered by trust. Designed for generations.
*Wells Onyx | Trust + Outcomes*
