# Grain & Vault: Comprehensive FAQ

**Everything you need to know about GRAIN & Vault**

---

## For Investors

### What is GRAIN?

GRAIN is a USDC-backed stablecoin that automatically appreciates in value based on the Net Asset Value (NAV) of the Vault treasury.

**Simple analogy:** Think of it like a money market fund, but:
- Tradeable like Bitcoin
- Usable for instant payments
- Backed 110% by real assets

---

### How is GRAIN different from USDC?

| Feature | GRAIN | USDC |
|---------|-------|------|
| Price | Appreciates (starts $1.00, grows to $1.08+) | Fixed $1.00 |
| Yield | 8% APY (automatic) | 0% |
| Backing | USDC + Treasuries (110%) | USD (1:1) |
| Use Case | Payments + Investment | Payments only |

**GRAIN = USDC + Built-in Yield**

---

### Why does NAV appreciate?

The Vault earns money 4 ways:

1. **Treasury Yields** - T-bills, money markets (5-8% APY)
2. **Transaction Fees** - 33 bps on all payments
3. **Float Income** - Earn yield on circulating GRAIN
4. **Asset Appreciation** - Equipment, inventory, receivables

All profits → Vault NAV → GRAIN price increases.

---

### What are the risks?

**1. Smart Contract Risk**
- Bug could lock funds
- *Mitigation: Audited + $100K bug bounty*

**2. NAV Decline Risk**
- Assets lose value → GRAIN price drops
- *Mitigation: 110% collateral + circuit breaker*

**3. Liquidity Risk**
- Can't sell quickly
- *Mitigation: Instant USDC redemption (72hr for $100K+)*

**4. Regulatory Risk**
- SEC could classify as security
- *Mitigation: Legal opinion + pivot option*

**Bottom line:** Lower risk than crypto, higher than savings account.

---

### How liquid is GRAIN?

**Instant:**
- Up to $10K: Withdraw to USDC anytime, no delay

**72-Hour Time-Lock:**
- $10K-$100K: 72-hour processing time
- Prevents bank runs
- Gives treasury time to liquidate T-bills

**7-Day Notice:**
- $100K+: 7 days notice required

**Alternative:** Sell GRAIN to other users (P2P) instantly.

---

### What happens if I need cash quickly?

**Option 1: Instant Withdrawal (up to $10K)**
```
1. Click "Withdraw" in dashboard
2. Enter amount
3. Confirm transaction
4. Receive USDC in 5 minutes
```

**Option 2: Delayed Withdrawal (> $10K)**
```
1. Request withdrawal
2. Wait 72 hours
3. Receive USDC
```

**Option 3: Sell to Another User**
```
1. Post sale on marketplace
2. Get matched with buyer
3. Transfer GRAIN instantly
4. They pay you USDC
```

---

### Are founding investors locked in?

**Yes, 24-month linear vesting:**

| Month | % Vested | Example ($10K Investment) |
|-------|----------|---------------------------|
| 0 | 0% | $0 available |
| 6 | 25% | $2,500 available |
| 12 | 50% | $5,000 available |
| 18 | 75% | $7,500 available |
| 24 | 100% | $10,000 available |

**Why?** Prevents early dumping, protects all investors.

**You still earn yield on unvested GRAIN!**

---

### What if NAV goes down?

**Circuit Breaker System:**

If NAV drops >10%:
1. System automatically pauses
2. 7-day audit period
3. Founders verify asset values
4. Publish transparency report
5. System resumes with accurate NAV

**Example:**
- NAV drops from $100M → $85M (15% decline)
- Circuit breaker triggers
- Audit finds error: $5M receivable was written off
- Correct NAV: $90M (only 10% decline)
- System resumes

**You're protected by:**
- 110% minimum collateral
- Real-time monitoring
- Audit process
- Insurance (future)

---

## For Users

### How do I buy GRAIN?

**Step 1: Create Account**
- Sign up at app.grainvault.com
- Verify email

**Step 2: Connect Wallet**
- MetaMask, Coinbase Wallet, or WalletConnect
- Base L2 network

**Step 3: Deposit USDC**
- Approve USDC transfer
- Deposit amount
- Receive GRAIN 1:1 (minus any fees)

**Step 4: Done!**
- GRAIN appears in wallet
- Starts earning yield immediately

---

### How do I sell GRAIN?

**Step 1: Go to Dashboard**
- Click "Withdraw"

**Step 2: Enter Amount**
- How much GRAIN to sell

**Step 3: Confirm**
- Approve transaction

**Step 4: Receive USDC**
- Instant (< $10K)
- 72 hours ($10K-$100K)

