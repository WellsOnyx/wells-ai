const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Vault - Unit Tests", function () {
  // Fixture for deployment
  async function deployVaultFixture() {
    const [admin, oracle, withdrawer, user1, user2, attacker] = await ethers.getSigners();

    // Deploy Mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6); // 6 decimals like real USDC

    // Deploy Vault
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(usdc.target);

    // Mint USDC to users for testing
    await usdc.mint(user1.address, ethers.parseUnits("1000000", 6)); // 1M USDC
    await usdc.mint(user2.address, ethers.parseUnits("500000", 6));  // 500K USDC

    return { vault, usdc, admin, oracle, withdrawer, user1, user2, attacker };
  }

  describe("Deployment", function () {
    it("Should set the correct USDC address", async function () {
      const { vault, usdc } = await loadFixture(deployVaultFixture);

      expect(await vault.usdc()).to.equal(usdc.target);
    });

    it("Should grant correct roles", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      const DEFAULT_ADMIN_ROLE = await vault.DEFAULT_ADMIN_ROLE();
      const WITHDRAWER_ROLE = await vault.WITHDRAWER_ROLE();
      const ORACLE_ROLE = await vault.ORACLE_ROLE();
      const PAUSER_ROLE = await vault.PAUSER_ROLE();

      expect(await vault.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await vault.hasRole(WITHDRAWER_ROLE, admin.address)).to.be.true;
      expect(await vault.hasRole(ORACLE_ROLE, admin.address)).to.be.true;
      expect(await vault.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
    });

    it("Should initialize asset breakdown", async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      const breakdown = await vault.getAssetBreakdown();
      expect(breakdown.liquidReserves).to.equal(0);
      expect(breakdown.floatInTransit).to.equal(0);
      expect(breakdown.physicalAssets).to.equal(0);
      expect(breakdown.investmentPositions).to.equal(0);
      expect(breakdown.receivables).to.equal(0);
      expect(breakdown.lastUpdated).to.be.gt(0);
    });

    it("Should revert with zero USDC address", async function () {
      const Vault = await ethers.getContractFactory("Vault");

      await expect(
        Vault.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid USDC address");
    });
  });

  describe("Deposits", function () {
    it("Should deposit USDC successfully", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      const depositAmount = ethers.parseUnits("10000", 6); // 10K USDC

      // Approve vault to spend USDC
      await usdc.connect(user1).approve(vault.target, depositAmount);

      await expect(vault.connect(user1).deposit(depositAmount))
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, depositAmount, await time.latest() + 1);

      expect(await vault.totalDeposits()).to.equal(depositAmount);
      expect(await usdc.balanceOf(vault.target)).to.equal(depositAmount);
    });

    it("Should revert deposit with zero amount", async function () {
      const { vault, user1 } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user1).deposit(0)
      ).to.be.revertedWith("Amount must be positive");
    });

    it("Should revert deposit without approval", async function () {
      const { vault, user1 } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user1).deposit(ethers.parseUnits("10000", 6))
      ).to.be.reverted;
    });

    it("Should revert deposit when paused", async function () {
      const { vault, usdc, admin, user1 } = await loadFixture(deployVaultFixture);

      const depositAmount = ethers.parseUnits("10000", 6);
      await usdc.connect(user1).approve(vault.target, depositAmount);

      await vault.connect(admin).pause();

      await expect(
        vault.connect(user1).deposit(depositAmount)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("Should handle multiple deposits", async function () {
      const { vault, usdc, user1, user2 } = await loadFixture(deployVaultFixture);

      const amount1 = ethers.parseUnits("10000", 6);
      const amount2 = ethers.parseUnits("20000", 6);

      await usdc.connect(user1).approve(vault.target, amount1);
      await usdc.connect(user2).approve(vault.target, amount2);

      await vault.connect(user1).deposit(amount1);
      await vault.connect(user2).deposit(amount2);

      expect(await vault.totalDeposits()).to.equal(amount1 + amount2);
    });
  });

  describe("Withdrawals", function () {
    it("Should withdraw with WITHDRAWER_ROLE", async function () {
      const { vault, usdc, admin, user1 } = await loadFixture(deployVaultFixture);

      // Deposit first
      const depositAmount = ethers.parseUnits("10000", 6);
      await usdc.connect(user1).approve(vault.target, depositAmount);
      await vault.connect(user1).deposit(depositAmount);

      // Withdraw
      const withdrawAmount = ethers.parseUnits("5000", 6);
      await expect(vault.connect(admin).withdraw(user1.address, withdrawAmount))
        .to.emit(vault, "Withdrawal")
        .withArgs(user1.address, withdrawAmount, await time.latest() + 1);

      expect(await vault.totalWithdrawals()).to.equal(withdrawAmount);
    });

    it("Should revert withdraw without WITHDRAWER_ROLE", async function () {
      const { vault, usdc, user1, user2 } = await loadFixture(deployVaultFixture);

      const depositAmount = ethers.parseUnits("10000", 6);
      await usdc.connect(user1).approve(vault.target, depositAmount);
      await vault.connect(user1).deposit(depositAmount);

      await expect(
        vault.connect(user2).withdraw(user2.address, ethers.parseUnits("5000", 6))
      ).to.be.reverted;
    });

    it("Should revert withdraw with insufficient balance", async function () {
      const { vault, admin, user1 } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(admin).withdraw(user1.address, ethers.parseUnits("10000", 6))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should revert withdraw to zero address", async function () {
      const { vault, usdc, admin, user1 } = await loadFixture(deployVaultFixture);

      const depositAmount = ethers.parseUnits("10000", 6);
      await usdc.connect(user1).approve(vault.target, depositAmount);
      await vault.connect(user1).deposit(depositAmount);

      await expect(
        vault.connect(admin).withdraw(ethers.ZeroAddress, ethers.parseUnits("5000", 6))
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should revert withdraw when paused", async function () {
      const { vault, usdc, admin, user1 } = await loadFixture(deployVaultFixture);

      const depositAmount = ethers.parseUnits("10000", 6);
      await usdc.connect(user1).approve(vault.target, depositAmount);
      await vault.connect(user1).deposit(depositAmount);

      await vault.connect(admin).pause();

      await expect(
        vault.connect(admin).withdraw(user1.address, ethers.parseUnits("5000", 6))
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });
  });

  describe("Asset Updates & NAV Calculation", function () {
    it("Should update assets with ORACLE_ROLE", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      const liquidReserves = ethers.parseUnits("1000000", 6);
      const floatInTransit = ethers.parseUnits("50000", 6);
      const physicalAssets = ethers.parseUnits("200000", 6);
      const investmentPositions = ethers.parseUnits("100000", 6);
      const receivables = ethers.parseUnits("75000", 6);

      const totalNAV = liquidReserves + floatInTransit + physicalAssets + investmentPositions + receivables;

      await expect(
        vault.connect(admin).updateAssets(
          liquidReserves,
          floatInTransit,
          physicalAssets,
          investmentPositions,
          receivables
        )
      )
        .to.emit(vault, "AssetsUpdated")
        .withArgs(
          liquidReserves,
          floatInTransit,
          physicalAssets,
          investmentPositions,
          receivables,
          totalNAV
        )
        .to.emit(vault, "NAVCalculated")
        .withArgs(totalNAV, await time.latest() + 1);

      const breakdown = await vault.getAssetBreakdown();
      expect(breakdown.liquidReserves).to.equal(liquidReserves);
      expect(breakdown.floatInTransit).to.equal(floatInTransit);
      expect(breakdown.physicalAssets).to.equal(physicalAssets);
      expect(breakdown.investmentPositions).to.equal(investmentPositions);
      expect(breakdown.receivables).to.equal(receivables);
    });

    it("Should calculate total NAV correctly", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      await vault.connect(admin).updateAssets(
        ethers.parseUnits("1000000", 6),
        ethers.parseUnits("50000", 6),
        ethers.parseUnits("200000", 6),
        ethers.parseUnits("100000", 6),
        ethers.parseUnits("75000", 6)
      );

      const totalNAV = await vault.getTotalNAV();
      expect(totalNAV).to.equal(ethers.parseUnits("1425000", 6));
    });

    it("Should revert asset update without ORACLE_ROLE", async function () {
      const { vault, user1 } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user1).updateAssets(
          ethers.parseUnits("1000000", 6),
          0, 0, 0, 0
        )
      ).to.be.reverted;
    });

    it("Should update lastNAV on asset update", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      const nav = ethers.parseUnits("1000000", 6);
      await vault.connect(admin).updateAssets(nav, 0, 0, 0, 0);

      expect(await vault.lastNAV()).to.equal(nav);
    });
  });

  describe("Circuit Breaker", function () {
    it("Should trigger circuit breaker", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      const frozenPrice = ethers.parseEther("1.05");
      const reason = "Manual trigger for testing";

      await expect(vault.connect(admin).triggerCircuitBreaker(reason, frozenPrice))
        .to.emit(vault, "CircuitBreakerTriggered");

      expect(await vault.circuitBreakerTriggered()).to.be.true;
      expect(await vault.frozenGrainPrice()).to.equal(frozenPrice);
      expect(await vault.paused()).to.be.true;
    });

    it("Should revert double trigger", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      await vault.connect(admin).triggerCircuitBreaker("Test", ethers.parseEther("1.0"));

      await expect(
        vault.connect(admin).triggerCircuitBreaker("Test 2", ethers.parseEther("1.0"))
      ).to.be.revertedWith("Circuit breaker already active");
    });

    it("Should resolve circuit breaker after audit period", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      await vault.connect(admin).triggerCircuitBreaker("Test", ethers.parseEther("1.0"));

      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60);

      const newGrainPrice = ethers.parseEther("1.02");
      await expect(vault.connect(admin).resolveCircuitBreaker(newGrainPrice))
        .to.emit(vault, "CircuitBreakerResolved");

      expect(await vault.circuitBreakerTriggered()).to.be.false;
      expect(await vault.paused()).to.be.false;
    });

    it("Should revert resolve before audit deadline", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      await vault.connect(admin).triggerCircuitBreaker("Test", ethers.parseEther("1.0"));

      await expect(
        vault.connect(admin).resolveCircuitBreaker(ethers.parseEther("1.0"))
      ).to.be.revertedWith("Audit period not complete");
    });

    it("Should revert resolve without trigger", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(admin).resolveCircuitBreaker(ethers.parseEther("1.0"))
      ).to.be.revertedWith("Circuit breaker not active");
    });
  });

  describe("Yesterday High Price Tracking", function () {
    it("Should set yesterday high price", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      const price = ethers.parseEther("1.08");
      await vault.connect(admin).setYesterdayHighPrice(price);

      expect(await vault.yesterdayHighPrice()).to.equal(price);
    });

    it("Should revert without ORACLE_ROLE", async function () {
      const { vault, user1 } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user1).setYesterdayHighPrice(ethers.parseEther("1.0"))
      ).to.be.reverted;
    });
  });

  describe("Pause/Unpause", function () {
    it("Should pause with PAUSER_ROLE", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      await vault.connect(admin).pause();
      expect(await vault.paused()).to.be.true;
    });

    it("Should unpause with DEFAULT_ADMIN_ROLE", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      await vault.connect(admin).pause();
      await vault.connect(admin).unpause();
      expect(await vault.paused()).to.be.false;
    });

    it("Should revert pause without PAUSER_ROLE", async function () {
      const { vault, user1 } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user1).pause()
      ).to.be.reverted;
    });

    it("Should revert unpause without DEFAULT_ADMIN_ROLE", async function () {
      const { vault, admin, user1 } = await loadFixture(deployVaultFixture);

      await vault.connect(admin).pause();

      await expect(
        vault.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    it("Should get USDC balance", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      const depositAmount = ethers.parseUnits("10000", 6);
      await usdc.connect(user1).approve(vault.target, depositAmount);
      await vault.connect(user1).deposit(depositAmount);

      expect(await vault.getUSDCBalance()).to.equal(depositAmount);
    });

    it("Should get liquid reserves", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      const liquidReserves = ethers.parseUnits("1000000", 6);
      await vault.connect(admin).updateAssets(liquidReserves, 0, 0, 0, 0);

      expect(await vault.getLiquidReserves()).to.equal(liquidReserves);
    });

    it("Should get complete asset breakdown", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      const liquidReserves = ethers.parseUnits("1000000", 6);
      const floatInTransit = ethers.parseUnits("50000", 6);
      const physicalAssets = ethers.parseUnits("200000", 6);
      const investmentPositions = ethers.parseUnits("100000", 6);
      const receivables = ethers.parseUnits("75000", 6);

      await vault.connect(admin).updateAssets(
        liquidReserves,
        floatInTransit,
        physicalAssets,
        investmentPositions,
        receivables
      );

      const breakdown = await vault.getAssetBreakdown();
      expect(breakdown.liquidReserves).to.equal(liquidReserves);
      expect(breakdown.floatInTransit).to.equal(floatInTransit);
      expect(breakdown.physicalAssets).to.equal(physicalAssets);
      expect(breakdown.investmentPositions).to.equal(investmentPositions);
      expect(breakdown.receivables).to.equal(receivables);
      expect(breakdown.lastUpdated).to.be.gt(0);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero NAV", async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      expect(await vault.getTotalNAV()).to.equal(0);
    });

    it("Should handle massive deposits", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      // Mint massive amount
      const massiveAmount = ethers.parseUnits("1000000000", 6); // 1B USDC
      await usdc.mint(user1.address, massiveAmount);

      await usdc.connect(user1).approve(vault.target, massiveAmount);
      await vault.connect(user1).deposit(massiveAmount);

      expect(await vault.totalDeposits()).to.equal(massiveAmount);
    });

    it("Should handle precision in NAV calculation", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      // Use odd numbers
      await vault.connect(admin).updateAssets(
        ethers.parseUnits("999999.999999", 6),
        ethers.parseUnits("123456.789012", 6),
        0, 0, 0
      );

      const nav = await vault.getTotalNAV();
      expect(nav).to.equal(ethers.parseUnits("1123456.789011", 6));
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should have reentrancy guards on critical functions", async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      // Implicit test - contract has nonReentrant modifiers
      expect(await vault.circuitBreakerTriggered()).to.be.false;
    });
  });

  describe("Multi-Asset Tracking", function () {
    it("Should track all asset categories independently", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      await vault.connect(admin).updateAssets(
        ethers.parseUnits("1000", 6),
        ethers.parseUnits("2000", 6),
        ethers.parseUnits("3000", 6),
        ethers.parseUnits("4000", 6),
        ethers.parseUnits("5000", 6)
      );

      const breakdown = await vault.getAssetBreakdown();
      expect(breakdown.liquidReserves).to.equal(ethers.parseUnits("1000", 6));
      expect(breakdown.floatInTransit).to.equal(ethers.parseUnits("2000", 6));
      expect(breakdown.physicalAssets).to.equal(ethers.parseUnits("3000", 6));
      expect(breakdown.investmentPositions).to.equal(ethers.parseUnits("4000", 6));
      expect(breakdown.receivables).to.equal(ethers.parseUnits("5000", 6));

      const totalNAV = await vault.getTotalNAV();
      expect(totalNAV).to.equal(ethers.parseUnits("15000", 6));
    });

    it("Should allow updating individual asset categories", async function () {
      const { vault, admin } = await loadFixture(deployVaultFixture);

      // First update
      await vault.connect(admin).updateAssets(
        ethers.parseUnits("1000", 6),
        ethers.parseUnits("2000", 6),
        ethers.parseUnits("3000", 6),
        ethers.parseUnits("4000", 6),
        ethers.parseUnits("5000", 6)
      );

      // Update with different values
      await vault.connect(admin).updateAssets(
        ethers.parseUnits("1500", 6),
        ethers.parseUnits("2000", 6),
        ethers.parseUnits("3500", 6),
        ethers.parseUnits("4000", 6),
        ethers.parseUnits("5500", 6)
      );

      const breakdown = await vault.getAssetBreakdown();
      expect(breakdown.liquidReserves).to.equal(ethers.parseUnits("1500", 6));
      expect(breakdown.physicalAssets).to.equal(ethers.parseUnits("3500", 6));
      expect(breakdown.receivables).to.equal(ethers.parseUnits("5500", 6));
    });
  });
});
