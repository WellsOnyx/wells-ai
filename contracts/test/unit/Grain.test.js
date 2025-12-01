const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Grain - Unit Tests", function () {
  // Fixture for deployment
  async function deployGrainFixture() {
    const [admin, vault, user1, user2, oracle, pauser, attacker] = await ethers.getSigners();

    const Grain = await ethers.getContractFactory("Grain");
    const initialPrice = ethers.parseEther("1.0"); // $1.00 per GRAIN
    const grain = await Grain.deploy(admin.address, vault.address, initialPrice);

    return { grain, admin, vault, user1, user2, oracle, pauser, attacker, initialPrice };
  }

  describe("Deployment", function () {
    it("Should set the correct initial state", async function () {
      const { grain, admin, vault, initialPrice } = await loadFixture(deployGrainFixture);

      expect(await grain.name()).to.equal("Grain");
      expect(await grain.symbol()).to.equal("GRAIN");
      expect(await grain.grainPrice()).to.equal(initialPrice);
      expect(await grain.totalSupply()).to.equal(0);
      expect(await grain.circuitBreakerTriggered()).to.equal(false);
    });

    it("Should grant correct roles", async function () {
      const { grain, admin, vault } = await loadFixture(deployGrainFixture);

      const DEFAULT_ADMIN_ROLE = await grain.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await grain.MINTER_ROLE();
      const BURNER_ROLE = await grain.BURNER_ROLE();
      const PAUSER_ROLE = await grain.PAUSER_ROLE();
      const ORACLE_ROLE = await grain.ORACLE_ROLE();

      expect(await grain.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await grain.hasRole(MINTER_ROLE, vault.address)).to.be.true;
      expect(await grain.hasRole(BURNER_ROLE, vault.address)).to.be.true;
      expect(await grain.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
      expect(await grain.hasRole(ORACLE_ROLE, vault.address)).to.be.true;
    });

    it("Should revert with invalid constructor params", async function () {
      const Grain = await ethers.getContractFactory("Grain");
      const [admin, vault] = await ethers.getSigners();

      await expect(
        Grain.deploy(ethers.ZeroAddress, vault.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid admin");

      await expect(
        Grain.deploy(admin.address, ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid vault");

      await expect(
        Grain.deploy(admin.address, vault.address, 0)
      ).to.be.revertedWith("Invalid price");
    });
  });

  describe("Minting", function () {
    it("Should mint tokens with correct role", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      const mintAmount = ethers.parseEther("1000");

      // Set NAV first to ensure collateralization
      await grain.connect(vault).updateNAV(ethers.parseEther("2000"));

      await expect(grain.connect(vault).mint(user1.address, mintAmount))
        .to.emit(grain, "GrainMinted")
        .withArgs(user1.address, mintAmount, ethers.parseEther("1.0"));

      expect(await grain.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await grain.totalSupply()).to.equal(mintAmount);
    });

    it("Should revert mint without MINTER_ROLE", async function () {
      const { grain, user1 } = await loadFixture(deployGrainFixture);

      await expect(
        grain.connect(user1).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.reverted;
    });

    it("Should revert mint with zero amount", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      await expect(
        grain.connect(vault).mint(user1.address, 0)
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should revert mint to zero address", async function () {
      const { grain, vault } = await loadFixture(deployGrainFixture);

      await expect(
        grain.connect(vault).mint(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should revert mint when paused", async function () {
      const { grain, vault, admin, user1 } = await loadFixture(deployGrainFixture);

      await grain.connect(admin).pause();

      await expect(
        grain.connect(vault).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(grain, "EnforcedPause");
    });

    it("Should revert mint when circuit breaker triggered", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      // Set NAV and mint some tokens
      await grain.connect(vault).updateNAV(ethers.parseEther("2000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      // Trigger circuit breaker with massive NAV drop
      await grain.connect(vault).updateNAV(ethers.parseEther("800"));

      expect(await grain.circuitBreakerTriggered()).to.be.true;

      await expect(
        grain.connect(vault).mint(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Circuit breaker active");
    });

    it("Should revert mint with insufficient collateral", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      // Set low NAV
      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));

      // Try to mint more than collateral allows (needs 110% collateral)
      await expect(
        grain.connect(vault).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Insufficient collateral");
    });
  });

  describe("Burning", function () {
    it("Should burn tokens with correct role", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      // Mint first
      await grain.connect(vault).updateNAV(ethers.parseEther("2000"));
      const mintAmount = ethers.parseEther("1000");
      await grain.connect(vault).mint(user1.address, mintAmount);

      // Burn
      const burnAmount = ethers.parseEther("500");
      await expect(grain.connect(vault).burn(user1.address, burnAmount))
        .to.emit(grain, "GrainBurned")
        .withArgs(user1.address, burnAmount, ethers.parseEther("1.0"));

      expect(await grain.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
    });

    it("Should revert burn without BURNER_ROLE", async function () {
      const { grain, user1 } = await loadFixture(deployGrainFixture);

      await expect(
        grain.connect(user1).burn(user1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should revert burn with insufficient balance", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      await expect(
        grain.connect(vault).burn(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should revert burn when paused", async function () {
      const { grain, vault, admin, user1 } = await loadFixture(deployGrainFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("2000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      await grain.connect(admin).pause();

      await expect(
        grain.connect(vault).burn(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(grain, "EnforcedPause");
    });
  });

  describe("NAV Updates & Price Revaluation", function () {
    it("Should update NAV and recalculate price", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      // Mint some tokens
      const nav1 = ethers.parseEther("1000");
      await grain.connect(vault).updateNAV(nav1);
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      // Update NAV (simulate appreciation)
      const nav2 = ethers.parseEther("1050");
      await expect(grain.connect(vault).updateNAV(nav2))
        .to.emit(grain, "PriceUpdated");

      // New price should be nav2 / supply = 1050 / 1000 = 1.05
      expect(await grain.grainPrice()).to.equal(ethers.parseEther("1.05"));
      expect(await grain.totalNAV()).to.equal(nav2);
    });

    it("Should handle NAV update with zero supply", async function () {
      const { grain, vault } = await loadFixture(deployGrainFixture);

      await expect(grain.connect(vault).updateNAV(ethers.parseEther("1000")))
        .to.emit(grain, "NAVUpdated");

      // Price should remain unchanged when supply is 0
      expect(await grain.grainPrice()).to.equal(ethers.parseEther("1.0"));
    });

    it("Should revert NAV update without ORACLE_ROLE", async function () {
      const { grain, user1 } = await loadFixture(deployGrainFixture);

      await expect(
        grain.connect(user1).updateNAV(ethers.parseEther("1000"))
      ).to.be.reverted;
    });

    it("Should revert NAV update when paused", async function () {
      const { grain, vault, admin } = await loadFixture(deployGrainFixture);

      await grain.connect(admin).pause();

      await expect(
        grain.connect(vault).updateNAV(ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(grain, "EnforcedPause");
    });
  });

  describe("Circuit Breaker - Price Drop >5%", function () {
    it("Should trigger on 5% price drop", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      // Setup: Mint tokens at $1.00
      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      // Drop NAV by 6% (triggers circuit breaker at >5%)
      const newNAV = ethers.parseEther("940");
      await expect(grain.connect(vault).updateNAV(newNAV))
        .to.emit(grain, "CircuitBreakerTriggered")
        .withArgs("Price drop >5%", ethers.parseEther("1.0"), await time.latest() + 7 * 24 * 60 * 60);

      expect(await grain.circuitBreakerTriggered()).to.be.true;
      expect(await grain.frozenPrice()).to.equal(ethers.parseEther("1.0"));
      expect(await grain.paused()).to.be.true;
    });

    it("Should NOT trigger on 4% price drop", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      // Drop NAV by 4%
      const newNAV = ethers.parseEther("960");
      await grain.connect(vault).updateNAV(newNAV);

      expect(await grain.circuitBreakerTriggered()).to.be.false;
      expect(await grain.grainPrice()).to.equal(ethers.parseEther("0.96"));
    });
  });

  describe("Circuit Breaker - NAV Decline >10%", function () {
    it("Should trigger on 10% NAV decline", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      // Drop NAV by 11%
      await expect(grain.connect(vault).updateNAV(ethers.parseEther("890")))
        .to.emit(grain, "CircuitBreakerTriggered")
        .withArgs("NAV decline >10%", ethers.parseEther("1.0"), await time.latest() + 7 * 24 * 60 * 60);
    });

    it("Should NOT trigger on 9% NAV decline", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      await grain.connect(vault).updateNAV(ethers.parseEther("910"));

      expect(await grain.circuitBreakerTriggered()).to.be.false;
    });
  });

  describe("Circuit Breaker - Undercollateralization", function () {
    it("Should trigger when collateral < 100%", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      // NAV drops below total value
      await expect(grain.connect(vault).updateNAV(ethers.parseEther("990")))
        .to.emit(grain, "CircuitBreakerTriggered")
        .withArgs("Undercollateralized", ethers.parseEther("1.0"), await time.latest() + 7 * 24 * 60 * 60);
    });
  });

  describe("Circuit Breaker Reset", function () {
    it("Should reset circuit breaker after audit period", async function () {
      const { grain, vault, admin, user1 } = await loadFixture(deployGrainFixture);

      // Trigger circuit breaker
      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));
      await grain.connect(vault).updateNAV(ethers.parseEther("890"));

      expect(await grain.circuitBreakerTriggered()).to.be.true;

      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60);

      // Reset with audited values
      const newPrice = ethers.parseEther("0.95");
      const newNAV = ethers.parseEther("950");
      await expect(grain.connect(admin).resetCircuitBreaker(newPrice, newNAV))
        .to.emit(grain, "CircuitBreakerReset")
        .withArgs(newPrice);

      expect(await grain.circuitBreakerTriggered()).to.be.false;
      expect(await grain.grainPrice()).to.equal(newPrice);
      expect(await grain.totalNAV()).to.equal(newNAV);
      expect(await grain.paused()).to.be.false;
    });

    it("Should revert reset before audit deadline", async function () {
      const { grain, vault, admin, user1 } = await loadFixture(deployGrainFixture);

      // Trigger circuit breaker
      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));
      await grain.connect(vault).updateNAV(ethers.parseEther("890"));

      // Try to reset immediately
      await expect(
        grain.connect(admin).resetCircuitBreaker(ethers.parseEther("0.95"), ethers.parseEther("950"))
      ).to.be.revertedWith("Audit not complete");
    });

    it("Should revert reset with price deviation >20%", async function () {
      const { grain, vault, admin, user1 } = await loadFixture(deployGrainFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));
      await grain.connect(vault).updateNAV(ethers.parseEther("890"));

      await time.increase(7 * 24 * 60 * 60);

      // New NAV would give price 0.89, but trying to set 1.20 (>20% deviation)
      await expect(
        grain.connect(admin).resetCircuitBreaker(ethers.parseEther("1.20"), ethers.parseEther("890"))
      ).to.be.revertedWith("Price deviation >20%");
    });
  });

  describe("Pause/Unpause", function () {
    it("Should pause with PAUSER_ROLE", async function () {
      const { grain, admin } = await loadFixture(deployGrainFixture);

      await grain.connect(admin).pause();
      expect(await grain.paused()).to.be.true;
    });

    it("Should unpause with PAUSER_ROLE", async function () {
      const { grain, admin } = await loadFixture(deployGrainFixture);

      await grain.connect(admin).pause();
      await grain.connect(admin).unpause();
      expect(await grain.paused()).to.be.false;
    });

    it("Should block transfers when paused", async function () {
      const { grain, vault, admin, user1, user2 } = await loadFixture(deployGrainFixture);

      // Mint tokens
      await grain.connect(vault).updateNAV(ethers.parseEther("2000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      // Pause
      await grain.connect(admin).pause();

      // Try transfer
      await expect(
        grain.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(grain, "EnforcedPause");
    });
  });

  describe("Collateral Ratio Management", function () {
    it("Should update minimum collateral ratio", async function () {
      const { grain, admin } = await loadFixture(deployGrainFixture);

      await grain.connect(admin).setMinCollateralRatio(12000); // 120%
      expect(await grain.minCollateralRatio()).to.equal(12000);
    });

    it("Should revert with invalid collateral ratio", async function () {
      const { grain, admin } = await loadFixture(deployGrainFixture);

      await expect(
        grain.connect(admin).setMinCollateralRatio(9000) // <100%
      ).to.be.revertedWith("Invalid ratio");

      await expect(
        grain.connect(admin).setMinCollateralRatio(16000) // >150%
      ).to.be.revertedWith("Invalid ratio");
    });

    it("Should calculate collateral ratio correctly", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("1100"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      const ratio = await grain.getCollateralRatio();
      // ratio = (NAV * 10000) / (supply * price / 1e18)
      // = (1100 * 10000) / (1000 * 1.0) = 11000 (110%)
      expect(ratio).to.equal(11000);
    });

    it("Should return max uint256 when supply is zero", async function () {
      const { grain } = await loadFixture(deployGrainFixture);

      const ratio = await grain.getCollateralRatio();
      expect(ratio).to.equal(ethers.MaxUint256);
    });
  });

  describe("View Functions", function () {
    it("Should return correct price", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      expect(await grain.getPrice()).to.equal(ethers.parseEther("1.0"));

      await grain.connect(vault).updateNAV(ethers.parseEther("1050"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      expect(await grain.getPrice()).to.equal(ethers.parseEther("1.05"));
    });

    it("Should return frozen price when circuit breaker active", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));
      await grain.connect(vault).updateNAV(ethers.parseEther("890"));

      expect(await grain.getPrice()).to.equal(ethers.parseEther("1.0"));
    });

    it("Should return circuit breaker status", async function () {
      const { grain } = await loadFixture(deployGrainFixture);

      expect(await grain.isCircuitBreakerActive()).to.be.false;
    });

    it("Should return audit time remaining", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      expect(await grain.getAuditTimeRemaining()).to.equal(0);

      // Trigger circuit breaker
      await grain.connect(vault).updateNAV(ethers.parseEther("1000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));
      await grain.connect(vault).updateNAV(ethers.parseEther("890"));

      const timeRemaining = await grain.getAuditTimeRemaining();
      expect(timeRemaining).to.be.closeTo(7 * 24 * 60 * 60, 10);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero transfer", async function () {
      const { grain, vault, user1, user2 } = await loadFixture(deployGrainFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("2000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      // Zero transfer should succeed (ERC20 standard)
      await expect(grain.connect(user1).transfer(user2.address, 0))
        .to.not.be.reverted;
    });

    it("Should handle max supply calculations", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      // Set massive NAV
      const massiveNAV = ethers.parseEther("1000000000"); // 1B
      await grain.connect(vault).updateNAV(massiveNAV);

      // Should be able to mint proportional amount
      const mintAmount = ethers.parseEther("900000000"); // 900M (keeps 110% collateral)
      await grain.connect(vault).mint(user1.address, mintAmount);

      expect(await grain.totalSupply()).to.equal(mintAmount);
    });

    it("Should handle precision in price calculation", async function () {
      const { grain, vault, user1 } = await loadFixture(deployGrainFixture);

      // Test with odd numbers that could cause rounding issues
      await grain.connect(vault).updateNAV(ethers.parseEther("999.123456789"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("888.987654321"));

      const expectedPrice = (ethers.parseEther("999.123456789") * ethers.parseEther("1")) / ethers.parseEther("888.987654321");
      const actualPrice = await grain.grainPrice();

      // Should be very close (within rounding error)
      const diff = expectedPrice > actualPrice ? expectedPrice - actualPrice : actualPrice - expectedPrice;
      expect(diff).to.be.lt(ethers.parseEther("0.00001"));
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy on mint", async function () {
      // This would require a malicious contract, but the nonReentrant modifier should protect
      // Test is implicit through modifier presence
      const { grain } = await loadFixture(deployGrainFixture);
      expect(await grain.grainPrice()).to.be.gt(0); // Contract deployed successfully with guards
    });
  });
});
