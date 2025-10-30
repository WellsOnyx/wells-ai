# Wells AI - GTM Notion Databases Setup

## Required Databases

You need to create 3 new Notion databases in your workspace. Follow these exact schemas:

---

## 1. GTM Campaigns Database

**Database Name:** `GTM Campaigns`

**Properties:**

| Property Name | Type | Options/Notes |
|--------------|------|---------------|
| Campaign Name | Title | Auto-set as title |
| Service Offering | Select | Options: "Executive Search", "IDRE Agency", "Wells OS", "AI Ops", "Wells AI Platform", "Exo", "Fab", "Mainstreet", "Redemption", "Adullam", "Search & Strategy", "Onyx Health" |
| Target Revenue | Select | Options: "$10M-$50M", "$50M-$200M", "$200M-$1B", "$1B+", "Not Specified" |
| Target Industry | Rich Text | |
| Target Role | Rich Text | |
| Target Company Size | Select | Options: "Seed (1-10)", "Series A (10-50)", "Series B (50-200)", "Growth (200-1000)", "Enterprise (1000+)" |
| Pain Point | Rich Text | What problem does the target have? |
| Value Prop | Rich Text | How do we solve it? |
| Hook | Rich Text | Conversational commerce hook |
| Status | Select | Options: "Discovering", "Outreach Queued", "⏸️ Awaiting Approval", "Active", "Paused", "Completed" |
| Created | Date | Auto-timestamp |
| Targets Found | Number | Count of targets discovered |
| Messages Generated | Number | Count of messages created |
| Launched Date | Date | When campaign went live |

---

## 2. GTM Targets Database

**Database Name:** `GTM Targets`

**Properties:**

| Property Name | Type | Options/Notes |
|--------------|------|---------------|
| Name | Title | Person's full name |
| Title | Rich Text | Job title |
| Company | Rich Text | Company name |
| Email | Email | Contact email |
| Phone | Phone | Contact phone in +1XXXXXXXXXX format |
| LinkedIn | URL | LinkedIn profile URL |
| Campaign | Relation | Links to GTM Campaigns database |
| Stage | Select | Options: "Discovered", "Outreach Generated", "Outreach Sent", "Replied", "Meeting Booked", "Qualified", "Closed Won", "Closed Lost", "Outreach Rejected" |
| Industry | Rich Text | Industry/vertical |
| Company Size | Select | Options: "Seed", "Series A", "Series B", "Growth", "Enterprise" |
| Last Contacted | Date | When last outreach was sent |
| Notes | Rich Text | Internal notes |

---

## 3. GTM Outreach Database

**Database Name:** `GTM Outreach`

**Properties:**

| Property Name | Type | Options/Notes |
|--------------|------|---------------|
| Outreach ID | Title | Auto-generated or manual |
| Target | Relation | Links to GTM Targets database |
| Campaign | Relation | Links to GTM Campaigns database |
| Message | Rich Text | The outreach message (AI-generated) |
| Final Message | Rich Text | Edited/approved version |
| Channel | Select | Options: "Email", "SMS", "LinkedIn", "Phone" |
| Status | Select | Options: "⏸️ Pending Approval", "✅ Sent", "❌ Send Failed", "❌ Rejected", "📬 Replied", "📅 Meeting Booked" |
| Generated | Date | When AI created the message |
| Sent At | Date | When message was actually sent |
| Rejected At | Date | When human rejected it |
| Regenerated At | Date | When message was regenerated |
| Reply Received | Date | When target responded |
| Notes | Rich Text | Internal notes |

---

## Environment Variables to Add

After creating these databases, you need to add their IDs to Vercel:

1. Go to each database in Notion
2. Click "..." menu → "Copy link to database"
3. Extract the database ID from the URL:
   ```
   https://notion.so/[WORKSPACE]/[DATABASE_ID]?v=[VIEW_ID]
                                 ^^^^^^^^^^^^^^^^
                                 This is the ID you need
   ```

4. Add to Vercel environment variables:

```bash
NOTION_GTM_CAMPAIGNS_DB=<GTM Campaigns Database ID>
NOTION_GTM_TARGETS_DB=<GTM Targets Database ID>
NOTION_GTM_OUTREACH_DB=<GTM Outreach Database ID>
```

5. Redeploy Wells AI:
```bash
cd ~/Downloads/wells-ai-github-ready
vercel --prod
```

---

## Testing the Flow

Once databases are created and environment variables are set:

1. Go to `/gtm` on your Wells AI site
2. Create a test campaign:
   - Service: "Executive Search"
   - ICP: CEO, Series B, SaaS
   - Messaging: Fill in pain point, value prop, hook
3. Click "Preview Sample Messages"
4. Review 3 AI-generated samples
5. Click "Approve & Launch Campaign"
6. Check Notion:
   - GTM Campaigns: Should have new campaign
   - GTM Targets: Should have 10 discovered targets
   - GTM Outreach: Should have 10 pending messages
7. Go to `/gtm/approve` to review and send messages

---

## Share Notion Integration with Wells AI

For Wells AI to write to your Notion databases, you need to share them with the integration:

1. Open each database in Notion
2. Click "..." menu → "Connect to" → "Wells AI"
3. If you don't see "Wells AI" integration:
   - Go to https://notion.so/my-integrations
   - Create new integration called "Wells AI"
   - Copy the integration token
   - Add to Vercel: `NOTION_API_KEY=secret_xxx`

---

## Troubleshooting

**Error: "NOTION_GTM_CAMPAIGNS_DB not configured"**
- Solution: Add database ID to Vercel environment variables
- Make sure to redeploy after adding env vars

**Error: "Could not create page"**
- Solution: Share the database with the Wells AI integration
- Each database needs to be explicitly shared

**Error: "Property not found"**
- Solution: Double-check property names match exactly (case-sensitive)
- Example: "Service Offering" not "Service offering"

**No targets discovered**
- If Apollo API key not set, it generates 10 mock targets
- This is normal for testing
- Add APOLLO_API_KEY to use real prospect discovery

---

## Next Steps

After databases are working:

1. ✅ Test with one campaign
2. Add remaining service offerings (Exo, Fab, Mainstreet, etc.)
3. Build ICP development engine (analyze past Wells Onyx deals)
4. Add deal flow automation (meeting booking → proposals)
5. Build Category Pioneers partnership system

---

**Created:** October 29, 2025
**Version:** 1.0
**Maintained by:** Wells AI Team
