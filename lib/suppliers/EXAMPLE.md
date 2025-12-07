# Supplier System Usage Examples

## Example 1: Onboard a New Supplier

```bash
curl -X POST http://localhost:3000/api/suppliers/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Global Fasteners Inc.",
    "contactEmail": "sales@globalfasteners.com",
    "phone": "+1-800-555-BOLT",
    "website": "https://globalfasteners.com",
    "products": ["fasteners", "bolts", "nuts", "screws", "industrial hardware"],
    "pricing": {
      "minimumOrder": 250,
      "currency": "USD",
      "paymentTerms": "NET30",
      "discountTiers": [
        { "minQuantity": 100, "discountPct": 5 },
        { "minQuantity": 500, "discountPct": 10 },
        { "minQuantity": 2000, "discountPct": 15 }
      ]
    },
    "capacity": {
      "monthlyVolume": 50000,
      "leadTime": 4,
      "locations": ["Los Angeles", "Houston", "Newark"]
    },
    "certifications": ["ISO9001", "ASTM Certified"],
    "leadTime": 4,
    "minimumOrder": 250,
    "dropShipCapable": true,
    "whiteLabelCapable": true
  }'
```

**Response:**
```json
{
  "success": true,
  "supplier": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "companyName": "Global Fasteners Inc.",
    "contactEmail": "sales@globalfasteners.com",
    "status": "active",
    "products": ["fasteners", "bolts", "nuts", "screws", "industrial hardware"],
    "leadTime": 4,
    "minimumOrder": 250,
    "certifications": ["ISO9001", "ASTM Certified"],
    "createdAt": "2025-01-15T10:30:00.000Z"
  },
  "message": "Supplier onboarded and automatically approved"
}
```

---

## Example 2: Match Suppliers to RFQ (Electronics)

```bash
curl -X POST http://localhost:3000/api/suppliers/match \
  -H "Content-Type: application/json" \
  -d '{
    "category": "electronics",
    "description": "Need custom PCB assembly for IoT temperature sensors. Quantity 1000 units. Must include SMT assembly and testing.",
    "quantity": 1000,
    "targetPrice": 15000,
    "urgency": "standard",
    "deliveryLocation": "Austin, TX",
    "requiredCertifications": ["ISO9001", "RoHS Compliant"],
    "additionalRequirements": "Need prototype batch of 50 units first for validation",
    "requestorEmail": "purchasing@iotcompany.com",
    "requestorName": "Sarah Chen"
  }'
```

**Response:**
```json
{
  "success": true,
  "rfqId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "matches": [
    {
      "supplier": {
        "id": "abc123...",
        "companyName": "TechSource Electronics",
        "contactEmail": "procurement@techsource.com",
        "products": ["electronics", "semiconductors", "circuit boards"],
        "leadTime": 7,
        "certifications": ["ISO9001", "RoHS Compliant", "ESD Certified"]
      },
      "matchScore": 88,
      "reasoning": "Strong match for custom PCB assembly. Has required certifications and significant experience with IoT devices. Standard lead time of 7 days works for non-urgent request.",
      "strengths": [
        "Specializes in custom PCB and electronic assembly",
        "Has both ISO9001 and RoHS certifications",
        "Monthly capacity of 50,000 units exceeds requirement",
        "Austin location is one of their service areas"
      ],
      "concerns": [
        "Minimum order of $1,000 is below their typical threshold"
      ],
      "estimatedLeadTime": 7
    },
    {
      "supplier": {
        "id": "def456...",
        "companyName": "Quantum Electronics Manufacturing",
        "contactEmail": "bizdev@quantumelectronics.com",
        "products": ["electronics", "custom PCBs", "embedded systems", "IoT devices"],
        "leadTime": 14,
        "certifications": ["ISO9001", "ISO13485", "IPC-A-610", "RoHS Compliant"]
      },
      "matchScore": 85,
      "reasoning": "Excellent capabilities for custom IoT devices with comprehensive certifications. Longer lead time but white-label capability adds value.",
      "strengths": [
        "Specific expertise in IoT device manufacturing",
        "White-label capability for custom branding",
        "Premium certifications including IPC-A-610",
        "Can handle prototype and production runs"
      ],
      "concerns": [
        "14-day lead time is longer than other options",
        "Higher minimum order value of $2,500"
      ],
      "estimatedLeadTime": 14
    }
  ],
  "totalSuppliersConsidered": 5,
  "analyzedAt": "2025-01-15T11:45:23.000Z"
}
```

---

## Example 3: Urgent Bearings Request

