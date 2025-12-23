import { ethers } from "hardhat";

const V3_VAULT = "0x825Bccfba2a8814996c5ea91701885Bd6A7025d6";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check V3 Vault NFT Ownership ===\n");
  
  const positionManager = new ethers.Contract(POSITION_MANAGER, [
    "function balanceOf(address) view returns (uint256)",
    "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
    "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
    "function ownerOf(uint256) view returns (address)"
  ], signer);
  
  const balance = await positionManager.balanceOf(V3_VAULT);
  console.log("V3LPVault owns", balance.toString(), "NFT positions");
  
  if (balance.gt(0)) {
    console.log("\nOwned positions:");
    for (let i = 0; i < balance.toNumber(); i++) {
      const tokenId = await positionManager.tokenOfOwnerByIndex(V3_VAULT, i);
      const pos = await positionManager.positions(tokenId);
      console.log(`  TokenId ${tokenId.toString()}: tickLower=${pos[5]}, tickUpper=${pos[6]}, liquidity=${pos[7].toString()}`);
    }
  }
  
  // Check the fake token IDs
  console.log("\nChecking configured layer tokenIds:");
  for (const tokenId of [4000, 3000, 2000, 1000]) {
    try {
      const owner = await positionManager.ownerOf(tokenId);
      console.log(`  TokenId ${tokenId}: owned by ${owner}`);
    } catch {
      console.log(`  TokenId ${tokenId}: DOES NOT EXIST`);
    }
  }
}
main().catch(console.error);
