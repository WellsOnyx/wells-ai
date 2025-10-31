# 🔑 ENVIRONMENT KEYS - ACTION PLAN

## ✅ What's Already Working

Found in `.vercel/.env.development.local`:
```bash
✅ ANTHROPIC_API_KEY - sk-ant-api03-PQ1RY5V... (verified working)
✅ NOTION_API_KEY - Configured
✅ INSTANTLY_API_KEY - Configured
✅ TWILIO credentials - Configured
✅ STRIPE keys - Configured
```

**Note:** Anthropic key IS configured locally. If it keeps disappearing, it may be:
- Getting overwritten during `vercel env pull`
- Not synced to production Vercel environment
- Issue with local `.env.local` file

---

## ❌ What's Missing (Need to Locate)

### 1. Clerk Authentication Keys
**Status:** Not found in any environment files

**Where to Find:**
- Check email for Clerk signup confirmation
- Go to https://dashboard.clerk.com/apps
- Look for application named "Wells AI" or similar
- Navigate to **API Keys** section
- Copy both keys:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_`)
  - `CLERK_SECRET_KEY` (starts with `sk_`)

**Add to `.env.local`:**
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_live_YOUR_KEY_HERE
```

**Add to Vercel:**
```bash
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
```

---

### 2. Merge.dev API Key
**Status:** Not found in any environment files

**Where to Find:**
- Check email for Merge.dev signup confirmation
- Go to https://app.merge.dev/keys
- Copy your API key

**Add to `.env.local`:**
```bash
MERGE_API_KEY=YOUR_MERGE_API_KEY_HERE
```

**Add to Vercel:**
```bash
vercel env add MERGE_API_KEY production
```

---

## 🏢 SAP/Oracle ERP Integration Gap

**Problem:** Merge.dev does NOT integrate with:
- SAP ERP / S/4HANA
- Oracle ERP Cloud / NetSuite
- Microsoft Dynamics
- Other major enterprise ERPs

**Solution:** Add a second integration platform

### Recommended Tools (Unified API for SAP/Oracle)

#### Option 1: Knit (Best Match - Similar to Merge.dev)
**Website:** https://www.getknit.dev
**Why:**
- Unified ERP API (like Merge.dev but for major ERPs)
- Supports: SAP, Oracle, Microsoft Dynamics, NetSuite
- Single API for multiple ERPs
- Similar architecture to Merge.dev

**Cost:** Unknown (need to request pricing)

#### Option 2: Celigo
**Website:** https://www.celigo.com
**Why:**
- Pre-built connectors for SAP, Oracle, Dynamics
- Visual designer for custom integrations
- Production-ready templates

**Cost:** Enterprise pricing (need quote)

#### Option 3: Workato
**Website:** https://www.workato.com
**Why:**
- 1000+ app integrations including SAP, Oracle
- Enterprise-grade automation
- Strong ERP support

**Cost:** Starts ~$10k-50k/year (enterprise)

#### Option 4: MuleSoft (Most Enterprise)
**Website:** https://www.mulesoft.com/integration/sap
**Why:**
- SAP Certified connector
- Supports Oracle, Workday, Salesforce, ServiceNow
- Industry standard for enterprise integration

**Cost:** ~$50k-500k/year (very expensive)

### Recommendation: **Start with Knit**
- Similar pricing model to Merge.dev (likely)
- Unified API approach (easy to integrate)
- Covers major ERP gap (SAP, Oracle, Dynamics)
- Can always add MuleSoft later for enterprise clients

---

## 🎯 Priority Order

### 1. CRITICAL (Blocking Production)
- [ ] Locate Clerk keys (check email, dashboard)
- [ ] Add Clerk keys to `.env.local`
- [ ] Add Clerk keys to Vercel production
- [ ] Test authentication flows

### 2. HIGH (Blocking Integrations)
- [ ] Locate Merge.dev key (check email, dashboard)
- [ ] Add Merge key to `.env.local`
- [ ] Add Merge key to Vercel production
- [ ] Test ATS/HRIS integrations

### 3. MEDIUM (ERP Gap)
- [ ] Sign up for Knit (or alternative ERP integration platform)
- [ ] Get Knit API key
- [ ] Build Knit integration layer (similar to Merge.dev)
- [ ] Test SAP/Oracle connections

### 4. LOW (Nice to Have)
- [ ] Verify Anthropic key sync between local/Vercel
- [ ] Document why Anthropic key keeps disappearing
- [ ] Add backup key rotation process

---

## 🔧 Quick Fix Commands

### Pull latest from Vercel (might have keys)
```bash
cd /Users/jonahmanning/Downloads/wells-ai-github-ready
vercel env pull
cat .vercel/.env.development.local
```

### Check current Vercel env vars
```bash
vercel env ls
```

### Add missing keys to Vercel
```bash
# Clerk
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production

# Merge.dev
vercel env add MERGE_API_KEY production

# Knit (when ready)
vercel env add KNIT_API_KEY production
```

### Test locally after adding keys
```bash
npm run dev
# Visit http://localhost:3000
# Try signing in/up
# Try triggering an integration
```

---

## 📊 Integration Strategy

### Current Architecture
```
Wells AI
├── Merge.dev (ATS, HRIS, Accounting, CRM, File Storage, Ticketing, Marketing)
│   └── 220+ integrations
│   └── ❌ MISSING: SAP, Oracle, Dynamics (major ERPs)
└── Knit (SAP, Oracle, Microsoft Dynamics)
    └── Major ERP systems
    └── ✅ COVERS: Enterprise ERP gap
```

### After Adding Knit
```typescript
// Example unified integration
import { merge } from '@/lib/merge-client'
import { knit } from '@/lib/knit-client' // NEW

// Small/medium businesses (Merge.dev)
const hrisData = await merge.hris.getEmployees()

// Enterprise clients (Knit)
const sapData = await knit.erp.getEmployees() // SAP/Oracle
```

---

## 💰 Cost Estimate

**Current Monthly Cost:**
- Merge.dev: ~$200-500/month (estimated)
- Clerk: ~$25-100/month (based on MAU)
- Anthropic: Pay-as-you-go (~$50-500/month based on usage)
- Stripe: 2.9% + $0.30 per transaction

**Adding Knit:**
- Estimated: ~$200-500/month (similar to Merge.dev)
- **Total:** ~$475-1,100/month for all integrations

**ROI:**
- One $1M deal at 0.33% = $3,300 revenue
- Covers 3-7 months of integration costs
- **Payback:** < 1 enterprise deal

---

## ✅ Next Steps

1. **Immediate:** Check email for Clerk/Merge signup confirmations
2. **Today:** Add Clerk keys to enable authentication
3. **This Week:** Add Merge.dev keys to enable integrations
4. **Next Week:** Research and sign up for Knit (or alternative)
5. **Then:** Proceed with marketing page build (auth will be working)

---

## 🔐 Security Reminders

- **NEVER commit** `.env.local` to git (it's in `.gitignore`)
- Use **different keys** for development/production
- Rotate keys if ever exposed
- Store production keys ONLY in Vercel (not locally)
- Use Vercel's encrypted storage for sensitive vars

---

## 📧 Action Items for You

- [ ] Check email for Clerk signup confirmation
- [ ] Check email for Merge.dev signup confirmation
- [ ] Login to https://dashboard.clerk.com and find keys
- [ ] Login to https://app.merge.dev/keys and find key
- [ ] Let me know once you have the keys, I'll add them
- [ ] Consider signing up for Knit for SAP/Oracle support
