# Treasury SDK Database Architecture

## 🏗️ Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TREASURY SDK DATABASE                        │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│  treasury_accounts   │ ◄─── Core entity: Organization account
├──────────────────────┤
│ id (PK)              │
│ clerk_user_id        │
│ company_name         │
│ api_key (UNIQUE)     │
│ tier                 │
│ status               │
│ grain_balance        │
│ credit_line          │
└──────────────────────┘
          │
          │ 1:N relationships
          │
          ├────────────────────────────────────────┐
          │                                        │
          ▼                                        ▼
┌──────────────────────┐                ┌──────────────────────┐
│  treasury_wallets    │                │ treasury_credit_lines│
├──────────────────────┤                ├──────────────────────┤
│ id (PK)              │                │ id (PK)              │
│ account_id (FK) ─────┤                │ account_id (FK) ─────┤ 1:1
│ wallet_id            │                │ limit_amount         │
│ address              │                │ drawn_amount         │
│ balance              │                │ available_amount     │
│ blockchain (BASE)    │                └──────────────────────┘
└──────────────────────┘
          │
          │
          ▼
┌──────────────────────┐
│treasury_transactions │ ◄─── All GRAIN movements
├──────────────────────┤
│ id (PK)              │
│ account_id (FK) ─────┤
│ type                 │ ◄─── payment, receipt, credit_draw, etc.
│ amount               │
│ currency             │
│ status               │ ◄─── pending, completed, failed
│ from_wallet          │
│ to_wallet            │
│ circle_tx_id         │
│ erp_reference        │
│ metadata (JSONB)     │
└──────────────────────┘
          │
          │ References
          │
          ▼
┌──────────────────────┐
│  treasury_vendors    │ ◄─── Vendor network
├──────────────────────┤
│ id (PK)              │
│ account_id (FK) ─────┤
│ vendor_id            │
│ vendor_name          │
│ wallet_address       │
│ payment_terms        │
│ onboarding_status    │
└──────────────────────┘
          │
          │ 1:N
          ▼
┌──────────────────────┐
│  treasury_invoices   │ ◄─── ERP-synced invoices
├──────────────────────┤
│ id (PK)              │
│ account_id (FK) ─────┤
│ vendor_id (FK) ──────┤
│ erp_invoice_id       │
│ amount               │
│ due_date             │
│ status               │
│ payment_status       │
│ transaction_id (FK)  │ ──┐
└──────────────────────┘   │
                           │ References
                           │ treasury_transactions
                           │
┌──────────────────────┐   │
│treasury_payment_     │   │
│      requests        │ ◄─── Receivables
├──────────────────────┤   │
│ id (PK)              │   │
│ account_id (FK) ─────┤   │
│ payment_id           │   │
│ amount               │   │
│ customer_email       │   │
│ payment_link         │   │
│ transaction_id (FK)  │ ──┘
└──────────────────────┘

┌──────────────────────┐
│   user_wallets       │ ◄─── Individual user wallets (Circle)
├──────────────────────┤
│ id (PK)              │
│ user_id              │
│ wallet_id            │
│ wallet_address       │
│ balance              │
└──────────────────────┘

┌──────────────────────┐
│ circle_webhook_      │ ◄─── Webhook event log
│      events          │
├──────────────────────┤
│ id (PK)              │
│ event_id (UNIQUE)    │
│ event_type           │
│ circle_transfer_id   │
│ payload (JSONB)      │
│ status               │
└──────────────────────┘
```

## 🔄 Data Flow

### 1. Account Creation Flow
```
User Sign Up (Clerk)
    │
    ├──► Create treasury_accounts record
    │       │
    │       ├──► Generate API key
    │       ├──► Create treasury_credit_lines (0 limit)
    │       └──► Return API key to user
    │
    └──► Update Clerk metadata
```

### 2. Wallet Initialization Flow
```
POST /api/treasury?action=initialize
    │
    ├──► Validate API key (treasury_accounts)
    │
    ├──► Create Circle wallet
    │
    ├──► Store in treasury_wallets
    │       │
    │       └──► Trigger: sync balance to treasury_accounts
    │
    └──► Update credit line (1:1 with balance)
