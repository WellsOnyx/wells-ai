# Phase 4: Conversational ERP - Master Plan

**Timeline**: Weeks 13-20 (8 weeks)
**Goal**: Full ERP through natural conversation
**Vision**: Replace complex ERP interfaces with AI-powered conversation

---

## Executive Summary

Phase 4 transforms Wells AI from a procurement platform into a **conversational ERP system**. Users will manage procurement, inventory, suppliers, invoicing, payments, and financial reporting through natural language conversation across any platform (web, Slack, Teams, Discord, Google Chat, widget).

### The Revolutionary Shift

**Traditional ERP**:
- Complex multi-screen workflows
- Requires extensive training
- Point-and-click through dozens of menus
- Steep learning curve
- Low adoption rates

**Wells AI Conversational ERP**:
- Natural language: "Create a PO for 100 chairs from Acme Corp, budget $5000"
- Works anywhere: Slack, Teams, web, widget, Discord
- Zero training needed
- Instant responses
- 100% adoption

### Example Workflows

**Procurement (Traditional)**:
1. Login to ERP
2. Navigate to Procurement → Purchase Orders
3. Click "New PO"
4. Fill 20+ fields across 4 screens
5. Search for supplier
6. Add line items
7. Calculate totals
8. Route for approval
9. Submit

**Procurement (Wells AI)**:
```
User: "Create a PO for 100 office chairs from Acme Corp, need by Dec 1, budget $5000"

Wells AI: "Creating purchase order:
• Supplier: Acme Corp
• Item: Office chairs (100 units)
• Budget: $5,000
• Deadline: Dec 1, 2025

Ready to send for approval?"

User: "Yes"

Wells AI: "✅ PO-12345 created and sent to Jane (manager) for approval. I'll notify you when approved."
```

**Time**: 30 seconds vs 15 minutes. **98% time savings**.

---

## Architecture Overview

### Conversational AI Engine

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input (Any Platform)                 │
│          Web │ Slack │ Teams │ Discord │ Chat │ Widget      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Conversational Intent Router                    │
│  • Parse natural language (Claude Sonnet 4)                 │
│  • Extract entities (PO details, amounts, dates)            │
│  • Determine intent (create, update, query, report)         │
│  • Maintain conversation context                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│  Procurement Module  │      │   Finance Module     │
│  • PO Management     │      │  • Invoice Gen       │
│  • Inventory Mgmt    │      │  • Payment Tracking  │
│  • Supplier Mgmt     │      │  • Reporting         │
└──────────┬───────────┘      └──────────┬───────────┘
           │                             │
           └───────────┬─────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Action Execution Layer                      │
│  • Database Operations (Postgres)                           │
│  • ERP Sync (Merge.dev)                                     │
│  • Approval Workflows                                       │
│  • Notifications (Email, Slack, SMS)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Response Generator                        │
│  • Format response for platform                             │
│  • Add interactive components (buttons, cards)              │
│  • Suggest next actions                                     │
└─────────────────────────────────────────────────────────────┘
```

### Core Technologies

**AI/NLP**:
- Claude Sonnet 4 (primary conversational AI)
- Function calling for structured data extraction
- Few-shot prompting for domain expertise
- Conversation memory/context tracking

**Database**:
- PostgreSQL for transactional data
- Redis for conversation state
- Pinecone for semantic search (suppliers, products)

**Integration**:
- Merge.dev for ERP sync
- Notion for approval workflows
- Twilio for SMS notifications
- Slack/Teams/Discord for platform integration

---

## Phase 4 Timeline

### Weeks 13-14: Core Conversational Engine

**Goal**: Build foundation for conversational ERP

**Deliverables**:
- [ ] Conversational AI engine (lib/conversational-engine.ts)
- [ ] Intent classification system
- [ ] Entity extraction (amounts, dates, names, IDs)
- [ ] Context management (conversation memory)
- [ ] Multi-turn conversation support
- [ ] Platform-agnostic response formatting

**Key Features**:
- Parse natural language into structured actions
- Maintain conversation state across messages
- Handle ambiguity ("Which supplier did you mean?")
- Support complex queries ("What are my open POs over $10k?")
- Seamless handoff between topics

**Example Conversations**:
```
User: "What POs are pending approval?"
AI: "You have 3 POs pending approval:
1. PO-12345: $5,000 - Office chairs from Acme
2. PO-12346: $12,000 - Laptops from TechCorp
3. PO-12347: $800 - Desk supplies from OfficePro

