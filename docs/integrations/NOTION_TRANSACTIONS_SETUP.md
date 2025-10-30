# Wells AI - Notion Transactions Database Setup

## Week 3: Quote System & First Transactions

This database tracks all completed deals, payments, and revenue. It's the core of Wells AI's transaction tracking and financial reporting.

---

## Database: Transactions

### Properties

| Property Name | Type | Configuration | Description |
|--------------|------|---------------|-------------|
| **Buyer Company** | Title | - | Company purchasing the product/service |
| **Seller Company** | Text | - | Supplier providing the product/service |
| **Product Name** | Text | - | Name of product/service being purchased |
| **Category** | Select | Semiconductors, Executive Search, Software, Industrial Equipment, etc. | Product/service category |
| **Deal Value** | Number | Currency (USD) | Total transaction value (what buyer pays supplier) |
| **Wells AI Fee** | Number | Currency (USD) | Platform fee (33bps = 0.33% of deal value) |
| **Tithe Amount** | Number | Currency (USD) | 10% of gross receipts → Adullam Sanctuaries |
| **Status** | Select | Pending Payment, Payment Processing, Completed, Failed | Transaction status |
| **Close Date** | Date | - | Date deal was closed |
| **RFQ ID** | Text | - | Reference to original RFQ (from Requests database) |
| **Quote ID** | Text | - | Reference to accepted quote |
| **Payment Intent ID** | Text | - | Stripe payment intent ID |
| **Payment Method** | Select | Credit Card, ACH, Wire Transfer | How payment was processed |
| **Buyer Contact** | Text | - | Buyer's primary contact name |
| **Buyer Email** | Email | - | Buyer's email for receipts |
| **Seller Contact** | Text | - | Seller's primary contact name |
| **Seller Email** | Email | - | Seller's email for payment notifications |
| **Created** | Created Time | - | Record creation timestamp |
| **Last Updated** | Last Edited Time | - | Last modification timestamp |

### Select Options

**Status:**
- 🟡 Pending Payment
- 🔵 Payment Processing
- ✅ Completed
- ❌ Failed

**Category:** (Same as RFQs database)
- Semiconductors
- Executive Search
- Software & Cloud Services
- Industrial Equipment
- Raw Materials
- Professional Services
- Marketing & Advertising
- Real Estate
- Logistics & Freight
- Other

**Payment Method:**
- 💳 Credit Card
- 🏦 ACH Transfer
- 💸 Wire Transfer

---

## Formulas

### Total Revenue (Wells AI)
```
prop("Wells AI Fee")
```

### Gross Transaction Volume
```
prop("Deal Value")
```

### Revenue Per Transaction
```
prop("Wells AI Fee") / prop("Deal Value")
```
*Should always be ~0.0033 (33 basis points)*

### Tithe Percentage Check
```
prop("Tithe Amount") / prop("Deal Value")
```
*Should always be 0.10 (10%)*

---

## Views to Create

### 1. All Transactions (Default)
- Filter: None
- Sort: Close Date (Descending)
- Show: All properties

### 2. Completed Deals
- Filter: Status = ✅ Completed
- Sort: Close Date (Descending)
- Group by: Category
- Sum: Deal Value, Wells AI Fee, Tithe Amount

### 3. Pending Payment
- Filter: Status = 🟡 Pending Payment OR 🔵 Payment Processing
- Sort: Created (Ascending - oldest first)
- Show: Buyer Company, Deal Value, Status, Close Date

### 4. Failed Transactions
- Filter: Status = ❌ Failed
- Sort: Last Updated (Descending)
- Show: All properties for debugging

### 5. This Month
- Filter: Close Date is within "This month"
- Sort: Close Date (Descending)
- Sum: Deal Value, Wells AI Fee, Tithe Amount

### 6. YTD Revenue
- Filter: Close Date is within "This year"
- Group by: Status
- Sum: Wells AI Fee
- Chart: Timeline or Bar

### 7. By Category
- Filter: Status = ✅ Completed
- Group by: Category
- Sort: Deal Value (Descending - high to low)
- Sum: Deal Value, Wells AI Fee

### 8. Tithe Tracking
- Filter: Status = ✅ Completed
- Sort: Close Date (Descending)
- Show: Buyer Company, Deal Value, Tithe Amount, Close Date
- Sum: Tithe Amount
- Purpose: Track contributions to Adullam Sanctuaries

---

