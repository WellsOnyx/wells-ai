# AI Ops - Correct Architecture

**Product Type:** Human-in-the-Loop Service Platform
**Business Model:** Wells Onyx sells operational support services to companies

---

## Core Concept

Wells Onyx provides **managed AI operations** with human oversight:
- **700+ Wells Onyx employees** serve as human agents
- Each agent manages **10 AI-driven SOPs**
- Total capacity: **7,000 concurrent client operations**
- **Human-in-the-loop** ensures quality and handles edge cases

---

## Key Entities

### 1. Clients (Companies buying the service)
- Purchase operational support packages
- Examples: Tech startups, law firms, consulting firms
- Need: Chief of Staff, Technical Ops, Paralegal work, etc.

### 2. Wells Onyx Agents (700+ employees)
- Manage client operations
- Oversee AI execution
- Handle escalations
- Ensure quality
- Each handles 10 client SOPs

### 3. SOPs (Standard Operating Procedures)
- AI-driven workflows integrated into client tech stacks
- Categories:
  - **Executive Support:** Chief of Staff duties, calendar management, meeting prep
  - **Technical Operations:** DevOps, incident response, deployment monitoring
  - **Legal Operations:** Document review, research, filing management (Paralegal)
  - **Business Operations:** Data entry, reporting, process automation
  - **Customer Operations:** Support triage, response drafting, escalation

### 4. Client Tech Stack Integrations
- Slack, Microsoft Teams
- Google Workspace, Microsoft 365
- Jira, Linear, Asana
- Salesforce, HubSpot
- GitHub, GitLab
- QuickBooks, NetSuite
- And 100+ more...

---

## Dashboard Views

### For Wells Onyx Agents
**Agent Dashboard** (`/ai-ops/agent`)
- My assigned clients (10 SOPs)
- Pending reviews/approvals
- AI suggestions awaiting human review
- Escalations requiring attention
- Performance metrics per client
- Training/onboarding materials

### For Wells Onyx Management
**Management Dashboard** (`/ai-ops/management`)
- All 700 agents status
- Total SOPs running (7,000)
- Client satisfaction scores
- Revenue metrics
- Capacity planning
- Agent performance rankings

### For Clients
**Client Portal** (`/ai-ops/client`)
- Their assigned Wells Onyx agent
- Active SOPs and status
- Recent completions
- Request new tasks
- Communication with agent
- Billing and usage

---

## Example SOPs

### Chief of Staff Package
**Client:** Series B SaaS Startup (CEO needs support)
**Wells Onyx Agent:** Sarah (manages 10 clients)
**SOPs Running:**
1. **Daily Brief Preparation** - AI scrapes news, competitive intel, team updates → Sarah reviews → sends to CEO
2. **Meeting Prep** - AI pulls context, agenda items, previous notes → Sarah adds insights → CEO briefed
3. **Email Triage** - AI categorizes, drafts responses → Sarah approves → sent from CEO's account
4. **Task Follow-up** - AI tracks delegated items → Sarah escalates overdue → CEO notified
5. **Calendar Optimization** - AI suggests time blocks, reschedules conflicts → Sarah confirms → updated

### Technical Operations Package
**Client:** E-commerce Platform (CTO needs DevOps support)
**Wells Onyx Agent:** Marcus (manages 10 clients)
**SOPs Running:**
1. **Incident Response** - AI detects anomalies → Marcus investigates → escalates or resolves
2. **Deployment Monitoring** - AI tracks releases → Marcus verifies success → notifies team
3. **Performance Reporting** - AI generates metrics → Marcus adds analysis → CTO receives weekly
4. **Security Scanning** - AI runs scans → Marcus reviews findings → creates tickets
5. **Cost Optimization** - AI identifies waste → Marcus validates → recommends changes

### Paralegal Package
**Client:** Law Firm (need document support)
**Wells Onyx Agent:** Jennifer (manages 10 clients)
**SOPs Running:**
1. **Document Review** - AI flags key clauses → Jennifer validates → sends summary to attorney
2. **Legal Research** - AI finds precedents → Jennifer verifies relevance → compiles brief
3. **Filing Management** - AI tracks deadlines → Jennifer ensures compliance → files submitted
4. **Client Correspondence** - AI drafts responses → Jennifer reviews → sends from firm
5. **Case Tracking** - AI updates status → Jennifer adds notes → team notified

---

## Pricing Model

### Basic Package - $2,000/month
- 1 dedicated SOP
- 40 hours/month AI + human work
- 24-hour response time
- Email support

### Professional Package - $5,000/month
- 3 dedicated SOPs
- 120 hours/month AI + human work
- 4-hour response time
- Slack/Teams integration
- Dedicated agent

### Enterprise Package - $15,000/month
- 10 dedicated SOPs
- Unlimited AI + human work
- 1-hour response time
- Custom integrations
- Dedicated agent + backup
- Monthly strategy calls

---

## Revenue Math

**If fully utilized:**
- 700 agents × 10 clients each = 7,000 client SOPs
- Average $5,000/month per client = **$35M/month**
- **$420M annual run rate**

**At 50% utilization:**
- 3,500 active client SOPs
- **$17.5M/month = $210M annual**

---

## Dashboard Metrics

### Agent Performance
- SOPs managed: 10/10
- Client satisfaction: 4.8/5.0
- Response time: 2.3 hours (target: 4 hours)
- Escalations handled: 47 this month
- AI accuracy rate: 94% (human caught 6% errors)

### Client Satisfaction
- Tasks completed on time: 98%
- Quality score: 4.9/5.0
- Would recommend: Yes
- Hours saved vs hiring: 160 hours/month

### Wells Onyx Business
- Active clients: 3,500
- Monthly recurring revenue: $17.5M
- Agent utilization: 50%
- Available capacity: 3,500 more clients
- Avg client lifetime: 18 months
- Churn rate: 5%/month

---

## Technology Stack

### AI Layer
- Claude (Anthropic) for reasoning and drafting
- Custom fine-tuned models for domain-specific tasks
- Vector search for knowledge retrieval

### Integration Layer
- Zapier-style connectors to client tools
- OAuth for secure access
- Webhooks for real-time triggers

### Human Layer
- Review queue for agents
- Approval workflows
- Quality scoring
- Training materials

### Client Layer
- Self-service portal
- Real-time status
- Communication tools
- Billing dashboard

---

## Competitive Advantage

1. **Human Oversight** - Not just automation, guaranteed quality
2. **Tech Stack Agnostic** - Works with client's existing tools
3. **Flexible Pricing** - Pay for what you need
4. **Scalable** - From 1 SOP to 100 SOPs per client
5. **Industry Expertise** - Agents trained in specific domains

---

## Next Steps for Dashboard

1. **Rebuild AI Ops UI** to show:
   - Agent view: My 10 clients, pending reviews, escalations
   - Management view: All agents, capacity, revenue
   - Client view: My agent, my SOPs, request tasks

2. **Add Client Management**
   - Client accounts
   - SOP assignments
   - Agent assignments
   - Billing integration

3. **Add Agent Workspace**
   - Review queue
   - Approval workflows
   - Client communication
   - Performance tracking

4. **Add SOP Templates**
   - Pre-built workflows for common use cases
   - Customizable per client
   - Integration configurations

---

This is the correct architecture for AI Ops as a **Human-in-the-Loop Service Platform**.
