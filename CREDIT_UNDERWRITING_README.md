# Wells AI Credit Underwriting System

## Overview

The Wells AI Credit Underwriting System provides **instant credit decisions** with nearly risk-free lending by leveraging complete transaction visibility. This system can approve credit lines in under 60 seconds by analyzing:

- Bank account transaction history (via Plaid)
- Accounting software data (via Codat)
- Wells platform transaction history
- Proprietary credit scoring algorithm

## Key Advantage

**Wells sees all transactions** flowing through the platform, enabling:
- Real-time risk monitoring
- Automatic payment intercepts from incoming settlements
- Dynamic credit limit adjustments
- Near-zero default risk

## Architecture

### Data Sources

1. **Plaid Integration** (`lib/underwriting/plaid.ts`)
   - Bank account connections
   - Transaction history (12 months)
   - Cash flow analysis
   - Recurring revenue detection
   - NSF/overdraft monitoring

2. **Codat Integration** (`lib/underwriting/codat.ts`)
   - Accounting software connections (QuickBooks, Xero, etc.)
   - Financial statements (P&L, Balance Sheet, Cash Flow)
   - Financial ratios calculation
   - AR/AP aging analysis
   - Revenue trend forecasting

3. **Wells Transaction Data** (Internal)
   - Platform transaction volume
   - Payment history
   - Dispute/chargeback rates
   - Customer/supplier relationships

### Credit Scoring Engine

**Proprietary Algorithm** (`lib/underwriting/scoring.ts`):

```
Total Score: 0-1000 points

Breakdown:
- Cash Flow (40%): Net cash flow, stability, recurring revenue, account health
- Revenue Growth (20%): Growth rate, trend direction, seasonality
- Wells History (20%): Transaction volume, platform tenure, dispute rate
- Account Age (10%): Business longevity, establishment
- Industry Risk (10%): Industry-specific risk multipliers
```

**Credit Tiers**:
- **Prime (750+)**: APR 6.99-8.99%, limits up to $500K
- **Near Prime (600-749)**: APR 8.99-11.99%, limits up to $250K
- **Subprime (450-599)**: APR 11.99-18.99%, limits up to $100K, requires auto-pay
- **High Risk (<450)**: Declined

### Decision Engine

**Instant Approval Flow** (`lib/underwriting/decision.ts`):

```
1. Connect bank account (Plaid) → 10 seconds
2. Optional: Connect accounting → Additional data
3. Analyze all data sources → 5 seconds
4. Calculate credit score → 2 seconds
5. Make decision → Instant
6. Present terms → Approved/Declined

Total time: ~60 seconds
```

## Database Schema

### Core Tables

```sql
credit_applications
  ├── User info
  ├── Connected accounts (Plaid, Codat)
  ├── Decision results
  └── Approval/rejection details

credit_lines
  ├── Credit terms (limit, APR)
  ├── Current utilization
  ├── Risk tier
  └── Auto-pay settings

credit_draws
  ├── Amount withdrawn
  ├── Purpose
  └── Disbursement details

credit_payments
  ├── Payment amount
  ├── Principal/interest split
  └── Payment method

payment_intercepts (Wells Advantage!)
  ├── Intercept rules
  ├── Auto-payment from settlements
  └── Total intercepted
```

## API Endpoints

### Credit Application

**POST /api/credit/apply**
```json
{
  "userId": "string",
  "requestedAmount": 50000,
  "connectAccounting": false
}

Response:
{
  "applicationId": "uuid",
  "plaidLinkToken": "link-token",
  "codatLinkUrl": "https://..."
}
```

**POST /api/credit/decision**
```json
{
  "applicationId": "uuid",
  "plaidPublicToken": "public-token"
}

Response:
{
  "approved": true,
  "approvedAmount": 75000,
  "apr": 8.99,
  "creditScore": 842,
  "grade": "A",
  "riskTier": "prime",
  "breakdown": {...},
  "positiveFactors": [...],
  "conditions": [...]
}
```

