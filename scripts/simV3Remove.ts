import { ethers } from "hardhat";

const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";
const NEW_AMM = "0x34e9a683199E566F494e6C9C3fA299479D5e028F";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Simulate V3 Remove Liquidity (as AMM) ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);

  // We can't easily simulate "as AMM" without impersonation
  // But let's check if the owner can remove liquidity
  
  const v3 = new ethers.Contract(V3_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) external returns (uint256, uint256)",
    "function isOperator(address) view returns (bool)",
    "function owner() view returns (address)"
  ], signer);

  const owner = await v3.owner();
  console.log("V3 owner:", owner);
  console.log("Signer:", signer.address);
  console.log("Is owner:", owner.toLowerCase() === signer.address.toLowerCase());
  console.log("AMM is operator:", await v3.isOperator(NEW_AMM));

  // Check AMM's MIM balance before
  const ammMIMBefore = await mim.balanceOf(NEW_AMM);
  console.log("\nAMM MIM balance:", ethers.utils.formatUnits(ammMIMBefore, 18));

  // Simulate removeLiquidity as owner (should work)
  console.log("\n--- Simulating removeLiquidity as owner ---");
  try {
    const [a0, a1] = await v3.callStatic.removeLiquidity(10000, 0, 0);
    console.log("Would get sWETH:", ethers.utils.formatUnits(a0, 18));
    console.log("Would get MIM:", ethers.utils.formatUnits(a1, 18));
  } catch (e: any) {
    console.log("Failed:", e.reason || e.message?.slice(0, 200));
  }
}
main().catch(console.error);
