/**
 * Grain Token Unit Tests
 *
 * Run with: npx hardhat test test/grain-vault/Grain.test.ts
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { Grain, Vault, GrainPriceOracle } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Grain Token", function () {
  let grain: Grain;
  let vault: Vault;
  let oracle: GrainPriceOracle;
  let usdc: any; // Mock USDC
  let owner: SignerWithAddress;
  let investor: SignerWithAddress;
  let foundingInvestor: SignerWithAddress;

  const INITIAL_NAV = ethers.parseEther("1.0"); // $1.00
  const VESTING_PERIOD = 365 * 24 * 60 * 60; // 1 year

  beforeEach(async function () {
    [owner, investor, foundingInvestor] = await ethers.getSigners();

    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6); // 6 decimals
    await usdc.waitForDeployment();

    // Deploy Vault
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(await usdc.getAddress());
    await vault.waitForDeployment();

    // Deploy Oracle (with temp grain address)
    const GrainPriceOracle = await ethers.getContractFactory("GrainPriceOracle");
    oracle = await GrainPriceOracle.deploy(
      ethers.ZeroAddress,
      await vault.getAddress(),
      INITIAL_NAV
    );
    await oracle.waitForDeployment();

    // Deploy Grain
    const Grain = await ethers.getContractFactory("Grain");
    const vestingEndTime = Math.floor(Date.now() / 1000) + VESTING_PERIOD;
    grain = await Grain.deploy(
      await vault.getAddress(),
      await oracle.getAddress(),
      vestingEndTime
    );
    await grain.waitForDeployment();

    // Update oracle with grain address
    await oracle.setGrainToken(await grain.getAddress());

    // Grant minter role
    const MINTER_ROLE = await grain.MINTER_ROLE();
    await grain.grantRole(MINTER_ROLE, owner.address);
  });

  describe("Deployment", function () {
    it("Should set the correct vault address", async function () {
      expect(await grain.vault()).to.equal(await vault.getAddress());
    });

    it("Should set the correct oracle address", async function () {
      expect(await grain.priceOracle()).to.equal(await oracle.getAddress());
    });

    it("Should initialize with $1.00 NAV", async function () {
      expect(await grain.navPerToken()).to.equal(INITIAL_NAV);
    });

    it("Should have correct token name and symbol", async function () {
      expect(await grain.name()).to.equal("Grain");
      expect(await grain.symbol()).to.equal("GRAIN");
    });
  });

  describe("Minting", function () {
    it("Should mint GRAIN at current NAV", async function () {
      const mintAmount = ethers.parseEther("1000"); // 1000 GRAIN

      await grain.mint(investor.address, mintAmount);

      expect(await grain.balanceOf(investor.address)).to.equal(mintAmount);
      expect(await grain.totalSupply()).to.equal(mintAmount);
    });

    it("Should emit Minted event", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(grain.mint(investor.address, mintAmount))
        .to.emit(grain, "Minted")
        .withArgs(investor.address, mintAmount, INITIAL_NAV);
    });

    it("Should revert if not minter", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(
        grain.connect(investor).mint(investor.address, mintAmount)
      ).to.be.reverted;
    });

    it("Should mint founding investor at $1.00 price", async function () {
      const mintAmount = ethers.parseEther("1000");

      await grain.mintFoundingInvestor(foundingInvestor.address, mintAmount);

      expect(await grain.isFounder(foundingInvestor.address)).to.equal(true);
      expect(await grain.balanceOf(foundingInvestor.address)).to.equal(mintAmount);
    });
  });

  describe("NAV Updates", function () {
    it("Should update NAV from oracle", async function () {
      const newNav = ethers.parseEther("1.05"); // $1.05

      // Grant oracle role
      const ORACLE_ROLE = await grain.ORACLE_ROLE();
      await grain.grantRole(ORACLE_ROLE, owner.address);

      // Wait 1 hour (time-lock)
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await grain.updateNav(newNav);

      expect(await grain.navPerToken()).to.equal(newNav);
    });

    it("Should reject NAV update if too frequent", async function () {
      const newNav = ethers.parseEther("1.05");

      const ORACLE_ROLE = await grain.ORACLE_ROLE();
      await grain.grantRole(ORACLE_ROLE, owner.address);

      await expect(grain.updateNav(newNav)).to.be.reverted;
    });

    it("Should reject NAV change > 5%", async function () {
      const newNav = ethers.parseEther("1.10"); // 10% increase

      const ORACLE_ROLE = await grain.ORACLE_ROLE();
      await grain.grantRole(ORACLE_ROLE, owner.address);

      // Wait 1 hour
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await expect(grain.updateNav(newNav)).to.be.reverted;
    });

    it("Should emit NavUpdated event", async function () {
      const newNav = ethers.parseEther("1.05");

      const ORACLE_ROLE = await grain.ORACLE_ROLE();
      await grain.grantRole(ORACLE_ROLE, owner.address);

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await expect(grain.updateNav(newNav))
        .to.emit(grain, "NavUpdated")
        .withArgs(INITIAL_NAV, newNav, await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1));
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Mint some GRAIN first
      const mintAmount = ethers.parseEther("1000");
      await grain.mint(investor.address, mintAmount);
    });

    it("Should burn GRAIN", async function () {
      const burnAmount = ethers.parseEther("500");

      await grain.connect(investor).burn(burnAmount);

      expect(await grain.balanceOf(investor.address)).to.equal(
        ethers.parseEther("500")
      );
      expect(await grain.totalSupply()).to.equal(ethers.parseEther("500"));
    });

    it("Should emit Burned event", async function () {
      const burnAmount = ethers.parseEther("500");

      await expect(grain.connect(investor).burn(burnAmount))
        .to.emit(grain, "Burned")
        .withArgs(investor.address, burnAmount, INITIAL_NAV);
    });

    it("Should revert if insufficient balance", async function () {
      const burnAmount = ethers.parseEther("2000");

      await expect(grain.connect(investor).burn(burnAmount)).to.be.reverted;
    });
  });

  describe("Transfer Restrictions", function () {
    it("Should allow normal transfers", async function () {
      const mintAmount = ethers.parseEther("1000");
      await grain.mint(investor.address, mintAmount);

      await grain.connect(investor).transfer(owner.address, ethers.parseEther("100"));

      expect(await grain.balanceOf(owner.address)).to.equal(
        ethers.parseEther("100")
      );
    });

    it("Should block founding investor transfers during vesting", async function () {
      const mintAmount = ethers.parseEther("1000");
      await grain.mintFoundingInvestor(foundingInvestor.address, mintAmount);

      await expect(
        grain.connect(foundingInvestor).transfer(owner.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    it("Should return correct price", async function () {
      expect(await grain.getPrice()).to.equal(INITIAL_NAV);
    });

    it("Should calculate market cap correctly", async function () {
      const mintAmount = ethers.parseEther("1000");
      await grain.mint(investor.address, mintAmount);

      const expectedMarketCap = (mintAmount * INITIAL_NAV) / ethers.parseEther("1");
      expect(await grain.getMarketCap()).to.equal(expectedMarketCap);
    });

    it("Should check if address is founder", async function () {
      await grain.mintFoundingInvestor(foundingInvestor.address, ethers.parseEther("1000"));

      expect(await grain.isFounder(foundingInvestor.address)).to.equal(true);
      expect(await grain.isFounder(investor.address)).to.equal(false);
    });
  });

  describe("Emergency Pause", function () {
    it("Should pause all operations", async function () {
      const PAUSER_ROLE = await grain.PAUSER_ROLE();
      await grain.grantRole(PAUSER_ROLE, owner.address);

      await grain.pause();

      await expect(
        grain.mint(investor.address, ethers.parseEther("1000"))
      ).to.be.reverted;
    });

    it("Should unpause operations", async function () {
      const PAUSER_ROLE = await grain.PAUSER_ROLE();
      await grain.grantRole(PAUSER_ROLE, owner.address);

      await grain.pause();
      await grain.unpause();

      await expect(
        grain.mint(investor.address, ethers.parseEther("1000"))
      ).to.not.be.reverted;
    });
  });

  describe("Gas Optimization", function () {
    it("Should mint with < 100K gas", async function () {
      const tx = await grain.mint(investor.address, ethers.parseEther("1000"));
      const receipt = await tx.wait();

      expect(receipt!.gasUsed).to.be.lessThan(100000);
    });

    it("Should transfer with < 100K gas", async function () {
      await grain.mint(investor.address, ethers.parseEther("1000"));

      const tx = await grain.connect(investor).transfer(
        owner.address,
        ethers.parseEther("100")
      );
      const receipt = await tx.wait();

      expect(receipt!.gasUsed).to.be.lessThan(100000);
    });
  });
});
