# AI Ops Module - Specification

**Status:** Documented. Build after Phase 1 is bulletproof.

## What It Is

Human-in-the-loop AI operations:
- 1 Wells operator manages 10 AI-driven SOPs (nodes)
- We sell, deploy, and manage for clients
- Think: "AI workforce as a service"

## Integration with Wells AI

### Founder Journey Flow

```
User (Founder): "I need operational help"
Wells: "Our AI Ops can handle that. Let me show you what we can automate..."

Wells: "We have 10+ operational nodes available:
- Email management
- CRM updates
- Lead qualification
- Customer support
- Data entry
- Report generation
- Meeting scheduling
- Invoice processing
- Research tasks
- Content moderation

Which of these would save you the most time?"

User: "Email and CRM updates are killing us"

Wells: "Perfect. Here's how it works:
- Our AI handles 80-90% automatically
- Human operator (Wells team) handles edge cases
- You get a dashboard to monitor everything
- Pricing: $X per node/month, $Y operator oversight

For email + CRM, that's $Z/month total. Want me to set it up?"

User: "Yes"

Wells: [ACTION:CREATE_AI_OPS_DEAL:{nodes: ['email', 'crm'], price: Z}]
Wells: "Great! I've created your AI Ops agreement. You'll get:
1. Onboarding call with your operator (within 24h)
2. Dashboard access
3. First node live within 48h

Check your email for next steps."
```

## Available SOPs (Nodes)

### 1. Email Management
- Inbox triage (priority, spam, archive)
- Auto-respond to common questions
- Flag urgent items for human review
- Smart scheduling of responses
- **Pricing:** $500/month per inbox

### 2. CRM Updates
- Auto-log emails/calls/meetings
- Update deal stages
- Enrich contact data
- Create tasks from conversations
- **Pricing:** $400/month

### 3. Lead Qualification
- Score inbound leads
- Research companies (firmographics)
- Initial outreach sequences
- Route qualified leads to sales
- **Pricing:** $600/month

### 4. Customer Support (Tier 1)
- Answer FAQ via chat/email
- Escalate complex issues
- Log tickets in system
- Sentiment analysis
- **Pricing:** $800/month

### 5. Data Entry
- Extract data from PDFs/emails/forms
- Input into systems (Salesforce, Notion, etc)
- Validate and clean data
- Generate reports
- **Pricing:** $300/month

### 6. Report Generation
- Weekly/monthly automated reports
- Pull data from multiple sources
- Visualizations and insights
- Distribute to stakeholders
- **Pricing:** $400/month

### 7. Meeting Scheduling
- Coordinate availability
- Send calendar invites
- Prep meeting agendas
- Follow-up reminders
- **Pricing:** $300/month

### 8. Invoice Processing
- Extract invoice data
- Match to POs
- Flag discrepancies
- Submit for approval
- **Pricing:** $500/month

### 9. Research Tasks
- Market research
- Competitive intelligence
- Lead enrichment
- Content summarization
- **Pricing:** $600/month

### 10. Content Moderation
- Review user-generated content
- Flag policy violations
- Categorize and tag
- Escalate edge cases
- **Pricing:** $700/month

## Pricing Model

### Per Node
- Single node: $300-800/month (varies by node)
- Each node includes:
  - AI automation (80-90% coverage)
  - Human operator oversight
  - Dashboard monitoring
  - Weekly reports

### Operator Oversight
- Included in node pricing
- 1 operator per 10 nodes max
- Response time: <4 hours
- Escalation handling

### Package Deals
- **Startup Pack** (3 nodes): $1,200/month (save 20%)
- **Growth Pack** (5 nodes): $1,800/month (save 25%)
- **Scale Pack** (10 nodes): $3,000/month (save 30%)

### Enterprise Custom
- 10+ nodes: Custom pricing
- Dedicated operator team
- SLA guarantees
- White-label option

## Technical Architecture

### Node Structure
```typescript
interface AINode {
  id: string
  type: NodeType // email, crm, lead_qual, etc.
  clientId: string
  operatorId: string
  status: 'active' | 'paused' | 'setup'

  config: {
    integrations: Integration[] // Salesforce, Gmail, etc.
    rules: AutomationRule[]
    escalationThresholds: EscalationConfig
    schedule: Schedule // when to run
  }

  metrics: {
    tasksProcessed: number
    automationRate: number // % handled by AI
    escalationRate: number // % needing human
    avgProcessingTime: number
    errorRate: number
  }
}
```

### Operator Dashboard
- See all assigned nodes (max 10)
- Queue of escalated tasks
- Performance metrics per node
- Client communication hub
- SOP management

### Client Dashboard
- Monitor their nodes
- See what's being automated
- Approve/reject actions (optional)
- View savings (time + cost)
- Request changes to SOPs

## Revenue Model

### Wells Onyx Revenue
- We sell AI Ops as a practice group
- Margins: 60-70% (AI does most work)
- Recurring revenue (monthly subscriptions)
- Upsell opportunities (add more nodes)

### Operator Comp
- Base: $60K/year
- Manage 10 nodes = $30K/month revenue
- Bonus: 10% of revenue over $25K/month
- Career path: Senior operator → AI Ops manager

### Unit Economics
```
10 nodes @ avg $400/month = $4,000 MRR
Operator cost: $5K/month (loaded)
Gross margin: -$1K/month (???)

Wait, this doesn't work...

REVISED:
10 nodes @ avg $600/month = $6,000 MRR
Operator cost: $4K/month (loaded)
Infrastructure: $500/month (AI API calls, hosting)
Gross margin: $1,500/month (25%)

Better but still thin. Need higher pricing or more nodes per operator.

REVISED AGAIN:
1 operator manages 20 nodes (not 10)
20 nodes @ avg $500/month = $10,000 MRR
Operator cost: $4K/month
Infrastructure: $800/month
Gross margin: $5,200/month (52%)

Much better. Let's go with 20 nodes per operator.
```

