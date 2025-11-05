# Resend Email Setup Guide

## Quick Start

You need to configure Resend to enable email sending for Wells GTM.

### 1. Create Resend Account

1. Go to https://resend.com
2. Sign up with your email
3. Verify your email address

### 2. Get API Key

1. Go to **API Keys** in Resend dashboard
2. Click **Create API Key**
3. Name it: `Wells Production`
4. Select: **Sending access**
5. Copy the API key (starts with `re_`)

### 3. Verify Domain

To send from `wells@wellsonyx.com`, you need to verify the domain:

1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter: `wellsonyx.com`
4. Copy the DNS records Resend provides
5. Add them to your DNS provider (likely Vercel or GoDaddy)
6. Wait for verification (usually 10-30 minutes)

**DNS Records you'll need to add:**
```
Type: TXT
Name: _resend
Value: [Resend will provide this]

Type: MX
Name: @
Value: [Resend will provide this]
Priority: 10

Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
```

### 4. Configure Vercel Environment Variables

```bash
cd ~/Downloads/wells-ai-github-ready

# Add Resend API key to all environments
vercel env add RESEND_API_KEY

# When prompted:
# - Enter your Resend API key (starts with re_)
# - Select: Production, Preview, Development (all three)

# Add sender email (optional - defaults to wells@wellsonyx.com)
vercel env add RESEND_FROM_EMAIL

# When prompted:
# - Enter: wells@wellsonyx.com
# - Select: Production, Preview, Development

# Add account start date for warmup calculation
vercel env add RESEND_ACCOUNT_START_DATE

# When prompted:
# - Enter today's date: 2025-01-05
# - Select: Production, Preview, Development
```

### 5. Deploy to Production

```bash
vercel --prod
```

### 6. Test Email Sending

Once deployed, test the API:

```bash
curl -X POST https://wellsai.vercel.app/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test Email from Wells",
    "message": "This is a test email sent via Resend.\n\nIf you receive this, email delivery is working!"
  }'
```

You should get a response like:
```json
{
  "success": true,
  "messageId": "abc123...",
  "sentToday": 1,
  "dailyLimit": 20,
  "remaining": 19,
  "warmupPhase": "Initial Warmup (Days 1-3)"
}
```

### 7. Check Warmup Status

```bash
curl https://wellsai.vercel.app/api/email/send
```

Response:
```json
{
  "warmup": {
    "accountAgeDays": 1,
    "phase": "Initial Warmup (Days 1-3)",
    "dailyLimit": 20,
    "sentToday": 1,
    "remaining": 19,
    "bounceCount": 0,
    "spamReportCount": 0,
    "bounceRate": 0,
    "spamRate": 0
  },
  "canSendMore": true,
  "recommendation": "You can send 19 more emails today"
}
```

---

## Warmup Schedule

Your email sending limits will gradually increase:

| Days | Daily Limit | Phase |
|------|-------------|-------|
| 1-3 | 20 emails/day | Initial Warmup |
| 4-7 | 50 emails/day | Early Warmup |
| 8-14 | 100 emails/day | Early Warmup |
| 15-21 | 250 emails/day | Mid Warmup |
| 22-28 | 500 emails/day | Near Full |
| 29+ | 1000 emails/day | Fully Warmed |

**Critical Rules:**
- Never exceed daily limits (automatic throttling)
- Keep bounce rate < 5%
- Keep spam rate < 0.1%
- Emails will be blocked automatically if thresholds are exceeded

---

## Using Email in Wells Chat

Once configured, you can send emails conversationally:

```
User: Wells email john@acmecorp.com about the CFO search

Wells: I'll help you draft that email. What's the subject line you'd like to use?

User: Follow up: CFO Search for Acme Corp

Wells: Great subject. What would you like to say in the email?

User: Hi John, following up on our conversation last week about the CFO search. I have 3 strong candidates...

Wells: Perfect! Here's your email:

To: john@acmecorp.com
Subject: Follow up: CFO Search for Acme Corp

Hi John, following up on our conversation last week about the CFO search. I have 3 strong candidates...

Should I send this?

User: Yes

Wells: ✅ Email sent! (1 of 20 today)
```

---

## Troubleshooting

### Domain Not Verified
- Check DNS records are correctly added
- Wait up to 24 hours for DNS propagation
- Use Resend's DNS checker tool

### Emails Going to Spam
- Ensure SPF/DKIM/DMARC records are set
- Start slow (follow warmup schedule)
- Avoid spammy content
- Personalize each email

### Rate Limit Errors
- Respect daily limits (automatic throttling)
- Check warmup status: `GET /api/email/send`
- Wait for account to age (limits increase daily)

### API Key Issues
- Verify API key in Vercel dashboard
- Check key has "Sending access" permission
- Make sure key is set in Production environment

---

## Next Steps

After basic email is working:

1. **Add Gmail OAuth** - For 1:1 executive outreach (highest deliverability)
2. **Integrate Instantly** - For automated sequences and follow-ups
3. **Build email templates** - Common GTM outreach patterns
4. **Add tracking** - Open rates, click rates, replies

See ROADMAP.md for full email infrastructure roadmap.

---

Built by Wells Onyx
Powered by Resend
