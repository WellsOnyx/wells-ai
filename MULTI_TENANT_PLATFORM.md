# Wells AI - Multi-Tenant Platform Model

**Vision:** Any supplier can register with Wells and get their own version of opportunity tracking across their partners.

---

## **What Changed**

### **Before (Single-Tenant)**
- Wells Onyx tracks opportunities from 66 partners
- Tool built for Wells only
- Revenue model: Wells earns 33 bps on own deals

### **After (Multi-Tenant Platform)**
- **ANY supplier** can register and track opportunities
- Platform serves unlimited suppliers (tenants)
- Revenue model: Wells earns 33 bps on **every supplier's deals**

---

## **Example Suppliers (Tenants)**

### **Supplier 1: Circuit Board Manufacturer**
- **Company**: Acme Electronics
- **Partners**: 5 distributors (Arrow, Avnet, Digi-Key, Mouser, Newark)
- **Value**: Tracks distributor opportunities, auto-pairs with Wells procurement services
- **Wells Revenue**: 33 bps on every deal Acme closes through tracked opportunities

### **Supplier 2: Software Consulting Firm**
- **Company**: DevOps Solutions Inc.
- **Partners**: AWS, Salesforce, ServiceNow, Microsoft
- **Value**: Tracks co-sell opportunities from tech partners
- **Wells Revenue**: 33 bps + exec search fees (VP Engineering, CTO placements)

### **Supplier 3: Staffing Agency**
- **Company**: TalentPro Staffing
- **Partners**: 10 enterprise clients (F500 companies)
- **Value**: Tracks headcount opportunities from corporate partners
- **Wells Revenue**: 33 bps on every placement

---

## **Platform Architecture**

### **Supplier Entity**
```typescript
interface Supplier {
  id: string                      // 'supplier_acme_corp'
  companyName: string
  industry: string
  contactName: string
  contactEmail: string

  // Platform configuration
  platformPlan: 'free' | 'pro' | 'enterprise'
  monthlyFee: number              // $0 (free), $X (pro/enterprise)
  successFeeRate: number          // 0.0033 (33 bps)

  // Partners this supplier tracks
  connectedPartners: string[]     // ['ibm', 'aws', 'cisco', ...]

  // Stats
  totalOpportunities: number
  totalRevenue: number            // Total deal value closed
  platformFeesOwed: number        // Wells revenue from this supplier
}
```

### **Opportunity Entity (Multi-Tenant)**
```typescript
interface Opportunity {
  id: string
  supplierId: string              // Which tenant owns this opportunity
  partnerId: string               // Which partner sent it

  // ... rest of unified schema
}
```

---

## **Revenue Model Options**

### **Option A: Pure Success Fee (Recommended)**
- **Supplier pays**: $0 monthly
- **Wells earns**: 33 bps on every deal closed
- **Example**: Supplier closes $10M deal → Wells earns $33K

**Pros:**
- Zero friction onboarding
- Aligned incentives (Wells wins when supplier wins)
- Scales infinitely

**Cons:**
- No recurring revenue until deals close
- Suppliers could track deals manually (no lock-in)

### **Option B: SaaS + Success Fee**
- **Supplier pays**: $99-999/month (based on partner count)
- **Wells earns**: $X/month + 33 bps on deals
- **Example**: $500/month + $33K on $10M deal

**Pros:**
- Recurring revenue even without deals
- More predictable cash flow
- Higher LTV

**Cons:**
- Harder to sell (upfront commitment)
- Reduces viral growth

### **Option C: Freemium**
- **Free**: Track up to 3 partners, 25 opportunities/month
- **Pro ($299/mo)**: Unlimited partners, unlimited opportunities, API access
- **Enterprise ($999/mo)**: White-label, dedicated support, custom integrations

**Pros:**
- Viral bottom-up adoption
- Clear upgrade path
- Appeals to small + large suppliers

---

## **Technical Implementation**

### **Supplier Registration Flow**

1. **Sign Up** → `/api/suppliers/register`
   ```typescript
   POST /api/suppliers/register
   {
     "companyName": "Acme Electronics",
     "contactEmail": "john@acme.com",
     "industry": "Electronics Manufacturing"
   }
   // Returns: supplierId, API key
   ```

2. **Connect Partners** → `/api/suppliers/{id}/partners/connect`
   ```typescript
   POST /api/suppliers/supplier_acme/partners/connect
   {
     "partnerId": "arrow",
     "credentials": {...}  // Partner portal login
   }
   ```

3. **Sync Opportunities** → Automatic daily sync
   ```typescript
   // Wells AI polls partner portals
   // Normalizes opportunities to unified schema
   // Assigns to supplierId: 'supplier_acme'
   ```

4. **Track Closes** → `/api/opportunities/{id}/close`
   ```typescript
   POST /api/opportunities/opp_123/close
   {
     "closedValue": 1000000,  // $1M deal
     "closedDate": "2025-11-01"
   }
   // Calculate platform fee: $1M * 0.0033 = $3,300
   // Add to supplier.platformFeesOwed
   ```

---

## **Multi-Tenant Data Isolation**

