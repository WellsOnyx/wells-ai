# Grain & Vault Smart Contracts: Quick Start

**Get up and running in 5 minutes**

---

## 1. Install Dependencies

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

---

## 2. Configure Environment

Create `.env` file:

```bash
# Deployer wallet private key
PRIVATE_KEY=0x...

# RPC URLs
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_RPC_URL=https://mainnet.base.org

# Block explorer API key (for verification)
BASESCAN_API_KEY=your_api_key_here
```

---

## 3. Deploy to Testnet

```bash
npx hardhat run scripts/deploy-grain-vault.ts --network baseSepolia
```

**Expected output:**
```
🚀 Deploying Grain & Vault to Base...

✅ Vault deployed at: 0x...
✅ Grain deployed at: 0x...
✅ GrainPriceOracle deployed at: 0x...
✅ Escrow deployed at: 0x...
```

**Save these addresses to your `.env`:**
```bash
VAULT_ADDRESS=0x...
GRAIN_ADDRESS=0x...
ORACLE_ADDRESS=0x...
ESCROW_ADDRESS=0x...
```

---

## 4. Verify Contracts

```bash
# Verify Vault
npx hardhat verify --network baseSepolia <VAULT_ADDRESS> <USDC_ADDRESS>

# Verify Grain
npx hardhat verify --network baseSepolia <GRAIN_ADDRESS> <VAULT_ADDRESS> <ORACLE_ADDRESS> <VESTING_END_TIME>

# Verify Oracle
npx hardhat verify --network baseSepolia <ORACLE_ADDRESS> <GRAIN_ADDRESS> <VAULT_ADDRESS> <INITIAL_NAV>

# Verify Escrow
npx hardhat verify --network baseSepolia <ESCROW_ADDRESS> <FEE_COLLECTOR>
```

---

## 5. Test Basic Operations

### A. Deposit to Vault

```typescript
import { ethers } from 'hardhat';

const vault = await ethers.getContractAt('Vault', VAULT_ADDRESS);
const usdc = await ethers.getContractAt('IERC20', USDC_ADDRESS);

// Approve
await usdc.approve(VAULT_ADDRESS, ethers.parseUnits("10000", 6));

// Deposit $10K
await vault.deposit(ethers.parseUnits("10000", 6));

console.log("Deposited $10K USDC to Vault");
```

### B. Mint GRAIN

```typescript
const grain = await ethers.getContractAt('Grain', GRAIN_ADDRESS);

// Mint 1000 GRAIN at current NAV
await grain.mint(userAddress, ethers.parseEther("1000"));

console.log("Minted 1000 GRAIN");
```

### C. Create Escrow

```typescript
const escrow = await ethers.getContractAt('Escrow', ESCROW_ADDRESS);

const milestones = ["Shipment confirmed", "Delivery confirmed"];
const percentages = [5000, 5000]; // 50% each

const escrowId = await escrow.createEscrow(
  beneficiaryAddress,
  arbitratorAddress,
  USDC_ADDRESS,
  ethers.parseUnits("100000", 6), // $100K
  90, // 90 days
  "TEST-ESCROW-001",
  milestones,
  percentages
);

console.log("Escrow created:", escrowId);
```

### D. Update NAV

```typescript
const oracle = await ethers.getContractAt('GrainPriceOracle', ORACLE_ADDRESS);

await oracle.updatePrice(
  ethers.parseEther("50000000"), // $50M assets
  ethers.parseEther("1000000"),  // $1M liabilities
  ethers.parseEther("48000000")  // 48M GRAIN supply
);

const price = await oracle.latestAnswer();
console.log("GRAIN price:", ethers.formatEther(price));
```

---

## 6. Monitor Events

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);

// Listen for deposits
vault.on('Deposit', (from, amount, timestamp) => {
  console.log(`Deposit: ${from} deposited ${amount} at ${timestamp}`);
});

// Listen for withdrawals
vault.on('WithdrawalQueued', (withdrawalId, to, amount, executeTime) => {
  console.log(`Withdrawal queued: ${amount} to ${to}`);
});
```

---

## 7. Set Up Multi-Sig (Production)

**Use Gnosis Safe:**
1. Go to https://safe.global
2. Create Safe with 3 owners (2-of-3 threshold)
3. Transfer contract ownership to Safe address

```typescript
// Transfer ownership
await grain.transferOwnership(SAFE_ADDRESS);
await vault.transferOwnership(SAFE_ADDRESS);
await escrow.transferOwnership(SAFE_ADDRESS);
await oracle.transferOwnership(SAFE_ADDRESS);
```

---

## Contract Addresses

### Base Sepolia (Testnet)
```
USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
Vault: (deploy and save)
Grain: (deploy and save)
Oracle: (deploy and save)
Escrow: (deploy and save)
```

### Base Mainnet (Production)
```
USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Vault: (deploy after audit)
Grain: (deploy after audit)
Oracle: (deploy after audit)
Escrow: (deploy after audit)
```

---

## Key Files

```
contracts/
  ├── Grain.sol                   # ERC20 stablecoin
  ├── Vault.sol                   # Treasury management
  ├── Escrow.sol                  # Milestone escrow
  ├── GrainPriceOracle.sol        # NAV oracle
  └── interfaces/
      ├── IGrain.sol
      ├── IVault.sol
      ├── IEscrow.sol
      └── IGrainPriceOracle.sol

scripts/
  └── deploy-grain-vault.ts       # Deployment script

docs/
  ├── SMART_CONTRACTS_SUMMARY.md  # Full documentation
  └── SMART_CONTRACTS_QUICKSTART.md # This file
```

---

## Common Commands

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy-grain-vault.ts --network baseSepolia

# Deploy to mainnet (after audit)
npx hardhat run scripts/deploy-grain-vault.ts --network base

# Verify contract
npx hardhat verify --network baseSepolia <ADDRESS> <CONSTRUCTOR_ARGS>

# Check gas costs
REPORT_GAS=true npx hardhat test
```

---

## Security Checklist

Before deploying to mainnet:

- [ ] External audit complete (OpenZeppelin recommended)
- [ ] All critical issues fixed
- [ ] Testnet deployment successful
- [ ] Multi-sig wallet configured (2-of-3)
- [ ] Hardware wallets secured
- [ ] Time-locks tested
- [ ] Circuit breakers tested
- [ ] Emergency pause tested
- [ ] Insurance policies active ($20M)
- [ ] Monitoring infrastructure live

---

## Next Steps

1. Read full documentation: `SMART_CONTRACTS_SUMMARY.md`
2. Deploy to testnet: `npx hardhat run scripts/deploy-grain-vault.ts --network baseSepolia`
3. Test all operations with mock data
4. Get external security audit ($50K)
5. Deploy to mainnet after audit
6. Execute $3B DR deal

---

## Support

**Questions?** Read `SMART_CONTRACTS_SUMMARY.md` for detailed documentation.

**Security concerns?** Schedule external audit before mainnet deployment.

**Ready to deploy?** Follow the 7-step checklist above.

---

**Built for institutional-grade security.**
**Ready for $3B+ escrow transactions.**
