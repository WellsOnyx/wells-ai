# Wells AI Partner Portal - User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PARTNER JOURNEY                              │
└─────────────────────────────────────────────────────────────────────┘


┌──────────────┐
│   DISCOVERY  │
└──────┬───────┘
       │
       v
┌─────────────────────────────────────────────────────────────────────┐
│  /partners (Landing Page)                                            │
│  ────────────────────────────                                        │
│  • Hero: "Embed Treasury, Earn 20% Revenue Share"                   │
│  • Benefits: Revenue, Integration, Security                          │
│  • How It Works: 4-step diagram                                     │
│  • Use Cases: Marketplaces, Accounting, HR, E-commerce              │
│  • CTA: "Apply Now" button                                          │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              v
                         [Click Apply]
                              │
                              v
┌─────────────────────────────────────────────────────────────────────┐
│  /partners/apply (Application Form)                                  │
│  ───────────────────────────────────                                 │
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Step 1  │→ │  Step 2  │→ │  Step 3  │→ │  Step 4  │            │
│  │ Company  │  │ Contact  │  │ Platform │  │ Revenue  │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                       │
│  Step 1: Company Info                                                │
│    • Company Name                                                    │
│    • Platform Name                                                   │
│    • Domain                                                          │
│    • Industry (dropdown)                                             │
│                                                                       │
│  Step 2: Contact Info                                                │
│    • Full Name                                                       │
│    • Email                                                           │
│    • Phone                                                           │
│                                                                       │
│  Step 3: Platform Details                                            │
│    • Estimated Monthly Volume (dropdown: $0-$10M+)                   │
│    • Estimated Monthly Transactions (dropdown: 0-100K+)              │
│    • Use Case (textarea)                                             │
│    • Current Payment Provider (optional)                             │
│                                                                       │
│  Step 4: Revenue Share                                               │
│    • Slider: 15% - 30% (default: 20%)                               │
│    • Real-time breakdown calculator                                  │
│    • Example: $1,000 transaction shows fees                         │
│                                                                       │
│  [Submit Application]                                                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              v
                    [POST /api/partners]
                              │
                              v
                    ┌─────────────────┐
                    │  Auto-Approved  │
                    │   Generate:     │
                    │  • API Key      │
                    │  • Webhook Key  │
                    └────────┬────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────────┐
│  SUCCESS SCREEN (One-time display)                                   │
│  ──────────────────────────────────────                              │
│                                                                       │
│  ✓ Application Approved!                                             │
│                                                                       │
│  ⚠️  Important: Store these credentials - shown only once            │
│                                                                       │
│  ┌───────────────────────────────────────────┐                      │
│  │ API Key: wl_a1b2c3d4e5f6...       [Copy] │                      │
│  └───────────────────────────────────────────┘                      │
│                                                                       │
│  ┌───────────────────────────────────────────┐                      │
│  │ Webhook Secret: abc123...         [Copy] │                      │
│  └───────────────────────────────────────────┘                      │
│                                                                       │
│  [Go to Dashboard]  [View API Docs]                                 │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                v                           v
         [Integration]              [Dashboard Access]
                │                           │
                v                           v
