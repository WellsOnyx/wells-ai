# Tonight's Mission: Close 1 Deal Over Text

**Goal:** Get the SMS flow working end-to-end so you can demo it tomorrow.

---

## ✅ What's Already Done

- ✅ Wells AI logo created
- ✅ User onboarding (buyer/seller selection)
- ✅ Chat connected to Claude AI
- ✅ Supplier matching logic built
- ✅ SMS notification code ready
- ✅ Deployed to production

---

## 🎯 What You Need to Do (30 mins)

### Step 1: Create Notion Databases (10 mins)

**Database 1: Suppliers**
1. Go to Notion
2. Create new database called "Wells AI - Suppliers"
3. Add these properties:
   - `Name` (Title)
   - `Phone` (Phone) - Format: +15551234567
   - `Email` (Email)
   - `Capabilities` (Multi-select) - Add: Semiconductors, Executive Talent, Industrial Equipment, Software & Technology
   - `Status` (Select) - Add: Active, Inactive
   - `Response Time` (Select) - Add: Fast, Medium, Slow
   - `Last Contacted` (Date)

4. Add 2-3 test suppliers using YOUR phone numbers:
   ```
   Name: Test Supplier - Tech
   Phone: +1YOUR_NUMBER
   Email: your@email.com
   Capabilities: Software & Technology, Executive Talent
   Status: Active
   Response Time: Fast
   ```

5. Copy the database ID from the URL:
   - URL looks like: `https://notion.so/xxxxx?v=yyyyy`
   - Database ID is the `xxxxx` part

**Database 2: Requests**
1. Create new database called "Wells AI - Requests"
2. Add these properties:
   - `Request ID` (Title)
   - `Buyer Name` (Text)
   - `Requirements` (Text)
   - `Category` (Select) - Same options as Capabilities above
   - `Status` (Select) - Add: Suppliers Notified, Quotes Received, Closed
   - `Matched Suppliers` (Relation to Suppliers database)
   - `Created` (Created time)

3. Copy this database ID too

### Step 2: Get Notion API Key (5 mins)

1. Go to https://www.notion.so/my-integrations
2. Click "New Integration"
3. Name: "Wells AI"
4. Associated workspace: Select yours
5. Click "Submit"
6. Copy the "Internal Integration Token"
7. Go to BOTH databases → Click "..." → Connections → Add your integration

### Step 3: Configure Twilio (5 mins)

1. Go to Twilio Console → Phone Numbers
2. Click your phone number
3. Under "Messaging Configuration":
   - Webhook URL: `https://wellsai.vercel.app/api/webhooks/sms`
   - Method: HTTP POST
4. Save

### Step 4: Add Environment Variables (10 mins)

Run these commands (paste your actual values):

```bash
cd ~/Downloads/wells-ai-github-ready

# Notion
vercel env add NOTION_API_KEY production
# Paste your integration token when prompted

vercel env add NOTION_SUPPLIERS_DB production
# Paste suppliers database ID

vercel env add NOTION_REQUESTS_DB production
# Paste requests database ID

# Twilio (already have these from Week 2)
vercel env add TWILIO_ACCOUNT_SID production
vercel env add TWILIO_AUTH_TOKEN production
vercel env add TWILIO_PHONE_NUMBER production

# App URL
vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://wellsai.vercel.app
```

Then redeploy:
```bash
vercel --prod
```

---

## 🚀 Test It (5 mins)

1. Open https://wellsai.vercel.app in incognito
2. Go through onboarding as a Buyer
3. Type: **"I need to hire a CTO for a fintech startup"**
4. Wait for AI response
5. Check your phone for SMS from Twilio
6. Reply: **"INTERESTED"**
7. Check Notion - should see:
   - New Request page created
   - Comment with your "INTERESTED" response

---

## 🐛 If Something Breaks

Check logs:
```bash
vercel logs --prod
```

Test Notion connection:
```bash
curl -X POST https://wellsai.vercel.app/api/suppliers/match \
  -H "Content-Type: application/json" \
  -d '{"category":"Executive Talent","requirements":"Need a CTO"}'
```

---

## ✨ Once This Works

You'll have:
- ✅ Real conversational interface
- ✅ AI matching buyers to sellers
- ✅ SMS notifications to suppliers
- ✅ 2-way SMS communication
- ✅ All tracked in Notion

**Then we add Stripe and you can take money.**

---

## Questions?

Ping me if any step fails. The whole flow should work once the environment variables are set.

**This is the game-changer - deal flow over text. Nobody else is doing this.**
