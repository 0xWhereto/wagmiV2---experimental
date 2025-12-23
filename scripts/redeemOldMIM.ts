import { ethers } from "hardhat";

const OLD_MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SUSDC = "0xd3DCe716f3eF535C5Ff8d041c1A41C3bd89b97aE";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Redeem Old MIM for sUSDC ===\n");
  
  // Check what functions old MIM has
  const MIM = await ethers.getContractFactory("MIM");
  const oldMim = MIM.attach(OLD_MIM);
  
  const susdc = new ethers.Contract(SUSDC, [
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  const myMIM = await oldMim.balanceOf(signer.address);
  console.log("My old MIM:", ethers.utils.formatEther(myMIM));
  console.log("My sUSDC before:", ethers.utils.formatUnits(await susdc.balanceOf(signer.address), 6));
  
  // Try to redeem
  console.log("\nAttempting to redeem MIM for sUSDC...");
  
  // Check if there's sUSDC in the old MIM pool
  const usdcInMIM = await susdc.balanceOf(OLD_MIM);
  console.log("sUSDC in old MIM contract:", ethers.utils.formatUnits(usdcInMIM, 6));
  
  if (usdcInMIM.gt(0)) {
    // Try redeem function
    try {
      const redeemAmount = myMIM.div(2); // Redeem half
      const tx = await oldMim.redeemForUSDC(redeemAmount, { gasLimit: 500000 });
      await tx.wait();
      console.log("✓ Redeemed successfully!");
      console.log("sUSDC after:", ethers.utils.formatUnits(await susdc.balanceOf(signer.address), 6));
    } catch (e: any) {
      console.log("✗ Redeem failed:", e.reason || e.message?.slice(0, 100));
    }
  } else {
    console.log("No sUSDC in old MIM contract to redeem");
  }
  
  // Alternative: check old MIM/sUSDC pool
  console.log("\nChecking MIM/sUSDC pool liquidity...");
  const OLD_POOL = "0xABc..."; // We don't know this address
  
  // Actually, let's just mint new MIM with an owner function
  console.log("\n⚠️  Best option: Deploy a simple MIM with owner mint for testing");
}
main().catch(console.error);
