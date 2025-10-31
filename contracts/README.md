# Grain Smart Contracts

Solidity smart contracts for the Grain token and Vault treasury system.

---

## Overview

**Grain** is a B2B stablecoin (1 GRAIN = 1 USD) backed by USDC on Base L2.

**GrainVault** manages collateral, minting/burning, and credit lines.

**Key Features:**
- 0% transaction fees
- 1:1 to 2:1 credit leverage
- Full USDC collateralization (110% overcollateralized)
- Multi-sig security
- Compliance (freeze/unfreeze accounts)

---

## Contracts

### 1. **Grain.sol** - ERC-20 Stablecoin

```solidity
// Core functions
mint(address to, uint256 amount)        // Vault only
burn(address from, uint256 amount)      // Vault only
freeze(address account, string reason)  // Compliance only
unfreeze(address account)               // Compliance only
pause()                                 // Admin only
unpause()                               // Admin only

// Standard ERC-20
transfer(address to, uint256 amount)
approve(address spender, uint256 amount)
transferFrom(address from, address to, uint256 amount)
balanceOf(address account)
totalSupply()
```

**Roles:**
- `DEFAULT_ADMIN_ROLE`: Can grant/revoke all other roles
- `MINTER_ROLE`: Can mint/burn (Vault contract)
- `PAUSER_ROLE`: Can pause/unpause transfers
- `COMPLIANCE_ROLE`: Can freeze/unfreeze accounts

### 2. **GrainVault.sol** - Treasury & Credit Manager

```solidity
// Core functions
deposit(uint256 amount)                           // Deposit USDC, mint GRAIN, open credit
withdraw(uint256 amount)                          // Burn GRAIN, withdraw USDC
payWithCredit(address seller, uint256 amount)     // Pay seller using credit line
repayCredit(uint256 amount)                       // Repay credit, restore credit line
upgradeTier(address user, uint256 newTier)        // Upgrade to higher leverage tier

// View functions
getAccountSummary(address user)                   // Get deposits, credit, tier
getCollateralRatio()                              // Current collateralization %
getTierLeverage(address user)                     // Get user's leverage (100, 150, 200)

// Admin functions
withdrawYield(address token, uint256 amount, address recipient) // Withdraw earned yield
pause() / unpause()                               // Emergency pause
```

**Roles:**
- `DEFAULT_ADMIN_ROLE`: Can grant/revoke roles
- `ADMIN_ROLE`: Can pause/unpause
- `CREDIT_MANAGER_ROLE`: Can upgrade user tiers
- `TREASURY_ROLE`: Can withdraw yield

**Credit Tiers:**
- Tier 1: 1:1 leverage (100%)
- Tier 2: 1.5:1 leverage (150%)
- Tier 3: 2:1 leverage (200%)

---

## Installation

```bash
cd contracts
npm install
```

---

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
PRIVATE_KEY=your_private_key_here
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # Base Mainnet USDC
ADMIN_ADDRESS=your_admin_address_here
BASESCAN_API_KEY=your_basescan_api_key_here
```

**USDC Addresses:**
- **Base Sepolia (Testnet)**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Base Mainnet**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

---

## Compilation

```bash
npm run compile
```

This compiles all Solidity files to `artifacts/` directory.

---

## Testing

```bash
npm test
```

Run tests with gas reporting:
```bash
npm run gas-report
```

Run tests with coverage:
```bash
npm run coverage
```

---

## Deployment

### Testnet (Base Sepolia)

1. Get testnet ETH from faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
2. Get testnet USDC from Base Sepolia faucet
3. Deploy:

```bash
npm run deploy:testnet
```

### Mainnet (Base)

1. Fund deployer address with ETH (for gas)
2. Update `.env` with production values
3. Deploy:

```bash
npm run deploy:mainnet
```

**Expected Gas Costs (Base L2):**
- Grain deployment: ~$0.50
- GrainVault deployment: ~$1.00
- Role setup: ~$0.20
- **Total: ~$1.70**

---

## Contract Verification

After deployment, verify on Basescan:

```bash
# Verify Grain token
npx hardhat verify --network base-mainnet <GRAIN_ADDRESS> <ADMIN_ADDRESS> <MINTER_ADDRESS>

