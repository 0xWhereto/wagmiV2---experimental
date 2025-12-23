import { ethers } from "hardhat";

const V3_VAULT = "0x64B933Ce0536f5508cf9Ccec9628E969434dc8E1";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check V19 Layer Details ===\n");
  
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function getLayerCount() view returns (uint256)",
    "function layers(uint256) view returns (int24 tickLower, int24 tickUpper, uint256 weight, uint256 tokenId, uint128 liquidity)"
  ], signer);

  const layerCount = await v3Vault.getLayerCount();
  console.log("Layer count:", layerCount.toString());
  
  for (let i = 0; i < layerCount; i++) {
    const layer = await v3Vault.layers(i);
    console.log(`\nLayer ${i}:`);
    console.log(`  tickLower: ${layer.tickLower}`);
    console.log(`  tickUpper: ${layer.tickUpper}`);
    console.log(`  weight: ${layer.weight.toString()}`);
    console.log(`  tokenId: ${layer.tokenId.toString()}`);
    console.log(`  liquidity: ${layer.liquidity.toString()}`);
  }
}
main().catch(console.error);