Which would you like to review?"

User: "The laptops one"
AI: "PO-12346 - TechCorp Laptops:
• Quantity: 25 Dell XPS 15 laptops
• Unit Price: $480
• Total: $12,000
• Requester: John Smith (Engineering)
• Needed by: Dec 15, 2025

Approve, reject, or request changes?"

User: "Approve if we can negotiate down to $450 per unit"
AI: "I'll reach out to TechCorp to negotiate $450/unit ($11,250 total).
Setting approval as conditional on price negotiation. Want me to send the message now?"
```

---

### Weeks 15-16: Procurement Module

**Goal**: Complete procurement management via conversation

#### Feature Set

**1. Purchase Order Management**

**Create POs**:
```
"Create a PO for 50 laptops from Dell, budget $25k, need by Jan 15"
"Buy 100 reams of paper, find cheapest supplier"
"Order same as last month from Acme Corp"
```

**Query POs**:
```
"Show my open POs"
"What's the status of PO-12345?"
"How much have I spent this month?"
"List all POs over $10k pending approval"
```

**Update POs**:
```
"Increase PO-12345 quantity to 75"
"Change delivery date on laptop order to Jan 20"
"Cancel the paper order"
```

**Approve POs**:
```
"Approve PO-12345"
"Approve all POs under $5k"
"Reject the office furniture PO, budget exceeded"
```

**2. Inventory Management**

**Check Stock**:
```
"Do we have office chairs in stock?"
"What's our current inventory of printer paper?"
"Show items below reorder point"
```

**Reorder Alerts**:
```
"Alert me when printer paper falls below 20 reams"
"What needs to be reordered this week?"
"Auto-reorder paper when stock is low"
```

**Inventory Reports**:
```
"Show inventory turnover rate"
"What's our inventory value?"
"Which items are moving slowest?"
```

**3. Supplier Management**

**Find Suppliers**:
```
"Who supplies office chairs?"
"Find new steel suppliers in Texas"
"Show me suppliers with ratings above 4.5"
```

**Supplier Performance**:
```
"How's Acme Corp performing?"
"Which suppliers have the best on-time delivery?"
"Show supplier scorecard for Q4"
```

**Supplier Relationships**:
```
"When was our last order from TechCorp?"
"What's our total spend with Acme this year?"
"Who are my top 5 suppliers by volume?"
```

#### Database Schema (Procurement Module)

```sql
-- Purchase Orders
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  buyer_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  total_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  requested_by VARCHAR(255),
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  due_date DATE,
  notes TEXT,
  conversation_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- PO Line Items
CREATE TABLE po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inventory
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  quantity_on_hand INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,
  quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  unit_cost DECIMAL(10,2),
  location VARCHAR(255),
  supplier_id UUID REFERENCES suppliers(id),
  last_reorder_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory Transactions
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id),
  transaction_type VARCHAR(50), -- 'purchase', 'sale', 'adjustment', 'transfer'
  quantity INTEGER NOT NULL,
  reference_type VARCHAR(50), -- 'po', 'invoice', 'manual'
  reference_id UUID,
  notes TEXT,
  performed_by VARCHAR(255),
  performed_at TIMESTAMP DEFAULT NOW()
);

