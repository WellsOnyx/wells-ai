const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Gas Optimization Tests", function () {
  async function deploySystemFixture() {
    const [admin, vault, user1, user2, depositor, beneficiary] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    const Vault = await ethers.getContractFactory("Vault");
    const vaultContract = await Vault.deploy(usdc.target);

    const Grain = await ethers.getContractFactory("Grain");
    const grain = await Grain.deploy(admin.address, vaultContract.target, ethers.parseEther("1.0"));

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(admin.address, admin.address);

    await usdc.mint(user1.address, ethers.parseUnits("10000000", 6));
    await usdc.mint(depositor.address, ethers.parseUnits("10000000", 6));

    return { grain, vaultContract, escrow, usdc, admin, vault, user1, user2, depositor, beneficiary };
  }

  describe("GRAIN Transfer Gas Cost", function () {
    it("Should cost less than 50K gas for basic transfer", async function () {
      const { grain, vault, user1, user2 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      const tx = await grain.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      const receipt = await tx.wait();

      console.log(`    GRAIN Transfer Gas: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(50000);
    });

    it("Should cost similar gas for any transfer amount", async function () {
      const { grain, vault, user1, user2 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));

      const tx1 = await grain.connect(user1).transfer(user2.address, ethers.parseEther("1"));
      const receipt1 = await tx1.wait();

      const tx2 = await grain.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      const receipt2 = await tx2.wait();

      console.log(`    Small transfer: ${receipt1.gasUsed.toString()}`);
      console.log(`    Large transfer: ${receipt2.gasUsed.toString()}`);

      // Should be within 5% of each other
      const diff = receipt1.gasUsed > receipt2.gasUsed
        ? receipt1.gasUsed - receipt2.gasUsed
        : receipt2.gasUsed - receipt1.gasUsed;
      expect(diff).to.be.lt(receipt1.gasUsed / 20n);
    });
  });

  describe("Vault Deposit Gas Cost", function () {
    it("Should cost less than 100K gas for deposit", async function () {
      const { vaultContract, usdc, user1 } = await loadFixture(deploySystemFixture);

      const amount = ethers.parseUnits("10000", 6);
      await usdc.connect(user1).approve(vaultContract.target, amount);

      const tx = await vaultContract.connect(user1).deposit(amount);
      const receipt = await tx.wait();

      console.log(`    Vault Deposit Gas: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(100000);
    });

    it("Should have consistent gas cost across deposits", async function () {
      const { vaultContract, usdc, user1 } = await loadFixture(deploySystemFixture);

      const amount1 = ethers.parseUnits("1000", 6);
      await usdc.connect(user1).approve(vaultContract.target, amount1 * 10n);

      const tx1 = await vaultContract.connect(user1).deposit(amount1);
      const receipt1 = await tx1.wait();

      const tx2 = await vaultContract.connect(user1).deposit(amount1);
      const receipt2 = await tx2.wait();

      console.log(`    First deposit: ${receipt1.gasUsed.toString()}`);
      console.log(`    Second deposit: ${receipt2.gasUsed.toString()}`);

      // Second deposit might be slightly cheaper (warm storage)
      expect(receipt2.gasUsed).to.be.lte(receipt1.gasUsed);
    });
  });

  describe("Escrow Creation Gas Cost", function () {
    it("Should cost less than 150K gas for basic escrow", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deploySystemFixture);

      const tx = await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        ethers.parseUnits("10000", 6),
        ["Milestone 1"],
        [10000],
        30,
        "TEST-001",
        "Test escrow"
      );
      const receipt = await tx.wait();

      console.log(`    Escrow Creation Gas: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(150000);
    });

    it("Should scale linearly with milestone count", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deploySystemFixture);

      const tx1 = await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        ethers.parseUnits("10000", 6),
        ["M1"],
        [10000],
        30,
        "TEST-1",
        "Test"
      );
      const receipt1 = await tx1.wait();

      const tx3 = await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        depositor.address,
        usdc.target,
        ethers.parseUnits("10000", 6),
        ["M1", "M2", "M3"],
        [3334, 3333, 3333],
        30,
        "TEST-3",
        "Test"
      );
      const receipt3 = await tx3.wait();

      console.log(`    1 milestone: ${receipt1.gasUsed.toString()}`);
      console.log(`    3 milestones: ${receipt3.gasUsed.toString()}`);

      // 3 milestones should cost less than 3x (due to fixed costs)
      expect(receipt3.gasUsed).to.be.lt(receipt1.gasUsed * 3n);
    });
  });

  describe("NAV Update Gas Cost", function () {
    it("Should cost less than 80K gas for NAV update", async function () {
      const { grain, vault } = await loadFixture(deploySystemFixture);

      const tx = await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      const receipt = await tx.wait();

      console.log(`    NAV Update Gas (no supply): ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(80000);
    });

    it("Should cost more when recalculating price", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));

      const tx = await grain.connect(vault).updateNAV(ethers.parseEther("10500"));
      const receipt = await tx.wait();

      console.log(`    NAV Update Gas (with supply): ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(100000);
    });
  });

  describe("GRAIN Minting Gas Cost", function () {
    it("Should track gas cost for minting", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));

      const tx = await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));
      const receipt = await tx.wait();

      console.log(`    GRAIN Mint Gas: ${receipt.gasUsed.toString()}`);
      // First mint is more expensive due to storage initialization
    });

    it("Should be cheaper for subsequent mints", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));

      const tx1 = await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));
      const receipt1 = await tx1.wait();

      const tx2 = await grain.connect(vault).mint(user1.address, ethers.parseEther("1000"));
      const receipt2 = await tx2.wait();

      console.log(`    First mint: ${receipt1.gasUsed.toString()}`);
      console.log(`    Second mint: ${receipt2.gasUsed.toString()}`);

      expect(receipt2.gasUsed).to.be.lt(receipt1.gasUsed);
    });
  });

  describe("GRAIN Burning Gas Cost", function () {
    it("Should track gas cost for burning", async function () {
      const { grain, vault, user1 } = await loadFixture(deploySystemFixture);

      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));

      const tx = await grain.connect(vault).burn(user1.address, ethers.parseEther("1000"));
      const receipt = await tx.wait();

      console.log(`    GRAIN Burn Gas: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(50000);
    });
  });

  describe("Escrow Funding Gas Cost", function () {
    it("Should track gas cost for funding", async function () {
      const { escrow, usdc, depositor, beneficiary } = await loadFixture(deploySystemFixture);

      const totalAmount = ethers.parseUnits("10000", 6);
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
      const fee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + fee);

      const tx = await escrow.connect(depositor).fundEscrow(escrowId);
      const receipt = await tx.wait();

      console.log(`    Escrow Funding Gas: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(150000);
    });
  });

  describe("Milestone Completion Gas Cost", function () {
    it("Should track gas cost for completing milestone", async function () {
      const { escrow, usdc, admin, depositor, beneficiary } = await loadFixture(deploySystemFixture);

      const totalAmount = ethers.parseUnits("10000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        admin.address,
        usdc.target,
        totalAmount,
        ["M1"],
        [10000],
        30,
        "TEST",
        "Test"
      );

      const escrowId = 1;
      const fee = (totalAmount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, totalAmount + fee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      const tx = await escrow.connect(admin).completeMilestone(escrowId, 0);
      const receipt = await tx.wait();

      console.log(`    Milestone Completion Gas: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(100000);
    });

    it("Should track gas for last milestone (status change)", async function () {
      const { escrow, usdc, admin, depositor, beneficiary } = await loadFixture(deploySystemFixture);

      const totalAmount = ethers.parseUnits("10000", 6);
      await escrow.connect(depositor).createEscrow(
        beneficiary.address,
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
      await usdc.connect(depositor).approve(escrow.target, totalAmount + fee);
      await escrow.connect(depositor).fundEscrow(escrowId);

      await escrow.connect(admin).completeMilestone(escrowId, 0);

      const tx = await escrow.connect(admin).completeMilestone(escrowId, 1);
      const receipt = await tx.wait();

      console.log(`    Last Milestone Gas (with status update): ${receipt.gasUsed.toString()}`);
      // Slightly more expensive due to status change and completion event
    });
  });

  describe("Vault Asset Update Gas Cost", function () {
    it("Should track gas cost for updating all asset categories", async function () {
      const { vaultContract, vault } = await loadFixture(deploySystemFixture);

      const tx = await vaultContract.connect(vault).updateAssets(
        ethers.parseUnits("1000000", 6),
        ethers.parseUnits("50000", 6),
        ethers.parseUnits("200000", 6),
        ethers.parseUnits("100000", 6),
        ethers.parseUnits("75000", 6)
      );
      const receipt = await tx.wait();

      console.log(`    Asset Update Gas: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(120000);
    });
  });

  describe("Gas Comparison Summary", function () {
    it("Should generate comprehensive gas report", async function () {
      const { grain, vaultContract, escrow, usdc, admin, vault, user1, depositor, beneficiary } = await loadFixture(deploySystemFixture);

      console.log("\n    ===== GAS BENCHMARKS =====");

      // GRAIN operations
      await grain.connect(vault).updateNAV(ethers.parseEther("10000"));
      const mintTx = await grain.connect(vault).mint(user1.address, ethers.parseEther("9000"));
      const mintReceipt = await mintTx.wait();
      console.log(`    GRAIN Mint:      ${mintReceipt.gasUsed.toString()} gas`);

      const transferTx = await grain.connect(user1).transfer(admin.address, ethers.parseEther("100"));
      const transferReceipt = await transferTx.wait();
      console.log(`    GRAIN Transfer:  ${transferReceipt.gasUsed.toString()} gas`);

      const burnTx = await grain.connect(vault).burn(user1.address, ethers.parseEther("100"));
      const burnReceipt = await burnTx.wait();
      console.log(`    GRAIN Burn:      ${burnReceipt.gasUsed.toString()} gas`);

      // Vault operations
      await usdc.connect(user1).approve(vaultContract.target, ethers.parseUnits("10000", 6));
      const depositTx = await vaultContract.connect(user1).deposit(ethers.parseUnits("10000", 6));
      const depositReceipt = await depositTx.wait();
      console.log(`    Vault Deposit:   ${depositReceipt.gasUsed.toString()} gas`);

      const navUpdateTx = await grain.connect(vault).updateNAV(ethers.parseEther("10500"));
      const navUpdateReceipt = await navUpdateTx.wait();
      console.log(`    NAV Update:      ${navUpdateReceipt.gasUsed.toString()} gas`);

      // Escrow operations
      const createTx = await escrow.connect(depositor).createEscrow(
        beneficiary.address,
        admin.address,
        usdc.target,
        ethers.parseUnits("10000", 6),
        ["M1"],
        [10000],
        30,
        "TEST",
        "Test"
      );
      const createReceipt = await createTx.wait();
      console.log(`    Escrow Create:   ${createReceipt.gasUsed.toString()} gas`);

      const amount = ethers.parseUnits("10000", 6);
      const fee = (amount * 50n) / 10000n;
      await usdc.connect(depositor).approve(escrow.target, amount + fee);
      const fundTx = await escrow.connect(depositor).fundEscrow(1);
      const fundReceipt = await fundTx.wait();
      console.log(`    Escrow Fund:     ${fundReceipt.gasUsed.toString()} gas`);

      const completeTx = await escrow.connect(admin).completeMilestone(1, 0);
      const completeReceipt = await completeTx.wait();
      console.log(`    Milestone Complete: ${completeReceipt.gasUsed.toString()} gas`);

      console.log("    ==========================\n");

      // All within acceptable limits
      expect(mintReceipt.gasUsed).to.be.lt(150000);
      expect(transferReceipt.gasUsed).to.be.lt(50000);
      expect(burnReceipt.gasUsed).to.be.lt(50000);
      expect(depositReceipt.gasUsed).to.be.lt(100000);
      expect(navUpdateReceipt.gasUsed).to.be.lt(100000);
      expect(createReceipt.gasUsed).to.be.lt(150000);
      expect(fundReceipt.gasUsed).to.be.lt(150000);
      expect(completeReceipt.gasUsed).to.be.lt(100000);
    });
  });
});