┌───────────────────────────┐    ┌─────────────────────────────────┐
│  /partners/docs           │    │  /partners/dashboard            │
│  ───────────────          │    │  ────────────────               │
│                           │    │                                 │
│  Tabs:                    │    │  Overview Cards:                │
│  • Overview               │    │  ┌────────┬────────┬────────┐  │
│  • Authentication         │    │  │ Volume │  Fees  │ Txns   │  │
│  • API Endpoints          │    │  │ $2.4M  │ $4.8K  │ 1,234  │  │
│  • Webhooks               │    │  └────────┴────────┴────────┘  │
│  • Error Handling         │    │                                 │
│                           │    │  Volume Chart (30 days)         │
│  Code Examples:           │    │  ┌────────────────────────┐    │
│  • cURL                   │    │  │     📊 Bar Chart       │    │
│  • JavaScript             │    │  └────────────────────────┘    │
│  • Python                 │    │                                 │
│                           │    │  Recent Transactions            │
│  Endpoints:               │    │  ┌────────────────────────┐    │
│  POST /partners/transact  │    │  │ ID   │ Amount │ Fee    │    │
│  GET  /partners/balance   │    │  │ tx_1 │ $1,000 │ $2.00  │    │
│                           │    │  │ tx_2 │  $500  │ $1.00  │    │
└───────────────────────────┘    │  └────────────────────────┘    │
                                 │                                 │
                                 │  [Settings] [API Docs] [Logout] │
                                 └─────────────────────────────────┘
                                              │
                                              v
                                     [Click Settings]
                                              │
                                              v
                         ┌────────────────────────────────────────┐
                         │  /partners/settings                    │
                         │  ──────────────────                    │
                         │                                        │
                         │  Contact Information                   │
                         │  ┌──────────────────────┐              │
                         │  │ Name, Email, Phone   │ [Save]       │
                         │  └──────────────────────┘              │
                         │                                        │
                         │  Webhook Configuration                 │
                         │  ┌──────────────────────┐              │
                         │  │ Webhook URL          │ [Save]       │
                         │  └──────────────────────┘              │
                         │                                        │
                         │  API Key Management                    │
                         │  ┌──────────────────────┐              │
                         │  │ Current: wl_abc...   │ [Active]     │
                         │  │ [Regenerate API Key] │              │
                         │  └──────────────────────┘              │
                         │                                        │
                         │  Account Information (Read-only)       │
                         │  • Company Name                        │
                         │  • Revenue Share: 20%                  │
                         │  • Status: Active                      │
                         │  • Member Since: Jan 2025              │
                         └────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                         TECHNICAL FLOW                               │
└─────────────────────────────────────────────────────────────────────┘

Partner Integration → Wells API → Silent Enrollment → Revenue Share

┌──────────────┐
│   Partner    │
│   Platform   │
└──────┬───────┘
       │
       │ POST /partners/transact
       │ Headers: X-API-Key: wl_abc123...
       │ Body: {
       │   sender_id: "user_1",
       │   recipient_id: "user_2",
       │   amount: 1000
       │ }
       │
       v
┌─────────────────────────────────────────┐
│  Wells API (/api/partners/transact)     │
│  ───────────────────────────────────    │
│                                         │
│  1. Validate API Key                   │
│  2. Get Partner Data                   │
│  3. Create/Find Sender Account         │
│  4. Create/Find Recipient Account      │
│  5. Calculate Fees:                    │
│     • Wells Fee: $10 (1%)              │
│     • Partner Share: $2 (20%)          │
│     • Wells Net: $8 (80%)              │
│  6. Create Transaction Record          │
│  7. Update Partner Volume              │
│  8. Trigger Webhook (async)            │
└────────────┬────────────────────────────┘
             │
             v
┌─────────────────────────────────────────┐
│  Silent Enrollment                      │
│  ──────────────────                     │
│                                         │
│  For Sender:                            │
│  • Email: user_1@partner.com           │
│  • Wallet: 0xabc...                    │
│  • First Touch: white_label_AcmePay    │
│  • Activation: ghost                   │
│                                         │
│  For Recipient:                         │
│  • Email: user_2@partner.com           │
│  • Wallet: 0xdef...                    │
│  • First Touch: white_label_AcmePay    │
│  • Activation: ghost                   │
└─────────────────────────────────────────┘
             │
             v
┌─────────────────────────────────────────┐
│  Response to Partner                    │
│  ────────────────────                   │
│                                         │
│  {                                      │
│    "success": true,                     │
│    "transaction": {                     │
│      "id": "wl_tx_xyz",                │
│      "amount": 1000,                    │
│      "fees": {                          │
│        "total": 10,                     │
│        "partner_share": 2               │
│      },                                 │
│      "status": "completed"              │
│    }                                    │
│  }                                      │
└─────────────────────────────────────────┘
             │
             v
