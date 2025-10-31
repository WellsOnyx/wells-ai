const hre = require("hardhat");

/**
 * Deployment script for Grain Token & Vault
 *
 * Deployment order:
 * 1. Deploy Grain token
 * 2. Deploy GrainVault
 * 3. Grant MINTER_ROLE to GrainVault
 * 4. Verify contracts on Basescan
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Configuration
  const USDC_ADDRESS = process.env.USDC_ADDRESS; // Base L2 USDC address
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || deployer.address;

  if (!USDC_ADDRESS) {
    throw new Error("USDC_ADDRESS not set in environment");
  }

  console.log("\n📝 Configuration:");
  console.log("  USDC Address:", USDC_ADDRESS);
  console.log("  Admin Address:", ADMIN_ADDRESS);
  console.log("  Network:", hre.network.name);

  // Step 1: Deploy Grain Token
  console.log("\n🚀 Deploying Grain Token...");
  const Grain = await hre.ethers.getContractFactory("Grain");

  // Deploy with temporary minter (will be updated to Vault address)
  const grain = await Grain.deploy(ADMIN_ADDRESS, deployer.address);
  await grain.waitForDeployment();

  const grainAddress = await grain.getAddress();
  console.log("✅ Grain deployed to:", grainAddress);

  // Step 2: Deploy GrainVault
  console.log("\n🚀 Deploying GrainVault...");
  const GrainVault = await hre.ethers.getContractFactory("GrainVault");
  const vault = await GrainVault.deploy(USDC_ADDRESS, grainAddress, ADMIN_ADDRESS);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("✅ GrainVault deployed to:", vaultAddress);

  // Step 3: Grant MINTER_ROLE to Vault
  console.log("\n🔐 Granting MINTER_ROLE to GrainVault...");
  const MINTER_ROLE = await grain.MINTER_ROLE();

  // Grant minter role to vault
  const grantTx = await grain.grantRole(MINTER_ROLE, vaultAddress);
  await grantTx.wait();
  console.log("✅ Granted MINTER_ROLE to Vault");

  // Revoke minter role from deployer
  const revokeTx = await grain.revokeRole(MINTER_ROLE, deployer.address);
  await revokeTx.wait();
  console.log("✅ Revoked MINTER_ROLE from deployer");

  // Verify role assignments
  const vaultHasMinterRole = await grain.hasRole(MINTER_ROLE, vaultAddress);
  console.log("  Vault has MINTER_ROLE:", vaultHasMinterRole);

  // Step 4: Print deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nContract Addresses:");
  console.log("  Grain Token:", grainAddress);
  console.log("  GrainVault:", vaultAddress);
  console.log("  USDC (Base L2):", USDC_ADDRESS);
  console.log("\nRoles:");
  console.log("  Admin:", ADMIN_ADDRESS);
  console.log("  Minter (Vault):", vaultAddress);
  console.log("\nNext Steps:");
  console.log("  1. Verify contracts on Basescan:");
  console.log(`     npx hardhat verify --network ${hre.network.name} ${grainAddress} ${ADMIN_ADDRESS} ${deployer.address}`);
  console.log(`     npx hardhat verify --network ${hre.network.name} ${vaultAddress} ${USDC_ADDRESS} ${grainAddress} ${ADMIN_ADDRESS}`);
  console.log("  2. Update .env with deployed addresses");
  console.log("  3. Test deposit/withdraw flow");
  console.log("  4. Configure yield strategies (treasury management)");
  console.log("=".repeat(60) + "\n");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      grain: {
        address: grainAddress,
        admin: ADMIN_ADDRESS,
      },
      vault: {
        address: vaultAddress,
        usdc: USDC_ADDRESS,
        admin: ADMIN_ADDRESS,
      },
    },
  };

  console.log("\n💾 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
