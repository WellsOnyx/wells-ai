# Grain & Vault Personal Lending System

A comprehensive lending platform supporting mortgages, auto loans, and personal loans with integrated GRAIN cryptocurrency benefits.

## Overview

The Grain & Vault Lending System provides:

- **Mortgage Loans**: 15/30-year fixed, 5/1 ARM, FHA, Jumbo
- **Auto Loans**: New and used vehicle financing
- **Personal Loans**: Secured and unsecured
- **GRAIN-Backed Loans**: 0% APR instant loans using GRAIN as collateral

## Features

### 1. Automated Underwriting
- Real-time credit decisioning
- Credit score tier pricing (Excellent, Good, Fair, Subprime)
- DTI and LTV analysis
- Risk-based pricing
- Instant approval for GRAIN-backed loans

### 2. GRAIN Integration
- **Rate Discounts**: 0.25% off per 10,000 GRAIN staked (up to 1.5% off)
- **GRAIN-Backed Loans**: Borrow up to 50% of GRAIN value at 0% APR
- **PMI Elimination**: Use GRAIN to cover down payment requirements
- **No Credit Check**: GRAIN-backed loans approved instantly

### 3. Loan Products

#### Mortgages
- **30-Year Fixed**: 6.75% base rate, up to $2M
- **15-Year Fixed**: 6.00% base rate, faster equity building
- **5/1 ARM**: 5.75% initial rate, fixed for 5 years
- **FHA**: 6.50% rate, 3.5% down payment
- **Jumbo**: 7.25% rate, $726K+ loans

#### Auto Loans
- **New Auto (60mo)**: 6.99% rate, up to $150K
- **New Auto (72mo)**: 7.49% rate, lower monthly payments
- **Used Auto (48mo)**: 8.49% rate, vehicles up to 7 years old
- **Used Auto (60mo)**: 8.99% rate, extended term

#### Personal Loans
- **Unsecured (36mo)**: 11.99% rate, $1K-$50K
- **Unsecured (60mo)**: 13.99% rate, $5K-$50K
- **Secured (48mo)**: 8.99% rate, with collateral
- **Debt Consolidation**: 10.99% rate, combine debts

#### GRAIN Products
- **GRAIN-Backed Instant**: 0% APR, up to 50% LTV on GRAIN
- **GRAIN Holder Mortgage**: Exclusive rates for GRAIN holders

### 4. Credit Tiers & Pricing

| Tier | Credit Score | Rate Adjustment | Max LTV | Max DTI |
|------|--------------|-----------------|---------|---------|
| Excellent | 750-850 | -0.50% | 97% | 45% |
| Good | 700-749 | 0.00% | 95% | 43% |
| Fair | 650-699 | +0.75% | 90% | 41% |
| Subprime | 580-649 | +2.00% | 85% | 38% |

### 5. Underwriting Criteria

#### Mortgages
- Minimum credit score: 580 (620 for conventional)
- Maximum DTI: 45% (varies by tier)
- Maximum LTV: 97% (excellent credit)
- Reserves required: 2-6 months (risk-based)
- Employment: 2 years minimum (self-employed)

#### Auto Loans
- Minimum credit score: 580
- Maximum DTI: 43%
- Maximum LTV: 100% (good credit)
- Vehicle age: Up to 7 years old (used)
- Mileage: Affects valuation

#### Personal Loans
- Minimum credit score: 580
- Maximum DTI: 43%
- No collateral required (unsecured)
- Instant funding available
- Flexible purposes

### 6. GRAIN Benefits Breakdown

```javascript
// Rate discount tiers
10,000 GRAIN staked   → 0.25% rate reduction
25,000 GRAIN staked   → 0.50% rate reduction
50,000 GRAIN staked   → 0.75% rate reduction
100,000 GRAIN staked  → 1.00% rate reduction
250,000 GRAIN staked  → 1.50% rate reduction
```

#### GRAIN-Backed Loan Example
```
GRAIN Holdings: 100,000 GRAIN
GRAIN Price: $50/token
Total Value: $5,000,000

Maximum Loan: $2,500,000 (50% LTV)
Interest Rate: 0.00% APR
Monthly Payment: Principal only (e.g., $20,833/mo for 120 months)
Requirements: GRAIN locked as collateral
```