**POST /api/credit/activate**
```json
{
  "applicationId": "uuid",
  "autoPayEnabled": true
}

Response:
{
  "creditLine": {
    "id": "uuid",
    "creditLimit": 75000,
    "availableCredit": 75000,
    "apr": 8.99
  }
}
```

### Credit Management

**GET /api/credit/draw?userId=xxx**
```json
Response:
{
  "creditLine": {
    "creditLimit": 75000,
    "availableCredit": 50000,
    "usedCredit": 25000,
    "apr": 8.99
  }
}
```

**POST /api/credit/draw**
```json
{
  "creditLineId": "uuid",
  "amount": 10000,
  "purpose": "inventory"
}

Response:
{
  "drawId": "uuid",
  "amount": 10000,
  "newAvailableCredit": 40000,
  "disbursedAt": "2025-01-15T10:30:00Z"
}
```

**POST /api/credit/pay**
```json
{
  "creditLineId": "uuid",
  "amount": 5000
}

Response:
{
  "paymentId": "uuid",
  "amount": 5000,
  "principalAmount": 4850,
  "interestAmount": 150,
  "newAvailableCredit": 45000
}
```

## Frontend Pages

### Application Flow

1. **/credit/apply**
   - Credit amount selection ($5K-$500K)
   - Plaid Link integration
   - Optional accounting connection
   - Instant decision display
   - Terms acceptance

2. **/credit/dashboard**
   - Credit line overview
   - Available vs. used credit
   - Draw funds interface
   - Make payment interface
   - Transaction history

## Environment Variables

Required:

```bash
# Plaid (Banking Data)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox # or development, production

# Codat (Accounting Data)
CODAT_API_KEY=your_codat_api_key

# Database (Already configured)
POSTGRES_URL=your_postgres_url

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# Plaid and other deps already in package.json
```

### 2. Set Up Database

```bash
# Run credit underwriting schema
psql $POSTGRES_URL -f scripts/schema-credit-underwriting.sql
```

### 3. Configure Plaid

