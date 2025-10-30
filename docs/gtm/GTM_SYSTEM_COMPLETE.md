# Wells AI - Complete GTM System

## System Overview

The Wells AI GTM (Go-To-Market) system is a **service-agnostic B2B sales automation platform** that works for anyone selling professional services - Wells Onyx, competitors, Category Pioneers, or independent professionals.

### Philosophy: Neutral Platform

Wells AI **never favors Wells Onyx** over other service providers. The only advantage Wells Onyx has is being first mover in some categories. The platform is designed to be so good that competitors use it instead of building their own systems.

---

## Complete User Flow

### Step 1: Dashboard Overview
**URL:** `/gtm/dashboard`

**Features:**
- Overview tab: Stats, pending approvals, active campaigns, deals
- Campaigns tab: All campaigns with funnel metrics
- Outreach tab: Pending message approvals
- Deals tab: Pipeline view

**Stats Tracked:**
- Total Targets
- Outreach Sent
- Meetings Booked
- Deals Closed
- Pipeline Value

### Step 2: Launch Campaign
**URL:** `/gtm/launch`

**4-Step Process:**

**Step 1: Service Selection**
- Choose from 12 Wells Onyx services (or any B2B offering)
- Services grouped by category (Professional, Technology, Manufacturing)

**Step 2: ICP Development**
- AI suggests ICP based on historical deals
- Customize:
  - Target job titles (CEO, CTO, VP Sales, etc.)
  - Target industries (Healthcare, Technology, Finance, etc.)
  - Company sizes (1-50, 51-200, 201-1000, 1000+)
  - Customer pain points
  - Value propositions
  - Campaign notes

**Step 3: Message Preview**
- AI generates 3 sample messages
- Shows different personas (CEO of startup, VP of enterprise, etc.)
- Preview subject lines and email body
- Validates messaging before launch

**Step 4: Launch Configuration**
- Target count (10-1000)
- Messages per day (5-100) - respects deliverability limits
- Channels (Email, SMS, LinkedIn)
- Auto-approve toggle (manual review recommended for first campaign)
- Campaign summary

### Step 3: Discovery (Automatic)
**API:** `POST /api/gtm/discover`

**Process:**
1. Uses Apollo.io API to find prospects matching ICP
2. Searches by:
   - Job titles
   - Industries
   - Company size
   - Location (if specified)
3. Creates target records in Notion GTM Targets database
4. Each target includes:
   - Name, Title, Company
   - Email, Phone, LinkedIn
   - Industry, Company Size
   - Stage: "Discovered"

**Fallback:** If Apollo not configured, generates realistic mock data for testing

### Step 4: Outreach Generation (Automatic)
**API:** `POST /api/gtm/outreach`

**Process:**
1. For each discovered target:
   - Analyzes their profile (title, company, industry)
   - Identifies relevant pain points from ICP
   - Generates personalized message using Claude Sonnet 4
   - Creates unique subject line
2. Stores in Notion GTM Outreach database
3. Status: "⏸️ Pending Approval" (unless auto-approve enabled)

**Message Generation:**
- Uses pain points, value props, industry context
- Personalizes based on target's role and company
- Keeps concise (150-200 words)
- Includes clear CTA
- Professional tone, not salesy

### Step 5: Human Approval
**URL:** `/gtm/dashboard` → Outreach tab

**Features:**
- Review each generated message
- See full context (target name, company, title, campaign)
- Actions:
  - ✓ Approve & Send
  - ↻ Regenerate (new message with different angle)
  - ✕ Reject
  - Edit (customize before sending)

**Batch Actions:**
- Approve all
- Review later
- Filter by campaign

### Step 6: Send Outreach (Automatic)
**API:** `POST /api/gtm/outreach/approve`

**Process:**
1. Detects channel (Email or SMS)
2. **Email:** Sends via Instantly.ai (50+ warmed domains for deliverability)
3. **SMS:** Sends via Twilio
4. Updates status to "✅ Sent"
5. Logs timestamp

**Rate Limiting:**
- Respects messagesPerDay setting
- Spreads sends throughout day
- Monitors deliverability
- Pauses if spam flags detected

### Step 7: Track Responses
**Manual for now, automated in future**

**Actions:**
- Target replies → Update stage to "Replied"
- Target interested → Book meeting
- Target not interested → Mark as "Not Interested"

### Step 8: Book Meeting
**API:** `POST /api/gtm/deals/book-meeting`

**Process:**
1. Creates Calendly meeting link
2. Pre-fills with target info
3. Updates target stage to "Meeting Booked"
4. Creates interaction record
5. Sends calendar invite

### Step 9: Generate Proposal
**API:** `POST /api/gtm/deals/generate-proposal`