---

### What are the fees?

**Deposit:** 0% (free)
**Withdrawal:** 0% (free)
**Transfer:** Network gas fees only (~$0.01 on Base L2)

**Transaction Fees (B2B payments):**
- 33 basis points (0.33%)
- Example: $100K payment = $330 fee
- Split: 50% to Vault (NAV growth), 50% to treasury operations

---

### How long does settlement take?

**On-Chain Transfers:** 5 seconds (2 confirmations on Base L2)

**Escrow Payments:**
- Instant lock in escrow
- Released on milestone completion
- Typically 1-30 days total

**Withdrawals to USDC:**
- < $10K: Instant
- $10K-$100K: 72 hours
- $100K+: 7 days

---

### Can I use GRAIN for payments?

**Yes!**

**P2P Payments:**
```
1. Enter recipient wallet address
2. Enter amount
3. Confirm
4. Done (5 seconds)
```

**B2B Payments via Escrow:**
```
1. Create escrow with milestones
2. Fund escrow with GRAIN
3. Supplier completes work
4. Milestone auto-releases payment
5. Supplier receives GRAIN
```

**Merchant Payments (future):**
- Integrate GRAIN checkout button
- Accept GRAIN for goods/services
- Convert to USDC instantly (if desired)

---

### What's the minimum investment?

**No minimum for users.** Buy $1 of GRAIN if you want.

**Founding Investors:** $10,000 minimum (special pricing + benefits)

---

### Is this regulated?

**Current Status:**
- GRAIN is a utility token (not a security)
- Grain & Vault LLC is a Delaware company
- Money Transmitter License (MTL): Evaluating need by state

**Future:**
- May register as MSB (Money Services Business)
- May obtain MTLs in key states (NY, CA, TX)
- May partner with licensed entities for compliance

**We prioritize compliance.** Working with fintech attorneys to ensure legality.

---

### What insurance exists?

**Current:**
- Smart contract audit by Trail of Bits
- Bug bounty: $100K for critical vulnerabilities
- Multi-sig wallet (3-of-5 required for admin actions)

**Future (planned):**
- DeFi insurance (Nexus Mutual or similar)
- D&O insurance for founders
- Fidelity bond for treasury operations

**Your funds are protected by:**
- Smart contract security
- 110% collateralization
- Decentralized custody (you control your wallet)

---

## For Developers

### What blockchain does GRAIN use?

**Base L2** - Coinbase-backed Ethereum Layer 2

**Why Base?**
- Fast (2-second finality)
- Cheap ($0.01 per transaction)
- Secure (inherits from Ethereum mainnet)
- Easy onboarding (Coinbase users)
- EVM-compatible (Solidity contracts)

---

### What token standard is GRAIN?

**ERC-20** - Standard Ethereum token

**Extensions:**
- Pausable (emergency stop)
- AccessControl (role-based permissions)
- ReentrancyGuard (security)

**Compatible with:**
- MetaMask, Coinbase Wallet, Trust Wallet
- Uniswap, Aave, Compound (future)
- All ERC-20 tools & libraries

---

### How do I integrate GRAIN into my app?

**Option 1: Use our SDK (easiest)**
```javascript
import { GrainSDK } from '@grainvault/sdk'

const grain = new GrainSDK({
  network: 'base-mainnet',
  apiKey: 'your_api_key'
})

// Send GRAIN
await grain.transfer({
  to: '0x...',
  amount: '1000'
})

// Check balance
const balance = await grain.balanceOf('0x...')
```

**Option 2: Direct contract calls**
```javascript
import { ethers } from 'ethers'
import GRAIN_ABI from './abis/Grain.json'

const grain = new ethers.Contract(GRAIN_ADDRESS, GRAIN_ABI, wallet)
await grain.transfer(recipientAddress, amount)
```

**Option 3: REST API**
```bash
curl -X POST https://api.grainvault.com/v1/transfer \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "to": "0x...",
    "amount": "1000"
  }'
```

---

### Where are the contracts deployed?

**Base Mainnet (Production):**
- Grain Token: `0x...` (TBD)
- Vault: `0x...` (TBD)
- Escrow: `0x...` (TBD)

**Base Sepolia (Testnet):**
- Grain Token: `0x...` (TBD)
- Vault: `0x...` (TBD)
- Escrow: `0x...` (TBD)

**Verified on Basescan:**
- View source code
- Read/write contract
- Check transactions

---

### Where can I find the ABIs?

**GitHub:**
```bash
git clone https://github.com/wellsonyx/grain-vault
cd grain-vault/artifacts/contracts/core
```

