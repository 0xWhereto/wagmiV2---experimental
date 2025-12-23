import { ethers } from "hardhat";

const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check V3 Layers (Corrected) ===\n");

  const v3 = new ethers.Contract(V3_VAULT, [
    "function layers(uint256) view returns (int24 tickLower, int24 tickUpper, uint256 weight, uint256 tokenId, uint128 liquidity)"
  ], signer);

  const pm = new ethers.Contract(POSITION_MANAGER, [
    "function positions(uint256) view returns (uint96, address, address, address, uint24, int24, int24, uint128, uint256, uint256, uint128, uint128)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);

  // Count NFTs
  const nftCount = await pm.balanceOf(V3_VAULT);
  console.log("V3LPVault owns", nftCount.toString(), "NFTs\n");

  // Check layers
  console.log("Configured Layers:");
  for (let i = 0; i < 10; i++) {
    try {
      const layer = await v3.layers(i);
      console.log(`Layer ${i}:`);
      console.log(`  tickLower: ${layer.tickLower}`);
      console.log(`  tickUpper: ${layer.tickUpper}`);
      console.log(`  weight: ${layer.weight}`);
      console.log(`  tokenId: ${layer.tokenId}`);
      console.log(`  liquidity: ${layer.liquidity}`);
      
      if (layer.tokenId.gt(0)) {
        try {
          const pos = await pm.positions(layer.tokenId);
          console.log(`  -> NFT liquidity: ${pos[7]}`);
        } catch {
          console.log(`  -> NFT NOT FOUND`);
        }
      }
    } catch {
      break;
    }
  }
}
main().catch(console.error);