**Process:**
1. Takes discovery notes from meeting
2. Claude generates professional proposal
3. Includes:
   - Executive Summary
   - Understanding of Client's Needs
   - Proposed Solution & Approach
   - Timeline & Deliverables
   - Investment & Terms
   - Next Steps
4. Saves to Notion with link

### Step 10: Close Deal
**API:** `POST /api/gtm/deals/close`

**Process:**
1. Records deal value
2. Calculates Wells AI fee (33bps)
3. **Checks for Category Pioneer partnership**
4. If partnership exists:
   - Updates partner's category revenue
   - Auto-calculates revenue share (20%, 35%, or 50%)
   - Creates activity log entry
   - Returns partnership data
5. Updates campaign stats
6. Creates deal record
7. Sends to billing

---

## API Endpoints

### Campaign Management

**POST /api/gtm/launch**
- Launch new GTM campaign
- Input: campaignName, serviceOffering, icp, targetCount, channels
- Output: campaignId, workflow steps, timeline

**GET /api/gtm/campaigns/list**
- List all campaigns
- Filter by status, service offering
- Returns: campaigns array with stats

**POST /api/gtm/campaigns/update**
- Update campaign status
- Pause/resume campaign
- Update settings

### Target Discovery

**POST /api/gtm/discover**
- Discover prospects via Apollo.io
- Input: campaignId, icp, targetCount
- Output: targets array

**POST /api/gtm/icp/suggest**
- Get ICP suggestions for service offering
- Analyzes historical deals
- Returns: titles, industries, pain points, value props

**POST /api/gtm/icp/analyze**
- Analyze Wells Onyx Deals database
- Extracts winning patterns
- Returns: top industries, titles, avg deal size

### Outreach Management

**POST /api/gtm/outreach**
- Generate outreach messages
- Input: campaignId
- Output: Generated messages for approval

**GET /api/gtm/outreach/pending**
- List pending approvals
- Returns: messages awaiting review

**POST /api/gtm/outreach/approve**
- Approve and send message
- Detects channel (email/SMS)
- Sends via Instantly or Twilio

**POST /api/gtm/outreach/reject**
- Reject message
- Updates status to "❌ Rejected"

**POST /api/gtm/outreach/regenerate**
- Regenerate message with different angle
- Higher temperature (0.9)
- Returns: new message

**POST /api/gtm/preview**
- Generate 3 sample messages
- Used in campaign launch preview
- Shows different personas

### Deal Management

**POST /api/gtm/deals/book-meeting**
- Create Calendly link
- Update stage to "Meeting Booked"
- Create interaction

**POST /api/gtm/deals/generate-proposal**
- Claude-powered proposal generation
- Input: targetId, discoveryNotes
- Output: Full proposal text

**POST /api/gtm/deals/close**
- Close deal
- Calculate Wells AI fee (33bps)
- **Auto-update Category Pioneer revenue**
- Create deal record
- Update campaign stats

---

## Database Schema

### GTM Campaigns
- Campaign Name (title)
- Service Offering (select)
- Status (select): Discovering, Outreach Queued, Active, Paused, Completed
- Target Count (number)
- Messages Per Day (number)
- Channels (multi-select)
- Auto Approve (checkbox)
- Target Titles, Industries, Company Sizes (rich text)
- Pain Points, Value Props (rich text)
- Targets Found, Outreach Sent, Meetings Booked, Deals Closed (numbers)
- Total Revenue (number)
- Created (date)

### GTM Targets
- Name (title)
- Company, Title, Email, Phone, LinkedIn (rich text/email/phone/url)
- Industry, Company Size (select)
- Campaign (relation)
- Stage (select): Discovered, Outreach Sent, Replied, Meeting Booked, Proposal Sent, Closed Won, Closed Lost
- Source (select): Apollo, Manual, Referral
- Deal Value, Wells AI Fee (numbers)
- Last Contact, Closed Date (dates)

### GTM Outreach
- Name (title) - auto: "{Target} - {Campaign}"
- Target (relation)
- Campaign (relation)
- Channel (select): Email, SMS, LinkedIn
- Subject (rich text)
- Message (rich text)
- Status (select): ⏸️ Pending Approval, ✅ Sent, ❌ Rejected, 📧 Replied
- Generated Date, Sent Date, Reply Date (dates)
- Sentiment (select) if replied: Positive, Neutral, Negative

---

## Revenue Model

### Wells AI Transaction Fee
**33 basis points (0.33%)** on all deals

**Example:**
- Deal Value: $500,000
- Wells AI Fee: $500,000 × 0.0033 = **$1,650**

### Category Pioneer Revenue Share
If deal is in a pioneered category, partner earns share of fee:

**Tier 1 (20%):**
- Partner gets: $1,650 × 0.20 = $330
- Wells Onyx nets: $1,320