## Integration Points

### Wells AI Conversational Flow
1. **Discovery**
   - Founder mentions operational pain
   - Wells asks qualifying questions
   - Identifies which nodes would help

2. **Demo**
   - Wells explains AI Ops concept
   - Shows example automations
   - Demonstrates ROI calculator

3. **Pricing**
   - Wells presents package options
   - Calculates savings vs current cost
   - Handles objections

4. **Close**
   - User agrees
   - Wells creates deal in CRM
   - Triggers onboarding workflow

5. **Onboarding**
   - Operator assigned
   - Integration setup (APIs, credentials)
   - First node deployed
   - Training session

6. **Ongoing**
   - Weekly check-ins (automated)
   - Monthly business reviews
   - Upsell opportunities

### Database Schema

```prisma
model AINode {
  id                String        @id @default(uuid())
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  clientId          String
  operatorId        String
  type              NodeType
  status            NodeStatus    @default(SETUP)
  config            Json
  metrics           Json
  monthlyPrice      Int
  client            User          @relation("ClientNodes", fields: [clientId], references: [id])
  operator          User          @relation("OperatorNodes", fields: [operatorId], references: [id])
  tasks             AITask[]

  @@index([clientId])
  @@index([operatorId])
  @@index([status])
}

model AITask {
  id                String        @id @default(uuid())
  createdAt         DateTime      @default(now())
  completedAt       DateTime?
  nodeId            String
  type              String
  input             Json
  output            Json?
  status            TaskStatus    @default(PENDING)
  automationSuccess Boolean?
  escalated         Boolean       @default(false)
  escalationReason  String?
  processingTime    Int? // milliseconds
  node              AINode        @relation(fields: [nodeId], references: [id])

  @@index([nodeId])
  @@index([status])
  @@index([createdAt])
}

enum NodeType {
  EMAIL_MANAGEMENT
  CRM_UPDATES
  LEAD_QUALIFICATION
  CUSTOMER_SUPPORT
  DATA_ENTRY
  REPORT_GENERATION
  MEETING_SCHEDULING
  INVOICE_PROCESSING
  RESEARCH_TASKS
  CONTENT_MODERATION
}

enum NodeStatus {
  SETUP
  ACTIVE
  PAUSED
  CANCELLED
}

enum TaskStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  ESCALATED
}
```

## Go-to-Market

### Positioning
"AI workforce as a service. We handle your ops so you can focus on growth."

### Target Customers
- Startups (5-50 employees)
- High-growth companies (need to scale ops fast)
- Bootstrapped founders (can't afford full ops team)
- Remote-first companies (distributed ops challenges)

### Sales Process
1. Wells AI identifies operational pain
2. Conversational demo (right in Wells chat)
3. ROI calculator (show time/cost savings)
4. Package selection
5. Close deal
6. 48-hour deployment

### Success Metrics
- Nodes deployed per month
- Client retention (target: 95%+)
- Automation rate (target: 85%+)
- NPS score (target: 50+)
- Upsell rate (additional nodes)

## Competitive Advantage

vs **Zapier/Make**:
- We manage it for you (not DIY)
- Human oversight (not just automation)
- Smarter AI (Claude, not basic triggers)

vs **Virtual Assistants**:
- 24/7 uptime (not human hours)
- Scalable (add nodes instantly)
- Consistent quality (no training new VAs)
- Lower cost (AI does 80-90%)

vs **Hiring Full-Time**:
- No recruitment costs
- No benefits/overhead
- Start in 48 hours (not weeks)
- Pay only for what you need

## Roadmap

### Phase 1: MVP (After Wells Engine Bulletproof)
- Build 3 core nodes:
  - Email management
  - CRM updates
  - Lead qualification
- Operator dashboard (basic)
- Client dashboard (basic)
- Sell through Wells AI

### Phase 2: Scale (Month 2-3)
- Add 7 more nodes
- Advanced dashboards
- Integration marketplace
- Self-service node config

### Phase 3: Enterprise (Month 4-6)
- White-label option
- SLA guarantees
- Dedicated operator teams
- Custom node development

## Success Criteria

**Phase 1 Success:**
- 10 clients using AI Ops
- 3 operators managing 60 nodes total
- $30K MRR
- 90%+ automation rate
- 95%+ client retention

**Phase 2 Success:**
- 50 clients
- 15 operators managing 300 nodes
- $150K MRR
- 85%+ automation rate
- 95%+ retention

**Phase 3 Success:**
- 200 clients
- 60 operators managing 1,200 nodes
- $600K MRR
- 80%+ automation rate
- 90%+ retention
- Enterprise contracts (5+ nodes each)

---

## Action Items (Build After Phase 1)

1. ✅ Document AI Ops module
2. ⏳ Add AI Ops to Wells conversational flow
3. ⏳ Build operator dashboard
4. ⏳ Build client dashboard
5. ⏳ Implement first 3 nodes (email, CRM, leads)
6. ⏳ Create pricing calculator
7. ⏳ Build onboarding automation
8. ⏳ Train first operator
9. ⏳ Launch with 5 beta clients

---

**Built by:** Wells AI
**For:** Wells Onyx AI Ops Practice Group
**Vision:** 1,000 operators managing 20,000 nodes generating $10M ARR
