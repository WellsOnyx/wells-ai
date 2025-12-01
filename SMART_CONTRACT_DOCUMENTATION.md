# Smart Contract Documentation

**Grain & Vault System Contracts**
**Version:** 1.0.0
**Solidity:** ^0.8.20
**Network:** Base L2 (Mainnet & Sepolia)

---

## Table of Contents

1. [Overview](#overview)
2. [Grain Token Contract](#grain-token-contract)
3. [Vault Contract](#vault-contract)
4. [Escrow Contract](#escrow-contract)
5. [Integration Examples](#integration-examples)
6. [Gas Costs](#gas-costs)
7. [Security Considerations](#security-considerations)

---

## Overview

### Contract Addresses

**Base Mainnet (chainId: 8453):**
```
Grain Token: 0x... (TBD - deploy with deployment guide)
Vault:       0x... (TBD)
Escrow:      0x... (TBD)
USDC:        0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

**Base Sepolia Testnet (chainId: 84532):**
```
Grain Token: 0x... (TBD)
Vault:       0x... (TBD)
Escrow:      0x... (TBD)
USDC:        0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### System Architecture

```
USDC ←→ Vault ←→ Grain Token
              ↓
           Escrow
```

- **Users deposit USDC → Vault**
- **Vault mints GRAIN → Users**
- **GRAIN used for transactions → Escrow**
- **Vault manages NAV → GRAIN price appreciates**

---

## Grain Token Contract

**File:** `contracts/core/Grain.sol`

### Purpose

GRAIN is a USDC-backed, auto-revaluing stablecoin designed for B2B settlements. Unlike traditional stablecoins with a fixed 1:1 peg, GRAIN's price automatically adjusts based on the Vault's Net Asset Value (NAV).

**Price Formula:**
```
GRAIN_PRICE = TOTAL_NAV / TOTAL_SUPPLY
```

As Vault assets appreciate (treasury yields, investments), GRAIN price increases automatically.

### Public Functions

#### `mint(address to, uint256 amount)`

**Access:** MINTER_ROLE only (Vault contract)

**Description:** Mints new GRAIN tokens when users deposit USDC.

**Parameters:**
- `to` - Recipient address
- `amount` - Amount of GRAIN to mint (18 decimals)

**Events Emitted:**
```solidity
event GrainMinted(address indexed to, uint256 amount, uint256 price);
```

**Example:**
```solidity
// Vault mints 100K GRAIN to user
grain.mint(userAddress, 100000e18);
```

**Gas Cost:** ~50,000 gas (~$0.01 on Base)

---

#### `burn(address from, uint256 amount)`

**Access:** BURNER_ROLE only (Vault contract)

**Description:** Burns GRAIN tokens when users withdraw to USDC.

**Parameters:**
- `from` - Address to burn from
- `amount` - Amount to burn (18 decimals)

**Events Emitted:**
```solidity
event GrainBurned(address indexed from, uint256 amount, uint256 price);
```

**Example:**
```solidity
// Vault burns 50K GRAIN from user
grain.burn(userAddress, 50000e18);
```

**Gas Cost:** ~40,000 gas (~$0.008 on Base)

---

#### `updateNAV(uint256 newNAV)`

**Access:** ORACLE_ROLE only (automated oracle)

**Description:** Updates GRAIN price based on new NAV calculation. Called daily or when significant asset changes occur.

**Parameters:**
- `newNAV` - New total NAV in USD (18 decimals)

**Circuit Breakers:**
1. **Price drop > 5%** → System paused for audit
2. **NAV decline > 10%** → System paused for audit
3. **Collateral < 100%** → System paused for audit

**Events Emitted:**
```solidity
event PriceUpdated(uint256 oldPrice, uint256 newPrice, uint256 totalNAV, uint256 totalSupply);
event NAVUpdated(uint256 oldNAV, uint256 newNAV);
event CircuitBreakerTriggered(string reason, uint256 frozenPrice, uint256 auditDeadline);
```

**Example:**
```solidity
// Oracle updates NAV to $110M (from $100M)
grain.updateNAV(110_000_000e18);
// GRAIN price now: $1.10 (if 100M supply)
```

**Gas Cost:** ~80,000 gas (~$0.016 on Base)

---

#### `getPrice() → uint256`

**Access:** Public (view)

**Description:** Returns current GRAIN price in USD.

**Returns:** Price with 18 decimals (1e18 = $1.00)

**Example:**
```solidity
uint256 price = grain.getPrice();
// price = 1.0417e18 = $1.0417
```

---

#### `getCollateralRatio() → uint256`

**Access:** Public (view)

**Description:** Returns current collateralization ratio.

**Returns:** Ratio in basis points (10000 = 100%, 11000 = 110%)

**Example:**
```solidity
uint256 ratio = grain.getCollateralRatio();
// ratio = 11200 = 112%
```

---

#### `pause()` / `unpause()`

**Access:** PAUSER_ROLE only (admin)

**Description:** Emergency pause mechanism. Stops all transfers, minting, burning.

**Example:**
```solidity
// Emergency pause
grain.pause();

// Resume operations
grain.unpause();
```

**Gas Cost:** ~30,000 gas (~$0.006 on Base)

---

### Access Control Roles

```solidity
DEFAULT_ADMIN_ROLE  = 0x00...  // Can grant/revoke all roles
MINTER_ROLE         = keccak256("MINTER_ROLE")
BURNER_ROLE         = keccak256("BURNER_ROLE")
PAUSER_ROLE         = keccak256("PAUSER_ROLE")
ORACLE_ROLE         = keccak256("ORACLE_ROLE")
```

**Production Setup:**
- `DEFAULT_ADMIN_ROLE` → Multi-sig wallet (3-of-5)
- `MINTER_ROLE` → Vault contract only
- `BURNER_ROLE` → Vault contract only
- `PAUSER_ROLE` → Multi-sig wallet (2-of-5)
- `ORACLE_ROLE` → Automated oracle service

---

### Events

```solidity
event GrainMinted(address indexed to, uint256 amount, uint256 price);
event GrainBurned(address indexed from, uint256 amount, uint256 price);
event PriceUpdated(uint256 oldPrice, uint256 newPrice, uint256 totalNAV, uint256 totalSupply);
event CircuitBreakerTriggered(string reason, uint256 frozenPrice, uint256 auditDeadline);
event CircuitBreakerReset(uint256 newPrice);
event NAVUpdated(uint256 oldNAV, uint256 newNAV);
```

---

### Security Considerations

**1. Reentrancy Protection:**
- All state-changing functions use `nonReentrant` modifier
- OpenZeppelin's ReentrancyGuard implementation

**2. Circuit Breaker:**
- Automatic triggers on anomalies
- 7-day audit period before reset
- Frozen price maintained during audit

**3. Access Control:**
- Role-based permissions (OpenZeppelin AccessControl)
- Multi-sig requirement for admin actions
- No single point of failure

**4. Integer Overflow:**
- Solidity 0.8+ has built-in overflow protection
- Additional checks for price calculations

**5. Pausable:**
- Emergency pause stops all operations
- Can be triggered by admin or automatically

---

## Vault Contract

**File:** `contracts/core/Vault.sol`

### Purpose

The Vault is the treasury management contract. It:
- Holds all USDC reserves
- Tracks downstream assets (equipment, inventory, receivables)
- Calculates total NAV
- Manages collateral ratios
- Orchestrates minting/burning of GRAIN

### Public Functions

#### `deposit(uint256 amount)`

**Access:** Public

**Description:** Deposit USDC into Vault. User receives equivalent GRAIN (minus any fees).

**Parameters:**
- `amount` - USDC amount (6 decimals)

**Process:**
1. Transfer USDC from user to Vault
2. Record deposit in contract state
3. (Vault calls Grain.mint() via backend)

**Events Emitted:**
```solidity
event Deposit(address indexed from, uint256 amount, uint256 timestamp);
```

**Example:**
```solidity
// User deposits $100K USDC
usdc.approve(vaultAddress, 100000e6);
vault.deposit(100000e6);
```

**Gas Cost:** ~100,000 gas (~$0.02 on Base)

---

#### `withdraw(address to, uint256 amount)`

**Access:** WITHDRAWER_ROLE only

**Description:** Withdraw USDC from Vault reserves. Typically called by backend after burning user's GRAIN.

**Parameters:**
- `to` - Recipient address
- `amount` - USDC amount (6 decimals)

**Process:**
1. Verify sufficient USDC balance
2. Transfer USDC to recipient
3. Record withdrawal

**Events Emitted:**
```solidity
event Withdrawal(address indexed to, uint256 amount, uint256 timestamp);
```

**Gas Cost:** ~80,000 gas (~$0.016 on Base)

---

#### `updateAssets(...)`

**Access:** ORACLE_ROLE only

**Description:** Update asset breakdown. Called periodically (every 5 minutes) by backend oracle.

**Parameters:**
```solidity
uint256 _liquidReserves      // USDC + cash + money market
uint256 _floatInTransit      // Pending ACH/wire
uint256 _physicalAssets      // Inventory + equipment + real estate
uint256 _investmentPositions // Bonds + equities + alternatives
uint256 _receivables         // Invoices + loans (probability-adjusted)
```

**Process:**
1. Update all asset categories
2. Calculate new total NAV
3. Emit events for monitoring

**Events Emitted:**
```solidity
event AssetsUpdated(
    uint256 liquidReserves,
    uint256 floatInTransit,
    uint256 physicalAssets,
    uint256 investmentPositions,
    uint256 receivables,
    uint256 totalNAV
);
event NAVCalculated(uint256 nav, uint256 timestamp);
```

**Gas Cost:** ~120,000 gas (~$0.024 on Base)

---

#### `getTotalNAV() → uint256`

**Access:** Public (view)

**Description:** Calculate total Net Asset Value.

**Formula:**
```
NAV = (liquidReserves + floatInTransit + physicalAssets +
       investmentPositions + receivables) - liabilities
```

**Returns:** NAV in USD (6 decimals, USDC standard)

---

#### `getAssetBreakdown() → (...)`

**Access:** Public (view)

**Description:** Get detailed asset allocation.

**Returns:**
```solidity
(
    uint256 liquidReserves,
    uint256 floatInTransit,
    uint256 physicalAssets,
    uint256 investmentPositions,
    uint256 receivables,
    uint256 lastUpdated
)
```

---

### Access Control Roles

```solidity
DEFAULT_ADMIN_ROLE  = 0x00...
WITHDRAWER_ROLE     = keccak256("WITHDRAWER_ROLE")
ORACLE_ROLE         = keccak256("ORACLE_ROLE")
PAUSER_ROLE         = keccak256("PAUSER_ROLE")
```

---

## Escrow Contract

**File:** `contracts/core/Escrow.sol`

### Purpose

Milestone-based escrow for high-value B2B transactions. Features:
- Multi-milestone payment releases
- Dispute resolution
- Time-locked withdrawals
- Multi-party support

### Public Functions

#### `createEscrow(...) → uint256`

**Access:** Public

**Description:** Create new escrow deal.

**Parameters:**
```solidity
address beneficiary              // Seller/recipient
address arbitrator               // Dispute resolver
address token                    // USDC or GRAIN address
uint256 totalAmount              // Total escrow amount
string[] milestoneDescriptions   // ["Shipment", "Delivery", "Installation"]
uint256[] milestonePercentages   // [3000, 4000, 3000] = 30%, 40%, 30%
uint256 expirationDays           // Days until expiration
string dealId                    // External reference ID
string dealDescription           // Deal details
```

**Returns:** `escrowId` (unique ID for this escrow)

**Events Emitted:**
```solidity
event EscrowCreated(
    uint256 indexed escrowId,
    address indexed depositor,
    address indexed beneficiary,
    address token,
    uint256 totalAmount,
    string dealId
);
```

**Gas Cost:** ~200,000 gas (~$0.04 on Base)

---

#### `fundEscrow(uint256 escrowId)`

**Access:** Depositor only

**Description:** Fund escrow with tokens.

**Parameters:**
- `escrowId` - Escrow to fund

**Process:**
1. Transfer `totalAmount + escrowFee` from depositor
2. Transfer escrow fee to fee collector
3. Hold `totalAmount` in contract
4. Mark escrow as Active

**Events Emitted:**
```solidity
event EscrowFunded(uint256 indexed escrowId, uint256 amount, uint256 escrowFee);
```

**Gas Cost:** ~150,000 gas (~$0.03 on Base)

---

#### `completeMilestone(uint256 escrowId, uint256 milestoneIndex)`

**Access:** ORACLE_ROLE only

**Description:** Mark milestone complete and release funds.

**Parameters:**
- `escrowId` - Escrow ID
- `milestoneIndex` - Index of milestone (0-based)

**Process:**
1. Verify milestone not already complete
2. Calculate release amount (based on percentage)
3. Transfer tokens to beneficiary
4. Mark milestone complete
5. If all milestones done, mark escrow complete

**Events Emitted:**
```solidity
event MilestoneCompleted(
    uint256 indexed escrowId,
    uint256 milestoneIndex,
    uint256 amountReleased,
    address indexed beneficiary
);
event EscrowCompleted(uint256 indexed escrowId, uint256 totalReleased);
```

**Gas Cost:** ~120,000 gas (~$0.024 on Base)

---

#### `raiseDispute(uint256 escrowId, string reason)`

**Access:** Depositor or Beneficiary only

**Description:** Raise dispute on active escrow.

**Parameters:**
- `escrowId` - Escrow ID
- `reason` - Dispute reason

**Process:**
1. Verify caller is party to escrow
2. Mark escrow as Disputed
3. Freeze funds until resolved

**Events Emitted:**
```solidity
event EscrowDisputed(
    uint256 indexed escrowId,
    address indexed disputedBy,
    string reason
);
```

**Gas Cost:** ~80,000 gas (~$0.016 on Base)

---

#### `resolveDispute(uint256 escrowId, uint256 depositorPercentage, uint256 beneficiaryPercentage)`

**Access:** ARBITRATOR_ROLE only

**Description:** Resolve dispute and distribute remaining funds.

**Parameters:**
- `escrowId` - Escrow ID
- `depositorPercentage` - % to return to depositor (basis points)
- `beneficiaryPercentage` - % to send to beneficiary (basis points)

**Constraint:** `depositorPercentage + beneficiaryPercentage = 10000` (100%)

**Process:**
1. Calculate amounts based on percentages
2. Transfer to both parties
3. Mark escrow complete

**Events Emitted:**
```solidity
event DisputeResolved(
    uint256 indexed escrowId,
    uint256 depositorAmount,
    uint256 beneficiaryAmount
);
```

**Gas Cost:** ~150,000 gas (~$0.03 on Base)

---

### Escrow Lifecycle

```
1. Created  → deposit() → 2. Pending
                            ↓
                        fundEscrow()
                            ↓
2. Pending  →         →  3. Active
                            ↓
                  completeMilestone() (repeat)
                            ↓
3. Active   →         →  4. Completed

Alternative paths:
- Active → raiseDispute() → Disputed → resolveDispute() → Completed
- Pending/Active → cancelEscrow() → Cancelled (if expired or not funded)
```

---

## Integration Examples

### Deposit USDC, Receive GRAIN

```javascript
const { ethers } = require('ethers');

// 1. Connect to contracts
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, wallet);
const grain = new ethers.Contract(GRAIN_ADDRESS, GRAIN_ABI, wallet);

// 2. Approve USDC
const amount = ethers.parseUnits('100000', 6); // $100K (USDC = 6 decimals)
const approveTx = await usdc.approve(VAULT_ADDRESS, amount);
await approveTx.wait();

// 3. Deposit to Vault
const depositTx = await vault.deposit(amount);
await depositTx.wait();

// 4. Backend mints GRAIN (Vault calls Grain.mint)
// User now has 100,000 GRAIN tokens

// 5. Check balance
const balance = await grain.balanceOf(wallet.address);
console.log(`GRAIN Balance: ${ethers.formatUnits(balance, 18)}`);
```

---

### Create & Fund Escrow

```javascript
// 1. Create escrow
const escrowTx = await escrow.createEscrow(
  beneficiaryAddress,
  arbitratorAddress,
  USDC_ADDRESS,
  ethers.parseUnits('50000', 6), // $50K
  ['Shipment Confirmed', 'Delivery Complete', 'Installation Done'],
  [3000, 4000, 3000], // 30%, 40%, 30%
  30, // 30 days expiration
  'PO-12345',
  'PCB Manufacturing Deal'
);

const receipt = await escrowTx.wait();
const escrowId = receipt.events[0].args.escrowId;

// 2. Approve USDC (total + 0.5% fee)
const total = ethers.parseUnits('50000', 6);
const fee = total * 50n / 10000n; // 0.5%
const approveTx = await usdc.approve(ESCROW_ADDRESS, total + fee);
await approveTx.wait();

// 3. Fund escrow
const fundTx = await escrow.fundEscrow(escrowId);
await fundTx.wait();

console.log(`Escrow ${escrowId} funded and active`);
```

---

## Gas Costs

**Base L2 Gas Prices:** ~0.001 gwei (extremely cheap)

| Operation | Gas | Cost (at 1 gwei, $2500 ETH) |
|-----------|-----|------------------------------|
| GRAIN mint | 50,000 | $0.01 |
| GRAIN burn | 40,000 | $0.008 |
| GRAIN transfer | 60,000 | $0.012 |
| Update NAV | 80,000 | $0.016 |
| Vault deposit | 100,000 | $0.02 |
| Vault withdraw | 80,000 | $0.016 |
| Create escrow | 200,000 | $0.04 |
| Fund escrow | 150,000 | $0.03 |
| Complete milestone | 120,000 | $0.024 |

**Total for typical user flow (deposit → transact → withdraw):**
- ~$0.05 total gas fees

---

## Security Considerations

### 1. Access Control
- All sensitive functions protected by roles
- Multi-sig for admin operations
- Time-locks on critical changes

### 2. Reentrancy Protection
- `nonReentrant` modifier on all external calls
- Checks-Effects-Interactions pattern

### 3. Circuit Breakers
- Automatic pause on anomalies
- Manual emergency pause available
- 7-day recovery period

### 4. Oracle Security
- Decentralized oracle network (future)
- Multi-source price feeds
- Outlier detection & rejection

### 5. Upgrade Safety
- Contracts are NOT upgradeable (immutable)
- New versions deployed separately
- Migration via governance if needed

### 6. Testing
- 95%+ code coverage
- Fuzz testing for edge cases
- Formal verification for critical paths

### 7. Audits
- Pre-launch audit by Trail of Bits
- Ongoing bug bounty program
- Regular security reviews

---

## Contract Source Code

**View on GitHub:**
- Grain: `contracts/core/Grain.sol`
- Vault: `contracts/core/Vault.sol`
- Escrow: `contracts/core/Escrow.sol`

**Verified on Basescan:**
- [Grain Token](https://basescan.org/address/0x...)
- [Vault](https://basescan.org/address/0x...)
- [Escrow](https://basescan.org/address/0x...)

---

**For technical support, contact: contracts@grainvault.com**