**Tier 2 (35%):**
- Partner gets: $1,650 × 0.35 = $577.50
- Wells Onyx nets: $1,072.50

**Tier 3 (50%):**
- Partner gets: $1,650 × 0.50 = $825
- Wells Onyx nets: $825

---

## Key Metrics

### Campaign Performance
- **Targets Discovered:** Number of prospects found via Apollo
- **Outreach Sent:** Messages approved and delivered
- **Response Rate:** Replies / Outreach Sent (target: >10%)
- **Meeting Conversion:** Meetings / Replies (target: >30%)
- **Close Rate:** Deals / Meetings (target: >20%)
- **Pipeline Value:** Total value of open deals
- **Revenue Generated:** Sum of closed deals

### Message Quality
- **Approval Rate:** Approved / Generated (target: >70%)
- **Rejection Rate:** Rejected / Generated (should be <10%)
- **Regeneration Rate:** Regenerated / Generated (should be <20%)

### Deliverability
- **Delivered Rate:** Delivered / Sent (target: >95%)
- **Bounce Rate:** Bounced / Sent (should be <3%)
- **Spam Rate:** Marked as spam / Delivered (should be <0.1%)

### Overall GTM Health
- **Cost Per Meeting:** Wells AI fees / Meetings booked
- **Cost Per Deal:** Wells AI fees / Deals closed
- **ROI:** (Revenue - Fees) / Fees (target: >100x)

---

## Integration Points

### Apollo.io
- **Purpose:** B2B prospect discovery
- **API:** `POST https://api.apollo.io/v1/mixed_people/search`
- **Limits:** 10,000 requests/month (free tier)
- **Rate Limit:** 10 requests/second

### Claude Sonnet 4
- **Purpose:** Personalized message generation, proposals
- **API:** Direct HTTP (not SDK) to `https://api.anthropic.com/v1/messages`
- **Model:** `claude-sonnet-4-20250514`
- **Cost:** ~$0.02 per message generated

### Instantly.ai
- **Purpose:** Email sending with high deliverability
- **Features:**
  - 50+ warmed email domains
  - Auto-rotate sending accounts
  - Spam score monitoring
  - Bounce handling
- **Rate Limit:** Configurable (default: 50/day per account)

### Twilio
- **Purpose:** SMS outreach
- **API:** `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json`
- **Cost:** ~$0.0075 per SMS
- **Limits:** 200 messages/second

### Calendly
- **Purpose:** Meeting scheduling
- **Integration:** URL parameters for pre-filling
- **Custom Fields:** name, email, company, category, tier

### Notion
- **Purpose:** CRM and data storage
- **Databases Used:**
  - GTM Campaigns
  - GTM Targets
  - GTM Outreach
  - Category Partnerships
  - Activity Log
  - Deals
  - Interactions

---

## Security & Compliance

### Data Privacy
- All prospect data stored in Notion (encrypted at rest)
- Email tracking pixels optional (default: off)
- Clear unsubscribe links in all emails
- GDPR compliant data handling

### Spam Prevention
- CAN-SPAM Act compliant
- Rate limiting per domain
- Deliverability monitoring
- Auto-pause if spam rate >0.5%

### Authentication
- API keys stored in environment variables
- Notion OAuth for user access
- Rate limiting on all endpoints
- Input validation and sanitization

---

## Best Practices

### Campaign Setup
1. **Start Small:** First campaign = 50-100 targets max
2. **Manual Approval:** Don't auto-approve until you've reviewed 50+ messages
3. **A/B Test:** Run 2-3 campaigns with different messaging
4. **Monitor Daily:** Check approval queue every morning

### ICP Development
1. **Analyze First:** Always review historical deals before setting ICP
2. **Be Specific:** "VP of Engineering at Series B SaaS companies" > "Tech executives"
3. **Limit Scope:** 3-5 titles, 3-5 industries max per campaign
4. **Test Personas:** Create separate campaigns for different buyer personas

### Message Quality
1. **Personalize:** Reference their company, industry, recent news
2. **Be Concise:** 150-200 words max
3. **Clear CTA:** Single, specific ask (15-min call, reply with availability, etc.)
4. **No Attachments:** Links only, no PDFs in cold outreach
5. **Follow Up:** 3-touch sequence (initial + 2 follow-ups)

### Deliverability
1. **Warm Up:** New domains need 2-4 weeks of gradual sending increase
2. **Monitor Bounces:** >3% bounce rate = bad data, pause and clean
3. **Track Opens:** <15% open rate = subject lines need work
4. **Rotate Accounts:** Don't send >50 emails/day from one account

---

## Roadmap

