import { ethers } from "hardhat";

const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";
const NEW_AMM = "0x34e9a683199E566F494e6C9C3fA299479D5e028F";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test AMM Remove Liquidity ===\n");

  // Impersonate AMM
  await ethers.provider.send("hardhat_impersonateAccount", [NEW_AMM]);
  const ammSigner = await ethers.provider.getSigner(NEW_AMM);

  // Fund AMM with some ETH for gas (hardhat only)
  await signer.sendTransaction({ to: NEW_AMM, value: ethers.utils.parseEther("0.01") });

  const v3 = new ethers.Contract(V3_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) external returns (uint256, uint256)"
  ], ammSigner);

  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);

  console.log("Before:");
  console.log("  AMM MIM:", ethers.utils.formatUnits(await mim.balanceOf(NEW_AMM), 18));
  console.log("  AMM sWETH:", ethers.utils.formatUnits(await sweth.balanceOf(NEW_AMM), 18));

  // Try to remove liquidity as AMM
  console.log("\n--- Calling removeLiquidity as AMM ---");
  try {
    const tx = await v3.removeLiquidity(10000, 0, 0, { gasLimit: 2000000 });
    await tx.wait();
    console.log("✅ Success!");
    
    console.log("\nAfter:");
    console.log("  AMM MIM:", ethers.utils.formatUnits(await mim.balanceOf(NEW_AMM), 18));
    console.log("  AMM sWETH:", ethers.utils.formatUnits(await sweth.balanceOf(NEW_AMM), 18));
  } catch (e: any) {
    console.log("❌ Failed:", e.reason || e.message?.slice(0, 200));
  }
}
main().catch(console.error);