## Environment Variables

Add to `.env.local`:

```bash
NOTION_TRANSACTIONS_DB=<your-database-id>
```

To get database ID:
1. Open database in Notion
2. Copy URL: `https://notion.so/workspace/DATABASE_ID?v=...`
3. Extract the 32-character ID (no hyphens)

Example:
```
https://notion.so/abc123def456/2c9751c549794daabeb2a511a00af570?v=...
                             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                             This is your database ID
```

---

## Integration with Stripe

### Webhook Events to Handle

1. **payment_intent.succeeded**
   - Update deal status to "Completed"
   - Store payment intent ID
   - Send confirmation emails to buyer & seller
   - Trigger supplier notification

2. **payment_intent.payment_failed**
   - Update deal status to "Failed"
   - Send failure notification to buyer
   - Optionally retry or offer alternative payment method

3. **payment_intent.processing**
   - Update deal status to "Payment Processing"
   - No action needed (waiting for bank confirmation)

### Stripe Metadata to Include

Every payment intent should include:
```javascript
{
  rfqId: 'notion-page-id',
  quoteId: 'quote-id',
  wellsAIFee: '330', // in cents
  tithe: '10000', // in cents
  platform: 'Wells AI'
}
```

---

## Financial Reporting

### Monthly Summary (Auto-calculated from views)

```
Total Transaction Volume: $X.XXM
Wells AI Revenue: $X,XXX (33bps)
Tithe Contributed: $XXX,XXX (10%)
Number of Deals: XX
Average Deal Size: $XXX,XXX
Conversion Rate: XX% (from RFQs)
```

### Revenue Breakdown
- Platform fees (33bps) → Wells AI operating revenue
- Tithe (10%) → Adullam Sanctuaries (first fruits)
- Remaining 89.67% → Supplier payments

Example on $1M deal:
- Buyer pays: $1,003,300 ($1M + $3,300 Wells AI fee)
- Wells AI receives: $3,300 (0.33%)
- Tithe to Adullam: $100,330 (10% of $1,003,300 gross)
- Supplier receives: $1,000,000 (net)

---

## Testing the Flow

### 1. Create Test RFQ
```
Company: Test Corp
Product: Custom semiconductors
Quantity: 1,000 units
Target Price: $100,000
```

### 2. Generate Mock Quotes
```
Supplier A: $95,000, 6 weeks
Supplier B: $98,000, 4 weeks
Supplier C: $92,000, 8 weeks
```

### 3. Accept Quote & Calculate Fees
```
Deal Value: $95,000
Wells AI Fee: $95,000 × 0.0033 = $313.50
Tithe: $95,313.50 × 0.10 = $9,531.35
Total Buyer Pays: $95,313.50
```

### 4. Process Payment (Test Mode)
```
Stripe Test Card: 4242 4242 4242 4242
Expiry: 12/25
CVC: 123
ZIP: 12345
```

### 5. Verify in Notion
- Transaction record created
- Status = "Completed"
- All fees calculated correctly
- Payment intent ID stored

---

## Compliance & Audit Trail

### Data Retention
- Keep all transaction records indefinitely
- Never delete completed transactions
- Failed transactions: Keep for 7 years (IRS requirement)

### Audit Fields (Already included)
- Created timestamp (auto)
- Last Updated timestamp (auto)
- Payment Intent ID (Stripe reference)
- All amounts stored in cents precision

### Tax Reporting
- 1099-K for sellers (if > $600/year)
- Annual revenue summary for Wells AI
- Tithe documentation for Adullam Sanctuaries (501c3)

---

## Next Steps

1. ✅ Create Notion database with schema above
2. ✅ Add database ID to Vercel environment variables
3. ✅ Test transaction flow end-to-end
4. ⏭️ Set up Stripe webhook endpoint
5. ⏭️ Configure Stripe webhook events
6. ⏭️ Build email notification system
7. ⏭️ Create financial reporting dashboard

---

## Week 3 Success Metrics

- Process 10 real RFQs
- Complete 2-3 paid transactions
- Collect first revenue ($100K+ in transaction value)
- $330+ in Wells AI fees collected
- 33bps fee calculation verified accurate
- Tithe tracking operational

---

**Status:** Backend complete, Notion schema ready, Payment flow built

**Next Build:** Stripe webhook handler + Email notifications

**Goal:** Process first $100K in transaction volume this week

---

*Last Updated: October 29, 2025*
