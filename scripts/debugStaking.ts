import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0xC40c55fC2395Deb4E9179eC89768516b90C36cf7";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Account:", signer.address);
  
  // Check MIM balance
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
  ], signer);
  
  const mimBalance = await mim.balanceOf(signer.address);
  const mimAllowance = await mim.allowance(signer.address, STAKING_VAULT);
  
  console.log("\nMIM:");
  console.log("  Balance:", ethers.utils.formatEther(mimBalance));
  console.log("  Allowance for StakingVault:", ethers.utils.formatEther(mimAllowance));
  
  // Check StakingVault state
  const vault = new ethers.Contract(STAKING_VAULT, [
    "function asset() view returns (address)",
    "function totalAssets() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function mim() view returns (address)",
    "function maxDeposit(address) view returns (uint256)",
    "function previewDeposit(uint256) view returns (uint256)",
  ], signer);
  
  console.log("\nStakingVault:");
  
  try {
    const asset = await vault.asset();
    console.log("  Asset:", asset);
    console.log("  Asset matches MIM:", asset.toLowerCase() === MIM.toLowerCase());
  } catch (e: any) {
    console.log("  Asset error:", e.message);
  }
  
  try {
    const mimAddr = await vault.mim();
    console.log("  mim():", mimAddr);
  } catch (e: any) {
    console.log("  mim() not found (might be using asset())");
  }
  
  try {
    const totalAssets = await vault.totalAssets();
    console.log("  Total Assets:", ethers.utils.formatEther(totalAssets));
  } catch (e: any) {
    console.log("  totalAssets error:", e.message);
  }
  
  try {
    const totalSupply = await vault.totalSupply();
    console.log("  Total Supply:", ethers.utils.formatEther(totalSupply));
  } catch (e: any) {
    console.log("  totalSupply error:", e.message);
  }
  
  try {
    const maxDeposit = await vault.maxDeposit(signer.address);
    console.log("  Max Deposit:", ethers.utils.formatEther(maxDeposit));
  } catch (e: any) {
    console.log("  maxDeposit error:", e.message);
  }
  
  // Try to preview deposit
  const testAmount = ethers.utils.parseEther("1");
  try {
    const shares = await vault.previewDeposit(testAmount);
    console.log("  Preview 1 MIM deposit -> shares:", ethers.utils.formatEther(shares));
  } catch (e: any) {
    console.log("  previewDeposit error:", e.message);
  }
  
  // Try static call deposit
  console.log("\n--- Testing deposit ---");
  
  const vaultWrite = new ethers.Contract(STAKING_VAULT, [
    "function deposit(uint256,address) returns (uint256)",
  ], signer);
  
  // Approve first
  if (mimAllowance.lt(mimBalance)) {
    console.log("Approving MIM...");
    await (await mim.approve(STAKING_VAULT, ethers.constants.MaxUint256)).wait();
    console.log("Approved!");
  }
  
  try {
    await vaultWrite.callStatic.deposit(testAmount, signer.address);
    console.log("Static call succeeded!");
  } catch (e: any) {
    console.log("Static call failed:", e.reason || e.message);
    if (e.error?.message) console.log("Inner error:", e.error.message);
  }
}

main().catch(console.error);