```bash
curl -X POST http://localhost:3000/api/suppliers/match \
  -H "Content-Type: application/json" \
  -d '{
    "category": "bearings",
    "description": "URGENT: Production line down. Need 200 deep groove ball bearings, 6204-2RS, stainless steel.",
    "quantity": 200,
    "urgency": "critical",
    "deliveryLocation": "Cleveland, OH",
    "requiredCertifications": ["ISO9001"],
    "additionalRequirements": "Must ship same day or next day",
    "requestorEmail": "ops@manufacturing.com",
    "requestorName": "Mike Johnson"
  }'
```

**Response:**
```json
{
  "success": true,
  "rfqId": "9f4e2671-6587-41d0-a4d1-892ae71f23ab",
  "matches": [
    {
      "supplier": {
        "id": "ghi789...",
        "companyName": "Precision Bearing Solutions",
        "contactEmail": "orders@precisionbearing.com",
        "products": ["bearings", "roller bearings", "ball bearings"],
        "leadTime": 3,
        "certifications": ["ISO9001", "ISO14001", "IATF16949"]
      },
      "matchScore": 95,
      "reasoning": "Perfect match for urgent bearing requirement. 3-day standard lead time but Cleveland location enables same-day pickup. Specializes in the exact bearing type needed.",
      "strengths": [
        "Cleveland location enables immediate pickup/delivery",
        "Specializes in ball bearings including 6204-2RS series",
        "3-day lead time with expedite options available",
        "ISO9001 certified with automotive-grade IATF16949",
        "Low minimum order of $250 works for urgent small batches"
      ],
      "concerns": [],
      "estimatedLeadTime": 0
    }
  ],
  "totalSuppliersConsidered": 5,
  "analyzedAt": "2025-01-15T14:22:10.000Z"
}
```

---

## Example 4: Large MRO Order

```bash
curl -X POST http://localhost:3000/api/suppliers/match \
  -H "Content-Type: application/json" \
  -d '{
    "category": "industrial supplies",
    "description": "Quarterly MRO supplies: safety equipment, hand tools, cleaning supplies, PPE for 500-person facility",
    "quantity": 5000,
    "targetPrice": 25000,
    "urgency": "standard",
    "deliveryLocation": "Atlanta, GA",
    "requiredCertifications": ["OSHA Compliant"],
    "additionalRequirements": "Need vendor-managed inventory program with monthly replenishment"
  }'
```

**Response:**
```json
{
  "success": true,
  "rfqId": "2a8b4c3d-9876-5e43-21f0-a1b2c3d4e5f6",
  "matches": [
    {
      "supplier": {
        "id": "jkl012...",
        "companyName": "Atlas Industrial Supply",
        "contactEmail": "sales@atlasindustrial.com",
        "products": ["industrial supplies", "MRO", "safety equipment", "tools"],
        "leadTime": 2,
        "certifications": ["ISO9001", "OSHA Compliant"]
      },
      "matchScore": 92,
      "reasoning": "Ideal for large MRO programs. Fast 2-day lead time, Atlanta is a primary service location, and white-label capability enables custom vendor-managed inventory programs.",
      "strengths": [
        "Broad MRO product range covers all requirements",
        "Atlanta is one of their primary distribution centers",
        "2-day lead time enables rapid replenishment",
        "White-label and drop-ship capable for VMI programs",
        "Volume discounts up to 15% align with order size",
        "OSHA compliance for safety equipment"
      ],
      "concerns": [],
      "estimatedLeadTime": 2
    }
  ],
  "totalSuppliersConsidered": 5,
  "analyzedAt": "2025-01-15T16:05:44.000Z"
}
```

---

## Programmatic Usage (TypeScript)

```typescript
import { createSupplier, matchSuppliersToRequest } from '@/lib/suppliers/db';

// Onboard a supplier
const supplier = await createSupplier({
  companyName: "Test Motors Inc.",
  contactEmail: "info@testmotors.com",
  products: ["motors", "electric motors"],
  pricing: {
    minimumOrder: 500,
    currency: "USD",
    paymentTerms: "NET30"
  },
  capacity: {
    monthlyVolume: 10000,
    leadTime: 7,
    locations: ["Chicago"]
  },
  certifications: ["ISO9001"],
  leadTime: 7,
  minimumOrder: 500
});

// Match suppliers to RFQ
const matches = await matchSuppliersToRequest({
  category: "motors",
  description: "Industrial AC motors, 10HP",
  quantity: 50,
  urgency: "standard",
  deliveryLocation: "Chicago, IL",
  requiredCertifications: ["ISO9001"]
});

console.log(`Found ${matches.matches.length} matching suppliers`);
matches.matches.forEach(match => {
  console.log(`${match.supplier.companyName}: ${match.matchScore}/100`);
});
```

---

## Testing

Run the automated test suite:

```bash
npx tsx scripts/test-suppliers.ts
```

This will:
1. List all pre-seeded suppliers
2. Onboard a test supplier
3. Run a sample RFQ matching analysis
4. Display AI-generated match scores and reasoning