### Phase 1: Core GTM (COMPLETE)
- ✅ Campaign management dashboard
- ✅ ICP development with AI suggestions
- ✅ Target discovery (Apollo integration)
- ✅ AI message generation (Claude)
- ✅ Human approval workflow
- ✅ Multi-channel outreach (Email/SMS)
- ✅ Deal tracking and closing
- ✅ Category Pioneer revenue sharing

### Phase 2: Automation & Intelligence
- [ ] Response detection (auto-update stage on reply)
- [ ] Sentiment analysis on replies
- [ ] Auto-follow-up sequences
- [ ] Meeting booking automation (detect interest → auto-send Calendly)
- [ ] Proposal auto-generation from meeting notes
- [ ] Contract generation and e-signature
- [ ] Revenue forecasting

### Phase 3: Advanced Features
- [ ] LinkedIn automation (connection requests, InMail)
- [ ] Multi-touch sequences (email → SMS → LinkedIn)
- [ ] A/B testing framework
- [ ] Deliverability monitoring dashboard
- [ ] Lead scoring (predictive model)
- [ ] Account-based marketing (multi-stakeholder campaigns)

### Phase 4: Platform Expansion
- [ ] Independent professional platform
  - Create service offerings
  - Portfolio/profile pages
  - Payment processing (Stripe Connect)
  - Invoicing & billing
  - Tax handling (1099 generation)
  - Benefits marketplace
  - Business formation (LLC, S-Corp)
  - Accounting integration (QuickBooks, Xero)
- [ ] Partner ecosystem
  - Partner dashboard
  - Revenue share tracking
  - Performance analytics
  - Co-marketing tools
- [ ] Marketplace features
  - Public category pages
  - Supplier search
  - Reviews & ratings
  - Request for proposals (RFP)

---

## Success Stories (Projected)

### Campaign Example: Executive Search

**Setup:**
- Service: Executive Search
- ICP: CEOs at Series B-D tech companies, 50-200 employees
- Target Count: 100
- Channel: Email

**Results (90 days):**
- Targets Discovered: 100
- Outreach Sent: 85 (15 bounced or opted out)
- Replies: 12 (14% response rate)
- Meetings Booked: 5 (42% meeting conversion)
- Deals Closed: 1 (20% close rate)
- Deal Value: $250,000
- Wells AI Fee: $825
- Partner Share (Tier 2 - 35%): $289
- Wells Onyx Net: $536

**Cost:**
- Apollo: $0 (free tier)
- Claude: $1.70 (85 messages × $0.02)
- Instantly: $49/month
- Total: ~$51

**ROI:** 536 / 51 = **10.5x**

---

## Technical Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS

### Backend
- Next.js API Routes (serverless)
- Notion API (database)
- Claude Sonnet 4 API (AI)
- Apollo.io API (discovery)
- Instantly.ai API (email)
- Twilio API (SMS)

### Deployment
- Vercel (hosting + edge functions)
- Environment variables for all API keys
- Production + staging environments

---

## Getting Started

### 1. Setup Notion Databases
Follow `NOTION_GTM_SETUP.md` to create:
- GTM Campaigns
- GTM Targets
- GTM Outreach

### 2. Add Environment Variables
```bash
# Notion
NOTION_API_KEY=secret_xxx
NOTION_GTM_CAMPAIGNS_DB=xxx
NOTION_GTM_TARGETS_DB=xxx
NOTION_GTM_OUTREACH_DB=xxx

# AI
ANTHROPIC_API_KEY=sk-ant-xxx

# Discovery
APOLLO_API_KEY=xxx (optional)

# Outreach
INSTANTLY_API_KEY=xxx
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx

# Calendly
NEXT_PUBLIC_CALENDLY_PARTNERSHIP=https://calendly.com/xxx
```

### 3. Test Complete Flow
1. Visit `/gtm/launch`
2. Create test campaign (10 targets, manual approval)
3. Review generated messages
4. Approve 1-2 messages
5. Verify delivery
6. Track in dashboard

### 4. Launch First Real Campaign
1. Analyze historical deals (`/api/gtm/icp/analyze`)
2. Define tight ICP (3 titles, 3 industries)
3. Start small (50-100 targets)
4. Manual approval for first 20 messages
5. Monitor deliverability daily
6. Iterate based on response rates

---

## Support

**Documentation:** `/BUILD_SUMMARY.md`, `/GTM_PLAYBOOK.md`
**Dashboard:** `/gtm/dashboard`
**Launch Campaign:** `/gtm/launch`

**For issues:**
1. Check Notion database IDs are correct
2. Verify API keys in environment variables
3. Check server logs for errors
4. Review BUILD_SUMMARY.md for setup steps

---

**Built with integrity. Designed for ubiquity. Powering B2B commerce for everyone.**