### **Database Schema**
```sql
-- Suppliers table
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  company_name TEXT,
  platform_plan TEXT,
  success_fee_rate REAL DEFAULT 0.0033,
  created_at TIMESTAMP
);

-- Opportunities table (multi-tenant)
CREATE TABLE opportunities (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id),  -- Tenant isolation
  partner_id TEXT,
  company_name TEXT,
  estimated_value REAL,
  stage TEXT,
  ...
);

-- Every query MUST filter by supplier_id
SELECT * FROM opportunities
WHERE supplier_id = 'supplier_acme';
```

### **API Security**
```typescript
// Every API call requires supplier API key
headers: {
  'Authorization': 'Bearer supplier_acme_key_...'
}

// Middleware extracts supplierId from API key
// All queries auto-filtered by supplierId
```

---

## **Use Cases**

### **Use Case 1: Circuit Board Manufacturer**
**Supplier**: Acme Electronics
**Partners**: Arrow, Avnet, Digi-Key (distributors)

**Flow**:
1. Arrow emails Acme: "Customer needs 10K circuit boards, $500K quote"
2. Arrow also posts opportunity in partner portal
3. Wells AI syncs Arrow portal → Parses opportunity → Assigns to `supplier_acme`
4. Acme sees opportunity in Wells dashboard
5. Acme quotes, wins deal at $500K
6. Acme marks deal closed in Wells
7. **Wells earns**: $500K * 0.0033 = $1,650

**Acme's benefit**: No more missed opportunities from distributor portals

---

### **Use Case 2: Software Consultancy**
**Supplier**: DevOps Solutions Inc.
**Partners**: AWS, Salesforce, ServiceNow

**Flow**:
1. AWS partner manager: "Customer migrating to AWS, need DevOps consulting"
2. AWS posts co-sell opportunity in partner portal
3. Wells AI syncs AWS portal → Parses → Assigns to `supplier_devops`
4. DevOps sees opportunity, pairs with **Wells exec search** (hire VP Engineering for customer)
5. DevOps wins $2M AWS consulting deal
6. Wells places VP Engineering for $150K fee
7. **Wells earns**: ($2M * 0.0033) + $150K = **$156,600**

**DevOps' benefit**: Never miss AWS co-sell opps + get exec search support

---

## **Growth Strategy**

### **Phase 1: Wells Onyx as Anchor Tenant (Current)**
- Wells Onyx = first supplier on platform
- Track 66 partners (IBM, Cisco, AWS, etc.)
- Validate product works

### **Phase 2: Invite 10 Pilot Suppliers**
- Circuit board manufacturers
- Software consultancies
- Staffing agencies
- **Goal**: Prove multi-tenant works

### **Phase 3: Viral Bottom-Up Growth**
- Public sign-up page
- Freemium tier (3 partners free)
- Partner marketplace (suppliers discover new partners)

### **Phase 4: White-Label Enterprise**
- Large enterprises license platform
- Track opportunities across their ecosystem
- **Example**: GE tracks opportunities across 500 suppliers

---

## **Revenue Projection**

### **Year 1: 100 Suppliers**
- Average supplier closes $5M/year in tracked deals
- Wells earns: $5M * 0.0033 * 100 = **$1.65M/year**

### **Year 3: 1,000 Suppliers**
- Average supplier closes $5M/year
- Wells earns: $5M * 0.0033 * 1,000 = **$16.5M/year**

### **Year 5: 10,000 Suppliers**
- Average supplier closes $5M/year
- Wells earns: $5M * 0.0033 * 10,000 = **$165M/year**

**Note**: This assumes only success fees (33 bps). With SaaS fees ($300/mo avg), add $36M-360M/year recurring revenue.

---

## **Next Steps**

### **To Enable Multi-Tenant** (1 week)
1. Build supplier registration API
2. Add supplier authentication (API keys)
3. Update all queries to filter by supplierId
4. Build supplier dashboard (view their opportunities)
5. Test with 2-3 pilot suppliers

### **To Scale** (1 month)
1. Build partner connector marketplace
2. Add billing system (Stripe integration)
3. Build admin panel (Wells views all suppliers)
4. Add analytics (revenue tracking, supplier health metrics)

---

## **Why This Is Massive**

**Before**: Wells Onyx is a company that tracks partners (single business)

**After**: Wells AI is a **PLATFORM** that powers partner ecosystems for thousands of companies (platform business)

**Analogy:**
- **Before**: Salesforce for Wells Onyx
- **After**: Salesforce **IS** the CRM platform (multi-tenant)

**Market Size:**
- **Global TAM: $33 TRILLION** in partner-driven commerce
- 30M+ businesses in US alone
- 300M+ businesses globally
- Every business with 2+ partners is a potential customer
- Partner ecosystem is the entire B2B economy

**What capturing tiny fractions means:**

| Market Share | Deal Volume Tracked | Wells Revenue (33 bps) |
|--------------|---------------------|------------------------|
| 0.01% | $3.3B | $10.9M/year |
| 0.1% | $33B | $109M/year |
| 1% | $330B | $1.09B/year |
| 5% | $1.65T | $5.4B/year |
| 10% | $3.3T | $10.9B/year |

**To put in perspective:**
- Salesforce: $31B market cap
- ServiceNow: $150B market cap
- If Wells captures just 0.1% of partner economy → $109M/year revenue
- At 10x revenue multiple → $1B+ valuation

---

**This is the pivot from tool → platform. One supplier (Wells Onyx) becomes 10,000+ suppliers globally.**