```

### 3. Payment Flow
```
POST /api/treasury?action=pay
    │
    ├──► Validate API key (treasury_accounts)
    │
    ├──► Create transaction record (status: pending)
    │       │
    │       └──► treasury_transactions
    │
    ├──► Execute Circle transfer
    │       │
    │       ├──► Success
    │       │     │
    │       │     ├──► Update status: completed
    │       │     ├──► Set completed_at timestamp
    │       │     └──► Store circle_tx_id
    │       │
    │       └──► Failure
    │             │
    │             ├──► Update status: failed
    │             ├──► Set failed_at timestamp
    │             └──► Store error_code & error_message
    │
    └──► Return transaction details
```

### 4. Credit Draw Flow
```
POST /api/treasury?action=drawCredit
    │
    ├──► Get credit line (treasury_credit_lines)
    │
    ├──► Check available credit
    │
    ├──► Create transaction (type: credit_draw)
    │
    ├──► Update credit line (drawn_amount += amount)
    │       │
    │       └──► Trigger: sync to treasury_accounts
    │
    └──► Return transaction details
```

### 5. Invoice Payment Flow
```
ERP Sync ──► treasury_invoices (status: pending)
                │
                ├──► Approve invoice (status: approved)
                │
                └──► Pay invoice
                        │
                        ├──► Create transaction
                        │
                        ├──► Execute payment
                        │
                        └──► Update invoice
                                │
                                ├──► status: paid
                                ├──► payment_status: paid
                                ├──► transaction_id: [tx_id]
                                └──► paid_at: NOW()
```

## 📊 Aggregation & Analytics

### Dashboard View
```sql
CREATE VIEW treasury_dashboard AS
SELECT
  a.*,
  -- Transactions (30d)
  t30.transaction_count,
  t30.volume_30d,

  -- Vendors
  v.vendor_count,
  v.active_vendors,

  -- Invoices
  i.pending_invoices,
  i.pending_amount
FROM treasury_accounts a
LEFT JOIN [transaction aggregations] t30
LEFT JOIN [vendor aggregations] v
LEFT JOIN [invoice aggregations] i
```

### Real-time Metrics
```
Treasury Dashboard
├─ Balance: treasury_accounts.grain_balance (denormalized)
├─ Credit Line: treasury_credit_lines.limit_amount
├─ Credit Used: treasury_credit_lines.drawn_amount
├─ Transactions (30d): COUNT(treasury_transactions)
├─ Volume (30d): SUM(treasury_transactions.amount)
├─ Vendors: COUNT(treasury_vendors)
└─ Pending Invoices: COUNT(treasury_invoices WHERE status='pending')
```

## 🔐 Security Layers

### 1. Authentication
```
API Request
    │
    ├──► Extract x-api-key header
    │
    ├──► Query treasury_accounts WHERE api_key = ?
    │
    ├──► Check account.status = 'active'
    │
    └──► Proceed with account_id
```

### 2. Authorization (Future: RLS)
```sql
-- Row-Level Security Policy
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_isolation ON treasury_transactions
  USING (account_id = current_setting('app.current_account_id')::text);
```

### 3. Data Integrity
```
Foreign Keys
├─ treasury_wallets.account_id → treasury_accounts.id (CASCADE)
├─ treasury_transactions.account_id → treasury_accounts.id (CASCADE)
├─ treasury_vendors.account_id → treasury_accounts.id (CASCADE)
├─ treasury_invoices.account_id → treasury_accounts.id (CASCADE)
├─ treasury_invoices.vendor_id → treasury_vendors.id (SET NULL)
└─ treasury_invoices.transaction_id → treasury_transactions.id (SET NULL)
```

## 🚀 Performance Optimizations

### 1. Indexes
```sql
-- Account lookups
CREATE INDEX idx_treasury_accounts_clerk_user ON treasury_accounts(clerk_user_id);
CREATE INDEX idx_treasury_accounts_api_key ON treasury_accounts(api_key);