-- Reorder Alerts
CREATE TABLE reorder_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id),
  current_quantity INTEGER NOT NULL,
  reorder_point INTEGER NOT NULL,
  suggested_quantity INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'ordered', 'dismissed'
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Supplier Performance Metrics
CREATE TABLE supplier_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  metric_period VARCHAR(20), -- 'monthly', 'quarterly', 'yearly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_spend DECIMAL(12,2) DEFAULT 0,
  on_time_delivery_rate DECIMAL(5,2), -- percentage
  quality_rating DECIMAL(3,2), -- 0-5 scale
  response_time_hours DECIMAL(8,2), -- average response time
  defect_rate DECIMAL(5,2), -- percentage
  created_at TIMESTAMP DEFAULT NOW()
);

-- Approval Workflows
CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50), -- 'purchase_order', 'invoice', etc.
  entity_id UUID NOT NULL,
  approval_step INTEGER DEFAULT 1,
  approver_id VARCHAR(255) NOT NULL,
  approver_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  comments TEXT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Conversation Context
CREATE TABLE conversation_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50), -- 'slack', 'teams', 'web', etc.
  current_intent VARCHAR(100),
  context_data JSONB, -- stores entities, state, etc.
  last_message TEXT,
  last_response TEXT,
  last_activity_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Weeks 17-18: Finance Module (Part 1: Invoicing & Payments)

**Goal**: Conversational invoice and payment management

#### Feature Set

**1. Invoice Generation**

**Create Invoices**:
```
"Generate invoice for PO-12345"
"Invoice Acme Corp for last month's deliveries"
"Create invoice from deal #789"
```

**Invoice Queries**:
```
"Show unpaid invoices"
"What invoices are overdue?"
"How much is Acme Corp owed?"
"When is invoice INV-456 due?"
```

**Invoice Management**:
```
"Mark invoice INV-456 as paid"
"Send payment reminder for overdue invoices"
"Void invoice INV-789"
```

**2. Payment Tracking**

**Record Payments**:
```
"Record $5000 payment from Acme Corp"
"Mark PO-12345 as paid"
"Log check #1234 for $2500"
```

**Payment Status**:
```
"What payments are due this week?"
"Show payment history for Acme Corp"
"Track payment for invoice INV-456"
```

**Payment Reconciliation**:
```
"Reconcile bank statement"
"Which payments are unmatched?"
"Show pending deposits"
```

**3. Accounts Payable/Receivable**

**AP Queries**:
```
"What do we owe suppliers?"
"Show aging report for payables"
"When is next payment run?"
```

**AR Queries**:
```
"Who owes us money?"
"Show aging report for receivables"
"What's our DSO?" (Days Sales Outstanding)
```

#### Database Schema (Finance Module Part 1)

