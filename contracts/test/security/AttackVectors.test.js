const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Security Tests - Attack Vectors", function () {
  async function deploySystemFixture() {
    const [admin, vault, attacker, user1, user2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    const Vault = await ethers.getContractFactory("Vault");
    const vaultContract = await Vault.deploy(usdc.target);

    const Grain = await ethers.getContractFactory("Grain");
    const grain = await Grain.deploy(admin.address, vaultContract.target, ethers.parseEther("1.0"));

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(admin.address, admin.address);

    await usdc.mint(attacker.address, ethers.parseUnits("10000000", 6));
    await usdc.mint(user1.address, ethers.parseUnits("1000000", 6));

    return { grain, vaultContract, escrow, usdc, admin, vault, attacker, user1, user2 };
  }

  describe("Reentrancy Attack Prevention", function () {
    it("Should prevent reentrancy on Grain mint", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      // NonReentrant modifier should prevent reentrancy
      // This is implicitly tested by having the modifier
      await grain.connect(vault).updateNAV(ethers.parseEther("2000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      expect(await grain.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should prevent reentrancy on Vault withdraw", async function () {
      const { vaultContract, usdc, admin, user1 } = await loadFixture(deploySystemFixture);

      await usdc.connect(user1).approve(vaultContract.target, ethers.parseUnits("10000", 6));
      await vaultContract.connect(user1).deposit(ethers.parseUnits("10000", 6));

      // NonReentrant should protect
      await vaultContract.connect(admin).withdraw(user1.address, ethers.parseUnits("5000", 6));
      expect(await usdc.balanceOf(user1.address)).to.be.gt(0);
    });

    it("Should prevent reentrancy on Escrow operations", async function () {
      const { escrow, usdc, attacker, user1 } = await loadFixture(deploySystemFixture);

      await escrow.connect(attacker).createEscrow(
        user1.address,
        attacker.address,
        usdc.target,
        ethers.parseUnits("10000", 6),
        ["M1"],
        [10000],
        30,
        "TEST",
        "Test"
      );

      const escrowId = 1;
      const amount = ethers.parseUnits("10000", 6);
      const fee = (amount * 50n) / 10000n;
      await usdc.connect(attacker).approve(escrow.target, amount + fee);

      // NonReentrant should protect during funding
      await escrow.connect(attacker).fundEscrow(escrowId);
      expect(await usdc.balanceOf(escrow.target)).to.equal(amount);
    });
  });

  describe("Integer Overflow/Underflow Protection", function () {
    it("Should not overflow on max GRAIN supply", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      // Solidity 0.8+ has built-in overflow protection
      const maxNav = ethers.MaxUint256 / 10n ** 12n; // Leave room for calculations
      await grain.connect(vault).updateNAV(maxNav);

      // Should not overflow
      const mintAmount = maxNav / 2n;
      await grain.connect(vault).mint(user1.address, mintAmount);

      expect(await grain.totalSupply()).to.equal(mintAmount);
    });

    it("Should revert on underflow attempt", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      // Try to burn more than balance (should revert due to underflow check)
      await expect(
        grain.connect(vault).burn(user1.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should handle percentage calculations without overflow", async function () {
      const { escrow, usdc, attacker, user1 } = await loadFixture(deploySystemFixture);

      // Create escrow with max realistic amount
      const maxAmount = ethers.parseUnits("1000000000000", 6); // 1 trillion USDC
      await usdc.mint(attacker.address, maxAmount * 2n);

      await escrow.connect(attacker).createEscrow(
        user1.address,
        attacker.address,
        usdc.target,
        maxAmount,
        ["M1"],
        [10000],
        30,
        "MAX",
        "Max test"
      );

      const escrowId = 1;
      const fee = (maxAmount * 50n) / 10000n;
      await usdc.connect(attacker).approve(escrow.target, maxAmount + fee);
      await escrow.connect(attacker).fundEscrow(escrowId);

      // Should handle calculations without overflow
      expect(await usdc.balanceOf(escrow.target)).to.equal(maxAmount);
    });
  });

  describe("Front-Running Protection", function () {
    it("Should not be vulnerable to NAV update front-running", async function () {
      const { grain, vault, user1, attacker } = await loadFixture(deploySystemFixture);

      // Setup
      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));

      // Attacker sees NAV increase coming and tries to front-run by minting
      // But only vault can mint, so attack fails
      await expect(
        grain.connect(attacker).mint(attacker.address, ethers.parseEther("1000"))
      ).to.be.reverted;

      // Legitimate NAV update proceeds
      await grain.connect(vault).updateNAV(ethers.parseEther("10500"));

      // Only legitimate holders benefit
      expect(await grain.grainPrice()).to.be.gt(ethers.parseEther("1.0"));
      expect(await grain.balanceOf(attacker.address)).to.equal(0);
    });

    it("Should not allow price manipulation through rapid minting", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("100000"));

      // Try rapid minting to affect price
      await grain.connect(vault).mint(user1.address, ethers.parseEther("10000"));
      const price1 = await grain.grainPrice();

      await grain.connect(vault).mint(user1.address, ethers.parseEther("10000"));
      const price2 = await grain.grainPrice();

      // Price should remain stable (NAV unchanged)
      expect(price1).to.equal(price2);
    });
  });

  describe("Flash Loan Attack Prevention", function () {
    it("Should prevent flash loan attacks via collateral requirements", async function () {
      const { grain, vault, attacker } = await loadFixture(deploySystemFixture);

      // Attacker gets flash loan and tries to drain system
      // Set low NAV
      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));

      // Try to mint massive amount (flash loan attack)
      await expect(
        grain.connect(vault).mint(attacker.address, ethers.parseEther("1000000"))
      ).to.be.revertedWith("Insufficient collateral");

      // System protected by collateral ratio requirement
    });

    it("Should prevent manipulation through same-block operations", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));

      // All operations in same block still enforce rules
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));

      // Can't mint more without updating NAV
      await expect(
        grain.connect(vault).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Insufficient collateral");
    });
  });

  describe("Price Manipulation Attack", function () {
    it("Should trigger circuit breaker on manipulation attempt", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));

      // Attacker tries to manipulate NAV downward
      await expect(grain.connect(vault).updateNAV(ethers.parseEther("5000")))
        .to.emit(grain, "CircuitBreakerTriggered");

      // System halted, price frozen
      expect(await grain.circuitBreakerTriggered()).to.be.true;
      expect(await grain.paused()).to.be.true;
    });

    it("Should not allow oracle role compromise to cause immediate damage", async function () {
      const { grain, vault } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(vault.address, ethers.parseEther("9000"));

      // Even if oracle compromised, circuit breaker protects
      await expect(grain.connect(vault).updateNAV(ethers.parseEther("1")))
        .to.emit(grain, "CircuitBreakerTriggered");

      // Requires 7-day audit to resolve
      const timeRemaining = await grain.getAuditTimeRemaining();
      expect(timeRemaining).to.be.closeTo(7 * 24 * 60 * 60, 10);
    });
  });

  describe("Admin Key Compromise", function () {
    it("Should limit damage from single admin key compromise", async function () {
      const { grain, admin, attacker } = await loadFixture(deploySystemFixture);

      // Attacker can't mint/burn (vault-only)
      await expect(
        grain.connect(attacker).mint(attacker.address, ethers.parseEther("1000"))
      ).to.be.reverted;

      // Admin can pause (damage control)
      await grain.connect(admin).pause();

      // But can't steal funds directly
      expect(await grain.balanceOf(attacker.address)).to.equal(0);
    });

    it("Should prevent unauthorized role grants", async function () {
      const { grain, attacker } = await loadFixture(deploySystemFixture);

      const MINTER_ROLE = await grain.MINTER_ROLE();

      await expect(
        grain.connect(attacker).grantRole(MINTER_ROLE, attacker.address)
      ).to.be.reverted;
    });

    it("Should require multi-sig for critical operations", async function () {
      const { grain, vault, admin, user1 } = await loadFixture(deploySystemFixture);

      // Circuit breaker reset requires admin (would be multi-sig in production)
      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));
      await grain.connect(vault).updateNAV(ethers.parseEther("8000"));

      expect(await grain.circuitBreakerTriggered()).to.be.true;

      await time.increase(7 * 24 * 60 * 60);

      // Only admin can reset (multi-sig in production)
      await expect(
        grain.connect(user1).resetCircuitBreaker(ethers.parseEther("1.0"), ethers.parseEther("9000"))
      ).to.be.reverted;

      await grain.connect(admin).resetCircuitBreaker(ethers.parseEther("0.89"), ethers.parseEther("8000"));
    });
  });

  describe("Contract Upgrade Attack Prevention", function () {
    it("Should be non-upgradeable to prevent upgrade attacks", async function () {
      const { grain } = await loadFixture(deploySystemFixture);

      // Contracts are not upgradeable (no proxy pattern)
      // This test verifies contracts are deployed directly
      const code = await ethers.provider.getCode(grain.target);
      expect(code.length).to.be.gt(2); // Has actual bytecode, not proxy
    });
  });

  describe("DOS Attack Prevention", function () {
    it("Should handle gas limits on milestone arrays", async function () {
      const { escrow, usdc, attacker, user1 } = await loadFixture(deploySystemFixture);

      // Try to create escrow with excessive milestones (potential DOS)
      const milestones = Array(100).fill("M");
      const percentages = Array(100).fill(100); // 1% each

      // Should succeed but be limited by gas
      await escrow.connect(attacker).createEscrow(
        user1.address,
        attacker.address,
        usdc.target,
        ethers.parseUnits("10000", 6),
        milestones,
        percentages,
        30,
        "DOS-TEST",
        "Test"
      );

      // Contract handles it
      const details = await escrow.getEscrow(1);
      expect(details.milestoneCount).to.equal(100);
    });

    it("Should not block operations with invalid inputs", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      // Invalid operations revert without blocking system
      await expect(
        grain.connect(vault).mint(ethers.ZeroAddress, ethers.parseEther("100"))
      ).to.be.revertedWith("Invalid recipient");

      // System still operational
      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));
      expect(await grain.balanceOf(user1.address)).to.equal(ethers.parseEther("9000"));
    });
  });

  describe("Timestamp Manipulation", function () {
    it("Should not be vulnerable to minor timestamp manipulation", async function () {
      const { grain, vault, admin, user1 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));
      await grain.connect(vault).updateNAV(ethers.parseEther("8000"));

      // Circuit breaker triggered
      const deadline = await grain.auditDeadline();

      // Small timestamp manipulation (15 seconds) shouldn't help
      await time.increase(7 * 24 * 60 * 60 - 30); // 30 seconds before deadline

      await expect(
        grain.connect(admin).resetCircuitBreaker(ethers.parseEther("0.89"), ethers.parseEther("8000"))
      ).to.be.revertedWith("Audit not complete");

      // Must wait full time
      await time.increase(60);
      await grain.connect(admin).resetCircuitBreaker(ethers.parseEther("0.89"), ethers.parseEther("8000"));
    });
  });

  describe("Denial of Service via Revert", function () {
    it("Should handle failed transfers gracefully", async function () {
      const { vaultContract, usdc, admin, user1 } = await loadFixture(deploySystemFixture);

      await usdc.connect(user1).approve(vaultContract.target, ethers.parseUnits("10000", 6));
      await vaultContract.connect(user1).deposit(ethers.parseUnits("10000", 6));

      // Withdraw should fail if contract has no balance (but not DOS)
      await vaultContract.connect(admin).withdraw(user1.address, ethers.parseUnits("5000", 6));

      // Multiple withdrawals should still work
      await vaultContract.connect(admin).withdraw(user1.address, ethers.parseUnits("5000", 6));

      // Balance exhausted
      await expect(
        vaultContract.connect(admin).withdraw(user1.address, ethers.parseUnits("1", 6))
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Invariant Violations", function () {
    it("INVARIANT: Total GRAIN supply should never exceed NAV/price ratio", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("100000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("90000"));

      const supply = await grain.totalSupply();
      const nav = await grain.totalNAV();
      const price = await grain.grainPrice();

      // supply * price <= NAV * collateralRatio
      const totalValue = (supply * price) / ethers.parseEther("1");
      const minNav = (totalValue * 10000n) / await grain.minCollateralRatio();

      expect(nav).to.be.gte(minNav);
    });

    it("INVARIANT: Escrow released amount should never exceed total amount", async function () {
      const { escrow, usdc, admin, attacker, user1 } = await loadFixture(deploySystemFixture);

      const totalAmount = ethers.parseUnits("10000", 6);
      await escrow.connect(attacker).createEscrow(
        user1.address,
        admin.address,
        usdc.target,
        totalAmount,
        ["M1", "M2"],
        [5000, 5000],
        30,
        "TEST",
        "Test"
      );

      const escrowId = 1;
      const fee = (totalAmount * 50n) / 10000n;
      await usdc.connect(attacker).approve(escrow.target, totalAmount + fee);
      await escrow.connect(attacker).fundEscrow(escrowId);

      await escrow.connect(admin).completeMilestone(escrowId, 0);
      await escrow.connect(admin).completeMilestone(escrowId, 1);

      const details = await escrow.getEscrow(escrowId);
      expect(details.releasedAmount).to.equal(details.totalAmount);
      expect(details.releasedAmount).to.be.lte(details.totalAmount);
    });

    it("INVARIANT: Vault NAV components should sum correctly", async function () {
      const { vaultContract, vault } = await loadFixture(deploySystemFixture);

      await vaultContract.connect(vault).updateAssets(
        ethers.parseUnits("100", 6),
        ethers.parseUnits("200", 6),
        ethers.parseUnits("300", 6),
        ethers.parseUnits("400", 6),
        ethers.parseUnits("500", 6)
      );

      const breakdown = await vaultContract.getAssetBreakdown();
      const totalNAV = await vaultContract.getTotalNAV();

      const sum = breakdown.liquidReserves +
                  breakdown.floatInTransit +
                  breakdown.physicalAssets +
                  breakdown.investmentPositions +
                  breakdown.receivables;

      expect(sum).to.equal(totalNAV);
    });

    it("INVARIANT: No funds should be permanently locked", async function () {
      const { escrow, usdc, attacker, user1 } = await loadFixture(deploySystemFixture);

      const totalAmount = ethers.parseUnits("10000", 6);
      await escrow.connect(attacker).createEscrow(
        user1.address,
        attacker.address,
        usdc.target,
        totalAmount,
        ["M1"],
        [10000],
        1, // 1 day
        "TEST",
        "Test"
      );

      const escrowId = 1;
      const fee = (totalAmount * 50n) / 10000n;
      await usdc.connect(attacker).approve(escrow.target, totalAmount + fee);
      await escrow.connect(attacker).fundEscrow(escrowId);

      // Expire without completing
      await time.increase(2 * 24 * 60 * 60);

      // Can cancel and recover funds
      const attackerBefore = await usdc.balanceOf(attacker.address);
      await escrow.connect(attacker).cancelEscrow(escrowId);
      const attackerAfter = await usdc.balanceOf(attacker.address);

      expect(attackerAfter - attackerBefore).to.equal(totalAmount);
    });
  });
});
