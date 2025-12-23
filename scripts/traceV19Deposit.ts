import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const WTOKEN = "0x998E56B74e0c0D94c4315aD2EfC79a99868c67A3";
const LEVERAGE_AMM = "0x897074004705Ca3C578e403090F1FF397A7807Bb";
const V3_VAULT = "0x64B933Ce0536f5508cf9Ccec9628E969434dc8E1";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Trace V19 Deposit ===\n");
  
  // Get deposit amount  
  const depositAmount = ethers.utils.parseEther("0.0005");
  
  // Step 1: Check WToken can receive sWETH
  console.log("1. Checking WToken internal call...");
  const wToken = new ethers.Contract(WTOKEN, [
    "function underlyingAsset() view returns (address)",
    "function leverageAMM() view returns (address)"
  ], signer);
  console.log("   WToken underlyingAsset:", await wToken.underlyingAsset());
  console.log("   WToken leverageAMM:", await wToken.leverageAMM());
  
  // Step 2: Check WToken can transfer sWETH to LeverageAMM
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)"
  ], signer);
  
  console.log("\n2. Token balances and allowances...");
  console.log("   User sWETH balance:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("   User sWETH allowance for WToken:", ethers.utils.formatEther(await sweth.allowance(signer.address, WTOKEN)));
  
  // Step 3: Check if LeverageAMM has approval from WToken for sWETH
  console.log("\n3. LeverageAMM approvals...");
  console.log("   sWETH allowance WToken->LeverageAMM:", ethers.utils.formatEther(await sweth.allowance(WTOKEN, LEVERAGE_AMM)));
  
  // Step 4: Check the borrow amount calculation
  const oracle = new ethers.Contract(ORACLE, [
    "function getPrice() view returns (uint256)"
  ], signer);
  const price = await oracle.getPrice();
  const borrowAmount = depositAmount.mul(price).div(ethers.utils.parseEther("1"));
  console.log("\n4. Borrow calculation...");
  console.log("   Oracle price:", ethers.utils.formatEther(price), "MIM/sWETH");
  console.log("   For", ethers.utils.formatEther(depositAmount), "sWETH:");
  console.log("   Need to borrow:", ethers.utils.formatEther(borrowAmount), "MIM");
  
  // Step 5: Test LeverageAMM.openPosition directly
  console.log("\n5. Simulating LeverageAMM.openPosition...");
  const leverageAMM = new ethers.Contract(LEVERAGE_AMM, [
    "function openPosition(uint256,uint256) external"
  ], signer);
  
  // First need WToken to call it, not us directly (it has onlyWToken modifier)
  // Let's check if we need to test differently
  
  // Step 6: Check token approvals from LeverageAMM to V3LPVault
  console.log("\n6. LeverageAMM token approvals to V3LPVault...");
  const mim = new ethers.Contract(MIM, [
    "function allowance(address,address) view returns (uint256)"
  ], signer);
  console.log("   sWETH allowance LeverageAMM->V3Vault:", ethers.utils.formatEther(await sweth.allowance(LEVERAGE_AMM, V3_VAULT)));
  console.log("   MIM allowance LeverageAMM->V3Vault:", ethers.utils.formatEther(await mim.allowance(LEVERAGE_AMM, V3_VAULT)));
  
  // Step 7: Check MIM balance in StakingVault
  console.log("\n7. StakingVault MIM balance...");
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function mim() view returns (address)"
  ], signer);
  console.log("   StakingVault mim:", await stakingVault.mim());
  const mimBalance = await mim.balanceOf(STAKING_VAULT);
  console.log("   MIM in StakingVault:", ethers.utils.formatEther(mimBalance));
}
main().catch(console.error);
