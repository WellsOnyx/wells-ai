/**
 * GRAIN Token Deployment Script
 *
 * Deploys GRAIN stablecoin to Base L2 (mainnet or testnet)
 *
 * Prerequisites:
 * 1. npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
 * 2. Set DEPLOYER_PRIVATE_KEY in .env
 * 3. Set BASE_RPC_URL in .env (or use default)
 *
 * Usage:
 * - Testnet: npx hardhat run contracts/deploy-grain.js --network base-sepolia
 * - Mainnet: npx hardhat run contracts/deploy-grain.js --network base
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🌾 Deploying GRAIN Stablecoin to Base L2...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy GRAIN
  console.log("Deploying GRAIN token...");
  const GRAIN = await ethers.getContractFactory("GRAIN");
  const grain = await GRAIN.deploy();
  await grain.waitForDeployment();

  const grainAddress = await grain.getAddress();
  console.log("✅ GRAIN deployed to:", grainAddress);

  // Verify deployment
  console.log("\nVerifying deployment...");
  const name = await grain.name();
  const symbol = await grain.symbol();
  const decimals = await grain.decimals();

  console.log("Token Name:", name);
  console.log("Token Symbol:", symbol);
  console.log("Decimals:", decimals);

  // Grant roles to Wells AI treasury (you'll update this address)
  // For now, deployer has all roles
  console.log("\nRoles granted to deployer:", deployer.address);
  console.log("- DEFAULT_ADMIN_ROLE");
  console.log("- MINTER_ROLE");
  console.log("- PAUSER_ROLE");
  console.log("- TREASURY_ROLE");

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\nGRAIN Contract Address:", grainAddress);
  console.log("\nNext steps:");
  console.log("1. Verify contract on BaseScan:");
  console.log(`   npx hardhat verify --network base ${grainAddress}`);
  console.log("\n2. Add to Vercel environment:");
  console.log(`   GRAIN_CONTRACT_ADDRESS=${grainAddress}`);
  console.log("\n3. Update lib/grain/contract.ts with address");
  console.log("\n4. Grant MINTER_ROLE to your backend wallet");

  return grainAddress;
}

main()
  .then((address) => {
    console.log("\n🌾 GRAIN is ready at:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