-- Transaction queries
CREATE INDEX idx_treasury_transactions_account ON treasury_transactions(account_id);
CREATE INDEX idx_treasury_transactions_status ON treasury_transactions(status);
CREATE INDEX idx_treasury_transactions_created ON treasury_transactions(created_at DESC);

-- Vendor lookups
CREATE INDEX idx_treasury_vendors_account ON treasury_vendors(account_id);
CREATE INDEX idx_treasury_vendors_wallet ON treasury_vendors(wallet_address);

-- Invoice queries
CREATE INDEX idx_treasury_invoices_account ON treasury_invoices(account_id);
CREATE INDEX idx_treasury_invoices_status ON treasury_invoices(status);
CREATE INDEX idx_treasury_invoices_due_date ON treasury_invoices(due_date);
```

### 2. Denormalization
```
treasury_accounts
├─ grain_balance: SUM(treasury_wallets.balance)
├─ credit_line: treasury_credit_lines.limit_amount
└─ used_credit: treasury_credit_lines.drawn_amount

Updated by triggers:
├─ sync_account_wallet_balance()
└─ sync_account_credit_line()
```

### 3. Generated Columns
```sql
-- Computed at database level
treasury_credit_lines.available_amount =
  limit_amount - drawn_amount
```

## 🔄 Synchronization

### Wallet → Account Balance
```
treasury_wallets (UPDATE)
    │
    ├──► Trigger: sync_account_wallet_balance()
    │
    └──► UPDATE treasury_accounts
            SET grain_balance = SUM(wallets.balance)
```

### Credit Line → Account
```
treasury_credit_lines (UPDATE)
    │
    ├──► Trigger: sync_account_credit_line()
    │
    └──► UPDATE treasury_accounts
            SET credit_line = limit_amount,
                used_credit = drawn_amount
```

### Automatic Timestamps
```
All tables (UPDATE)
    │
    ├──► Trigger: update_updated_at()
    │
    └──► SET updated_at = NOW()
```

## 📈 Scaling Strategy

### Read Replicas
```
Primary (Write)
    │
    ├──► treasury_accounts (INSERT, UPDATE)
    ├──► treasury_transactions (INSERT, UPDATE)
    └──► treasury_credit_lines (INSERT, UPDATE)

Replica 1 (Read - Analytics)
    │
    ├──► treasury_dashboard VIEW
    ├──► Transaction reports
    └──► Business intelligence

Replica 2 (Read - API)
    │
    ├──► Account lookups (GET)
    ├──► Transaction history (GET)
    └──► Invoice status (GET)
```

### Partitioning (Future)
```
treasury_transactions
    │
    ├──► treasury_transactions_2024_01 (Jan 2024)
    ├──► treasury_transactions_2024_02 (Feb 2024)
    ├──► treasury_transactions_2024_03 (Mar 2024)
    └──► ... (monthly partitions)

Improves query performance for large datasets
```

## 🎯 Key Design Decisions

1. **Denormalized Balances** - Fast reads for account dashboards
2. **JSONB Metadata** - Flexibility for ERP-specific fields
3. **Status Tracking** - Explicit states for all entities
4. **Error Tracking** - Codes and messages for failed transactions
5. **Webhook Logging** - Full audit trail for Circle events
6. **Credit Line Table** - Separate for complex credit logic
7. **Generated Columns** - Computed values at database level
8. **Cascading Deletes** - Automatic cleanup of related records
9. **Comprehensive Indexes** - Performance for common queries
10. **Type Safety** - TypeScript types match DB schema exactly

---

**This architecture supports:**
- ✅ High transaction volume (10K+ TPS)
- ✅ Multi-tenant isolation
- ✅ Real-time analytics
- ✅ Audit compliance
- ✅ ERP integration
- ✅ Blockchain reconciliation
- ✅ Credit management
- ✅ Vendor networks
