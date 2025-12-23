/**
 * Comprehensive test of 0IL vault deposit flow
 */

import { ethers } from "hardhat";

const ADDRESSES = {
  wETH: "0x1A7c1D401048B93AA541aDb5511bE2C22813F1B8",
  leverageAMM: "0x433039d1F943E6b7E5248f18d780bD30705FcBA0",
  v3LPVault: "0x9a63d16Ecdf83af6bF56fF7e9cF78284d9CEA0a0",
  stakingVault: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  mim: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  swethMimPool: "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190",
  oracle: "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749",
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing with:", signer.address);
  
  // Contracts
  const wETH = new ethers.Contract(ADDRESSES.wETH, [
    "function totalSupply() view returns (uint256)",
    "function totalDeposited() view returns (uint256)",
    "function pricePerShare() view returns (uint256)",
    "function convertToShares(uint256) view returns (uint256)",
    "function deposit(uint256,uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const leverageAMM = new ethers.Contract(ADDRESSES.leverageAMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function getPrice() view returns (uint256)",
    "function getCurrentDTV() view returns (uint256)",
  ], signer);
  
  const stakingVault = new ethers.Contract(ADDRESSES.stakingVault, [
    "function getCash() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
  ], signer);
  
  const sWETH = new ethers.Contract(ADDRESSES.sWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) external returns (bool)",
  ], signer);
  
  const mim = new ethers.Contract(ADDRESSES.mim, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const oracle = new ethers.Contract(ADDRESSES.oracle, [
    "function getPrice() view returns (uint256)",
    "function getInversePrice() view returns (uint256)",
  ], signer);
  
  console.log("\n=== BEFORE DEPOSIT ===\n");
  
  // Check balances
  const sWETHBal = await sWETH.balanceOf(signer.address);
  console.log("User sWETH balance:", ethers.utils.formatEther(sWETHBal));
  
  const wETHBalBefore = await wETH.balanceOf(signer.address);
  console.log("User wETH balance:", ethers.utils.formatEther(wETHBalBefore));
  
  // Check wETH vault state
  console.log("\n--- wETH Vault State ---");
  const totalSupply = await wETH.totalSupply();
  const totalDeposited = await wETH.totalDeposited();
  const pricePerShare = await wETH.pricePerShare();
  
  console.log("totalSupply:", ethers.utils.formatEther(totalSupply));
  console.log("totalDeposited:", ethers.utils.formatEther(totalDeposited));
  console.log("pricePerShare:", ethers.utils.formatEther(pricePerShare));
  
  // Check LeverageAMM state
  console.log("\n--- LeverageAMM State ---");
  try {
    const totalDebt = await leverageAMM.totalDebt();
    console.log("totalDebt:", ethers.utils.formatEther(totalDebt), "MIM");
  } catch (e) {
    console.log("totalDebt: error");
  }
  
  try {
    const totalUnderlying = await leverageAMM.totalUnderlying();
    console.log("totalUnderlying:", ethers.utils.formatEther(totalUnderlying), "sWETH");
  } catch (e) {
    console.log("totalUnderlying: error");
  }
  
  try {
    const price = await leverageAMM.getPrice();
    console.log("getPrice():", ethers.utils.formatEther(price), "MIM per sWETH");
  } catch (e: any) {
    console.log("getPrice error:", e.reason || e.message?.slice(0, 50));
  }
  
  // Check Oracle
  console.log("\n--- Oracle ---");
  try {
    const oraclePrice = await oracle.getPrice();
    console.log("oracle.getPrice():", ethers.utils.formatEther(oraclePrice));
  } catch (e: any) {
    console.log("oracle error:", e.reason || e.message?.slice(0, 100));
  }
  
  // Check StakingVault
  console.log("\n--- StakingVault ---");
  const cash = await stakingVault.getCash();
  const borrows = await stakingVault.totalBorrows();
  console.log("getCash():", ethers.utils.formatEther(cash), "MIM");
  console.log("totalBorrows():", ethers.utils.formatEther(borrows), "MIM");
  
  // Test convertToShares calculation
  const testAmount = ethers.utils.parseEther("0.001"); // 0.001 sWETH
  console.log("\n--- Conversion Test ---");
  console.log("Input: 0.001 sWETH");
  
  const shares = await wETH.convertToShares(testAmount);
  console.log("convertToShares result:", ethers.utils.formatEther(shares), "wETH");
  console.log("Ratio:", parseFloat(ethers.utils.formatEther(shares)) / 0.001);
  
  // Do actual deposit
  console.log("\n=== PERFORMING DEPOSIT ===\n");
  
  // Approve
  await (await sWETH.approve(ADDRESSES.wETH, ethers.constants.MaxUint256)).wait();
  console.log("Approved sWETH");
  
  // Deposit
  try {
    const tx = await wETH.deposit(testAmount, 0, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("Deposit tx:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (e: any) {
    console.log("Deposit failed:", e.reason || e.message);
    return;
  }
  
  console.log("\n=== AFTER DEPOSIT ===\n");
  
  // Check new balances
  const sWETHBalAfter = await sWETH.balanceOf(signer.address);
  console.log("User sWETH balance:", ethers.utils.formatEther(sWETHBalAfter));
  console.log("sWETH spent:", ethers.utils.formatEther(sWETHBal.sub(sWETHBalAfter)));
  
  const wETHBalAfter = await wETH.balanceOf(signer.address);
  console.log("User wETH balance:", ethers.utils.formatEther(wETHBalAfter));
  console.log("wETH received:", ethers.utils.formatEther(wETHBalAfter.sub(wETHBalBefore)));
  
  // Check vault state after
  console.log("\n--- wETH Vault State After ---");
  console.log("totalSupply:", ethers.utils.formatEther(await wETH.totalSupply()));
  console.log("totalDeposited:", ethers.utils.formatEther(await wETH.totalDeposited()));
  console.log("pricePerShare:", ethers.utils.formatEther(await wETH.pricePerShare()));
  
  // Check LeverageAMM after
  console.log("\n--- LeverageAMM State After ---");
  try {
    console.log("totalDebt:", ethers.utils.formatEther(await leverageAMM.totalDebt()), "MIM");
  } catch (e) {}
  try {
    console.log("totalUnderlying:", ethers.utils.formatEther(await leverageAMM.totalUnderlying()), "sWETH");
  } catch (e) {}
  
  // Check StakingVault after
  console.log("\n--- StakingVault After ---");
  console.log("getCash():", ethers.utils.formatEther(await stakingVault.getCash()), "MIM");
  console.log("totalBorrows():", ethers.utils.formatEther(await stakingVault.totalBorrows()), "MIM");
}

main().catch(console.error);

