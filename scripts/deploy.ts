import { ethers } from "hardhat";

/**
 * Deployment script for Grain & Vault contracts
 *
 * Usage:
 * - Testnet: npx hardhat run scripts/deploy.ts --network baseSepolia
 * - Mainnet: npx hardhat run scripts/deploy.ts --network base
 */

async function main() {
  console.log("🚀 Starting Grain & Vault deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // ============================================
  // 1. DEPLOY USDC MOCK (TESTNET ONLY)
  // ============================================

  const network = await ethers.provider.getNetwork();
  const isTestnet = network.chainId === 84532n; // Base Sepolia

  let usdcAddress: string;

  if (isTestnet) {
    console.log("🧪 TESTNET detected - deploying mock USDC...");

    // Deploy mock ERC20 for USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUSDC.waitForDeployment();

    usdcAddress = await mockUSDC.getAddress();
    console.log("✅ Mock USDC deployed at:", usdcAddress);

    // Mint 10,000 USDC to deployer for testing
    const mintTx = await mockUSDC.mint(deployer.address, 10_000_000_000); // 10,000 USDC (6 decimals)
    await mintTx.wait();
    console.log("✅ Minted 10,000 USDC to deployer\n");

  } else {
    // Use real USDC on Base mainnet
    usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    console.log("🔵 MAINNET - Using Circle USDC at:", usdcAddress, "\n");
  }

  // ============================================
  // 2. DEPLOY VAULT
  // ============================================

  console.log("📦 Deploying Vault contract...");

  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(usdcAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("✅ Vault deployed at:", vaultAddress, "\n");

  // ============================================
  // 3. DEPLOY GRAIN
  // ============================================

  console.log("🌾 Deploying Grain contract...");

  const initialPrice = ethers.parseEther("1.0"); // $1.00 initial price (18 decimals)

  const Grain = await ethers.getContractFactory("Grain");
  const grain = await Grain.deploy(
    deployer.address,  // admin
    vaultAddress,      // vault address
    initialPrice       // initial price
  );
  await grain.waitForDeployment();

  const grainAddress = await grain.getAddress();
  console.log("✅ Grain deployed at:", grainAddress);
  console.log("📊 Initial GRAIN price:", ethers.formatEther(initialPrice), "USD\n");

  // ============================================
  // 4. DEPLOY ESCROW
  // ============================================

  console.log("🔐 Deploying Escrow contract...");

  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(
    deployer.address,  // admin
    deployer.address   // fee collector (will be changed to Vault later)
  );
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log("✅ Escrow deployed at:", escrowAddress, "\n");

  // ============================================
  // 5. GRANT ROLES
  // ============================================

  console.log("🔑 Configuring roles and permissions...\n");

  // Grant Vault permission to mint/burn GRAIN
  const MINTER_ROLE = await grain.MINTER_ROLE();
  const BURNER_ROLE = await grain.BURNER_ROLE();
  const ORACLE_ROLE = await grain.ORACLE_ROLE();

  const grantMinterTx = await grain.grantRole(MINTER_ROLE, vaultAddress);
  await grantMinterTx.wait();
  console.log("✅ Granted MINTER_ROLE to Vault");

  const grantBurnerTx = await grain.grantRole(BURNER_ROLE, vaultAddress);
  await grantBurnerTx.wait();
  console.log("✅ Granted BURNER_ROLE to Vault");

  const grantOracleTx = await grain.grantRole(ORACLE_ROLE, vaultAddress);
  await grantOracleTx.wait();
  console.log("✅ Granted ORACLE_ROLE to Vault\n");

  // ============================================
  // 6. VERIFY DEPLOYMENT
  // ============================================

  console.log("🔍 Verifying deployment...\n");

  // Check Vault USDC address
  const vaultUSDC = await vault.usdc();
  console.log("✅ Vault USDC address:", vaultUSDC);

  // Check Grain price
  const grainPriceCheck = await grain.grainPrice();
  console.log("✅ GRAIN price:", ethers.formatEther(grainPriceCheck), "USD");

  // Check Escrow fee
  const escrowFee = await escrow.escrowFeePercent();
  console.log("✅ Escrow fee:", Number(escrowFee) / 100, "%\n");

  // ============================================
  // 7. DEPLOYMENT SUMMARY
  // ============================================

  console.log("═══════════════════════════════════════════════════════");
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log();
  console.log("Contract Addresses:");
  console.log("-------------------");
  if (isTestnet) {
    console.log("Mock USDC:", usdcAddress);
  }
  console.log("Vault:    ", vaultAddress);
  console.log("Grain:    ", grainAddress);
  console.log("Escrow:   ", escrowAddress);
  console.log();

  console.log("Configuration:");
  console.log("--------------");
  console.log("GRAIN initial price: $1.00");
  console.log("Escrow service fee:  0.5%");
  console.log("Min collateral ratio: 110%");
  console.log();

  // ============================================
  // 8. NEXT STEPS
  // ============================================

  console.log("📝 NEXT STEPS:");
  console.log("═══════════════════════════════════════════════════════\n");

  if (isTestnet) {
    console.log("1. Verify contracts on BaseScan:");
    console.log(`   npx hardhat verify --network baseSepolia ${vaultAddress} ${usdcAddress}`);
    console.log(`   npx hardhat verify --network baseSepolia ${grainAddress} ${deployer.address} ${vaultAddress} ${initialPrice}`);
    console.log(`   npx hardhat verify --network baseSepolia ${escrowAddress} ${deployer.address} ${deployer.address}`);
    console.log();
    console.log("2. Test escrow creation:");
    console.log(`   npx hardhat run scripts/test-escrow.ts --network baseSepolia`);
    console.log();
    console.log("3. Update .env with contract addresses");
    console.log();
  } else {
    console.log("1. ⚠️  TRANSFER ADMIN ROLE to multi-sig wallet");
    console.log("2. ⚠️  SET UP GNOSIS SAFE (3-of-5)");
    console.log("3. Verify contracts on BaseScan");
    console.log("4. Fund Vault with initial USDC reserves");
    console.log("5. Schedule external audit (OpenZeppelin)");
    console.log();
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("✨ Deployment complete!");
  console.log("═══════════════════════════════════════════════════════\n");

  // Save deployment addresses to JSON file
  const deployment = {
    network: network.name,
    chainId: network.chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      usdc: usdcAddress,
      vault: vaultAddress,
      grain: grainAddress,
      escrow: escrowAddress,
    },
    config: {
      grainInitialPrice: ethers.formatEther(initialPrice),
      escrowFeePercent: Number(escrowFee) / 100,
      minCollateralRatio: 110,
    },
  };

  const fs = await import("fs");
  const deploymentFile = `deployments/${network.name}-${Date.now()}.json`;
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log("💾 Deployment saved to:", deploymentFile, "\n");
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