# Verify Vault
npx hardhat verify --network base-mainnet <VAULT_ADDRESS> <USDC_ADDRESS> <GRAIN_ADDRESS> <ADMIN_ADDRESS>
```

---

## Usage Examples

### Deposit USDC, Get GRAIN & Credit Line

```javascript
const { ethers } = require("ethers");

// Connect to contracts
const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

// Approve USDC
const amount = ethers.parseUnits("100000", 6); // $100K (USDC has 6 decimals)
await usdc.approve(VAULT_ADDRESS, amount);

// Deposit
await vault.deposit(amount);

// Result:
// - User receives 100,000 GRAIN (18 decimals)
// - User gets $100K credit line (1:1 leverage)
```

### Pay Seller Using Credit

```javascript
const sellerAddress = "0x...";
const amount = ethers.parseUnits("50000", 6); // $50K

await vault.payWithCredit(sellerAddress, amount);

// Result:
// - Seller receives 50,000 GRAIN
// - Buyer's credit line reduced by $50K
// - Buyer's credit used: $50K
```

### Repay Credit

```javascript
const amount = ethers.parseUnits("50000", 6); // $50K

// Approve USDC
await usdc.approve(VAULT_ADDRESS, amount);

// Repay
await vault.repayCredit(amount);

// Result:
// - Buyer's credit line restored: +$50K
// - Buyer's credit used reduced: -$50K
```

### Withdraw USDC

```javascript
const amount = ethers.parseUnits("100000", 6); // $100K

await vault.withdraw(amount);

// Result:
// - 100,000 GRAIN burned from user
// - User receives $100K USDC
// - Credit line reduced proportionally

// Note: Can only withdraw if no outstanding credit
```

### Upgrade Credit Tier (Admin Only)

```javascript
const userAddress = "0x...";
const newTier = 2; // Upgrade to Tier 2 (1.5:1 leverage)

await vault.upgradeTier(userAddress, newTier);

// Result:
// - User's credit line increased to 1.5x deposits
// - Example: $100K deposit → $150K credit line
```

---

## Security

### Roles & Permissions

**Grain Token:**
- Only Vault can mint/burn
- Only compliance officer can freeze/unfreeze
- Only admin can pause/unpause

**Vault:**
- Only credit manager can upgrade tiers
- Only treasury can withdraw yield
- Only admin can pause/unpause

### Auditing

Before mainnet launch:
1. Unit test coverage: >95%
2. Integration tests: All flows tested
3. Security audit: Trail of Bits or OpenZeppelin
4. Testnet deployment: 30+ days live testing
5. Bug bounty: $50K for critical bugs

### Multi-Sig

Production deployment uses Gnosis Safe multi-sig:
- 3-of-5 signatures required
- Signers: CEO, CFO, CTO, 2 external board members

---

## Gas Optimization

**Grain Token:**
- Uses OpenZeppelin battle-tested implementations
- Optimizer runs: 200 (balanced)
- Estimated gas per transfer: ~50K gas (~$0.01 on Base L2)

**Vault:**
- Packed storage for gas savings
- NonReentrant guards for security
- Estimated gas per deposit: ~150K gas (~$0.03 on Base L2)

---

## Upgradeability

**Grain & Vault are NOT upgradeable** (by design):
- Immutable for maximum security
- No admin backdoors
- Users can trust code won't change

**If breaking changes needed:**
- Deploy new contracts
- Migrate liquidity via governance vote
- Sunset old contracts gracefully

---

## Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **Security**: security@wellsonyx.com

---

## License

MIT License - See LICENSE file

---

**Built for Wells AI - The Ultimate B2B Stablecoin** 🌾
