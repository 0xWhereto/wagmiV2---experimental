import { ethers } from "hardhat";

const V9_V3LP = "0x1139d155D39b2520047178444C51D3D70204650F";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Rescuing from v9 with:", signer.address);
  
  const sWETH = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const v3LPVault = new ethers.Contract(V9_V3LP, [
    "function rescueTokens(address,uint256) external",
    "function removeLiquidity(uint256,uint256,uint256) external returns (uint256,uint256)",
    "function getLayerCount() view returns (uint256)",
    "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
  ], signer);
  
  const sWETHBefore = await sWETH.balanceOf(signer.address);
  console.log("\nBefore sWETH:", ethers.utils.formatEther(sWETHBefore));
  
  // Check remaining liquidity
  const layerCount = await v3LPVault.getLayerCount();
  let totalLiq = ethers.BigNumber.from(0);
  for (let i = 0; i < layerCount.toNumber(); i++) {
    const layer = await v3LPVault.layers(i);
    totalLiq = totalLiq.add(layer[4]);
    console.log(`Layer ${i}: liquidity=${layer[4].toString()}`);
  }
  console.log("Total liquidity:", totalLiq.toString());
  
  // Remove remaining liquidity
  if (totalLiq.gt(0)) {
    console.log("\nRemoving liquidity...");
    try {
      const tx = await v3LPVault.removeLiquidity(10000, 0, 0, { gasLimit: 2000000 });
      await tx.wait();
      console.log("✓ Liquidity removed!");
    } catch (e: any) {
      console.log("✗ Failed:", e.message?.slice(0, 100));
    }
  }
  
  // Rescue loose tokens
  const looseBalance = await sWETH.balanceOf(V9_V3LP);
  console.log("\nLoose sWETH in vault:", ethers.utils.formatEther(looseBalance));
  
  if (looseBalance.gt(0)) {
    console.log("Calling rescueTokens...");
    try {
      const tx = await v3LPVault.rescueTokens(SWETH, 0, { gasLimit: 500000 });
      await tx.wait();
      console.log("✓ Tokens rescued!");
    } catch (e: any) {
      console.log("✗ Failed:", e.message?.slice(0, 100));
    }
  }
  
  const sWETHAfter = await sWETH.balanceOf(signer.address);
  console.log("\n=== RESULTS ===");
  console.log("After sWETH:", ethers.utils.formatEther(sWETHAfter));
  console.log("Recovered:", ethers.utils.formatEther(sWETHAfter.sub(sWETHBefore)));
}

main().catch(console.error);


