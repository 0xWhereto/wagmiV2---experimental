import { ethers } from "hardhat";

const V3_VAULT = "0xD9BaA26A6bA870663C411a410446f6B78b56C6a7";
const LEVERAGE_AMM = "0xf6b8AC2c2EfeA1966dd0696091e6c461a6a90cd1";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check V22 State ===\n");
  
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = V3LPVault.attach(V3_VAULT);
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  console.log("V3Vault direct balances:");
  console.log("  sWETH:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
  console.log("  MIM:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
  
  const [asset0, asset1] = await v3Vault.getTotalAssets();
  console.log("\nV3 getTotalAssets:");
  console.log("  sWETH:", ethers.utils.formatEther(asset0));
  console.log("  MIM:", ethers.utils.formatEther(asset1));
  
  console.log("\nLayers:");
  const layerCount = await v3Vault.getLayerCount();
  for (let i = 0; i < layerCount; i++) {
    const layer = await v3Vault.layers(i);
    console.log(`  Layer ${i}: tokenId=${layer[3].toString()}, liquidity=${layer[4].toString()}`);
  }
  
  console.log("\nLeverageAMM balances:");
  console.log("  sWETH:", ethers.utils.formatEther(await sweth.balanceOf(LEVERAGE_AMM)));
  console.log("  MIM:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
  
  // Try calling removeLiquidity as owner
  console.log("\n--- Testing removeLiquidity as owner ---");
  try {
    const result = await v3Vault.callStatic.removeLiquidity(10000, 0, 0, { gasLimit: 2000000 });
    console.log("Would return:", ethers.utils.formatEther(result[0]), "sWETH,", ethers.utils.formatEther(result[1]), "MIM");
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message);
  }
}
main().catch(console.error);
