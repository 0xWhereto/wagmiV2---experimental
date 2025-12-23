import { ethers } from "hardhat";

const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
// Use lower case address to avoid checksum issues
const PM = "0x5826e10b513c891910032f15292b2f1b3041c3df";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Checking NFT Positions in V3LPVault ===\n");
  console.log("V3LPVault:", V3LP_VAULT);
  console.log("Position Manager:", PM);

  const positionManager = new ethers.Contract(PM, [
    "function balanceOf(address) view returns (uint256)",
    "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
    "function positions(uint256) view returns (uint96, address, address, address, uint24, int24, int24, uint128, uint256, uint256, uint128, uint128)"
  ], signer);

  try {
    const nftBalance = await positionManager.balanceOf(V3LP_VAULT);
    console.log("\nV3LPVault owns", nftBalance.toString(), "NFT positions");
    
    if (nftBalance.gt(0)) {
      for (let i = 0; i < Math.min(5, nftBalance.toNumber()); i++) {
        const tokenId = await positionManager.tokenOfOwnerByIndex(V3LP_VAULT, i);
        console.log(`\nPosition ${i}: tokenId = ${tokenId.toString()}`);
        
        try {
          const pos = await positionManager.positions(tokenId);
          console.log(`  token0: ${pos[2]}`);
          console.log(`  token1: ${pos[3]}`);
          console.log(`  fee: ${pos[4]}`);
          console.log(`  tickLower: ${pos[5]}`);
          console.log(`  tickUpper: ${pos[6]}`);
          console.log(`  liquidity: ${pos[7].toString()}`);
        } catch (e: any) {
          console.log(`  Error reading position: ${e.message?.slice(0, 100)}`);
        }
      }
    } else {
      console.log("\n❌ V3LPVault has NO NFT positions!");
      console.log("This could be why withdrawals fail - no liquidity to remove");
    }
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 200));
  }

  // Also check if LeverageAMM owns any
  const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";
  try {
    const ammBalance = await positionManager.balanceOf(LEVERAGE_AMM);
    console.log("\nLeverageAMM owns", ammBalance.toString(), "NFT positions");
  } catch (e: any) {
    console.log("Error checking AMM:", e.message?.slice(0, 100));
  }
  
  // Check wETH vault
  const WETH_VAULT = "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7";
  try {
    const wethBalance = await positionManager.balanceOf(WETH_VAULT);
    console.log("wETH Vault owns", wethBalance.toString(), "NFT positions");
  } catch (e: any) {
    console.log("Error checking wETH:", e.message?.slice(0, 100));
  }
}

main().catch(console.error);
