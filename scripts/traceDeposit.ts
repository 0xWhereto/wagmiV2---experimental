import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Trace Deposit Flow ===\n");
  
  // Get deployed contracts from finalTest
  const v3Vault = (await ethers.getContractFactory("V3LPVault")).attach("0xC4AC36c923658F9281bFEF592f36A2EC5101b19a");
  const leverageAMM = (await ethers.getContractFactory("LeverageAMM")).attach("0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74");
  const wToken = (await ethers.getContractFactory("WToken")).attach("0x1da18a479752820DD018feA75A27724fbA2F62e3");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)",
    "function allowance(address,address) view returns (uint256)"
  ], signer);
  
  // Check all permissions
  console.log("1. Checking permissions:");
  console.log("   wToken.leverageAMM:", await wToken.leverageAMM());
  console.log("   wToken.v3LPVault:", await wToken.v3LPVault());
  console.log("   leverageAMM.wToken:", await leverageAMM.wToken());
  console.log("   v3Vault isOperator(leverageAMM):", await v3Vault.isOperator(leverageAMM.address));
  
  // Check StakingVault
  const stakingContract = new ethers.Contract(STAKING_VAULT, [
    "function isBorrower(address) view returns (bool)",
    "function totalAssets() view returns (uint256)",
    "function totalBorrows() view returns (uint256)"
  ], signer);
  console.log("   StakingVault isBorrower(leverageAMM):", await stakingContract.isBorrower(leverageAMM.address));
  console.log("   StakingVault totalAssets:", ethers.utils.formatEther(await stakingContract.totalAssets()));
  console.log("   StakingVault totalBorrows:", ethers.utils.formatEther(await stakingContract.totalBorrows()));
  
  // Check allowances
  console.log("\n2. Checking allowances:");
  console.log("   sWETH allowance[signer->wToken]:", ethers.utils.formatEther(await sweth.allowance(signer.address, wToken.address)));
  
  // Check oracle
  const oracle = new ethers.Contract(ORACLE, [
    "function getPrice() view returns (uint256)",
    "function pool() view returns (address)"
  ], signer);
  console.log("\n3. Oracle:");
  console.log("   Oracle pool:", await oracle.pool());
  try {
    const price = await oracle.getPrice();
    console.log("   Oracle price:", ethers.utils.formatEther(price));
  } catch (err: any) {
    console.log("   Oracle getPrice() REVERTS:", err.message?.slice(0, 100));
  }
  
  // Try calling leverageAMM.openPosition directly
  console.log("\n4. Testing leverageAMM.openPosition statically:");
  const amount = ethers.utils.parseEther("0.0003");
  try {
    // Check if openPosition expects msg.sender == wToken
    const result = await leverageAMM.callStatic.openPosition(amount, { from: wToken.address });
    console.log("   Static call SUCCESS - would mint:", ethers.utils.formatEther(result), "shares");
  } catch (err: any) {
    console.log("   Static call FAILED:", err.message?.slice(0, 200));
  }
  
  // What does leverageAMM.openPosition do?
  // 1. Transfers underlyingAsset from msg.sender (wToken)
  // 2. Calculates MIM to borrow based on oracle price
  // 3. Borrows from stakingVault
  // 4. Adds liquidity to V3LPVault
  
  // Check getLeveredValue
  console.log("\n5. LeverageAMM state:");
  try {
    const price = await leverageAMM.getPrice();
    console.log("   LeverageAMM.getPrice():", ethers.utils.formatEther(price));
  } catch(e: any) {
    console.log("   LeverageAMM.getPrice() REVERTS:", e.message?.slice(0,100));
  }
  
  try {
    const debt = await leverageAMM.totalDebt();
    console.log("   LeverageAMM.totalDebt():", ethers.utils.formatEther(debt));
  } catch(e: any) {
    console.log("   LeverageAMM.totalDebt() REVERTS:", e.message?.slice(0,100));
  }
  
  console.log("\n6. V3LPVault layers:");
  for (let i = 0; i < 4; i++) {
    try {
      const layer = await v3Vault.layers(i);
      console.log(`   Layer ${i}: tokenId=${layer.tokenId}, range=[${layer.tickLower}, ${layer.tickUpper}], weight=${layer.weight}%`);
    } catch {
      break;
    }
  }
}
main().catch(console.error);
