# Grain & Vault API - Quick Start Guide

Get the Grain & Vault backend API running in under 10 minutes.

---

## Prerequisites

- Node.js 18+
- PostgreSQL database (Vercel Postgres, Neon, Supabase)
- Upstash Redis account (free tier available)
- Base Sepolia testnet access (free RPC: https://sepolia.base.org)

---

## Step 1: Clone & Install

```bash
git clone https://github.com/yourcompany/wells-ai-github-ready.git
cd wells-ai-github-ready
npm install
```

---

## Step 2: Setup Database

Run the Grain & Vault schema:

```bash
psql $DATABASE_URL -f scripts/schema-grain.sql
```

This creates:
- `founding_investors` - Investor records with vesting
- `vault_transactions` - Deposit/withdrawal history
- `withdrawal_requests` - Time-locked withdrawals
- `escrows` - Milestone-based escrow contracts
- `escrow_transactions` - Escrow activity log
- `escrow_disputes` - Dispute cases
- `grain_events` - Blockchain event log
- `nav_updates` - NAV price audit trail
- `system_events` - System monitoring

---

## Step 3: Configure Environment

Copy the environment template:

```bash
cp .env.grain.example .env.local
```

**Essential Variables:**

```env
# Database
DATABASE_URL=postgresql://user:password@host/db

# Redis Cache
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Blockchain
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ADMIN_PRIVATE_KEY=0x... # Admin wallet for contract interactions

# Email
RESEND_API_KEY=re_your_key
EMAIL_FROM=invest@grainandvault.com

# Admin API
ADMIN_API_KEY=your_secure_admin_key_here
```

---

## Step 4: Deploy Smart Contracts (if needed)

If contracts aren't deployed yet:

```bash
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy-grain.ts --network base-sepolia
```

Update contract addresses in `.env.local`:

```env
NEXT_PUBLIC_GRAIN_ADDRESS=0x...
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_ESCROW_ADDRESS=0x...
```

---

## Step 5: Test APIs

Start the development server:

```bash
npm run dev
```

### Test Price API

```bash
curl http://localhost:3000/api/grain/price
```

Expected response:
```json
{
  "nav": 1.0417,
  "change24h": 0.0012,
  "supply": 48000000,
  "totalAssets": 50000000
}
```

### Test Vault Assets

```bash
curl http://localhost:3000/api/vault/assets
```

### Test Analytics

```bash
curl http://localhost:3000/api/analytics/grain
```

---

## Step 6: Start Event Listener

The event listener runs automatically when the app starts. To run it separately:

```typescript
import { startEventListener } from '@/lib/blockchain/event-listener'

// In your app initialization
await startEventListener()
```

This listens for:
- ✅ GRAIN mints/burns
- ✅ Vault deposits/withdrawals
- ✅ NAV updates
- ✅ Escrow milestones
- ✅ Disputes raised

---

## API Endpoints Overview

### 📊 Price & Assets

- `GET /api/grain/price` - Current GRAIN price
- `GET /api/vault/assets` - Vault asset breakdown

### 💰 Founding Investors

- `POST /api/grain/invest` - Submit investment
- `GET /api/grain/invest/status/:address` - Check vesting status

### 🏦 Vault Operations

- `POST /api/vault/deposit` - Deposit USDC → GRAIN
- `POST /api/vault/withdraw` - Withdraw GRAIN → USDC

### 🤝 Escrow

- `POST /api/escrow/create` - Create milestone escrow
- `GET /api/escrow/:id` - Get escrow details
- `POST /api/escrow/:id/milestone` - Complete milestone
- `POST /api/escrow/:id/dispute` - Raise dispute

### 📈 Analytics

- `GET /api/analytics/grain` - Full dashboard
- `GET /api/transactions/:address` - User transaction history

### 🔧 Admin

- `POST /api/admin/grain?action=update-nav` - Update NAV
- `POST /api/admin/grain?action=pause` - Emergency pause
- `GET /api/admin/grain/health` - System health

---

## Testing with Postman

Import this collection:

```json
{
  "info": {
    "name": "Grain & Vault API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get GRAIN Price",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/grain/price"
      }
    },
    {
      "name": "Submit Founding Investment",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/grain/invest",
        "body": {
          "mode": "raw",
          "raw": "{\"address\":\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8\",\"amount\":10000,\"email\":\"test@example.com\"}"
        }
      }
    },
    {
      "name": "Deposit to Vault",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/vault/deposit",
        "body": {
          "mode": "raw",
          "raw": "{\"address\":\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8\",\"usdcAmount\":1000}"
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    }
  ]
}
```

---

## Production Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard:
- Settings → Environment Variables
- Add all from `.env.local`

### Railway

```bash
railway up
```

### Docker

```bash
docker build -t grain-vault-api .
docker run -p 3000:3000 --env-file .env.local grain-vault-api
```

---

## Monitoring & Alerts

### Health Check

```bash
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  https://api.grainandvault.com/api/admin/grain/health
```

Expected:
```json
{
  "status": "healthy",
  "services": {
    "rpc": "healthy",
    "cache": "healthy",
    "database": "healthy",
    "contracts": "healthy"
  }
}
```

### Set up Alerts

1. **Uptime Monitoring**: Use UptimeRobot or Checkly
2. **Error Tracking**: Sentry (already configured)
3. **Performance**: Vercel Analytics
4. **Custom Alerts**: Monitor `/api/admin/grain/health`

---

## Common Issues

### "Insufficient USDC allowance"

User needs to approve Vault contract:

```typescript
await usdcContract.approve(VAULT_ADDRESS, amount)
```

### "Rate limit exceeded"

Increase cache TTL or add more Redis capacity.

### "RPC call failed"

Check RPC URL and rate limits. Consider using Alchemy or QuickNode.

### "Transaction failed"

Check:
- Gas estimation
- User balance
- Contract state
- Network congestion

---

## Security Checklist

- ✅ Never commit private keys
- ✅ Rotate admin API keys regularly
- ✅ Use environment variables for secrets
- ✅ Enable rate limiting (Upstash)
- ✅ Monitor for suspicious activity
- ✅ Set up 2FA for admin accounts
- ✅ Regularly audit smart contracts
- ✅ Test on testnet first

---

## Next Steps

1. **Read Full Documentation**: [BACKEND_API_DOCS.md](./BACKEND_API_DOCS.md)
2. **Deploy Smart Contracts**: See `contracts/README.md`
3. **Set up Webhooks**: For external integrations
4. **Configure Monitoring**: Datadog, Sentry, etc.
5. **Load Testing**: Use `scripts/load-test.yml`

---

## Support

- **Documentation**: https://docs.grainandvault.com
- **Discord**: https://discord.gg/grainandvault
- **Email**: dev@grainandvault.com
- **GitHub Issues**: https://github.com/yourcompany/wells-ai/issues

---

**Built to handle $3B in transactions. Ready to scale. 🚀**
