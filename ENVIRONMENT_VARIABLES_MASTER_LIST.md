# Wells AI - Environment Variables Master List

This is the DEFINITIVE list of environment variables for Wells AI. Use this to clean up your Vercel setup.

## ✅ REQUIRED (App Won't Work Without These)

### 1. **ANTHROPIC_API_KEY**
- **What it does:** Powers the main chat interface (Claude AI)
- **Where to get it:** https://console.anthropic.com/settings/keys
- **Format:** `sk-ant-api03-...` (starts with this prefix)
- **Set in:** Production, Preview, Development
- **Critical:** YES - Chat completely broken without this

### 2. **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY**
- **What it does:** Client-side authentication (Clerk)
- **Where to get it:** https://dashboard.clerk.com/apps/[your-app]/api-keys
- **Format:** `pk_test_...` or `pk_live_...`
- **Set in:** Production, Preview, Development
- **Critical:** YES - Users can't sign in without this

### 3. **CLERK_SECRET_KEY**
- **What it does:** Server-side authentication (Clerk)
- **Where to get it:** https://dashboard.clerk.com/apps/[your-app]/api-keys
- **Format:** `sk_test_...` or `sk_live_...`
- **Set in:** Production, Preview, Development
- **Critical:** YES - Server auth broken without this

### 4. **NEXT_PUBLIC_CLERK_SIGN_IN_URL**
- **What it does:** Where to redirect for sign in
- **Value:** `/sign-in`
- **Set in:** Production, Preview, Development
- **Critical:** YES - Sign in flow broken without this

### 5. **NEXT_PUBLIC_CLERK_SIGN_UP_URL**
- **What it does:** Where to redirect for sign up
- **Value:** `/sign-up`
- **Set in:** Production, Preview, Development
- **Critical:** YES - Sign up flow broken without this

---

## ⚠️ HIGHLY RECOMMENDED (Features Don't Work Without These)

### 6. **NOTION_API_KEY**
- **What it does:** Database for deals, RFQs, suppliers, partnerships, HR data
- **Where to get it:** https://www.notion.so/my-integrations
- **Format:** `secret_...` (starts with this prefix)
- **Set in:** Production, Preview, Development
- **Without it:** All data features broken (deals, RFQs, suppliers, etc.)

### 7. **NOTION_DEALS_DATABASE_ID**
- **What it does:** Stores all deals
- **Where to get it:** From your Notion workspace (32-character hex string)
- **Format:** `abc123def456...` (32 characters, no dashes)
- **Set in:** Production, Preview, Development
- **Without it:** Deal tracking broken

### 8. **NOTION_RFQS_DATABASE_ID**
- **What it does:** Stores all RFQs (Request for Quotes)
- **Where to get it:** From your Notion workspace
- **Format:** `abc123def456...` (32 characters, no dashes)
- **Set in:** Production, Preview, Development
- **Without it:** RFQ system broken

### 9. **NOTION_SUPPLIERS_DATABASE_ID**
- **What it does:** Stores supplier database
- **Where to get it:** From your Notion workspace
- **Format:** `abc123def456...` (32 characters, no dashes)
- **Set in:** Production, Preview, Development
- **Without it:** Supplier matching broken

---

## 📱 OPTIONAL - SMS/Communication (Graceful Fallback)

### 10. **TWILIO_ACCOUNT_SID**
- **What it does:** Send SMS notifications
- **Where to get it:** https://console.twilio.com
- **Format:** `AC...` (starts with AC)
- **Set in:** Production only
- **Without it:** SMS features disabled, app still works

### 11. **TWILIO_AUTH_TOKEN**
- **What it does:** Authenticate with Twilio
- **Where to get it:** https://console.twilio.com
- **Format:** Random string
- **Set in:** Production only
- **Without it:** SMS features disabled, app still works

### 12. **TWILIO_PHONE_NUMBER**
- **What it does:** Send SMS from this number
- **Where to get it:** https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
- **Format:** `+1...` (E.164 format)
- **Set in:** Production only
- **Without it:** SMS features disabled, app still works

---

## 🔌 OPTIONAL - Integrations (For Advanced Features)

### 13. **MERGE_API_KEY**
- **What it does:** ERP integrations (SAP, NetSuite, Oracle, etc.)
- **Where to get it:** https://app.merge.dev/keys
- **Format:** Looks like a JWT token
- **Set in:** Production, Preview, Development
- **Without it:** ERP audit and sync features disabled

### 14. **OPENAI_API_KEY**
- **What it does:** Currently UNUSED (we use Claude, not OpenAI)
- **Action:** DELETE THIS - Not needed
- **Status:** Legacy/unused

---

## 🗄️ OPTIONAL - Notion Databases (Additional Features)

### 15. **NOTION_PARTNERSHIPS_DATABASE_ID**
- **What it does:** Partnership tracking
- **Set in:** Production, Preview, Development
- **Without it:** Partnership features disabled

