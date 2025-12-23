import { ethers } from "hardhat";

const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const POSITION_MANAGER = "0xAAA78E8C4241990B4ce159E105dA08129345946A";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check V3LPVault State ===\n");

  const v3 = new ethers.Contract(V3LP_VAULT, [
    "function layers(uint256) view returns (int24 tickLower, int24 tickUpper, uint256 tokenId, uint128 liquidity)",
    "function positionManager() view returns (address)",
    "function pool() view returns (address)"
  ], signer);

  const pm = new ethers.Contract(POSITION_MANAGER, [
    "function balanceOf(address) view returns (uint256)",
    "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
    "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"
  ], signer);

  console.log("V3LPVault.positionManager:", await v3.positionManager());
  console.log("V3LPVault.pool:", await v3.pool());

  // Check how many NFTs the vault owns
  const nftBalance = await pm.balanceOf(V3LP_VAULT);
  console.log("\nNFT balance of V3LPVault:", nftBalance.toString());

  // List all NFTs owned
  for (let i = 0; i < Math.min(nftBalance.toNumber(), 10); i++) {
    const tokenId = await pm.tokenOfOwnerByIndex(V3LP_VAULT, i);
    console.log(`\nNFT #${tokenId}:`);
    const pos = await pm.positions(tokenId);
    console.log("  liquidity:", pos.liquidity.toString());
    console.log("  tickLower:", pos.tickLower);
    console.log("  tickUpper:", pos.tickUpper);
    console.log("  tokensOwed0:", pos.tokensOwed0.toString());
    console.log("  tokensOwed1:", pos.tokensOwed1.toString());
  }

  // Check configured layers
  console.log("\n--- Configured Layers ---");
  for (let i = 0; i < 10; i++) {
    try {
      const layer = await v3.layers(i);
      if (layer.tokenId.toString() === "0") break;
      console.log(`Layer ${i}: tokenId=${layer.tokenId}, liquidity=${layer.liquidity}`);
    } catch {
      break;
    }
  }
}
main().catch(console.error);
