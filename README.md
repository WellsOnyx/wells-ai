# Wells AI - Conversational Commerce Platform

**Built for Wells Onyx | Trust + Outcomes**

Intelligent procurement matching connecting enterprise buyers with qualified suppliers through AI-powered conversation.

---

## 🎯 What This Is

Wells AI is a branded conversational interface that:
- Qualifies buyer needs through natural dialogue
- Captures structured data for RFQ creation
- Triggers real-time supplier notifications
- Matches buyers with optimal suppliers

**Transaction Types:**
1. **Semiconductor Procurement** (product-based)
2. **Executive Search** (service-based)

---

## 🎨 Brand

Wells AI uses Wells Onyx brand identity:
- **Colors:** Deep Blue (#183b6d), Gold (#dba63f), Grays
- **Voice:** Expert & trusted, precise yet personal
- **Theme:** Constellation metaphor (North Star + practice groups)

---

## 🚀 Quick Deploy to Vercel (5 Minutes)

### Step 1: Prerequisites
- GitHub account
- Vercel account (free tier works)
- Claude API key from console.anthropic.com

### Step 2: Deploy

1. **Upload to GitHub:**
   ```bash
   # Create new repo on github.com
   git init
   git add .
   git commit -m "Initial Wells AI"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/wells-ai.git
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to vercel.com
   - Click "Add New Project"
   - Import your GitHub repo
   - Add environment variable:
     - `ANTHROPIC_API_KEY`: Your Claude API key
   - Click "Deploy"

3. **Done!** Your Wells AI is live at `your-project.vercel.app`

---

## 🔧 Local Development

### Install Dependencies:
```bash
npm install
```

### Set Up Environment:
```bash
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
```

### Run Development Server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📂 Project Structure

```
wells-ai-app/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # Claude API integration
│   ├── globals.css               # Tailwind + Wells Onyx styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main chat interface
├── public/                       # Static assets
├── .env.local.example            # Environment template
├── next.config.js                # Next.js config
├── tailwind.config.js            # Wells Onyx brand colors
├── package.json                  # Dependencies
└── README.md                     # This file
```

---

## 🎨 Customization

### Colors (tailwind.config.js):
```javascript
colors: {
  'wells-blue': '#183b6d',    // Trust & Depth
  'wells-gold': '#dba63f',    // Prosperity & Purpose
  'wells-gray-dark': '#575757',
  'wells-gray-light': '#9ea1a7',
}
```

### Conversation Prompts (app/api/chat/route.ts):
- Edit `WELLS_AI_SYSTEM_PROMPT` to adjust AI behavior
- Add new categories beyond semiconductors/exec search
- Modify qualification questions

---

## 🔌 Embed on Your Website

### Option 1: iframe
```html
<iframe 
  src="https://your-wells-ai.vercel.app" 
  width="100%" 
  height="800px"
  frameborder="0">
</iframe>
```

### Option 2: Popup Widget (Coming Week 2)
```html
<script src="https://your-wells-ai.vercel.app/widget.js"></script>
<div id="wells-ai-widget"></div>
```

---

## 📊 Current Features

✅ **Week 1 - Proven:**
- Branded chat interface (Wells Onyx identity)
- Claude Sonnet 4.5 integration
- Expert/trusted conversation voice
- Semiconductor + Executive Search qualification
- Mobile responsive design
- Constellation-themed UI

⏳ **Week 2 - Building:**
- Notion database integration
- Real-time SMS supplier alerts (Twilio)
- RFQ creation automation
- Supplier response collection

⏳ **Week 3+ - Planned:**
- Quote comparison dashboard
- Transaction tracking
- Billing automation (5.5% platform fee - includes all processing)
- Analytics & reporting

---

## 💰 Cost Breakdown

### Fixed Monthly:
- Vercel Hosting: **$0** (free tier)
- Claude API: **~$0.04 per conversation**
- Total: **~$30/month** at 10 RFQs/day

### Variable (per RFQ):
- Claude API: $0.04
- Twilio SMS (Week 2): $0.06
- **Total: $0.10 per RFQ**

### ROI:
- Wells AI platform fee: 5.5% (includes all payment processing costs)
- Avg semiconductor deal: $12.5M → $687,500 revenue
- Avg exec search: $100K → $5,500 revenue
- **Margin: ~95%** (after operational costs)

---

## 🔐 Environment Variables

Required immediately:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Week 2 additions:
```
NOTION_API_KEY=secret_...
NOTION_RFQ_DATABASE_ID=...
NOTION_SUPPLIER_DATABASE_ID=...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

---

## 🧪 Testing

### Test Scenario 1: Semiconductor
**Input:** "I need 50,000 5nm chips for AI training, Q2 2026 delivery"

**Wells AI Should:**
- Ask about architecture (ARM, x86, etc.)
- Clarify budget per unit
- Discuss technical requirements
- Understand timeline urgency
- Summarize and confirm

### Test Scenario 2: Executive Search
**Input:** "Need to hire a Chief Revenue Officer"

**Wells AI Should:**
- Ask about company stage/industry
- Clarify compensation range
- Understand timeline (90 days?)
- Discuss key requirements
- Ask about team they'll lead

---

## 🐛 Troubleshooting

### Issue: "API Key Invalid"
- Verify `ANTHROPIC_API_KEY` in `.env.local`
- Check key starts with `sk-ant-api03-`
- Regenerate key at console.anthropic.com

### Issue: Conversation Not Loading
- Check browser console for errors
- Verify API route is accessible: `/api/chat`
- Confirm environment variables are set in Vercel

### Issue: Styling Broken
- Run `npm install` to install Tailwind
- Check `tailwind.config.js` has correct paths
- Clear Next.js cache: `rm -rf .next`

---

## 📞 Support

**Wells Onyx Contact:**
- Email: jonah@wellsonyx.com
- Phone: +1 (850) 456-1961
- Website: wellsonyx.com

**Documentation:**
- Wells AI Core: [Notion Link]
- Brand Guidelines: Wells_Onyx_Brand_Guide-_V1.pdf
- Build Documentation: In Notion

---

## 📝 Next Steps

### Today (Week 1):
1. ✅ Deploy to Vercel
2. ✅ Test both conversation types
3. ✅ Confirm brand styling matches
4. ⏳ Embed on wellsonyx.com (optional)

### This Week (Week 2):
1. Connect Notion databases
2. Build Twilio SMS alerts
3. Test supplier activation
4. Refine conversation prompts

### Next Week (Week 3):
1. Quote collection system
2. Buyer notifications
3. Analytics dashboard
4. Scale testing (100+ RFQs/day)

---

## 🌟 Wells Onyx Philosophy

*"We don't chase unicorns. We build tabernacles."*

Wells AI embodies:
- **Trust:** Every connection begins with honesty
- **Humanity:** Systems that serve people, not replace them
- **Purpose:** Growth that strengthens what matters
- **Endurance:** Built to outlast trends

Like the constellations that guide us, Wells AI is meant to endure.

---

**Built with precision. Powered by trust. Designed for generations.**

*Wells Onyx | Trust + Outcomes*
