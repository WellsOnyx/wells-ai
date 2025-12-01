/**
 * Deploy Grain & Vault Smart Contracts to Base Network
 *
 * Usage:
 *   npx hardhat run scripts/deploy-grain-vault.ts --network baseSepolia  (testnet)
 *   npx hardhat run scripts/deploy-grain-vault.ts --network base          (mainnet)
 *
 * Requirements:
 * - PRIVATE_KEY in .env (deployer wallet)
 * - BASE_RPC_URL in .env (or use default)
 * - Sufficient ETH for gas on Base network
 */

import { ethers } from "hardhat";

// Base network USDC contract addresses
const USDC_ADDRESSES = {
  baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet USDC
};

async function main() {
  console.log("🚀 Deploying Grain & Vault to Base...\n");

  // Get network
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "base-sepolia" ? "baseSepolia" : "base";
  console.log(`Network: ${networkName} (chainId: ${network.chainId})`);

  // Get USDC address for this network
  const usdcAddress = USDC_ADDRESSES[networkName as keyof typeof USDC_ADDRESSES];
  if (!usdcAddress) {
    throw new Error(`USDC address not configured for network: ${networkName}`);
  }
  console.log(`USDC address: ${usdcAddress}\n`);

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Configuration
  const VESTING_END_TIME = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year from now
  const INITIAL_NAV = ethers.parseEther("1.00"); // $1.00

  console.log("📋 Deployment Configuration:");
  console.log(`  - Vesting End: ${new Date(VESTING_END_TIME * 1000).toISOString()}`);
  console.log(`  - Initial NAV: $${ethers.formatEther(INITIAL_NAV)}\n`);

  // ============ STEP 1: Deploy Vault ============
  console.log("1️⃣  Deploying Vault...");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(usdcAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`   ✅ Vault deployed at: ${vaultAddress}\n`);

  // ============ STEP 2: Deploy GrainPriceOracle ============
  console.log("2️⃣  Deploying GrainPriceOracle...");
  const GrainPriceOracle = await ethers.getContractFactory("GrainPriceOracle");

  // We'll update grainToken address after deploying Grain
  const tempGrainAddress = ethers.ZeroAddress; // Placeholder

  const oracle = await GrainPriceOracle.deploy(
    tempGrainAddress,
    vaultAddress,
    INITIAL_NAV
  );
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log(`   ✅ GrainPriceOracle deployed at: ${oracleAddress}\n`);

  // ============ STEP 3: Deploy Grain ============
  console.log("3️⃣  Deploying Grain...");
  const Grain = await ethers.getContractFactory("Grain");
  const grain = await Grain.deploy(
    vaultAddress,
    oracleAddress,
    VESTING_END_TIME
  );
  await grain.waitForDeployment();
  const grainAddress = await grain.getAddress();
  console.log(`   ✅ Grain deployed at: ${grainAddress}\n`);

  // ============ STEP 4: Update Oracle with Grain address ============
  console.log("4️⃣  Updating GrainPriceOracle with Grain token address...");
  const tx = await oracle.setGrainToken(grainAddress);
  await tx.wait();
  console.log(`   ✅ Oracle updated\n`);

  // ============ STEP 5: Deploy Escrow ============
  console.log("5️⃣  Deploying Escrow...");
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(deployer.address); // Fee collector = deployer initially
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`   ✅ Escrow deployed at: ${escrowAddress}\n`);

  // ============ DEPLOYMENT SUMMARY ============
  console.log("=" .repeat(80));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(80));
  console.log("\n📝 Contract Addresses:");
  console.log(`  Vault:            ${vaultAddress}`);
  console.log(`  Grain:            ${grainAddress}`);
  console.log(`  GrainPriceOracle: ${oracleAddress}`);
  console.log(`  Escrow:           ${escrowAddress}`);
  console.log(`  USDC:             ${usdcAddress}`);

  console.log("\n🔗 Block Explorer:");
  const explorerBase = networkName === "baseSepolia"
    ? "https://sepolia.basescan.org"
    : "https://basescan.org";
  console.log(`  ${explorerBase}/address/${vaultAddress}`);
  console.log(`  ${explorerBase}/address/${grainAddress}`);
  console.log(`  ${explorerBase}/address/${oracleAddress}`);
  console.log(`  ${explorerBase}/address/${escrowAddress}`);

  console.log("\n⚙️  Next Steps:");
  console.log("  1. Verify contracts on BaseScan:");
  console.log(`     npx hardhat verify --network ${networkName} ${vaultAddress} ${usdcAddress}`);
  console.log(`     npx hardhat verify --network ${networkName} ${grainAddress} ${vaultAddress} ${oracleAddress} ${VESTING_END_TIME}`);
  console.log(`     npx hardhat verify --network ${networkName} ${oracleAddress} ${grainAddress} ${vaultAddress} ${INITIAL_NAV}`);
  console.log(`     npx hardhat verify --network ${networkName} ${escrowAddress} ${deployer.address}`);
  console.log("  2. Set up multi-sig wallet (Gnosis Safe)");
  console.log("  3. Transfer ownership to multi-sig");
  console.log("  4. Fund Vault with initial reserves");
  console.log("  5. Configure monitoring (Sentry, PagerDuty)");

  console.log("\n💾 Save these addresses to your .env file:");
  console.log(`VAULT_ADDRESS=${vaultAddress}`);
  console.log(`GRAIN_ADDRESS=${grainAddress}`);
  console.log(`ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`ESCROW_ADDRESS=${escrowAddress}`);

  // Save deployment info to file
  const deploymentInfo = {
    network: networkName,
    chainId: network.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      Vault: vaultAddress,
      Grain: grainAddress,
      GrainPriceOracle: oracleAddress,
      Escrow: escrowAddress,
      USDC: usdcAddress,
    },
    configuration: {
      vestingEndTime: VESTING_END_TIME,
      initialNav: INITIAL_NAV.toString(),
    },
  };

  const fs = require("fs");
  const deploymentPath = `./deployments/${networkName}-${Date.now()}.json`;
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📄 Deployment info saved to: ${deploymentPath}`);

  console.log("\n" + "=" .repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
