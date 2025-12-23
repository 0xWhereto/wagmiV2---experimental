import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const V3_VAULT = "0x64B933Ce0536f5508cf9Ccec9628E969434dc8E1";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check V3LPVault State ===\n");
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function getTotalAssets() view returns (uint256, uint256)",
    "function getLayerCount() view returns (uint256)",
    "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
    "function totalToken0() view returns (uint256)",
    "function totalToken1() view returns (uint256)"
  ], signer);
  
  const positionManager = new ethers.Contract(POSITION_MANAGER, [
    "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)"
  ], signer);
  
  // Direct token balances in V3Vault
  const swethInVault = await sweth.balanceOf(V3_VAULT);
  const mimInVault = await mim.balanceOf(V3_VAULT);
  console.log("Direct token balances in V3Vault:");
  console.log("  sWETH:", ethers.utils.formatEther(swethInVault));
  console.log("  MIM:", ethers.utils.formatEther(mimInVault));
  
  // Tracked totals
  console.log("\nV3Vault tracked totals:");
  console.log("  totalToken0:", ethers.utils.formatEther(await v3Vault.totalToken0()));
  console.log("  totalToken1:", ethers.utils.formatEther(await v3Vault.totalToken1()));
  
  // getTotalAssets (calculated from positions)
  const [asset0, asset1] = await v3Vault.getTotalAssets();
  console.log("\ngetTotalAssets() (from positions):");
  console.log("  sWETH:", ethers.utils.formatEther(asset0));
  console.log("  MIM:", ethers.utils.formatEther(asset1));
  
  // Check each layer
  const layerCount = await v3Vault.getLayerCount();
  console.log("\nLayers:");
  for (let i = 0; i < layerCount; i++) {
    const layer = await v3Vault.layers(i);
    const tokenId = layer[3].toNumber();
    console.log(`\n  Layer ${i}:`);
    console.log(`    tickLower: ${layer[0]}, tickUpper: ${layer[1]}`);
    console.log(`    weight: ${layer[2].toString()}, tokenId: ${tokenId}`);
    console.log(`    tracked liquidity: ${layer[4].toString()}`);
    
    if (tokenId > 0) {
      const pos = await positionManager.positions(tokenId);
      console.log(`    actual liquidity: ${pos[7].toString()}`);
    }
  }
}
main().catch(console.error);
