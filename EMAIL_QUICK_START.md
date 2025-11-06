# Email System Quick Start Guide

## Overview
Wells AI now has a fully functional email sending system using Resend API.

## Features
- ✅ Send emails programmatically
- ✅ Automatic warmup protection (prevents spam flags)
- ✅ Rate limiting (1,000 emails/day)
- ✅ Authentication with Clerk
- ✅ HTML email generation from plain text
- ✅ Reply-to support
- ✅ User tracking and tagging

---

## API Endpoint

### Base URL
```
Production: https://wellsai-rc2kwwjy9-wellsonyxs-projects.vercel.app
Endpoint: /api/email/send
```

### Check Status (GET)
```bash
curl https://wellsai-rc2kwwjy9-wellsonyxs-projects.vercel.app/api/email/send
```

**Response:**
```json
{
  "warmup": {
    "accountAgeDays": 306,
    "phase": "Fully Warmed",
    "dailyLimit": 1000,
    "sentToday": 0,
    "remaining": 1000
  },
  "canSendMore": true,
  "recommendation": "You can send 1000 more emails today"
}
```

### Send Email (POST)
```bash
curl -X POST https://wellsai-rc2kwwjy9-wellsonyxs-projects.vercel.app/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Your Subject Here",
    "message": "Your message here.\n\nSupports multiple lines."
  }'
```

**Response (Success):**
```json
{
  "success": true,
  "messageId": "86a1dcce-638f-4170-8932-a6a24247b033",
  "sentToday": 1,
  "dailyLimit": 1000,
  "remaining": 999,
  "warmupPhase": "Fully Warmed"
}
```

**Response (Throttled):**
```json
{
  "success": false,
  "throttled": true,
  "error": "Daily limit reached (1000 emails/day during warmup period)",
  "warmupStatus": {
    "phase": "Fully Warmed",
    "dailyLimit": 1000,
    "sentToday": 1000,
    "remaining": 0
  }
}
```

---

## Request Parameters

### Required
- `to` (string): Recipient email address
- `subject` (string): Email subject line
- `message` (string): Plain text message (auto-converted to HTML)