```sql
-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_type VARCHAR(50), -- 'payable', 'receivable'
  customer_id VARCHAR(255),
  supplier_id UUID REFERENCES suppliers(id),
  po_id UUID REFERENCES purchase_orders(id),
  deal_id UUID REFERENCES deals(id),
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue', 'void'
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  amount_due DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  currency VARCHAR(3) DEFAULT 'USD',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_terms VARCHAR(50), -- 'Net 30', 'Net 60', etc.
  notes TEXT,
  conversation_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoice Line Items
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  payment_type VARCHAR(50), -- 'received', 'sent'
  payment_method VARCHAR(50), -- 'check', 'ach', 'wire', 'credit_card'
  payer_id VARCHAR(255),
  payee_id VARCHAR(255),
  invoice_id UUID REFERENCES invoices(id),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100), -- check number, transaction ID, etc.
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'cleared', 'failed', 'void'
  notes TEXT,
  conversation_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment Allocations (payments applied to invoices)
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  amount_allocated DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Weeks 19-20: Finance Module (Part 2: Reporting & Analytics)

**Goal**: Conversational financial reporting and analytics

#### Feature Set

**1. Financial Reports**

**P&L (Profit & Loss)**:
```
"Show P&L for last quarter"
"What's our profit margin this month?"
"Compare Q4 2024 vs Q4 2025 revenue"
```

**Balance Sheet**:
```
"Show current balance sheet"
"What's our current ratio?"
"How much cash do we have?"
```

**Cash Flow**:
```
"Show cash flow statement"
"What's our burn rate?"
"Forecast cash for next 3 months"
```

**2. Budget Tracking**

**Budget Queries**:
```
"How much of Q4 budget is spent?"
"What departments are over budget?"
"Show budget vs actual for procurement"
```

**Budget Alerts**:
```
"Alert me when procurement hits 80% of budget"
"What's about to go over budget?"
"Show variance analysis"
```

**3. Analytics & Insights**

**Spend Analysis**:
```
"What's our biggest expense category?"
"Show spend by supplier"
"What are we spending on office supplies?"
```

**Trend Analysis**:
```
"Show spending trend for last 6 months"
"Is our supplier cost increasing?"
"Compare this quarter to last quarter"
```

**Forecasting**:
```
"Forecast Q1 2026 spend based on trends"
"When will we hit $1M in revenue?"
"Predict cash runway"
```

**4. Custom Reports**

**Ad-hoc Queries**:
```
"Show all transactions over $10k last month"
"Which suppliers have we paid the most?"
"What's our average PO size?"
"Show top 10 expenses this year"
```

#### Database Schema (Finance Module Part 2)

```sql
-- Budget Plans
CREATE TABLE budget_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  period_type VARCHAR(20), -- 'monthly', 'quarterly', 'yearly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  department VARCHAR(100),
  category VARCHAR(100),
  budgeted_amount DECIMAL(12,2) NOT NULL,
  actual_amount DECIMAL(12,2) DEFAULT 0,
  variance DECIMAL(12,2) GENERATED ALWAYS AS (budgeted_amount - actual_amount) STORED,
  variance_pct DECIMAL(5,2),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Financial Transactions (ledger)
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(50), -- 'revenue', 'expense', 'asset', 'liability'
  category VARCHAR(100),
  subcategory VARCHAR(100),
  account_code VARCHAR(50),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  description TEXT,
  reference_type VARCHAR(50), -- 'invoice', 'payment', 'po'
  reference_id UUID,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Saved Reports
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(100), -- 'pl', 'balance_sheet', 'cash_flow', 'custom'
  filters JSONB, -- date range, categories, etc.
  schedule VARCHAR(50), -- 'daily', 'weekly', 'monthly', null for ad-hoc
  last_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics Cache
CREATE TABLE analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  metric_type VARCHAR(100),
  metric_value JSONB,
  period_start DATE,
  period_end DATE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Technical Implementation

### Conversational Engine Core

**lib/conversational-engine.ts**:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { query } from './db';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationContext {
  conversationId: string;
  userId: string;
  platform: string;
  intent?: string;
  entities?: Record<string, any>;
  history: ConversationMessage[];
}

