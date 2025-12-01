# Grain & Vault: Complete Deployment Guide

**Last Updated:** November 21, 2025
**Target Audience:** DevOps, System Administrators
**Time Required:** 4-6 hours (first deployment)

---

## Table of Contents

1. [Phase 1: Local Development](#phase-1-local-development)
2. [Phase 2: Testnet Deployment](#phase-2-testnet-deployment)
3. [Phase 3: Mainnet Deployment](#phase-3-mainnet-deployment)
4. [Post-Deployment](#post-deployment)
5. [Troubleshooting](#troubleshooting)

---

## Phase 1: Local Development

### Prerequisites

```bash
node >= 18.17.0
npm >= 9.0.0
git
```

### Step 1: Clone Repository

```bash
git clone https://github.com/wellsonyx/grain-vault.git
cd grain-vault
```

### Step 2: Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install contract dependencies
cd contracts
npm install
cd ..
```

### Step 3: Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-...

# Database (local PostgreSQL)
DATABASE_URL=postgresql://localhost:5432/grainvault

# Blockchain (Hardhat local node)
BASE_RPC_URL=http://localhost:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Encryption
ENCRYPTION_MASTER_SECRET=your-32-byte-hex-string

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 4: Setup Local Database

```bash
# Start PostgreSQL (using Docker)
docker run --name postgres-grain \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=grainvault \
  -p 5432:5432 \
  -d postgres:15

# Run migrations
npm run db:migrate
```

### Step 5: Run Local Blockchain

Open new terminal:

```bash
cd contracts
npx hardhat node
```

This starts local blockchain on `http://localhost:8545` with 20 pre-funded accounts.

### Step 6: Deploy Contracts Locally

```bash
# In contracts directory
npm run deploy:local
```

Output:
```
Deploying contracts with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Account balance: 10000000000000000000000

📝 Configuration:
  USDC Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  Admin Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  Network: localhost

🚀 Deploying Grain Token...
✅ Grain deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

🚀 Deploying Vault...
✅ Vault deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

🚀 Deploying Escrow...
✅ Escrow deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

🔐 Granting roles...
✅ Vault has MINTER_ROLE on Grain

🎉 DEPLOYMENT COMPLETE!
```

### Step 7: Update Environment with Contract Addresses

Add to `.env.local`:

```bash
GRAIN_CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
VAULT_CONTRACT_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
ESCROW_CONTRACT_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
USDC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Step 8: Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

### Step 9: Test Local Deployment

```bash
# Test deposit flow
npm run test:api

# Test smart contract interactions
cd contracts
npm test
```

---

## Phase 2: Testnet Deployment

### Prerequisites

1. **Base Sepolia ETH** - Get from faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
2. **Base Sepolia Account** - Create new wallet for testnet
3. **Basescan API Key** - https://basescan.org/myapikey

### Step 1: Configure Testnet Environment

Create `.env.testnet`:

```bash
# Blockchain
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_testnet_private_key_here
ADMIN_ADDRESS=your_admin_address_here

# USDC on Base Sepolia
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Basescan
BASESCAN_API_KEY=your_api_key_here

# Database
DATABASE_URL=your_vercel_postgres_staging_url

# App
NEXT_PUBLIC_APP_URL=https://testnet.grainvault.com
```

### Step 2: Deploy Contracts to Base Sepolia

```bash
cd contracts
source ../.env.testnet
npm run deploy:testnet
```

Expected output:

```
🚀 Deploying to Base Sepolia...

✅ Grain deployed to: 0x1234...
✅ Vault deployed to: 0x5678...
✅ Escrow deployed to: 0x9abc...

🔐 Roles configured
📝 Deployment info saved to deployments/base-sepolia.json
```

### Step 3: Verify Contracts on Basescan

```bash
# Verify Grain
npx hardhat verify --network baseSepolia \
  0x1234... \
  $ADMIN_ADDRESS \
  0x5678...

# Verify Vault
npx hardhat verify --network baseSepolia \
  0x5678... \
  $USDC_ADDRESS \
  0x1234... \
  $ADMIN_ADDRESS

# Verify Escrow
npx hardhat verify --network baseSepolia \
  0x9abc... \
  $ADMIN_ADDRESS \
  0x5678...
```

### Step 4: Deploy Frontend to Vercel (Staging)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to staging
vercel --env DATABASE_URL=$DATABASE_URL \
       --env GRAIN_CONTRACT_ADDRESS=0x1234... \
       --env VAULT_CONTRACT_ADDRESS=0x5678... \
       --env ESCROW_CONTRACT_ADDRESS=0x9abc...
```

### Step 5: Run Integration Tests

```bash
# Test all API endpoints
npm run test:integration -- --network testnet

# Test contract interactions
cd contracts
npm run test:testnet
```

### Step 6: Test User Flows

**Manual testing checklist:**

- [ ] User signup/login
- [ ] Deposit USDC → Receive GRAIN
- [ ] Transfer GRAIN to another user
- [ ] Create escrow
- [ ] Complete milestone
- [ ] Withdraw GRAIN → Receive USDC
- [ ] Check NAV updates
- [ ] Test circuit breaker (admin)

### Step 7: Security Checks

```bash
# Run security audit tools
npm run audit

# Check for vulnerabilities
npm audit fix

# Test circuit breaker
npm run test:circuit-breaker
```

### Step 8: Performance Testing

```bash
# Load test API
npm run test:load -- --target https://testnet.grainvault.com

# Monitor for 24 hours
# Check logs, errors, gas usage
```

---

## Phase 3: Mainnet Deployment

**⚠️ WARNING: This is production. Triple-check everything.**

### Pre-Deployment Checklist

- [ ] Security audit completed (Trail of Bits)
- [ ] All tests passing (100% coverage)
- [ ] 30+ days on testnet without issues
- [ ] Multi-sig wallet configured (3-of-5)
- [ ] Bug bounty program live
- [ ] Insurance policy in place
- [ ] Legal/compliance review complete
- [ ] Customer support ready
- [ ] Monitoring & alerts configured

### Step 1: Setup Multi-Sig Wallet

```bash
# Use Gnosis Safe on Base
# https://app.safe.global/welcome

# Create 3-of-5 multi-sig
# Signers: CEO, CFO, CTO, 2 external advisors
```

### Step 2: Configure Production Environment

Create `.env.production`:

```bash
# Blockchain
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=deployer_key_here
ADMIN_ADDRESS=multi_sig_address_here

# USDC on Base Mainnet
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Basescan
BASESCAN_API_KEY=production_api_key

# Database
DATABASE_URL=vercel_postgres_production_url

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# App
NEXT_PUBLIC_APP_URL=https://app.grainvault.com

# Encryption
ENCRYPTION_MASTER_SECRET=production_secret_64_char_hex

# Monitoring
SENTRY_DSN=your_sentry_dsn
```

### Step 3: Deploy Contracts to Base Mainnet

```bash
cd contracts
source ../.env.production

# Final review
echo "About to deploy to MAINNET. Proceed? (yes/no)"
read confirm

if [ "$confirm" = "yes" ]; then
  npm run deploy:mainnet
fi
```

### Step 4: Verify Contracts on Basescan

```bash
# Automated verification
npm run verify:mainnet

# Manual check on Basescan
# Ensure all contracts show verified source code
```

### Step 5: Transfer Ownership to Multi-Sig

```bash
# Create Gnosis Safe transaction
# Grant all admin roles to multi-sig
# Revoke deployer's admin role

# Use Gnosis Safe UI:
# 1. Contract Interaction → Grain Token
# 2. Call grantRole(DEFAULT_ADMIN_ROLE, multiSigAddress)
# 3. Require 3-of-5 signatures
# 4. Execute transaction
```

### Step 6: Seed Vault with Initial Reserves

```bash
# From multi-sig wallet, approve USDC
# Transfer $100K initial reserves to Vault

# Confirm collateral ratio = 110%+
```

### Step 7: Deploy Frontend to Production

```bash
# Deploy to production
vercel --prod \
  --env DATABASE_URL=$DATABASE_URL \
  --env GRAIN_CONTRACT_ADDRESS=0x... \
  --env VAULT_CONTRACT_ADDRESS=0x... \
  --env ESCROW_CONTRACT_ADDRESS=0x... \
  ...

# Custom domain
vercel domains add app.grainvault.com
```

### Step 8: Enable Monitoring

```bash
# Sentry error tracking
# Already configured via SENTRY_DSN

# Uptime monitoring
curl -X POST https://uptimerobot.com/api/v2/newMonitor \
  -d api_key=$UPTIME_ROBOT_KEY \
  -d friendly_name="Grain Vault Production" \
  -d url=https://app.grainvault.com \
  -d type=1

# Custom alerts (PagerDuty)
# Configure in PagerDuty dashboard
```

### Step 9: Run Final Tests

```bash
# Smoke tests on production
npm run test:smoke -- --network mainnet

# Create small test transaction
# Deposit $100 → Verify GRAIN received
```

### Step 10: Go Live!

**Launch checklist:**

- [ ] Announce on social media
- [ ] Email pilot customers
- [ ] Monitor for first 24 hours
- [ ] On-call team ready
- [ ] Customer support standing by

---

## Post-Deployment

### Daily Operations

**Morning Routine:**
1. Check monitoring dashboards
2. Verify NAV updated correctly
3. Review overnight transactions
4. Check collateral ratio

**Weekly Tasks:**
1. Review security logs
2. Update documentation
3. Team sync on issues
4. Customer feedback review

### Monitoring Dashboards

**Grafana Dashboard:**
- API response times
- Error rates
- Transaction volume
- Gas usage

**Blockchain Dashboard:**
- GRAIN supply
- Collateral ratio
- NAV trend
- Contract events

### Backup & Disaster Recovery

**Database Backups:**
- Automated daily backups (Vercel Postgres)
- Retention: 30 days
- Restore time: 4 hours

**Contract State:**
- On-chain (immutable)
- Indexed by The Graph
- Historical data via Dune Analytics

### Scaling

**When to scale:**
- API response time > 500ms
- Error rate > 0.5%
- Database connections > 80%

**How to scale:**
- Vercel auto-scales serverless functions
- Database: Upgrade plan or add replicas
- Blockchain: Add more RPC providers

---

## Troubleshooting

### Contract Deployment Failed

**Error:** "Insufficient funds"
```bash
# Check deployer balance
cast balance $DEPLOYER_ADDRESS --rpc-url $BASE_RPC_URL

# Need at least 0.01 ETH for deployment
```

**Error:** "Nonce too low"
```bash
# Reset nonce
hardhat run --network baseSepolia scripts/reset-nonce.js
```

### Contract Verification Failed

**Error:** "Already verified"
```bash
# Contract is already verified, no action needed
```

**Error:** "Bytecode mismatch"
```bash
# Ensure compiler settings match:
# - Solidity version
# - Optimizer enabled
# - Optimizer runs = 200

# Re-compile and re-verify
npx hardhat clean
npx hardhat compile
npx hardhat verify --network baseSepolia <address> <constructor-args>
```

### Frontend Not Loading

**Error:** "Contract not found"
```bash
# Check contract addresses in .env
# Verify contracts deployed to correct network

# Test contract connection
cast call $GRAIN_ADDRESS "totalSupply()" --rpc-url $BASE_RPC_URL
```

### Transaction Failing

**Error:** "Execution reverted"
```bash
# Check transaction logs on Basescan
# Look for revert reason

# Common causes:
# - Insufficient balance
# - Insufficient allowance
# - Contract paused
# - Circuit breaker triggered
```

### Database Connection Issues

**Error:** "Too many connections"
```bash
# Check active connections
# Reduce connection pool size
# Add PgBouncer for connection pooling
```

---

## Rollback Procedure

**If critical bug found in production:**

1. **Pause Contracts** (multi-sig)
   ```solidity
   grain.pause()
   vault.pause()
   escrow.pause()
   ```

2. **Notify Users** (email, Twitter, banner)
   - "System temporarily paused for maintenance"
   - "All funds are safe"
   - "Expected resolution: X hours"

3. **Deploy Fix** (if code change needed)
   - Deploy new contracts
   - Migrate liquidity via governance
   - Test thoroughly on testnet first

4. **Resume Operations**
   ```solidity
   grain.unpause()
   vault.unpause()
   escrow.unpause()
   ```

5. **Post-Mortem**
   - Document issue
   - Root cause analysis
   - Preventive measures
   - Public transparency report

---

## Support

**Technical Issues:**
- Email: devops@grainvault.com
- Slack: #engineering
- PagerDuty: For critical alerts

**Deployment Help:**
- See TROUBLESHOOTING_GUIDE.md
- See ADMIN_OPERATIONS_MANUAL.md

---

**Deployment complete! You're now running Grain & Vault. 🚀**
