# Grain & Vault Backend API Documentation

**Version:** 1.0.0
**Base URL:** `https://api.grainandvault.com`
**Blockchain:** Base Sepolia (Testnet)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Grain Price API](#grain-price-api)
3. [Founding Investor API](#founding-investor-api)
4. [Vault Management API](#vault-management-api)
5. [Escrow API](#escrow-api)
6. [Transaction History API](#transaction-history-api)
7. [Analytics API](#analytics-api)
8. [Admin API](#admin-api)
9. [Blockchain Events](#blockchain-events)
10. [Error Handling](#error-handling)
11. [Rate Limiting](#rate-limiting)

---

## Authentication

Most endpoints are public. Admin endpoints require Bearer token authentication.

```http
Authorization: Bearer YOUR_ADMIN_API_KEY
```

---

## Grain Price API

### GET /api/grain/price

Get current GRAIN token price with historical changes.

**Response:**
```json
{
  "nav": 1.0417,
  "change24h": 0.0012,
  "change7d": 0.0087,
  "change30d": 0.0417,
  "timestamp": "2025-11-21T18:00:00Z",
  "supply": 48000000,
  "totalAssets": 50000000,
  "tiers": {
    "liquid": 20000000,
    "float": 5000000,
    "physical": 10000000,
    "investments": 8000000,
    "receivables": 7000000
  }
}
```

**Caching:** 1 minute
**Rate Limit:** 100 requests/minute

---

## Founding Investor API

### POST /api/grain/invest

Submit a founding investment ($10K minimum, max 100 investors).

**Request:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "amount": 10000,
  "email": "investor@example.com",
  "kycStatus": "pending"
}
```

**Response:**
```json
{
  "success": true,
  "investment": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
    "usdcAmount": 10000,
    "grainAmount": 10000,
    "price": 1.00,
    "vestingSchedule": {
      "totalAmount": 10000,
      "startDate": "2025-11-21T18:00:00Z",
      "cliffDate": "2026-11-21T18:00:00Z",
      "endDate": "2029-11-21T18:00:00Z",
      "monthlyRelease": 208.33,
      "released": 0,
      "remaining": 10000
    },
    "spotsRemaining": 87
  },
  "message": "Investment received. GRAIN tokens will be minted after KYC verification."
}
```

**Validation:**
- Minimum investment: $10,000
- Maximum investors: 100
- Valid Ethereum address required
- Email verification required

---

### GET /api/grain/invest/status/:address

Check founding investor status and vesting schedule.

**Response:**
```json
{
  "investor": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
    "email": "investor@example.com",
    "investmentAmount": 10000,
    "grainAmount": 10000,
    "kycStatus": "verified",
    "status": "minted",
    "mintTxHash": "0xabc123...",
    "investedAt": "2025-11-21T18:00:00Z"
  },
  "vesting": {
    "totalAmount": 10000,
    "unlockedAmount": 2500,
    "lockedAmount": 7500,
    "startDate": "2025-11-21T18:00:00Z",
    "cliffDate": "2026-11-21T18:00:00Z",
    "endDate": "2029-11-21T18:00:00Z",
    "monthlyRelease": 208.33,
    "nextUnlockDate": "2025-12-21T18:00:00Z",
    "nextUnlockAmount": 208.33,
    "progress": 25
  }
}
```

---

## Vault Management API

### GET /api/vault/assets

Get current vault asset breakdown by tier.

**Response:**
```json
{
  "totalNAV": 50000000,
  "tiers": [
    {
      "name": "Liquid",
      "value": 20000000,
      "percentage": 40,
      "description": "Cash and cash equivalents"
    },
    {
      "name": "Float",
      "value": 5000000,
      "percentage": 10,
      "description": "Payments in transit"
    },
    {
      "name": "Physical",
      "value": 10000000,
      "percentage": 20,
      "description": "Physical inventory and commodities"
    },
    {
      "name": "Investments",
      "value": 8000000,
      "percentage": 16,
      "description": "Equity and debt investments"
    },
    {
      "name": "Receivables",
      "value": 7000000,
      "percentage": 14,
      "description": "Accounts receivable"
    }
  ],
  "timestamp": "2025-11-21T18:00:00Z"
}
```

**Caching:** 5 minutes

---

### POST /api/vault/deposit

Deposit USDC and receive GRAIN at current NAV.

**Request:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "usdcAmount": 1000
}
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "txHash": "0xdef456...",
    "type": "deposit",
    "usdcAmount": 1000,
    "grainAmount": 959.61,
    "nav": 1.0417,
    "fee": 3.30,
    "netAmount": 996.70,
    "timestamp": "2025-11-21T18:00:00Z"
  },
  "message": "Deposit transaction submitted. GRAIN will be credited after confirmation."
}
```

**Fees:** 0.33% (33 basis points)

**Prerequisites:**
- User must approve Vault contract to spend USDC
- Sufficient USDC balance

---

### POST /api/vault/withdraw

Burn GRAIN and receive USDC at current NAV.

**Request:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "grainAmount": 1000
}
```

**Response (< $100K):**
```json
{
  "success": true,
  "transaction": {
    "txHash": "0xghi789...",
    "type": "withdrawal",
    "grainAmount": 1000,
    "usdcAmount": 1041.70,
    "nav": 1.0417,
    "fee": 3.44,
    "netAmount": 1038.26,
    "timestamp": "2025-11-21T18:00:00Z"
  },
  "message": "Withdrawal transaction submitted. USDC will be transferred after confirmation."
}
```

**Response (> $100K - Timelock):**
```json
{
  "success": true,
  "timelock": {
    "requestId": "12345",
    "grainAmount": 100000,
    "usdcAmount": 104170,
    "nav": 1.0417,
    "fee": 343.76,
    "netAmount": 103826.24,
    "executeAt": "2025-11-22T18:00:00Z",
    "hoursRemaining": 24
  },
  "message": "Withdrawal request created. Amount is over $100,000, so it requires a 24h timelock. You can execute after Nov 22, 2025 6:00 PM."
}
```

**Fees:** 0.33%
**Timelock:** Withdrawals > $100K require 24-hour delay

---

## Escrow API

### POST /api/escrow/create

Create milestone-based escrow for B2B transactions.

**Request:**
```json
{
  "amount": 100000,
  "currency": "USDC",
  "seller": "0x8F85c31C76D6FBa15c1f8f1dC0F3f4E4C9d4e2A3",
  "buyer": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "milestones": [
    { "name": "Design Complete", "percentage": 25 },
    { "name": "Development", "percentage": 50 },
    { "name": "Delivery", "percentage": 25 }
  ],
  "disputeResolver": "0x3D4a9b5F2e1c8B6a4E9f7c3D2e1A8b5c6d7e8f9a",
  "deadline": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "escrow": {
    "id": "67890",
    "seller": "0x8F85c31C76D6FBa15c1f8f1dC0F3f4E4C9d4e2A3",
    "buyer": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
    "amount": 100000,
    "currency": "USDC",
    "milestones": [
      { "name": "Design Complete", "percentage": 25 },
      { "name": "Development", "percentage": 50 },
      { "name": "Delivery", "percentage": 25 }
    ],
    "currentMilestone": 0,
    "deadline": "2025-12-31T23:59:59Z",
    "status": "active",
    "createdAt": "2025-11-21T18:00:00Z"
  },
  "message": "Escrow created successfully. Funds are locked until milestones are completed."
}
```

**Validation:**
- Milestones must sum to 100%
- Valid addresses required
- Supported currencies: USDC, GRAIN

---

### GET /api/escrow/:id

Get escrow details and current status.

**Response:**
```json
{
  "escrow": {
    "id": "67890",
    "seller": "0x8F85c31C76D6FBa15c1f8f1dC0F3f4E4C9d4e2A3",
    "buyer": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
    "amount": 100000,
    "currency": "USDC",
    "milestones": [
      { "name": "Design Complete", "percentage": 25, "index": 0, "completed": true, "isCurrent": false },
      { "name": "Development", "percentage": 50, "index": 1, "completed": false, "isCurrent": true },
      { "name": "Delivery", "percentage": 25, "index": 2, "completed": false, "isCurrent": false }
    ],
    "currentMilestone": 1,
    "totalMilestones": 3,
    "releasedAmount": 25000,
    "remainingAmount": 75000,
    "status": "active",
    "deadline": "2025-12-31T23:59:59Z",
    "createdAt": "2025-11-21T18:00:00Z"
  },
  "transactions": [
    {
      "type": "milestone_complete",
      "milestone": 0,
      "amount": 25000,
      "txHash": "0xjkl012...",
      "timestamp": "2025-11-25T12:00:00Z"
    }
  ]
}
```

---

### POST /api/escrow/:id/milestone

Mark milestone as complete and trigger automatic release.

**Request:**
```json
{
  "milestoneIndex": 1,
  "completedBy": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8"
}
```

**Response:**
```json
{
  "success": true,
  "milestone": {
    "index": 1,
    "name": "Development",
    "percentage": 50,
    "amountReleased": 50000,
    "txHash": "0xmno345..."
  },
  "escrow": {
    "id": "67890",
    "currentMilestone": 2,
    "totalMilestones": 3,
    "status": "active"
  },
  "message": "Milestone 2 completed. Funds released to seller."
}
```

---

### POST /api/escrow/:id/dispute

Raise a dispute and freeze escrow funds.

**Request:**
```json
{
  "raisedBy": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "reason": "Deliverables do not match agreed specifications. Evidence attached.",
  "evidence": [
    "https://storage.example.com/evidence1.pdf",
    "https://storage.example.com/evidence2.png"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "dispute": {
    "escrowId": "67890",
    "raisedBy": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
    "reason": "Deliverables do not match agreed specifications. Evidence attached.",
    "txHash": "0xpqr678...",
    "status": "pending",
    "createdAt": "2025-11-21T18:00:00Z"
  },
  "message": "Dispute raised. Funds are now frozen. A resolver will review the case."
}
```

---

## Transaction History API

### GET /api/transactions/:address

Get transaction history for an address.

**Query Parameters:**
- `limit` (default: 50, max: 100)
- `offset` (default: 0)
- `type` (optional: mint, burn, transfer, deposit, withdrawal)

**Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "transactions": [
    {
      "type": "deposit",
      "txHash": "0xabc123...",
      "timestamp": "2025-11-21T18:00:00Z",
      "amount": 959.61,
      "usdcValue": 1000,
      "nav": 1.0417,
      "fee": 3.30,
      "status": "completed"
    },
    {
      "type": "founding_investment",
      "txHash": "0xdef456...",
      "timestamp": "2025-11-01T12:00:00Z",
      "amount": 10000,
      "usdcValue": 10000,
      "nav": 1.00,
      "fee": 0,
      "status": "minted"
    }
  ],
  "totals": {
    "totalVolume": 11000,
    "totalFees": 3.30,
    "deposits": 1000,
    "withdrawals": 0,
    "mints": 10959.61,
    "burns": 0,
    "netPosition": 10959.61
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 2
  }
}
```

---

## Analytics API

### GET /api/analytics/grain

Get comprehensive analytics dashboard.

**Response:**
```json
{
  "overview": {
    "totalUsers": 87,
    "totalInvested": 870000,
    "totalGRAINSupply": 48000000,
    "totalVaultAssets": 50000000,
    "avgInvestment": 10000,
    "dailyVolume": 125000,
    "monthlyVolume": 3500000
  },
  "vault": {
    "totalTransactions": 1524,
    "totalDeposits": 2000000,
    "totalWithdrawals": 500000,
    "totalFees": 8250,
    "netFlow": 1500000
  },
  "escrow": {
    "totalEscrows": 45,
    "totalValue": 2500000,
    "activeEscrows": 12,
    "completedEscrows": 30,
    "completionRate": 66.67
  },
  "activity": {
    "last7Days": [
      { "date": "2025-11-21", "transactions": 45, "volume": 125000 },
      { "date": "2025-11-20", "transactions": 38, "volume": 98000 }
    ]
  },
  "growth": {
    "weeklyNewUsers": [
      { "week": "2025-11-18", "newUsers": 12 },
      { "week": "2025-11-11", "newUsers": 15 }
    ]
  },
  "timestamp": "2025-11-21T18:00:00Z"
}
```

---

## Admin API

**All admin endpoints require authentication:**
```http
Authorization: Bearer YOUR_ADMIN_API_KEY
```

### POST /api/admin/grain?action=update-nav

Manually update NAV price.

**Request:**
```json
{
  "newNAV": 1.0450,
  "newAssets": 52000000,
  "tiers": {
    "liquid": 21000000,
    "float": 5200000,
    "physical": 10500000,
    "investments": 8300000,
    "receivables": 7000000
  },
  "reason": "Q4 2025 asset valuation update based on audited financials"
}
```

**Response:**
```json
{
  "success": true,
  "update": {
    "oldNAV": 1.0417,
    "newNAV": 1.0450,
    "changePercent": 0.32,
    "newAssets": 52000000,
    "tiers": {
      "liquid": 21000000,
      "float": 5200000,
      "physical": 10500000,
      "investments": 8300000,
      "receivables": 7000000
    },
    "txHash": "0xstu901...",
    "reason": "Q4 2025 asset valuation update based on audited financials",
    "timestamp": "2025-11-21T18:00:00Z"
  },
  "message": "NAV updated successfully. All caches invalidated."
}
```

**Validation:**
- Maximum NAV change: 5% per update
- Tiers must sum to total assets

---

### POST /api/admin/grain?action=pause

Emergency system pause.

**Request:**
```json
{
  "reason": "Critical security vulnerability detected in smart contract",
  "notifyUsers": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "System paused. All transactions are frozen.",
  "reason": "Critical security vulnerability detected in smart contract",
  "timestamp": "2025-11-21T18:00:00Z"
}
```

---

### GET /api/admin/grain/health

System health check.

**Response:**
```json
{
  "status": "healthy",
  "responseTime": "245ms",
  "services": {
    "rpc": "healthy",
    "cache": "healthy",
    "database": "healthy",
    "contracts": "healthy"
  },
  "timestamp": "2025-11-21T18:00:00Z"
}
```

---

## Blockchain Events

The system listens to the following smart contract events in real-time:

### GRAIN Token Events
- **GrainMinted** - New GRAIN tokens minted
- **GrainBurned** - GRAIN tokens burned
- **Transfer** - GRAIN transferred between addresses

### Price Oracle Events
- **NAVUpdated** - NAV price updated

### Vault Events
- **Deposit** - USDC deposited, GRAIN minted
- **Withdrawal** - GRAIN burned, USDC withdrawn

### Escrow Events
- **EscrowCreated** - New escrow created
- **MilestoneCompleted** - Milestone marked complete
- **DisputeRaised** - Dispute raised on escrow

**Event Processing:**
- Database updates
- Email/SMS notifications
- Cache invalidation
- Webhook triggers

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": {}
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (admin endpoints)
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

**Example Error:**
```json
{
  "error": "Invalid request data",
  "message": "Amount must be positive",
  "details": {
    "field": "amount",
    "value": -100,
    "constraint": "positive"
  }
}
```

---

## Rate Limiting

**Default Limits:**
- Public APIs: 100 requests/minute per IP
- Admin APIs: 1000 requests/minute
- Price API: 100 requests/minute (cached)

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1700000000
```

**When Rate Limited:**
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 42 seconds.",
  "retryAfter": 42
}
```

---

## Smart Contract Addresses

**Base Sepolia Testnet:**
- GRAIN Token: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8`
- Grain Vault: `0x8F85c31C76D6FBa15c1f8f1dC0F3f4E4C9d4e2A3`
- Price Oracle: `0x3D4a9b5F2e1c8B6a4E9f7c3D2e1A8b5c6d7e8f9a`
- Escrow: `0x5E6f8a9b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f`
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

---

## Infrastructure

**Stack:**
- Next.js 16 (App Router)
- Viem (Blockchain)
- Upstash Redis (Caching)
- Vercel Postgres (Database)
- Resend (Email)
- Sentry (Error Tracking)

**Monitoring:**
- API response times
- RPC call frequency
- Cache hit rates
- Transaction success rates
- System health checks

---

## Support

**Documentation:** https://docs.grainandvault.com
**API Status:** https://status.grainandvault.com
**Discord:** https://discord.gg/grainandvault
**Email:** api@grainandvault.com

---

**Built to handle $3B in transactions. 🚀**
