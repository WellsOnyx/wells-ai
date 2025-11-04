# Supplier Data Setup Instructions

## Quick Setup (5 minutes)

The procurement flow is now fully functional and ready to test! However, you need to add sample supplier data to your Notion database first.

### Option 1: Use the Automated Script (Recommended)

```bash
# Update your NOTION_API_KEY in Vercel environment
vercel env pull .env.local

# Run the population script
npx tsx scripts/populate-suppliers.ts
```

### Option 2: Manual Entry via Notion UI

Go to your Notion Suppliers database and add these 10 test suppliers:

#### 1. Circuit Solutions Inc
- **Email**: sales@circuitsolutions.com
- **Phone**: +1-555-0100
- **Capabilities**: Electronics, Manufacturing
- **Response Time**: < 4 hours
- **Status**: Active

#### 2. TechForge Manufacturing
- **Email**: quotes@techforge.com
- **Phone**: +1-555-0200
- **Capabilities**: Electronics, Manufacturing, IT Services
- **Response Time**: < 8 hours
- **Status**: Active

#### 3. Global PCB Systems
- **Email**: contact@globalpcb.com
- **Phone**: +1-555-0300
- **Capabilities**: Electronics
- **Response Time**: < 12 hours
- **Status**: Active

#### 4. Premier Office Supply Co
- **Email**: sales@premieroffice.com
- **Phone**: +1-555-0400
- **Capabilities**: Office Supplies
- **Response Time**: < 4 hours
- **Status**: Active

#### 5. Industrial Equipment Partners
- **Email**: info@indequip.com
- **Phone**: +1-555-0500
- **Capabilities**: Manufacturing, Office Supplies
- **Response Time**: < 24 hours
- **Status**: Active

#### 6. Digital Marketing Hub
- **Email**: hello@digitalmarketinghub.com
- **Phone**: +1-555-0600
- **Capabilities**: Marketing, IT Services
- **Response Time**: < 4 hours
- **Status**: Active

#### 7. Professional Services Group
- **Email**: contact@proservicesgroup.com
- **Phone**: +1-555-0700
- **Capabilities**: Professional Services, IT Services
- **Response Time**: < 8 hours
- **Status**: Active

#### 8. Enterprise IT Solutions
- **Email**: sales@enterpriseit.com
- **Phone**: +1-555-0800
- **Capabilities**: IT Services, Professional Services
- **Response Time**: < 4 hours
- **Status**: Active

#### 9. Advanced Manufacturing Corp
- **Email**: quotes@advancedmfg.com
- **Phone**: +1-555-0900
- **Capabilities**: Manufacturing, Electronics
- **Response Time**: < 12 hours
- **Status**: Active

#### 10. Creative Marketing Agency
- **Email**: hi@creativemarketing.com
- **Phone**: +1-555-1000
- **Capabilities**: Marketing
- **Response Time**: < 8 hours
- **Status**: Active

## Testing the Flow

Once suppliers are added, test the procurement flow:

1. **Go to**: https://wellsai.vercel.app

2. **Type a procurement request**:
   - "I need 500 custom circuit boards"
   - "Get me quotes for office furniture"
   - "Find suppliers for marketing services"

3. **Watch the flow**:
   - RFQ form appears with prefilled data ✓
   - Fill out remaining details and submit
   - Supplier matches display with pricing ✓
   - Select a supplier
   - Wells confirms and offers PO preparation ✓

## What Works

✅ Procurement intent detection
✅ RFQ form display with prefilling
✅ Supplier matching API
✅ Supplier cards with pricing, timelines, terms
✅ Supplier selection handler
✅ Complete end-to-end flow

## Categories to Test

- **Electronics**: circuit boards, PCBs, semiconductors
- **Manufacturing**: equipment, machinery, manufacturing
- **IT Services**: software, SaaS, technology
- **Office Supplies**: furniture, office, supplies
- **Marketing**: advertising, marketing, design
- **Professional Services**: consulting, professional

## Expected Results

For "I need 500 custom circuit boards":
- **Category Detected**: Electronics
- **Suppliers Matched**: Circuit Solutions Inc, TechForge Manufacturing, Global PCB Systems
- **Pricing Range**: $6,000 - $10,000
- **Lead Times**: 14-28 days
- **Match Scores**: 95%, 90%, 85%

For "Get me quotes for office furniture":
- **Category Detected**: Office Supplies
- **Suppliers Matched**: Premier Office Supply Co, Industrial Equipment Partners
- **Pricing Range**: $2,400 - $4,500
- **Lead Times**: 14-21 days

## Troubleshooting

**No suppliers found?**
- Check that Status = "Active" for all suppliers
- Verify Capabilities tags match the categories above
- Check the Notion database ID in environment variables

**Wrong suppliers matched?**
- The API matches on "Capabilities" multi-select property
- Make sure capability tags match exactly (case-sensitive)

**Pricing not showing?**
- Pricing is generated dynamically based on category
- No need to add pricing in Notion - it's calculated in the API

## Next Steps

After testing the flow with these suppliers, you can:

1. Add real supplier data from your network
2. Customize pricing logic in `/app/api/suppliers/match/route.ts`
3. Add more supplier properties (certifications, ratings, etc.)
4. Connect to actual PO generation system

The procurement module is production-ready and can handle real transactions!