### 7. Payment Processing

Payments are allocated in waterfall order:
1. **Late Fees** - Outstanding penalties first
2. **Interest** - Accrued interest
3. **Principal** - Loan balance reduction
4. **Escrow** - Tax/insurance (mortgages)

### 8. Escrow Management (Mortgages)

Monthly escrow covers:
- Property taxes (semi-annual disbursements)
- Homeowners insurance (annual)
- PMI (if LTV > 80%)
- HOA fees (if applicable)

Annual escrow analysis ensures adequate reserves (2-month cushion required).

### 9. Loan Servicing Features

- **Autopay**: Schedule automatic payments
- **Extra Payments**: Apply to principal anytime
- **Bi-Weekly Payments**: Pay off faster, save interest
- **Forbearance**: Temporary payment relief
- **Refinancing**: Lower rate or change terms
- **Payoff Quotes**: Per-diem interest calculation

### 10. Collateral Management

#### Real Estate
- Automated valuation models (AVM)
- Annual appraisals for high-value properties
- Lien filing and release
- Insurance verification
- PMI removal at 80% LTV

#### Vehicles
- KBB/NADA/Edmunds valuations
- Title lien holder
- Insurance requirements
- Semi-annual inspections

#### GRAIN
- Smart contract lock/unlock
- Real-time valuation monitoring
- Margin calls if LTV > 60%
- Automatic release on payoff

## API Usage

### Get Available Products
```javascript
GET /api/lending/products?type=mortgage

Response:
{
  "success": true,
  "products": [...],
  "todaysRates": {
    "mortgage30Year": 0.0675,
    "mortgage15Year": 0.0600,
    "autoNew": 0.0699,
    "personalUnsecured": 0.1199,
    "grainBacked": 0.0000
  }
}
```

### Get Rate Quote (Soft Pull)
```javascript
POST /api/lending/rates

Body:
{
  "productCode": "MORTGAGE_30YR_FIXED",
  "loanAmount": 350000,
  "creditScoreRange": { "min": 700, "max": 749 },
  "annualIncome": 100000,
  "monthlyDebts": 1500,
  "grainStaked": 25000,
  "propertyValue": 400000
}

Response:
{
  "success": true,
  "quote": {
    "baseRate": 0.0675,
    "creditAdjustment": 0.0000,
    "grainDiscount": 0.0050,
    "finalRate": 0.0625,
    "apr": 0.0650,
    "monthlyPayment": 2214.86,
    "totalInterest": 447349.60,
    "creditTier": "Good"
  },
  "preQualification": {
    "qualified": true,
    "message": "You may qualify for this loan"
  }
}
```

### Submit Application
```javascript
POST /api/lending/apply

Body:
{
  "email": "borrower@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "ssn": "XXX-XX-XXXX",
  "annualIncome": 100000,
  "productCode": "MORTGAGE_30YR_FIXED",
  "requestedAmount": 350000,
  "propertyValue": 400000,
  // ... additional fields
}

Response:
{
  "success": true,
  "application": {
    "id": "uuid",
    "applicationNumber": "APP-1234567890",
    "status": "submitted"
  }
}
```

### Run Underwriting
```javascript
POST /api/lending/decision/[applicationId]

Body:
{
  "action": "underwrite"
}

Response:
{
  "success": true,
  "decision": {
    "decision": "approved",
    "approvedAmount": 350000,
    "approvedRate": 0.0625,
    "monthlyPayment": 2214.86,
    "conditions": [...],
    "stipulations": [
      "Government-issued photo ID",
      "30 days recent pay stubs",
      "Property appraisal"
    ]
  }
}
```

### Accept Loan Offer
```javascript
POST /api/lending/decision/[applicationId]

Body:
{
  "action": "accept"
}

Response:
{
  "success": true,
  "loan": {
    "id": "uuid",
    "loanNumber": "LOAN-1234567890",
    "amount": 350000,
    "monthlyPayment": 2214.86,
    "firstPaymentDate": "2024-04-01"
  }
}
```

