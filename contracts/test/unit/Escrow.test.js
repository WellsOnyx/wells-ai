const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Escrow - Unit Tests", function () {
  // Fixture for deployment
  async function deployEscrowFixture() {
    const [admin, depositor, beneficiary, arbitrator, feeCollector, user1, attacker] = await ethers.getSigners();

    // Deploy Mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy Escrow
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(admin.address, feeCollector.address);

    // Mint USDC to depositor
    await usdc.mint(depositor.address, ethers.parseUnits("10000000", 6)); // 10M USDC

    return { escrow, usdc, admin, depositor, beneficiary, arbitrator, feeCollector, user1, attacker };
  }

  describe("Deployment", function () {
    it("Should set correct initial state", async function () {
      const { escrow, feeCollector } = await loadFixture(deployEscrowFixture);

      expect(await escrow.nextEscrowId()).to.equal(1);
      expect(await escrow.feeCollector()).to.equal(feeCollector.address);
      expect(await escrow.escrowFeePercent()).to.equal(50); // 0.5%
      expect(await escrow.WITHDRAWAL_DELAY()).to.equal(24 * 60 * 60); // 24 hours
    });

    it("Should grant correct roles", async function () {
      const { escrow, admin } = await loadFixture(deployEscrowFixture);

      const DEFAULT_ADMIN_ROLE = await escrow.DEFAULT_ADMIN_ROLE();
      const PAUSER_ROLE = await escrow.PAUSER_ROLE();
      const ORACLE_ROLE = await escrow.ORACLE_ROLE();
      const ARBITRATOR_ROLE = await escrow.ARBITRATOR_ROLE();

      expect(await escrow.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await escrow.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
      expect(await escrow.hasRole(ORACLE_ROLE, admin.address)).to.be.true;
      expect(await escrow.hasRole(ARBITRATOR_ROLE, admin.address)).to.be.true;
    });

    it("Should revert with invalid addresses", async function () {
      const Escrow = await ethers.getContractFactory("Escrow");
      const [admin, feeCollector] = await ethers.getSigners();

      await expect(
        Escrow.deploy(ethers.ZeroAddress, feeCollector.address)
      ).to.be.revertedWith("Invalid admin");

      await expect(
        Escrow.deploy(admin.address, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee collector");
    });
  });

  describe("Create Escrow", function () {
    it("Should create escrow successfully", async function () {
      const { escrow, usdc, depositor, beneficiary, arbitrator } = await loadFixture(deployEscrowFixture);

      const totalAmount = ethers.parseUnits("3000000000", 6); // $3B
      const milestones = ["Shipment", "Delivery", "Verification"];
      const percentages = [3000, 4000, 3000]; // 30%, 40%, 30%
      const expirationDays = 180;
      const dealId = "DR-3B-2025";
      const dealDescription = "Dominican Republic frozen funds release";

      const tx = await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        arbitrator.address,
        usdc.target,
        totalAmount,
        milestones,
        percentages,
        expirationDays,
        dealId,
        dealDescription
      );

      await expect(tx)
        .to.emit(escrow, "EscrowCreated")
        .withArgs(
          1, // escrowId
          depositor.address,
          beneficiary.address,
          usdc.target,
          totalAmount,
          dealId
        );

      expect(await escrow.nextEscrowId()).to.equal(2);

      const escrowDetails = await escrow.getEscrow(1);
      expect(escrowDetails.depositor).to.equal(depositor.address);
      expect(escrowDetails.beneficiary).to.equal(beneficiary.address);
      expect(escrowDetails.totalAmount).to.equal(totalAmount);
      expect(escrowDetails.status).to.equal(0); // Pending
      expect(escrowDetails.milestoneCount).to.equal(3);
    });

    it("Should revert with invalid beneficiary", async function () {
      const { escrow, usdc, depositor } = await loadFixture(deployEscrowFixture);

      await expect(
        escrow.connect(depositor).createEscrow(
          ethers.ZeroAddress,
          depositor.address,
          usdc.target,
          ethers.parseUnits("1000", 6),
          ["Test"],
          [10000],
          30,
          "TEST",
          "Test escrow"
        )
      ).to.be.revertedWith("Invalid beneficiary");
    });

    it("Should revert with invalid token", async function () {
      const { escrow, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      await expect(
        escrow.connect(depositor).createEscrow(
          beneficiary.address,
          depositor.address,
          ethers.ZeroAddress,
          ethers.parseUnits("1000", 6),
          ["Test"],
          [10000],
          30,
          "TEST",
          "Test escrow"
        )
      ).to.be.revertedWith("Invalid token");
    });

    it("Should revert with zero amount", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      await expect(
        escrow.connect(depositor).createEscrow(
          beneficiary.address,
          depositor.address,
          usdc.target,
          0,
          ["Test"],
          [10000],
          30,
          "TEST",
          "Test escrow"
        )
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should revert with mismatched milestones", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      await expect(
        escrow.connect(depositor).createEscrow(
          beneficiary.address,
          depositor.address,
          usdc.target,
          ethers.parseUnits("1000", 6),
          ["M1", "M2"],
          [5000], // Only one percentage
          30,
          "TEST",
          "Test escrow"
        )
      ).to.be.revertedWith("Milestone mismatch");
    });

    it("Should revert if milestones don't add to 100%", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      await expect(
        escrow.connect(depositor).createEscrow(
          beneficiary.address,
          depositor.address,
          usdc.target,
          ethers.parseUnits("1000", 6),
          ["M1", "M2"],
          [4000, 5000], // Total 9000 (90%)
          30,
          "TEST",
          "Test escrow"
        )
      ).to.be.revertedWith("Milestones must equal 100%");
    });

    it("Should use depositor as arbitrator if not provided", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        ethers.ZeroAddress, // No arbitrator
        usdc.target,
        ethers.parseUnits("1000", 6),
        ["Test"],
        [10000],
        30,
        "TEST",
        "Test escrow"
      );

      const details = await escrow.getEscrow(1);
      // Arbitrator should be depositor
      expect(details.depositor).to.equal(depositor.address);
    });
  });

  describe("Fund Escrow", function () {
    async function createAndSetupEscrow() {
      const fixture = await loadFixture(deployEscrowFixture);
      const { escrow, usdc, depositor, beneficiary } = fixture;

      const totalAmount = ethers.parseUnits("1000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        totalAmount,
        ["Milestone 1", "Milestone 2"],
        [6000, 4000],
        30,
        "TEST-001",
        "Test escrow"
      );

      return { ...fixture, totalAmount, escrowId: 1 };
    }

    it("Should fund escrow successfully", async function () {
      const { escrow, usdc, depositor, feeCollector, totalAmount, escrowId } = await createAndSetupEscrow();

      const escrowFee = (totalAmount * 50n) / 10000n; // 0.5%
      const totalRequired = totalAmount + escrowFee;

      await usdc.connect(depositor).approve(escrow.target, totalRequired);

      await expect(escrow.connect(depositor).fundEscrow(escrowId))
        .to.emit(escrow, "EscrowFunded")
        .withArgs(escrowId, totalAmount, escrowFee);

      // Check balances
      expect(await usdc.balanceOf(escrow.target)).to.equal(totalAmount);
      expect(await usdc.balanceOf(feeCollector.address)).to.equal(escrowFee);

      const details = await escrow.getEscrow(escrowId);
      expect(details.status).to.equal(1); // Active
    });

    it("Should revert if not depositor", async function () {
      const { escrow, user1, escrowId } = await createAndSetupEscrow();

      await expect(
        escrow.connect(user1).fundEscrow(escrowId)
      ).to.be.revertedWith("Not depositor");
    });

    it("Should revert if already funded", async function () {
      const { escrow, usdc, depositor, totalAmount, escrowId } = await createAndSetupEscrow();

      const escrowFee = (totalAmount * 50n) / 10000n;
      const totalRequired = totalAmount + escrowFee;

      await usdc.connect(depositor).approve(escrow.target, totalRequired * 2n);
      await escrow.connect(depositor).fundEscrow(escrowId);

      await expect(
        escrow.connect(depositor).fundEscrow(escrowId)
      ).to.be.revertedWith("Already funded");
    });

    it("Should revert if expired", async function () {
      const { escrow, usdc, depositor, totalAmount, escrowId } = await createAndSetupEscrow();

      // Fast forward past expiration
      await time.increase(31 * 24 * 60 * 60); // 31 days

      const escrowFee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + escrowFee);

      await expect(
        escrow.connect(depositor).fundEscrow(escrowId)
      ).to.be.revertedWith("Expired");
    });

    it("Should revert when paused", async function () {
      const { escrow, usdc, admin, depositor, totalAmount, escrowId } = await createAndSetupEscrow();

      await escrow.connect(admin).pause();

      const escrowFee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + escrowFee);

      await expect(
        escrow.connect(depositor).fundEscrow(escrowId)
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });
  });

  describe("Complete Milestone", function () {
    async function createFundedEscrow() {
      const fixture = await loadFixture(deployEscrowFixture);
      const { escrow, usdc, depositor, beneficiary } = fixture;

      const totalAmount = ethers.parseUnits("1000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        totalAmount,
        ["Milestone 1", "Milestone 2", "Milestone 3"],
        [3000, 4000, 3000], // 30%, 40%, 30%
        30,
        "TEST-001",
        "Test escrow"
      );

      const escrowId = 1;
      const escrowFee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + escrowFee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      return { ...fixture, totalAmount, escrowId };
    }

    it("Should complete milestone and release funds", async function () {
      const { escrow, usdc, admin, beneficiary, totalAmount, escrowId } = await createFundedEscrow();

      const initialBalance = await usdc.balanceOf(beneficiary.address);
      const expectedRelease = (totalAmount * 3000n) / 10000n; // 30%

      await expect(escrow.connect(admin).completeMilestone(escrowId, 0))
        .to.emit(escrow, "MilestoneCompleted")
        .withArgs(escrowId, 0, expectedRelease, beneficiary.address);

      expect(await usdc.balanceOf(beneficiary.address)).to.equal(initialBalance + expectedRelease);

      // Check milestone status
      const milestone = await escrow.getMilestone(escrowId, 0);
      expect(milestone.completed).to.be.true;
    });

    it("Should complete all milestones and mark escrow complete", async function () {
      const { escrow, admin, escrowId } = await createFundedEscrow();

      await escrow.connect(admin).completeMilestone(escrowId, 0);
      await escrow.connect(admin).completeMilestone(escrowId, 1);

      await expect(escrow.connect(admin).completeMilestone(escrowId, 2))
        .to.emit(escrow, "EscrowCompleted");

      const details = await escrow.getEscrow(escrowId);
      expect(details.status).to.equal(2); // Completed
    });

    it("Should revert without ORACLE_ROLE", async function () {
      const { escrow, user1, escrowId } = await createFundedEscrow();

      await expect(
        escrow.connect(user1).completeMilestone(escrowId, 0)
      ).to.be.reverted;
    });

    it("Should revert if not active", async function () {
      const { escrow, admin } = await loadFixture(deployEscrowFixture);

      // Escrow doesn't exist or not funded
      await expect(
        escrow.connect(admin).completeMilestone(1, 0)
      ).to.be.revertedWith("Not active");
    });

    it("Should revert if milestone already completed", async function () {
      const { escrow, admin, escrowId } = await createFundedEscrow();

      await escrow.connect(admin).completeMilestone(escrowId, 0);

      await expect(
        escrow.connect(admin).completeMilestone(escrowId, 0)
      ).to.be.revertedWith("Already completed");
    });

    it("Should revert with invalid milestone index", async function () {
      const { escrow, admin, escrowId } = await createFundedEscrow();

      await expect(
        escrow.connect(admin).completeMilestone(escrowId, 10)
      ).to.be.revertedWith("Invalid milestone");
    });

    it("Should calculate release amounts correctly", async function () {
      const { escrow, usdc, admin, beneficiary, totalAmount, escrowId } = await createFundedEscrow();

      const initialBalance = await usdc.balanceOf(beneficiary.address);

      // Complete milestone 1 (30%)
      await escrow.connect(admin).completeMilestone(escrowId, 0);
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(
        initialBalance + (totalAmount * 3000n) / 10000n
      );

      // Complete milestone 2 (40%)
      await escrow.connect(admin).completeMilestone(escrowId, 1);
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(
        initialBalance + (totalAmount * 7000n) / 10000n
      );

      // Complete milestone 3 (30%)
      await escrow.connect(admin).completeMilestone(escrowId, 2);
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(
        initialBalance + totalAmount
      );
    });
  });

  describe("Disputes", function () {
    async function createFundedEscrow() {
      const fixture = await loadFixture(deployEscrowFixture);
      const { escrow, usdc, depositor, beneficiary } = fixture;

      const totalAmount = ethers.parseUnits("1000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        totalAmount,
        ["Milestone 1"],
        [10000],
        30,
        "TEST-001",
        "Test escrow"
      );

      const escrowId = 1;
      const escrowFee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + escrowFee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      return { ...fixture, totalAmount, escrowId };
    }

    it("Should raise dispute by depositor", async function () {
      const { escrow, depositor, escrowId } = await createFundedEscrow();

      const reason = "Goods not received";

      await expect(escrow.connect(depositor).raiseDispute(escrowId, reason))
        .to.emit(escrow, "EscrowDisputed")
        .withArgs(escrowId, depositor.address, reason);

      const details = await escrow.getEscrow(escrowId);
      expect(details.status).to.equal(3); // Disputed
    });

    it("Should raise dispute by beneficiary", async function () {
      const { escrow, beneficiary, escrowId } = await createFundedEscrow();

      await expect(escrow.connect(beneficiary).raiseDispute(escrowId, "Payment issue"))
        .to.emit(escrow, "EscrowDisputed");
    });

    it("Should revert dispute from unauthorized party", async function () {
      const { escrow, user1, escrowId } = await createFundedEscrow();

      await expect(
        escrow.connect(user1).raiseDispute(escrowId, "Test")
      ).to.be.revertedWith("Not authorized");
    });

    it("Should resolve dispute with arbitrator", async function () {
      const { escrow, usdc, admin, depositor, beneficiary, totalAmount, escrowId } = await createFundedEscrow();

      await escrow.connect(depositor).raiseDispute(escrowId, "Test dispute");

      const depositorInitial = await usdc.balanceOf(depositor.address);
      const beneficiaryInitial = await usdc.balanceOf(beneficiary.address);

      // Resolve: 60% to depositor, 40% to beneficiary
      await expect(escrow.connect(admin).resolveDispute(escrowId, 6000, 4000))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(escrowId, (totalAmount * 6000n) / 10000n, (totalAmount * 4000n) / 10000n);

      expect(await usdc.balanceOf(depositor.address)).to.equal(
        depositorInitial + (totalAmount * 6000n) / 10000n
      );
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(
        beneficiaryInitial + (totalAmount * 4000n) / 10000n
      );

      const details = await escrow.getEscrow(escrowId);
      expect(details.status).to.equal(2); // Completed
    });

    it("Should revert resolve without ARBITRATOR_ROLE", async function () {
      const { escrow, depositor, user1, escrowId } = await createFundedEscrow();

      await escrow.connect(depositor).raiseDispute(escrowId, "Test");

      await expect(
        escrow.connect(user1).resolveDispute(escrowId, 5000, 5000)
      ).to.be.reverted;
    });

    it("Should revert resolve if percentages don't equal 100%", async function () {
      const { escrow, admin, depositor, escrowId } = await createFundedEscrow();

      await escrow.connect(depositor).raiseDispute(escrowId, "Test");

      await expect(
        escrow.connect(admin).resolveDispute(escrowId, 6000, 3000)
      ).to.be.revertedWith("Must equal 100%");
    });

    it("Should handle partial milestone completion before dispute", async function () {
      const fixture = await loadFixture(deployEscrowFixture);
      const { escrow, usdc, admin, depositor, beneficiary } = fixture;

      const totalAmount = ethers.parseUnits("1000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        totalAmount,
        ["M1", "M2"],
        [5000, 5000],
        30,
        "TEST",
        "Test"
      );

      const escrowId = 1;
      const escrowFee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + escrowFee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      // Complete first milestone (50%)
      await escrow.connect(admin).completeMilestone(escrowId, 0);

      // Raise dispute
      await escrow.connect(depositor).raiseDispute(escrowId, "Issue with M2");

      const depositorInitial = await usdc.balanceOf(depositor.address);

      // Resolve - should only split remaining 50%
      await escrow.connect(admin).resolveDispute(escrowId, 10000, 0); // 100% to depositor

      expect(await usdc.balanceOf(depositor.address)).to.equal(
        depositorInitial + (totalAmount * 5000n) / 10000n
      );
    });
  });

  describe("Cancel Escrow", function () {
    it("Should cancel pending escrow", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      const totalAmount = ethers.parseUnits("1000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        totalAmount,
        ["M1"],
        [10000],
        30,
        "TEST",
        "Test"
      );

      const escrowId = 1;

      await expect(escrow.connect(depositor).cancelEscrow(escrowId))
        .to.emit(escrow, "EscrowCancelled")
        .withArgs(escrowId, 0); // No refund because not funded

      const details = await escrow.getEscrow(escrowId);
      expect(details.status).to.equal(4); // Cancelled
    });

    it("Should cancel and refund expired active escrow", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      const totalAmount = ethers.parseUnits("1000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        totalAmount,
        ["M1"],
        [10000],
        30,
        "TEST",
        "Test"
      );

      const escrowId = 1;
      const escrowFee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + escrowFee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      // Fast forward past expiration
      await time.increase(31 * 24 * 60 * 60);

      const depositorInitial = await usdc.balanceOf(depositor.address);

      await expect(escrow.connect(depositor).cancelEscrow(escrowId))
        .to.emit(escrow, "EscrowCancelled")
        .withArgs(escrowId, totalAmount);

      expect(await usdc.balanceOf(depositor.address)).to.equal(depositorInitial + totalAmount);
    });

    it("Should revert cancel if not depositor", async function () {
      const { escrow, usdc, depositor, beneficiary, user1 } = await loadFixture(deployEscrowFixture);

      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        ethers.parseUnits("1000", 6),
        ["M1"],
        [10000],
        30,
        "TEST",
        "Test"
      );

      await expect(
        escrow.connect(user1).cancelEscrow(1)
      ).to.be.revertedWith("Not depositor");
    });

    it("Should revert cancel active non-expired escrow", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      const totalAmount = ethers.parseUnits("1000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        totalAmount,
        ["M1"],
        [10000],
        30,
        "TEST",
        "Test"
      );

      const escrowId = 1;
      const escrowFee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + escrowFee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      await expect(
        escrow.connect(depositor).cancelEscrow(escrowId)
      ).to.be.revertedWith("Cannot cancel");
    });
  });

  describe("View Functions", function () {
    it("Should get escrow details", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      const totalAmount = ethers.parseUnits("1000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        totalAmount,
        ["M1", "M2"],
        [5000, 5000],
        30,
        "TEST",
        "Test"
      );

      const details = await escrow.getEscrow(1);
      expect(details.depositor).to.equal(depositor.address);
      expect(details.beneficiary).to.equal(beneficiary.address);
      expect(details.token).to.equal(usdc.target);
      expect(details.totalAmount).to.equal(totalAmount);
      expect(details.releasedAmount).to.equal(0);
      expect(details.status).to.equal(0); // Pending
      expect(details.milestoneCount).to.equal(2);
    });

    it("Should get milestone details", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        ethers.parseUnits("1000", 6),
        ["Milestone 1", "Milestone 2"],
        [6000, 4000],
        30,
        "TEST",
        "Test"
      );

      const milestone = await escrow.getMilestone(1, 0);
      expect(milestone.description).to.equal("Milestone 1");
      expect(milestone.percentage).to.equal(6000);
      expect(milestone.completed).to.be.false;
      expect(milestone.completedAt).to.equal(0);
    });

    it("Should get all milestones", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        ethers.parseUnits("1000", 6),
        ["M1", "M2", "M3"],
        [3000, 3000, 4000],
        30,
        "TEST",
        "Test"
      );

      const milestones = await escrow.getMilestones(1);
      expect(milestones.length).to.equal(3);
      expect(milestones[0].description).to.equal("M1");
      expect(milestones[1].description).to.equal("M2");
      expect(milestones[2].description).to.equal("M3");
    });
  });

  describe("Admin Functions", function () {
    it("Should update escrow fee percentage", async function () {
      const { escrow, admin } = await loadFixture(deployEscrowFixture);

      await escrow.connect(admin).setEscrowFeePercent(100); // 1%
      expect(await escrow.escrowFeePercent()).to.equal(100);
    });

    it("Should revert fee update >5%", async function () {
      const { escrow, admin } = await loadFixture(deployEscrowFixture);

      await expect(
        escrow.connect(admin).setEscrowFeePercent(501)
      ).to.be.revertedWith("Max 5%");
    });

    it("Should update fee collector", async function () {
      const { escrow, admin, user1 } = await loadFixture(deployEscrowFixture);

      await escrow.connect(admin).setFeeCollector(user1.address);
      expect(await escrow.feeCollector()).to.equal(user1.address);
    });

    it("Should revert fee collector update with zero address", async function () {
      const { escrow, admin } = await loadFixture(deployEscrowFixture);

      await expect(
        escrow.connect(admin).setFeeCollector(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });

  describe("Pause/Unpause", function () {
    it("Should pause with PAUSER_ROLE", async function () {
      const { escrow, admin } = await loadFixture(deployEscrowFixture);

      await escrow.connect(admin).pause();
      expect(await escrow.paused()).to.be.true;
    });

    it("Should unpause with PAUSER_ROLE", async function () {
      const { escrow, admin } = await loadFixture(deployEscrowFixture);

      await escrow.connect(admin).pause();
      await escrow.connect(admin).unpause();
      expect(await escrow.paused()).to.be.false;
    });

    it("Should block operations when paused", async function () {
      const { escrow, usdc, admin, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      await escrow.connect(admin).pause();

      await expect(
        escrow.connect(depositor).createEscrow(
          beneficiary.address,
          depositor.address,
          usdc.target,
          ethers.parseUnits("1000", 6),
          ["M1"],
          [10000],
          30,
          "TEST",
          "Test"
        )
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });
  });

  describe("Edge Cases & Large Amounts", function () {
    it("Should handle $3B escrow", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      const amount3B = ethers.parseUnits("3000000000", 6); // $3B
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        amount3B,
        ["M1"],
        [10000],
        180,
        "DR-3B",
        "Dominican Republic Deal"
      );

      const details = await escrow.getEscrow(1);
      expect(details.totalAmount).to.equal(amount3B);
    });

    it("Should handle many milestones", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deployEscrowFixture);

      const milestones = Array(10).fill("Milestone");
      const percentages = Array(10).fill(1000); // 10% each

      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        ethers.parseUnits("1000", 6),
        milestones,
        percentages,
        30,
        "TEST",
        "Test"
      );

      const details = await escrow.getEscrow(1);
      expect(details.milestoneCount).to.equal(10);
    });

    it("Should handle precision in percentage calculations", async function () {
      const { escrow, usdc, depositor, beneficiary, admin } = await loadFixture(deployEscrowFixture);

      // Odd percentages that must add to 10000
      const totalAmount = ethers.parseUnits("1000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        totalAmount,
        ["M1", "M2", "M3"],
        [3333, 3333, 3334], // 33.33%, 33.33%, 33.34%
        30,
        "TEST",
        "Test"
      );

      const escrowId = 1;
      const escrowFee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + escrowFee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      const beneficiaryInitial = await usdc.balanceOf(beneficiary.address);

      await escrow.connect(admin).completeMilestone(escrowId, 0);
      await escrow.connect(admin).completeMilestone(escrowId, 1);
      await escrow.connect(admin).completeMilestone(escrowId, 2);

      // Should receive full amount (within rounding)
      expect(await usdc.balanceOf(beneficiary.address)).to.equal(beneficiaryInitial + totalAmount);
    });
  });
});
