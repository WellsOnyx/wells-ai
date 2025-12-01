const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Integration Tests - Full Transaction Flows", function () {
  async function deployFullSystemFixture() {
    const [admin, vault, user1, user2, depositor, beneficiary, feeCollector] = await ethers.getSigners();

    // Deploy Mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy Vault
    const Vault = await ethers.getContractFactory("Vault");
    const vaultContract = await Vault.deploy(usdc.target);

    // Deploy Grain
    const Grain = await ethers.getContractFactory("Grain");
    const initialPrice = ethers.parseEther("1.0");
    const grain = await Grain.deploy(admin.address, vaultContract.target, initialPrice);

    // Deploy Escrow
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(admin.address, feeCollector.address);

    // Mint USDC to users
    await usdc.mint(user1.address, ethers.parseUnits("1000000", 6)); // 1M USDC
    await usdc.mint(user2.address, ethers.parseUnits("500000", 6));
    await usdc.mint(depositor.address, ethers.parseUnits("5000000", 6)); // 5M for escrow tests

    return {
      grain,
      vaultContract,
      escrow,
      usdc,
      admin,
      vault,
      user1,
      user2,
      depositor,
      beneficiary,
      feeCollector
    };
  }

  describe("Flow 1: User Deposits USDC → Receives GRAIN", function () {
    it("Should complete full deposit and mint flow", async function () {
      const { grain, vaultContract, usdc, vault, user1 } = await loadFixture(deployFullSystemFixture);

      // Step 1: User deposits USDC into Vault
      const depositAmount = ethers.parseUnits("10000", 6); // 10K USDC
      await usdc.connect(user1).approve(vaultContract.target, depositAmount);
      await vaultContract.connect(user1).deposit(depositAmount);

      expect(await usdc.balanceOf(vaultContract.target)).to.equal(depositAmount);
      expect(await vaultContract.totalDeposits()).to.equal(depositAmount);

      // Step 2: Update Vault NAV (simulating asset tracking)
      const nav = ethers.parseEther("10000"); // $10K NAV (converting 6 decimals to 18)
      await vaultContract.connect(vault).updateAssets(
        ethers.parseUnits("10000", 6), // liquidReserves
        0, 0, 0, 0
      );

      // Step 3: Vault calls Grain.updateNAV
      await grain.connect(vault).updateNAV(nav);
      expect(await grain.totalNAV()).to.equal(nav);

      // Step 4: Mint GRAIN to user (price is $1.00)
      const grainAmount = ethers.parseEther("9000"); // Mint 9K GRAIN (90% of NAV for 110% collateral)
      await grain.connect(vault).mint(user1.address, grainAmount);

      expect(await grain.balanceOf(user1.address)).to.equal(grainAmount);
      expect(await grain.totalSupply()).to.equal(grainAmount);

      // Verify collateralization
      const collateralRatio = await grain.getCollateralRatio();
      expect(collateralRatio).to.be.gte(11000); // >= 110%
    });

    it("Should handle NAV appreciation and price increase", async function () {
      const { grain, vaultContract, usdc, vault, user1 } = await loadFixture(deployFullSystemFixture);

      // Initial deposit and mint
      const depositAmount = ethers.parseUnits("10000", 6);
      await usdc.connect(user1).approve(vaultContract.target, depositAmount);
      await vaultContract.connect(user1).deposit(depositAmount);

      const nav1 = ethers.parseEther("10000");
      await grain.connect(vault).updateNAV(nav1);
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));

      const initialPrice = await grain.grainPrice();

      // Simulate NAV appreciation (4% increase)
      const nav2 = ethers.parseEther("10400");
      await vaultContract.connect(vault).updateAssets(
        ethers.parseUnits("10400", 6),
        0, 0, 0, 0
      );
      await grain.connect(vault).updateNAV(nav2);

      const newPrice = await grain.grainPrice();
      expect(newPrice).to.be.gt(initialPrice);

      // New price = 10400 / 9000 ≈ 1.1556
      const expectedPrice = (nav2 * ethers.parseEther("1")) / ethers.parseEther("9000");
      expect(newPrice).to.be.closeTo(expectedPrice, ethers.parseEther("0.001"));

      // User benefits from price appreciation
      const userBalance = await grain.balanceOf(user1.address);
      const userValue = (userBalance * newPrice) / ethers.parseEther("1");
      expect(userValue).to.be.gt(nav1 * 90n / 100n); // Worth more than initial
    });
  });

  describe("Flow 2: B2B Escrow → Milestone Completion → Settlement", function () {
    it("Should complete full escrow lifecycle", async function () {
      const { escrow, usdc, admin, depositor, beneficiary, feeCollector } = await loadFixture(deployFullSystemFixture);

      // Step 1: Create escrow
      const totalAmount = ethers.parseUnits("100000", 6); // 100K USDC
      const tx = await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        admin.address,
        usdc.target,
        totalAmount,
        ["Shipment", "Delivery", "Verification"],
        [3000, 4000, 3000], // 30%, 40%, 30%
        90, // 90 days
        "B2B-001",
        "Manufacturing equipment deal"
      );

      const escrowId = 1;

      // Step 2: Fund escrow
      const escrowFee = (totalAmount * 50n) / 10000n; // 0.5%
      const totalRequired = totalAmount + escrowFee;
      await usdc.connect(depositor).approve(escrow.target, totalRequired);
      await escrow.connect(depositor).fundEscrow(escrowId);

      expect(await usdc.balanceOf(escrow.target)).to.equal(totalAmount);
      expect(await usdc.balanceOf(feeCollector.address)).to.equal(escrowFee);

      // Step 3: Complete milestones progressively
      const beneficiaryInitial = await usdc.balanceOf(beneficiary.address);

      // Milestone 1: Shipment (30%)
      await escrow.connect(admin).completeMilestone(escrowId, 0);
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(
        beneficiaryInitial + (totalAmount * 3000n) / 10000n
      );

      // Milestone 2: Delivery (40%)
      await escrow.connect(admin).completeMilestone(escrowId, 1);
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(
        beneficiaryInitial + (totalAmount * 7000n) / 10000n
      );

      // Milestone 3: Verification (30%)
      await expect(escrow.connect(admin).completeMilestone(escrowId, 2))
        .to.emit(escrow, "EscrowCompleted");

      // Step 4: Verify final state
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(
        beneficiaryInitial + totalAmount
      );
      expect(await usdc.balanceOf(escrow.target)).to.equal(0);

      const details = await escrow.getEscrow(escrowId);
      expect(details.status).to.equal(2); // Completed
      expect(details.releasedAmount).to.equal(totalAmount);
    });

    it("Should handle dispute and resolution", async function () {
      const { escrow, usdc, admin, depositor, beneficiary } = await loadFixture(deployFullSystemFixture);

      // Create and fund escrow
      const totalAmount = ethers.parseUnits("50000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        admin.address,
        usdc.target,
        totalAmount,
        ["Milestone 1"],
        [10000],
        30,
        "DISPUTE-001",
        "Test escrow"
      );

      const escrowId = 1;
      const escrowFee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + escrowFee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      // Raise dispute
      await escrow.connect(depositor).raiseDispute(escrowId, "Goods defective");

      // Arbitrator resolves: 70% refund to depositor, 30% to beneficiary
      const depositorInitial = await usdc.balanceOf(depositor.address);
      const beneficiaryInitial = await usdc.balanceOf(beneficiary.address);

      await escrow.connect(admin).resolveDispute(escrowId, 7000, 3000);

      expect(await usdc.balanceOf(depositor.address)).to.equal(
        depositorInitial + (totalAmount * 7000n) / 10000n
      );
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(
        beneficiaryInitial + (totalAmount * 3000n) / 10000n
      );
    });
  });

  describe("Flow 3: Emergency Pause → Resolve → Unpause", function () {
    it("Should handle emergency pause and recovery", async function () {
      const { grain, vaultContract, escrow, usdc, admin, vault, user1 } = await loadFixture(deployFullSystemFixture);

      // Set up system with funds
      await usdc.connect(user1).approve(vaultContract.target, ethers.parseUnits("10000", 6));
      await vaultContract.connect(user1).deposit(ethers.parseUnits("10000", 6));
      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));

      // EMERGENCY: Pause all systems
      await grain.connect(admin).pause();
      await vaultContract.connect(admin).pause();
      await escrow.connect(admin).pause();

      // Verify all operations blocked
      await expect(
        grain.connect(vault).mint(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(grain, "EnforcedPause");

      await expect(
        vaultContract.connect(user1).deposit(ethers.parseUnits("1000", 6))
      ).to.be.revertedWithCustomError(vaultContract, "EnforcedPause");

      // Resolve issue and unpause
      await grain.connect(admin).unpause();
      await vaultContract.connect(admin).unpause();
      await escrow.connect(admin).unpause();

      // Verify operations resume
      await grain.connect(vault).mint(user1.address, ethers.parseEther("100"));
      expect(await grain.balanceOf(user1.address)).to.equal(ethers.parseEther("9100"));
    });
  });

  describe("Flow 4: Circuit Breaker Trigger → Audit → Reset", function () {
    it("Should trigger circuit breaker on price drop and recover", async function () {
      const { grain, vaultContract, vault, user1, admin } = await loadFixture(deployFullSystemFixture);

      // Setup: Mint tokens
      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));

      const initialPrice = await grain.grainPrice();

      // Trigger circuit breaker with >5% price drop
      await expect(grain.connect(vault).updateNAV(ethers.parseEther("8500")))
        .to.emit(grain, "CircuitBreakerTriggered");

      expect(await grain.circuitBreakerTriggered()).to.be.true;
      expect(await grain.paused()).to.be.true;
      expect(await grain.getPrice()).to.equal(initialPrice); // Price frozen

      // All minting/burning blocked
      await expect(
        grain.connect(vault).mint(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Circuit breaker active");

      // Wait for 7-day audit
      await time.increase(7 * 24 * 60 * 60);

      // Admin resets after audit with corrected values
      const auditedPrice = ethers.parseEther("0.98");
      const auditedNAV = ethers.parseEther("8820");
      await grain.connect(admin).resetCircuitBreaker(auditedPrice, auditedNAV);

      expect(await grain.circuitBreakerTriggered()).to.be.false;
      expect(await grain.paused()).to.be.false;
      expect(await grain.grainPrice()).to.equal(auditedPrice);

      // Operations resume
      await grain.connect(vault).mint(user1.address, ethers.parseEther("100"));
    });
  });

  describe("Flow 5: Multi-User Concurrent Operations", function () {
    it("Should handle multiple users depositing and minting simultaneously", async function () {
      const { grain, vaultContract, usdc, vault, user1, user2 } = await loadFixture(deployFullSystemFixture);

      // User 1 deposits
      const deposit1 = ethers.parseUnits("50000", 6);
      await usdc.connect(user1).approve(vaultContract.target, deposit1);
      await vaultContract.connect(user1).deposit(deposit1);

      // User 2 deposits
      const deposit2 = ethers.parseUnits("30000", 6);
      await usdc.connect(user2).approve(vaultContract.target, deposit2);
      await vaultContract.connect(user2).deposit(deposit2);

      // Update NAV
      const totalNav = ethers.parseEther("80000");
      await grain.connect(vault).updateNAV(totalNav);

      // Mint to both users
      await grain.connect(vault).mint(user1.address, ethers.parseEther("40000"));
      await grain.connect(vault).mint(user2.address, ethers.parseEther("30000"));

      expect(await grain.totalSupply()).to.equal(ethers.parseEther("70000"));
      expect(await grain.balanceOf(user1.address)).to.equal(ethers.parseEther("40000"));
      expect(await grain.balanceOf(user2.address)).to.equal(ethers.parseEther("30000"));

      // Verify collateralization
      const collateralRatio = await grain.getCollateralRatio();
      expect(collateralRatio).to.be.gte(11000);
    });
  });

  describe("Flow 6: Complete System Under Load", function () {
    it("Should handle high-value transactions ($3B escrow)", async function () {
      const { escrow, usdc, admin, depositor, beneficiary, feeCollector } = await loadFixture(deployFullSystemFixture);

      // Mint $3B USDC to depositor
      const amount3B = ethers.parseUnits("3000000000", 6);
      await usdc.mint(depositor.address, amount3B + ethers.parseUnits("15000000", 6)); // Add extra for fee

      // Create $3B escrow
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        admin.address,
        usdc.target,
        amount3B,
        ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
        [2500, 2500, 2500, 2500], // 25% each
        365, // 1 year
        "DR-3B-2025",
        "Dominican Republic frozen funds"
      );

      const escrowId = 1;

      // Fund with fee
      const escrowFee = (amount3B * 50n) / 10000n; // $15M fee
      await usdc.connect(depositor).approve(escrow.target, amount3B + escrowFee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      expect(await usdc.balanceOf(escrow.target)).to.equal(amount3B);
      expect(await usdc.balanceOf(feeCollector.address)).to.equal(escrowFee);

      // Complete all milestones
      for (let i = 0; i < 4; i++) {
        await escrow.connect(admin).completeMilestone(escrowId, i);
      }

      // Verify final distribution
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(amount3B);
      expect(await usdc.balanceOf(escrow.target)).to.equal(0);
    });
  });

  describe("Flow 7: NAV Revaluation with Multiple Asset Classes", function () {
    it("Should track complex asset portfolio and update GRAIN price", async function () {
      const { grain, vaultContract, vault, user1 } = await loadFixture(deployFullSystemFixture);

      // Initial state: Mint GRAIN
      const initialNav = ethers.parseEther("1000000");
      await grain.connect(vault).updateNAV(initialNav);
      await grain.connect(vault).mint(user1.address, ethers.parseEther("900000"));

      // Update Vault with diversified assets
      await vaultContract.connect(vault).updateAssets(
        ethers.parseUnits("500000", 6),  // Liquid reserves
        ethers.parseUnits("100000", 6),  // Float in transit
        ethers.parseUnits("200000", 6),  // Physical assets
        ethers.parseUnits("150000", 6),  // Investment positions
        ethers.parseUnits("50000", 6)    // Receivables
      );

      const totalNav = await vaultContract.getTotalNAV();
      expect(totalNav).to.equal(ethers.parseUnits("1000000", 6));

      // Simulate appreciation across all categories
      await vaultContract.connect(vault).updateAssets(
        ethers.parseUnits("520000", 6),  // +4%
        ethers.parseUnits("105000", 6),  // +5%
        ethers.parseUnits("210000", 6),  // +5%
        ethers.parseUnits("160000", 6),  // +6.67%
        ethers.parseUnits("55000", 6)    // +10%
      );

      const newNav = await vaultContract.getTotalNAV();
      const appreciationPercent = ((newNav - totalNav) * 10000n) / totalNav;
      expect(appreciationPercent).to.be.gt(400); // > 4% appreciation

      // Update GRAIN price
      await grain.connect(vault).updateNAV(ethers.parseEther("1050000"));
      const newPrice = await grain.grainPrice();

      // New price = 1,050,000 / 900,000 ≈ 1.1667
      expect(newPrice).to.be.closeTo(ethers.parseEther("1.1667"), ethers.parseEther("0.001"));
    });
  });

  describe("Flow 8: User Redemption (Burn GRAIN for USDC)", function () {
    it("Should allow users to redeem GRAIN for USDC", async function () {
      const { grain, vaultContract, usdc, vault, admin, user1 } = await loadFixture(deployFullSystemFixture);

      // Setup: User has GRAIN
      await usdc.connect(user1).approve(vaultContract.target, ethers.parseUnits("10000", 6));
      await vaultContract.connect(user1).deposit(ethers.parseUnits("10000", 6));
      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));

      // User wants to redeem 5000 GRAIN
      const burnAmount = ethers.parseEther("5000");
      const grainPrice = await grain.grainPrice();
      const usdcAmount = (burnAmount * grainPrice) / ethers.parseEther("1");

      // Burn GRAIN
      await grain.connect(vault).burn(user1.address, burnAmount);

      // Withdraw equivalent USDC (admin/vault would handle this)
      const usdcAmountIn6Decimals = usdcAmount / ethers.parseUnits("1", 12); // Convert 18 to 6 decimals
      const user1Initial = await usdc.balanceOf(user1.address);
      await vaultContract.connect(admin).withdraw(user1.address, usdcAmountIn6Decimals);

      expect(await grain.balanceOf(user1.address)).to.equal(ethers.parseEther("4000"));
      expect(await usdc.balanceOf(user1.address)).to.equal(user1Initial + usdcAmountIn6Decimals);
    });
  });

  describe("Flow 9: Cross-Contract Event Tracking", function () {
    it("Should emit correlated events across contracts", async function () {
      const { grain, vaultContract, usdc, vault, user1 } = await loadFixture(deployFullSystemFixture);

      const depositAmount = ethers.parseUnits("10000", 6);
      await usdc.connect(user1).approve(vaultContract.target, depositAmount);

      // Track events across all contracts
      const tx1 = await vaultContract.connect(user1).deposit(depositAmount);
      await expect(tx1).to.emit(vaultContract, "Deposit");

      const nav = ethers.parseEther("10000");
      const tx2 = await vaultContract.connect(vault).updateAssets(
        ethers.parseUnits("10000", 6),
        0, 0, 0, 0
      );
      await expect(tx2).to.emit(vaultContract, "AssetsUpdated");
      await expect(tx2).to.emit(vaultContract, "NAVCalculated");

      const tx3 = await grain.connect(vault).updateNAV(nav);
      await expect(tx3).to.emit(grain, "NAVUpdated");

      const tx4 = await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));
      await expect(tx4).to.emit(grain, "GrainMinted");

      // All events properly tracked for audit trail
    });
  });
});