### Make Payment
```javascript
POST /api/lending/loans/[loanId]

Body:
{
  "amount": 2214.86,
  "paymentMethod": "ach",
  "paymentReference": "CHK-12345"
}

Response:
{
  "success": true,
  "payment": {
    "allocation": {
      "interest": 1822.92,
      "principal": 391.94,
      "remainingBalance": 349608.06
    },
    "paidOff": false
  }
}
```

### Get Payoff Quote
```javascript
GET /api/lending/loans/[loanId]/payoff?payoffDate=2024-03-15

Response:
{
  "success": true,
  "payoff": {
    "principalBalance": 349608.06,
    "accruedInterest": 1215.67,
    "payoffAmount": 350823.73,
    "perDiemInterest": 59.86,
    "goodThroughDate": "2024-03-25"
  }
}
```

## Database Schema

### Key Tables

- **loan_products** - Product definitions and base rates
- **loan_rates** - Credit tier rate adjustments
- **borrower_profiles** - Borrower information and credit data
- **loan_applications** - Application submissions
- **loan_underwriting_decisions** - Automated decisions
- **loans** - Active loan accounts
- **loan_payments** - Payment schedule and history
- **loan_collateral** - Property, vehicle, GRAIN collateral
- **loan_escrow** - Escrow accounts for mortgages
- **loan_documents** - KYC, pay stubs, tax returns

## Calculations

### Monthly Payment Formula
```javascript
P = L * [r(1 + r)^n] / [(1 + r)^n - 1]

Where:
P = Monthly payment
L = Loan amount
r = Monthly interest rate (annual rate / 12)
n = Number of payments (term in months)
```

### DTI (Debt-to-Income) Ratio
```javascript
DTI = (Total Monthly Debt Payments) / (Gross Monthly Income)

Includes:
- Proposed mortgage payment (PITI)
- Credit cards (minimum payments)
- Auto loans
- Student loans
- Personal loans
- Child support/alimony
```

### LTV (Loan-to-Value) Ratio
```javascript
LTV = (Loan Amount) / (Property or Vehicle Value)

Example:
$350,000 loan / $400,000 property = 87.5% LTV
```

### APR Calculation
```javascript
APR = Interest Rate + (Fees / Loan Amount) * (12 / Term in Months)

Includes:
- Origination fees
- Discount points
- PMI (for mortgages)
```

## Security & Compliance

- **Data Encryption**: All PII encrypted at rest and in transit
- **SSN Storage**: Encrypted with separate key management
- **TILA Compliance**: Truth in Lending Act disclosures
- **RESPA**: Real Estate Settlement Procedures Act (mortgages)
- **FCRA**: Fair Credit Reporting Act compliance
- **ECOA**: Equal Credit Opportunity Act compliance
- **Adverse Action Notices**: Automatic generation for declines

## Testing

### Sample Test Scenarios

1. **Excellent Credit Mortgage**
   - Credit Score: 780
   - Income: $150,000
   - DTI: 28%
   - Expected: Approved, best rates

2. **GRAIN-Backed Instant Loan**
   - GRAIN Staked: 100,000
   - Loan Amount: $1,000,000 (50% LTV)
   - Expected: Instant approval, 0% APR

3. **Subprime Auto Loan**
   - Credit Score: 610
   - Income: $45,000
   - DTI: 38%
   - Expected: Conditional approval, higher rate

4. **Declined Application**
   - Credit Score: 560
   - DTI: 52%
   - Expected: Declined, adverse action notice

## Production Considerations

1. **Credit Bureau Integration**: Integrate with Experian, Equifax, TransUnion
2. **E-Signature**: Add DocuSign or similar for loan documents
3. **Payment Processing**: Integrate ACH processor (Plaid, Stripe)
4. **Fraud Detection**: Implement fraud scoring and identity verification
5. **Compliance Reporting**: HMDA, CRA, and other regulatory reports
6. **Loan Servicing**: Consider third-party servicer integration
7. **Secondary Market**: Loan sale and securitization support

## Support

For questions or issues:
- Documentation: `/lending/docs`
- API Reference: `/lending/api-docs`
- Support: support@grainandvault.com

---

**Grain & Vault Lending** - Empowering borrowers with competitive rates and GRAIN benefits.
