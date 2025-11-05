# Partner Referral System

## Overview

The partner referral system enables Wells AI to intelligently recommend trusted partners during conversations and track referral commissions. When users mention specific needs (like "payment processing"), Wells can suggest relevant partners and earn referral revenue.

## Database Schema

### Partner Model (Extended)

New referral-specific fields added to existing Partner model:

- `referralUrl` - Tracked referral link with partner ID (e.g., Connect Services URL)
- `referralCategory` - Category for matching (e.g., "Payment Processing", "Infrastructure")
- `partnerDescription` - What the partner offers
- `commissionRate` - Percentage or flat fee commission
- `recommendationTriggers` - Array of keywords that trigger recommendations

### PartnerReferral Model (New)

Tracks every recommendation Wells makes:

- `userId` - Who received the recommendation
- `partnerId` - Which partner was recommended
- `referralUrl` - The tracked URL shared
- `context` - What triggered the recommendation
- `clickedAt` - When user clicked the link
- `convertedAt` - When user signed up/purchased
- `conversionValue` - Deal value in cents
- `commissionEarned` - Commission earned in cents
- `status` - "pending", "clicked", "converted", "expired"

## API Endpoints

### POST /api/partners/recommend

Finds partner recommendations based on conversation context.

**Request:**
```json
{
  "userId": "user_abc123",
  "context": "I need help with payment processing for my e-commerce store"
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "partnerId": "350aac4e-7b18-494d-a915-c94fb5ecc044",
      "name": "Connect Services",
      "category": "Payment Processing",
      "description": "Payment processing and merchant services for high-volume transactions",
      "referralUrl": "https://connectservices.com/referral?rid=MzcwNzcwMDg3MDl8OTA=",
      "website": "https://connectservices.com",
      "matchScore": 2,
      "matchedKeywords": ["payment processing", "merchant services"]
    }
  ],
  "count": 1
}
```

## Current Partners

### Connect Services

- **Category:** Payment Processing
- **Referral URL:** https://connectservices.com/referral?rid=MzcwNzcwMDg3MDl8OTA=
- **Description:** Payment processing and merchant services for high-volume transactions
- **Triggers:**
  - "payment processing"
  - "merchant services"
  - "credit card processing"
  - "payment gateway"
  - "transaction processing"
  - "high volume payments"
  - "accept payments"

## How It Works

1. **User Conversation:** User mentions "I need payment processing" in chat with Wells
2. **Context Analysis:** Wells chat API calls `/api/partners/recommend` with conversation context
3. **Partner Matching:** System finds partners with matching recommendation triggers
4. **Scoring:** Partners scored by number of keyword matches
5. **Referral Tracking:** PartnerReferral record created with status "pending"
6. **Recommendation:** Wells suggests Connect Services with referral link
7. **Conversion Tracking:** When user clicks link, status updates to "clicked"
8. **Commission:** When user converts, commission is calculated and tracked

## Adding New Partners

Use the seed script template:

```bash
npx tsx scripts/add-connect-services.ts
```

Create similar scripts for new partners with:
- Name, industry, website
- Referral URL with tracking ID
- Category and description
- Commission rate (if known)
- Recommendation triggers array

## Next Steps

1. **Integrate into Wells AI Chat** - Add partner recommendation logic to chat API
2. **Conversion Tracking** - Build webhook for partner conversion notifications
3. **Partner Dashboard** - UI for Wells Onyx to view referrals and commissions
4. **Click Tracking** - Middleware to update PartnerReferral when links are clicked
5. **Commission Reconciliation** - Monthly partner payout reports
6. **Add Visa Partnership** - When ready, add Visa with their referral terms

## Revenue Model

- Wells Onyx earns commission on every successful referral
- Commissions tracked in PartnerReferral.commissionEarned
- Partners pay out monthly based on conversions
- Transparent tracking for both parties

## Example Usage

```typescript
// In Wells AI chat handler
const response = await fetch('/api/partners/recommend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser.id,
    context: userMessage
  })
});

const { recommendations } = await response.json();

if (recommendations.length > 0) {
  const partner = recommendations[0];
  return `I recommend ${partner.name} for ${partner.category}.
          ${partner.description}

          Check them out: ${partner.referralUrl}`;
}
```

## Database Queries

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all active referral partners
const partners = await prisma.partner.findMany({
  where: {
    status: 'active',
    partnershipType: 'Referral',
    referralUrl: { not: null }
  }
});

// Track conversion
await prisma.partnerReferral.update({
  where: { id: referralId },
  data: {
    status: 'converted',
    convertedAt: new Date(),
    conversionValue: 50000, // $500 in cents
    commissionEarned: 7500   // 15% = $75
  }
});

// Get total commissions this month
const commissions = await prisma.partnerReferral.aggregate({
  where: {
    status: 'converted',
    convertedAt: {
      gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    }
  },
  _sum: { commissionEarned: true }
});
```

## Visa Partnership (Coming Soon)

User mentioned Visa partnership "may come in big time handy soon". When ready:

1. Get Visa referral program details
2. Obtain tracked referral URL
3. Define recommendation triggers
4. Confirm commission structure
5. Run seed script to add Visa partner
6. Deploy to production

---

Built by Wells Onyx
Powered by Grain & Vault Financial Infrastructure
