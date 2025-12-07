# Supplier Onboarding and Matching System

AI-powered supplier management with intelligent RFQ matching using Claude.

## Components

### 1. Database Schema (`scripts/schema-suppliers.sql`)

Three main tables:
- **suppliers** - Supplier profiles with capabilities, pricing, and certifications
- **rfqs** - Request for Quotes from customers
- **supplier_matches** - AI-generated matches between suppliers and RFQs

Includes 5 pre-seeded suppliers in common categories (industrial motors, bearings, electronics).

### 2. Types (`lib/suppliers/types.ts`)

TypeScript interfaces for:
- `Supplier` - Complete supplier profile
- `SupplierOnboardingRequest` - New supplier registration data
- `RFQDetails` - Request for quote requirements
- `SupplierMatch` - AI match result with score and reasoning
- `MatchingResult` - Complete matching analysis

### 3. Database Functions (`lib/suppliers/db.ts`)

Core operations:
- `createSupplier(data)` - Onboard new supplier
- `getSuppliersByCategory(category)` - Find suppliers by product category
- `matchSuppliersToRequest(rfqDetails)` - AI-powered matching using Claude

The matching function uses Claude to:
1. Analyze RFQ requirements
2. Score each supplier (0-100)
3. Provide reasoning and identify strengths/concerns
4. Rank suppliers by match quality

### 4. API Endpoints

#### POST /api/suppliers/onboard
Register a new supplier.

**Request:**
```json
{
  "companyName": "Acme Industrial Supply",
  "contactEmail": "sales@acme.com",
  "phone": "+1-555-0100",
  "website": "https://acme.com",
  "products": ["bearings", "industrial supplies"],
  "pricing": {
    "minimumOrder": 500,
    "currency": "USD",
    "paymentTerms": "NET30",
    "discountTiers": [
      {"minQuantity": 100, "discountPct": 5}
    ]
  },
  "capacity": {
    "monthlyVolume": 10000,
    "leadTime": 5,
    "locations": ["New York", "Chicago"]
  },
  "certifications": ["ISO9001"],
  "dropShipCapable": true
}
```

**Response:**
```json
{
  "success": true,
  "supplier": { /* supplier object */ },
  "message": "Supplier onboarded and pending review"
}
```

#### POST /api/suppliers/match
Find matching suppliers for an RFQ using AI.

**Request:**
```json
{
  "category": "bearings",
  "description": "High-precision ball bearings, 6000 series, stainless steel",
  "quantity": 500,
  "targetPrice": 2500,
  "urgency": "urgent",
  "deliveryLocation": "Chicago, IL",
  "requiredCertifications": ["ISO9001"],
  "additionalRequirements": "Must ship within 5 days"
}
```

**Response:**
```json
{
  "success": true,
  "rfqId": "uuid",
  "matches": [
    {
      "supplier": {
        "id": "uuid",
        "companyName": "Precision Bearing Solutions",
        "contactEmail": "orders@precisionbearing.com",
        "products": ["bearings", "roller bearings"],
        "leadTime": 3,
        "certifications": ["ISO9001", "ISO14001"]
      },
      "matchScore": 92,
      "reasoning": "Excellent match based on specialization in precision bearings, fast lead time, and required certifications.",
      "strengths": [
        "Specializes in precision bearings",
        "3-day lead time meets urgent requirement",
        "Has ISO9001 certification",
        "Service location near Chicago"
      ],
      "concerns": [],
      "estimatedLeadTime": 3
    }
  ],
  "totalSuppliersConsidered": 5,
  "analyzedAt": "2025-01-01T00:00:00.000Z"
}
```

## Setup

1. **Run database migration:**
   ```bash
   psql -d your_database -f scripts/schema-suppliers.sql
   ```

2. **Set environment variable:**
   ```bash
   ANTHROPIC_API_KEY=your_api_key
   ```

3. **Test the system:**
   ```bash
   npx tsx scripts/test-suppliers.ts
   ```

## AI Matching Algorithm

The system uses Claude (claude-3-5-sonnet-20241022) to analyze suppliers against RFQ requirements:

1. **Input Analysis**: Category, quantity, urgency, certifications, location
2. **Supplier Evaluation**: Products, capacity, lead time, certifications, locations
3. **Scoring**: 0-100 match score with detailed reasoning
4. **Ranking**: Suppliers sorted by match score (minimum 40 to qualify)
5. **Insights**: Strengths and concerns for each match

If AI matching fails, falls back to rule-based matching using:
- Certification requirements
- Lead time vs urgency
- Monthly capacity vs quantity needed
- Minimum order requirements

## Pre-seeded Suppliers

1. **Midwest Motor Supply Co.** - Industrial motors, 5-day lead time
2. **Precision Bearing Solutions** - Bearings specialist, 3-day lead time
3. **TechSource Electronics** - Electronics components, 7-day lead time
4. **Atlas Industrial Supply** - MRO and general supplies, 2-day lead time
5. **Quantum Electronics Manufacturing** - Custom electronics, 14-day lead time

## Database Views

- `active_suppliers_summary` - Supplier count and capabilities by status
- `supplier_performance` - RFQ matches and win rates per supplier
- `rfq_status_overview` - RFQ status with match counts and quotes