export interface ParsedIntent {
  intent: string; // 'create_po', 'query_inventory', 'generate_invoice', etc.
  entities: Record<string, any>;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export async function parseIntent(
  message: string,
  context: ConversationContext
): Promise<ParsedIntent> {
  const systemPrompt = `You are Wells AI, a conversational ERP assistant.

Your capabilities:
- Procurement: Create/query/update POs, manage inventory, track suppliers
- Finance: Generate invoices, track payments, create reports

Parse user messages and extract:
1. Intent (what they want to do)
2. Entities (PO numbers, amounts, dates, supplier names, etc.)
3. Whether clarification is needed

Respond with JSON:
{
  "intent": "create_po|query_po|check_inventory|generate_invoice|etc",
  "entities": {
    "supplier": "Acme Corp",
    "product": "office chairs",
    "quantity": 100,
    "budget": 5000,
    "date": "2025-12-01"
  },
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationQuestion": null
}

If information is missing, set needsClarification: true and ask a specific question.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      ...context.history,
      {
        role: 'user',
        content: message,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    const parsed = JSON.parse(content.text);
    return parsed;
  }

  throw new Error('Invalid response from AI');
}

export async function generateResponse(
  intent: ParsedIntent,
  executionResult: any,
  context: ConversationContext
): Promise<string> {
  const systemPrompt = `You are Wells AI. Generate a friendly, concise response based on the action result.

Guidelines:
- Be conversational and helpful
- Use emojis sparingly
- Format numbers with commas
- Suggest next actions when appropriate
- Keep responses under 200 words for chat platforms

Format:
- Use **bold** for emphasis
- Use bullet points for lists
- Use line breaks for readability`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Intent: ${intent.intent}\nResult: ${JSON.stringify(executionResult)}\n\nGenerate a response to the user.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  return 'Action completed successfully.';
}
```

### Intent Handlers

**lib/procurement/po-handler.ts**:

```typescript
import { query } from '../db';
import { ParsedIntent } from '../conversational-engine';

export async function createPO(entities: Record<string, any>, userId: string) {
  // Extract entities
  const supplier = entities.supplier;
  const product = entities.product;
  const quantity = entities.quantity || 1;
  const budget = entities.budget;
  const dueDate = entities.date;

  // Find supplier
  const supplierResult = await query<any>(
    `SELECT id, name FROM suppliers WHERE name ILIKE $1 LIMIT 1`,
    [`%${supplier}%`]
  );

  if (supplierResult.rows.length === 0) {
    throw new Error(`Supplier "${supplier}" not found. Would you like to add them?`);
  }

  const supplierId = supplierResult.rows[0].id;

  // Generate PO number
  const poNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  // Calculate amounts
  const unitPrice = budget / quantity;
  const totalAmount = budget;

  // Create PO
  const poResult = await query<any>(
    `INSERT INTO purchase_orders (
      po_number, supplier_id, buyer_id, status, total_amount, due_date, requested_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [poNumber, supplierId, userId, 'pending_approval', totalAmount, dueDate, userId]
  );

  const poId = poResult.rows[0].id;

  // Add line item
  await query(
    `INSERT INTO po_line_items (po_id, product_name, quantity, unit_price, total_price)
    VALUES ($1, $2, $3, $4, $5)`,
    [poId, product, quantity, unitPrice, totalAmount]
  );

  return {
    poNumber,
    supplier: supplierResult.rows[0].name,
    product,
    quantity,
    budget,
    dueDate,
    status: 'pending_approval',
  };
}

export async function queryPOs(entities: Record<string, any>, userId: string) {
  let whereClause = 'WHERE buyer_id = $1';
  const params: any[] = [userId];

  if (entities.status) {
    whereClause += ` AND status = $${params.length + 1}`;
    params.push(entities.status);
  }

  if (entities.minAmount) {
    whereClause += ` AND total_amount >= $${params.length + 1}`;
    params.push(entities.minAmount);
  }

  if (entities.supplier) {
    whereClause += ` AND supplier_id IN (SELECT id FROM suppliers WHERE name ILIKE $${params.length + 1})`;
    params.push(`%${entities.supplier}%`);
  }

  const result = await query<any>(
    `SELECT po.*, s.name as supplier_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT 10`,
    params
  );

  return result.rows;
}
```

---

## Success Metrics

### Week 13-14 (Conversational Engine)
- [ ] Intent classification accuracy > 95%
- [ ] Entity extraction accuracy > 90%
- [ ] Response generation < 2 seconds
- [ ] Support for 20+ intents
- [ ] Multi-turn conversations work smoothly

### Week 15-16 (Procurement Module)
- [ ] 100% of PO operations possible via conversation
- [ ] Inventory queries respond < 1 second
- [ ] Supplier search accuracy > 95%
- [ ] 10+ users actively using conversational procurement
- [ ] 50+ POs created via conversation

### Week 17-18 (Finance Module Part 1)
- [ ] Invoice generation from conversation works 100%
- [ ] Payment tracking accuracy > 99%
- [ ] AP/AR queries respond < 1 second
- [ ] 20+ invoices generated via conversation
- [ ] Payment reconciliation success rate > 95%

### Week 19-20 (Finance Module Part 2)
- [ ] All financial reports accessible via conversation
- [ ] Budget tracking real-time
- [ ] Analytics queries respond < 2 seconds
- [ ] Custom reports generated via conversation
- [ ] Forecasting accuracy > 85%

---

## Integration Points

### Platform Integrations

**All Phase 3 platforms supported**:
- Web interface (chat component)
- Slack (conversational commands)
- Microsoft Teams (conversational bot)
- Discord (conversational slash commands)
- Google Chat (conversational messages)
- Widget (conversational embed)

**Unified Interface**:
```typescript
// app/api/conversation/route.ts
export async function POST(req: NextRequest) {
  const { message, userId, platform, conversationId } = await req.json();

  // Get conversation context
  const context = await getConversationContext(conversationId, userId, platform);

  // Parse intent
  const intent = await parseIntent(message, context);

  // Handle clarification
  if (intent.needsClarification) {
    return NextResponse.json({
      response: intent.clarificationQuestion,
      requiresInput: true,
    });
  }

  // Execute action based on intent
  const result = await executeIntent(intent, userId);

  // Generate response
  const response = await generateResponse(intent, result, context);

  // Update context
  await updateConversationContext(conversationId, message, response, intent);

  return NextResponse.json({ response, data: result });
}
```

### ERP Sync Integration

Conversational actions sync to connected ERPs:

```typescript
// After creating PO via conversation
const po = await createPO(entities, userId);

// Sync to customer's ERP if connected
const erpConnection = await getERPConnection(userId);
if (erpConnection) {
  await syncPOToERP(po.id, erpConnection.accountToken);
}
```

### Approval Workflows

Conversational approvals trigger Notion/email workflows:

```typescript
// When PO needs approval
if (po.total_amount > 5000) {
  const approver = await getApprover(userId, 'purchase_order');
  await sendApprovalRequest({
    approver,
    entity: 'purchase_order',
    entityId: po.id,
    amount: po.total_amount,
    requestedBy: userId,
  });
}
```

---

## User Experience Examples

### Example 1: Daily Procurement Workflow

**Morning Check-in**:
```
User: "Good morning, what needs my attention?"

Wells AI: "Good morning! Here's your procurement dashboard:

📦 **Pending Approvals**: 3 POs ($47,000 total)
⚠️ **Low Stock Alerts**: 5 items below reorder point
📅 **Due Today**: 2 POs need to be sent
💰 **Budget Status**: 73% of Q4 budget used

Would you like to:
1. Review pending approvals
2. Handle reorders
3. Send due POs
4. See detailed budget breakdown"

User: "Handle reorders"

Wells AI: "5 items below reorder point:

1. **Printer Paper** - 8 reams (reorder at 20)
   Usual supplier: OfficePro ($12/ream)
   Suggested order: 50 reams

2. **Coffee** - 3 bags (reorder at 10)
   Usual supplier: JavaCo ($24/bag)
   Suggested order: 30 bags

3. **Desk Lamps** - 2 units (reorder at 5)
   ...

Auto-reorder all from usual suppliers?"

User: "Yes, approve all"

Wells AI: "✅ Created 5 POs totaling $2,340:
- PO-45601: OfficePro - Printer Paper
- PO-45602: JavaCo - Coffee
- PO-45603: LightCo - Desk Lamps
- PO-45604: CleanCo - Cleaning Supplies
- PO-45605: TechCorp - HDMI Cables

All sent to suppliers. Expected delivery: Dec 5-7.
I'll notify you when they ship."
```

### Example 2: Financial Reporting

**Month-End Close**:
```
User: "Show me November financials"

Wells AI: "**November 2025 Financial Summary**:

**Revenue**: $487,500 (+12% vs October)
**Expenses**: $293,100 (-5% vs October)
**Net Profit**: $194,400 (40% margin)

**Top Expenses**:
1. Payroll: $180,000 (61%)
2. Procurement: $67,000 (23%)
3. Marketing: $28,500 (10%)
4. Operations: $17,600 (6%)

**Cash Flow**: +$156,000
**AR Aging**: $234,000 outstanding (67% current)
**AP Aging**: $89,000 owed (92% current)

Need detailed breakdown of any category?"

User: "Why did procurement drop 5%?"

Wells AI: "**Procurement Analysis** (Nov vs Oct):

**October**: $308,000
**November**: $293,000
**Difference**: -$15,000 (-5%)

**Reasons**:
1. Fewer equipment purchases ($45K Oct vs $12K Nov) ✅
2. Office supplies optimization ($23K saved via bulk buying) ✅
3. One-time server upgrade in Oct ($18K) - not repeated ✅

**This is healthy** - equipment spending normalized after Oct upgrade.

**Forecast**: December procurement should be ~$280K (holiday slowdown).

Want to see detailed spend by category?"
```

### Example 3: Complex Multi-Step Workflow

**Negotiation + PO + Invoice Flow**:
```
User: "I need 200 office chairs urgently"

Wells AI: "I'll help you source 200 office chairs. A few questions:

1. What's your budget per chair?
2. When do you need them by?
3. Any specific requirements (ergonomic, color, etc.)?"

User: "Budget $150 per chair, need by Dec 15, must be ergonomic"

Wells AI: "Searching suppliers for ergonomic office chairs...

Found 3 suppliers in your network:

1. **OfficePro** ⭐ 4.8/5
   - $145/chair ($29,000 total)
   - Delivery: Dec 10
   - Previous order: Sep 2025 (great experience)

2. **ErgoChair Inc** ⭐ 4.6/5
   - $139/chair ($27,800 total)
   - Delivery: Dec 12
   - New supplier (verified)

3. **FurnitureCo** ⭐ 4.9/5
   - $158/chair ($31,600 total)
   - Delivery: Dec 8
   - Premium option

Best value: ErgoChair Inc ($1,200 savings)
Fastest: FurnitureCo (Dec 8)
Trusted: OfficePro (prior relationship)

Which do you prefer?"

User: "Let's negotiate with ErgoChair to match OfficePro delivery"

Wells AI: "Great idea. Reaching out to ErgoChair...

✅ **ErgoChair Inc responded**:
They can deliver Dec 10 if order is placed today.
Price remains $139/chair.

**Final terms**:
- 200 ErgoChair Pro ergonomic chairs
- $139/chair = $27,800 total
- Delivery: Dec 10, 2025
- Payment terms: Net 30

Create PO?"

User: "Yes"

Wells AI: "✅ **PO-45678 Created**:

**Supplier**: ErgoChair Inc
**Items**: 200 ErgoChair Pro chairs
**Amount**: $27,800
**Delivery**: Dec 10, 2025

**Status**: Sent to CFO (Jane Smith) for approval (>$25K threshold)

I'll notify you when:
1. Jane approves
2. Chairs ship
3. Invoice arrives

Anything else?"

User: "When should I expect the invoice?"

Wells AI: "Based on ErgoChair's Net 30 terms:

**Timeline**:
- Dec 10: Delivery
- Dec 11: They'll invoice (typical 1 day after delivery)
- **Jan 10, 2026**: Payment due (30 days)

I'll:
1. Auto-generate the invoice in our system when it arrives
2. Schedule payment for Jan 8 (2 days early for good relationship)
3. Send you a reminder Dec 20 to verify delivery quality

Want me to set up auto-pay for this?"
```

---

## Competitive Advantage

### vs Traditional ERP (SAP, Oracle, NetSuite)

| Feature | Traditional ERP | Wells AI Conversational ERP |
|---------|----------------|----------------------------|
| **Learning Curve** | Weeks of training | Zero - natural language |
| **Interface** | 100+ screens | Conversation |
| **Speed** | 5-15 min per task | 30 seconds |
| **Mobile** | Limited, clunky | Works in Slack, Teams, etc. |
| **Cost** | $50K-$500K/year | $0.33% per transaction |
| **Adoption** | 30-40% | 95%+ |
| **AI** | Basic reports | Full conversational AI |

### vs Modern ERP (Workday, Coupa, Netsuite Cloud)

| Feature | Modern ERP | Wells AI |
|---------|-----------|----------|
| **Conversational** | Limited chatbots | Full conversational control |
| **Multi-platform** | Web + mobile app | Web + Slack + Teams + Discord + Widget |
| **AI Intelligence** | Rules-based | Claude Sonnet 4 |
| **Flexibility** | Rigid workflows | Adapt to any question |
| **Integration** | APIs | Native + conversational |
| **Price** | $10K-$100K/year | 0.33% |

### vs Procurement Platforms (Coupa, Jaggaer, SAP Ariba)

Wells AI does everything they do, but:
- ✅ **Through conversation** (they're still UI-based)
- ✅ **Works everywhere** (they require logging into their platform)
- ✅ **AI-powered end-to-end** (they're workflow automation, not AI)
- ✅ **98% cheaper** (0.33% vs 1-3% take rate)

---

## Risk Mitigation

### Technical Risks

**1. AI Hallucinations**
- **Risk**: Claude generates incorrect PO amounts or misunderstands intent
- **Mitigation**:
  - Structured output validation
  - Confirmation prompts for high-value transactions (>$5K)
  - Human-in-loop for approvals
  - Audit log of all AI decisions

**2. Conversation Context Loss**
- **Risk**: Long conversations lose context, leading to errors
- **Mitigation**:
  - Redis-backed conversation memory
  - Context summarization after 10 messages
  - Explicit context reset command ("start over")
  - Maximum conversation length (50 messages)

**3. Data Security**
- **Risk**: Sensitive financial data exposed in conversations
- **Mitigation**:
  - End-to-end encryption for conversation storage
  - PII redaction in logs
  - Role-based access control
  - Audit trail for all data access

### Business Risks

**1. User Adoption**
- **Risk**: Users prefer traditional UI over conversation
- **Mitigation**:
  - Both interfaces available (conversation + traditional)
  - Extensive onboarding and training
  - Start with simple workflows
  - Gather feedback and iterate

**2. Accuracy Requirements**
- **Risk**: Financial/procurement errors are costly
- **Mitigation**:
  - Approval workflows for high-value items
  - Reconciliation checks
  - Automated error detection
  - Rollback capabilities

---

## Next Steps

### Immediate (Week 13)

1. **Create conversational engine** (lib/conversational-engine.ts)
2. **Set up conversation context storage** (Redis + Postgres)
3. **Build intent classification system**
4. **Test with simple queries** ("What POs are pending?")
5. **Integrate with existing chat endpoints**

### This Week's Goals

By end of Week 14:
- [ ] Conversational engine handling 20+ intents
- [ ] Multi-turn conversations working
- [ ] Integration with all Phase 3 platforms
- [ ] Basic procurement queries working
- [ ] Documentation for conversational API

---

## Summary

Phase 4 transforms Wells AI into the world's first **conversational ERP system**. Users will manage procurement, inventory, suppliers, invoices, payments, and financial reporting through natural language across any platform.

**Timeline**: 8 weeks (Weeks 13-20)

**Deliverables**:
- Conversational AI engine
- Complete procurement module (PO, inventory, suppliers)
- Complete finance module (invoicing, payments, reporting)
- Works on all platforms (web, Slack, Teams, Discord, Chat, widget)
- 100+ conversational intents supported
- Real-time ERP sync

**Impact**:
- **98% faster** than traditional ERP
- **Zero training** required
- **95%+ adoption** (vs 30-40% for traditional ERP)
- **Revolutionary UX** - ERP through conversation

**Competitive Position**: No other ERP system offers full conversational control. This is a category-defining feature.

Let's build the future of ERP. 🚀

---

Built with precision. Powered by trust. Designed for generations.
*Wells Onyx | Trust + Outcomes*
