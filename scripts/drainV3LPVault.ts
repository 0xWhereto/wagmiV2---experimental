import { ethers } from "hardhat";

const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Draining V3LPVault ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);

  const mimBefore = await mim.balanceOf(signer.address);
  const swethBefore = await sweth.balanceOf(signer.address);
  
  console.log("Before:");
  console.log("  My MIM:", ethers.utils.formatUnits(mimBefore, 18));
  console.log("  My sWETH:", ethers.utils.formatUnits(swethBefore, 18));

  const v3Vault = new ethers.Contract(V3LP_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) returns (uint256, uint256)",
    "function owner() view returns (address)"
  ], signer);

  // Check owner
  const owner = await v3Vault.owner();
  console.log("\nV3LPVault owner:", owner);
  console.log("Is me:", owner.toLowerCase() === signer.address.toLowerCase());

  if (owner.toLowerCase() === signer.address.toLowerCase()) {
    // Remove all liquidity
    console.log("\nRemoving 100% liquidity...");
    try {
      const tx = await v3Vault.removeLiquidity(10000, 0, 0, { gasLimit: 1000000 });
      await tx.wait();
      console.log("✅ Liquidity removed");
    } catch (e: any) {
      console.log("❌ Failed:", e.message?.slice(0, 100));
    }
  }

  const mimAfter = await mim.balanceOf(signer.address);
  const swethAfter = await sweth.balanceOf(signer.address);
  
  console.log("\nAfter:");
  console.log("  My MIM:", ethers.utils.formatUnits(mimAfter, 18));
  console.log("  My sWETH:", ethers.utils.formatUnits(swethAfter, 18));
  console.log("\nReceived:");
  console.log("  MIM:", ethers.utils.formatUnits(mimAfter.sub(mimBefore), 18));
  console.log("  sWETH:", ethers.utils.formatUnits(swethAfter.sub(swethBefore), 18));
}

main().catch(console.error);