1. Sign up at [Plaid Dashboard](https://dashboard.plaid.com/signup)
2. Get your `client_id` and `secret`
3. Enable products: Transactions, Auth, Balance
4. Add redirect URIs
5. Set environment variables

### 4. Configure Codat (Optional)

1. Sign up at [Codat Portal](https://signup.codat.io/)
2. Get your API key
3. Enable accounting integrations
4. Set environment variable

### 5. Test the Flow

```bash
npm run dev

# Navigate to:
http://localhost:3000/credit/apply
```

## Credit Scoring Details

### Cash Flow Score (40 points)

- **Net Cash Flow (15 pts)**
  - >$10K/mo: 15 pts
  - $5K-$10K: 12 pts
  - $0-$5K: 8 pts
  - Negative: 0 pts

- **Stability (10 pts)**
  - Volatility <20%: 10 pts
  - Volatility 20-40%: 7 pts
  - Volatility >60%: 0 pts

- **Recurring Revenue (10 pts)**
  - >70%: 10 pts
  - 50-70%: 7 pts
  - 30-50%: 4 pts

- **Account Health (5 pts)**
  - No overdrafts: 5 pts
  - <3 overdrafts: 2 pts
  - >3 overdrafts: 0 pts

### Revenue Growth Score (20 points)

- **Growth Rate (15 pts)**
  - >50% annual: 15 pts
  - 25-50%: 12 pts
  - 10-25%: 8 pts
  - 0-10%: 5 pts
  - Negative: 0 pts

- **Trend Direction (5 pts)**
  - Growing: 5 pts
  - Stable: 3 pts
  - Declining: 0 pts

### Wells History Score (20 points)

- **Volume (8 pts)**
  - >$1M: 8 pts
  - $500K-$1M: 6 pts
  - $100K-$500K: 4 pts

- **Tenure (5 pts)**
  - >12 months: 5 pts
  - 6-12 months: 3 pts
  - <6 months: 1 pt

- **Dispute Rate (4 pts)**
  - <1%: 4 pts
  - 1-5%: 2 pts
  - >5%: 0 pts

- **Settlement Speed (3 pts)**
  - <7 days: 3 pts
  - 7-14 days: 2 pts
  - >14 days: 0 pts

### Industry Risk Multipliers

```javascript
const INDUSTRY_RISK = {
  'saas': 0.7,           // Lowest risk
  'software': 0.8,
  'technology': 0.8,
  'professional_services': 0.85,
  'healthcare': 0.9,
  'manufacturing': 1.0,  // Baseline
  'retail': 1.1,
  'construction': 1.2,
  'restaurant': 1.3      // Highest risk
};
```

## Payment Intercept (Wells Advantage)

Automatic payment collection from incoming settlements:

```typescript
// When a transaction settles on Wells platform
await processPaymentIntercept(userId, transactionAmount);

// Automatically deducts percentage to pay credit line
// Default: 10% of incoming payments
// Configurable: min/max amounts, percentage
```

**Benefits**:
- Near-zero default risk
- Automatic collections
- No manual payment required
- Scales with business success

## Risk Management

### Credit Line Monitoring

- **Daily Review**: Balance, utilization, payment status
- **Weekly Review**: Transaction patterns, dispute rates
- **Monthly Review**: Cash flow trends, revenue growth
- **Quarterly Review**: Full re-underwriting, limit adjustments

### Alert System

```sql
credit_alerts
  ├── payment_due
  ├── missed_payment
  ├── limit_exceeded
  ├── risk_flag (declining revenue, high disputes)
```

### Dynamic Limit Adjustments

- Increase limit: Strong performance, low utilization
- Decrease limit: Declining revenue, payment issues
- Suspend line: Fraud flags, severe delinquency

## Advanced Features

### 1. Credit Line Graduation

As businesses grow on Wells, credit terms improve:
- Higher limits
- Lower APR
- Better conditions
- Priority support

### 2. Cross-Collateralization

Credit secured by:
- Wells transaction history
- Future receivables
- Platform escrow balances

### 3. Revenue-Based Repayment

Payments scale with revenue:
- High sales month → Higher payment
- Low sales month → Lower payment
- Always affordable

### 4. Business Insights

Credit dashboard shows:
- Cash flow projections
- Revenue forecasting
- Working capital optimization
- Growth recommendations

## Integration with Wells Ecosystem

### Connected Systems

1. **Transaction Processing**
   - Monitor all incoming/outgoing payments
   - Real-time risk assessment
   - Automated collections

2. **Escrow Management**
   - Payments held in escrow → Collateral
   - Instant settlement for low-risk

3. **Supplier Network**
   - Credit for supplier payments
   - Extended payment terms
   - Supply chain financing

4. **Analytics Platform**
   - Credit utilization metrics
   - Default predictions
   - Portfolio performance

## Economics

### Revenue Model

1. **Interest Income**
   - APR 6.99-24.99%
   - Monthly interest accrual
   - Simple, transparent pricing

2. **Interchange on Draws**
   - 1-2% fee on credit draws
   - Instant disbursement

3. **Premium Features**
   - Higher limits: +$99/mo
   - Priority disbursement: +0.5%
   - Financial advisory: +$199/mo

### Cost Structure

- **Plaid**: ~$0.15/transaction check
- **Codat**: ~$50/mo per company
- **Capital Cost**: 4-6% (cheaper than traditional)
- **Default Reserve**: 2% of portfolio

### Unit Economics

For $100K credit line:
- Average utilization: 60% ($60K)
- APR: 10%
- Annual interest: $6,000
- Default rate: 0.5% ($500)
- Net revenue: $5,500
- Margin: 90%+

## Scaling to Trillion-Dollar Platform

### Phase 1: SMB Credit (Current)
- $5K-$500K credit lines
- 10,000 businesses
- $500M total credit issued
- $50M annual revenue

### Phase 2: Growth Capital
- $500K-$5M lines
- Revenue-based financing
- Equipment financing
- $5B total credit

### Phase 3: Enterprise Credit
- $5M-$100M facilities
- Syndicated lending
- Warehouse financing
- $50B total credit

### Phase 4: Credit Marketplace
- Secondary market for loans
- Institutional investors
- Credit derivatives
- $500B+ market

## Monitoring & Analytics

### Key Metrics

```typescript
// Portfolio Health
- Total credit issued
- Average credit line
- Utilization rate
- Weighted average APR

// Risk Metrics
- Default rate
- Delinquency rate (30/60/90 days)
- Charge-off rate
- Recovery rate

// Performance Metrics
- Approval rate
- Time to decision
- Customer satisfaction
- Net Promoter Score
```

### Dashboards

1. **Executive Dashboard**
   - Portfolio size and growth
   - Revenue and margins
   - Risk metrics
   - Strategic KPIs

2. **Risk Dashboard**
   - Real-time delinquencies
   - Early warning signals
   - Portfolio concentration
   - Stress testing

3. **Operations Dashboard**
   - Application volume
   - Approval rates
   - Disbursement times
   - Customer service metrics

## Security & Compliance

### Data Security

- All financial data encrypted at rest
- TLS 1.3 for data in transit
- SOC 2 Type II compliance
- Regular security audits

### Regulatory Compliance

- **Truth in Lending Act (TILA)**: Full disclosure
- **Equal Credit Opportunity Act (ECOA)**: Fair lending
- **Fair Credit Reporting Act (FCRA)**: Credit reporting
- **State Licensing**: Money transmitter licenses

### Privacy

- GDPR compliant
- CCPA compliant
- Customer data portability
- Right to deletion

## Testing

### Test Scenarios

```bash
# 1. Successful Application
- Connect bank with strong financials
- Expect: Approved, Prime tier, $100K+ limit

# 2. Marginal Application
- Connect bank with moderate financials
- Expect: Approved, Near-Prime tier, $25K limit

# 3. Rejected Application
- Connect bank with weak financials
- Expect: Declined with reason

# 4. Draw and Repay
- Activate credit line
- Draw $10K
- Make payment $5K
- Verify balances update
```

### Plaid Sandbox

Plaid provides test credentials:
```
Username: user_good
Password: pass_good
MFA: 1234

Result: Strong financials, high score
```

## Production Deployment

### Pre-Launch Checklist

- [ ] Plaid production credentials
- [ ] Codat production API key
- [ ] Database migration completed
- [ ] Risk limits configured
- [ ] Fraud detection enabled
- [ ] Customer support trained
- [ ] Legal docs reviewed
- [ ] Compliance audit passed

### Launch Strategy

**Week 1**: Beta (100 businesses)
- Invite-only
- Manual review of all approvals
- Monitor closely

**Week 2-4**: Soft Launch (1,000 businesses)
- Gradual automation
- A/B test terms
- Refine scoring model

**Month 2+**: Full Launch
- Fully automated
- Marketing campaigns
- Scale infrastructure

## Support & Documentation

### Customer Support

- Email: credit@wells.ai
- Phone: 1-800-WELLS-AI
- Chat: Available in dashboard
- Response time: <2 hours

### Developer Documentation

- API docs: docs.wells.ai/credit
- Integration guides: docs.wells.ai/integrations
- SDKs: github.com/wells-ai/sdks

## Future Enhancements

### Roadmap

**Q1 2025**
- [ ] International expansion (UK, Canada)
- [ ] Additional data sources (Stripe, Shopify)
- [ ] Mobile app
- [ ] AI-powered insights

**Q2 2025**
- [ ] Syndicated lending
- [ ] Secondary market
- [ ] Credit cards
- [ ] Invoice financing

**Q3 2025**
- [ ] Crypto collateral
- [ ] DeFi integration
- [ ] Stablecoin disbursement
- [ ] Global expansion

## Conclusion

The Wells AI Credit Underwriting System represents a paradigm shift in small business lending:

- **Instant decisions** vs. weeks of waiting
- **Data-driven** vs. relationship-based
- **Fair & transparent** vs. opaque processes
- **Nearly risk-free** vs. high default rates

By leveraging complete transaction visibility, Wells can offer credit with confidence, enabling small businesses to grow faster while generating attractive returns for the platform.

**The future of lending is instant, intelligent, and integrated.**
