import { ethers } from "hardhat";

const POSITION_MANAGER = "0xAAA78E8C4241990B4ce159E105dA08129345946A";
const TOKEN_ID = 4000;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check NFT Position ===\n");

  const pm = new ethers.Contract(POSITION_MANAGER, [
    "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
    "function ownerOf(uint256 tokenId) view returns (address)"
  ], signer);

  try {
    const owner = await pm.ownerOf(TOKEN_ID);
    console.log("Owner:", owner);
    
    const pos = await pm.positions(TOKEN_ID);
    console.log("\nPosition:");
    console.log("  token0:", pos.token0);
    console.log("  token1:", pos.token1);
    console.log("  fee:", pos.fee);
    console.log("  tickLower:", pos.tickLower);
    console.log("  tickUpper:", pos.tickUpper);
    console.log("  liquidity:", pos.liquidity.toString());
    console.log("  tokensOwed0:", ethers.utils.formatUnits(pos.tokensOwed0, 18));
    console.log("  tokensOwed1:", ethers.utils.formatUnits(pos.tokensOwed1, 18));
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 200));
  }
}
main().catch(console.error);
