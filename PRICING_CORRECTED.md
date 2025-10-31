# ✅ PRICING MODEL - CORRECTED

## 🎯 The Confusion (What I Got Wrong)

I initially thought Jonathan wanted to make the ENTIRE system free. That was wrong.

## ✅ The Correct Model (Two Separate Things)

### 1. Transaction Fees (UNCHANGED - Keep Dynamic Pricing)
**This is how Wells AI makes money on EVERY deal:**

- Bronze (0-$100K GMV): 10% transaction fee
- Silver ($100K-$250K GMV): 5% transaction fee
- Gold ($250K-$1M GMV): 2% transaction fee
- Platinum ($1M+ GMV): 1% transaction fee

**With Stripe Guardrails:**
- ALWAYS charge minimum of Stripe fee (2.9% + $0.30) + our profit (0.6%)
- Minimum total: 3.5% on all transactions
- We NEVER lose money on any transaction

**File**: `lib/gtm/transaction-fees.ts` ✅ Created

---

### 2. GTM Stack Subscription (CHANGED - Jonathan's Feedback)

**What Changed**: The $79/month fee for users who don't have their own CRM (Notion + Apollo + Instantly stack)

**OLD Behavior**:
- User has no CRM → Pay $79/month immediately
- Hit $250K GMV → FREE

**NEW Behavior** (Jonathan: "reduce friction"):
- User has no CRM + GMV < $100K → **FREE** (no friction!)
- User has no CRM + GMV $100K-$250K → **$79/month** (can afford it now)
- User has no CRM + GMV $250K+ → **FREE** (we make enough on transaction fees)

**The Tiers Now**:
- **Bronze** ($0-$100K GMV): GTM stack **FREE** (was $79)
- **Silver** ($100K-$250K GMV): GTM stack **$79/month** (was $39)
- **Gold** ($250K-$1M GMV): GTM stack **FREE**
- **Platinum** ($1M+ GMV): GTM stack **FREE**

**File**: `lib/gtm/subscription-tiers.ts` ✅ Fixed

---

## 💰 Complete Pricing Breakdown

### Example: User doing $150K GMV/year

**GTM Stack Subscription**:
- Tier: Silver ($100K-$250K GMV)
- Monthly cost: **$79/month**
- Annual cost: **$948/year**

**Transaction Fees** (on every deal):
- Base rate: 5% (Silver tier)
- Stripe guardrail: Ensures minimum 3.5%
- Example deal: $10,000 → Fee: $500 (5%)
  - Stripe keeps: $290 + $0.30 = $290.30
  - Wells AI keeps: $209.70

**Total Revenue to Wells AI**:
- Subscription: $948/year
- Transaction fees: $7,500 (assuming $150K GMV × 5%)
- **Total: $8,448/year**

---

## 🎯 Key Benefits

### For New Users (< $100K GMV):
- **Zero friction** → Free GTM stack
- **Zero risk** → Try before you pay
- **Build dependency** → They love the system
- **Start transacting** → We make money on deals (10%)

### For Growing Users ($100K-$250K GMV):
- Pay $79/month → Easily affordable at this revenue level
- Still getting value from GTM stack
- Transaction fees drop to 5%
- Win-win relationship

### For Established Users ($250K+ GMV):
- GTM stack FREE again
- Transaction fees 1-2%
- We make plenty on volume
- Premium white-glove service

---

## ✅ What's Fixed

1. ✅ **Transaction fees** - Dynamic pricing with Stripe guardrails
2. ✅ **GTM stack subscription** - FREE until $100K GMV
3. ✅ **Stripe protection** - Never lose money on transactions
4. ✅ **Clear separation** - Two distinct revenue streams

## 📂 Files Modified

1. `lib/gtm/subscription-tiers.ts` - Restored + Updated with $100K threshold
2. `lib/gtm/transaction-fees.ts` - NEW file with Stripe guardrails
3. `PRICING_CORRECTED.md` - This summary

## 🚀 Next: Enterprise Marketing Page

Now building the stunning landing page to showcase this model!