### 16. **NOTION_AUDIT_REPORTS_DATABASE_ID**
- **What it does:** Store ERP audit reports
- **Set in:** Production, Preview, Development
- **Without it:** Audit reports not saved (still generated)

### 17. **NOTION_GTM_DATABASE_ID**
- **What it does:** Go-to-market campaign tracking
- **Set in:** Production, Preview, Development
- **Without it:** GTM automation disabled

### 18. **NOTION_HR_DATABASE_ID**
- **What it does:** HR and hiring pipeline
- **Set in:** Production, Preview, Development
- **Without it:** HR features disabled

### 19. **NOTION_PUSH_TOKENS_DATABASE_ID**
- **What it does:** Store iOS push notification tokens
- **Set in:** Production only
- **Without it:** Push notifications won't be saved (iOS app still works)

---

## 🎯 What You Should Do RIGHT NOW

### Step 1: Delete These (If They Exist)
- ❌ `OPENAI_API_KEY` - Not used, we use Claude
- ❌ Any duplicate keys (same name twice)
- ❌ Any keys with `_BACKUP` or `_OLD` suffixes

### Step 2: Verify These Are Set Correctly
Go to https://vercel.com/wellsonyxs-projects/wellsai/settings/environment-variables

**Check ALL THREE checkboxes for each:**
- ✅ Production
- ✅ Preview
- ✅ Development

**For these CRITICAL keys:**
1. `ANTHROPIC_API_KEY` - Starts with `sk-ant-api03-`
2. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Starts with `pk_`
3. `CLERK_SECRET_KEY` - Starts with `sk_`
4. `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
5. `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`

**For these RECOMMENDED keys:**
6. `NOTION_API_KEY` - Starts with `secret_`
7. `NOTION_DEALS_DATABASE_ID` - 32 characters, no dashes
8. `NOTION_RFQS_DATABASE_ID` - 32 characters, no dashes
9. `NOTION_SUPPLIERS_DATABASE_ID` - 32 characters, no dashes

### Step 3: Clean Up Notion Database IDs
Notion database IDs should be 32 characters with NO dashes.

**Wrong format:**
```
12345678-1234-1234-1234-123456789abc
```

**Correct format:**
```
12345678123412341234123456789abc
```

To get the ID from a Notion database URL:
```
https://notion.so/workspace/DATABASE_ID?v=view_id
                             ^^^^^^^^
                             This part
```

Remove all dashes when setting in Vercel.

### Step 4: Redeploy After Changes
```bash
vercel --prod
```

---

## 🧪 How to Test Everything Works

### 1. Test Chat (Most Critical)
```bash
curl https://wellsai.vercel.app/api/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

Should return: Claude's response (not an error)

### 2. Test Authentication
1. Go to https://wellsai.vercel.app
2. Click "Sign In"
3. Should redirect to Clerk sign-in page
4. Sign in should work

### 3. Test Notion Integration
1. Sign in to the app
2. Try creating a deal or RFQ
3. Should save without errors

---

## 🚨 If Chat Is STILL Broken

Check the exact error in Vercel logs:
```bash
vercel logs wellsai --prod
```

Look for:
- `[CHAT] ANTHROPIC_API_KEY not configured` → Key is missing
- `[CHAT] Anthropic API error` → Key is invalid
- Other errors → Different problem

---

## 📋 Quick Checklist

Copy this and check off as you verify:

```
CRITICAL (app broken without these):
[ ] ANTHROPIC_API_KEY - Set in all 3 environments
[ ] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY - Set in all 3 environments
[ ] CLERK_SECRET_KEY - Set in all 3 environments
[ ] NEXT_PUBLIC_CLERK_SIGN_IN_URL = /sign-in
[ ] NEXT_PUBLIC_CLERK_SIGN_UP_URL = /sign-up

RECOMMENDED (features broken without these):
[ ] NOTION_API_KEY - Set in all 3 environments
[ ] NOTION_DEALS_DATABASE_ID - Set in all 3 environments
[ ] NOTION_RFQS_DATABASE_ID - Set in all 3 environments
[ ] NOTION_SUPPLIERS_DATABASE_ID - Set in all 3 environments

OPTIONAL (nice to have):
[ ] TWILIO_ACCOUNT_SID - Production only
[ ] TWILIO_AUTH_TOKEN - Production only
[ ] TWILIO_PHONE_NUMBER - Production only
[ ] MERGE_API_KEY - All 3 environments (for ERP features)

CLEANUP:
[ ] Deleted OPENAI_API_KEY (not used)
[ ] Deleted any duplicate keys
[ ] All Notion IDs have NO dashes (32 chars only)
[ ] All keys checked for all 3 environments (Prod, Preview, Dev)
```

---

## ⏱️ Total Time to Fix: 10 Minutes

1. Delete unused/duplicate keys (2 min)
2. Verify ANTHROPIC_API_KEY is set (1 min)
3. Verify Clerk keys are set (1 min)
4. Verify Notion keys are set (3 min)
5. Redeploy (2 min)
6. Test chat (1 min)

Then chat will work perfectly and we can move on to shipping the iOS app.