┌─────────────────────────────────────────┐
│  Webhook to Partner (async)             │
│  ───────────────────────                │
│                                         │
│  POST partner.webhook_url               │
│  Headers:                               │
│    X-Webhook-Signature: hmac_sha256    │
│                                         │
│  Body:                                  │
│  {                                      │
│    "event": "transaction.completed",   │
│    "data": {                            │
│      "id": "wl_tx_xyz",                │
│      "amount": 1000,                    │
│      "partner_share": 2                 │
│    }                                    │
│  }                                      │
└─────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                      DATA MODEL                                      │
└─────────────────────────────────────────────────────────────────────┘

white_label_partners
├── id (UUID)
├── company_name
├── platform_name
├── domain (unique)
├── contact_email, contact_name, contact_phone
├── api_key (unique, hashed)
├── webhook_url, webhook_secret
├── revenue_share_percent (15-30)
├── total_volume, monthly_volume
├── transaction_count
├── total_fees_collected
├── total_partner_share
├── total_wells_share
└── status (active/suspended)

white_label_transactions
├── id (UUID)
├── partner_id → white_label_partners.id
├── external_id (partner's tx ID)
├── sender_external_id, recipient_external_id
├── amount, currency
├── sender_account_id → silent_accounts.id
├── recipient_account_id → silent_accounts.id
├── wells_fee, partner_share, wells_net
├── status (pending/completed/failed)
└── metadata (JSON)

silent_accounts (existing)
├── id (UUID)
├── email
├── wallet_address
├── first_touch (white_label_AcmePay)
├── activation_level (ghost)
└── metadata { partner_id, external_id }


┌─────────────────────────────────────────────────────────────────────┐
│                    REVENUE CALCULATOR                                │
└─────────────────────────────────────────────────────────────────────┘

Transaction: $1,000
Wells Fee (1%): $10.00
━━━━━━━━━━━━━━━━━━━━━━━━━━
Partner Share (20%): $2.00  ← Partner earns this
Wells Net (80%): $8.00      ← Wells earns this

At Scale:
─────────
$1M monthly volume per partner
× 1% Wells fee = $10,000 fees
× 20% partner share = $2,000/month to partner
× 80% Wells net = $8,000/month to Wells

100 partners × $1M volume each = $100M total volume
Wells Revenue: $800,000/month
Partner Revenue: $200,000/month (distributed)


┌─────────────────────────────────────────────────────────────────────┐
│                    MULTIPLIER EFFECT                                 │
└─────────────────────────────────────────────────────────────────────┘

Traditional B2C:
  Wells → User 1
  Wells → User 2
  Wells → User 3
  (Linear growth, high CAC)

Partner Model:
  Wells → Partner A (5,000 users) ──┐
  Wells → Partner B (10,000 users) ─┼→ 18,000 users instantly
  Wells → Partner C (3,000 users) ──┘

  Each transaction:
  • Enrolls sender (silently)
  • Enrolls recipient (silently)
  • Generates revenue for both parties
  • Creates network effects

  (Exponential growth, low CAC)


┌─────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION                                  │
└─────────────────────────────────────────────────────────────────────┘

API Key Format: wl_[48 hex characters]
Example: wl_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4

Storage:
├── Client: sessionStorage (temporary)
├── Server: SHA-256 hash in database
└── Never: localStorage (security risk)

Usage:
┌─────────────────────────────────┐
│ X-API-Key: wl_abc123...        │ ← Required header
└─────────────────────────────────┘

Security:
✓ Shown only once at creation
✓ Regeneration invalidates old key
✓ Rate limited (1K/min, 100K/day)
✓ Webhook HMAC signatures
```
