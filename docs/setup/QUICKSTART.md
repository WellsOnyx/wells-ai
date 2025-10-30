# WELLS AI - QUICK START GUIDE
*Get live in 10 minutes*

---

## ✅ WHAT'S BUILT

Complete Wells AI chat interface:
- Wells Onyx branded (exact colors from brand guide)
- Claude Sonnet 4.5 integrated
- Expert/trusted conversation voice
- Ready for semiconductor + executive search
- Mobile responsive
- Constellation theme

---

## 🚀 DEPLOY NOW (3 Steps)

### STEP 1: Get Claude API Key (2 min)

1. Go to https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Name it: "Wells AI Production"
4. Copy the key (starts with `sk-ant-api03-`)
5. **SAVE IT** - you'll need it in Step 3

### STEP 2: Deploy to Vercel (3 min)

1. Go to https://vercel.com/signup
2. Sign up with GitHub
3. Click "Add New Project"
4. Click "Import Third-Party Git Repository"
5. Upload this entire `wells-ai-app` folder
   - Or push to GitHub first, then import

### STEP 3: Add API Key (1 min)

In Vercel during deployment:
1. Click "Environment Variables"
2. Add variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** [paste your Claude API key]
3. Click "Deploy"

**DONE!** Your Wells AI is live in ~2 minutes at:
`https://your-project-name.vercel.app`

---

## 🧪 TEST IT

### Test 1: Semiconductor
Go to your live URL and type:
> "I need 50,000 5nm chips for Q2 2026"

Wells AI should:
- Ask about architecture
- Clarify budget
- Discuss timeline
- Sound expert & trusted (not robotic)

### Test 2: Executive Search
Type:
> "Need to hire a Chief Revenue Officer"

Wells AI should:
- Ask about company stage
- Clarify compensation
- Understand requirements
- Sound professional & warm

---

## 📱 EMBED ON YOUR SITE

### Option 1: Full Page
Point a subdomain to your Vercel URL:
- chat.wellsonyx.com → your-project.vercel.app

### Option 2: iframe Embed
```html
<iframe 
  src="https://your-project.vercel.app" 
  width="100%" 
  height="800px"
  style="border: none; border-radius: 8px;">
</iframe>
```

### Option 3: Popup Widget (Coming Week 2)
```html
<script>
  // Wells AI popup widget
  // Will be built Week 2
</script>
```

---

## 🎨 BRAND VERIFICATION

Your Wells AI should look like:

**Colors:**
- Header: Deep blue (#183b6d)
- Accent: Gold (#dba63f)
- Background: Subtle gradient

**Logo:**
- "Wells AI" in header
- "Trust + Outcomes" tagline
- "Powered by Wells Onyx" credit

**Voice:**
- Expert, not cold
- Structured, yet personal
- Focuses on endurance

If anything looks off, check:
1. Tailwind CSS is loading (see `app/globals.css`)
2. Colors match brand guide (see `tailwind.config.js`)

---

## 💾 BACKUP INSTRUCTIONS

This folder contains everything needed to rebuild:

**Critical Files:**
- `app/page.tsx` - Chat interface
- `app/api/chat/route.ts` - Claude integration
- `tailwind.config.js` - Brand colors
- `README.md` - Full documentation

**To Rebuild:**
1. Upload this folder to new Vercel project
2. Add `ANTHROPIC_API_KEY` environment variable
3. Deploy

---

## 🔥 WHAT'S NEXT

### Week 2: Supplier Activation
- Connect Notion databases (already set up)
- Add Twilio SMS alerts
- Real-time supplier notifications
- "3 suppliers reviewing your request..."

### Week 3: Quote System
- Supplier response collection
- Quote comparison dashboard
- Buyer notifications
- Deal tracking

### Week 4: Scale
- Analytics dashboard
- Performance monitoring
- API containerization
- Mobile apps

---

## 📞 NEED HELP?

**If stuck:**
1. Check README.md (detailed troubleshooting)
2. Verify API key in Vercel settings
3. Check browser console for errors

**Wells Onyx:**
- Jonah Manning: jonah@wellsonyx.com
- Phone: +1 (850) 456-1961

---

## ✨ YOU'RE LIVE

Congrats! Wells AI is now:
- ✅ Live on the internet
- ✅ Branded with Wells Onyx identity
- ✅ Powered by Claude Sonnet 4.5
- ✅ Ready to qualify real RFQs

**Share your link:**
`https://your-project.vercel.app`

Test it. Share it with partners. Get feedback.

Week 2 starts when you're ready to activate suppliers.

---

*Built with precision. Powered by trust.*
*Wells Onyx | Trust + Outcomes*
