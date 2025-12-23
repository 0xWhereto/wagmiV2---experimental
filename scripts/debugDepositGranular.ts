import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";

// From last finalTest.ts deployment
const V3_VAULT = "0xC4AC36c923658F9281bFEF592f36A2EC5101b19a";
const LEVERAGE_AMM = "0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74";
const WTOKEN = "0x1da18a479752820DD018feA75A27724fbA2F62e3";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug Deposit Granular ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function transfer(address,uint256)"
  ], signer);
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)"
  ], signer);
  
  const v3Vault = (await ethers.getContractFactory("V3LPVault")).attach(V3_VAULT);
  const leverageAMM = (await ethers.getContractFactory("LeverageAMM")).attach(LEVERAGE_AMM);
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  
  const amount = ethers.utils.parseEther("0.0003");
  
  console.log("0. Initial state:");
  console.log("   sWETH balance (user):", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("   sWETH balance (wToken):", ethers.utils.formatEther(await sweth.balanceOf(WTOKEN)));
  console.log("   sWETH balance (leverageAMM):", ethers.utils.formatEther(await sweth.balanceOf(LEVERAGE_AMM)));
  
  // Check allowances
  console.log("\n1. Allowances:");
  console.log("   sWETH: user->wToken:", ethers.utils.formatEther(await sweth.allowance(signer.address, WTOKEN)));
  console.log("   sWETH: wToken->leverageAMM:", ethers.utils.formatEther(await sweth.allowance(WTOKEN, LEVERAGE_AMM)));
  console.log("   sWETH: leverageAMM->v3Vault:", ethers.utils.formatEther(await sweth.allowance(LEVERAGE_AMM, V3_VAULT)));
  console.log("   MIM: leverageAMM->v3Vault:", ethers.utils.formatEther(await mim.allowance(LEVERAGE_AMM, V3_VAULT)));
  console.log("   MIM: leverageAMM->stakingVault:", ethers.utils.formatEther(await mim.allowance(LEVERAGE_AMM, STAKING_VAULT)));
  
  // Check V3 vault's underlyingIsToken0 in LeverageAMM
  console.log("\n2. LeverageAMM config:");
  console.log("   underlyingAsset:", await leverageAMM.underlyingAsset());
  console.log("   underlyingIsToken0:", await leverageAMM.underlyingIsToken0());
  console.log("   v3LPVault:", await leverageAMM.v3LPVault());
  
  // Check pool's token0/token1 in V3LPVault
  console.log("\n3. V3LPVault config:");
  console.log("   token0:", await v3Vault.token0());
  console.log("   token1:", await v3Vault.token1());
  console.log("   pool:", await v3Vault.pool());
  
  // Manually try step by step
  console.log("\n4. Testing transfer flow manually...");
  
  // Step 1: Transfer sWETH to wToken (simulate user deposit)
  console.log("   4a. Approve wToken...");
  await (await sweth.approve(WTOKEN, ethers.constants.MaxUint256)).wait();
  
  // Step 2: Try calling wToken.deposit
  console.log("   4b. Call wToken.deposit...");
  try {
    const tx = await wToken.deposit(amount, 0, { gasLimit: 2500000 });
    const receipt = await tx.wait();
    console.log("   SUCCESS! Gas used:", receipt.gasUsed.toString());
  } catch (err: any) {
    console.log("   FAILED at wToken.deposit");
    
    // Try to call openPosition directly from wToken
    // First get sWETH to wToken
    console.log("\n5. Testing LeverageAMM.openPosition directly...");
    console.log("   5a. Transfer sWETH to leverageAMM...");
    await (await sweth.transfer(LEVERAGE_AMM, amount)).wait();
    console.log("   sWETH at leverageAMM:", ethers.utils.formatEther(await sweth.balanceOf(LEVERAGE_AMM)));
    
    // Can we borrow from staking vault?
    console.log("\n   5b. Check if we can borrow...");
    const stakingVaultContract = new ethers.Contract(STAKING_VAULT, [
      "function isBorrower(address) view returns (bool)",
      "function totalAssets() view returns (uint256)",
      "function totalBorrows() view returns (uint256)",
      "function borrowLimit() view returns (uint256)"
    ], signer);
    console.log("   isBorrower(leverageAMM):", await stakingVaultContract.isBorrower(LEVERAGE_AMM));
    
    const assets = await stakingVaultContract.totalAssets();
    const borrows = await stakingVaultContract.totalBorrows();
    const available = assets.sub(borrows);
    console.log("   Available MIM:", ethers.utils.formatEther(available));
    
    // Try v3Vault.addLiquidity directly
    console.log("\n   5c. Try V3LPVault.addLiquidity as owner...");
    // First get tokens to v3Vault owner (signer)
    const mimContract = new ethers.Contract(MIM, ["function transfer(address,uint256)"], signer);
    const swethAmount = ethers.utils.parseEther("0.0001");
    const mimAmount = ethers.utils.parseEther("0.3"); // 3000 * 0.0001
    
    console.log("   MIM balance (signer):", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
    
    // Approve v3Vault
    await (await sweth.approve(V3_VAULT, ethers.constants.MaxUint256)).wait();
    await (await (new ethers.Contract(MIM, ["function approve(address,uint256)"], signer)).approve(V3_VAULT, ethers.constants.MaxUint256)).wait();
    
    try {
      const tx = await v3Vault.addLiquidity(swethAmount, mimAmount, 0, 0, { gasLimit: 2000000 });
      const receipt = await tx.wait();
      console.log("   V3LPVault.addLiquidity SUCCESS! Gas used:", receipt.gasUsed.toString());
    } catch (e: any) {
      console.log("   V3LPVault.addLiquidity FAILED:", e.message?.slice(0, 200));
    }
  }
}
main().catch(console.error);
