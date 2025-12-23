import { ethers } from "hardhat";

const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Fix V3LPVault Layers ===\n");
  
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function setLayerTokenId(uint256 index, uint256 newTokenId) external",
    "function layers(uint256) view returns (int24,int24,uint256,uint128)"
  ], signer);
  
  // The actual tokenIds are 36, 37, 38, 39
  // Need to map to layers 0, 1, 2, 3
  const correctTokenIds = [36, 37, 38, 39];
  
  console.log("Fixing layer tokenIds...");
  for (let i = 0; i < correctTokenIds.length; i++) {
    console.log(`  Setting layer ${i} tokenId to ${correctTokenIds[i]}...`);
    await (await v3Vault.setLayerTokenId(i, correctTokenIds[i])).wait();
    
    const layer = await v3Vault.layers(i);
    console.log(`    Layer ${i}: tickLower=${layer[0]}, tickUpper=${layer[1]}, tokenId=${layer[2].toString()}, liquidity=${layer[3].toString()}`);
  }
  
  console.log("\n=== Layers Fixed ===");
}
main().catch(console.error);