**NPM Package:**
```bash
npm install @grainvault/contracts
```

```javascript
import { GRAIN_ABI, VAULT_ABI, ESCROW_ABI } from '@grainvault/contracts'
```

**API:**
```bash
curl https://api.grainvault.com/v1/abis/grain
```

---

### What RPC providers should I use?

**Recommended (Base L2):**

1. **Alchemy** (best for production)
   - https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
   - Free: 300M compute units/month

2. **Infura**
   - https://base-mainnet.infura.io/v3/YOUR_KEY
   - Free: 100K requests/day

3. **QuickNode**
   - Fast, global
   - Paid: $49/month

4. **Public RPC** (not for production)
   - https://mainnet.base.org

---

### How do I test on testnet?

**1. Get Base Sepolia ETH**
- Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

**2. Get Test USDC**
- Mint from Base Sepolia faucet

**3. Connect to Testnet**
```javascript
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org')
```

**4. Deploy/Interact**
```javascript
const grain = new ethers.Contract(TESTNET_GRAIN_ADDRESS, GRAIN_ABI, wallet)
// Test all functionality
```

---

### What support channels are available?

**Developers:**
- Discord: https://discord.gg/grainvault
- Telegram: @grainvault_dev
- GitHub Issues: https://github.com/wellsonyx/grain-vault/issues

**API Support:**
- Email: api@grainvault.com
- Docs: https://docs.grainvault.com
- Status: https://status.grainvault.com

**Enterprise:**
- Sales: sales@grainvault.com
- Solutions: solutions@grainvault.com

---

## General Questions

### Who founded Grain & Vault?

**Jonah Manning** - CEO
- Ex-aerospace engineer
- Built Wells AI (B2B automation platform)
- Serial entrepreneur

**Legal & Finance Partners:**
- Attorney with fintech experience
- CFO with treasury management background

**Advisory Board:**
- Blockchain experts
- Former bankers
- Compliance specialists

---

### Is Grain & Vault open source?

**Smart Contracts:** Yes
- Full source code on GitHub
- Verified on Basescan
- MIT License

**Backend/Frontend:** Partially
- Core libraries: Open source
- Proprietary services: Closed source
- SDKs: Open source

**Why?** Security through transparency. But keep competitive advantages.

---

### How does Grain & Vault make money?

**Revenue Streams:**

1. **Transaction Fees** (33 bps)
   - Example: $100M volume/month = $330K/month

2. **Treasury Yields** (5-8% APY)
   - Example: $100M reserves @ 6% = $6M/year

3. **Float Income**
   - GRAIN circulates for 30-60 days
   - Earn yield during float

4. **Enterprise Services** (future)
   - Custom integrations
   - White-label solutions
   - API subscriptions

**Business Model:** High volume, low margins.

---

### What's the roadmap?

**Q1 2026: Foundation**
- ✅ Smart contracts deployed
- ✅ Security audit complete
- ✅ Pilot with 25 customers
- 🔄 $1M in deposits

**Q2 2026: Growth**
- 🔄 100 customers
- 🔄 $10M in deposits
- 🔄 Partnership integrations (QuickBooks, Xero)
- 🔄 Mobile apps (iOS, Android)

**Q3 2026: Scale**
- 🔄 1,000 customers
- 🔄 $100M in deposits
- 🔄 Multi-chain support (Arbitrum, Polygon)
- 🔄 Decentralized governance

**Q4 2026: Enterprise**
- 🔄 10,000 customers
- 🔄 $1B in deposits
- 🔄 Institutional partnerships
- 🔄 IPO or acquisition offers

---

### How can I stay updated?

**Newsletter:**
- Subscribe: https://grainvault.com/newsletter

**Social Media:**
- Twitter: @grainvault
- LinkedIn: Grain & Vault LLC
- Discord: https://discord.gg/grainvault

**Blog:**
- https://blog.grainvault.com

**Investor Updates:**
- Monthly emails to founding investors
- Quarterly all-hands calls

---

### How do I contact support?

**General:**
- Email: support@grainvault.com
- Response time: 24 hours

**Technical:**
- Email: tech@grainvault.com
- Discord: #support channel

**Sales:**
- Email: sales@grainvault.com
- Book call: https://calendly.com/grainvault

**Urgent/Emergency:**
- Phone: +1 (850) 456-1961
- Available: 9am-5pm EST, Mon-Fri

---

**Still have questions?**

Email us: hello@grainvault.com

We respond to every message within 24 hours.

---

**Grain & Vault - The only credit line that pays you.**
