import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MIM, MIMStakingVault } from "../typechain-types";

describe("MIM Stablecoin", function () {
  let mim: MIM;
  let stakingVault: MIMStakingVault;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let user: SignerWithAddress;
  let mockUSDC: any;

  const INITIAL_USDC = ethers.parseUnits("1000000", 6); // 1M USDC

  beforeEach(async function () {
    [owner, minter, user] = await ethers.getSigners();

    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUSDC.mint(user.address, INITIAL_USDC);

    // Deploy MIM
    const MIM = await ethers.getContractFactory("MIM");
    mim = await MIM.deploy(mockUSDC.target);

    // Deploy Staking Vault
    const StakingVault = await ethers.getContractFactory("MIMStakingVault");
    stakingVault = await StakingVault.deploy(mim.target);
  });

  describe("MIM Token", function () {
    describe("Deployment", function () {
      it("Should have correct name and symbol", async function () {
        expect(await mim.name()).to.equal("Magic Internet Money");
        expect(await mim.symbol()).to.equal("MIM");
      });

      it("Should have 18 decimals", async function () {
        expect(await mim.decimals()).to.equal(18);
      });

      it("Should set deployer as owner", async function () {
        expect(await mim.owner()).to.equal(owner.address);
      });
    });

    describe("Minter Management", function () {
      it("Should allow owner to set minter", async function () {
        const allowance = ethers.parseEther("1000000");
        await mim.setMinter(minter.address, allowance);

        expect(await mim.isMinter(minter.address)).to.be.true;
        expect(await mim.minterAllowance(minter.address)).to.equal(allowance);
      });

      it("Should not allow non-owner to set minter", async function () {
        await expect(
          mim.connect(user).setMinter(minter.address, 1000)
        ).to.be.revertedWithCustomError(mim, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to remove minter", async function () {
        await mim.setMinter(minter.address, 1000);
        await mim.removeMinter(minter.address);

        expect(await mim.isMinter(minter.address)).to.be.false;
        expect(await mim.minterAllowance(minter.address)).to.equal(0);
      });
    });

    describe("Minting", function () {
      beforeEach(async function () {
        await mim.setMinter(minter.address, ethers.parseEther("1000000"));
      });

      it("Should allow minter to mint", async function () {
        const amount = ethers.parseEther("1000");
        await mim.connect(minter).mint(user.address, amount);

        expect(await mim.balanceOf(user.address)).to.equal(amount);
      });

      it("Should reduce minter allowance after minting", async function () {
        const initialAllowance = await mim.minterAllowance(minter.address);
        const mintAmount = ethers.parseEther("1000");

        await mim.connect(minter).mint(user.address, mintAmount);

        expect(await mim.minterAllowance(minter.address)).to.equal(
          initialAllowance - mintAmount
        );
      });

      it("Should not allow non-minter to mint", async function () {
        await expect(
          mim.connect(user).mint(user.address, 1000)
        ).to.be.revertedWithCustomError(mim, "NotMinter");
      });

      it("Should not allow minting beyond allowance", async function () {
        const allowance = await mim.minterAllowance(minter.address);
        await expect(
          mim.connect(minter).mint(user.address, allowance + 1n)
        ).to.be.revertedWithCustomError(mim, "ExceedsAllowance");
      });
    });

    describe("USDC Minting/Redeeming", function () {
      const usdcAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      const mimAmount = ethers.parseEther("1000"); // 1000 MIM

      it("Should mint MIM 1:1 with USDC", async function () {
        await mockUSDC.connect(user).approve(mim.target, usdcAmount);
        await mim.connect(user).mintWithUSDC(usdcAmount);

        expect(await mim.balanceOf(user.address)).to.equal(mimAmount);
        expect(await mim.totalBacking()).to.equal(usdcAmount);
      });

      it("Should redeem MIM for USDC 1:1", async function () {
        // First mint
        await mockUSDC.connect(user).approve(mim.target, usdcAmount);
        await mim.connect(user).mintWithUSDC(usdcAmount);

        // Then redeem
        const initialUSDC = await mockUSDC.balanceOf(user.address);
        await mim.connect(user).redeemForUSDC(mimAmount);

        expect(await mim.balanceOf(user.address)).to.equal(0);
        expect(await mockUSDC.balanceOf(user.address)).to.equal(
          initialUSDC + usdcAmount
        );
      });

      it("Should maintain correct backing ratio", async function () {
        await mockUSDC.connect(user).approve(mim.target, usdcAmount);
        await mim.connect(user).mintWithUSDC(usdcAmount);

        // Backing ratio should be 1:1 (1e18)
        expect(await mim.backingRatio()).to.equal(ethers.parseEther("1"));
      });
    });
  });

  describe("MIM Staking Vault", function () {
    beforeEach(async function () {
      // Setup: Mint some MIM for testing
      await mim.setMinter(owner.address, ethers.parseEther("10000000"));
      await mim.mint(user.address, ethers.parseEther("100000"));
      await mim.connect(user).approve(stakingVault.target, ethers.MaxUint256);
    });

    describe("Deposits", function () {
      it("Should accept deposits and mint sMIM", async function () {
        const depositAmount = ethers.parseEther("1000");
        await stakingVault.connect(user).deposit(depositAmount);

        expect(await stakingVault.balanceOf(user.address)).to.equal(depositAmount);
      });

      it("Should track total assets correctly", async function () {
        const depositAmount = ethers.parseEther("1000");
        await stakingVault.connect(user).deposit(depositAmount);

        expect(await stakingVault.totalAssets()).to.equal(depositAmount);
      });
    });

    describe("Withdrawals", function () {
      const depositAmount = ethers.parseEther("1000");

      beforeEach(async function () {
        await stakingVault.connect(user).deposit(depositAmount);
      });

      it("Should allow withdrawals", async function () {
        const initialBalance = await mim.balanceOf(user.address);
        const shares = await stakingVault.balanceOf(user.address);

        await stakingVault.connect(user).withdraw(shares);

        expect(await mim.balanceOf(user.address)).to.equal(
          initialBalance + depositAmount
        );
      });
    });

    describe("Interest Rate Model", function () {
      it("Should return correct base rate at 0% utilization", async function () {
        // Deposit some MIM
        await stakingVault.connect(user).deposit(ethers.parseEther("1000"));

        // Utilization is 0%
        const borrowRate = await stakingVault.borrowRate();
        const expectedBaseRate = ethers.parseEther("0.10"); // 10%

        expect(borrowRate).to.equal(expectedBaseRate);
      });

      it("Should calculate correct rate at 50% utilization", async function () {
        await stakingVault.connect(user).deposit(ethers.parseEther("10000"));
        await stakingVault.setBorrower(owner.address, true);
        await stakingVault.borrow(ethers.parseEther("5000"));

        const borrowRate = await stakingVault.borrowRate();
        // At 50% util: 10% + (0.5 * 12%) = 16%
        const expectedRate = ethers.parseEther("0.16");

        // Allow 0.1% tolerance
        expect(borrowRate).to.be.closeTo(expectedRate, ethers.parseEther("0.001"));
      });

      it("Should calculate correct rate at kink (80%)", async function () {
        await stakingVault.connect(user).deposit(ethers.parseEther("10000"));
        await stakingVault.setBorrower(owner.address, true);
        await stakingVault.borrow(ethers.parseEther("8000"));

        const borrowRate = await stakingVault.borrowRate();
        // At 80% util: 10% + (0.8 * 12%) = 19.6%
        const expectedRate = ethers.parseEther("0.196");

        expect(borrowRate).to.be.closeTo(expectedRate, ethers.parseEther("0.001"));
      });

      it("Should prevent borrows above 90% utilization", async function () {
        await stakingVault.connect(user).deposit(ethers.parseEther("10000"));
        await stakingVault.setBorrower(owner.address, true);

        // Try to borrow more than 90%
        await expect(
          stakingVault.borrow(ethers.parseEther("9100"))
        ).to.be.revertedWithCustomError(stakingVault, "ExceedsMaxUtilization");
      });
    });

    describe("Borrowing", function () {
      beforeEach(async function () {
        await stakingVault.connect(user).deposit(ethers.parseEther("10000"));
        await stakingVault.setBorrower(owner.address, true);
      });

      it("Should allow authorized borrowers to borrow", async function () {
        const borrowAmount = ethers.parseEther("5000");
        await stakingVault.borrow(borrowAmount);

        expect(await stakingVault.totalBorrows()).to.equal(borrowAmount);
      });

      it("Should not allow unauthorized borrowers", async function () {
        await expect(
          stakingVault.connect(user).borrow(ethers.parseEther("100"))
        ).to.be.revertedWithCustomError(stakingVault, "NotBorrower");
      });

      it("Should track borrow balance correctly", async function () {
        const borrowAmount = ethers.parseEther("5000");
        await stakingVault.borrow(borrowAmount);

        expect(await stakingVault.borrowBalanceOf(owner.address)).to.equal(
          borrowAmount
        );
      });
    });

    describe("Repayment", function () {
      const borrowAmount = ethers.parseEther("5000");

      beforeEach(async function () {
        await stakingVault.connect(user).deposit(ethers.parseEther("10000"));
        await stakingVault.setBorrower(owner.address, true);
        await stakingVault.borrow(borrowAmount);
        
        // Give owner some MIM to repay
        await mim.mint(owner.address, borrowAmount);
        await mim.approve(stakingVault.target, ethers.MaxUint256);
      });

      it("Should allow repayment", async function () {
        await stakingVault.repay(borrowAmount);

        expect(await stakingVault.totalBorrows()).to.equal(0);
      });

      it("Should reduce borrow balance after repayment", async function () {
        await stakingVault.repay(borrowAmount);

        expect(await stakingVault.borrowBalanceOf(owner.address)).to.equal(0);
      });
    });
  });
});

// Mock ERC20 for testing
const MockERC20Source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
`;