### Optional
- `toName` (string): Recipient's name
- `from` (string): Sender email (defaults to authenticated user's email)
- `fromName` (string): Sender name (defaults to authenticated user's name)
- `replyTo` (string): Reply-to email address
- `userId` (string): Custom user ID for tracking

---

## Code Examples

### JavaScript/TypeScript
```typescript
async function sendEmail() {
  const response = await fetch('/api/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'customer@example.com',
      subject: 'Welcome to Wells Onyx',
      message: 'Thanks for signing up!\n\nWe are excited to have you.'
    })
  });

  const result = await response.json();
  console.log(result);
}
```

### Python
```python
import requests

def send_email():
    response = requests.post(
        'https://wellsai-rc2kwwjy9-wellsonyxs-projects.vercel.app/api/email/send',
        json={
            'to': 'customer@example.com',
            'subject': 'Welcome to Wells Onyx',
            'message': 'Thanks for signing up!\n\nWe are excited to have you.'
        }
    )
    return response.json()
```

### cURL
```bash
curl -X POST https://wellsai-rc2kwwjy9-wellsonyxs-projects.vercel.app/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "customer@example.com",
    "subject": "Welcome to Wells Onyx",
    "message": "Thanks for signing up!\n\nWe are excited to have you.",
    "replyTo": "support@wellsonyx.com"
  }'
```

---

## Conversational Email via Wells Chat

Wells AI can send emails when users request them in natural language:

**Example Conversation:**
```
User: "Send an email to john@acme.com about tomorrow's meeting"

Wells: "I'll send that email for you. What should the subject be?"

User: "Meeting Reminder - Tomorrow 3pm"

Wells: "Got it. What would you like to say in the email?"

User: "Hi John, Just a reminder about our meeting tomorrow at 3pm.
       Looking forward to discussing the Q4 strategy."

Wells: "Email sent successfully to john@acme.com!
       Message ID: 86a1dcce-638f-4170-8932-a6a24247b033"
```

---

## Email Formatting

### Plain Text Input
```
"Hello!\n\nThis is a test email.\n\nThanks,\nWells"
```

### Auto-Generated HTML Output
```html
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto...">
  Hello!<br/>
  <br/>
  This is a test email.<br/>
  <br/>
  Thanks,<br/>
  Wells

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
    <p>Wells Onyx</p>
    <p>Sent via <a href="https://wellsonyx.com">wellsonyx.com</a></p>
  </div>
</body>
</html>
```

### Supported Markdown
- **Bold text:** `**bold**` → `<strong>bold</strong>`
- **URLs:** `https://example.com` → `<a href="...">...</a>`

---

## Rate Limits & Warmup

### Warmup Schedule
| Days | Daily Limit |
|------|-------------|
| 1-3  | 20 emails   |
| 4-7  | 50 emails   |
| 8-14 | 100 emails  |
| 15-21| 250 emails  |
| 22-28| 500 emails  |
| 29+  | 1,000 emails|

**Current Status:** Fully Warmed (306 days)

### Checking Remaining Quota
```bash
curl https://wellsai-rc2kwwjy9-wellsonyxs-projects.vercel.app/api/email/send
```

---

## Error Handling

### Common Errors

**Invalid Email:**
```json
{
  "success": false,
  "error": "Invalid email address: not-an-email"
}
```

**Missing Fields:**
```json
{
  "success": false,
  "error": "Missing required fields: to, subject, message"
}
```

**Rate Limited:**
```json
{
  "success": false,
  "throttled": true,
  "error": "Daily limit reached (1000 emails/day during warmup period)"
}
```

**Bounce Detection:**
```json
{
  "success": false,
  "error": "Bounce rate too high (5.2% - threshold is 5%)"
}
```

---

## Configuration

### Environment Variables
```bash
# Required
RESEND_API_KEY=re_DSKw63dr_ANZugnUyyH2i914VcSFvygS6
RESEND_FROM_EMAIL=wells@wellsonyx.com

# Optional
RESEND_ACCOUNT_START_DATE=2025-01-05  # For warmup calculation
```

### Clerk Authentication
Emails are sent from the authenticated user's email by default. If no user is logged in, defaults to `wells@wellsonyx.com`.

---

## Monitoring

### Resend Dashboard
- **URL:** https://resend.com/emails
- **Login:** Use Wells Onyx account
- **Features:**
  - View sent emails
  - Track delivery status
  - Check bounce rates
  - Monitor spam reports

### Key Metrics to Watch
- ✅ **Delivery Rate:** Should be >95%
- ✅ **Bounce Rate:** Should be <5%
- ✅ **Spam Rate:** Should be <0.1%
- ✅ **Daily Volume:** Stay under warmup limits

---

## Best Practices

### 1. Gradual Volume Increase
- Don't send max volume immediately
- Follow warmup schedule
- Monitor bounce/spam rates

### 2. Email Validation
- Always validate email format before sending
- Use `isValidEmail()` helper function
- Check for common typos

### 3. Content Quality
- Write clear, relevant subject lines
- Keep messages professional
- Include unsubscribe link for bulk emails

### 4. Response Handling
- Always check `success` field
- Handle throttling gracefully
- Log messageId for tracking

---

## Troubleshooting

### Email Not Sending
1. Check API response for error message
2. Verify RESEND_API_KEY is set
3. Check daily quota: GET /api/email/send
4. Verify email format is valid

### Emails Going to Spam
1. Check bounce rate (<5%)
2. Verify SPF/DKIM records
3. Review email content quality
4. Follow warmup schedule

### Rate Limited
1. Check current quota
2. Wait for daily reset (midnight UTC)
3. Consider upgrading Resend plan

---

## Support

### Documentation
- Resend Docs: https://resend.com/docs
- Wells AI Email Lib: `/lib/resend-email.ts`
- Email Route: `/app/api/email/send/route.ts`

### Contact
- **Email Issues:** Check Resend dashboard
- **Code Issues:** See `/lib/resend-email.ts`
- **Rate Limits:** Contact Resend support

---

## Next Steps

1. ✅ Integrate email UI into Wells chat
2. ✅ Add email templates
3. ✅ Implement bulk sending
4. ✅ Add email scheduling
5. ✅ Create analytics dashboard

---

**Status:** ✅ Fully Operational
**Last Updated:** November 6, 2025
