# Notion Partnerships Database Setup

## Overview
This database tracks all Category Pioneer partnerships, revenue share calculations, and category ownership.

## Database: GTM Category Partnerships

### Properties

| Property Name | Type | Configuration | Description |
|--------------|------|---------------|-------------|
| **Name** | Title | - | "Company Name - Category" (e.g., "ABB - Industrial Robotics") |
| **Category Slug** | Text | - | Technical slug (e.g., "industrial-robotics") |
| **Category Name** | Select | Options: All categories from OPEN_CATEGORIES | Human-readable category name |
| **Pioneer Company** | Text | - | Company pioneering the category |
| **Contact Name** | Text | - | Primary contact at pioneer company |
| **Contact Email** | Email | - | Email for partnership communications |
| **Contact Phone** | Phone | - | Phone for quick coordination |
| **Partnership Tier** | Select | Options: "Tier 1 (20%)", "Tier 2 (35%)", "Tier 3 (50%)" | Revenue share tier |
| **Revenue Share %** | Number | Format: Percent | 0.20, 0.35, or 0.50 |
| **Status** | Select | Options: "🟢 Open", "🟡 In Negotiation", "🔵 Agreement Sent", "✅ Live", "⏸️ Paused", "❌ Terminated" | Partnership status |
| **Market Size** | Text | - | e.g., "$320B" |
| **Intro Call Date** | Date | - | When intro call was held |
| **Agreement Signed Date** | Date | - | When partnership agreement was signed |
| **Go-Live Date** | Date | - | When category went live on platform |
| **Agreement URL** | URL | - | Link to signed partnership agreement |
| **Category Description** | Text | - | What this category encompasses |
| **Total Category Revenue** | Number | Format: Dollar | Total revenue generated in this category (all deals) |
| **Wells AI Fee (33bps)** | Formula | `prop("Total Category Revenue") * 0.0033` | Wells AI's transaction fees |
| **Partner Share Amount** | Formula | `prop("Wells AI Fee (33bps)") * prop("Revenue Share %")` | Amount owed to partner |
| **Wells Onyx Net** | Formula | `prop("Wells AI Fee (33bps)") - prop("Partner Share Amount")` | Net to Wells Onyx after partner share |
| **Deal Count** | Rollup | From Related Deals → Count | Number of deals in this category |
| **Last Payment Date** | Date | - | When partner was last paid |
| **Next Payment Due** | Date | - | When next payment is due |
| **Payment Terms** | Select | Options: "Monthly", "Quarterly", "Annually" | How often partner gets paid |
| **Tier Requirements Met** | Checkbox | - | Whether partner is meeting tier commitments |
| **Notes** | Text | Long text | Partnership notes, special terms, etc. |
| **Created Date** | Created time | - | Auto-populated |
| **Last Updated** | Last edited time | - | Auto-populated |

### Relations

| Relation Name | Related Database | Description |
|--------------|------------------|-------------|
| **Related Deals** | Deals Database | All deals closed in this category |
| **Related Campaigns** | GTM Campaigns | GTM campaigns for this category |
| **Related Suppliers** | Suppliers | Suppliers in this category |

## Database: Category Activity Log

Track all partnership activity for live feed

### Properties

| Property Name | Type | Configuration | Description |
|--------------|------|---------------|-------------|
| **Name** | Title | - | Auto-generated activity description |
| **Activity Type** | Select | Options: "Partnership Signed", "Category Opened", "Inquiry Received", "Deal Closed", "Payment Made", "Tier Upgraded" | Type of activity |
| **Partnership** | Relation | → GTM Category Partnerships | Related partnership |
| **Category** | Text | - | Category name |
| **Company** | Text | - | Company involved |
| **Details** | Text | Long text | Activity details |
| **Amount** | Number | Format: Dollar | If applicable (deal value, payment, etc.) |
| **Timestamp** | Created time | - | When activity occurred |

## Setup Instructions

### Step 1: Create GTM Category Partnerships Database

1. In Notion, create a new database called "GTM Category Partnerships"
2. Add all properties listed above
3. Create the formulas:
   - **Wells AI Fee (33bps)**: `prop("Total Category Revenue") * 0.0033`
   - **Partner Share Amount**: `prop("Wells AI Fee (33bps)") * prop("Revenue Share %")`
   - **Wells Onyx Net**: `prop("Wells AI Fee (33bps)") - prop("Partner Share Amount")`

