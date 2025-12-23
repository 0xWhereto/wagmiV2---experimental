import { ethers } from "hardhat";

const V3_VAULT = "0xD9BaA26A6bA870663C411a410446f6B78b56C6a7";
const LEVERAGE_AMM = "0xf6b8AC2c2EfeA1966dd0696091e6c461a6a90cd1";
const WTOKEN = "0x6E6B84782d191B3E349Fd132Ff5C070f7085a7de";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Trace V22 Failure ===\n");
  
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = V3LPVault.attach(V3_VAULT);
  
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = LeverageAMM.attach(LEVERAGE_AMM);
  
  const WTokenContract = await ethers.getContractFactory("WToken");
  const wToken = WTokenContract.attach(WTOKEN);
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  // Check if removeLiquidity returns the correct values when called by leverageAMM
  console.log("Checking removeLiquidity call path...\n");
  
  console.log("1. V3LPVault.isOperator(LeverageAMM):", await v3Vault.isOperator(LEVERAGE_AMM));
  console.log("2. LeverageAMM.wToken:", await leverageAMM.wToken());
  console.log("3. LeverageAMM.v3LPVault:", await leverageAMM.v3LPVault());
  
  // Get the shares to withdraw
  const wTokenBal = await wToken.balanceOf(signer.address);
  const totalSupply = await wToken.totalSupply();
  console.log("\n4. wToken balance:", ethers.utils.formatEther(wTokenBal));
  console.log("5. wToken totalSupply:", ethers.utils.formatEther(totalSupply));
  
  // Calculate what closePosition would do
  const WAD = ethers.utils.parseEther("1");
  const withdrawPercent = wTokenBal.mul(WAD).div(totalSupply);
  console.log("\n6. withdrawPercent (WAD):", ethers.utils.formatEther(withdrawPercent));
  
  const basisPoints = withdrawPercent.mul(10000).div(WAD);
  console.log("7. basisPoints for removeLiquidity:", basisPoints.toString());
  
  // Now let's try calling removeLiquidity as the OWNER (not as LeverageAMM)
  // and verify the return values match
  console.log("\n--- Owner calling removeLiquidity with same params ---");
  try {
    const result = await v3Vault.callStatic.removeLiquidity(basisPoints, 0, 0);
    console.log("Would return:", ethers.utils.formatEther(result[0]), "sWETH,", ethers.utils.formatEther(result[1]), "MIM");
  } catch (err: any) {
    console.log("FAILED:", err.reason);
  }
  
  // Let's also check if the issue is in closePosition before removeLiquidity
  // by trying to call closePosition directly
  console.log("\n--- Directly simulating closePosition ---");
  try {
    const result = await leverageAMM.callStatic.closePosition(wTokenBal, totalSupply, { from: WTOKEN, gasLimit: 3000000 });
    console.log("closePosition would return:", ethers.utils.formatEther(result), "sWETH");
  } catch (err: any) {
    console.log("closePosition FAILED:", err.reason);
  }
}
main().catch(console.error);
