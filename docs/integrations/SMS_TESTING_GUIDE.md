# SMS Testing Guide - Get Your First Deal Closed

## 🎯 Goal: Close 1 Deal Over Text

This is the killer feature. Let's test it end-to-end.

---

## Prerequisites Checklist

### 1. Environment Variables (Check Vercel)
```bash
vercel env ls
```

You need:
- ✅ `ANTHROPIC_API_KEY` - For Claude AI
- ⏳ `NOTION_API_KEY` - For supplier database
- ⏳ `NOTION_SUPPLIERS_DB` - Supplier database ID
- ⏳ `NOTION_REQUESTS_DB` - Requests database ID
- ⏳ `TWILIO_ACCOUNT_SID` - For SMS
- ⏳ `TWILIO_AUTH_TOKEN` - For SMS
- ⏳ `TWILIO_PHONE_NUMBER` - Your Twilio number
- ⏳ `NEXT_PUBLIC_APP_URL` - Your production URL

---

## Step 1: Set Up Notion Databases

### Suppliers Database Schema
Create a database in Notion with these properties:
- `Name` (Title) - Supplier company name
- `Phone` (Phone) - Mobile number for SMS (format: +15551234567)
- `Email` (Email) - Contact email
- `Capabilities` (Multi-select) - Categories they serve
  - Semiconductors
  - Executive Talent
  - Industrial Equipment
  - Professional Services
  - Software & Technology
- `Status` (Select) - Active, Inactive
- `Response Time` (Select) - Fast, Medium, Slow
- `Last Contacted` (Date) - Auto-populated

### Requests Database Schema
Create another database with:
- `Request ID` (Title) - Auto-generated
- `Buyer Name` (Text) - From user profile
- `Requirements` (Text) - What they need
- `Category` (Select) - Same as Capabilities above
- `Status` (Select) - Suppliers Notified, Quotes Received, Closed
- `Matched Suppliers` (Relation) - Links to Suppliers DB
- `Created` (Created Time) - Auto

---

## Step 2: Add Test Suppliers to Notion

Add 2-3 test suppliers with YOUR phone numbers:

**Example:**
- Name: "Test Supplier - Semiconductors"
- Phone: +1YOUR_MOBILE
- Email: your@email.com
- Capabilities: Semiconductors
- Status: Active
- Response Time: Fast

**Important:** Use real phone numbers you can access!

---

## Step 3: Configure Twilio Webhook

1. Go to Twilio Console → Phone Numbers → Your Number
2. Under "Messaging", set webhook URL to:
   ```
   https://wellsai.vercel.app/api/webhooks/sms
   ```
3. Method: HTTP POST
4. Save

This allows suppliers to reply via SMS and have it tracked.

---

## Step 4: Add Environment Variables to Vercel

```bash
# Add Notion keys
vercel env add NOTION_API_KEY production
# Paste your Notion integration token

vercel env add NOTION_SUPPLIERS_DB production
# Paste your suppliers database ID

vercel env add NOTION_REQUESTS_DB production
# Paste your requests database ID

# Add Twilio keys
vercel env add TWILIO_ACCOUNT_SID production
# Paste from Twilio console

vercel env add TWILIO_AUTH_TOKEN production
# Paste from Twilio console

vercel env add TWILIO_PHONE_NUMBER production
# Format: +15551234567

# Add app URL
vercel env add NEXT_PUBLIC_APP_URL production
# Value: https://wellsai.vercel.app
```

Then redeploy:
```bash
vercel --prod
```

---

## Step 5: Test the Flow

### The Full Journey:
1. **User opens Wells AI** → Goes through onboarding
2. **User types:** "I need to source semiconductors for automotive manufacturing, 10K units"
3. **AI detects intent** → Matches with suppliers in Notion
4. **SMS sent to suppliers** → They receive:
   ```
   Wells AI Opportunity - Semiconductors

   Buyer: John Doe
   Requirements: I need to source semiconductors for automotive manufacturing, 10K units

   Respond: https://wellsai.vercel.app/respond/[token]

   Reply INTERESTED or PASS
   ```
5. **Supplier texts back:** "INTERESTED"
6. **System logs response** → Adds comment to Request in Notion
7. **Buyer gets notification** → "2 suppliers responded"

---

## Step 6: What You'll See

### In Notion (Requests DB):
- New page created with Request ID
- Status: "Suppliers Notified"
- Matched Suppliers: Links to your test suppliers
- Comments: Supplier responses tracked

### On Your Phone:
- You'll receive the SMS as the "supplier"
- Reply "INTERESTED" or "PASS"

### In Wells AI Chat:
- Gold notification box appears
- Shows: "Marketplace Match Complete"
- "AI matched your request with X qualified sellers"

---

## Common Issues & Fixes

### No SMS Received?
- Check Twilio phone number is verified
- Check supplier phone number format (+1XXXXXXXXXX)
- Check Twilio console logs

### Webhook Not Working?
- Verify webhook URL in Twilio
- Check `/api/webhooks/sms/route.ts` is deployed
- Look at Vercel logs: `vercel logs --prod`

### No Suppliers Matched?
- Check supplier Capabilities match the category
- Check supplier Status = "Active"
- Check Notion API permissions

---

## Success Criteria

You've successfully tested when:
- ✅ User can describe what they need
- ✅ AI detects it and triggers matching
- ✅ SMS is sent to suppliers
- ✅ Supplier can reply via SMS
- ✅ Response is logged in Notion
- ✅ Buyer sees confirmation in chat

---

## Next: Add Payments

Once SMS flow works, we'll add Stripe so deals can close with payment.

---

## Need Help?

Run these diagnostic commands:
```bash
# Check environment variables
vercel env ls

# Check deployment logs
vercel logs --prod

# Test Notion connection
curl -X POST https://wellsai.vercel.app/api/suppliers/match \
  -H "Content-Type: application/json" \
  -d '{"category":"Semiconductors","requirements":"test"}'
```