### Step 2: Create Category Activity Log Database

1. Create a new database called "Category Activity Log"
2. Add all properties listed above
3. Create relation to GTM Category Partnerships

### Step 3: Get Database IDs

1. Open "GTM Category Partnerships" database
2. Click "..." menu → "Copy link"
3. Extract database ID from URL:
   - URL format: `https://www.notion.so/{workspace}/{DATABASE_ID}?v=...`
   - Example: `https://www.notion.so/myworkspace/abc123def456?v=xyz`
   - Database ID: `abc123def456` (remove hyphens)

4. Repeat for "Category Activity Log"

### Step 4: Add to Environment Variables

Add to `.env.local` (and Vercel environment variables):

```bash
# Partnerships
NOTION_PARTNERSHIPS_DB=your_partnerships_database_id_here
NOTION_ACTIVITY_LOG_DB=your_activity_log_database_id_here
```

### Step 5: Seed Initial Data

Add these active partnerships to get started:

**Partnership 1: ABB - Industrial Robotics**
- Category Slug: `industrial-robotics`
- Category Name: Industrial Robotics
- Pioneer Company: ABB
- Partnership Tier: Tier 3 (50%)
- Revenue Share %: 0.50
- Status: ✅ Live
- Market Size: $71B
- Go-Live Date: [Set to current date]

**Partnership 2: Medtronic - Medical Device Manufacturing**
- Category Slug: `medical-device-manufacturing`
- Category Name: Medical Device Manufacturing
- Pioneer Company: Medtronic
- Partnership Tier: Tier 2 (35%)
- Revenue Share %: 0.35
- Status: ✅ Live
- Market Size: $450B
- Go-Live Date: [Set to current date]

## Integration Points

### Deal Close Integration
When a deal closes in `/app/api/gtm/deals/close/route.ts`:
1. Check if category has active partnership
2. Update "Total Category Revenue" in partnership record
3. Formulas auto-calculate partner share
4. Create activity log entry for deal closed

### Partnership Creation Flow
When user completes partnership booking:
1. Create partnership record with Status: "🟡 In Negotiation"
2. Create activity log entry: "Inquiry Received"
3. After intro call, update to "🔵 Agreement Sent"
4. After signature, update to "✅ Live" and set Go-Live Date
5. Create activity log entry: "Partnership Signed"

### Monthly Revenue Reports
Create Notion automation or manual process to:
1. Query all partnerships with Status: "✅ Live"
2. Generate revenue report showing:
   - Total category revenue for period
   - Partner share amount
   - Wells Onyx net
3. Update "Last Payment Date" after payment
4. Create activity log entry: "Payment Made"

## Revenue Share Calculation Example

**Example: Injection Molding Category - Tier 2 Partner (35%)**

- Month 1 Deal: $500K contract
- Wells AI Fee (33bps): $500,000 × 0.0033 = $1,650
- Partner Share (35%): $1,650 × 0.35 = $577.50
- Wells Onyx Net: $1,650 - $577.50 = $1,072.50

- Month 2 Deal: $750K contract
- Wells AI Fee (33bps): $750,000 × 0.0033 = $2,475
- Partner Share (35%): $2,475 × 0.35 = $866.25
- Wells Onyx Net: $2,475 - $866.25 = $1,608.75

**Total for Quarter:**
- Total Category Revenue: $1,250,000
- Total Wells AI Fees: $4,125
- Total Partner Share: $1,443.75
- Total Wells Onyx Net: $2,681.25

The partner earns $1,443.75 for helping build and maintain the category, while Wells Onyx nets $2,681.25.

## Next Steps

1. Create both databases in Notion
2. Add database IDs to environment variables
3. Build API endpoints for partnership management:
   - POST /api/partnerships/create - Create new partnership
   - GET /api/partnerships/list - List all partnerships
   - POST /api/partnerships/update - Update partnership status
   - GET /api/partnerships/activity - Get activity feed
4. Integrate with deal close flow to auto-calculate revenue shares
5. Build partner dashboard to show their category performance

## Notes

- All revenue share calculations are automatic via formulas
- Activity log provides transparency and audit trail
- Partner can view their dashboard showing real-time revenue
- System supports tier upgrades (e.g., Tier 1 → Tier 2)
- Revenue share is perpetual as long as partnership is active
